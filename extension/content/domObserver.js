// domObserver.js - Observes forms and injects UI

// State management helpers using chrome.storage.local keyed by formId
function getFormId() {
    const match = window.location.href.match(/\/forms\/d\/e\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : 'default_form';
}

async function getFormState() {
    const formId = getFormId();
    const data = await chrome.storage.local.get([`form_${formId}`]);
    return data[`form_${formId}`] || { autofill_active: null, filled_questions: [], completed_auto: false };
}

async function updateFormState(updates) {
    const formId = getFormId();
    const state = await getFormState();
    const newState = { ...state, ...updates };
    await chrome.storage.local.set({ [`form_${formId}`]: newState });
}

async function clearFormState() {
    const formId = getFormId();
    await chrome.storage.local.remove([`form_${formId}`]);
}

// Shadow DOM overlay encapsulation orchestration
let shadowContainer = null;
let shadowRoot = null;

function getShadowRoot() {
    if (shadowContainer && !document.body.contains(shadowContainer)) {
        document.body.appendChild(shadowContainer);
    }
    if (shadowRoot) return shadowRoot;

    shadowContainer = document.createElement('div');
    shadowContainer.id = 'formbhar-shadow-host';
    shadowContainer.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10000;
        pointer-events: none;
        width: auto;
        height: auto;
        display: flex;
        flex-direction: column-reverse;
        align-items: flex-end;
    `;
    document.body.appendChild(shadowContainer);

    shadowRoot = shadowContainer.attachShadow({ mode: 'open' });

    // Inject fonts inside Shadow DOM for styling isolation
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap';
    shadowRoot.appendChild(link);

    // Create a container for the buttons inside the shadow root
    const container = document.createElement('div');
    container.className = 'button-container';
    container.style.cssText = `
        display: flex;
        flex-direction: column-reverse;
        align-items: flex-end;
        gap: 12px;
        pointer-events: none;
    `;
    shadowRoot.appendChild(container);

    return shadowRoot;
}

function getTextColor(id) {
    if (id === 'ai-autofill-btn') return '#0071e3'; // Apple Blue
    if (id === 'chatgpt-mode-btn' || id === 'paste-answers-btn') return '#10a37f'; // ChatGPT Green
    return '#1d1d1f'; // Apple charcoal
}

function getNormalShadow() {
    return '0 8px 30px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)';
}

function getHoverShadow() {
    return '0 12px 40px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
}

function createButton(id, text, bg, hoverBg, bottomPos, display = 'block', color = 'white') {
    // 1. Create wrapper
    const wrap = document.createElement('div');
    wrap.id = id;
    wrap.className = 'glass-button-wrap';
    wrap.style.cssText = `
        position: relative;
        display: ${display === 'none' ? 'none' : 'flex'};
        justify-content: center;
        align-items: center;
        border-radius: 9999px;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        width: auto;
        pointer-events: auto;
    `;

    // 2. Create inner button
    const btn = document.createElement('button');
    btn.className = 'glass-button';
    btn.style.cssText = `
        all: unset;
        box-sizing: border-box;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.82);
        color: ${getTextColor(id)};
        border: 1px solid rgba(0, 0, 0, 0.08);
        z-index: 2;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // 3. Create text span
    const span = document.createElement('span');
    span.className = 'glass-button-text';
    span.innerHTML = text;
    span.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 12px 24px;
        font-family: 'Outfit', -apple-system, system-ui, sans-serif;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        white-space: nowrap;
        user-select: none;
    `;
    btn.appendChild(span);

    // 4. Create shadow element
    const shadow = document.createElement('div');
    shadow.className = 'glass-button-shadow';
    shadow.style.cssText = `
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        background: rgba(0, 0, 0, 0.02);
        box-shadow: ${getNormalShadow()};
        z-index: 1;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
    `;

    wrap.appendChild(btn);
    wrap.appendChild(shadow);

    // Set up hover/active handlers on the wrap to animate both the button and shadow in sync!
    wrap.onmouseover = () => {
        btn.style.transform = 'translateY(-3px) scale(1.02)';
        btn.style.border = '1px solid rgba(0, 0, 0, 0.16)';
        btn.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        shadow.style.transform = 'translateY(1.5px) scale(1.025)';
        shadow.style.boxShadow = getHoverShadow();
        shadow.style.background = 'rgba(0, 0, 0, 0.04)';
    };
    wrap.onmouseout = () => {
        btn.style.transform = 'translateY(0) scale(1)';
        btn.style.border = '1px solid rgba(0, 0, 0, 0.08)';
        btn.style.backgroundColor = 'rgba(255, 255, 255, 0.82)';
        shadow.style.transform = 'translateY(0) scale(1)';
        shadow.style.boxShadow = getNormalShadow();
        shadow.style.background = 'rgba(0, 0, 0, 0.02)';
    };

    // Forward interface properties from wrapper to the button element
    Object.defineProperty(wrap, 'innerText', {
        get: () => btn.innerText,
        set: (val) => {
            const textSpan = btn.querySelector('.glass-button-text');
            if (textSpan) {
                textSpan.innerHTML = val;
            } else {
                btn.innerText = val;
            }
        }
    });

    Object.defineProperty(wrap, 'disabled', {
        get: () => btn.disabled,
        set: (val) => { btn.disabled = val; }
    });

    return wrap;
}

function createAutoFillButton() {
    const wrap = createButton('ai-autofill-btn', '✨ Auto-Fill with AI', '#1a73e8', '#1557b0', '24px');
    const btn = wrap.querySelector('button');
    btn.addEventListener('click', handleAutoFillClick);
    return wrap;
}

function createChatGPTModeButton() {
    const wrap = createButton('chatgpt-mode-btn', '💬 Use ChatGPT (No Quota)', '#10a37f', '#0e906f', '76px');
    const btn = wrap.querySelector('button');
    btn.addEventListener('click', handleChatGPTMode);
    return wrap;
}

function createFillProfileButton() {
    const wrap = createButton('fill-profile-btn', '👤 Fill Profile Data', '#6b7280', '#4b5563', '128px');
    const btn = wrap.querySelector('button');
    btn.addEventListener('click', handleFillProfile);
    return wrap;
}

function createPasteButton() {
    const wrap = createButton('paste-answers-btn', '📋 Paste Answers', '#fbbc04', '#e3a903', '76px', 'none', '#333');
    const btn = wrap.querySelector('button');
    btn.addEventListener('click', handlePasteAnswers);
    return wrap;
}

async function handleAutoFillClick() {
    const btn = getShadowRoot().getElementById('ai-autofill-btn');
    if (!btn) return;
    btn.innerText = '⏳ Processing...';
    btn.disabled = true;

    try {
        const formContext = window.AIFormReader.extractContext();
        console.log('Extracted Form Context:', formContext);

        // Request AI Generation
        const response = await chrome.runtime.sendMessage({
            action: 'GENERATE_ANSWERS',
            formContext
        });

        if (response.success && response.sessionId) {
            // Validate secure session before applying answers
            const validResponse = await chrome.runtime.sendMessage({
                action: 'VALIDATE_SESSION',
                sessionId: response.sessionId
            });

            if (validResponse.valid) {
                const answersResponse = await chrome.runtime.sendMessage({
                    action: 'GET_ANSWERS',
                    sessionId: response.sessionId
                });

                if (answersResponse.success) {
                    // Fetch profile context for fallback filling
                    const storageData = await chrome.storage.local.get(['profile']);

                    await window.AIFormFiller.fillData(answersResponse.answers, storageData.profile || {});

                    btn.innerText = '✅ Autofilled!';
                    
                    // Save filled questions to storage for multi-page auto-triggering
                    try {
                        const filledQuestions = formContext.sections.flatMap(s => s.questions).map(q => q.questionText);
                        const state = await getFormState();
                        const storedFilled = [...new Set([...state.filled_questions, ...filledQuestions])];
                        await updateFormState({ filled_questions: storedFilled, autofill_active: 'ai' });
                    } catch (e) {
                        console.warn('Error saving to storage:', e);
                    }
                } else {
                    throw new Error('Failed to get answers from storage');
                }
            } else {
                throw new Error('Session validation failed: ' + validResponse.reason);
            }
        } else {
            throw new Error(response.error || 'Generation failed');
        }
    } catch (error) {
        console.error('AI Form Filler Error:', error);
        btn.innerText = '❌ Error';
        alert('AI Fill Error: ' + error.message);
    } finally {
        setTimeout(() => {
            btn.innerText = '✨ Auto-Fill with AI';
            btn.disabled = false;
        }, 3000);
    }
}

// ===== NO QUOTA (MANUAL) MODE LOGIC =====
let extractedQuestionsForNoQuota = [];

async function handleChatGPTMode() {
    const btn = getShadowRoot().getElementById('chatgpt-mode-btn');
    if (!btn) return;
    try {
        btn.innerText = '⏳ Extracting...';
        const formContext = window.AIFormReader.extractContext();
        const sections = formContext.sections || [];
        const allQuestions = sections.flatMap(s => s.questions || []);
        
        // Filter out file uploads, grids/matrices, and unknown types
        extractedQuestionsForNoQuota = allQuestions.filter(q => !['file', 'grid', 'unknown'].includes(q.type));

        if (extractedQuestionsForNoQuota.length === 0) {
            alert('❌ No fillable questions found to copy.');
            btn.innerText = '💬 Use ChatGPT (No Quota)';
            return;
        }

        let prompt = `Answer these ${extractedQuestionsForNoQuota.length} questions. For multiple choice, checkbox, or dropdown questions, respond ONLY with the option letter (e.g. A, B, etc.) or letters (e.g. A, C). For short answer or paragraph questions, provide the actual answer text. Keep text answers realistic and concise.\n\nRespond strictly in this format:\n1. [Answer for Q1]\n2. [Answer for Q2]\n...\n\nQUESTIONS:\n`;

        extractedQuestionsForNoQuota.forEach((q, index) => {
            prompt += `${index + 1}. ${q.questionText} (Type: ${q.typeName})\n`;
            if (q.options && q.options.length > 0) {
                q.options.forEach((opt, optIndex) => {
                    const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
                    prompt += `   ${letter}) ${opt}\n`;
                });
            }
            prompt += '\n';
        });

        prompt += `\nRemember: Respond strictly in the numbered list format with only the values:
1. [Answer 1]
2. [Answer 2]
...`;

        try {
            await navigator.clipboard.writeText(prompt);
            btn.innerText = '✅ Copied!';

            // Swap buttons
            setTimeout(() => {
                btn.style.display = 'none';
                const pasteBtn = getShadowRoot().getElementById('paste-answers-btn');
                if (pasteBtn) pasteBtn.style.display = 'block';
                window.open('https://chatgpt.com', '_blank');
            }, 1000);

        } catch (err) {
            console.error('Clipboard error:', err);
            alert('⚠️ Could not copy to clipboard. Please allow clipboard access.');
            btn.innerText = '💬 Use ChatGPT (No Quota)';
        }
    } catch (error) {
        console.error('Error in ChatGPT mode:', error);
        alert('❌ An error occurred. Check console for details.');
        btn.innerText = '💬 Use ChatGPT (No Quota)';
    }
}

async function handleFillProfile() {
    const btn = getShadowRoot().getElementById('fill-profile-btn');
    if (!btn) return;
    btn.innerText = '⏳ Filling...';
    try {
        const storageData = await chrome.storage.local.get(['profile']);
        if (!storageData.profile) {
            alert('⚠️ No profile data found. Please set your Name, Roll No, etc., in the extension popup.');
            btn.innerText = '👤 Fill Profile Data';
            return;
        }

        // Pass an empty array for answers so it ONLY triggers the profile fallback matches
        await window.AIFormFiller.fillData([], storageData.profile);

        btn.innerText = '✅ Profile Filled!';
        
        // Save filled questions to storage for multi-page auto-triggering
        try {
            const formContext = window.AIFormReader.extractContext();
            const filledQuestions = formContext.sections.flatMap(s => s.questions).map(q => q.questionText);
            const state = await getFormState();
            const storedFilled = [...new Set([...state.filled_questions, ...filledQuestions])];
            await updateFormState({ filled_questions: storedFilled, autofill_active: 'profile' });
        } catch (e) {
            console.warn('Error saving to storage:', e);
        }
        setTimeout(() => {
            btn.innerText = '👤 Fill Profile Data';
        }, 3000);
    } catch (error) {
        console.error('Error filling profile:', error);
        btn.innerText = '❌ Error';
    }
}

async function handlePasteAnswers() {
    const btn = getShadowRoot().getElementById('paste-answers-btn');
    if (!btn) return;
    btn.innerText = '⏳ Reading...';

    try {
        let clipboardText;
        try {
            clipboardText = await navigator.clipboard.readText();
        } catch (err) {
            clipboardText = prompt("Paste ChatGPT's answers here:");
            if (!clipboardText) {
                btn.innerText = '📋 Paste Answers';
                return;
            }
        }

        // Block accidental pastes of the generated prompt instructions
        if (clipboardText.includes('Respond ONLY with the option letter') || clipboardText.includes('Format your response as:') || clipboardText.includes('Respond strictly in this format:')) {
            alert("❌ You pasted the copied questions instead of ChatGPT's answers!\n\nPlease paste the questions INTO ChatGPT, wait for its response, copy the response, then click Paste Answers.");
            btn.innerText = '📋 Paste Answers';
            return;
        }

        const lines = clipboardText.split('\n');
        const mappedAnswers = [];
        let validAnswersCount = 0;

        // Iterate exactly through the questions we expect to answer
        for (let i = 0; i < extractedQuestionsForNoQuota.length; i++) {
            const qNum = i + 1;

            // Match line that starts with exactly "qNum. " or "qNum) " followed by the answer value
            const regex = new RegExp(`^\\s*${qNum}[\\.\\)]\\s*(.*)$`);

            let foundValue = null;
            for (const line of lines) {
                const match = line.match(regex);
                if (match) {
                    foundValue = match[1].trim();
                    break;
                }
            }

            if (foundValue) {
                const q = extractedQuestionsForNoQuota[i];
                if (['multiple_choice', 'checkbox', 'dropdown'].includes(q.type) && q.options && q.options.length > 0) {
                    // Check if it's an option letter or comma-separated option letters
                    const letterMatch = foundValue.match(/^([A-Z\s,]+)$/i);
                    if (letterMatch) {
                        const letters = letterMatch[1].split(',').map(l => l.trim().toUpperCase());
                        const selectedValues = [];
                        letters.forEach(letter => {
                            const optionIndex = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
                            if (optionIndex >= 0 && optionIndex < q.options.length) {
                                selectedValues.push(q.options[optionIndex]);
                            }
                        });
                        if (selectedValues.length > 0) {
                            mappedAnswers.push({
                                questionText: q.questionText,
                                value: q.type === 'checkbox' ? selectedValues : selectedValues[0]
                            });
                            validAnswersCount++;
                        }
                    } else {
                        // Fallback: match by option text value
                        const matchedOpt = q.options.find(opt => 
                            opt.toLowerCase() === foundValue.toLowerCase() || 
                            opt.toLowerCase().includes(foundValue.toLowerCase())
                        );
                        if (matchedOpt) {
                            mappedAnswers.push({
                                questionText: q.questionText,
                                value: matchedOpt
                            });
                            validAnswersCount++;
                        }
                    }
                } else {
                    // Text-based inputs, dates, etc.
                    mappedAnswers.push({
                        questionText: q.questionText,
                        value: foundValue
                    });
                    validAnswersCount++;
                }
            }
        }

        if (validAnswersCount === 0) {
            alert("❌ No valid answers found. Make sure you copied ChatGPT's response.\n\nExpected format:\n1. Answer for Q1\n2. Answer for Q2");
            btn.innerText = '📋 Paste Answers';
            return;
        }

        // Fetch profile context for fallback filling
        const storageData = await chrome.storage.local.get(['profile']);
        await window.AIFormFiller.fillData(mappedAnswers, storageData.profile || {});

        btn.innerText = '✅ Filled!';

        // Swap back to ChatGPT button
        setTimeout(() => {
            btn.style.display = 'none';
            btn.innerText = '📋 Paste Answers';
            const chatGptBtn = getShadowRoot().getElementById('chatgpt-mode-btn');
            if (chatGptBtn) chatGptBtn.style.display = 'block';
            chatGptBtn.innerText = '💬 Use ChatGPT (No Quota)';
        }, 3000);

    } catch (error) {
        console.error('Error pasting answers:', error);
        alert('❌ An error occurred. Check console for details.');
        btn.innerText = '📋 Paste Answers';
    }
}

async function checkAndTriggerAutonomousFill() {
    try {
        const storage = await chrome.storage.local.get(['autonomousMode', 'profile', 'aiProvider', 'geminiApiKey', 'openaiApiKey', 'claudeApiKey']);
        if (storage.autonomousMode !== true) return;

        // Skip on submission confirmation page
        if (window.location.href.includes('/formResponse') && !document.querySelector('form')) return;

        const state = await getFormState();
        if (state.completed_auto) {
            console.log('Autonomous fill already completed on this load.');
            return;
        }

        // Extract questions context
        const formContext = window.AIFormReader.extractContext();
        const questionCount = formContext.sections.flatMap(s => s.questions).length;
        if (questionCount === 0) return;

        // Set key to avoid double-filling
        await updateFormState({ completed_auto: true });
        console.log('Autonomous Mode Active: automatically filling form details...');

        // Determine if there is any valid AI provider API key configured
        const currentProvider = storage.aiProvider || 'gemini';
        let keyConfigured = false;
        if (currentProvider === 'gemini' && storage.geminiApiKey) keyConfigured = true;
        if (currentProvider === 'openai' && storage.openaiApiKey) keyConfigured = true;
        if (currentProvider === 'claude' && storage.claudeApiKey) keyConfigured = true;

        if (keyConfigured) {
            console.log('Autofilling autonomously using ' + currentProvider + '...');
            handleAutoFillClick();
        } else {
            console.log('No API key configured. Autofilling autonomously using Profile fallback...');
            handleFillProfile();
        }
    } catch (e) {
        console.warn('Autonomous filling skipped:', e);
    }
}

function initDOMObserver() {
    // If we are on the form submission confirmation page (no form element present), clear storage
    if (window.location.href.includes('/formResponse') && !document.querySelector('form')) {
        clearFormState();
        return;
    }
    function injectButtons() {
        const root = getShadowRoot();
        const container = root.querySelector('.button-container');
        if (!container) return;

        if (!root.getElementById('ai-autofill-btn')) {
            container.appendChild(createAutoFillButton());
        }
        if (!root.getElementById('chatgpt-mode-btn')) {
            container.appendChild(createChatGPTModeButton());
        }
        if (!root.getElementById('fill-profile-btn')) {
            container.appendChild(createFillProfileButton());
        }
        if (!root.getElementById('paste-answers-btn')) {
            container.appendChild(createPasteButton());
        }
    }

    injectButtons();
    
    // Check and trigger autonomous fill on startup after letting the form render
    setTimeout(() => {
        checkAndTriggerAutonomousFill();
    }, 1000);

    let pageChangeTriggerTimeout = null;

    // Observe for dynamic page changes (e.g. Next Page in multi-page form)
    const observer = new MutationObserver(() => {
        if (pageChangeTriggerTimeout) {
            clearTimeout(pageChangeTriggerTimeout);
        }
        pageChangeTriggerTimeout = setTimeout(async () => {
            try {
                const state = await getFormState();
                const mode = state.autofill_active;
                if (mode) {
                    const formContext = window.AIFormReader.extractContext();
                    const currentQuestions = formContext.sections.flatMap(s => s.questions).map(q => q.questionText);
                    const storedFilled = state.filled_questions || [];
                    
                    const hasNewUnfilledQuestions = currentQuestions.some(qText => !storedFilled.includes(qText));
                    
                    if (hasNewUnfilledQuestions && currentQuestions.length > 0) {
                        if (mode === 'ai') {
                            const btn = getShadowRoot().getElementById('ai-autofill-btn');
                            if (btn && !btn.disabled) {
                                console.log('Auto-filling next page with AI after settling...');
                                handleAutoFillClick();
                            }
                        } else if (mode === 'profile') {
                            const btn = getShadowRoot().getElementById('fill-profile-btn');
                            if (btn && !btn.disabled) {
                                console.log('Auto-filling next page with Profile after settling...');
                                handleFillProfile();
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Error auto-triggering fill on page change:', e);
            }
        }, 600); // 600ms settling time for lazy-loaded content
        injectButtons();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Ensure the page is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOMObserver);
} else {
    initDOMObserver();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TRIGGER_AUTO_FILL') { handleAutoFillClick().then(() => sendResponse({success: true})).catch(e => sendResponse({success: false, error: e.message})); return true; }
  if (request.action === 'TRIGGER_PROFILE_FILL') { handleFillProfile().then(() => sendResponse({success: true})).catch(e => sendResponse({success: false, error: e.message})); return true; }
  if (request.action === 'EXTRACT_USER_INFO') {
    const userInfo = {};
    try {
      const context = window.AIFormReader.extractContext();
      const allQuestions = context.sections.flatMap(s => s.questions);
      allQuestions.forEach(q => {
        const qLower = q.questionText.toLowerCase();
        let value = '';
        if (['short_answer', 'email', 'number', 'tel'].includes(q.type)) {
          value = q._elementRef?.querySelector('input')?.value || '';
        }
        if (value) {
          if (qLower.match(/(name|full.?name|first.?name|last.?name)/) && !userInfo.name) userInfo.name = value;
          if (qLower.match(/(email|mail|e-mail|mail.?id)/) && !userInfo.email) userInfo.email = value;
          if (qLower.match(/(phone|mobile|cell|tel|contact|whatsapp)/) && !userInfo.phone) userInfo.phone = value;
          if (qLower.match(/(roll|roll.?no|roll.?number|student.?id|reg.?no|prn)/) && !userInfo.rollNo) userInfo.rollNo = value;
          if (qLower.match(/(dept|department|branch)/) && !userInfo.department) userInfo.department = value;
          if (qLower.match(/(class|year|semester|section|batch)/) && !userInfo.classYear) userInfo.classYear = value;
        }
      });
    } catch (e) {
      console.warn("Could not extract user info", e);
    }
    sendResponse({userInfo});
    return false;
  }
});
