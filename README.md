# 📝 FormBhar - Google Forms AI Auto-Filler 🤖✨

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Chrome_Extension-blue.svg?style=for-the-badge&logo=google-chrome" alt="Platform" />
  <img src="https://img.shields.io/badge/Manifest-V3-success.svg?style=for-the-badge&logo=webassembly" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge&logo=git" alt="License" />
  <img src="https://img.shields.io/badge/Backend-Render-purple.svg?style=for-the-badge&logo=render" alt="Backend" />
</p>

---

**FormBhar** is an enterprise-grade, privacy-first Chrome Extension that automates the tedious chore of filling out Google Forms. Armed with advanced AI models (**OpenAI GPT-4o-mini**, **Gemini 1.5 Pro**, and **Anthropic Claude 3**), it reads form structures, understands multiple-choice parameters, and injects logical answers in seconds.

Whether it’s university quizzes, corporate feedback sessions, daily standups, or exam preparation, **FormBhar** takes care of the entry work with modern automated precision.

---

## 🚀 Key Features

*   **🤖 ✨ Multi-Model AI Engine:** Instantly connect your personal API keys for OpenAI, Gemini, or Claude. Includes smart **automatic provider fallback** if your primary key runs out of quota.
*   **🔄 Smart Multi-Page Auto-Filler:** Click **"Auto-Fill" once on Page 1**. The extension securely saves your transient session and **automatically fills subsequent pages** in the background as you click "Next"!
*   **🧠 Coherent Contextual Reasoning:** FormBhar doesn't just answer questions in isolation. It uses an advanced contextual prompting structure to link sequential answers together (e.g. justifying "Why?" based on your previous multiple-choice answer).
*   **👥 ⚡ 1-Click Profile Autofill:** Securely store recurring profile information (Name, Roll No, PRN, Email, etc.) and inject them locally in a single click with **zero AI token usage**.
*   **📋 Paste Answers (No Quota Mode):** No API keys? No problem. Use our ChatGPT manual helper to extract questions, copy them formatted, and cleanly map the answers back into the DOM using rigid Regex option parsing.
*   **📊 Live Global Telemetry:** The popup dashboard connects with a production Node.js/PostgreSQL backend (`https://formbhar-backend-7ir1.onrender.com`) to show the total user base and live active sessions in real-time.
*   **🔒 Privacy-First Design:** Sensitive API keys are strictly confined to the isolated, secure Chrome Service Worker environment and never exposed to the page context.

---

## 🛠️ Installation & Setup

### 1. Load the Extension
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/NotArsal/FormBhar.git
    ```
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Turn on **Developer mode** using the toggle switch in the top right.
4.  Click the **Load unpacked** button in the top left.
5.  ⚠️ **CRITICAL:** Select the **`extension/`** sub-directory inside the cloned repository folder (do not select the root project folder).

### 2. Enter API Keys & Profile
1.  Click the **FormBhar puzzle piece icon** in your Chrome toolbar.
2.  Choose your primary AI Provider and input your key:
    *   **OpenAI:** Get it at [OpenAI Developer Platform](https://platform.openai.com/api-keys)
    *   **Gemini:** Get it at [Google AI Studio](https://aistudio.google.com/app/apikey)
    *   **Claude:** Get it at [Anthropic Console](https://console.anthropic.com/)
3.  Fill out the **👤 My Profile** section with your repetitive information.
4.  Click **Save Settings**.

---

## 📖 How to Use

Navigate to any active Google Form URL (`docs.google.com/forms/*`). You will see three beautiful action buttons injected floating in the bottom-right corner:

1.  **✨ Auto-Fill with AI:** The AI reads the page, generates secure JSON-mapped responses, and dynamically populates the fields. If it's a multi-page form, simply click **Next** and watch the extension auto-fill page 2 instantly!
2.  **👤 Fill Profile Data:** Instantly injects your saved name, email, roll number, department, and semester.
3.  **💬 Use ChatGPT (No Quota):** Copies a structured prompt to your clipboard and opens ChatGPT in a new tab. Paste the prompt, copy ChatGPT's option replies (e.g. `1. A`, `2. B`), then click the emerging **📋 Paste Answers** button on your form.

---

## ⚙️ Backend Telemetry System
The backend tracks active user sessions and telemetry:
-   **Host Platform:** Render (Production URL: `https://formbhar-backend-7ir1.onrender.com`)
-   **Database:** Supabase Managed PostgreSQL
-   **Architecture:** Node.js/Express, utilizing a background alarm mechanism to handle Chromium Service Worker wakeups securely in compliance with Manifest V3 parameters.

*For detailed system engineering and PostgreSQL table schema, see [README_DETAILED.md](README_DETAILED.md).*