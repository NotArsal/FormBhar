export const ContextExtractor = {
    buildPrompt(formContext, userProfile) {
        const questionsText = formContext.sections.flatMap(sec =>
            sec.questions.map((q, i) =>
                `Q${i + 1}: "${q.questionText}" | Type: ${q.type} | Options: [${q.options.join(', ')}] | Required: ${q.required}`
            )
        ).join('\n');

        return `
You are an intelligent auto-fill assistant for Google Forms. 
Given the following form context and user profile, generate the appropriate answers.

USER PROFILE:
${JSON.stringify(userProfile, null, 2)}

FORM TITLE: ${formContext.formTitle}
FORM DESCRIPTION: ${formContext.formDescription}

QUESTIONS:
${questionsText}

INSTRUCTIONS:
1. Provide realistic and contextually appropriate answers.
2. If a user profile field matches a question, use it.
3. For 'multiple_choice' or 'dropdown', the "value" must EXACTLY match one of the provided Options.
4. For 'checkbox', the "value" can be a single string or an array of strings exactly matching the provided Options.
5. If a question asks for a 'reason', 'explanation', or 'why', base your textual response logically on the answer you provided for the immediately preceding question.
6. Response MUST be valid JSON (no markdown formatting, no code blocks, just raw JSON) in this exact structure:

[
  { "questionText": "Exact text of the question", "value": "Your selected answer or text (or array for checkboxes)" }
]

CRITICAL: Return ONLY JSON.
`;
    }
};
