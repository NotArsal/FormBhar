// promptSanitizer.js - Security Defense against Prompt Injection Attacks for FormBhar

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/gi,
  /forget\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/gi,
  /system\s*:\s*/gi,
  /assistant\s*:\s*/gi,
  /user\s*:\s*/gi,
  /<\s*\|\s*im_start\s*\|\s*>/gi,
  /<\s*\|\s*im_end\s*\|\s*>/gi,
  /\[\s*inst\s*\]/gi,
  /\[\s*\/\s*inst\s*\]/gi,
  /override\s+system\s+prompt/gi,
  /you\s+are\s+now\s+a\s+/gi,
  /do\s+anything\s+now/gi,
  /jailbreak/gi,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:/gi,
  /\beval\s*\(/gi
];

export const PromptSanitizer = {
  /**
   * Sanitizes input strings before appending them to LLM prompts.
   * Strips adversarial injection directives, script tags, and prompt overlays.
   */
  sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';

    let clean = text;

    // 1. Remove dangerous script or code injection tags
    clean = clean.replace(/<[^>]*>/g, '');

    // 2. Strip prompt injection adversarial directives
    INJECTION_PATTERNS.forEach(pattern => {
      clean = clean.replace(pattern, '[sanitized_input]');
    });

    // 3. Normalize whitespace and trim
    return clean.trim();
  },

  /**
   * Sanitizes a question schema array before passing to AI provider.
   */
  sanitizeQuestions(questions) {
    if (!Array.isArray(questions)) return [];

    return questions.map(q => {
      const sanitized = { ...q };
      if (sanitized.questionText) {
        sanitized.questionText = this.sanitizeText(sanitized.questionText);
      }
      if (sanitized.description) {
        sanitized.description = this.sanitizeText(sanitized.description);
      }
      if (Array.isArray(sanitized.options)) {
        sanitized.options = sanitized.options.map(opt => this.sanitizeText(String(opt)));
      }
      return sanitized;
    });
  }
};
