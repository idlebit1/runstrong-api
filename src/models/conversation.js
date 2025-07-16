const { v4: uuidv4 } = require('uuid');

class Conversation {
  constructor(userId, title = null) {
    this.id = uuidv4();
    this.userId = userId;
    this.title = title || 'New Conversation';
    this.messages = [];
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  addMessage(role, content, toolUseResults = null) {
    const message = {
      id: uuidv4(),
      role,
      content,
      toolUseResults,
      timestamp: new Date().toISOString()
    };
    
    this.messages.push(message);
    this.updatedAt = new Date().toISOString();
    
    // Auto-generate title from first user message
    if (!this.title || this.title === 'New Conversation') {
      if (role === 'user' && typeof content === 'string') {
        this.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
      }
    }
    
    return message;
  }

  getMessages() {
    return this.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  getFullHistory() {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      messages: this.messages,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(data) {
    const conversation = new Conversation(data.userId, data.title);
    conversation.id = data.id;
    conversation.messages = data.messages || [];
    conversation.createdAt = data.createdAt;
    conversation.updatedAt = data.updatedAt;
    return conversation;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      messages: this.messages,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Conversation;