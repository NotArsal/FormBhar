import { ContextExtractor } from '../utils/contextExtractor.js';
import { Storage } from '../utils/storage.js';
import { LearningEngine } from '../utils/learningEngine.js';
import { PromptSanitizer } from '../utils/promptSanitizer.js';

const PROVIDER_ORDER = ['openai', 'gemini', 'claude', 'groq'];

const MODEL_PREFERENCES = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
  gemini: ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768'],
  claude: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-haiku-20240307']
};

const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const PROVIDER_CONFIG = {
    openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: (key) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        }),
        body: (prompt, model) => ({
            model: model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1
        }),
        parse: (data) => data.choices[0].message.content
    },
    claude: {
        url: 'https://api.anthropic.com/v1/messages',
        headers: (key) => ({
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
        }),
        body: (prompt, model) => ({
            model: model || 'claude-3-5-haiku-latest',
            max_tokens: 1000,
            temperature: 0.1,
            messages: [{ role: 'user', content: prompt }]
        }),
        parse: (data) => data.content[0].text
    },
    gemini: {
        url: (key, model) => `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent`,
        headers: (key) => ({
            'Content-Type': 'application/json',
            'x-goog-api-key': key
        }),
        body: (prompt, model) => ({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
        }),
        parse: (data) => data.candidates[0].content.parts[0].text
    },
    groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: (key) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        }),
        body: (prompt, model) => ({
            model: model || 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1
        }),
        parse: (data) => data.choices[0].message.content
    }
};

export const ProviderManager = {
  async fetchAvailableModel(providerKey, apiKey) {
    if (!apiKey || apiKey === 'MOCK_KEY') return MODEL_PREFERENCES[providerKey]?.[0];

    try {
      // 1. Check local storage cache
      const cacheData = await Storage.get(['cached_models']);
      const cachedModels = cacheData.cached_models || {};
      const cached = cachedModels[providerKey];

      if (cached && cached.model && cached.timestamp && (Date.now() - cached.timestamp < MODEL_CACHE_TTL)) {
        return cached.model;
      }

      // 2. Query provider API for available model list
      let availableModels = [];
      if (providerKey === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (res.ok) {
          const data = await res.json();
          availableModels = (data.data || []).map(m => m.id);
        }
      } else if (providerKey === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (res.ok) {
          const data = await res.json();
          availableModels = (data.data || []).map(m => m.id);
        }
      } else if (providerKey === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (res.ok) {
          const data = await res.json();
          availableModels = (data.models || []).map(m => (m.name || '').replace(/^models\//, ''));
        }
      } else if (providerKey === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        });
        if (res.ok) {
          const data = await res.json();
          availableModels = (data.data || []).map(m => m.id);
        }
      }

      // 3. Match against preferences
      let selectedModel = null;
      const prefs = MODEL_PREFERENCES[providerKey] || [];

      if (availableModels.length > 0) {
        selectedModel = prefs.find(p => availableModels.includes(p));
        if (!selectedModel) {
          selectedModel = availableModels.find(m => m.includes('gpt') || m.includes('flash') || m.includes('llama') || m.includes('claude')) || availableModels[0];
        }
      }

      // 4. Default fallback if API discovery failed or returned empty
      if (!selectedModel) {
        selectedModel = prefs[0];
      }

      // 5. Update cache
      cachedModels[providerKey] = {
        model: selectedModel,
        timestamp: Date.now()
      };
      await Storage.set({ cached_models: cachedModels });
      console.log(`[ProviderManager] Discovered active model for ${providerKey}: ${selectedModel}`);

      return selectedModel;
    } catch (err) {
      console.warn(`[ProviderManager] Model discovery failed for ${providerKey}, falling back:`, err.message);
      return MODEL_PREFERENCES[providerKey]?.[0];
    }
  },

  async generateAnswers(providerName, formContext, userProfile) {
    const preferred = providerName.toLowerCase();
    
    // Retrieve credentials to check which providers are configured
    const authData = await Storage.get(['openaiApiKey', 'geminiApiKey', 'claudeApiKey', 'groqApiKey']);
    
    const isConfigured = (key, placeholder) => {
      return key && key.trim() !== '' && key.trim() !== placeholder;
    };

    const keys = {
      openai: authData.openaiApiKey?.trim(),
      gemini: authData.geminiApiKey?.trim(),
      claude: authData.claudeApiKey?.trim(),
      groq: authData.groqApiKey?.trim()
    };

    const hasKey = {
      openai: isConfigured(keys.openai, 'YOUR_OPENAI_API_KEY'),
      gemini: isConfigured(keys.gemini, 'YOUR_GEMINI_API_KEY'),
      claude: isConfigured(keys.claude, 'YOUR_CLAUDE_API_KEY'),
      groq: isConfigured(keys.groq, 'YOUR_GROQ_API_KEY')
    };

    // MOCK_KEY logic for testing
    if (keys.openai === 'MOCK_KEY') {
        console.log('ProviderManager: running in MOCK_KEY mode.');
        const questions = formContext.sections.flatMap(sec => sec.questions);
        const mockValues = [
            "Shaikh Hunain", "9876543210", "9876543210", "Pune", "Maharashtra",
            "Vishwakarma Institute of Technology (VIT), Pune",
            "B", "A", "E", "O", "A", "B", "B", "B", "B", "B", "A"
        ];
        
        return questions.map((q, index) => {
            let val = mockValues[index] || "";
            if (['multiple_choice', 'checkbox', 'dropdown'].includes(q.type) && q.options && q.options.length > 0) {
                if (val.length === 1 && val >= 'A' && val <= 'Z') {
                    const optIndex = val.charCodeAt(0) - 65;
                    val = (optIndex >= 0 && optIndex < q.options.length) ? q.options[optIndex] : q.options[0];
                } else {
                    const matched = q.options.find(opt => opt.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(opt.toLowerCase()));
                    val = matched ? matched : q.options[0];
                }
                if (q.type === 'checkbox') val = [val];
            }
            return { questionText: q.questionText, value: val };
        });
    }

    const configuredProviders = PROVIDER_ORDER.filter(p => hasKey[p]);

    let providers = [];
    if (configuredProviders.length > 0) {
      providers = await LearningEngine.getHealthyProviderOrder(preferred, configuredProviders);
    } else {
      providers = [preferred];
    }

    let lastError = null;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const getJitterDelay = () => Math.floor(Math.random() * 2000) + 1000;

    // Try each provider in order until one succeeds
    for (let i = 0; i < providers.length; i++) {
      const providerKey = providers[i];
      try {
        if (!hasKey[providerKey]) {
            throw new Error(`${providerKey.toUpperCase()} API Key is missing! Please configure a valid API Key in the extension popup.`);
        }

        const result = await this.executeFetch(providerKey, keys[providerKey], formContext, userProfile);
        console.log(`Successfully generated answers using ${providerKey}`);
        return result;
      } catch (e) {
        console.warn(`Provider ${providerKey} failed:`, e.message);
        lastError = e;
        
        if (i < providers.length - 1) {
          const delay = getJitterDelay();
          console.log(`Rate limit / error fallback triggered: waiting ${delay}ms before next provider (${providers[i + 1]})...`);
          await sleep(delay);
        }
      }
    }

    console.error('All AI providers failed:', lastError);
    throw lastError || new Error('All AI providers failed');
  },

  async executeFetch(providerKey, apiKey, formContext, userProfile) {
      const startTime = Date.now();

      // 1. Discover active available model for provider
      const resolvedModel = await this.fetchAvailableModel(providerKey, apiKey);

      // 2. Sanitize input questions against prompt injection attacks
      const sanitizedContext = { ...formContext };
      if (Array.isArray(sanitizedContext.sections)) {
        sanitizedContext.sections = sanitizedContext.sections.map(sec => ({
          ...sec,
          title: PromptSanitizer.sanitizeText(sec.title),
          description: PromptSanitizer.sanitizeText(sec.description),
          questions: PromptSanitizer.sanitizeQuestions(sec.questions)
        }));
      }

      const prompt = ContextExtractor.buildPrompt(sanitizedContext, userProfile);
      const config = PROVIDER_CONFIG[providerKey];
      
      const url = typeof config.url === 'function' ? config.url(apiKey, resolvedModel) : config.url;
      const headers = config.headers(apiKey);
      const body = config.body(prompt, resolvedModel);

      try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            await LearningEngine.recordProviderHealth(providerKey, Date.now() - startTime, false);
            throw new Error(`${providerKey} API error (${response.status}): ${errBody.substring(0, 150)}`);
        }

        const data = await response.json();
        let textObj = config.parse(data).trim();
        
        if (textObj.startsWith('```')) {
            textObj = textObj.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
        }

        let parsedResult;
        try {
            parsedResult = JSON.parse(textObj);
        } catch (parseErr) {
            const arrayMatch = textObj.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                parsedResult = JSON.parse(arrayMatch[0]);
            } else {
                throw parseErr;
            }
        }

        await LearningEngine.recordProviderHealth(providerKey, Date.now() - startTime, true);
        return parsedResult;
      } catch (err) {
        await LearningEngine.recordProviderHealth(providerKey, Date.now() - startTime, false);
        throw err;
      }
  }
};