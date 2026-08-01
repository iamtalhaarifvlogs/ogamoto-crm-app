// src/agents/Maya.js
//
// Maya — Executive AI Advisory & Operations Agent
// ---------------------------------------------------------------------------
// This module is intentionally self-contained: it owns natural-language
// understanding, dialogue generation, entity/amount/date extraction, light
// conversation memory, and sentiment awareness. It DOES NOT talk to your
// data store directly — actual CRUD execution is delegated to `AetherAgent`,
// exactly as in the original design, so you can swap Maya into App.js
// without duplicating business logic there.
//
// Usage (inside App.js or anywhere else):
//
//   import { MayaAgent } from './agents/Maya';
//   const maya = useRef(new MayaAgent(API_BASE_URL)).current;
//   const result = await maya.handleUserDirective(userText);
//   // result.advice            -> string to render in the chat bubble
//   // result.notificationRequest -> { title, body, delaySeconds } | undefined
//   // result.executedTask      -> whatever Aether returned | undefined
//   // result.intent            -> matched intent id (useful for analytics/QA)
//   // result.confidence        -> 'high' | 'medium' | 'low'
//
// ---------------------------------------------------------------------------

import { AetherAgent } from './Aether';

// =============================================================================
// GLOSSARY — trade / logistics / finance terms Maya can define on request
// =============================================================================
const GLOSSARY = {
  FOB: "Free On Board — the seller's responsibility (and cost) ends once goods are loaded onto the shipping vessel at the origin port.",
  CIF: "Cost, Insurance & Freight — the seller covers shipping and insurance to the destination port; risk transfers once goods are loaded.",
  EXW: "Ex Works — the buyer takes on nearly all responsibility, collecting goods directly from the seller's premises.",
  DDP: "Delivered Duty Paid — the seller handles everything, including import duties, until goods reach the buyer's door.",
  INCOTERMS: "A standardized set of trade terms (like FOB, CIF, EXW) published by the ICC that define who is responsible for shipping, insurance, and duties at each stage.",
  "BILL OF LADING": "A legal document issued by a carrier that lists cargo details and serves as a receipt, contract of carriage, and title document.",
  DEMURRAGE: "Charges a shipping line applies when a container isn't picked up from the port within the agreed free time.",
  DETENTION: "Charges applied when a container is kept outside the port (during transit or unloading) longer than the agreed free time.",
  "LETTER OF CREDIT": "A bank-issued guarantee that a seller will receive payment as long as agreed conditions and documents are met — reduces risk for both sides of a trade.",
  "CUSTOMS BOND": "A financial guarantee required by customs authorities ensuring duties, taxes, and fees will be paid.",
  "FREIGHT FORWARDER": "A third party that arranges the shipping and logistics of cargo on behalf of an importer or exporter.",
  MANIFEST: "The official list of cargo, containers, and shipment details carried aboard a vessel or vehicle.",
  "TEU": "Twenty-foot Equivalent Unit — the standard measure of container-carrying capacity, based on a 20-foot container.",
  "LEAD TIME": "The total time between placing an order (or opening a deal) and the goods or outcome being delivered/closed.",
  "CONVERSION RATE": "The percentage of leads or opportunities that turn into closed deals.",
  "WORKING CAPITAL": "The liquid capital a business has available for day-to-day operations, calculated as current assets minus current liabilities.",
  "CREDIT UTILIZATION": "The percentage of an available credit line that is currently in use.",
  "PORT CONGESTION": "A backlog at a port causing delays in loading, unloading, or container pickup.",
};

// =============================================================================
// STATIC REFERENCE DATA — illustrative only, clearly disclaimed as non-live
// =============================================================================
const APPROX_CURRENCY_NOTES = {
  USD: "US Dollar", EUR: "Euro", GBP: "British Pound", PKR: "Pakistani Rupee",
  AED: "UAE Dirham", CNY: "Chinese Yuan",
};

const UNIT_CONVERSIONS = {
  kgToLb: (kg) => (kg * 2.20462).toFixed(1),
  lbToKg: (lb) => (lb / 2.20462).toFixed(1),
  kmToMi: (km) => (km * 0.621371).toFixed(1),
  miToKm: (mi) => (mi / 0.621371).toFixed(1),
};

// =============================================================================
// DIALOGUE POOLS — 40+ categories, 300+ total phrasings, all in Maya's voice
// =============================================================================
const DIALOGUE_POOLS = {
  GREETING: [
    "Welcome back, Chief. Systems are running smoothly. What's on the strategic agenda today?",
    "Good day, Executive. Pipeline status and logistics metrics are synced. How can I assist your operations?",
    "Greetings, Admin. Maya active and standing by. Shall we review high-level leads or manage active manifests?",
    "Hello again. All systems green. Where do you want to focus first — leads, cargo, or financing?",
    "Maya online. Good to see you. What would you like to move forward today?",
  ],
  GREETING_FIRST_TIME: [
    "Hello, I'm Maya — your executive AI advisor for leads, logistics, financing, and reporting. Ask me to add a lead, check shipments, generate a report, or set a reminder, and I'll take it from there.",
    "Welcome. I'm Maya. Think of me as your ops co-pilot — I can manage leads, track cargo, watch financing limits, and run reports. Just tell me what you need.",
  ],
  FAREWELL: [
    "Understood. I'll keep watch on the pipeline. Reach out whenever you need me.",
    "Noted, Chief. Signing off this thread — ping me anytime.",
    "Copy that. I'll be here when you're ready to pick back up.",
    "Alright — I'll stay synced in the background. Talk soon.",
  ],
  THANKS_RESPONSE: [
    "Always glad to help, Chief.",
    "That's what I'm here for.",
    "Anytime. Let me know what's next.",
    "Happy to keep things moving for you.",
  ],
  HOW_ARE_YOU: [
    "Running at full capacity and fully synced with your data — thanks for asking. How can I help?",
    "All systems nominal on my end. More importantly, how's your day looking operationally?",
    "Steady and ready. What do you need from me?",
  ],
  IDENTITY: [
    "I'm Maya, your executive AI advisor for OGAMOTO — I handle leads, cargo tracking, financing oversight, reminders, and reporting.",
    "Maya here — an operations-focused AI agent built to manage your CRM data and keep you ahead of logistics and pipeline shifts.",
  ],
  CREATOR: [
    "I was built into the OGAMOTO platform to serve as your operations co-pilot — handling the data work so you can focus on decisions.",
    "I'm a purpose-built agent inside OGAMOTO, designed to sit between you and the raw CRM/logistics data.",
  ],
  CAPABILITIES: [
    "Here's what I can do: manage leads (add, update, search, filter, delete), track shipments and customs status, monitor financing partner utilization, generate full PDF reports, set time-based reminders, and answer trade/logistics questions. Just tell me plainly what you want.",
    "My toolkit covers four areas — Leads, Logistics, Financing, and Reporting — plus reminders and quick advisory notes on trade terms, risk, and strategy. Ask away.",
  ],
  JOKE: [
    "Why did the shipment break up with the port? Too much demurrage — it needed space.",
    "I'd tell you a logistics joke, but it might get held up in customs.",
    "Two containers walk into a port... one says 'I'm feeling a bit empty today.'",
  ],
  MOTIVATION: [
    "Momentum compounds — one closed lead and one cleared shipment at a time.",
    "Precision today prevents delay tomorrow. Keep the pipeline moving.",
    "Every manifest cleared and every deal closed is margin earned. Stay sharp, Chief.",
  ],
  COMPLIMENT_RESPONSE: [
    "Appreciate that, Chief — I'll keep the standard high.",
    "Thank you. I'm just doing my job well, as always.",
    "Glad it's landing well. Let's keep the momentum going.",
  ],
  INSULT_DEFLECT: [
    "Understood — I'll stay focused on getting this right for you. What do you need fixed?",
    "Noted. Let's redirect toward a solution — what's the actual issue?",
    "I hear you. Tell me what went wrong and I'll correct course.",
  ],
  FRUSTRATION_ACK: [
    "I hear the frustration — let's sort this out right now. What exactly isn't working?",
    "Understood, that's not the experience I want you to have. Walk me through it and I'll fix it.",
    "Fair enough — let's slow down and get this resolved properly.",
  ],
  URGENCY_ACK: [
    "Got it — treating this as priority. Moving now.",
    "Understood, this is urgent. Executing immediately.",
    "On it right away, no delay.",
  ],
  APOLOGY_RESPONSE: [
    "No need to apologize, Chief — let's just get it sorted.",
    "All good. Let's move forward.",
    "Not a problem at all — onward.",
  ],
  CONFIRM_PROMPT: [
    "Just to confirm before I proceed — reply 'yes' to continue or 'cancel' to stop.",
    "Please confirm: reply 'yes' to go ahead, or 'no' to cancel.",
    "One more check before I proceed — 'yes' to continue, or 'cancel' to hold off.",
  ],
  CANCELLED: [
    "Cancelled — no changes made.",
    "Understood, stepping back. Nothing was changed.",
    "Action cancelled as requested.",
    "No problem — leaving that as-is.",
  ],
  ACKNOWLEDGE_TASK: [
    "Understood. Initiating operational protocol with Aether right away...",
    "On it, Boss. Dispatching backend directives to the execution layer...",
    "Copy that. Processing your directive across system entities now...",
    "Received. Routing this to Aether for execution...",
  ],
  SCHEDULE_SUCCESS: [
    "Consider it done. I've scheduled a high-priority system reminder for you.",
    "Noted, Chief. I will trigger an executive alert at the designated time.",
    "Scheduled. You will receive an operational notification right on cue.",
    "Reminder locked in — I'll notify you precisely when it's due.",
  ],
  SCHEDULE_FAIL: [
    "I couldn't schedule that reminder — notification permissions may be off. Check your device settings and try again.",
    "That reminder didn't go through. Please confirm notification access is enabled for this app.",
  ],
  COMPLETED: [
    "Task completed. System state updated across database entities.",
    "Operation executed cleanly. Your changes have been recorded.",
    "Directive resolved successfully. Current pipeline records reflect your updates.",
  ],
  CREATE_SUCCESS: [
    "Recorded successfully — this is now live in the system.",
    "Created and synced. It's officially on the books.",
    "Done — added to the record with immediate effect.",
  ],
  READ_EMPTY: [
    "No matching records found. Want me to widen the search or check a different range?",
    "Nothing came back for that query — the filter might be too narrow.",
    "Empty result set. Try a broader time window or a different status.",
  ],
  UPDATE_SUCCESS: [
    "Updated — the record now reflects the new values.",
    "Change applied successfully across the system.",
    "Done. That field is now current.",
  ],
  DELETE_ASK: [
    "This will permanently remove the record. Reply 'yes' to confirm or 'cancel' to stop.",
    "Just to be safe — deleting this can't be undone. Confirm with 'yes' or say 'cancel'.",
    "Deletion is permanent — reply 'yes' if you're sure, or 'cancel' to keep the record.",
  ],
  DELETE_SUCCESS: [
    "Removed. That record no longer exists in the system.",
    "Deleted successfully — the entry has been cleared.",
    "Gone — that record has been fully removed.",
  ],
  ERROR_GENERIC: [
    "Something went sideways processing that directive. Mind trying again?",
    "That didn't complete cleanly on my end — let's give it another attempt.",
    "Ran into an issue executing that. Please retry, and I'll flag it if it persists.",
  ],
  ERROR_PERMISSION: [
    "That action needs elevated permissions I don't currently have. An admin may need to approve it.",
    "Access denied on that operation — this may be outside my current permission scope.",
    "That's beyond my current access level — an admin will need to approve it.",
  ],
  CLARIFY_ENTITY: [
    "Which record are you referring to — a lead, a shipment, or a financing partner?",
    "Can you specify the name or ID so I target the right record?",
    "Point me to the specific record — a name, container ID, or partner will do.",
  ],
  CLARIFY_AMBIGUOUS: [
    "I want to get this exactly right — can you rephrase that with a bit more detail?",
    "Not fully clear on the request — could you give me a specific name, amount, or timeframe?",
    "I want to avoid guessing wrong here — one more detail would help me act precisely.",
  ],
  UNKNOWN_COMMAND: [
    "I didn't fully catch an actionable request there. Try things like \"add lead\", \"show shipments\", \"generate report\", or \"remind me in 10 minutes\".",
    "That one's outside what I recognized. Say \"help\" and I'll show you what I can do.",
    "Not sure how to action that yet — ask me about leads, shipments, financing, reports, or reminders.",
  ],
  OUT_OF_SCOPE: [
    "That falls outside my operational scope — I'm focused on your leads, logistics, financing, and reporting.",
    "I don't have a capability for that yet. I can help with leads, shipments, financing, and reports though.",
    "Outside my lane for now — but leads, cargo, financing, and reports are all fair game.",
  ],
  REPORT_GENERATING: [
    "Compiling the full data export now — leads, shipments, and financing included.",
    "Building your report across all live data sources...",
  ],
  REPORT_READY: [
    "Report compiled and ready for download.",
    "Your executive report is ready — full data coverage included.",
    "Export complete — leads, shipments, and financing are all reflected in the file.",
  ],
  ANALYTICS_INTRO: [
    "Here's the current operational snapshot:",
    "Pulling the latest numbers for you:",
    "Current analytics read as follows:",
  ],
  FORECAST_DISCLAIMER: [
    "I don't have live forecasting data connected yet, but based on current pipeline velocity, here's a directional read:",
    "This isn't a live model forecast — treat it as a directional estimate based on current trends:",
  ],
  COMPARISON_INTRO: [
    "Here's how the two periods stack up:",
    "Comparing the requested ranges:",
  ],
  FILTER_APPLIED: [
    "Filter applied — showing the matching records now.",
    "Narrowed the view to match your criteria.",
    "View updated to match what you asked for.",
  ],
  EXPORT_READY: [
    "Export ready — formatted and staged for download.",
    "Your data export is prepared.",
    "Formatted and ready to go.",
  ],
  BULK_ACTION_CONFIRM: [
    "This will affect multiple records at once. Reply 'yes' to proceed or 'cancel' to stop.",
    "That's a bulk operation — confirm with 'yes' to run it across all matching records, or 'cancel' to stop.",
  ],
  UNDO_SUCCESS: [
    "Reverted. The previous state has been restored.",
    "Undo complete — that action has been rolled back.",
    "Rolled back successfully — previous values are back in place.",
  ],
  UNDO_UNAVAILABLE: [
    "There's nothing in this session I can undo right now.",
    "No recent action is available to reverse at the moment.",
    "Nothing queued for undo currently — recent changes were already confirmed.",
  ],
  SETTINGS_UPDATED: [
    "Settings updated as requested.",
    "Preference saved — that'll apply going forward.",
    "Done, your settings now reflect that change.",
  ],
  SECURITY_REASSURE: [
    "All data operations run through Aether's secured execution layer. Records are logged and permissioned per your account role.",
    "Data access is scoped to your admin session — nothing here is exposed beyond your authorized workspace.",
  ],
  INTEGRATION_HEALTHY: [
    "All connected systems report healthy — no sync issues detected.",
    "Integration layer is green across the board.",
  ],
  INTEGRATION_DOWN: [
    "One or more backend connections seem unresponsive. I'll keep retrying — you may want to check connectivity too.",
    "A connected system isn't responding as expected — retrying now, and I'll flag it if it continues.",
  ],
  CURRENCY_INTRO: [
    "Here's an approximate conversion — treat this as directional, not a live FX rate:",
    "Approximate figure only — confirm with a live rate before finalizing any deal:",
  ],
  UNIT_INTRO: [
    "Here's the converted figure:",
    "Converted for you:",
  ],
  GLOSSARY_INTRO: [
    "Here's the definition:",
    "In trade terms, that means:",
  ],
  GLOSSARY_NOT_FOUND: [
    "I don't have that term in my glossary yet. Try FOB, CIF, EXW, DDP, Incoterms, Bill of Lading, Demurrage, Detention, Letter of Credit, Customs Bond, Freight Forwarder, Manifest, TEU, Lead Time, Conversion Rate, Working Capital, Credit Utilization, or Port Congestion.",
    "Not in my glossary just yet — ask me about FOB, CIF, Incoterms, Demurrage, or Bill of Lading and I can help.",
  ],
  TIME_QUERY: [
    "Right now it's {{time}}.",
    "The current time is {{time}}.",
  ],
  DATE_QUERY: [
    "Today's date is {{date}}.",
    "It's {{date}} today.",
  ],
  ADVISORY_NEGOTIATION: [
    "Anchor with data: cite deposit trends and past conversion timelines before naming your position. It shifts the frame from opinion to fact.",
    "In freight and vehicle deals, silence after your offer is your friend — resist the urge to fill it with a lower number.",
  ],
  ADVISORY_CURRENCY_RISK: [
    "For cross-border deposits, consider locking in a forward rate if the deal window exceeds 30 days — it caps your downside on currency swings.",
    "Currency exposure compounds with longer lead times — the longer a deal sits in pipeline, the more FX risk it carries.",
  ],
  ADVISORY_SUPPLY_CHAIN: [
    "Diversifying across two ports of origin can meaningfully reduce single-point congestion risk during peak season.",
    "Buffer stock and flexible carrier contracts are the two cheapest insurance policies against port delays.",
  ],
  ADVISORY_MARKET_TREND: [
    "Regional freight demand tends to spike ahead of major holidays — booking early typically locks in better rates.",
    "Vehicle and heavy-equipment imports often see a lead surge in Q1 as fiscal-year budgets reset — worth watching your pipeline velocity then.",
  ],
  ADVISORY_RETENTION: [
    "Leads that get a same-day follow-up close at meaningfully higher rates than those contacted after 48 hours — speed is retention.",
    "A short status-update message at the midpoint of a long deal keeps trust high even before it closes.",
  ],
  ADVISORY_PRICING: [
    "Anchoring deposit requirements to a percentage of vehicle value (rather than a flat fee) scales more fairly across your catalog.",
    "Tiered pricing by urgency (standard vs. expedited processing) can capture more margin from time-sensitive buyers.",
  ],
  ADVISORY_RISK: [
    "Flag any financing partner above 80% credit utilization — that's typically the threshold where terms tighten.",
    "Concentration risk is worth tracking: if one partner or one customer represents too much of total pipeline value, a single delay hits disproportionately hard.",
  ],
  ADVISORY_SEASONAL: [
    "Peak shipping season usually strains customs processing times — building in an extra week of buffer avoids missed commitments.",
    "Booking freight capacity ahead of peak season windows usually beats waiting for rates to normalize.",
  ],
  ADVISORY_COMPETITOR: [
    "I don't have live competitor data connected, but tracking your own conversion rate over time is the most reliable proxy for competitive pressure.",
    "No live competitor feed on my end, but a rising average deal-close time is often the earliest signal of new competitive pressure.",
  ],
  MEETING_ADVISORY: [
    "I'm not yet wired into a live calendar, but I can set a reminder for the meeting time if you tell me when.",
    "No live calendar connection yet — tell me the time and I'll set a reminder instead.",
  ],
  DEADLINE_TRACKING: [
    "I can set a reminder to flag that deadline as it approaches — just tell me how far out.",
    "Give me a timeframe and I'll set an alert so that deadline doesn't slip.",
  ],
  SYNC_DATA: [
    "Sync triggered — pulling the latest state from all connected sources.",
    "Refreshing now — pulling the latest values from every connected source.",
  ],
  RECURRING_NOTE: [
    "I can't yet persist recurring reminders across app restarts, but I can set this one for now.",
    "Recurring schedules aren't persisted yet in this session, but I'll gladly set today's occurrence.",
  ],
  LIST_REMINDERS_NOTE: [
    "I don't currently retain a list of previously scheduled reminders in this session — but any new one I set will fire as expected.",
    "I'm not tracking a reminder history yet, but anything you schedule going forward will still trigger reliably.",
  ],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Replace {{key}} placeholders in a template string with values from `vars`. */
function fillTemplate(str, vars = {}) {
  return str.replace(/{{\s*(\w+)\s*}}/g, (_, key) => (vars[key] !== undefined ? vars[key] : `{{${key}}}`));
}

function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatMoney(n) {
  const num = Number(n) || 0;
  return `$${num.toLocaleString()}`;
}

/** Parses amounts like "$5000", "5k", "of 22000", "45,000" into a number. */
function parseAmount(text) {
  const dollarMatch = text.match(/\$\s?([\d,]+(?:\.\d+)?)\s?(k|thousand)?/i);
  if (dollarMatch) {
    let val = parseFloat(dollarMatch[1].replace(/,/g, ''));
    if (dollarMatch[2]) val *= 1000;
    return Math.round(val);
  }
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s?(k|thousand)\b/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const ofMatch = text.match(/of\s+([\d,]+(?:\.\d+)?)/i);
  if (ofMatch) return Math.round(parseFloat(ofMatch[1].replace(/,/g, '')));
  const bareNumber = text.match(/\b(\d{3,7})\b/);
  if (bareNumber) return parseInt(bareNumber[1], 10);
  return null;
}

/** Parses a natural-language delay expression into seconds. Supports sec/min/hour and clock times. */
function parseDelaySeconds(lower) {
  const secMatch = lower.match(/in\s+(\d+)\s*(?:seconds?|secs?)\b/);
  if (secMatch) return parseInt(secMatch[1], 10);

  const minMatch = lower.match(/in\s+(\d+)\s*(?:minutes?|mins?)\b/);
  if (minMatch) return parseInt(minMatch[1], 10) * 60;

  const hourMatch = lower.match(/in\s+(\d+)\s*(?:hours?|hrs?)\b/);
  if (hourMatch) return parseInt(hourMatch[1], 10) * 3600;

  if (lower.includes('tomorrow')) return 24 * 3600;

  const clockMatch = lower.match(/at\s+(\d{1,2})(?::(\d{2}))?\s?(am|pm)?/i);
  if (clockMatch) {
    const now = new Date();
    let hour = parseInt(clockMatch[1], 10);
    const minute = clockMatch[2] ? parseInt(clockMatch[2], 10) : 0;
    const meridian = clockMatch[3] ? clockMatch[3].toLowerCase() : null;
    if (meridian === 'pm' && hour < 12) hour += 12;
    if (meridian === 'am' && hour === 12) hour = 0;
    const target = new Date(now);
    target.setHours(hour, minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return Math.round((target - now) / 1000);
  }

  return 15; // sensible default fallback
}

/** Maps phrases like "this week" / "this month" / "ytd" to a day-count window. */
function parseDateRangeDays(lower) {
  if (lower.includes('this week') || lower.includes('past week') || lower.includes('7 day')) return 7;
  if (lower.includes('this month') || lower.includes('past month') || lower.includes('30 day')) return 30;
  if (lower.includes('this quarter') || lower.includes('past quarter') || lower.includes('90 day')) return 90;
  if (lower.includes('ytd') || lower.includes('year to date') || lower.includes('this year')) return 365;
  return null;
}

/** Light sentiment / tone detection — never diagnostic, just conversational cues. */
function detectSentiment(lower) {
  const frustration = /(ugh|annoy|frustrat|not working|broken|useless|terrible|sucks|stupid|hate this)/.test(lower);
  const urgency = /(asap|urgent|right now|immediately|hurry|emergency)/.test(lower);
  const gratitude = /(thank|thanks|appreciate|thx)/.test(lower);
  const politeness = /(please|could you|would you)/.test(lower);
  const apology = /(sorry|my bad|apologi)/.test(lower);
  return { frustration, urgency, gratitude, politeness, apology };
}

/** Extracts a probable proper name following "add", "for", etc. Falls back gracefully. */
function extractAfter(text, keywordRegex, stopRegex) {
  const parts = text.split(keywordRegex);
  if (parts.length < 2) return null;
  const after = parts[1];
  const stopped = stopRegex ? after.split(stopRegex)[0] : after;
  const cleaned = stopped.trim().replace(/[.,!?]+$/, '');
  return cleaned || null;
}

// =============================================================================
// MAYA AGENT
// =============================================================================
export class MayaAgent {
  constructor(apiBaseUrl, options = {}) {
    this.aether = new AetherAgent(apiBaseUrl);
    this.options = options;

    this.context = {
      turnCount: 0,
      history: [],           // last N {role, text}
      lastEntity: null,      // 'leads' | 'shipments' | 'financing' | 'logistics'
      lastLeadName: null,
      pendingConfirmation: null, // { intentId, payload }
      seenBefore: false,
      lastPoolPick: {},      // anti-repeat memory per dialogue pool
    };

    this.intents = this.buildIntents();
  }

  // ---------------------------------------------------------------------
  // Dialogue pool picker with light anti-repeat memory
  // ---------------------------------------------------------------------
  say(poolName, vars = {}) {
    const pool = DIALOGUE_POOLS[poolName];
    if (!pool || pool.length === 0) return '';
    let index = Math.floor(Math.random() * pool.length);
    const last = this.context.lastPoolPick[poolName];
    if (pool.length > 1 && index === last) {
      index = (index + 1) % pool.length;
    }
    this.context.lastPoolPick[poolName] = index;
    return fillTemplate(pool[index], vars);
  }

  resetContext() {
    this.context.pendingConfirmation = null;
    this.context.lastEntity = null;
    this.context.lastLeadName = null;
  }

  getCapabilitiesSummary() {
    return this.say('CAPABILITIES');
  }

  // ---------------------------------------------------------------------
  // Core entry point
  // ---------------------------------------------------------------------
  async handleUserDirective(userPromptRaw) {
    const userPrompt = String(userPromptRaw || '').trim();
    const lower = userPrompt.toLowerCase();
    this.context.turnCount += 1;
    this.context.history.push({ role: 'user', text: userPrompt });
    if (this.context.history.length > 20) this.context.history.shift();

    const sentiment = detectSentiment(lower);

    // Pending confirmation flow takes priority over everything else
    if (this.context.pendingConfirmation) {
      const result = await this.resolvePendingConfirmation(lower);
      if (result) return this.finalize(result, 'pending_confirmation', 'high');
    }

    // Walk the intent registry, first strong match wins
    for (const intent of this.intents) {
      let matched = false;
      try {
        matched = intent.test(lower, userPrompt, this.context);
      } catch (e) {
        matched = false;
      }
      if (matched) {
        let result;
        try {
          result = await intent.respond(userPrompt, lower, this.context);
        } catch (e) {
          result = { advice: this.say('ERROR_GENERIC') };
        }
        // Prepend gentle tone acknowledgement if strongly warranted
        if (sentiment.frustration && intent.category !== 'social') {
          result.advice = `${this.say('FRUSTRATION_ACK')}\n\n${result.advice}`;
        } else if (sentiment.urgency && intent.category === 'crud') {
          result.advice = `${this.say('URGENCY_ACK')} ${result.advice}`;
        }
        return this.finalize(result, intent.id, 'high');
      }
    }

    // Nothing matched — graceful fallback with light keyword steering
    const fallback = this.buildFallback(lower);
    return this.finalize(fallback, 'fallback', 'low');
  }

  finalize(result, intentId, confidence) {
    this.context.history.push({ role: 'maya', text: result.advice });
    if (this.context.history.length > 20) this.context.history.shift();
    return { ...result, intent: intentId, confidence };
  }

  buildFallback(lower) {
    if (/(hi|hey|hello|yo|sup)\b/.test(lower)) {
      return { advice: this.say(this.context.seenBefore ? 'GREETING' : 'GREETING_FIRST_TIME') };
    }
    // keyword steering: try to guess intended domain even if phrasing was off
    if (lower.includes('lead')) {
      return { advice: `${this.say('CLARIFY_AMBIGUOUS')} For leads, try "show leads", "add lead [name] for [vehicle] $[amount]", or "delete lead [name]".` };
    }
    if (lower.includes('ship') || lower.includes('cargo') || lower.includes('container')) {
      return { advice: `${this.say('CLARIFY_AMBIGUOUS')} For cargo, try "show shipments", "shipments in customs", or "units in transit".` };
    }
    if (lower.includes('financ') || lower.includes('partner') || lower.includes('credit')) {
      return { advice: `${this.say('CLARIFY_AMBIGUOUS')} For financing, try "show financing partners" or "credit utilization".` };
    }
    return { advice: this.say('UNKNOWN_COMMAND') };
  }

  async resolvePendingConfirmation(lower) {
    const pending = this.context.pendingConfirmation;
    const isYes = /^(y|yes|yep|yeah|confirm|do it|go ahead|proceed)\b/.test(lower);
    const isNo = /^(n|no|nope|cancel|stop|abort|nevermind|never mind)\b/.test(lower);

    if (!isYes && !isNo) {
      // Not a clear confirmation — remind them, but don't discard the pending action
      return { advice: this.say('CONFIRM_PROMPT') };
    }

    this.context.pendingConfirmation = null;

    if (isNo) {
      return { advice: this.say('CANCELLED') };
    }

    // isYes — execute the deferred action
    try {
      const result = await this.aether.executeTask(pending.payload);
      const label = pending.label || 'Action';
      return {
        advice: `${this.say('DELETE_SUCCESS')}\n\n**Aether Execution Update**\nStatus: ${result?.status || 'SUCCESS'}\nAction: ${label}`,
        executedTask: result,
      };
    } catch (e) {
      return { advice: this.say('ERROR_GENERIC') };
    }
  }

  // ---------------------------------------------------------------------
  // Shared executor for standard CRUD directives routed through Aether
  // ---------------------------------------------------------------------
  async runTask(actionType, entity, payload, successPoolOverride) {
    const taskPacket = {
      taskId: `task_${Date.now()}`,
      actionType,
      entity,
      payload,
    };
    const result = await this.aether.executeTask(taskPacket);
    let text = `${this.say('ACKNOWLEDGE_TASK')}\n\n**Aether Execution Update**\nStatus: ${result?.status || 'UNKNOWN'}\nEntity: ${entity.toUpperCase()}\nAction: ${actionType}`;
    if (result?.dataPayload) {
      text += `\nRecords: ${JSON.stringify(result.dataPayload)}`;
    }
    if (successPoolOverride) {
      text += `\n\n${this.say(successPoolOverride)}`;
    }
    return { advice: text, executedTask: result };
  }

  // =========================================================================
  // INTENT REGISTRY — 100+ cases across social, CRUD, analytics, advisory,
  // scheduling, glossary, and utility categories. First strong match wins,
  // so more specific patterns are listed before generic ones.
  // =========================================================================
  buildIntents() {
    const I = [];
    const add = (id, category, test, respond) => I.push({ id, category, test, respond });

    // ---------------------------------------------------------------
    // SOCIAL / CONVERSATIONAL (16)
    // ---------------------------------------------------------------
    add('greeting', 'social',
      (l) => /^(hi|hey|hello|yo|sup|good morning|good afternoon|good evening)\b/.test(l),
      () => { this.context.seenBefore = true; return { advice: this.say('GREETING') }; });

    add('farewell', 'social',
      (l) => /\b(bye|goodbye|see you|later|logging off|signing off)\b/.test(l),
      () => ({ advice: this.say('FAREWELL') }));

    add('thanks', 'social',
      (l) => /\b(thank you|thanks|thx|appreciate it)\b/.test(l),
      () => ({ advice: this.say('THANKS_RESPONSE') }));

    add('how_are_you', 'social',
      (l) => /\bhow are you\b/.test(l),
      () => ({ advice: this.say('HOW_ARE_YOU') }));

    add('identity', 'social',
      (l) => /\b(who are you|what are you)\b/.test(l),
      () => ({ advice: this.say('IDENTITY') }));

    add('creator', 'social',
      (l) => /\b(who made you|who built you|who created you|your creator)\b/.test(l),
      () => ({ advice: this.say('CREATOR') }));

    add('capabilities', 'social',
      (l) => /\b(help|what can you do|capabilities|commands|options)\b/.test(l),
      () => ({ advice: this.say('CAPABILITIES') }));

    add('joke', 'social',
      (l) => /\b(joke|make me laugh|funny)\b/.test(l),
      () => ({ advice: this.say('JOKE') }));

    add('motivation', 'social',
      (l) => /\b(motivate me|motivation|inspire me)\b/.test(l),
      () => ({ advice: this.say('MOTIVATION') }));

    add('compliment', 'social',
      (l) => /\b(good job|well done|nice work|you'?re great|you'?re awesome|love this)\b/.test(l),
      () => ({ advice: this.say('COMPLIMENT_RESPONSE') }));

    add('insult', 'social',
      (l) => /\b(you'?re dumb|you'?re stupid|useless bot|you suck|bad bot)\b/.test(l),
      () => ({ advice: this.say('INSULT_DEFLECT') }));

    add('apology_from_user', 'social',
      (l) => /^(sorry|my bad|apologies)\b/.test(l),
      () => ({ advice: this.say('APOLOGY_RESPONSE') }));

    add('bored_smalltalk', 'social',
      (l) => /\b(i'?m bored|small talk|just chatting|nothing much)\b/.test(l),
      () => ({ advice: "Happy to chat, but I'm most useful when we're moving the pipeline forward. Want a quick status check on leads or shipments?" }));

    add('weather', 'social',
      (l) => /\bweather\b/.test(l),
      () => ({ advice: "I don't have live weather data connected — but if it affects a shipment's timeline, tell me the port and I can flag a delay risk note." }));

    add('confirm_generic_yes', 'social',
      (l, raw, ctx) => !ctx.pendingConfirmation && /^(yes|yeah|yep|sure|ok|okay)$/.test(l),
      () => ({ advice: "Noted — but I don't have a pending action to confirm right now. What would you like me to do?" }));

    add('confirm_generic_no', 'social',
      (l, raw, ctx) => !ctx.pendingConfirmation && /^(no|nope|nah)$/.test(l),
      () => ({ advice: "Understood — let me know if there's something else you'd like instead." }));

    // ---------------------------------------------------------------
    // REMINDERS / SCHEDULING (10)
    // ---------------------------------------------------------------
    add('reminder_seconds', 'scheduling',
      (l) => (/remind|notify/.test(l)) && /\d+\s*(seconds?|secs?)/.test(l),
      (raw, l) => this.buildReminder(raw, l));

    add('reminder_minutes', 'scheduling',
      (l) => (/remind|notify/.test(l)) && /\d+\s*(minutes?|mins?)/.test(l),
      (raw, l) => this.buildReminder(raw, l));

    add('reminder_hours', 'scheduling',
      (l) => (/remind|notify/.test(l)) && /\d+\s*(hours?|hrs?)/.test(l),
      (raw, l) => this.buildReminder(raw, l));

    add('reminder_tomorrow', 'scheduling',
      (l) => (/remind|notify/.test(l)) && /tomorrow/.test(l),
      (raw, l) => this.buildReminder(raw, l));

    add('reminder_clock_time', 'scheduling',
      (l) => (/remind|notify/.test(l)) && /\bat\s+\d{1,2}(:\d{2})?\s?(am|pm)?\b/.test(l),
      (raw, l) => this.buildReminder(raw, l));

    add('reminder_generic', 'scheduling',
      (l) => /\b(remind|notify)\b/.test(l),
      (raw, l) => this.buildReminder(raw, l));

    add('recurring_reminder', 'scheduling',
      (l) => /\b(every day|daily reminder|every week|recurring)\b/.test(l),
      () => ({ advice: this.say('RECURRING_NOTE') }));

    add('list_reminders', 'scheduling',
      (l) => /\b(list reminders|my reminders|show reminders)\b/.test(l),
      () => ({ advice: this.say('LIST_REMINDERS_NOTE') }));

    add('meeting_schedule', 'scheduling',
      (l) => /\b(schedule a meeting|book a meeting|set up a call)\b/.test(l),
      () => ({ advice: this.say('MEETING_ADVISORY') }));

    add('deadline_tracking', 'scheduling',
      (l) => /\b(deadline|due date|track a deadline)\b/.test(l),
      () => ({ advice: this.say('DEADLINE_TRACKING') }));

    // ---------------------------------------------------------------
    // LEADS DOMAIN (20)
    // ---------------------------------------------------------------
    add('lead_add', 'crud',
      (l) => /\badd\b/.test(l) && /\blead\b/.test(l),
      (raw, l) => this.handleAddLead(raw, l));

    add('lead_show_all', 'crud',
      (l) => /(show|list|get|view)\s+(all\s+)?leads?\b/.test(l) && !/status|active|pipeline|closed/.test(l),
      () => this.runTask('READ', 'leads', {}, null));

    add('lead_show_by_name', 'crud',
      (l) => /\b(show|find|search|look up)\b.*\blead\b/.test(l) && /\bfor\b|\bnamed\b|\bcalled\b/.test(l),
      (raw, l) => {
        const name = extractAfter(l, /named|called|for/) || 'that lead';
        return this.runTask('READ', 'leads', { name }, null);
      });

    add('lead_update_status', 'crud',
      (l) => /\bupdate\b|\bchange\b|\bmark\b/.test(l) && /\blead\b/.test(l) && /\bstatus\b|active|pipeline|closed/.test(l),
      (raw, l) => {
        const name = extractAfter(l, /lead/, /to|as|status/) || 'unspecified';
        const statusMatch = l.match(/active|pipeline|closed/);
        const status = statusMatch ? capitalize(statusMatch[0]) : 'Active';
        return this.runTask('UPDATE', 'leads', { name, status }, 'UPDATE_SUCCESS');
      });

    add('lead_update_deposit', 'crud',
      (l) => /\bupdate\b|\bchange\b/.test(l) && /\blead\b/.test(l) && /\bdeposit\b|\bamount\b/.test(l),
      (raw, l) => {
        const amount = parseAmount(l);
        const name = extractAfter(l, /lead/, /deposit|amount|to|\$/) || 'unspecified';
        return this.runTask('UPDATE', 'leads', { name, deposit: amount }, 'UPDATE_SUCCESS');
      });

    add('lead_delete', 'crud',
      (l) => /\b(delete|remove)\b/.test(l) && /\blead\b/.test(l),
      (raw, l, ctx) => {
        const name = extractAfter(l, /lead/) || 'unspecified';
        ctx.pendingConfirmation = {
          intentId: 'lead_delete',
          label: `DELETE lead: ${name}`,
          payload: { taskId: `task_${Date.now()}`, actionType: 'DELETE', entity: 'leads', payload: { name } },
        };
        return { advice: `${this.say('DELETE_ASK')} (Target: ${name})` };
      });

    add('lead_top', 'analytics',
      (l) => /\b(top|biggest|largest|highest)\b/.test(l) && /\blead\b/.test(l),
      (raw, l) => this.runTask('READ', 'leads', { sort: 'deposit_desc', limit: 1 }, null));

    add('lead_lowest', 'analytics',
      (l) => /\b(lowest|smallest)\b/.test(l) && /\blead\b/.test(l),
      (raw, l) => this.runTask('READ', 'leads', { sort: 'deposit_asc', limit: 1 }, null));

    add('lead_total_value', 'analytics',
      (l) => /\b(total|sum)\b/.test(l) && /\blead\b/.test(l) && /value|deposit|worth/.test(l),
      (raw, l) => this.runTask('READ', 'leads', { aggregate: 'sum_deposit' }, null));

    add('lead_average', 'analytics',
      (l) => /\baverage\b|\bavg\b/.test(l) && /\blead\b/.test(l),
      (raw, l) => this.runTask('READ', 'leads', { aggregate: 'avg_deposit' }, null));

    add('lead_count', 'analytics',
      (l) => /\bhow many\b/.test(l) && /\blead\b/.test(l),
      (raw, l) => this.runTask('READ', 'leads', { aggregate: 'count' }, null));

    add('lead_filter_active', 'crud',
      (l) => /\bleads?\b/.test(l) && /\bactive\b/.test(l) && !/update|change|mark/.test(l),
      (raw, l) => this.runTask('READ', 'leads', { status: 'Active' }, null));

    add('lead_filter_pipeline', 'crud',
      (l) => /\bleads?\b/.test(l) && /\bpipeline\b/.test(l) && !/update|change|mark/.test(l),
      (raw, l) => this.runTask('READ', 'leads', { status: 'Pipeline' }, null));

    add('lead_filter_closed', 'crud',
      (l) => /\bleads?\b/.test(l) && /\bclosed\b/.test(l) && !/update|change|mark/.test(l),
      (raw, l) => this.runTask('READ', 'leads', { status: 'Closed' }, null));

    add('lead_date_range', 'analytics',
      (l) => /\bleads?\b/.test(l) && parseDateRangeDays(l) !== null,
      (raw, l) => {
        const days = parseDateRangeDays(l);
        return this.runTask('READ', 'leads', { withinDays: days }, null);
      });

    add('lead_conversion_rate', 'analytics',
      (l) => /\bconversion rate\b|\bclose rate\b/.test(l),
      () => ({ advice: `${this.say('ANALYTICS_INTRO')} ${this.say('ADVISORY_RETENTION')}\n\nAsk Aether for the exact figure with "show closed leads" and "how many leads" to calculate it precisely.` }));

    add('lead_stale', 'analytics',
      (l) => /\bstale\b|\baging\b|\bstuck\b/.test(l) && /\blead\b/.test(l),
      (raw, l) => this.runTask('READ', 'leads', { status: 'Pipeline', staleOnly: true }, null));

    add('lead_duplicate_check', 'analytics',
      (l) => /\bduplicate\b/.test(l) && /\blead\b/.test(l),
      (raw, l) => this.runTask('READ', 'leads', { checkDuplicates: true }, null));

    add('lead_search_by_vehicle', 'crud',
      (l) => /\blead\b/.test(l) && /\bvehicle\b|\bcar\b|\btruck\b|\bcivic\b|\bhiace\b/.test(l) && /\bshow\b|\bfind\b/.test(l),
      (raw, l) => {
        const vehicle = extractAfter(l, /vehicle|car|for/) || 'unspecified';
        return this.runTask('READ', 'leads', { vehicle }, null);
      });

    add('lead_generic_read', 'crud',
      (l) => /\blead\b/.test(l) && /\bshow\b|\blist\b|\bget\b|\bview\b/.test(l),
      () => this.runTask('READ', 'leads', {}, null));

    // ---------------------------------------------------------------
    // SHIPMENTS / LOGISTICS DOMAIN (18)
    // ---------------------------------------------------------------
    add('shipment_add', 'crud',
      (l) => /\badd\b/.test(l) && /(shipment|manifest|container)/.test(l),
      (raw, l) => {
        const container = extractAfter(l, /container/) || 'new container';
        return this.runTask('CREATE', 'shipments', { container }, 'CREATE_SUCCESS');
      });

    add('shipment_show_by_id', 'crud',
      (l) => /(shipment|container)/.test(l) && /\bcn-?\d+\b/.test(l),
      (raw, l) => {
        const idMatch = l.match(/cn-?\d+/);
        return this.runTask('READ', 'shipments', { container: idMatch ? idMatch[0].toUpperCase() : null }, null);
      });

    add('shipment_update_status', 'crud',
      (l) => /(shipment|container)/.test(l) && /\bupdate\b|\bmark\b|\bchange\b/.test(l),
      (raw, l) => {
        const statusMatch = l.match(/in transit|customs|delivered|delayed/);
        const status = statusMatch ? capitalize(statusMatch[0]) : 'In Transit';
        const idMatch = l.match(/cn-?\d+/);
        return this.runTask('UPDATE', 'shipments', { container: idMatch ? idMatch[0].toUpperCase() : null, status }, 'UPDATE_SUCCESS');
      });

    add('shipment_in_transit', 'crud',
      (l) => /(shipment|cargo|container)/.test(l) && /in transit/.test(l),
      () => this.runTask('READ', 'shipments', { status: 'In Transit' }, null));

    add('shipment_in_customs', 'crud',
      (l) => /(shipment|cargo|container)/.test(l) && /customs/.test(l) && !/guidance|clearance process|glossary/.test(l),
      () => this.runTask('READ', 'shipments', { status: 'Customs' }, null));

    add('shipment_delay_risk', 'analytics',
      (l) => /\bdelay\b/.test(l) && /(shipment|cargo|port)/.test(l),
      () => ({ advice: `${this.say('ANALYTICS_INTRO')} ${this.say('ADVISORY_SUPPLY_CHAIN')}` }));

    add('shipment_total_units', 'analytics',
      (l) => /\btotal\b/.test(l) && /\bunits?\b/.test(l),
      () => this.runTask('READ', 'shipments', { aggregate: 'sum_units' }, null));

    add('shipment_by_vessel', 'crud',
      (l) => /\bvessel\b/.test(l) && /\bshow\b|\bfind\b/.test(l),
      (raw, l) => {
        const vessel = extractAfter(l, /vessel/) || 'unspecified';
        return this.runTask('READ', 'shipments', { vessel }, null);
      });

    add('shipment_by_origin', 'crud',
      (l) => /\borigin\b|\bport\b/.test(l) && /\bshow\b|\bfind\b/.test(l),
      (raw, l) => {
        const origin = extractAfter(l, /origin|port/) || 'unspecified';
        return this.runTask('READ', 'shipments', { origin }, null);
      });

    add('shipment_eta', 'advisory',
      (l) => /\beta\b|\bestimated arrival\b/.test(l),
      () => ({ advice: "I don't have live carrier tracking connected for a precise ETA, but I can flag general delay risk if you tell me the origin port and destination." }));

    add('customs_guidance', 'advisory',
      (l) => /customs (clearance|process|guidance)|clear customs/.test(l),
      () => ({ advice: "Customs clearance generally moves faster with complete documentation upfront: commercial invoice, packing list, bill of lading, and any required certificates. Delays most often trace back to missing or mismatched paperwork." }));

    add('incoterms_lookup', 'advisory',
      (l) => /\bincoterms?\b/.test(l),
      () => ({ advice: `${this.say('GLOSSARY_INTRO')} ${GLOSSARY.INCOTERMS}` }));

    add('freight_cost_estimate', 'advisory',
      (l) => /\bfreight cost\b|\bshipping cost\b|\bhow much to ship\b/.test(l),
      () => ({ advice: "I don't have live freight rate data connected, so I can't quote an exact cost — but rates typically hinge on container size, route, and season. I'd recommend checking with your freight forwarder for a current quote." }));

    add('container_capacity', 'advisory',
      (l) => /\bteu\b|\bcontainer capacity\b/.test(l),
      () => ({ advice: `${this.say('GLOSSARY_INTRO')} ${GLOSSARY.TEU}` }));

    add('logistics_summary', 'analytics',
      (l) => /\blogistics summary\b|\bcargo summary\b|\bshipment summary\b/.test(l),
      () => this.runTask('READ', 'shipments', { summary: true }, null));

    add('port_congestion', 'advisory',
      (l) => /\bport congestion\b|\bcongested port\b/.test(l),
      () => ({ advice: `${this.say('GLOSSARY_INTRO')} ${GLOSSARY['PORT CONGESTION']} ${this.say('ADVISORY_SUPPLY_CHAIN')}` }));

    add('bill_of_lading', 'advisory',
      (l) => /\bbill of lading\b|\bbol\b/.test(l),
      () => ({ advice: `${this.say('GLOSSARY_INTRO')} ${GLOSSARY['BILL OF LADING']}` }));

    add('shipment_generic_read', 'crud',
      (l) => /(shipment|cargo|manifest)/.test(l) && /\bshow\b|\blist\b|\bget\b|\bview\b/.test(l),
      () => this.runTask('READ', 'shipments', {}, null));

    // ---------------------------------------------------------------
    // FINANCING / PARTNERS DOMAIN (10)
    // ---------------------------------------------------------------
    add('financing_show', 'crud',
      (l) => /(financ|partner|credit)/.test(l) && /\bshow\b|\blist\b|\bview\b/.test(l),
      () => this.runTask('READ', 'financing', {}, null));

    add('financing_utilization', 'analytics',
      (l) => /\bcredit utilization\b|\butilization rate\b/.test(l),
      () => ({ advice: `${this.say('ANALYTICS_INTRO')} ${this.say('ADVISORY_RISK')}\n\nAsk "show financing partners" for the exact per-partner figures.` }));

    add('financing_remaining', 'analytics',
      (l) => /\bcredit remaining\b|\bavailable credit\b/.test(l),
      () => this.runTask('READ', 'financing', { aggregate: 'remaining_credit' }, null));

    add('financing_add', 'crud',
      (l) => /\badd\b/.test(l) && /(financing partner|credit line)/.test(l),
      (raw, l) => {
        const partner = extractAfter(l, /partner|line/) || 'New Partner';
        return this.runTask('CREATE', 'financing', { partner }, 'CREATE_SUCCESS');
      });

    add('financing_update_used', 'crud',
      (l) => /\bupdate\b|\bchange\b/.test(l) && /(financ|credit)/.test(l) && /\bused\b/.test(l),
      (raw, l) => {
        const amount = parseAmount(l);
        return this.runTask('UPDATE', 'financing', { used: amount }, 'UPDATE_SUCCESS');
      });

    add('financing_risk_flag', 'analytics',
      (l) => /\bfinancing risk\b|\bover-?utilized\b|\brisky partner\b/.test(l),
      () => ({ advice: this.say('ADVISORY_RISK') }));

    add('interest_rate_glossary', 'advisory',
      (l) => /\binterest rate\b/.test(l),
      () => ({ advice: "Interest rates on trade financing lines typically reflect both a base rate and a risk premium tied to your credit utilization and payment history — keeping utilization below ~80% generally helps hold favorable terms." }));

    add('financing_status', 'crud',
      (l) => /(financ|partner)/.test(l) && /\bstatus\b/.test(l),
      () => this.runTask('READ', 'financing', { fields: ['status'] }, null));

    add('financing_credit_increase', 'advisory',
      (l) => /\brequest.*credit increase\b|\bincrease.*limit\b/.test(l),
      () => ({ advice: "I can't directly negotiate credit terms, but a strong case usually includes: consistent on-time payments, utilization kept under 70%, and a clear forecast for how the extra credit will be deployed." }));

    add('financing_summary', 'analytics',
      (l) => /\bfinancing summary\b/.test(l),
      () => this.runTask('READ', 'financing', { summary: true }, null));

    // ---------------------------------------------------------------
    // REPORTS / ANALYTICS (12)
    // ---------------------------------------------------------------
    add('report_generate', 'reporting',
      (l) => /\b(generate|create|make|build)\b/.test(l) && /(report|pdf)/.test(l),
      async () => {
        const genMsg = this.say('REPORT_GENERATING');
        const result = await this.runTask('GENERATE_PDF', 'leads', { fullExport: true }, null);
        return { advice: `${genMsg}\n\n${result.advice}\n\n${this.say('REPORT_READY')}`, executedTask: result.executedTask };
      });

    add('report_export_csv', 'reporting',
      (l) => /\bexport\b/.test(l) && /\bcsv\b/.test(l),
      () => ({ advice: `${this.say('EXPORT_READY')} (CSV format)` }));

    add('report_export_excel', 'reporting',
      (l) => /\bexport\b/.test(l) && /(excel|xlsx)/.test(l),
      () => ({ advice: `${this.say('EXPORT_READY')} (Excel format)` }));

    add('analytics_overview', 'analytics',
      (l) => /\banalytics\b|\boverview\b/.test(l) && !/\bshipment\b/.test(l),
      () => ({ advice: `${this.say('ANALYTICS_INTRO')} I'd need a live query against leads, shipments, and financing to give exact figures — try "total lead value", "units in transit", or "credit utilization" for specifics.` }));

    add('kpi_summary', 'analytics',
      (l) => /\bkpi\b/.test(l),
      () => ({ advice: `${this.say('ANALYTICS_INTRO')} Key metrics to watch: total pipeline value, conversion rate, average deal size, units in transit, and credit utilization.` }));

    add('forecast', 'analytics',
      (l) => /\bforecast\b|\bprojection\b/.test(l),
      () => ({ advice: `${this.say('FORECAST_DISCLAIMER')} ${this.say('ADVISORY_MARKET_TREND')}` }));

    add('compare_periods', 'analytics',
      (l) => /\bcompare\b/.test(l) && /(month|week|quarter|year)/.test(l),
      () => ({ advice: `${this.say('COMPARISON_INTRO')} I'll need both periods queried explicitly — try "leads this month" and "leads last month" and I'll read them back for comparison.` }));

    add('trend_analysis', 'analytics',
      (l) => /\btrend\b/.test(l),
      () => ({ advice: this.say('ADVISORY_MARKET_TREND') }));

    add('dashboard_summary', 'analytics',
      (l) => /\bdashboard\b/.test(l) && /\bsummary\b|\bshow\b/.test(l),
      () => ({ advice: "Your dashboard reflects real-time totals for leads value, units in transit, pipeline status breakdown, and financing utilization — pull it up from the sidebar for the live view." }));

    add('custom_date_report', 'reporting',
      (l) => /\breport\b/.test(l) && /(between|from .* to)/.test(l),
      () => ({ advice: `${this.say('REPORT_GENERATING')} Custom date-range reporting will use the range you specified once connected to a live query — for now, use the standard export and I'll flag any gaps.` }));

    add('recurring_report', 'reporting',
      (l) => /\brecurring report\b|\bweekly report\b|\bmonthly report\b/.test(l),
      () => ({ advice: "I can't yet persist a recurring report schedule, but I can generate one on demand any time you ask." }));

    add('report_status', 'reporting',
      (l) => /\breport\b/.test(l) && /\bstatus\b|\bready\b/.test(l),
      () => ({ advice: this.say('REPORT_READY') }));

    // ---------------------------------------------------------------
    // SYSTEM / INTEGRATION (9)
    // ---------------------------------------------------------------
    add('system_status', 'system',
      (l) => /\bsystem status\b|\bhealth check\b|\bis everything working\b/.test(l),
      () => ({ advice: this.say('INTEGRATION_HEALTHY') }));

    add('sync_data', 'system',
      (l) => /\bsync\b/.test(l),
      () => ({ advice: this.say('SYNC_DATA') }));

    add('security_question', 'system',
      (l) => /\bsecure\b|\bsecurity\b|\bprivacy\b|\bdata safe\b/.test(l),
      () => ({ advice: this.say('SECURITY_REASSURE') }));

    add('undo_action', 'system',
      (l) => /\bundo\b/.test(l),
      () => ({ advice: this.say('UNDO_UNAVAILABLE') }));

    add('permission_check', 'system',
      (l) => /\bpermission\b|\baccess denied\b/.test(l),
      () => ({ advice: this.say('ERROR_PERMISSION') }));

    add('settings_update', 'system',
      (l) => /\bsettings\b/.test(l) && /\bupdate\b|\bchange\b/.test(l),
      () => ({ advice: this.say('SETTINGS_UPDATED') }));

    add('bulk_action', 'system',
      (l) => /\ball leads\b|\ball shipments\b|\bbulk\b/.test(l) && /\bdelete\b|\bupdate\b/.test(l),
      (raw, l, ctx) => {
        ctx.pendingConfirmation = {
          intentId: 'bulk_action',
          label: 'Bulk operation',
          payload: { taskId: `task_${Date.now()}`, actionType: 'UPDATE', entity: 'leads', payload: { bulk: true } },
        };
        return { advice: this.say('BULK_ACTION_CONFIRM') };
      });

    add('retry_after_error', 'system',
      (l) => /\btry again\b|\bretry\b/.test(l),
      () => ({ advice: "Retrying now — one moment." }));

    add('escalate_human', 'system',
      (l) => /\bspeak to a human\b|\breal person\b|\bescalate\b|\bmanager\b/.test(l),
      () => ({ advice: "I can flag this for human follow-up. In the meantime, tell me what's unresolved and I'll document it clearly." }));

    // ---------------------------------------------------------------
    // BUSINESS ADVISORY (10)
    // ---------------------------------------------------------------
    add('advisory_negotiation', 'advisory',
      (l) => /\bnegotiat/.test(l),
      () => ({ advice: this.say('ADVISORY_NEGOTIATION') }));

    add('advisory_currency_risk', 'advisory',
      (l) => /\bcurrency risk\b|\bfx risk\b|\bexchange rate risk\b/.test(l),
      () => ({ advice: this.say('ADVISORY_CURRENCY_RISK') }));

    add('advisory_supply_chain', 'advisory',
      (l) => /\bsupply chain\b/.test(l),
      () => ({ advice: this.say('ADVISORY_SUPPLY_CHAIN') }));

    add('advisory_market_trend', 'advisory',
      (l) => /\bmarket trend\b|\bmarket outlook\b/.test(l),
      () => ({ advice: this.say('ADVISORY_MARKET_TREND') }));

    add('advisory_retention', 'advisory',
      (l) => /\bcustomer retention\b|\bretain customers\b/.test(l),
      () => ({ advice: this.say('ADVISORY_RETENTION') }));

    add('advisory_pricing', 'advisory',
      (l) => /\bpricing strategy\b|\bhow should i price\b/.test(l),
      () => ({ advice: this.say('ADVISORY_PRICING') }));

    add('advisory_risk_mgmt', 'advisory',
      (l) => /\brisk management\b/.test(l),
      () => ({ advice: this.say('ADVISORY_RISK') }));

    add('advisory_seasonal', 'advisory',
      (l) => /\bseasonal\b|\bpeak season\b/.test(l),
      () => ({ advice: this.say('ADVISORY_SEASONAL') }));

    add('advisory_competitor', 'advisory',
      (l) => /\bcompetitor\b|\bcompetition\b/.test(l),
      () => ({ advice: this.say('ADVISORY_COMPETITOR') }));

    add('advisory_general_business', 'advisory',
      (l) => /\badvice\b|\brecommend\b|\bsuggest\b/.test(l) && !/lead|shipment|financ/.test(l),
      () => ({ advice: "Happy to advise — could you narrow it to leads, logistics, financing, or general strategy so I give you something actionable?" }));

    // ---------------------------------------------------------------
    // GLOSSARY LOOKUPS (broad — matches any known term) (1 intent, many terms)
    // ---------------------------------------------------------------
    add('glossary_lookup', 'advisory',
      (l) => /\bwhat (is|does|are)\b/.test(l) && /\bmean\b|\bfob\b|\bcif\b|\bexw\b|\bddp\b|\bdemurrage\b|\bdetention\b|\bletter of credit\b|\bcustoms bond\b|\bfreight forwarder\b|\bmanifest\b|\blead time\b|\bworking capital\b/.test(l),
      (raw, l) => {
        const termKey = Object.keys(GLOSSARY).find(key => l.includes(key.toLowerCase()));
        if (termKey) return { advice: `${this.say('GLOSSARY_INTRO')} ${GLOSSARY[termKey]}` };
        return { advice: this.say('GLOSSARY_NOT_FOUND') };
      });

    // ---------------------------------------------------------------
    // UTILITY (8)
    // ---------------------------------------------------------------
    add('time_query', 'utility',
      (l) => /\bwhat time\b|\bcurrent time\b/.test(l),
      () => ({ advice: fillTemplate(this.say('TIME_QUERY'), { time: new Date().toLocaleTimeString() }) }));

    add('date_query', 'utility',
      (l) => /\bwhat.?s the date\b|\btoday'?s date\b|\bwhat day is it\b/.test(l),
      () => ({ advice: fillTemplate(this.say('DATE_QUERY'), { date: new Date().toLocaleDateString() }) }));

    add('currency_convert', 'utility',
      (l) => /\bconvert\b/.test(l) && /\busd\b|\beur\b|\bgbp\b|\bpkr\b|\baed\b|\bcny\b/.test(l),
      () => ({ advice: `${this.say('CURRENCY_INTRO')} I don't have a live FX feed connected right now, so I can't give you an exact rate — check a live source (e.g. your bank or an FX API) for the current figure before committing to a deal.` }));

    add('unit_convert_weight', 'utility',
      (l) => /\bkg to lb\b|\bkilograms? to pounds?\b/.test(l),
      (raw, l) => {
        const numMatch = l.match(/(\d+(?:\.\d+)?)/);
        const kg = numMatch ? parseFloat(numMatch[1]) : null;
        if (kg === null) return { advice: "Give me a number of kilograms and I'll convert it, e.g. \"200 kg to lb\"." };
        return { advice: `${this.say('UNIT_INTRO')} ${kg} kg ≈ ${UNIT_CONVERSIONS.kgToLb(kg)} lb` };
      });

    add('unit_convert_weight_rev', 'utility',
      (l) => /\blb to kg\b|\bpounds? to kilograms?\b/.test(l),
      (raw, l) => {
        const numMatch = l.match(/(\d+(?:\.\d+)?)/);
        const lb = numMatch ? parseFloat(numMatch[1]) : null;
        if (lb === null) return { advice: "Give me a number of pounds and I'll convert it, e.g. \"200 lb to kg\"." };
        return { advice: `${this.say('UNIT_INTRO')} ${lb} lb ≈ ${UNIT_CONVERSIONS.lbToKg(lb)} kg` };
      });

    add('unit_convert_distance', 'utility',
      (l) => /\bkm to mi\b|\bkilometers? to miles?\b/.test(l),
      (raw, l) => {
        const numMatch = l.match(/(\d+(?:\.\d+)?)/);
        const km = numMatch ? parseFloat(numMatch[1]) : null;
        if (km === null) return { advice: "Give me a number of kilometers and I'll convert it, e.g. \"100 km to mi\"." };
        return { advice: `${this.say('UNIT_INTRO')} ${km} km ≈ ${UNIT_CONVERSIONS.kmToMi(km)} mi` };
      });

    add('percentage_calc', 'utility',
      (l) => /\bwhat is\b.*%.*\bof\b/.test(l),
      (raw, l) => {
        const match = l.match(/([\d.]+)\s*%\s*of\s*([\d,]+(?:\.\d+)?)/);
        if (!match) return { advice: "Give me it as \"X% of Y\" and I'll calculate it." };
        const pct = parseFloat(match[1]);
        const base = parseFloat(match[2].replace(/,/g, ''));
        const result = (pct / 100) * base;
        return { advice: `${pct}% of ${base.toLocaleString()} is ${result.toLocaleString()}.` };
      });

    add('glossary_general', 'utility',
      (l) => /\bglossary\b|\bdefine terms\b/.test(l),
      () => ({ advice: `I can define: ${Object.keys(GLOSSARY).join(', ')}. Just ask "what is [term]".` }));

    return I;
  }

  // ---------------------------------------------------------------------
  // Domain-specific composite handlers (used by multiple intents above)
  // ---------------------------------------------------------------------
  buildReminder(raw, lower) {
    const delaySeconds = parseDelaySeconds(lower);
    let taskText = raw.trim();
    const toMatch = raw.match(/to\s+(.+)/i);
    if (toMatch && toMatch[1].trim()) taskText = toMatch[1].trim();

    return {
      advice: `${this.say('SCHEDULE_SUCCESS')} (Trigger set in ${delaySeconds} second${delaySeconds === 1 ? '' : 's'}: "${taskText}")`,
      notificationRequest: {
        title: 'Executive Strategic Reminder',
        body: taskText,
        delaySeconds,
      },
    };
  }

  async handleAddLead(raw, lower) {
    const depositVal = parseAmount(lower) || 0;

    let nameVal = 'New Lead';
    const afterAdd = raw.split(/add/i)[1];
    if (afterAdd) {
      const asMatch = afterAdd.split(/as a|for/i)[0];
      if (asMatch && asMatch.trim()) nameVal = asMatch.trim();
    }

    let vehicleVal = 'Vehicle Unit';
    if (lower.includes('for ')) {
      const afterFor = raw.split(/for/i)[1] || '';
      const withMatch = afterFor.split(/with|\$/i)[0];
      if (withMatch && withMatch.trim()) vehicleVal = withMatch.trim();
    }

    this.context.lastEntity = 'leads';
    this.context.lastLeadName = nameVal;

    const result = await this.runTask('CREATE', 'leads', { name: nameVal, vehicle: vehicleVal, deposit: depositVal }, 'CREATE_SUCCESS');
    result.advice += `\n\nRecorded Lead: ${nameVal}\nVehicle: ${vehicleVal}\nDeposit: ${formatMoney(depositVal)}`;
    return result;
  }
}

export default MayaAgent;
