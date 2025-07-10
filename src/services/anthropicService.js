const Anthropic = require('@anthropic-ai/sdk');

class AnthropicService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateCoachResponse(userMessage, context = {}) {
    try {
      const systemPrompt = `You are an AI running coach. You provide personalized advice, training plans, and motivation to help runners improve their performance and achieve their goals. You have access to the user's running data and can read/write small files to track their progress.

Key responsibilities:
- Provide personalized running advice and training plans
- Track user progress and adapt recommendations
- Motivate and encourage users
- Answer questions about running technique, nutrition, and recovery
- Help users set and achieve realistic goals

Context: ${JSON.stringify(context)}`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      });

      return {
        success: true,
        message: response.content[0].text,
        usage: response.usage
      };
    } catch (error) {
      console.error('Anthropic API error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate coach response'
      };
    }
  }

  async generateTrainingPlan(userProfile, goals) {
    try {
      const prompt = `Generate a personalized training plan for a runner with the following profile:
${JSON.stringify(userProfile)}

Goals: ${JSON.stringify(goals)}

Please provide a structured training plan with specific workouts, distances, and recommendations.`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        temperature: 0.5,
        system: 'You are an expert running coach creating personalized training plans.',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return {
        success: true,
        trainingPlan: response.content[0].text,
        usage: response.usage
      };
    } catch (error) {
      console.error('Training plan generation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate training plan'
      };
    }
  }
}

module.exports = new AnthropicService();