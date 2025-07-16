const prisma = require('../lib/database');

class DatabaseFileService {
  async writeFile(userId, fileName, content) {
    try {
      // Ensure user exists
      await prisma.user.upsert({
        where: { userId },
        update: {},
        create: { userId }
      });

      // Determine file type based on extension
      const fileType = this._getFileType(fileName);
      
      // Ensure content is string
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

      const file = await prisma.userFile.upsert({
        where: {
          userId_fileName: {
            userId,
            fileName
          }
        },
        update: {
          content: contentStr,
          fileType,
          updatedAt: new Date()
        },
        create: {
          userId,
          fileName,
          content: contentStr,
          fileType
        }
      });

      return {
        success: true,
        file: this._formatFile(file)
      };
    } catch (error) {
      console.error('Error writing file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async readFile(userId, fileName) {
    try {
      const file = await prisma.userFile.findUnique({
        where: {
          userId_fileName: {
            userId,
            fileName
          }
        }
      });

      if (!file) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      // Parse JSON files back to objects
      let content = file.content;
      if (file.fileType === 'json') {
        try {
          content = JSON.parse(file.content);
        } catch (e) {
          // If parsing fails, return as string
          console.warn(`Failed to parse JSON file ${fileName}:`, e);
        }
      }

      return {
        success: true,
        content,
        file: this._formatFile(file)
      };
    } catch (error) {
      console.error('Error reading file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listFiles(userId) {
    try {
      const files = await prisma.userFile.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
      });

      return {
        success: true,
        files: files.map(file => this._formatFile(file))
      };
    } catch (error) {
      console.error('Error listing files:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteFile(userId, fileName) {
    try {
      const deletedFile = await prisma.userFile.deleteMany({
        where: {
          userId,
          fileName
        }
      });

      if (deletedFile.count === 0) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      return {
        success: true
      };
    } catch (error) {
      console.error('Error deleting file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getUserFilesByType(userId, fileType) {
    try {
      const files = await prisma.userFile.findMany({
        where: { 
          userId,
          fileType
        },
        orderBy: { updatedAt: 'desc' }
      });

      return {
        success: true,
        files: files.map(file => this._formatFile(file))
      };
    } catch (error) {
      console.error('Error getting files by type:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async searchFiles(userId, searchTerm) {
    try {
      const files = await prisma.userFile.findMany({
        where: {
          userId,
          OR: [
            { fileName: { contains: searchTerm } },
            { content: { contains: searchTerm } }
          ]
        },
        orderBy: { updatedAt: 'desc' }
      });

      return {
        success: true,
        files: files.map(file => this._formatFile(file))
      };
    } catch (error) {
      console.error('Error searching files:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper methods
  _getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
      case 'json':
        return 'json';
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'txt':
      case 'text':
        return 'text';
      default:
        return 'text';
    }
  }

  _formatFile(file) {
    return {
      id: file.id,
      userId: file.userId,
      fileName: file.fileName,
      content: file.content,
      fileType: file.fileType,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      size: file.content.length
    };
  }

  // Text Editor Handler Integration
  async handleTextEditorOperation(userId, operation) {
    try {
      const { command, path: filePath } = operation;
      
      switch (command) {
        case 'view':
          return await this._handleView(userId, filePath, operation.view_range);
        case 'create':
          return await this._handleCreate(userId, filePath, operation.file_text);
        case 'str_replace':
          return await this._handleStrReplace(userId, filePath, operation.old_str, operation.new_str);
        case 'insert_line':
          return await this._handleInsertLine(userId, filePath, operation.line_num, operation.text);
        case 'delete_line':
          return await this._handleDeleteLine(userId, filePath, operation.line_num);
        default:
          return { success: false, error: `Unsupported command: ${command}` };
      }
    } catch (error) {
      console.error('Error handling text editor operation:', error);
      return { success: false, error: error.message };
    }
  }

  async _handleView(userId, filePath, viewRange) {
    const result = await this.readFile(userId, filePath);
    
    if (!result.success) {
      return '📁 File not found. Use the create command to create it.';
    }

    const content = result.content;
    const lines = content.split('\n');
    
    if (viewRange) {
      const [start, end] = viewRange;
      const snippet = end !== -1 ? lines.slice(start - 1, end) : lines.slice(start - 1);
      const header = `# showing lines ${start}-${start + snippet.length - 1} of ${lines.length}\n`;
      return header + this._withLineNumbers(snippet, start);
    } else {
      return this._withLineNumbers(lines, 1);
    }
  }

  async _handleCreate(userId, filePath, fileText) {
    const result = await this.writeFile(userId, filePath, fileText);
    return result.success ? '✔︎ file written' : `ERROR: ${result.error}`;
  }

  async _handleStrReplace(userId, filePath, oldStr, newStr) {
    const result = await this.readFile(userId, filePath);
    
    if (!result.success) {
      return 'X file not found';
    }

    const content = result.content;
    const count = (content.match(new RegExp(this._escapeRegex(oldStr), 'g')) || []).length;
    
    if (count === 0) {
      return 'X no replacements made; string not found';
    } else if (count > 1) {
      return 'X multiple matches found; aborting to avoid ambiguity';
    } else {
      const newContent = content.replace(oldStr, newStr);
      const writeResult = await this.writeFile(userId, filePath, newContent);
      return writeResult.success ? '✔︎ 1 replacement made' : `ERROR: ${writeResult.error}`;
    }
  }

  async _handleInsertLine(userId, filePath, lineNum, text) {
    const result = await this.readFile(userId, filePath);
    
    if (!result.success) {
      return 'X file not found';
    }

    const lines = result.content.split('\n');
    if (lineNum < 1 || lineNum > lines.length + 1) {
      return 'X line_num out of range';
    }
    
    lines.splice(lineNum - 1, 0, text);
    const writeResult = await this.writeFile(userId, filePath, lines.join('\n'));
    return writeResult.success ? `✔︎ inserted at line ${lineNum}` : `ERROR: ${writeResult.error}`;
  }

  async _handleDeleteLine(userId, filePath, lineNum) {
    const result = await this.readFile(userId, filePath);
    
    if (!result.success) {
      return 'X file not found';
    }

    const lines = result.content.split('\n');
    if (lineNum < 1 || lineNum > lines.length) {
      return 'X line_num out of range';
    }
    
    const deleted = lines.splice(lineNum - 1, 1)[0];
    const writeResult = await this.writeFile(userId, filePath, lines.join('\n'));
    return writeResult.success ? `✔︎ deleted line ${lineNum}: ${deleted.substring(0, 40)}...` : `ERROR: ${writeResult.error}`;
  }

  _withLineNumbers(lines, start) {
    const width = String(start + lines.length - 1).length;
    return lines.map((line, i) => {
      const lineNum = String(start + i).padStart(width);
      return `${lineNum}| ${line}`;
    }).join('\n');
  }

  _escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = new DatabaseFileService();