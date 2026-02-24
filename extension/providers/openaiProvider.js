import { ContextExtractor } from '../utils/contextExtractor.js';
import { Storage } from '../utils/storage.js';

export const OpenAIProvider = {
    async generate(formContext, userProfile) {
        // Attempt to lookup API key from storage
        const authData = await Storage.get(['openaiApiKey']);
        const apiKey = authData.openaiApiKey || 'YOUR_OPENAI_API_KEY'; // Replace with backend injection or secure config

        const prompt = ContextExtractor.buildPrompt(formContext, userProfile);

        if (apiKey === 'YOUR_OPENAI_API_KEY') {
            console.warn('Using dummy API Key. Real API call will fail unless configured.');
            // Mock response for architecture demo if API key isn't set:
            return fallbackMockResponse(formContext, userProfile);
        }

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
        if (textObj.startsWith('```json')) {
            textObj = textObj.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        return JSON.parse(textObj);
    }
};

function fallbackMockResponse(formContext, profile) {
    return FormContextFallbackGenerator(formContext, profile);
}

export function FormContextFallbackGenerator(formContext, profile) {
    // A simple fallback generator to supply somewhat usable answers for dev testing
    return formContext.sections.flatMap(sec =>
        sec.questions.map((q) => {
            let val = "Test Answer";
            if (q.options && q.options.length > 0) val = q.options[0];
            return { questionText: q.questionText, value: val };
        })
    );
}
