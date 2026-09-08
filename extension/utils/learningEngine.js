// learningEngine.js - Self-Improvement & Adaptive Field Memory Engine for FormBhar

import { Storage } from './storage.js';

const STORAGE_KEYS = {
  learnedMappings: 'learned_mappings',
  providerHealth: 'provider_health'
};

export const LearningEngine = {
  normalizeText(text) {
    if (!text) return '';
    return text.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  },

  fuzzyMatchQuestion(q1, q2) {
    const norm1 = this.normalizeText(q1);
    const norm2 = this.normalizeText(q2);
    if (!norm1 || !norm2) return false;
    if (norm1 === norm2) return true;

    // Substring containment if length > 4
    if (norm1.length > 4 && norm2.length > 4) {
      if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
    }

    return false;
  },

  // Record a learned or user-corrected question-answer pair
  async recordLearnedAnswer(questionText, answerValue) {
    if (!questionText || answerValue === undefined || answerValue === null || answerValue === '') return;

    try {
      const data = await Storage.get([STORAGE_KEYS.learnedMappings]);
      const mappings = data.learned_mappings || {};
      const key = this.normalizeText(questionText);

      if (!key || key.length < 2) return;

      mappings[key] = {
        questionText: questionText.trim(),
        value: answerValue,
        lastUpdated: new Date().toISOString(),
        usedCount: (mappings[key]?.usedCount || 0) + 1
      };

      await Storage.set({ [STORAGE_KEYS.learnedMappings]: mappings });
      console.log(`[LearningEngine] Recorded memory for "${questionText}":`, answerValue);
    } catch (err) {
      console.warn('[LearningEngine] Could not record learned answer:', err);
    }
  },

  // Retrieve a learned answer if it matches previous questions
  async getLearnedAnswer(questionText) {
    if (!questionText) return null;
    try {
      const data = await Storage.get([STORAGE_KEYS.learnedMappings]);
      const mappings = data.learned_mappings || {};
      const targetKey = this.normalizeText(questionText);

      // Exact match
      if (mappings[targetKey] && mappings[targetKey].value !== undefined) {
        return mappings[targetKey].value;
      }

      // Fuzzy match search
      for (const [key, item] of Object.entries(mappings)) {
        if (this.fuzzyMatchQuestion(questionText, item.questionText)) {
          return item.value;
        }
      }

      return null;
    } catch (err) {
      console.warn('[LearningEngine] Could not retrieve learned answer:', err);
      return null;
    }
  },

  // Get all learned mappings for Popup UI
  async getAllLearnedMappings() {
    try {
      const data = await Storage.get([STORAGE_KEYS.learnedMappings]);
      return data.learned_mappings || {};
    } catch {
      return {};
    }
  },

  // Clear learned memory
  async clearLearnedMappings() {
    await Storage.set({ [STORAGE_KEYS.learnedMappings]: {} });
  },

  // Telemetry: Record provider performance latency and success/failure
  async recordProviderHealth(providerKey, durationMs, success) {
    if (!providerKey) return;
    try {
      const data = await Storage.get([STORAGE_KEYS.providerHealth]);
      const health = data.provider_health || {};
      const stats = health[providerKey] || { successCount: 0, failCount: 0, avgDurationMs: 0 };

      if (success) {
        stats.successCount += 1;
        stats.avgDurationMs = stats.avgDurationMs > 0 
          ? Math.round((stats.avgDurationMs * 0.7) + (durationMs * 0.3)) 
          : durationMs;
      } else {
        stats.failCount += 1;
      }

      stats.lastUsed = new Date().toISOString();
      health[providerKey] = stats;

      await Storage.set({ [STORAGE_KEYS.providerHealth]: health });
    } catch (err) {
      console.warn('[LearningEngine] Could not record provider health:', err);
    }
  },

  // Dynamically rank configured providers by health and latency
  async getHealthyProviderOrder(preferredProvider, configuredProviders) {
    if (!configuredProviders || configuredProviders.length === 0) return [preferredProvider];

    try {
      const data = await Storage.get([STORAGE_KEYS.providerHealth]);
      const health = data.provider_health || {};

      // Sort configured providers: low fail count first, then low avg duration
      const sorted = [...configuredProviders].sort((a, b) => {
        const hA = health[a] || { failCount: 0, avgDurationMs: 1000 };
        const hB = health[b] || { failCount: 0, avgDurationMs: 1000 };

        if (hA.failCount !== hB.failCount) {
          return hA.failCount - hB.failCount; // Fewer failures first
        }
        return hA.avgDurationMs - hB.avgDurationMs; // Faster first
      });

      if (sorted.includes(preferredProvider) && (health[preferredProvider]?.failCount || 0) === 0) {
        return [preferredProvider, ...sorted.filter(p => p !== preferredProvider)];
      }

      return sorted;
    } catch {
      return configuredProviders;
    }
  }
};
