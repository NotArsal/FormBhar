// domObserver.js - Observes forms and injects UI

function createButton(id, text, bg, hoverBg, bottomPos, display = 'block', color = 'white') {
    const btn = document.createElement('button');
    btn.id = id;
    btn.innerHTML = text;
    btn.style.cssText = `
        position: fixed;
        bottom: ${bottomPos};
        right: 24px;
        z-index: 10000;
        padding: 12px 24px;
        background-color: ${bg};
        color: ${color};
        border: none;
        border-radius: 24px;
        font-size: 16px;
        font-family: Google Sans, Roboto, sans-serif;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        cursor: pointer;
        transition: background 0.3s, transform 0.2s;
        display: ${display};
    `;

    btn.onmouseover = () => {
        btn.style.backgroundColor = hoverBg;
        btn.style.transform = 'translateY(-2px)';
    };
    btn.onmouseout = () => {
        btn.style.backgroundColor = bg;
        btn.style.transform = 'translateY(0)';
    };
    return btn;
}

function createAutoFillButton() {
    const btn = createButton('ai-autofill-btn', '✨ Auto-Fill with AI', '#1a73e8', '#1557b0', '24px');
    btn.addEventListener('click', handleAutoFillClick);
    return btn;
}

function createChatGPTModeButton() {
    const btn = createButton('chatgpt-mode-btn', '💬 Use ChatGPT (No Quota)', '#10a37f', '#0e906f', '76px');
    btn.addEventListener('click', handleChatGPTMode);
    return btn;
}

function createFillProfileButton() {
    const btn = createButton('fill-profile-btn', '👤 Fill Profile Data', '#6b7280', '#4b5563', '128px');
    btn.addEventListener('click', handleFillProfile);
    return btn;
}

function createPasteButton() {
    const btn = createButton('paste-answers-btn', '📋 Paste Answers', '#fbbc04', '#e3a903', '76px', 'none', '#333');
    btn.addEventListener('click', handlePasteAnswers);
    return btn;
}

async function handleAutoFillClick() {
    const btn = document.getElementById('ai-autofill-btn');
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
    const btn = document.getElementById('chatgpt-mode-btn');
    try {
        btn.innerText = '⏳ Extracting...';
        const formContext = window.AIFormReader.extractContext();
        extractedQuestionsForNoQuota = formContext.sections[0].questions.filter(q => q.type === 'multiple_choice' || q.type === 'checkbox');

        if (extractedQuestionsForNoQuota.length === 0) {
            alert('❌ No Multiple Choice/Checkbox questions found to copy.');
            btn.innerText = '💬 Use ChatGPT (No Quota)';
            return;
        }

        let prompt = `Answer these ${extractedQuestionsForNoQuota.length} multiple choice questions. Respond ONLY with the option letter for each question.\n\nFormat your response as:\n1. A\n2. B\n3. C\n...\n\n`;

        extractedQuestionsForNoQuota.forEach((q, index) => {
            prompt += `${index + 1}. ${q.questionText}\n`;
            q.options.forEach((opt, optIndex) => {
                const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
                prompt += `   ${letter}) ${opt}\n`;
            });
            prompt += '\n';
        });

        prompt += `\nRemember: Respond with ONLY the answer letters in the format:\n1. A\n2. B\n3. C\n...`;

        try {
            await navigator.clipboard.writeText(prompt);
            btn.innerText = '✅ Copied!';

            // Swap buttons
            setTimeout(() => {
                btn.style.display = 'none';
                const pasteBtn = document.getElementById('paste-answers-btn');
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
    const btn = document.getElementById('fill-profile-btn');
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
        setTimeout(() => {
            btn.innerText = '👤 Fill Profile Data';
        }, 3000);
    } catch (error) {
        console.error('Error filling profile:', error);
        btn.innerText = '❌ Error';
    }
}

async function handlePasteAnswers() {
    const btn = document.getElementById('paste-answers-btn');
    btn.innerText = '⏳ Reading...';

    try {
        let clipboardText;
        try {
            clipboardText = await navigator.clipboard.readText();
        } catch (err) {
            clipboardText = prompt("Paste ChatGPT's answers here (e.g., 1. A, 2. B):");
            if (!clipboardText) {
                btn.innerText = '📋 Paste Answers';
                return;
            }
        }

        // Block accidental pastes of the generated prompt instructions
        if (clipboardText.includes('Respond ONLY with the option letter') || clipboardText.includes('Format your response as:')) {
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

            // Strictly match line that starts with exactly "qNum. A" or "qNum) B"
            // \s* matches optional whitespace before/after
            // ^ and $ ensure it's a standalone answer, not inside a sentence
            const regex = new RegExp(`^\\s*${qNum}[\\.\\)]\\s*([A-D])\\s*$`, 'i');

            let foundLetter = null;
            for (const line of lines) {
                const match = line.match(regex);
                if (match) {
                    foundLetter = match[1].toUpperCase();
                    break;
                }
            }

            if (foundLetter) {
                const q = extractedQuestionsForNoQuota[i];
                const optionIndex = foundLetter.charCodeAt(0) - 65; // A=0, B=1, etc.
                if (optionIndex >= 0 && optionIndex < q.options.length) {
                    mappedAnswers.push({
                        questionText: q.questionText,
                        value: q.options[optionIndex]
                    });
                    validAnswersCount++;
                }
            }
        }

        if (validAnswersCount === 0) {
            alert("❌ No valid answers found. Make sure you copied ChatGPT's response.\n\nExpected format:\n1. A\n2. B\n3. C");
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
            const chatGptBtn = document.getElementById('chatgpt-mode-btn');
            if (chatGptBtn) chatGptBtn.style.display = 'block';
            chatGptBtn.innerText = '💬 Use ChatGPT (No Quota)';
        }, 3000);

    } catch (error) {
        console.error('Error pasting answers:', error);
        alert('❌ An error occurred. Check console for details.');
        btn.innerText = '📋 Paste Answers';
    }
}

function initDOMObserver() {
    function injectButtons() {
        if (!document.getElementById('ai-autofill-btn')) {
            document.body.appendChild(createAutoFillButton());
        }
        if (!document.getElementById('chatgpt-mode-btn')) {
            document.body.appendChild(createChatGPTModeButton());
        }
        if (!document.getElementById('fill-profile-btn')) {
            document.body.appendChild(createFillProfileButton());
        }
        if (!document.getElementById('paste-answers-btn')) {
            document.body.appendChild(createPasteButton());
        }
    }

    injectButtons();

    // Observe for dynamic page changes (e.g. Next Page in multi-page form)
    const observer = new MutationObserver(() => {
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
          if (qLower.match(/(phone|mobile|cell|tel|contact.?no)/) && !userInfo.phone) userInfo.phone = value;
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
