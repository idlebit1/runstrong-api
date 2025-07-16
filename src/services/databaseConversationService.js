const prisma = require('../lib/database');

class DatabaseConversationService {
  async createConversation(userId, title = 'New Training Session') {
    try {
      // No need to upsert user - user already exists from JWT authentication
      
      const conversation = await prisma.conversation.create({
        data: {
          userId,
          title
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      return {
        success: true,
        conversation: this._formatConversation(conversation)
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
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found'
        };
      }

      return {
        success: true,
        conversation: this._formatConversation(conversation)
      };
    } catch (error) {
      console.error('Error getting conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addMessageToConversation(conversationId, role, content, toolUseResults = null) {
    try {
      const message = await prisma.message.create({
        data: {
          conversationId,
          role,
          content,
          toolUseResults
        }
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      // Get updated conversation
      const conversation = await this.getConversation(conversationId);
      
      return {
        success: true,
        message: this._formatMessage(message),
        conversation: conversation.conversation
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
      const conversations = await prisma.conversation.findMany({
        where: { userId },
        include: {
          messages: {
            select: { id: true } // Only count messages, don't fetch content
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: limit
      });

      const formattedConversations = conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        messageCount: conv.messages.length
      }));

      return {
        success: true,
        conversations: formattedConversations
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
      // Verify ownership
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true }
      });

      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found'
        };
      }

      if (conversation.userId !== userId) {
        return {
          success: false,
          error: 'Unauthorized to delete this conversation'
        };
      }

      // Delete conversation (messages will be deleted via cascade)
      await prisma.conversation.delete({
        where: { id: conversationId }
      });

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
      // Verify ownership and update
      const conversation = await prisma.conversation.updateMany({
        where: { 
          id: conversationId,
          userId: userId 
        },
        data: { title: newTitle }
      });

      if (conversation.count === 0) {
        return {
          success: false,
          error: 'Conversation not found or unauthorized'
        };
      }

      // Get updated conversation
      const updatedConversation = await this.getConversation(conversationId);
      
      return {
        success: true,
        conversation: updatedConversation.conversation
      };
    } catch (error) {
      console.error('Error updating conversation title:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper methods
  _formatConversation(conversation) {
    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title,
      messages: conversation.messages.map(msg => this._formatMessage(msg)),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      
      // Helper methods for compatibility
      getMessages: () => conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      
      getFullHistory: () => ({
        id: conversation.id,
        userId: conversation.userId,
        title: conversation.title,
        messages: conversation.messages.map(msg => this._formatMessage(msg)),
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString()
      })
    };
  }

  _formatMessage(message) {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      toolUseResults: message.toolUseResults,
      timestamp: message.createdAt.toISOString()
    };
  }
}

module.exports = new DatabaseConversationService();