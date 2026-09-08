// learningEngine.js - Advanced Dual-Layer Memory & Self-Improvement Engine (Claude Code & OpenClaw Inspired)

import { Storage } from './storage.js';

const STORAGE_KEYS = {
  learnedMappings: 'learned_mappings',
  ephemeralLog: 'ephemeral_session_log',
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

    if (norm1.length > 4 && norm2.length > 4) {
      if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
    }

    return false;
  },

  // 1. EPHEMERAL CORRECTION CAPTURE (OpenClaw Daily Log / Claude Auto Memory)
  async recordEphemeralCorrection(questionText, answerValue, isUserEdit = true) {
    if (!questionText || answerValue === undefined || answerValue === null || answerValue === '') return;
    const key = this.normalizeText(questionText);
    if (!key || key.length < 2) return;

    try {
      const data = await Storage.get([STORAGE_KEYS.ephemeralLog]);
      const log = data.ephemeral_session_log || [];

      log.push({
        key,
        questionText: questionText.trim(),
        value: answerValue,
        timestamp: new Date().toISOString(),
        isUserEdit
      });

      // Keep last 100 ephemeral entries
      if (log.length > 100) log.shift();

      await Storage.set({ [STORAGE_KEYS.ephemeralLog]: log });

      // Run pattern consolidation pass
      await this.consolidateMemories();
    } catch (err) {
      console.warn('[LearningEngine] Error recording ephemeral correction:', err);
    }
  },

  // 2. PATTERN CONSOLIDATION ("DREAMING PASS")
  // Distills raw ephemeral logs into Durable Curated Memory based on confidence gates
  async consolidateMemories() {
    try {
      const data = await Storage.get([STORAGE_KEYS.ephemeralLog, STORAGE_KEYS.learnedMappings]);
      const log = data.ephemeral_session_log || [];
      const durable = data.learned_mappings || {};

      if (log.length === 0) return durable;

      // Group ephemeral occurrences
      const occurrences = {};
      log.forEach(item => {
        if (!occurrences[item.key]) {
          occurrences[item.key] = {
            questionText: item.questionText,
            latestValue: item.value,
            count: 0,
            hasUserEdit: false,
            lastTimestamp: item.timestamp
          };
        }
        occurrences[item.key].count += 1;
        occurrences[item.key].latestValue = item.value;
        if (item.isUserEdit) occurrences[item.key].hasUserEdit = true;
      });

      // Heuristic Confidence Gate Promotion
      let updated = false;
      Object.entries(occurrences).forEach(([key, occ]) => {
        // Promote if user explicitly edited OR if seen 2+ times
        const confidenceScore = occ.hasUserEdit ? 1.0 : (occ.count >= 2 ? 0.8 : 0.4);

        if (confidenceScore >= 0.8) {
          durable[key] = {
            questionText: occ.questionText,
            value: occ.latestValue,
            confidence: confidenceScore,
            usedCount: (durable[key]?.usedCount || 0) + occ.count,
            lastUpdated: occ.lastTimestamp
          };
          updated = true;
        }
      });

      if (updated) {
        await Storage.set({ [STORAGE_KEYS.learnedMappings]: durable });
        console.log('[LearningEngine] Dreaming Pass: Promoted high-confidence memories to durable storage.');
      }

      return durable;
    } catch (err) {
      console.warn('[LearningEngine] Error during consolidation pass:', err);
      return {};
    }
  },

  // 3. CURATED DURABLE MEMORY RETRIEVAL & MANAGEMENT
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

  // Editable Memory APIs for Popup UI
  async getAllLearnedMappings() {
    try {
      const data = await Storage.get([STORAGE_KEYS.learnedMappings]);
      return data.learned_mappings || {};
    } catch {
      return {};
    }
  },

  async updateLearnedMapping(oldKey, newQuestionText, newValue) {
    try {
      const durable = await this.getAllLearnedMappings();
      const newKey = this.normalizeText(newQuestionText);

      if (oldKey && oldKey !== newKey && durable[oldKey]) {
        delete durable[oldKey];
      }

      durable[newKey] = {
        questionText: newQuestionText.trim(),
        value: newValue,
        confidence: 1.0,
        usedCount: (durable[newKey]?.usedCount || 1),
        lastUpdated: new Date().toISOString()
      };

      await Storage.set({ [STORAGE_KEYS.learnedMappings]: durable });
      return durable;
    } catch (err) {
      console.warn('[LearningEngine] Could not update learned mapping:', err);
      throw err;
    }
  },

  async deleteLearnedMapping(key) {
    try {
      const durable = await this.getAllLearnedMappings();
      if (durable[key]) {
        delete durable[key];
        await Storage.set({ [STORAGE_KEYS.learnedMappings]: durable });
      }
      return durable;
    } catch (err) {
      console.warn('[LearningEngine] Could not delete learned mapping:', err);
      throw err;
    }
  },

  async clearLearnedMappings() {
    await Storage.set({ [STORAGE_KEYS.learnedMappings]: {}, [STORAGE_KEYS.ephemeralLog]: [] });
  },

  // 4. PROVIDER HEALTH TELEMETRY & DYNAMIC RANKING
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

  async getHealthyProviderOrder(preferredProvider, configuredProviders) {
    if (!configuredProviders || configuredProviders.length === 0) return [preferredProvider];

    try {
      const data = await Storage.get([STORAGE_KEYS.providerHealth]);
      const health = data.provider_health || {};

      const sorted = [...configuredProviders].sort((a, b) => {
        const hA = health[a] || { failCount: 0, avgDurationMs: 1000 };
        const hB = health[b] || { failCount: 0, avgDurationMs: 1000 };

        if (hA.failCount !== hB.failCount) {
          return hA.failCount - hB.failCount;
        }
        return hA.avgDurationMs - hB.avgDurationMs;
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
