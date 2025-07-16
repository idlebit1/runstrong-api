const databaseFileService = require('./databaseFileService');

class DatabaseTextEditorHandler {
  constructor(userId) {
    this.userId = userId;
  }

  async handle(toolUse) {
    try {
      const command = toolUse.input?.command;
      if (!command) {
        console.error('Error in tool_use input:', JSON.stringify(toolUse.input, null, 2));
        return this._error(toolUse, 'missing command in tool_use input');
      }

      const result = await databaseFileService.handleTextEditorOperation(this.userId, toolUse.input);
      
      if (result.success === false) {
        return this._error(toolUse, result.error);
      }

      return this._ok(toolUse, result);
    } catch (error) {
      console.error('Database text editor handler error:', error);
      return this._error(toolUse, error.message);
    }
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

module.exports = DatabaseTextEditorHandler;