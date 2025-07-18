const express = require('express');
const anthropicService = require('../services/anthropicService');
const databaseConversationService = require('../services/databaseConversationService');
const databaseFileService = require('../services/databaseFileService');

const router = express.Router();

// Chat with the AI coach (legacy endpoint - creates new conversation each time)
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const userIdToUse = req.user.userId;
    
    // Create a new conversation for this single exchange
    const newConv = await databaseConversationService.createConversation(userIdToUse);
    if (!newConv.success) {
      return res.status(500).json({ error: 'Failed to create conversation' });
    }
    
    // Add user message
    await databaseConversationService.addMessageToConversation(newConv.conversation.id, 'user', message);
    
    // Get conversation with messages
    const conv = await databaseConversationService.getConversation(newConv.conversation.id);
    const messages = conv.conversation.getMessages();
    
    // Get user context from files
    const userProfile = await databaseFileService.readFile(userIdToUse, 'profile.json');
    const recentWorkouts = await databaseFileService.readFile(userIdToUse, 'recent_workouts.json');
    
    const context = {
      userProfile: userProfile.success ? userProfile.content : null,
      recentWorkouts: recentWorkouts.success ? recentWorkouts.content : null
    };
    
    const response = await anthropicService.generateCoachResponse(messages, context, userIdToUse);
    
    if (!response.success) {
      return res.status(500).json({ error: response.error });
    }
    
    // Save assistant response
    await databaseConversationService.addMessageToConversation(newConv.conversation.id, 'assistant', response.message);
    
    res.json({
      response: response.message,
      usage: response.usage,
      conversationId: newConv.conversation.id
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chat within a specific conversation
router.post('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const userIdToUse = req.user.userId;
    
    // Get existing conversation
    const conv = await databaseConversationService.getConversation(conversationId);
    if (!conv.success) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Verify user owns this conversation
    if (conv.conversation.userId !== userIdToUse) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Add user message
    await databaseConversationService.addMessageToConversation(conversationId, 'user', message);
    
    // Get updated conversation with all messages
    const updatedConv = await databaseConversationService.getConversation(conversationId);
    const messages = updatedConv.conversation.getMessages();
    
    // Get user context from files
    const userProfile = await databaseFileService.readFile(userIdToUse, 'profile.json');
    const recentWorkouts = await databaseFileService.readFile(userIdToUse, 'recent_workouts.json');
    
    const context = {
      userProfile: userProfile.success ? userProfile.content : null,
      recentWorkouts: recentWorkouts.success ? recentWorkouts.content : null
    };
    
    const response = await anthropicService.generateCoachResponse(messages, context, userIdToUse);
    
    if (!response.success) {
      return res.status(500).json({ error: response.error });
    }
    
    // Save assistant response
    await databaseConversationService.addMessageToConversation(conversationId, 'assistant', response.message);
    
    res.json({
      response: response.message,
      usage: response.usage,
      conversationId
    });
  } catch (error) {
    console.error('Conversation chat endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new conversation
router.post('/conversations', async (req, res) => {
  try {
    const { title } = req.body;
    const userIdToUse = req.user.userId;
    
    const result = await databaseConversationService.createConversation(userIdToUse, title);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json(result.conversation);
  } catch (error) {
    console.error('Create conversation endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's conversations
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await databaseConversationService.getUserConversations(userId, limit);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ conversations: result.conversations });
  } catch (error) {
    console.error('Get conversations endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific conversation with full history
router.get('/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    
    const result = await databaseConversationService.getConversation(conversationId);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    // Verify user owns this conversation
    if (result.conversation.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    res.json(result.conversation.getFullHistory());
  } catch (error) {
    console.error('Get conversation endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a conversation
router.delete('/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    
    const result = await databaseConversationService.deleteConversation(conversationId, userId);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update conversation title
router.put('/conversations/:conversationId/title', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title } = req.body;
    const userIdToUse = req.user.userId;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const result = await databaseConversationService.updateConversationTitle(conversationId, userIdToUse, title);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json(result.conversation);
  } catch (error) {
    console.error('Update conversation title endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate a training plan
router.post('/training-plan', async (req, res) => {
  try {
    const { userProfile, goals } = req.body;
    
    if (!userProfile || !goals) {
      return res.status(400).json({ error: 'User profile and goals are required' });
    }
    
    const userIdToUse = req.user.userId;
    
    const response = await anthropicService.generateTrainingPlan(userProfile, goals);
    
    if (!response.success) {
      return res.status(500).json({ error: response.error });
    }
    
    // Save the training plan to the user's database files
    await databaseFileService.writeFile(userIdToUse, 'training_plan.json', {
      plan: response.trainingPlan,
      userProfile,
      goals,
      createdAt: new Date().toISOString()
    });
    
    res.json({
      trainingPlan: response.trainingPlan,
      usage: response.usage
    });
  } catch (error) {
    console.error('Training plan endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// File operations endpoints
router.post('/files/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const userIdToUse = req.user.userId;
    const result = await databaseFileService.writeFile(userIdToUse, fileName, content);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    console.error('File write endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/files/:fileName', async (req, res) => {
  try {
    const { fileName: rawFileName } = req.params;
    const fileName = rawFileName.trim(); // Remove leading/trailing whitespace
    const userId = req.user.userId;
    
    const result = await databaseFileService.readFile(userId, fileName);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ content: result.content });
  } catch (error) {
    console.error('File read endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/files/:fileName', async (req, res) => {
  try {
    const { fileName: rawFileName } = req.params;
    const fileName = rawFileName.trim(); // Remove leading/trailing whitespace
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const userIdToUse = req.user.userId;
    const result = await databaseFileService.writeFile(userIdToUse, fileName, content);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'File updated successfully' });
  } catch (error) {
    console.error('File update endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Changelog functionality removed

router.get('/files', async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await databaseFileService.listFiles(userId);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ files: result.files });
  } catch (error) {
    console.error('File list endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/files/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const userId = req.user.userId;
    
    const result = await databaseFileService.deleteFile(userId, fileName);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('File delete endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;