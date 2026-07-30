// src/agents/Aether.js
import axios from 'axios';
import RNHTMLtoPDF from 'react-native-html-to-pdf';

export class AetherAgent {
  constructor(apiBaseUrl = 'https://pap-crm.vercel.app/api') {
    this.apiBaseUrl = apiBaseUrl;
    // In-memory fallback mock datastore for local preview testing
    this.localStore = {
      leads: [
        { id: '101', name: 'Global Logistics Corp', status: 'Hot', value: '$45,000' },
        { id: '102', name: 'Apex Shipping LLC', status: 'In Negotiation', value: '$120,000' }
      ],
      shipments: [
        { id: '201', vessel: 'Ocean Star 4', container: 'CONT-8832', status: 'In Transit' }
      ],
      logistics: [
        { id: '301', route: 'Karachi -> Dubai', status: 'Active Dispatch' }
      ],
      financing: [
        { id: '401', partner: 'Habib Bank Enterprise', lineLimit: '$500,000', rate: '8.5%' }
      ]
    };
  }

  async executeTask(packet) {
    const { actionType, entity, payload, taskId } = packet;

    try {
      switch (actionType) {
        case 'READ':
          return this.handleRead(entity, taskId);

        case 'CREATE':
          return this.handleCreate(entity, payload, taskId);

        case 'UPDATE':
          return this.handleUpdate(entity, payload, taskId);

        case 'DELETE':
          return this.handleDelete(entity, payload, taskId);

        case 'GENERATE_PDF':
          return await this.generatePdfReport(payload, taskId);

        default:
          return {
            taskId,
            status: 'ERROR',
            errorMessage: `Unsupported action type: ${actionType}`
          };
      }
    } catch (err) {
      return {
        taskId,
        status: 'ERROR',
        errorMessage: err.message || 'Execution fault in Aether engine.'
      };
    }
  }

  handleRead(entity, taskId) {
    const data = this.localStore[entity] || [];
    return {
      taskId,
      status: 'SUCCESS',
      action: 'READ',
      entity,
      dataPayload: data
    };
  }

  handleCreate(entity, payload, taskId) {
    if (!this.localStore[entity]) this.localStore[entity] = [];
    const newItem = { id: Date.now().toString(), ...payload };
    this.localStore[entity].unshift(newItem);

    return {
      taskId,
      status: 'SUCCESS',
      action: 'CREATE',
      entity,
      createdItem: newItem
    };
  }

  handleUpdate(entity, payload, taskId) {
    const items = this.localStore[entity] || [];
    const index = items.findIndex(i => i.id === payload.id);

    if (index !== -1) {
      items[index] = { ...items[index], ...payload };
      return { taskId, status: 'SUCCESS', action: 'UPDATE', entity, updatedItem: items[index] };
    }

    return { taskId, status: 'ERROR', errorMessage: `Record with ID ${payload.id} not found.` };
  }

  handleDelete(entity, payload, taskId) {
    const items = this.localStore[entity] || [];
    this.localStore[entity] = items.filter(i => i.id !== payload.id);

    return {
      taskId,
      status: 'SUCCESS',
      action: 'DELETE',
      entity,
      deletedId: payload.id
    };
  }

  async generatePdfReport(payload = {}, taskId) {
    const title = payload.title || 'Executive CRM Performance Analysis';
    const html = `
      <html>
        <body style="font-family: sans-serif; padding: 20px; color: #111;">
          <h1 style="color: #00E5FF; background: #09090b; padding: 12px;">${title}</h1>
          <p>Generated dynamically by Aether Operational Engine.</p>
          <hr />
          <h3>System Summary Ledger</h3>
          <ul>
            <li>Pipeline Value: $1,250,000</li>
            <li>Active Sea Manifests: 389</li>
            <li>Financing Partners Integrated: 4</li>
          </ul>
        </body>
      </html>
    `;

    const file = await RNHTMLtoPDF.convert({
      html,
      fileName: `Report_${Date.now()}`,
      directory: 'Documents'
    });

    return {
      taskId,
      status: 'SUCCESS',
      filePath: file.filePath
    };
  }
}
