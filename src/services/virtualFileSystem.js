const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class VirtualFileSystem {
  constructor() {
    this.baseDir = path.join(__dirname, '..', 'data', 'userFiles');
    this.ensureBaseDirectory();
  }

  async ensureBaseDirectory() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.error('Error creating base directory:', error);
    }
  }

  getUserDirectory(userId) {
    return path.join(this.baseDir, userId);
  }

  async ensureUserDirectory(userId) {
    const userDir = this.getUserDirectory(userId);
    try {
      await fs.mkdir(userDir, { recursive: true });
      return userDir;
    } catch (error) {
      console.error('Error creating user directory:', error);
      throw error;
    }
  }

  async writeFile(userId, fileName, content) {
    try {
      const userDir = await this.ensureUserDirectory(userId);
      const filePath = path.join(userDir, fileName);
      
      // Security check: ensure file is within user directory
      if (!filePath.startsWith(userDir)) {
        throw new Error('Invalid file path');
      }
      
      await fs.writeFile(filePath, JSON.stringify(content, null, 2));
      return { success: true, path: filePath };
    } catch (error) {
      console.error('Error writing file:', error);
      return { success: false, error: error.message };
    }
  }

  async readFile(userId, fileName) {
    try {
      const userDir = this.getUserDirectory(userId);
      const filePath = path.join(userDir, fileName);
      
      // Security check: ensure file is within user directory
      if (!filePath.startsWith(userDir)) {
        throw new Error('Invalid file path');
      }
      
      const content = await fs.readFile(filePath, 'utf8');
      return { success: true, content: JSON.parse(content) };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: false, error: 'File not found' };
      }
      console.error('Error reading file:', error);
      return { success: false, error: error.message };
    }
  }

  async listFiles(userId) {
    try {
      const userDir = this.getUserDirectory(userId);
      const files = await fs.readdir(userDir);
      return { success: true, files };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, files: [] };
      }
      console.error('Error listing files:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteFile(userId, fileName) {
    try {
      const userDir = this.getUserDirectory(userId);
      const filePath = path.join(userDir, fileName);
      
      // Security check: ensure file is within user directory
      if (!filePath.startsWith(userDir)) {
        throw new Error('Invalid file path');
      }
      
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: false, error: 'File not found' };
      }
      console.error('Error deleting file:', error);
      return { success: false, error: error.message };
    }
  }

  async getFileStats(userId, fileName) {
    try {
      const userDir = this.getUserDirectory(userId);
      const filePath = path.join(userDir, fileName);
      
      // Security check: ensure file is within user directory
      if (!filePath.startsWith(userDir)) {
        throw new Error('Invalid file path');
      }
      
      const stats = await fs.stat(filePath);
      return {
        success: true,
        stats: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        }
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: false, error: 'File not found' };
      }
      console.error('Error getting file stats:', error);
      return { success: false, error: error.message };
    }
  }

  generateUserId() {
    return uuidv4();
  }
}

module.exports = new VirtualFileSystem();