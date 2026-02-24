# 📝 Google Forms AI Auto-Filler 🤖✨

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome_Extension-blue.svg)](https://www.google.com/chrome/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![AI Supported](https://img.shields.io/badge/AI_Powered-Gemini_|_OpenAI_|_Claude-8A2BE2.svg)](#)

A powerful, privacy-first Chrome Extension that intelligently automates filling out complex Google Forms using advanced AI models (Gemini, ChatGPT, and Claude). 

Say goodbye to manually clicking through repetitive company surveys, university quizzes, or daily standup forms. This extension reads the form context, understands the multiple-choice options, and injects the intelligent answers with a single click—all while keeping your API keys 100% secure!

---

## 🌟 Key Features

### 1. 🤖 ✨ Auto-Fill with AI (Full Automation)
- **Multi-Model Support:** Choose between Google's **Gemini 1.5 Pro**, **OpenAI (GPT-4/GPT-3.5)**, or **Anthropic Claude**.
- **Intelligent DOM Extraction:** Robust ARIA-based context parsing that understands required questions, radio groups, checkboxes, dropdowns, and text inputs without relying on fragile CSS selectors.
- **Smart Mapping:** The AI responses are intelligently fuzzy-matched against the available radio/checkbox elements on the screen, automatically handling clicks and DOM change events natively.

### 2. 💬 📋 ChatGPT No Quota Mode (Manual Bypass)
Don't want to pay for API credits? Use the completely free **No Quota Mapping Flow**:
- **1-Click Extraction:** Extracts all multiple-choice questions and perfectly formats them into a clipboard prompt constraint.
- **Painless Import:** Paste the prompt directly into ChatGPT's website. Once it answers, copy the response back.
- **Indestructible Sequential Regex Execution:** Click `📋 Paste Answers` on the form. The extension uses strict sequential Regex (`1. A`, `2. B`) to perfectly map the pasted AI answers exactly to the corresponding question indices on the form. 

### 3. 👤 ⚡ 1-Click Profile Injection
- Fed up with typing your Name, Roll_No, PRN, or Email into every single form?
- Save your constants **once** inside the extension popup's local storage.
- Click the dedicated `👤 Fill Profile Data` button to instantly inject these highly repetitive fields. The script skips the AI completely for these constants, guaranteeing 100% precision and saving tokens.

---

## 🔒 Privacy-First & Secure Architecture

This extension was re-built from the ground up for **Enterprise-Grade Security (Manifest V3)**:
- **Zero External Backend Tracking.** All analytics and form logs are saved locally to your browser's persistent memory. No user data leaves your machine.
- **Secure Service Worker Isolation:** API calls are executed directly from the isolated Chrome Extension Background Worker (`background.js`).
- **No DOM Leakage:** Your private API keys are **never** passed to the active webpage or content scripts. They stay securely locked in Chrome's `storage.local`.
- **CORS Bypass:** Because requests happen in the background worker, it natively bypasses strict CORS requirements for Anthropic and Google APIs that normally block browser-based fetch requests.

---

## 📥 Installation (Developer Mode)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/NotArsal/FormBhar.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. ⚠️ **CRITICAL:** Select the `extension/` directory (inside the cloned folder). Do not select the root folder, otherwise Manifest V3 will fail to load!

---

## ⚙️ Configuration & Setup

1. Click on the newly installed **Google Forms AI Auto-Filler** puzzle piece icon in your Chrome toolbar.
2. Select your preferred **AI Provider** from the dropdown menu.
3. Enter your valid API key:
   - *Gemini*: `AIzaSy...`
   - *OpenAI*: `sk-...`
   - *Claude*: `sk-ant-...`
4. Expand the **👤 User Profile** section. Enter your recurrent profile details (Name, Roll No, PRN, Email).
5. Click **Save Settings**. (Your keys are encrypted in local storage).

---

## 🚀 How to Use

1. Navigate to any active Google Form url (`docs.google.com/forms/*`).
2. You will notice three floating action buttons injected at the bottom right corner of your screen:

    - **✨ Auto-Fill with AI**: Immediately reads the form and delegates the entire completion task to your configured API key. Wait 5-10 seconds, and watch the form fill itself!
    - **👤 Fill Profile Data**: Pre-fills fields querying for your Name, Roll No, PRN, or Email locally.
    - **💬 Use ChatGPT (No Quota)**: Use if you don't have API keys. Copies a custom numbered prompt to your clipboard and opens ChatGPT. You paste the answers it gives you back via the emerging **📋 Paste Answers** button.

3. **Always review the AI's answers before clicking Submit!**

---

## 🛠️ Tech Stack

- **Extension Framework:** Manifest V3 API
- **Background Worker:** Async Message Routing & Session Management (`sessionManager.js`)
- **Content Scripts:** Independent modular logic for DOM Observation (`domObserver.js`), Context Reader (`formReader.js`), and Context Injector (`formFiller.js`).
- **Data Persistence:** `chrome.storage.local` Promise Wrappers.
- **Languages:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3. (No heavy React/Webpack builds required, ensuring blazing fast load times).

---

## 🤝 Contributing

Pull requests are highly encouraged! 
If you find a complex Google Form type (like a highly matrixed Grid) that the ARIA scraper fails to read, please open an Issue with the form HTML structure so we can improve the `formReader.js` extraction heuristics.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
