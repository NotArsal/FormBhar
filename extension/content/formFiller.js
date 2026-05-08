// formFiller.js - Injects answers back into DOM with history & smart matching

window.AIFormFiller = {
  // Utility to fire React / Google internal change events
  triggerChange(element) {
    const event = new Event('input', { bubbles: true });
    element.dispatchEvent(event);
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  },

  async fillData(answersArray, profileData) {
    const formCtx = window.AIFormReader.extractContext();
    const questions = formCtx.sections?.[0]?.questions || [];
    if (questions.length === 0) {
      console.warn('No questions found in form context');
      return;
    }

    // Save to history including answers
    await this.saveToHistory(formCtx, answersArray);

    questions.forEach((q) => {
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

    // Name patterns
    if (qLower.match(/(name|full.?name|student.?name|first.?name|last.?name)/)) {
      return { value: profileData.name };
    }
    // Roll number patterns
    if (qLower.match(/(roll|roll.?no|roll.?number|student.?id|reg.?no|PRN)/)) {
      return { value: profileData.rollNo || profileData.prn };
    }
    // Email patterns
    if (qLower.match(/(email|mail|e-mail|mail.?id)/)) {
      return { value: profileData.email };
    }
    // Phone patterns
    if (qLower.match(/(phone|mobile|cell|tel|contact.?no)/)) {
      return { value: profileData.phone };
    }
    // Department patterns
    if (qLower.match(/(dept|department|branch)/)) {
      return { value: profileData.department };
    }
    // Class/Year patterns
    if (qLower.match(/(class|year|semester|section|batch)/)) {
      return { value: profileData.classYear };
    }

    return null;
  },

  fillItem(container, type, value) {
    if (!value) return;

    // Text-like inputs
    if (['short_answer', 'email', 'number', 'tel', 'url'].includes(type)) {
      const input = container.querySelector('input');
      if (input) {
        input.value = value;
        this.triggerChange(input);
      }
    }
    // Paragraph
    else if (type === 'paragraph') {
      const textarea = container.querySelector('textarea');
      if (textarea) {
        textarea.value = value;
        this.triggerChange(textarea);
      }
    }
    // Multiple choice / Checkbox / Linear Scale
    else if (type === 'multiple_choice' || type === 'checkbox' || type === 'linear_scale') {
      const options = container.querySelectorAll('[role="radio"], [role="checkbox"], input[type="radio"], input[type="checkbox"]');
      const valuesToMatch = Array.isArray(value) ? value : [value];
      
      valuesToMatch.forEach(val => {
        let target = Array.from(options).find(opt => {
          const label = opt.getAttribute('aria-label') || opt.getAttribute('data-value') || opt.innerText || '';
          return label.toLowerCase() === String(val).toLowerCase() || label.toLowerCase().includes(String(val).toLowerCase());
        });
        if (target) {
          const isChecked = target.getAttribute('aria-checked') === 'true' || target.checked === true;
          if (!isChecked) target.click();
        }
      });
    }
    // Dropdown
    else if (type === 'dropdown') {
      const select = container.querySelector('select');
      if (select) {
        const options = Array.from(select.options);
        const target = options.find(opt =>
          opt.text.toLowerCase().includes(String(value).toLowerCase()) ||
          opt.value.toLowerCase().includes(String(value).toLowerCase())
        );
        if (target) {
          select.value = target.value;
          this.triggerChange(select);
        }
      }
    }
    // Date or Time
    else if (type === 'date' || type === 'time') {
      const input = container.querySelector(`input[type="${type}"]`);
      if (input) {
        input.value = value;
        this.triggerChange(input);
      }
    }
  },

  // Save form to history
  async saveToHistory(formContext, answersArray) {
    const historyItem = {
      formTitle: formContext.formTitle,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      questionsCount: formContext.totalQuestions || 0,
      answers: answersArray || [],
      questions: formContext.sections?.[0]?.questions?.slice(0, 10) || []
    };

    try {
      const data = await chrome.storage.local.get(['formHistory']);
      const history = data.formHistory || [];
      history.unshift(historyItem);
      if (history.length > 50) history.pop();
      await chrome.storage.local.set({ formHistory: history });
    } catch (e) {
      console.warn('Could not save to history:', e);
    }
  }
};