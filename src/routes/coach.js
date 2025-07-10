const express = require('express');
const anthropicService = require('../services/anthropicService');
const virtualFileSystem = require('../services/virtualFileSystem');

const router = express.Router();

// Chat with the AI coach
router.post('/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const userIdToUse = userId || req.user.id || 'anonymous';
    
    // Get user context from files
    const userProfile = await virtualFileSystem.readFile(userIdToUse, 'profile.json');
    const recentWorkouts = await virtualFileSystem.readFile(userIdToUse, 'recent_workouts.json');
    
    const context = {
      userProfile: userProfile.success ? userProfile.content : null,
      recentWorkouts: recentWorkouts.success ? recentWorkouts.content : null
    };
    
    const response = await anthropicService.generateCoachResponse(message, context);
    
    if (!response.success) {
      return res.status(500).json({ error: response.error });
    }
    
    res.json({
      response: response.message,
      usage: response.usage
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate a training plan
router.post('/training-plan', async (req, res) => {
  try {
    const { userProfile, goals, userId } = req.body;
    
    if (!userProfile || !goals) {
      return res.status(400).json({ error: 'User profile and goals are required' });
    }
    
    const userIdToUse = userId || req.user.id || 'anonymous';
    
    const response = await anthropicService.generateTrainingPlan(userProfile, goals);
    
    if (!response.success) {
      return res.status(500).json({ error: response.error });
    }
    
    // Save the training plan to the user's virtual filesystem
    await virtualFileSystem.writeFile(userIdToUse, 'training_plan.json', {
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
    const { content, userId } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const userIdToUse = userId || req.user.id || 'anonymous';
    const result = await virtualFileSystem.writeFile(userIdToUse, fileName, content);
    
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
    const { fileName } = req.params;
    const userId = req.query.userId || req.user.id || 'anonymous';
    
    const result = await virtualFileSystem.readFile(userId, fileName);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ content: result.content });
  } catch (error) {
    console.error('File read endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/files', async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id || 'anonymous';
    const result = await virtualFileSystem.listFiles(userId);
    
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
    const userId = req.query.userId || req.user.id || 'anonymous';
    
    const result = await virtualFileSystem.deleteFile(userId, fileName);
    
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