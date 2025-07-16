const fs = require('fs').promises;
const path = require('path');
const Conversation = require('../models/conversation');

class ConversationService {
  constructor() {
    this.conversationsPath = path.join(process.cwd(), 'src', 'data', 'conversations');
    this.ensureDirectoryExists();
  }

  async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.conversationsPath, { recursive: true });
    } catch (error) {
      console.error('Error creating conversations directory:', error);
    }
  }

  getConversationFilePath(conversationId) {
    return path.join(this.conversationsPath, `${conversationId}.json`);
  }

  async createConversation(userId, title = null) {
    try {
      const conversation = new Conversation(userId, title);
      await this.saveConversation(conversation);
      return {
        success: true,
        conversation: conversation.toJSON()
      };
    } catch (error) {
      console.error('Error creating conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getConversation(conversationId) {
    try {
      const filePath = this.getConversationFilePath(conversationId);
      const data = await fs.readFile(filePath, 'utf-8');
      const conversationData = JSON.parse(data);
      const conversation = Conversation.fromJSON(conversationData);
      
      return {
        success: true,
        conversation
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          error: 'Conversation not found'
        };
      }
      console.error('Error reading conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async saveConversation(conversation) {
    try {
      const filePath = this.getConversationFilePath(conversation.id);
      await fs.writeFile(filePath, JSON.stringify(conversation.toJSON(), null, 2), 'utf-8');
      return {
        success: true
      };
    } catch (error) {
      console.error('Error saving conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addMessageToConversation(conversationId, role, content, toolUseResults = null) {
    try {
      const result = await this.getConversation(conversationId);
      if (!result.success) {
        return result;
      }

      const conversation = result.conversation;
      const message = conversation.addMessage(role, content, toolUseResults);
      
      await this.saveConversation(conversation);
      
      return {
        success: true,
        message,
        conversation: conversation.toJSON()
      };
    } catch (error) {
      console.error('Error adding message to conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getUserConversations(userId, limit = 50) {
    try {
      await this.ensureDirectoryExists();
      const files = await fs.readdir(this.conversationsPath);
      const conversationFiles = files.filter(file => file.endsWith('.json'));
      
      const conversations = [];
      
      for (const file of conversationFiles) {
        try {
          const filePath = path.join(this.conversationsPath, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const conversationData = JSON.parse(data);
          
          // Filter by userId
          if (conversationData.userId === userId) {
            conversations.push({
              id: conversationData.id,
              title: conversationData.title,
              createdAt: conversationData.createdAt,
              updatedAt: conversationData.updatedAt,
              messageCount: conversationData.messages?.length || 0
            });
          }
        } catch (error) {
          console.error(`Error reading conversation file ${file}:`, error);
        }
      }
      
      // Sort by updatedAt descending
      conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      return {
        success: true,
        conversations: conversations.slice(0, limit)
      };
    } catch (error) {
      console.error('Error getting user conversations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteConversation(conversationId, userId) {
    try {
      // Verify the conversation belongs to the user
      const result = await this.getConversation(conversationId);
      if (!result.success) {
        return result;
      }

      if (result.conversation.userId !== userId) {
        return {
          success: false,
          error: 'Unauthorized to delete this conversation'
        };
      }

      const filePath = this.getConversationFilePath(conversationId);
      await fs.unlink(filePath);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateConversationTitle(conversationId, userId, newTitle) {
    try {
      const result = await this.getConversation(conversationId);
      if (!result.success) {
        return result;
      }

      if (result.conversation.userId !== userId) {
        return {
          success: false,
          error: 'Unauthorized to update this conversation'
        };
      }

      result.conversation.title = newTitle;
      result.conversation.updatedAt = new Date().toISOString();
      
      await this.saveConversation(result.conversation);
      
      return {
        success: true,
        conversation: result.conversation.toJSON()
      };
    } catch (error) {
      console.error('Error updating conversation title:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ConversationService();