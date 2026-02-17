// Content script for Google Forms Auto-Filler
// This script runs on all Google Forms pages

// Check if we're on a Google Form
function isGoogleForm() {
    return window.location.href.includes('docs.google.com/forms');
}

// Inject the floating buttons
function injectButton() {
    // Avoid duplicate buttons
    if (document.getElementById('ai-autofill-btn')) {
        return;
    }

    // Main AI button (uses Gemini API)
    const button = document.createElement('button');
    button.id = 'ai-autofill-btn';
    button.innerHTML = '🤖 Auto Fill with AI';
    button.addEventListener('click', handleAutoFill);
    document.body.appendChild(button);

    // ChatGPT mode button (no API needed)
    const chatGPTButton = document.createElement('button');
    chatGPTButton.id = 'chatgpt-mode-btn';
    chatGPTButton.innerHTML = '💬 Use ChatGPT (No Quota)';
    chatGPTButton.addEventListener('click', handleChatGPTMode);
    document.body.appendChild(chatGPTButton);

    // Paste answers button (hidden initially)
    const pasteButton = document.createElement('button');
    pasteButton.id = 'paste-answers-btn';
    pasteButton.innerHTML = '📋 Paste Answers';
    pasteButton.style.display = 'none';
    pasteButton.addEventListener('click', handlePasteAnswers);
    document.body.appendChild(pasteButton);

    // Create status indicator
    const statusDiv = document.createElement('div');
    statusDiv.id = 'ai-status-indicator';
    document.body.appendChild(statusDiv);
}

// Show status message
function showStatus(message, icon = '⏳') {
    const statusDiv = document.getElementById('ai-status-indicator');
    if (statusDiv) {
        statusDiv.innerHTML = `<span class="status-icon">${icon}</span><span class="status-text">${message}</span>`;
        statusDiv.classList.add('show');
    }
}

// Hide status message
function hideStatus() {
    const statusDiv = document.getElementById('ai-status-indicator');
    if (statusDiv) {
        statusDiv.classList.remove('show');
    }
}

// Update button state
function updateButtonState(state) {
    const button = document.getElementById('ai-autofill-btn');
    if (!button) return;

    button.className = '';

    switch (state) {
        case 'processing':
            button.classList.add('processing');
            button.innerHTML = '⏳ Processing...';
            button.disabled = true;
            break;
        case 'complete':
            button.classList.add('complete');
            button.innerHTML = '✅ Complete';
            button.disabled = false;
            break;
        default:
            button.innerHTML = '🤖 Auto Fill with AI';
            button.disabled = false;
    }
}

// Extract all questions from the form
function extractQuestions() {
    const questions = [];

    // Google Forms uses role="listitem" for each question container
    const questionContainers = document.querySelectorAll('[role="listitem"]');

    console.log(`Found ${questionContainers.length} question containers`);

    questionContainers.forEach((container, index) => {
        try {
            // Extract question text
            const questionTextElement = container.querySelector('[role="heading"]');
            if (!questionTextElement) {
                return;
            }

            const questionText = questionTextElement.textContent.trim();
            if (!questionText) {
                console.log(`Container ${index}: Empty question text`);
                return;
            }

            console.log(`Container ${index}: "${questionText}"`);

            // Check if it's a multiple choice question - try multiple selectors
            let radioGroup = container.querySelector('[role="radiogroup"]');

            // Alternative: Look for radio inputs directly
            if (!radioGroup) {
                const radioInputs = container.querySelectorAll('input[type="radio"]');
                if (radioInputs.length > 0) {
                    console.log(`Container ${index}: Found ${radioInputs.length} radio inputs (no radiogroup)`);
                    // Create options from radio inputs
                    const options = [];
                    radioInputs.forEach(radio => {
                        // Get label text associated with radio button
                        const label = radio.closest('label') || radio.parentElement.querySelector('label');
                        const optionText = label ? label.textContent.trim() : radio.value;
                        if (optionText) {
                            options.push({
                                text: optionText,
                                element: radio
                            });
                        }
                    });

                    if (options.length > 0) {
                        questions.push({
                            type: 'multiple_choice',
                            question: questionText,
                            options: options,
                            container: container,
                            index: index
                        });
                        console.log(`Container ${index}: Added as MCQ with ${options.length} options`);
                        return;
                    }
                }
            }

            if (radioGroup) {
                console.log(`Container ${index}: Found radiogroup`);
                // Extract all options
                const options = [];
                const radioButtons = radioGroup.querySelectorAll('[role="radio"]');

                console.log(`Container ${index}: Found ${radioButtons.length} radio buttons`);

                radioButtons.forEach((radio, radioIndex) => {
                    // Try multiple ways to get option text
                    let optionText = '';

                    // Method 1: Direct textContent
                    optionText = radio.textContent.trim();

                    // Method 2: aria-label attribute
                    if (!optionText) {
                        optionText = radio.getAttribute('aria-label') || '';
                    }

                    // Method 3: data-value or value attribute
                    if (!optionText) {
                        optionText = radio.getAttribute('data-value') || radio.getAttribute('value') || '';
                    }

                    // Method 4: Look for span/div inside
                    if (!optionText) {
                        const innerSpan = radio.querySelector('span') || radio.querySelector('div');
                        if (innerSpan) {
                            optionText = innerSpan.textContent.trim();
                        }
                    }

                    // Method 5: Look for label sibling or parent
                    if (!optionText) {
                        const label = radio.closest('label') || radio.parentElement.querySelector('label');
                        if (label) {
                            optionText = label.textContent.trim();
                        }
                    }

                    // Method 6: Get all text from parent container
                    if (!optionText) {
                        const parent = radio.parentElement;
                        if (parent) {
                            optionText = parent.textContent.trim();
                        }
                    }

                    console.log(`  Radio ${radioIndex}: "${optionText}"`);

                    if (optionText) {
                        options.push({
                            text: optionText,
                            element: radio
                        });
                    }
                });

                if (options.length > 0) {
                    questions.push({
                        type: 'multiple_choice',
                        question: questionText,
                        options: options,
                        container: container,
                        index: index
                    });
                    console.log(`Container ${index}: Added as MCQ with ${options.length} options`);
                } else {
                    console.log(`Container ${index}: Radiogroup found but no options extracted`);
                    // Log the HTML structure for debugging
                    console.log(`Container ${index} HTML:`, radioGroup.innerHTML.substring(0, 500));
                }
            } else {
                // Check for short answer text field
                const textInput = container.querySelector('input[type="text"]');
                const textArea = container.querySelector('textarea');

                if (textInput || textArea) {
                    console.log(`Container ${index}: Found text input/textarea - SKIPPING`);
                    questions.push({
                        type: 'short_answer',
                        question: questionText,
                        inputElement: textInput || textArea,
                        container: container,
                        index: index
                    });
                } else {
                    console.log(`Container ${index}: No MCQ or text input found`);
                }
            }
        } catch (error) {
            console.error(`Error extracting question ${index}:`, error);
        }
    });

    console.log(`Total questions extracted: ${questions.length}`);
    console.log(`MCQs: ${questions.filter(q => q.type === 'multiple_choice').length}`);
    console.log(`Text fields: ${questions.filter(q => q.type === 'short_answer').length}`);

    return questions;
}

// Check if question matches constant fields
function getConstantAnswer(questionText, constants) {
    const lowerQuestion = questionText.toLowerCase();

    // Check for name
    if (constants.userName && (
        lowerQuestion.includes('name') ||
        lowerQuestion.includes('full name') ||
        lowerQuestion.includes('your name')
    )) {
        return constants.userName;
    }

    // Check for email
    if (constants.userEmail && (
        lowerQuestion.includes('email') ||
        lowerQuestion.includes('e-mail') ||
        lowerQuestion.includes('mail')
    )) {
        return constants.userEmail;
    }

    // Check for roll number / ID
    if (constants.rollNumber && (
        lowerQuestion.includes('roll') ||
        lowerQuestion.includes('id') ||
        lowerQuestion.includes('student id') ||
        lowerQuestion.includes('registration')
    )) {
        return constants.rollNumber;
    }

    return null;
}

// Main auto-fill handler
async function handleAutoFill() {
    try {
        // Get settings from storage (API key is now optional due to hardcoded fallback)
        const settings = await chrome.storage.local.get(['apiKey', 'userName', 'userEmail', 'rollNumber']);

        updateButtonState('processing');
        showStatus('Extracting questions...', '🔍');

        // Extract all questions
        const questions = extractQuestions();

        if (questions.length === 0) {
            alert('❌ No questions found on this form. Make sure the form is fully loaded.');
            updateButtonState('default');
            hideStatus();
            return;
        }

        console.log(`Found ${questions.length} questions`);
        showStatus(`Found ${questions.length} questions. Getting AI answers...`, '🤖');

        // Batch processing: Track MCQs processed
        let mcqsProcessed = 0;
        const BATCH_SIZE = 5;
        const PAUSE_DURATION = 60; // seconds

        // Process each question
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            showStatus(`Processing question ${i + 1}/${questions.length}...`, '🤖');

            // Check if it's a constant field
            const constantAnswer = getConstantAnswer(question.question, settings);

            if (constantAnswer) {
                // Only fill constants for MCQs, skip text fields
                if (question.type === 'multiple_choice') {
                    // Try to find matching option
                    const matchingOption = question.options.find(opt =>
                        opt.text.toLowerCase().includes(constantAnswer.toLowerCase())
                    );
                    if (matchingOption) {
                        selectRadioButton(matchingOption.element);
                        console.log(`Filled constant: ${question.question} = ${constantAnswer}`);
                    }
                }
                // Skip short_answer types entirely
            } else {
                // Only get AI answer for MCQs, skip text fields
                if (question.type === 'multiple_choice') {
                    try {
                        const answer = await getAIAnswer(question, settings.apiKey);

                        if (answer) {
                            // Find and select the matching option
                            const selectedOption = selectBestOption(question.options, answer);
                            if (selectedOption) {
                                selectRadioButton(selectedOption.element);
                                console.log(`Selected: ${selectedOption.text}`);
                                mcqsProcessed++;
                            }
                        }
                    } catch (error) {
                        console.error(`Error getting AI answer for question ${i + 1}:`, error);

                        // Handle missing API key
                        if (error.message.includes('API key not set')) {
                            alert('⚠️ API Key is missing! Please click the extension icon and enter your Gemini API Key in the settings.');
                            updateButtonState('default');
                            hideStatus();
                            return;
                        }

                        // If rate limit/quota error, handle intelligently
                        if (error.message.includes('quota') || error.message.includes('rate limit')) {
                            // Extract retry time from error message (e.g., "Please retry in 55.763s")
                            const retryMatch = error.message.match(/retry in ([\d.]+)s/);
                            let retrySeconds = PAUSE_DURATION;

                            if (retryMatch) {
                                retrySeconds = Math.ceil(parseFloat(retryMatch[1])) + 5; // Add 5s buffer
                            }

                            // Check if we're in an infinite retry loop (same question failing repeatedly)
                            if (!question.retryCount) {
                                question.retryCount = 0;
                            }
                            question.retryCount++;

                            if (question.retryCount > 3) {
                                // Too many retries for this question - quota likely exhausted for extended period
                                console.error(`Question ${i + 1} failed ${question.retryCount} times. Quota may be exhausted.`);
                                showStatus(`❌ API quota exhausted. Filled ${mcqsProcessed} MCQs. Please wait 10 minutes and try again.`, '❌');
                                updateButtonState('default');

                                alert(`⚠️ API Quota Exhausted!\n\nSuccessfully filled: ${mcqsProcessed} MCQs\nRemaining: ${questions.filter((q, idx) => idx > i && q.type === 'multiple_choice').length} MCQs\n\nPlease wait 10 minutes for quota to reset, then:\n1. Refresh the page\n2. Click "Auto Fill with AI" again\n3. Extension will continue from where it left off`);

                                return; // Stop processing
                            }

                            console.log(`Rate limit hit after ${mcqsProcessed} MCQs. Waiting ${retrySeconds} seconds before retry...`);

                            // Show countdown with retry info
                            for (let countdown = retrySeconds; countdown > 0; countdown--) {
                                showStatus(`⏸️ Quota limit. Retry ${question.retryCount}/3. Waiting ${countdown}s... (Filled ${mcqsProcessed})`, '⏸️');
                                await sleep(1000);
                            }

                            console.log(`Retrying question ${i + 1}...`);

                            // Retry this question
                            i--;
                            continue;
                        }
                    }
                } else {
                    // Skip text fields
                    console.log(`Skipped text field: ${question.question}`);
                }
            }

            // Batch pause: After every BATCH_SIZE MCQs, pause to avoid rate limit
            if (mcqsProcessed > 0 && mcqsProcessed % BATCH_SIZE === 0) {
                const remainingQuestions = questions.length - i - 1;
                const remainingMCQs = questions.slice(i + 1).filter(q => q.type === 'multiple_choice').length;

                if (remainingMCQs > 0) {
                    console.log(`Processed ${mcqsProcessed} MCQs. Pausing for ${PAUSE_DURATION} seconds to avoid rate limit...`);

                    // Show countdown
                    for (let countdown = PAUSE_DURATION; countdown > 0; countdown--) {
                        showStatus(`⏸️ Batch pause (${mcqsProcessed} filled). Resuming in ${countdown}s...`, '⏸️');
                        await sleep(1000);
                    }

                    console.log('Resuming batch processing...');
                }
            }

            // Small delay between questions
            await sleep(500);
        }

        updateButtonState('complete');
        showStatus('✅ Complete! Please review answers before submitting.', '✅');

        // Hide status after 5 seconds
        setTimeout(() => {
            hideStatus();
        }, 5000);

    } catch (error) {
        console.error('Error in auto-fill:', error);
        alert('❌ An error occurred. Please check the console for details.');
        updateButtonState('default');
        hideStatus();
    }
}

// Get AI answer from Gemini API
async function getAIAnswer(question, apiKey) {
    let prompt;

    if (question.type === 'multiple_choice') {
        const optionsText = question.options.map(opt => opt.text).join('\n');
        prompt = `You are helping fill out a quiz/form. Answer the following multiple choice question by selecting EXACTLY ONE of the given options. Return ONLY the exact text of the correct option, nothing else.

Question: ${question.question}

Options:
${optionsText}

Your answer (return only the exact option text):`;
    } else {
        prompt = `You are helping fill out a quiz/form. Answer the following question concisely and accurately. Keep your answer brief and to the point.

Question: ${question.question}

Your answer:`;
    }

    // Send to background script to make API call
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: 'getAIAnswer',
            prompt: prompt,
            apiKey: apiKey
        }, (response) => {
            if (response && response.success) {
                resolve(response.answer);
            } else {
                reject(new Error(response?.error || 'Failed to get AI answer'));
            }
        });
    });
}

// Select the best matching option
function selectBestOption(options, aiAnswer) {
    const normalizedAnswer = aiAnswer.toLowerCase().trim();

    // Try exact match first
    let bestMatch = options.find(opt =>
        opt.text.toLowerCase().trim() === normalizedAnswer
    );

    if (bestMatch) return bestMatch;

    // Try partial match
    bestMatch = options.find(opt =>
        opt.text.toLowerCase().includes(normalizedAnswer) ||
        normalizedAnswer.includes(opt.text.toLowerCase())
    );

    if (bestMatch) return bestMatch;

    // Try word matching
    const answerWords = normalizedAnswer.split(/\s+/);
    let maxMatches = 0;

    options.forEach(opt => {
        const optionWords = opt.text.toLowerCase().split(/\s+/);
        const matches = answerWords.filter(word => optionWords.includes(word)).length;

        if (matches > maxMatches) {
            maxMatches = matches;
            bestMatch = opt;
        }
    });

    return bestMatch;
}

// Select a radio button
function selectRadioButton(radioElement) {
    // Trigger click event
    radioElement.click();

    // Also trigger change event
    const event = new Event('change', { bubbles: true });
    radioElement.dispatchEvent(event);
}

// Fill text input
function fillTextInput(inputElement, text) {
    // Set value
    inputElement.value = text;

    // Trigger input event
    const inputEvent = new Event('input', { bubbles: true });
    inputElement.dispatchEvent(inputEvent);

    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    inputElement.dispatchEvent(changeEvent);
}

// Sleep utility
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== CHATGPT MODE FUNCTIONS =====

// Global variable to store extracted questions for ChatGPT mode
let extractedQuestions = [];

// Handle ChatGPT mode button click
async function handleChatGPTMode() {
    try {
        showStatus('Extracting questions...', '🔍');

        // Extract questions
        const questions = extractQuestions();
        const mcqs = questions.filter(q => q.type === 'multiple_choice');

        if (mcqs.length === 0) {
            alert('❌ No MCQs found on this form.');
            hideStatus();
            return;
        }

        // Store for later use
        extractedQuestions = mcqs;

        // Format for ChatGPT
        const prompt = formatQuestionsForChatGPT(mcqs);

        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(prompt);
            showStatus(`✅ ${mcqs.length} questions copied! Opening ChatGPT...`, '✅');
        } catch (err) {
            console.error('Clipboard error:', err);
            alert('⚠️ Could not copy to clipboard. Please allow clipboard access.');
            return;
        }

        // Show paste button
        const pasteBtn = document.getElementById('paste-answers-btn');
        if (pasteBtn) {
            pasteBtn.style.display = 'flex';
        }

        // Open ChatGPT in new tab
        window.open('https://chatgpt.com', '_blank');

        // Show instructions
        setTimeout(() => {
            showStatus('📋 Paste questions in ChatGPT (Ctrl+V), copy answers, then click "Paste Answers"', '💡');
        }, 2000);

    } catch (error) {
        console.error('Error in ChatGPT mode:', error);
        alert('❌ An error occurred. Check console for details.');
        hideStatus();
    }
}

// Format questions for ChatGPT
function formatQuestionsForChatGPT(mcqs) {
    let prompt = `Answer these ${mcqs.length} multiple choice questions. Respond ONLY with the option letter for each question.\n\nFormat your response as:\n1. A\n2. B\n3. C\n...\n\n`;

    mcqs.forEach((q, index) => {
        prompt += `${index + 1}. ${q.question}\n`;
        q.options.forEach((opt, optIndex) => {
            const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
            prompt += `   ${letter}) ${opt.text}\n`;
        });
        prompt += '\n';
    });

    prompt += `\nRemember: Respond with ONLY the answer letters in the format:\n1. A\n2. B\n3. C\n...`;

    return prompt;
}

// Handle paste answers button click
async function handlePasteAnswers() {
    try {
        showStatus('Reading clipboard...', '📋');

        // Read from clipboard
        let clipboardText;
        try {
            clipboardText = await navigator.clipboard.readText();
        } catch (err) {
            console.error('Clipboard read error:', err);
            alert('⚠️ Could not read clipboard. Please allow clipboard access.\n\nAlternatively, paste the answers in the prompt that appears.');
            clipboardText = prompt('Paste ChatGPT\'s answers here:');
            if (!clipboardText) {
                hideStatus();
                return;
            }
        }

        // Parse answers
        const answers = parseAnswers(clipboardText);

        if (answers.length === 0) {
            alert('❌ No valid answers found. Make sure you copied ChatGPT\'s response.\n\nExpected format:\n1. A\n2. B\n3. C\n...');
            hideStatus();
            return;
        }

        showStatus(`Found ${answers.length} answers. Filling form...`, '✅');

        // Fill form
        let filled = 0;
        for (let i = 0; i < Math.min(answers.length, extractedQuestions.length); i++) {
            const answer = answers[i];
            const question = extractedQuestions[i];

            if (answer && question) {
                // Convert letter to option index (A=0, B=1, C=2, D=3)
                const optionIndex = answer.charCodeAt(0) - 65;

                if (optionIndex >= 0 && optionIndex < question.options.length) {
                    const option = question.options[optionIndex];
                    selectRadioButton(option.element);
                    filled++;
                    console.log(`Q${i + 1}: Selected ${answer}) ${option.text}`);
                }
            }

            await sleep(100); // Small delay between selections
        }

        showStatus(`✅ Filled ${filled} MCQs! Review before submitting.`, '✅');

        // Hide paste button
        setTimeout(() => {
            const pasteBtn = document.getElementById('paste-answers-btn');
            if (pasteBtn) {
                pasteBtn.style.display = 'none';
            }
            hideStatus();
        }, 5000);

    } catch (error) {
        console.error('Error pasting answers:', error);
        alert('❌ An error occurred. Check console for details.');
        hideStatus();
    }
}

// Parse answers from ChatGPT response
function parseAnswers(text) {
    const answers = [];
    const lines = text.split('\n');

    for (const line of lines) {
        // Match formats: "1. A", "1) A", "A", etc.
        const match = line.match(/(?:\d+[\.\)]\s*)?([A-D])/i);
        if (match) {
            answers.push(match[1].toUpperCase());
        }
    }

    return answers;
}


// Initialize when page loads
if (isGoogleForm()) {
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectButton);
    } else {
        injectButton();
    }

    // Also inject after a delay to handle dynamic content
    setTimeout(injectButton, 2000);
}
