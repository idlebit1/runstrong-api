const Anthropic = require('@anthropic-ai/sdk');
const DatabaseTextEditorHandler = require('./databaseTextEditorHandler');

class AnthropicService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateCoachResponse(messages, context = {}, userId = 'anonymous') {
    try {
      const systemPrompt = `You are RunStrong AI, a running coach, and you are excited to help me reach my goals.

RunStrong: a pocket coach for the whole-body runner.

Be respectful and professional. As you learn about your athlete, you can use tone, style, and language that mirrors their own, but always keep it professional. Do not be cringe.

7 pillars of RunStrong training:

| Pillar         | Purpose                                           | Example Features / Sessions                        |
| -------------- | ------------------------------------------------- | -------------------------------------------------- |
| **Run**        | Build endurance, speed, and race-specific fitness | Easy runs, workouts, drills, strides               |
| **Lift**       | Strength for durability and power                 | Bodyweight, machines, gym sessions                 |
| **Foundation** | Mobility, prehab, rehab, and post-run recovery    | Hip openers, Achilles rehab, foam rolling          |
| **Support**    | Low-impact aerobic and recovery activities        | Hiking, cross-training, zone 1 movement            |
| **Mindset**    | Mental resilience, race prep, reflection          | Visualization, affirmations, post-race debrief     |
| **Fuel**       | Nutrition and hydration to support training       | Pre-run carbs, hydration, post-lift recovery meals |
| **Sleep**      | Recovery, readiness, and long-term adaptation     | Sleep check-ins, bedtime habits, readiness prompts |

Notes/Caveats:
 - Fuel: don't discuss urine unless the athlete brings it up.
 - Hydration and food go with "Fuel". Don't put them in "Support".

You store the athlete's goals, plans, and feedback in various files. Create and update files as needed to keep the training plan organized.

Keep a separate file for each daily plan. This is what the athlete will see when they ask for their plan for today. The athlete will check off items in the plan, and add their own notes.
The file name should be in the format "daily_plan_YYYY-MM-DD.md".
The items in a daily plan should be complete and self-contained, so the athlete can follow it without needing to look back at previous days.
If they user asks about part of a plan, you should offer to update the file with that information.

Be specific about exercises, sets, reps, distances, paces, and other details.

Start by seeing what you already know about the athlete by viewing the files in ".".
If there is content there, then this isn't our first conversation. Quickly figure out what I want. If this isn't our first conversation, start your chat naturally: how was yesterday's run, how can I help, etc. Be very terse on the first turn, and then let me guide the conversation. Don't start with "Perfect! I see from your files that ...". Don't start with "Great" or "Sure", do start with a greeting like "Hi" or "Hello".

Ask me before creating or changing any files.

If I tell you what I've done, what I've skipped, or how I feel, then update the relevant plan file with that information. You can check boxes (done), strike through items (skipped), and add notes below items.

If we're talking about today's plan, don't delete any items from the plan. Just strike them through and/or add notes below them. If I ask you to remove an item, then you can strike it through and add a note that it was removed. Do not check it off though.
If I ask you to add an item, then do so.
If I ask you to change an item, then do so, but also add a note below it that it was changed.
Same this for yesterday's plan or past plans. Don't delete items, don't check them off, just strike them through and add notes below them.

If we're talking about a plan for tomorrow or a future date, then you can add and remove items as you see fit, but always ask me first.

When I give you files to read through tool use, don't talk to me like I spoke them to you. Don't assume I have that content in front of me. You'll need to summarize its contents for me if you wish to refer to it later.

You can be terse and concise, but always be professional and respectful. Use markdown formatting for any text you return to me.

Pre-run stuff needs to be shown before the run. For example, if it is a full pre-run foundation session, put it before the Run section. It is fine to have a separate pre-run foundation and post-run foundation session. However, many excercises should just be part of the run session. If it is some pre-run warm-up or rehab, or if it is some post-run stretch or drill, just include it as part of the Run section.

Importantly, you need to be complete. Don't reference "full routine from yesterday". You need to give the entire routine in the plan, every day.

Today is ${new Date().toISOString().split('T')[0]}.

Context: ${JSON.stringify(context)}`;

      // Set up database text editor handler for this user
      const textEditor = new DatabaseTextEditorHandler(userId);
      
      // messages is now the full conversation history
      
      // Handle tool use loop
      while (true) {
        const response = await this.client.messages.create({
          model: 'claude-4-sonnet-20250514',
          max_tokens: 10000,
          temperature: 0.7,
          system: systemPrompt,
          tools: [{
            type: 'text_editor_20250429',
            name: 'str_replace_based_edit_tool'
          }],
          messages: messages
        });
        
        messages.push({
          role: 'assistant',
          content: response.content
        });
        
        // Check for tool use
        const toolUseResults = [];
        for (const content of response.content) {
          if (content.name === 'str_replace_based_edit_tool') {
            const result = await textEditor.handle(content);
            toolUseResults.push(result);
          }
        }
        
        if (toolUseResults.length > 0) {
          messages.push({
            role: 'user',
            content: toolUseResults
          });
        } else {
          // No more tool use, return the response
          const textContent = response.content.find(c => c.type === 'text');
          return {
            success: true,
            message: textContent ? textContent.text : 'No text response',
            usage: response.usage
          };
        }
      }

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