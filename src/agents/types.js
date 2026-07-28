// src/agents/types.js

/**
 * @typedef {Object} TaskPacket
 * @property {string} taskId
 * @property {'QUERY_DATABASE' | 'GENERATE_PDF' | 'ANALYZE_PIPELINE'} actionType
 * @property {Object} parameters
 * @property {Object} [authContext]
 */

/**
 * @typedef {Object} TaskResponse
 * @property {string} taskId
 * @property {'SUCCESS' | 'ERROR'} status
 * @property {Object} [dataPayload]
 * @property {string} [filePath]
 * @property {string} [errorMessage]
 */

/**
 * @typedef {Object} MayaResponse
 * @property {string} advice
 * @property {TaskResponse} [executedTask]
 */

export {};

