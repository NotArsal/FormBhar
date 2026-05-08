# 📝 Google Forms AI Auto-Filler 🤖✨

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome_Extension-blue.svg)](https://www.google.com/chrome/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A privacy-first Chrome Extension that automates filling out Google Forms using advanced AI models (Gemini, ChatGPT, and Claude).

Say goodbye to manually clicking through repetitive company surveys, university quizzes, or daily standup forms. This extension reads the form context, understands the multiple-choice options, and injects intelligent answers with a single click!

---

## 🚀 Installation

1. **Clone or Download the repository:**
   ```bash
   git clone https://github.com/NotArsal/FormBhar.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. ⚠️ **CRITICAL:** Select the `extension/` directory (inside the cloned folder). Do not select the root folder!

---

## 🚀 How to Use

1. Navigate to any active Google Form url (`docs.google.com/forms/*`).
2. You will notice three floating buttons injected at the bottom right corner of your screen:

   - **👤 Fill Profile Data**: Pre-fills fields querying for your Name, Roll No, PRN, or Email locally without using AI credits.
   - **💬 Use ChatGPT (No Quota)**: Select this if you don't have API keys. It copies a custom prompt. Paste the ChatGPT answers back via the emerging **📋 Paste Answers** button.
   - **✨ Auto-Fill with AI**: Immediately reads the form and delegates the completion task to your configured API key. Wait 5-10 seconds, and watch the form fill itself!

---

## 🌟 Features

1. **🤖 ✨ Auto-Fill with AI:** One-click automation using Gemini 1.5 Pro, OpenAI (GPT-4/GPT-3.5), or Anthropic Claude.
2. **🔄 Comprehensive Form Coverage:** Flawlessly handles text, paragraph, multiple choice, checkboxes (multi-select), dropdowns, linear scales, dates, and times.
3. **🧠 Contextual Reasoning:** The AI is instructed to link sequential questions (e.g., "Give a reason for your previous answer") ensuring highly logical and coherent responses.
4. **📋 Expandable Answer History:** Click on any previously filled form in the extension popup's History tab to review the exact answers the AI generated for you.
5. **💬 📋 ChatGPT No Quota Mode:** Don't want to pay for API credits? This mode perfectly extracts questions to your clipboard. You paste them into ChatGPT, and perfectly map the answers back into the form.
6. **👤 ⚡ 1-Click Profile Injection:** Securely saves and natively injects highly repetitive fields (Name, Roll_No, PRN, Email) using smart DOM analysis logic without wasting AI credits.

---

## ⚙️ Configuration & Setup

1. Click on the newly installed **Google Forms AI Auto-Filler** puzzle piece icon in your Chrome toolbar.
2. Select your preferred **AI Provider** from the dropdown menu.
3. Enter your valid API key:
   - **OpenAI:** `sk-...` from https://platform.openai.com/api-keys
   - **Gemini:** `AIzaSy...` from https://aistudio.google.com/app/apikey
   - **Claude:** `sk-ant-...` from https://console.anthropic.com/
4. Expand the **👤 User Profile** section. Enter your recurrent profile details (Name, Roll No, PRN, Email).
5. Click **Save Settings**. *(Your keys are securely encrypted in your browser's local storage).*

---

## ⚡ Important Notes

- **Always review the AI's answers before clicking Submit!**
- For free usage (no API key needed), use **"ChatGPT No Quota Mode"**
- The extension automatically falls back to other AI providers if your primary provider fails