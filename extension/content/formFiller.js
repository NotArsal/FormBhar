// formFiller.js - Injects answers back into DOM

window.AIFormFiller = {
    // Utility to fire React / Google internal change events
    triggerChange(element) {
        const event = new Event('input', { bubbles: true });
        element.dispatchEvent(event);

        // For Google's internal framework (often needs 'change' or mimicking keydown)
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
    },

    async fillData(answersArray, profileData) {
        // Obtain live refs from Reader
        const formCtx = window.AIFormReader.extractContext();
        const questions = formCtx.sections[0].questions;

        questions.forEach((q, index) => {
            const answer = answersArray.find(a =>
                a.questionText.toLowerCase() === q.questionText.toLowerCase()
            ) || this.matchProfileFallback(q.questionText, profileData);

            if (answer && answer.value) {
                this.fillItem(q._elementRef, q.type, answer.value);
            }
        });
    },

    matchProfileFallback(questionText, profileData) {
        if (!profileData) return null;
        const qLower = questionText.toLowerCase();

        if (qLower.includes('name')) {
            return { value: profileData.name };
        }
        if (qLower.includes('roll') || qLower.includes('roll no') || qLower.includes('roll number')) {
            return { value: profileData.rollNo };
        }
        if (qLower.includes('prn') || qLower.includes('registration number')) {
            return { value: profileData.prn };
        }
        if (qLower.includes('email') || qLower.includes('mail id')) {
            return { value: profileData.email };
        }

        return null;
    },

    fillItem(container, type, value) {
        if (!value) return;

        if (type === 'short_answer') {
            const input = container.querySelector('input[type="text"]');
            if (input) {
                input.value = value;
                this.triggerChange(input);
            }
        } else if (type === 'paragraph') {
            const textarea = container.querySelector('textarea');
            if (textarea) {
                textarea.value = value;
                this.triggerChange(textarea);
            }
        } else if (type === 'multiple_choice' || type === 'checkbox') {
            // Find the specific radio/checkbox that matches the value
            const options = container.querySelectorAll(type === 'multiple_choice' ? '[role="radio"]' : '[role="checkbox"]');
            let target = Array.from(options).find(opt => {
                const label = opt.getAttribute('aria-label') || opt.innerText || '';
                return label.toLowerCase().includes(String(value).toLowerCase());
            });

            if (target) {
                // Only click if it's not already checked
                const isChecked = target.getAttribute('aria-checked') === 'true';
                if (!isChecked) {
                    target.click(); // Using standard DOM click
                }
            }
        }
        // Dropdown is highly specific to Google's JS, might require opening menu first and wait for DOM changes. 
        // To keep robust as per requirements, we'd add complex mutation observing for dropdowns here if needed.
    }
};
