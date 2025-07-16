const fs = require('fs').promises;
const path = require('path');

class TextEditorHandler {
  /**
   * Implements Anthropic's built-in `text_editor` tool for file operations.
   * 
   * Supported commands:
   *   • view          {path, view_range?}
   *   • str_replace   {path, old_str, new_str, count?}
   *   • insert_line   {path, line_num, text}
   *   • delete_line   {path, line_num}
   *   • create        {path, file_text}
   * 
   * All paths are sandbox-relative to root_path.
   * Line numbers are 1-indexed (Anthropic convention).
   */
  constructor(rootPath, maxTokens = 200000, safetyMargin = 4000) {
    this.rootPath = path.resolve(rootPath);
    this.maxTokens = maxTokens;
    this.safetyMargin = safetyMargin;
    this.tokenizer = this._simpleWordTokenizer;
  }

  /**
   * Handle a tool use request from Claude
   */
  async handle(toolUse) {
    try {
      const command = toolUse.input?.command;
      if (!command) {
        console.error('Error in tool_use input:', JSON.stringify(toolUse.input, null, 2));
        return this._error(toolUse, 'missing command in tool_use input');
      }

      const handlerMethod = this[`_cmd${command.charAt(0).toUpperCase() + command.slice(1)}`];
      if (!handlerMethod) {
        return this._error(toolUse, `unsupported command: ${command}`);
      }

      const result = await handlerMethod.call(this, toolUse.input);
      return this._ok(toolUse, result);
    } catch (error) {
      return this._error(toolUse, error.message);
    }
  }

  // Command handlers
  async _cmdView(args) {
    const filePath = this._safePath(args.path);
    const viewRange = args.view_range; // [start, end] (1-indexed)

    try {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(filePath);
        return 'Directory listing:\n' + files.join('\n');
      }

      const text = await fs.readFile(filePath, 'utf-8');
      
      // Long-file safeguard
      const tokens = this.tokenizer(text);
      let effectiveViewRange = viewRange;
      
      if (tokens > this.maxTokens - this.safetyMargin && !viewRange) {
        // Default to first 400 lines if caller didn't pick a slice
        effectiveViewRange = [1, 400];
      }

      if (effectiveViewRange) {
        const [start, end] = this._normalizeRange(effectiveViewRange);
        const lines = text.split('\n');
        const snippet = end !== -1 ? lines.slice(start - 1, end) : lines.slice(start - 1);
        const header = `# showing lines ${start}-${start + snippet.length - 1} of ${lines.length} (file truncated)\n`;
        return header + this._withLineNumbers(snippet, start);
      } else {
        const lines = text.split('\n');
        return this._withLineNumbers(lines, 1);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${args.path}`);
      }
      throw error;
    }
  }

  async _cmdStrReplace(args) {
    const filePath = this._safePath(args.path);
    const oldStr = args.old_str;
    const newStr = args.new_str;

    try {
      const text = await fs.readFile(filePath, 'utf-8');
      
      const count = (text.match(new RegExp(this._escapeRegex(oldStr), 'g')) || []).length;
      
      if (count === 0) {
        return 'X no replacements made; string not found';
      } else if (count > 1) {
        return 'X multiple matches found; aborting to avoid ambiguity';
      } else {
        const newText = text.replace(oldStr, newStr);
        await fs.writeFile(filePath, newText, 'utf-8');
        return '✔︎ 1 replacement made';
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${args.path}`);
      }
      throw error;
    }
  }

  async _cmdInsertLine(args) {
    const filePath = this._safePath(args.path);
    const lineNum = args.line_num;
    const text = args.text;

    try {
      const fileText = await fs.readFile(filePath, 'utf-8');
      const lines = fileText.split('\n');
      
      if (lineNum < 1 || lineNum > lines.length + 1) {
        throw new Error('line_num out of range');
      }
      
      lines.splice(lineNum - 1, 0, text);
      await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
      return `✔︎ inserted at line ${lineNum}`;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${args.path}`);
      }
      throw error;
    }
  }

  async _cmdDeleteLine(args) {
    const filePath = this._safePath(args.path);
    const lineNum = args.line_num;

    try {
      const fileText = await fs.readFile(filePath, 'utf-8');
      const lines = fileText.split('\n');
      
      if (lineNum < 1 || lineNum > lines.length) {
        throw new Error('line_num out of range');
      }
      
      const deleted = lines.splice(lineNum - 1, 1)[0];
      await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
      return `✔︎ deleted line ${lineNum}: ${deleted.substring(0, 40)}...`;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${args.path}`);
      }
      throw error;
    }
  }

  async _cmdCreate(args) {
    const filePath = this._safePath(args.path);
    const text = args.file_text;

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, text, 'utf-8');
      return '✔︎ file written';
    } catch (error) {
      throw error;
    }
  }

  // Helper methods
  _safePath(inputPath) {
    const resolvedPath = path.resolve(this.rootPath, inputPath.replace(/^\//, ''));
    
    if (!resolvedPath.startsWith(this.rootPath)) {
      throw new Error('path escapes sandbox');
    }
    
    return resolvedPath;
  }

  _withLineNumbers(lines, start) {
    const width = String(start + lines.length - 1).length;
    return lines.map((line, i) => {
      const lineNum = String(start + i).padStart(width);
      return `${lineNum}| ${line}`;
    }).join('\n');
  }

  _normalizeRange(range) {
    if (!Array.isArray(range) || range.length !== 2) {
      throw new Error('view_range must be [start, end]');
    }
    
    const [start, end] = range;
    if (start < 1) {
      throw new Error('start must be ≥1');
    }
    
    return [start, end];
  }

  _simpleWordTokenizer(text) {
    // Cheap placeholder; swap out for a real tokenizer if needed
    return text.split(/\s+/).length;
  }

  _escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _ok(toolUse, body) {
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: body
    };
  }

  _error(toolUse, message) {
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: `ERROR: ${message}`
    };
  }
}

module.exports = TextEditorHandler;