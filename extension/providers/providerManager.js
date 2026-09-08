import { ContextExtractor } from '../utils/contextExtractor.js';
import { Storage } from '../utils/storage.js';
import { LearningEngine } from '../utils/learningEngine.js';

const PROVIDER_ORDER = ['openai', 'gemini', 'claude', 'groq'];

const PROVIDER_CONFIG = {
    openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: (key) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        }),
        body: (prompt) => ({
            model: 'gpt-4o-mini',
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
        body: (prompt) => ({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 1000,
            temperature: 0.1,
            messages: [{ role: 'user', content: prompt }]
        }),
        parse: (data) => data.content[0].text
    },
    gemini: {
        url: () => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        headers: (key) => ({
            'Content-Type': 'application/json',
            'x-goog-api-key': key
        }),
        body: (prompt) => ({
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
        body: (prompt) => ({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1
        }),
        parse: (data) => data.choices[0].message.content
    }
};

export const ProviderManager = {
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
      const prompt = ContextExtractor.buildPrompt(formContext, userProfile);
      const config = PROVIDER_CONFIG[providerKey];
      
      const url = typeof config.url === 'function' ? config.url(apiKey) : config.url;
      const headers = config.headers(apiKey);
      const body = config.body(prompt);

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