# 📝 Google Forms AI Auto-Filler 🤖✨

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome_Extension-blue.svg)](https://www.google.com/chrome/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A privacy-first Chrome Extension that automates filling out Google Forms using advanced AI models (Gemini, ChatGPT, and Claude).

Say goodbye to manually clicking through repetitive company surveys, university quizzes, or daily standup forms. This extension reads the form context, understands the multiple-choice options, and injects the intelligent answers with a single click!


## 🚀  Installation

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
2. **💬 📋 ChatGPT No Quota Mode:** Don't want to pay for API credits? This mode perfectly extracts questions to your clipboard. You paste them into ChatGPT, and perfectly map the answers back into the form.
3. **👤 ⚡ 1-Click Profile Injection:** Save your Name, Roll_No, PRN, or Email locally. Instantly inject these highly repetitive fields into any form with 100% precision.

---


## ⚙️ Configuration & Setup

1. Click on the newly installed **Google Forms AI Auto-Filler** puzzle piece icon in your Chrome toolbar.
2. Select your preferred **AI Provider** from the dropdown menu.
3. Enter your valid API key (`sk-...`, `AIzaSy...`, etc.).
4. Expand the **👤 User Profile** section. Enter your recurrent profile details (Name, Roll No, PRN, Email).
5. Click **Save Settings**. *(Your keys are securely encrypted in your browser's local storage).*

---



3. **Always review the AI's answers before clicking Submit!**
