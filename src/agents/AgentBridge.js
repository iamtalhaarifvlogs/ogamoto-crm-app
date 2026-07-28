// src/agents/AgentBridge.js
import { useState, useMemo } from 'react';
import { MayaAgent } from './Maya';

export const useAgentSystem = (openAiApiKey) => {
  const [loading, setLoading] = useState(false);

  const maya = useMemo(() => new MayaAgent(openAiApiKey), [openAiApiKey]);

  const processDirective = async (prompt) => {
    if (!prompt.trim()) return null;
    setLoading(true);
    try {
      const result = await maya.handleUserDirective(prompt);
      return result;
    } catch (error) {
      console.error('Agent execution failed:', error);
      return {
        advice: 'Unable to reach Maya agent core. Please check network or API parameters.',
      };
    } finally {
      setLoading(false);
    }
  };

  return { processDirective, loading };
};
