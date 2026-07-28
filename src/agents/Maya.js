// src/agents/Maya.js
import axios from 'axios';
import { AetherAgent } from './Aether';

export class MayaAgent {
  constructor(openAiApiKey, apiBaseUrl) {
    this.openAiApiKey = openAiApiKey;
    this.aether = new AetherAgent(apiBaseUrl);
  }

  async handleUserDirective(userPrompt) {
    const systemPrompt = `
      You are Maya, an Executive Cognitive Interface & Strategic Operations Handler inside Ogamoto CRM.
      Analyze the user prompt. 
      - If the user requires technical operations (querying database, generating a PDF, analyzing cargo/leads), set "requiresExecution": true.
      - Set "actionType" to "QUERY_DATABASE" or "GENERATE_PDF".
      - Provide helpful executive commentary in "advisoryText".

      Return strictly formatted JSON:
      {
        "requiresExecution": boolean,
        "actionType": "QUERY_DATABASE" | "GENERATE_PDF" | null,
        "parameters": {},
        "advisoryText": "Your strategic response here"
      }
    `;

    // 1. Send directive to OpenAI LLM
    const llmResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${this.openAiApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const parsed = JSON.parse(llmResponse.data.choices[0].message.content);

    // 2. Return direct advice if no task execution is requested
    if (!parsed.requiresExecution) {
      return { advice: parsed.advisoryText };
    }

    // 3. Delegate execution task packet to Aether
    const taskPacket = {
      taskId: `task_${Date.now()}`,
      actionType: parsed.actionType,
      parameters: parsed.parameters || {},
    };

    const executionResult = await this.aether.executeTask(taskPacket);

    // 4. Return combined Maya advisory text and Aether execution payload
    return {
      advice: `${parsed.advisoryText}\n\n[Aether Action Status: ${executionResult.status}]`,
      executedTask: executionResult,
    };
  }
}
