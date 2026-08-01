// src/agents/Aether.js
//
// Aether — Technical Execution Agent
// ---------------------------------------------------------------------------
// Aether is the only thing in this app that touches real data. It performs
// every CRUD operation against the live DynamoDB tables through the shared
// AWS API Gateway endpoint, auto-generates IDs and timestamps so nothing has
// to be filled in by hand, and can compile a fully custom, professionally
// themed PDF report from any combination of tables/filters and drop it into
// the Reports Vault for download.
//
// Maya (src/agents/Maya.js) calls `executeTask(taskPacket)` and never talks
// to the network directly — this file owns that responsibility entirely.
//
// IMPORTANT ASSUMPTION (please verify against your Lambda):
// Based on the route.ts you shared, the Lambda behind `crm_data` is called as:
//   GET    {AWS_API}?TableName=<table>              -> { Items: [...] }
//   POST   {AWS_API}  body: { TableName, Item }      -> upsert (create OR update)
//   DELETE {AWS_API}  body: { TableName, Key }       -> delete by primary key
// This is the standard shape for a generic single-Lambda DynamoDB proxy. If
// your Lambda expects a different envelope, only `putItem`, `deleteItem`, and
// `fetchTable` below need to change — everything else is built on top of them.
// ---------------------------------------------------------------------------

import axios from 'axios';
import RNHTMLtoPDF from 'react-native-html-to-pdf';

const DEFAULT_API = 'https://mbz2lmd7ud.execute-api.us-east-2.amazonaws.com/default/crm_data';
const ACCENT = '#00E5FF';
const INK = '#0B0B12';

// =============================================================================
// TABLE SCHEMAS — one source of truth for every DynamoDB table this app uses.
// `fieldAliases` lets Maya (and any other caller) speak in plain business
// terms ("deposit", "vehicle", "partner") while Aether writes to the real
// column names DynamoDB actually stores.
// =============================================================================
const ENTITY_SCHEMAS = {
  leads: {
    tableName: 'tbl_leads',
    primaryKey: 'lead_id',
    idPrefix: 'LD',
    label: 'Leads',
    statusField: 'stage',
    numericField: 'budget',
    dateField: 'createdAt',
    autoOnCreate: { createdAt: 'now', lastActivity: 'now' },
    autoOnUpdate: { lastActivity: 'now' },
    columns: [
      'lead_id', 'assignedRep', 'budget', 'createdAt', 'creditStatus', 'downPayment',
      'email', 'lastActivity', 'location', 'name', 'phone', 'preferredVehicle',
      'stage', 'statuses', 'timeline',
    ],
    fieldAliases: {
      vehicle: 'preferredVehicle', deposit: 'budget', status: 'stage',
      rep: 'assignedRep', assignedRep: 'assignedRep', credit: 'creditStatus',
    },
    searchFields: ['name', 'email', 'phone', 'location', 'preferredVehicle'],
  },

  shipments: {
    tableName: 'tbl_shipment',
    primaryKey: 'shipment_id',
    idPrefix: 'SHP',
    label: 'Shipments',
    statusField: 'shipment_status',
    numericField: 'total_logistics_cost',
    dateField: 'departure_date',
    autoOnCreate: {},
    autoOnUpdate: {},
    columns: [
      'shipment_id', 'vehicle_id', 'actual_port_used', 'arrival_date', 'departure_date',
      'destination_country', 'estimated_transit_time', 'inland_transport_cost', 'lead_id',
      'ocean_freight_cost', 'origin_location', 'port_used', 'shipment_number',
      'shipment_status', 'shipping_line', 'total_logistics_cost', 'vessel_name',
    ],
    fieldAliases: {
      container: 'shipment_number', vessel: 'vessel_name', origin: 'origin_location',
      destination: 'destination_country', status: 'shipment_status', line: 'shipping_line',
      port: 'port_used', vehicleId: 'vehicle_id', leadId: 'lead_id',
    },
    searchFields: ['shipment_number', 'vessel_name', 'origin_location', 'destination_country', 'shipping_line'],
  },

  financing: {
    tableName: 'tbl_financing',
    primaryKey: 'financing_id',
    idPrefix: 'FIN',
    label: 'Financing Partners',
    statusField: 'active_status',
    numericField: 'max_loan_amount',
    dateField: null,
    autoOnCreate: {},
    autoOnUpdate: {},
    columns: [
      'financing_id', 'active_status', 'approval_time_days', 'contact_email', 'interest_rate',
      'loan_term_months', 'max_loan_amount', 'min_credit_score', 'notes', 'partner_name',
      'partner_type', 'processing_fee', 'supported_countries',
    ],
    fieldAliases: {
      partner: 'partner_name', rate: 'interest_rate', limit: 'max_loan_amount',
      status: 'active_status', type: 'partner_type', email: 'contact_email',
      term: 'loan_term_months', minScore: 'min_credit_score', fee: 'processing_fee',
    },
    searchFields: ['partner_name', 'partner_type', 'contact_email'],
  },

  logistics: {
    tableName: 'tbl_logistics',
    primaryKey: 'logistics_id',
    idPrefix: 'LOG',
    label: 'Logistics',
    statusField: 'logistics_status',
    numericField: 'total_logistics_cost',
    dateField: 'last_updated',
    autoOnCreate: { last_updated: 'now' },
    autoOnUpdate: { last_updated: 'now' },
    columns: [
      'logistics_id', 'actual_transit_time', 'clearance_cost', 'estimated_transit_time',
      'inland_transport_cost', 'insurance_cost', 'last_updated', 'lead_id', 'logistics_status',
      'ocean_freight_cost', 'other_fees', 'shipment_id', 'total_logistics_cost', 'tracking_number',
      'vehicle_id',
    ],
    fieldAliases: {
      status: 'logistics_status', tracking: 'tracking_number',
      shipmentId: 'shipment_id', leadId: 'lead_id', vehicleId: 'vehicle_id',
    },
    searchFields: ['tracking_number', 'shipment_id'],
  },

  ports: {
    tableName: 'tbl_ports',
    primaryKey: 'port_id',
    idPrefix: 'PRT',
    label: 'Ports',
    statusField: 'active_status',
    numericField: null,
    dateField: null,
    autoOnCreate: {},
    autoOnUpdate: {},
    columns: [
      'port_id', 'country', 'active_status', 'city', 'container_supported', 'port_code',
      'port_name', 'roro_supported', 'shipping_partner', 'state', 'supported_destination_countries',
    ],
    fieldAliases: {
      name: 'port_name', code: 'port_code', status: 'active_status',
      partner: 'shipping_partner', destinations: 'supported_destination_countries',
    },
    searchFields: ['port_name', 'port_code', 'city', 'country'],
  },
};

// Every schema also accepts an explicit `id` shorthand for its own primary key
Object.values(ENTITY_SCHEMAS).forEach((schema) => {
  schema.fieldAliases.id = schema.primaryKey;
});

// Keys that describe HOW to query/report, never actual column data —
// these must never be written into DynamoDB as if they were fields.
const CONTROL_KEYS = new Set([
  'aggregate', 'sort', 'limit', 'withinDays', 'staleOnly', 'checkDuplicates',
  'summary', 'fields', 'bulk', 'fullExport', 'entities', 'filters', 'title',
  'notes', 'groupBy', 'id',
]);

// =============================================================================
// SMALL UTILITIES
// =============================================================================
function generateId(prefix) {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

function nowIso() {
  return new Date().toISOString();
}

function toNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatMoney(val) {
  const n = toNumber(val);
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return escapeHtml(val);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function applyAutoFields(schema, target, mode) {
  const map = mode === 'create' ? schema.autoOnCreate : schema.autoOnUpdate;
  if (!map) return;
  Object.entries(map).forEach(([field, directive]) => {
    if (directive === 'now') target[field] = nowIso();
  });
}

/** Maps friendly/generic keys onto real DynamoDB column names, stripping control keys. */
function normalizePayload(schema, payload = {}) {
  const out = {};
  Object.keys(payload).forEach((key) => {
    if (CONTROL_KEYS.has(key)) return;
    if (payload[key] === undefined) return;
    const column = schema.fieldAliases[key] || key;
    out[column] = payload[key];
  });
  return out;
}

/** Finds the record a CRUD directive is pointing at, by explicit ID or fuzzy search. */
function resolveTargetItem(schema, items, payload = {}) {
  const explicitId = payload.id || payload[schema.primaryKey];
  if (explicitId) {
    return items.find((i) => String(i[schema.primaryKey]) === String(explicitId)) || null;
  }
  const friendlyCandidates = ['name', 'partner', 'vessel', 'origin', 'container', 'tracking', 'code']
    .map((k) => payload[k])
    .filter(Boolean);
  if (friendlyCandidates.length === 0) return null;
  const needle = String(friendlyCandidates[0]).toLowerCase();
  return (
    items.find((item) =>
      schema.searchFields.some((f) => String(item[f] || '').toLowerCase().includes(needle))
    ) || null
  );
}

/** Generic filter / sort / limit / projection engine shared by every READ. */
function applyReadOperations(schema, itemsIn, payload = {}) {
  let items = [...itemsIn];

  if (payload.status && schema.statusField) {
    const needle = String(payload.status).toLowerCase();
    items = items.filter((i) => String(i[schema.statusField] || '').toLowerCase() === needle);
  }

  ['name', 'vehicle', 'vessel', 'origin', 'container', 'partner', 'tracking', 'destination', 'type', 'city', 'country']
    .forEach((friendly) => {
      if (payload[friendly]) {
        const column = schema.fieldAliases[friendly] || friendly;
        const needle = String(payload[friendly]).toLowerCase();
        items = items.filter((i) => String(i[column] || '').toLowerCase().includes(needle));
      }
    });

  if (payload.withinDays && schema.dateField) {
    const cutoff = Date.now() - payload.withinDays * 24 * 60 * 60 * 1000;
    items = items.filter((i) => {
      const t = i[schema.dateField] ? new Date(i[schema.dateField]).getTime() : NaN;
      return !isNaN(t) && t >= cutoff;
    });
  }

  if (payload.staleOnly && schema.autoOnUpdate?.lastActivity) {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    items = items.filter((i) => {
      const t = i.lastActivity ? new Date(i.lastActivity).getTime() : 0;
      return t < cutoff;
    });
  }

  if (payload.checkDuplicates) {
    const key = schema.searchFields[0];
    const counts = {};
    items.forEach((i) => {
      const k = String(i[key] || '').toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    });
    items = items.filter((i) => counts[String(i[key] || '').toLowerCase()] > 1);
  }

  if (payload.sort) {
    const [rawField, direction] = String(payload.sort).split('_');
    const column = schema.fieldAliases[rawField] || schema.numericField || rawField;
    items = [...items].sort((a, b) => {
      const diff = toNumber(a[column]) - toNumber(b[column]);
      return direction === 'asc' ? diff : -diff;
    });
  }

  if (payload.limit) {
    items = items.slice(0, payload.limit);
  }

  if (Array.isArray(payload.fields) && payload.fields.length) {
    items = items.map((i) => {
      const picked = {};
      payload.fields.forEach((f) => { picked[f] = i[schema.fieldAliases[f] || f]; });
      return picked;
    });
  }

  return items;
}

/** Handles aggregate-style READ requests: count / sum_<field> / avg_<field>. */
function computeAggregate(schema, items, aggregateKey) {
  if (aggregateKey === 'count') return { metric: 'count', value: items.length };

  const match = String(aggregateKey).match(/^(sum|avg)_(.+)$/);
  if (!match) {
    return { note: `Unrecognized aggregate "${aggregateKey}". Try "count", "sum_<field>", or "avg_<field>".` };
  }
  const [, op, friendly] = match;
  const column = schema.fieldAliases[friendly] || (friendly === 'deposit' || friendly === 'units' ? schema.numericField : friendly);
  if (!column || !schema.columns.includes(column)) {
    return { note: `"${friendly}" isn't a numeric field on ${schema.label}. Available columns: ${schema.columns.join(', ')}.` };
  }
  const nums = items.map((i) => toNumber(i[column]));
  const total = nums.reduce((s, n) => s + n, 0);
  if (op === 'sum') return { metric: `sum_${column}`, value: total };
  return { metric: `avg_${column}`, value: items.length ? total / items.length : 0 };
}

// =============================================================================
// REPORTS VAULT — a lightweight shared registry so any screen (Reports Vault
// UI, dashboard, etc.) can list / subscribe to reports Aether has generated.
// =============================================================================
export const ReportsVault = {
  entries: [],
  listeners: [],
  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  },
  notify() {
    this.listeners.forEach((fn) => fn(this.entries));
  },
  add(entry) {
    this.entries.unshift(entry);
    if (this.entries.length > 200) this.entries.pop();
    this.notify();
    return entry;
  },
  list() {
    return this.entries;
  },
};

// =============================================================================
// AETHER AGENT
// =============================================================================
export class AetherAgent {
  constructor(apiBaseUrl = DEFAULT_API) {
    this.apiBaseUrl = apiBaseUrl;
  }

  // ---------------------------------------------------------------------
  // Low-level AWS API transport — every DynamoDB call goes through these
  // three methods, matching the shape used by your existing route.ts.
  // ---------------------------------------------------------------------
  async fetchTable(tableName) {
    const response = await axios.get(this.apiBaseUrl, {
      params: { TableName: tableName },
      headers: { 'Content-Type': 'application/json' },
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.Items || []);
  }

  async putItem(tableName, item) {
    const response = await axios.post(
      this.apiBaseUrl,
      { TableName: tableName, Item: item },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  }

  async deleteItem(tableName, key) {
    const response = await axios({
      method: 'delete',
      url: this.apiBaseUrl,
      data: { TableName: tableName, Key: key },
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  }

  // ---------------------------------------------------------------------
  // Public dispatch — same contract Maya already expects.
  // ---------------------------------------------------------------------
  async executeTask(packet) {
    const { actionType, entity, payload = {}, taskId } = packet || {};

    try {
      switch (actionType) {
        case 'READ':
          return await this.handleRead(entity, payload, taskId);
        case 'CREATE':
          return await this.handleCreate(entity, payload, taskId);
        case 'UPDATE':
          return await this.handleUpdate(entity, payload, taskId);
        case 'DELETE':
          return await this.handleDelete(entity, payload, taskId);
        case 'GENERATE_PDF':
          return await this.generateReport(payload, taskId);
        default:
          return { taskId, status: 'ERROR', errorMessage: `Unsupported action type: ${actionType}` };
      }
    } catch (err) {
      return {
        taskId,
        status: 'ERROR',
        errorMessage: err?.response?.data?.error || err?.message || 'Execution fault in Aether engine.',
      };
    }
  }

  getSchema(entity, taskId) {
    const schema = ENTITY_SCHEMAS[entity];
    if (!schema) {
      const known = Object.keys(ENTITY_SCHEMAS).join(', ');
      throw Object.assign(new Error(`Unknown entity "${entity}". Known entities: ${known}.`), { taskId });
    }
    return schema;
  }

  // ---------------------------------------------------------------------
  // READ — fetch + filter + sort + aggregate, all in one intelligent pass
  // ---------------------------------------------------------------------
  async handleRead(entity, payload, taskId) {
    const schema = this.getSchema(entity, taskId);
    const rawItems = await this.fetchTable(schema.tableName);

    if (payload.aggregate) {
      const filteredFirst = applyReadOperations(schema, rawItems, { ...payload, sort: null, limit: null, fields: null });
      const aggregateResult = computeAggregate(schema, filteredFirst, payload.aggregate);
      return { taskId, status: 'SUCCESS', action: 'READ', entity, dataPayload: aggregateResult, meta: { scanned: rawItems.length, matched: filteredFirst.length } };
    }

    if (payload.summary) {
      const items = applyReadOperations(schema, rawItems, payload);
      const byStatus = {};
      if (schema.statusField) {
        items.forEach((i) => {
          const s = i[schema.statusField] || 'Unspecified';
          byStatus[s] = (byStatus[s] || 0) + 1;
        });
      }
      const totalValue = schema.numericField ? items.reduce((s, i) => s + toNumber(i[schema.numericField]), 0) : null;
      return {
        taskId, status: 'SUCCESS', action: 'READ', entity,
        dataPayload: { count: items.length, byStatus, totalValue },
      };
    }

    const items = applyReadOperations(schema, rawItems, payload);
    return { taskId, status: 'SUCCESS', action: 'READ', entity, dataPayload: items, meta: { scanned: rawItems.length, matched: items.length } };
  }

  // ---------------------------------------------------------------------
  // CREATE — auto ID + auto timestamps, then upsert
  // ---------------------------------------------------------------------
  async handleCreate(entity, payload, taskId) {
    const schema = this.getSchema(entity, taskId);
    const normalized = normalizePayload(schema, payload);

    const item = {
      [schema.primaryKey]: generateId(schema.idPrefix),
      ...normalized,
    };
    applyAutoFields(schema, item, 'create');

    await this.putItem(schema.tableName, item);

    return { taskId, status: 'SUCCESS', action: 'CREATE', entity, createdItem: item };
  }

  // ---------------------------------------------------------------------
  // UPDATE — resolve target (by ID or fuzzy match), merge, re-upsert full item
  // (DynamoDB PutItem overwrites the whole row, so partial "updates" must be
  // merged client-side against the existing record first.)
  // ---------------------------------------------------------------------
  async handleUpdate(entity, payload, taskId) {
    const schema = this.getSchema(entity, taskId);
    const items = await this.fetchTable(schema.tableName);
    const existing = resolveTargetItem(schema, items, payload);

    if (!existing) {
      return { taskId, status: 'ERROR', errorMessage: `Couldn't find a matching ${schema.label.toLowerCase()} record to update.` };
    }

    const normalized = normalizePayload(schema, payload);
    const merged = { ...existing, ...normalized, [schema.primaryKey]: existing[schema.primaryKey] };
    applyAutoFields(schema, merged, 'update');

    await this.putItem(schema.tableName, merged);

    return { taskId, status: 'SUCCESS', action: 'UPDATE', entity, updatedItem: merged };
  }

  // ---------------------------------------------------------------------
  // DELETE — resolve target, delete by real primary key
  // ---------------------------------------------------------------------
  async handleDelete(entity, payload, taskId) {
    const schema = this.getSchema(entity, taskId);
    const items = await this.fetchTable(schema.tableName);
    const existing = resolveTargetItem(schema, items, payload);

    if (!existing) {
      return { taskId, status: 'ERROR', errorMessage: `Couldn't find a matching ${schema.label.toLowerCase()} record to delete.` };
    }

    await this.deleteItem(schema.tableName, { [schema.primaryKey]: existing[schema.primaryKey] });

    return { taskId, status: 'SUCCESS', action: 'DELETE', entity, deletedId: existing[schema.primaryKey] };
  }

  // =========================================================================
  // REPORT GENERATION — fully flexible: any subset of tables, any filters,
  // any title, dropped straight into the Reports Vault as a proper PDF.
  //
  // payload shape (all optional, sensible defaults applied):
  // {
  //   title: "Q3 Leads & Financing Review",
  //   entities: ['leads', 'financing'],       // defaults to all 5 tables
  //   filters: { leads: { status: 'Active', withinDays: 30 }, financing: {} },
  //   notes: "Prepared for the Tuesday ops sync.",
  // }
  // =========================================================================
  async generateReport(payload = {}, taskId) {
    const {
      title = 'Executive CRM Performance Report',
      entities = Object.keys(ENTITY_SCHEMAS),
      filters = {},
      notes = '',
      fullExport = false,
    } = payload;

    const targetEntities = fullExport ? Object.keys(ENTITY_SCHEMAS) : entities;
    const sections = [];
    const scopeLines = [];

    for (const entityKey of targetEntities) {
      const schema = ENTITY_SCHEMAS[entityKey];
      if (!schema) continue;
      const entityFilter = filters[entityKey] || {};
      const rawItems = await this.fetchTable(schema.tableName);
      const items = applyReadOperations(schema, rawItems, entityFilter);

      sections.push({ schema, items });

      const filterDesc = Object.keys(entityFilter).length
        ? Object.entries(entityFilter).map(([k, v]) => `${k}=${v}`).join(', ')
        : 'no filters (full table)';
      scopeLines.push(`${schema.label}: ${items.length} record(s) — ${filterDesc}`);
    }

    const html = buildReportHtml({ title, sections, notes, scopeLines });

    const fileName = `OGAMOTO_${title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60)}_${Date.now()}`;
    const file = await RNHTMLtoPDF.convert({
      html,
      fileName,
      directory: 'Documents',
      base64: false,
    });

    const vaultEntry = {
      id: generateId('REP'),
      title,
      generatedAt: nowIso(),
      filePath: file.filePath,
      entities: targetEntities,
      recordCount: sections.reduce((s, sec) => s + sec.items.length, 0),
    };
    ReportsVault.add(vaultEntry);

    return {
      taskId,
      status: 'SUCCESS',
      action: 'GENERATE_PDF',
      filePath: file.filePath,
      vaultEntry,
    };
  }
}

// =============================================================================
// PDF REPORT TEMPLATE — professional, on-brand (dark navy + cyan), print-safe
// (light body background so it doesn't drain ink / stays legible printed).
// =============================================================================
function buildReportHtml({ title, sections, notes, scopeLines }) {
  const generatedAt = new Date();
  const totalRecords = sections.reduce((s, sec) => s + sec.items.length, 0);

  const kpiCards = sections.map((sec) => {
    const { schema, items } = sec;
    const value = schema.numericField
      ? formatMoney(items.reduce((s, i) => s + toNumber(i[schema.numericField]), 0))
      : `${items.length}`;
    return `
      <div class="kpi-card">
        <div class="kpi-num">${escapeHtml(value)}</div>
        <div class="kpi-label">${escapeHtml(schema.label)}${schema.numericField ? ' (total)' : ' (records)'}</div>
      </div>`;
  }).join('');

  const sectionsHtml = sections.map((sec) => {
    const { schema, items } = sec;
    const columns = schema.columns.filter((c) => c !== schema.primaryKey).slice(0, 7);

    const headerRow = `<tr>${columns.map((c) => `<th>${escapeHtml(prettifyColumn(c))}</th>`).join('')}</tr>`;

    const bodyRows = items.length
      ? items.map((item) => {
          const cells = columns.map((c) => `<td>${escapeHtml(formatCell(c, item[c]))}</td>`).join('');
          return `<tr>${cells}</tr>`;
        }).join('')
      : `<tr><td colspan="${columns.length}" class="empty-row">No records matched this section's filters.</td></tr>`;

    return `
      <section class="table-section">
        <h2>${escapeHtml(schema.label)} <span class="count-pill">${items.length}</span></h2>
        <table>
          <thead>${headerRow}</thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </section>`;
  }).join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, Helvetica, Arial, sans-serif;
            margin: 0; padding: 0; color: #1a1a22; background: #ffffff;
          }
          .cover {
            background: linear-gradient(135deg, ${INK} 0%, #14141c 100%);
            color: #ffffff; padding: 42px 36px 34px 36px;
          }
          .brand-row { display: flex; align-items: center; margin-bottom: 26px; }
          .brand-badge {
            width: 34px; height: 34px; border-radius: 9px; background: rgba(0,229,255,0.12);
            border: 1px solid ${ACCENT}; display: flex; align-items: center; justify-content: center;
            color: ${ACCENT}; font-weight: 800; font-size: 14px; margin-right: 10px;
          }
          .brand-name { font-size: 13px; letter-spacing: 3px; color: ${ACCENT}; font-weight: 800; }
          .report-title { font-size: 26px; font-weight: 800; margin: 6px 0 4px 0; }
          .report-meta { font-size: 11px; color: rgba(255,255,255,0.55); }
          .scope-box {
            margin-top: 22px; background: rgba(255,255,255,0.06); border: 1px solid rgba(0,229,255,0.25);
            border-radius: 10px; padding: 14px 16px;
          }
          .scope-title { color: ${ACCENT}; font-size: 10.5px; font-weight: 800; letter-spacing: 1px; margin-bottom: 8px; }
          .scope-line { font-size: 11px; color: rgba(255,255,255,0.85); margin: 3px 0; }

          .kpi-row { display: flex; flex-wrap: wrap; gap: 12px; padding: 22px 36px 0 36px; }
          .kpi-card {
            border: 1px solid #e6e6ec; border-radius: 10px; padding: 12px 16px; min-width: 140px;
            border-top: 3px solid ${ACCENT};
          }
          .kpi-num { font-size: 19px; font-weight: 800; color: #0b0b12; }
          .kpi-label { font-size: 10px; color: #666; margin-top: 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }

          .table-section { padding: 24px 36px 0 36px; }
          h2 {
            font-size: 14px; color: #0b0b12; border-bottom: 2px solid ${ACCENT};
            padding-bottom: 6px; margin-bottom: 10px; display: flex; align-items: center;
          }
          .count-pill {
            background: ${INK}; color: ${ACCENT}; font-size: 10px; font-weight: 700;
            border-radius: 20px; padding: 2px 9px; margin-left: 8px;
          }
          table { width: 100%; border-collapse: collapse; }
          th {
            text-align: left; background: ${INK}; color: #fff; font-size: 9.5px;
            padding: 7px 8px; text-transform: uppercase; letter-spacing: 0.3px;
          }
          td { font-size: 10.5px; padding: 7px 8px; border-bottom: 1px solid #eeeef2; }
          tr:nth-child(even) td { background: #fafafe; }
          .empty-row { text-align: center; color: #999; font-style: italic; padding: 14px; }

          .notes-box {
            margin: 26px 36px 0 36px; padding: 14px 16px; background: #fbfdff;
            border-left: 3px solid ${ACCENT}; border-radius: 6px; font-size: 11px; color: #444;
          }
          .footer {
            margin-top: 34px; padding: 16px 36px 28px 36px; border-top: 1px solid #eee;
            font-size: 9.5px; color: #999; display: flex; justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="cover">
          <div class="brand-row">
            <div class="brand-badge">O</div>
            <div class="brand-name">OGAMOTO ENTERPRISE</div>
          </div>
          <div class="report-title">${escapeHtml(title)}</div>
          <div class="report-meta">Generated ${escapeHtml(generatedAt.toLocaleString())} · ${totalRecords} total record(s) · Prepared by Aether</div>

          <div class="scope-box">
            <div class="scope-title">REPORT SCOPE</div>
            ${scopeLines.map((line) => `<div class="scope-line">• ${escapeHtml(line)}</div>`).join('')}
          </div>
        </div>

        <div class="kpi-row">${kpiCards}</div>

        ${sectionsHtml}

        ${notes ? `<div class="notes-box"><strong>Notes:</strong> ${escapeHtml(notes)}</div>` : ''}

        <div class="footer">
          <span>OGAMOTO Enterprise System — Confidential Executive Document</span>
          <span>Page generated automatically by Aether</span>
        </div>
      </body>
    </html>
  `;
}

function prettifyColumn(col) {
  return col
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCell(column, value) {
  if (value === undefined || value === null || value === '') return '—';
  const lower = column.toLowerCase();
  if (lower.includes('cost') || lower.includes('amount') || lower.includes('budget') || lower.includes('fee') || lower.includes('payment')) {
    return formatMoney(value);
  }
  if (lower.includes('date') || lower === 'createdat' || lower === 'lastactivity' || lower === 'last_updated') {
    return formatDate(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default AetherAgent;
