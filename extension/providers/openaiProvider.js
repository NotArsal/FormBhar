import { ContextExtractor } from '../utils/contextExtractor.js';
import { Storage } from '../utils/storage.js';

export const OpenAIProvider = {
    async generate(formContext, userProfile) {
        // Attempt to lookup API key from storage
        const authData = await Storage.get(['openaiApiKey']);
        const apiKey = authData.openaiApiKey?.trim();

        if (apiKey === 'MOCK_KEY') {
            console.log('OpenAIProvider: running in MOCK_KEY mode.');
            const questions = formContext.sections.flatMap(sec => sec.questions);
            const mockValues = [
                "Shaikh Hunain",
                "9876543210",
                "9876543210",
                "Pune",
                "Maharashtra",
                "Vishwakarma Institute of Technology (VIT), Pune",
                "B", "A", "E", "O", "A", "B", "B", "B", "B", "B", "A"
            ];
            
            return questions.map((q, index) => {
                let val = mockValues[index] || "";
                if (['multiple_choice', 'checkbox', 'dropdown'].includes(q.type) && q.options && q.options.length > 0) {
                    if (val.length === 1 && val >= 'A' && val <= 'Z') {
                        const optIndex = val.charCodeAt(0) - 65;
                        if (optIndex >= 0 && optIndex < q.options.length) {
                            val = q.options[optIndex];
                        } else {
                            val = q.options[0];
                        }
                    } else {
                        const matched = q.options.find(opt => opt.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(opt.toLowerCase()));
                        val = matched ? matched : q.options[0];
                    }
                    if (q.type === 'checkbox') {
                        val = [val];
                    }
                }
                return {
                    questionText: q.questionText,
                    value: val
                };
            });
        }

        if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY' || apiKey === '') {
            throw new Error('OpenAI API Key is missing! Please configure a valid API Key in the extension popup.');
        }

        const prompt = ContextExtractor.buildPrompt(formContext, userProfile);


        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        let textObj = data.choices[0].message.content.trim();
        if (textObj.startsWith('```')) {
            textObj = textObj.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
        }
        return JSON.parse(textObj);
    }
};
