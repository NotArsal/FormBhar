// formFiller.js - Injects answers back into DOM with history & smart matching

window.AIFormFiller = {
  normalizeText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  },

  fuzzyMatch(label, val) {
    const l = String(label).toLowerCase().replace(/[^a-z0-9]/g, '');
    const v = String(val).toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (l === v || l.includes(v) || v.includes(l)) return true;

    // Common aliases for branches and years
    const aliases = [
      ['csai', 'cseai', 'cse(ai)', 'artificialintelligence'],
      ['aiml', 'cseaiml', 'ai&ml', 'machinelearning'],
      ['aids', 'cseaids', 'ai&ds', 'datascience'],
      ['entc', 'e&tc', 'electronics'],
      ['cs', 'cse', 'computer', 'computerscience'],
      ['it', 'informationtechnology'],
      ['1', '1st', 'first', 'fy'],
      ['2', '2nd', 'second', 'sy'],
      ['3', '3rd', 'third', 'ty'],
      ['4', '4th', 'fourth', 'btech'],
      ['5', '5th', 'fifth']
    ];

    for (const group of aliases) {
      const strippedGroup = group.map(a => a.replace(/[^a-z0-9]/g, ''));
      const valInGroup = strippedGroup.some(alias => v === alias || (alias.length > 1 && v.includes(alias)));
      const labelInGroup = strippedGroup.some(alias => l === alias || (alias.length > 1 && l.includes(alias)));
      if (valInGroup && labelInGroup) {
        return true;
      }
    }

    return false;
  },

  // Utility to fire React / Google internal change events
  triggerChange(element) {
    if (!element) return;
    
    // Focus the input element
    element.focus?.();

    // Emulate realistic keyboard interactions to register state changes
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true }));

    // Core events
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    element.dispatchEvent(inputEvent);

    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    element.dispatchEvent(changeEvent);

    // Closure compiler specific compositionend event mapping (ensures values commit)
    const compositionEvent = new CompositionEvent('compositionend', { 
        bubbles: true, 
        cancelable: true, 
        data: element.value 
    });
    element.dispatchEvent(compositionEvent);

    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true }));

    // Blur the element to trigger field validation commit
    element.blur?.();
  },

  getFormId() {
    const match = window.location.href.match(/\/forms\/d\/e\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : 'default_form';
  },

  async fillData(answersArray, profileData) {
    const formId = this.getFormId();
    
    // 1. If new answers are provided, merge and persist them in storage
    if (answersArray && answersArray.length > 0) {
      const storedData = await chrome.storage.local.get([`answers_${formId}`]);
      const existingAnswers = storedData[`answers_${formId}`] || [];
      
      const mergedAnswers = [...existingAnswers];
      answersArray.forEach(newAns => {
        const idx = mergedAnswers.findIndex(a => this.normalizeText(a.questionText) === this.normalizeText(newAns.questionText));
        if (idx !== -1) {
          mergedAnswers[idx] = newAns;
        } else {
          mergedAnswers.push(newAns);
        }
      });
      await chrome.storage.local.set({ [`answers_${formId}`]: mergedAnswers });
    }

    // 2. Fetch full cached answers
    const storedData = await chrome.storage.local.get([`answers_${formId}`]);
    const storedAnswers = storedData[`answers_${formId}`] || [];

    // 3. Extract active DOM questions currently rendered in the window
    const activeQuestions = window.AIFormReader.extractActiveDOMQuestions() || [];
    if (activeQuestions.length === 0) {
      console.warn('No active DOM questions found to fill.');
      return;
    }

    // Save context to history
    const formCtx = window.AIFormReader.extractContext();
    await this.saveToHistory(formCtx, storedAnswers);

    let profileUpdated = false;

    // 4. Fill active questions on this page
    for (const q of activeQuestions) {
      let answer = storedAnswers.find(a =>
        this.normalizeText(a.questionText) === this.normalizeText(q.questionText)
      );

      if (!answer) {
        // Try profile fallback
        answer = this.matchProfileFallback(q.questionText, profileData);
        if (answer) {
          storedAnswers.push({
            questionText: q.questionText,
            value: answer.value
          });
          profileUpdated = true;
        }
      }

      if (answer && answer.value !== undefined && answer.value !== null) {
        await this.fillItem(q._elementRef, q.type, answer.value);
      }
    }

    // Save profile updates to cache if we matched from profile
    if (profileUpdated) {
      await chrome.storage.local.set({ [`answers_${formId}`]: storedAnswers });
    }
  },

  matchProfileFallback(questionText, profileData) {
    if (!profileData) return null;
    const qLower = questionText.toLowerCase();

    // Name patterns
    if (qLower.match(/(name|full.?name|student.?name|first.?name|last.?name)/)) {
      return { value: profileData.name };
    }
    // Roll number patterns
    if (qLower.match(/(roll|roll.?no|roll.?number|student.?id|reg.?no)/)) {
      return { value: profileData.rollNo };
    }
    // PRN patterns
    if (qLower.match(/(prn|prn.?no|prn.?number)/)) {
      return { value: profileData.prn };
    }
    // Email patterns
    if (qLower.match(/(email|mail|e-mail|mail.?id)/)) {
      return { value: profileData.email };
    }
    // Phone patterns
    if (qLower.match(/(phone|mobile|cell|tel|contact|whatsapp)/)) {
      return { value: profileData.phone };
    }
    // Department patterns
    if (qLower.match(/(dept|department)/)) {
      return { value: profileData.department };
    }
    // Branch patterns
    if (qLower.match(/(branch|course|program)/)) {
      return { value: profileData.branch };
    }
    // Class/Year patterns
    if (qLower.match(/(class|year)/)) {
      return { value: profileData.classYear };
    }
    // Semester patterns
    if (qLower.match(/(semester|sem)/)) {
      return { value: profileData.semester };
    }
    // Division patterns
    if (qLower.match(/(division|div|section|batch)/)) {
      return { value: profileData.division };
    }

    return null;
  },

  async fillItem(container, type, value) {
    if (!value) return;

    // Text-like inputs
    if (['short_answer', 'email', 'number', 'tel', 'url'].includes(type)) {
      const input = container.querySelector('input:not([type="hidden"])');
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
          return this.fuzzyMatch(label, val);
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
        const target = options.find(opt => this.fuzzyMatch(opt.text, value) || this.fuzzyMatch(opt.value, value));
        if (target) {
          select.value = target.value;
          this.triggerChange(select);
        }
      } else {
        // Google Forms custom dropdown (role="listbox")
        const listbox = container.querySelector('[role="listbox"]');
        if (listbox) {
          listbox.click();
          await new Promise(resolve => setTimeout(resolve, 150));
          
          const options = Array.from(document.querySelectorAll('[role="option"]'));
          const target = options.find(opt => {
            const valAttr = opt.getAttribute('data-value');
            if (!valAttr) return false;
            return this.fuzzyMatch(valAttr, value);
          });
          
          if (target) {
            target.click();
          } else {
            // Close listbox if option not found
            listbox.click();
          }
          await new Promise(resolve => setTimeout(resolve, 150));
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