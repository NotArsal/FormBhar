// formReader.js - Universal Form Extractor
// Detects all common input types across different form platforms

window.AIFormReader = {
  // Map of input types to readable names
  TYPE_MAP: {
    'multiple_choice': 'Multiple Choice',
    'checkbox': 'Checkbox',
    'dropdown': 'Dropdown',
    'short_answer': 'Short Answer',
    'paragraph': 'Paragraph',
    'date': 'Date',
    'time': 'Time',
    'datetime': 'Date & Time',
    'email': 'Email',
    'number': 'Number',
    'tel': 'Phone',
    'url': 'URL',
    'file': 'File Upload',
    'linear_scale': 'Linear Scale',
    'grid': 'Grid/Matrix',
    'rating': 'Rating',
    'unknown': 'Unknown'
  },

  // Extract complete form context
  extractContext() {
    const formTitle = this.extractFormTitle();
    const formDescription = this.extractFormDescription();
    const sections = this.extractSections();
    const metadata = this.extractMetadata(sections);

    return {
      formTitle,
      formDescription,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      ...metadata,
      sections
    };
  },

  // Extract form title from various platforms
  extractFormTitle() {
    // Google Forms
    let title = this.getText('div[role="heading"][aria-level="1"]');
    if (title) return title;

    // Generic selectors
    title = this.getText('h1');
    if (title) return title;

    title = this.getText('form title, [class*="title"], [id*="title"], [data-testid*="title"]');
    if (title) return title;

    return document.title || 'Untitled Form';
  },

  // Extract form description
  extractFormDescription() {
    // Google Forms
    const titleEl = document.querySelector('div[role="heading"][aria-level="1"]');
    if (titleEl?.nextElementSibling) {
      const desc = titleEl.nextElementSibling.innerText.trim();
      if (desc && desc.length < 500) return desc;
    }

    // Generic
    return this.getText('[class*="description"], [id*="description"]') || '';
  },

  // Extract all sections (pages)
  extractSections() {
    const sections = [];

    // Try Google Forms first
    const googleSections = this.extractGoogleFormSections();
    if (googleSections.length > 0) return googleSections;

    // Generic form extraction
    sections.push({
      title: 'Main Section',
      page: 1,
      questions: this.extractQuestionsFromContainer(document.body)
    });

    return sections;
  },

  // Google Forms specific extraction
  extractGoogleFormSections() {
    const pages = document.querySelectorAll('[role="group"]');
    if (pages.length === 0) return [];

    const sections = [];
    pages.forEach((page, index) => {
      const pageTitle = this.getText('div[role="heading"]', page) || `Page ${index + 1}`;
      const questions = this.extractQuestionsFromContainer(page);

      if (questions.length > 0) {
        sections.push({
          title: pageTitle,
          page: index + 1,
          questions
        });
      }
    });

    return sections;
  },

  // Extract questions from a container
  extractQuestionsFromContainer(container) {
    const questions = [];

    // Find all question containers using multiple strategies
    const selectors = [
      'div[role="listitem"]',           // Google Forms
      '[class*="question"]',            // Generic question class
      'fieldset',                       // Fieldset groups
      '.form-group',                     // Bootstrap forms
      '.input-group',                    // Input groups
      '[data-field-type]',               // Custom data attributes
      '.field-wrap',                     // WordPress forms
      '.questionnaire-item'             // Qualtrics
    ];

    let questionElements = [];
    selectors.forEach(sel => {
      questionElements = [...questionElements, ...container.querySelectorAll(sel)];
    });

    // Dedupe
    questionElements = [...new Set(questionElements)];

    questionElements.forEach((el, index) => {
      const question = this.extractQuestion(el, index);
      if (question && question.questionText) {
        questions.push(question);
      }
    });

    return questions;
  },

  // Extract single question details
  extractQuestion(element, index) {
    const questionText = this.extractQuestionText(element);
    if (!questionText || questionText.length < 2) return null;

    const type = this.detectQuestionType(element);
    const options = this.extractOptions(element, type);
    const required = this.isRequired(element);
    const placeholder = this.getPlaceholder(element);
    const description = this.getDescription(element);
    const label = this.extractLabel(element);

    return {
      questionText: questionText.trim(),
      type,
      typeName: this.TYPE_MAP[type] || 'Unknown',
      options,
      required,
      placeholder,
      description,
      label: label || questionText,
      order: index + 1,
      _elementRef: element
    };
  },

  // Extract question text using multiple strategies
  extractQuestionText(element) {
    // Google Forms
    const heading = element.querySelector('div[role="heading"]');
    if (heading) {
      let text = heading.innerText.trim();
      return text.replace(/\*$/, '').trim(); // Remove trailing *
    }

    // Label association
    const labelId = element.getAttribute('aria-labelledby');
    if (labelId) {
      const label = document.getElementById(labelId);
      if (label) return label.innerText.trim();
    }

    // Generic label
    const label = element.querySelector('label');
    if (label && label.innerText.trim()) {
      return label.innerText.trim().replace(/\*$/, '').trim();
    }

    // Headers within element
    const header = element.querySelector('h1, h2, h3, h4, h5, h6');
    if (header) return header.innerText.trim().replace(/\*$/, '').trim();

    // Paragraph descriptions
    const p = element.querySelector('p');
    if (p && p.innerText.trim().length < 200) {
      return p.innerText.trim().replace(/\*$/, '').trim();
    }

    // Fallback: get first text node
    return element.innerText.split('\n')[0]?.trim().replace(/\*$/, '').trim() || '';
  },

  // Detect question type using multiple signals
  detectQuestionType(element) {
    // Check for radio buttons (multiple choice)
    const radios = element.querySelectorAll('[role="radio"], input[type="radio"]');
    if (radios.length > 0) return 'multiple_choice';

    // Check for checkboxes
    const checkboxes = element.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
    if (checkboxes.length > 0) return 'checkbox';

    // Check for dropdown/select
    const select = element.querySelector('select');
    if (select) return 'dropdown';

    // Check for listbox (Google Forms dropdown)
    const listbox = element.querySelector('[role="listbox"]');
    if (listbox) return 'dropdown';

    // Check for textarea
    const textarea = element.querySelector('textarea');
    if (textarea) return 'paragraph';

    // Check for various input types
    const input = element.querySelector('input');
    if (input) {
      const inputType = input.type?.toLowerCase();
      switch (inputType) {
        case 'text': return 'short_answer';
        case 'email': return 'email';
        case 'tel':
        case 'phone': return 'tel';
        case 'number': return 'number';
        case 'date': return 'date';
        case 'time': return 'time';
        case 'datetime-local': return 'datetime';
        case 'url': return 'url';
        case 'file': return 'file';
        case 'range': return 'linear_scale';
        default: return 'short_answer';
      }
    }

    // Check for linear scale (Google Forms)
    const linearScale = element.querySelector('[role="slider"], input[type="range"]');
    if (linearScale) return 'linear_scale';

    // Check for grid/matrix questions
    const gridTable = element.querySelector('table');
    if (gridTable && element.querySelectorAll('input[type="radio"]').length > 4) {
      return 'grid';
    }

    // Check for rating
    const ratingInputs = element.querySelectorAll('[aria-label*="star"], [class*="star"]');
    if (ratingInputs.length > 0) return 'rating';

    return 'unknown';
  },

  // Extract options for choice-based questions
  extractOptions(element, type) {
    const options = [];

    if (type === 'multiple_choice' || type === 'checkbox') {
      // Google Forms: role="radio" or "checkbox"
      const roleInputs = element.querySelectorAll('[role="radio"], [role="checkbox"]');
      roleInputs.forEach(el => {
        const label = el.getAttribute('aria-label') || el.innerText?.trim();
        if (label) options.push(label);
      });

      // Generic: labels next to inputs
      if (options.length === 0) {
        const labels = element.querySelectorAll('label');
        labels.forEach(label => {
          const text = label.innerText?.trim();
          if (text && text.length < 100) options.push(text);
        });
      }

      // Generic: list items
      if (options.length === 0) {
        const listItems = element.querySelectorAll('li, .option, .choice');
        listItems.forEach(li => {
          const text = li.innerText?.trim();
          if (text && text.length < 100) options.push(text);
        });
      }
    }

    if (type === 'dropdown') {
      const optionsEl = element.querySelectorAll('option');
      optionsEl.forEach(opt => {
        const text = opt.innerText?.trim();
        if (text && text !== 'Choose...' && text !== 'Select...') {
          options.push(text);
        }
      });
    }

    if (type === 'linear_scale') {
      const input = element.querySelector('input[type="range"]');
      if (input) {
        const min = parseInt(input.min) || 1;
        const max = parseInt(input.max) || 5;
        for (let i = min; i <= max; i++) {
          options.push(i.toString());
        }
      }
    }

    if (type === 'grid') {
      const table = element.querySelector('table');
      if (table) {
        const headers = table.querySelectorAll('th');
        headers.forEach(th => {
          const text = th.innerText?.trim();
          if (text && text !== 'Question') options.push(text);
        });
      }
    }

    // Dedupe and clean
    return [...new Set(options.filter(o => o && o.length < 200))];
  },

  // Check if field is required
  isRequired(element) {
    // Google Forms asterisk
    if (element.innerText?.includes('*')) return true;

    // HTML required attribute
    if (element.querySelector('[required]')) return true;

    // ARIA required
    if (element.getAttribute('aria-required') === 'true') return true;

    // Google Forms specific
    if (element.innerHTML?.includes('aria-required="true"')) return true;

    return false;
  },

  // Get placeholder text
  getPlaceholder(element) {
    const input = element.querySelector('input, textarea, select');
    return input?.placeholder?.trim() || '';
  },

  // Get description/hint text
  getDescription(element) {
    // Google Forms description
    const descDiv = element.querySelector('[class*="description"]');
    if (descDiv) return descDiv.innerText.trim();

    // Generic helper text
    const helpText = element.querySelector('.help-text, .hint, [class*="hint"]');
    if (helpText) return helpText.innerText.trim();

    return '';
  },

  // Extract associated label
  extractLabel(element) {
    const input = element.querySelector('input, textarea, select');
    if (!input) return '';

    const id = input.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.innerText.trim();
    }

    return '';
  },

  // Extract form metadata
  extractMetadata(sections) {
    const allQuestions = sections.flatMap(s => s.questions);

    return {
      totalQuestions: allQuestions.length,
      questionTypes: this.countTypes(allQuestions),
      requiredCount: allQuestions.filter(q => q.required).length,
      optionalCount: allQuestions.filter(q => !q.required).length,
      hasMultiplePages: sections.length > 1,
      pageCount: sections.length
    };
  },

  // Count questions by type
  countTypes(questions) {
    const counts = {};
    questions.forEach(q => {
      counts[q.type] = (counts[q.type] || 0) + 1;
    });
    return counts;
  },

  // Helper: get text content
  getText(selector, context = document) {
    try {
      const el = context.querySelector(selector);
      return el?.innerText?.trim() || '';
    } catch {
      return '';
    }
  }
};

// Make available globally
window.AIFormReader = window.AIFormReader;