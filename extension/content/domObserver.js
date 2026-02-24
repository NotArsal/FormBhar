// domObserver.js - Observes forms and injects UI

function createAutoFillButton() {
    const btn = document.createElement('button');
    btn.id = 'ai-autofill-btn';
    btn.innerHTML = '✨ Auto-Fill with AI';
    btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 10000;
    padding: 12px 24px;
    background-color: #1a73e8;
    color: white;
    border: none;
    border-radius: 24px;
    font-size: 16px;
    font-family: Google Sans, Roboto, sans-serif;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    cursor: pointer;
    transition: background 0.3s, transform 0.2s;
  `;

    btn.onmouseover = () => {
        btn.style.backgroundColor = '#1557b0';
        btn.style.transform = 'translateY(-2px)';
    };
    btn.onmouseout = () => {
        btn.style.backgroundColor = '#1a73e8';
        btn.style.transform = 'translateY(0)';
    };

    btn.addEventListener('click', handleAutoFillClick);
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

function initDOMObserver() {
    // Inject button if not present
    if (!document.getElementById('ai-autofill-btn')) {
        document.body.appendChild(createAutoFillButton());
    }

    // Observe for dynamic page changes (e.g. Next Page in multi-page form)
    const observer = new MutationObserver(() => {
        if (!document.getElementById('ai-autofill-btn')) {
            document.body.appendChild(createAutoFillButton());
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Ensure the page is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOMObserver);
} else {
    initDOMObserver();
}
