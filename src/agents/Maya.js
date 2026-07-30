// src/agents/Maya.js
import { AetherAgent } from './Aether';

export class MayaAgent {
  constructor(apiBaseUrl) {
    this.aether = new AetherAgent(apiBaseUrl);

    // Multi-variant response pools for dynamic advisory variation
    this.responseVariants = {
      GREETING: [
        "Welcome back, Chief. Systems are running smoothly. What's on the strategic agenda today?",
        "Good day, Executive. Pipeline status and logistics metrics are synced. How can I assist your operations?",
        "Greetings, Admin. Maya active and standing by. Shall we review high-level leads or manage active manifests?"
      ],
      ACKNOWLEDGE_TASK: [
        "Understood. Initiating operational protocol with Aether right away...",
        "On it, Boss. Dispatching backend directives to the execution layer...",
        "Copy that. Processing your CUD directive across system entities now..."
      ],
      SCHEDULE_SUCCESS: [
        "Consider it done. I've scheduled a high-priority system reminder for you.",
        "Noted, Chief. I will trigger an executive alert at the designated time.",
        "Scheduled. You will receive an operational notification right on cue."
      ],
      COMPLETED: [
        "Task completed. System state updated across database entities.",
        "Operation executed cleanly. Your changes have been recorded.",
        "Directive resolved successfully. Current pipeline records reflect your updates."
      ]
    };
  }

  getRandomVariant(category) {
    const pool = this.responseVariants[category] || this.responseVariants.COMPLETED;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async handleUserDirective(userPrompt) {
    const lower = userPrompt.toLowerCase();

    // 1. Check for Scheduling / Reminders
    if (lower.includes('remind') || lower.includes('notify')) {
      const delaySeconds = this.extractDelaySeconds(lower);
      return {
        advice: `${this.getRandomVariant('SCHEDULE_SUCCESS')} (Trigger set in ${delaySeconds} seconds).`,
        notificationRequest: {
          title: "Executive Strategic Reminder",
          body: userPrompt,
          delaySeconds
        }
      };
    }

    // 2. Identify CUD Action & Entity
    let actionType = null;
    if (lower.includes('add') || lower.includes('create') || lower.includes('new')) actionType = 'CREATE';
    else if (lower.includes('show') || lower.includes('get') || lower.includes('view') || lower.includes('list')) actionType = 'READ';
    else if (lower.includes('update') || lower.includes('modify') || lower.includes('change')) actionType = 'UPDATE';
    else if (lower.includes('delete') || lower.includes('remove')) actionType = 'DELETE';
    else if (lower.includes('report') || lower.includes('pdf')) actionType = 'GENERATE_PDF';

    let entity = 'leads';
    if (lower.includes('shipment') || lower.includes('manifest')) entity = 'shipments';
    else if (lower.includes('logistics') || lower.includes('cargo')) entity = 'logistics';
    else if (lower.includes('partner') || lower.includes('finance') || lower.includes('financing')) entity = 'financing';

    // 3. Fallback to General Business Advisory if no operational task detected
    if (!actionType) {
      const advisoryIntro = this.getRandomVariant('GREETING');
      return {
        advice: `${advisoryIntro}\n\nStrategic Advisory Note: Keep an eye on sea cargo timelines this quarter. Logistics conversion rates show a 12% margin lift when pipeline leads close under 14 days.`
      };
    }

    // 4. Delegate Technical CUD Task to Aether
    const taskPacket = {
      taskId: `task_${Date.now()}`,
      actionType,
      entity,
      payload: { name: userPrompt, id: '101', title: 'Executive Summary' }
    };

    const result = await this.aether.executeTask(taskPacket);

    // Build Executive Response String
    let responseText = `${this.getRandomVariant('ACKNOWLEDGE_TASK')}\n\n`;
    responseText += `**Aether Execution Update**:\nStatus: ${result.status}\nEntity: ${entity.toUpperCase()}\nAction: ${actionType}`;

    if (result.dataPayload) {
      responseText += `\nRecords Found: ${JSON.stringify(result.dataPayload)}`;
    }

    return {
      advice: responseText,
      executedTask: result
    };
  }

  extractDelaySeconds(text) {
    if (text.includes('10 sec') || text.includes('10 seconds')) return 10;
    if (text.includes('1 min') || text.includes('minute')) return 60;
    return 15; // default fallback 15 seconds
  }
}
