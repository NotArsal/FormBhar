// formReader.js - Extracts DOM context
window.AIFormReader = {
    extractContext() {
        // Top-level semantic elements
        const titleEl = document.querySelector('div[role="heading"][aria-level="1"]');
        const formTitle = titleEl ? titleEl.innerText.trim() : document.title;

        // Description heuristic: usually the next text block after title
        let formDescription = '';
        if (titleEl && titleEl.nextElementSibling) {
            formDescription = titleEl.nextElementSibling.innerText.trim();
        }

        const questions = [];
        const listItems = document.querySelectorAll('div[role="listitem"]');

        listItems.forEach(item => {
            const heading = item.querySelector('div[role="heading"]');
            if (!heading) return;

            let questionText = heading.innerText.trim();

            // Clean up the trailing asterisk for required fields
            const required = questionText.endsWith('*') || item.innerHTML.includes('aria-required="true"');
            if (questionText.endsWith('*')) {
                questionText = questionText.slice(0, -1).trim();
            }

            let type = 'unknown';
            let options = [];

            // Detect type via reliable ARIA and structural selectors
            const radios = Array.from(item.querySelectorAll('[role="radio"]'));
            const checkboxes = Array.from(item.querySelectorAll('[role="checkbox"]'));
            const textInput = item.querySelector('input[type="text"]');
            const textArea = item.querySelector('textarea');
            const listbox = item.querySelector('[role="listbox"]');

            if (radios.length > 0) {
                type = 'multiple_choice';
                options = radios.map(r => r.getAttribute('aria-label') || r.innerText || '').filter(Boolean);
            } else if (checkboxes.length > 0) {
                type = 'checkbox';
                options = checkboxes.map(c => c.getAttribute('aria-label') || c.innerText || '').filter(Boolean);
            } else if (listbox) {
                type = 'dropdown';
                // Options in Google dropdowns often loaded dynamically, we rely on semantic structure 
                // to pass the fact it is a dropdown.
            } else if (textArea) {
                type = 'paragraph';
            } else if (textInput) {
                type = 'short_answer';
            }

            questions.push({
                questionText,
                type,
                options: [...new Set(options)], // Clean duplicates
                required,
                _elementRef: item // Internal ref for filler
            });
        });

        return {
            formTitle,
            formDescription,
            sections: [{
                title: 'Visible Section', // Simplification for multipage Forms
                questions
            }]
        };
    }
};
