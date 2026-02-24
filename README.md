# Google Forms AI Auto-Filler 🤖✨

A powerful, privacy-first Chrome Extension that intelligently auto-fills Google Forms using advanced AI models (Gemini, ChatGPT, and Claude).

## 🌟 Features

- **Multi-Model Support:** Choose between Gemini 1.5 Pro, OpenAI (GPT-4), or Anthropic Claude to power your form completions.
- **Three Core Workflows:**
  - **✨ Auto-Fill with AI:** One-click automation. The extension automatically reads the context of the page and uses your API key to fill in the correct multiple-choice and short-answer options.
  - **💬 ChatGPT No Quota Mode:** Bypass API rate limits by seamlessly copying form questions exactly formatted for ChatGPT, and intelligently pasting the answers back sequentially into the form. 
  - **👤 1-Click Profile Injection:** Instantly fill in repetitive constants (Name, Roll No, PRN, Email) using your securely saved Chrome local storage without burning any AI quotas.
- **Privacy-First & Secure:** Zero external backend tracking. All API calls are executed directly from the secure Chrome Extension background worker, bypassing CORS limits without exposing your API keys to the DOM.
- **Intelligent DOM Extraction:** Robust ARIA-based context parsing that understands required questions, radio groups, checkboxes, and text inputs.

## 📥 Installation

1. Clone or download this repository to your local machine:
   ```bash
   git clone https://github.com/YOUR_USERNAME/google-forms-ai-autofiller.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the `extension/` directory (inside the cloned `google_form_filler` folder).

## ⚙️ Configuration

1. Click on the newly installed **Google Forms AI Auto-Filler** extension icon in your Chrome toolbar.
2. Select your preferred **AI Provider**.
3. Enter your valid API key (Gemini, OpenAI, or Claude). 
4. (Optional) Provide your recurrent profile details under the **👤 User Profile** section.
5. Click **Save Settings**. 

*Note: Your API keys and profile data are completely encrypted and stored permanently inside your browser's private local storage.*

## 🚀 How to Use

1. Navigate to any Google Form.
2. You and notice three floating buttons injected at the bottom right of the page:
   - **✨ Auto-Fill with AI**: Immediately delegates the entire form to your configured API key.
   - **👤 Fill Profile Data**: Pre-fills fields querying for your name, roll no, etc.
   - **💬 Use ChatGPT (No Quota)**: Use if you don't have API keys. Copies a custom prompt to your clipboard and opens ChatGPT. You paste the answers it gives you back via the '📋 Paste Answers' button.

## 🛠️ Tech Stack & Architecture

- **Manifest V3** Compliant
- **Background Service Worker**: Handles unified state passing, multi-provider API request routing, and analytics.
- **Content Scripts**: `domObserver.js`, `formReader.js`, and `formFiller.js` cleanly isolate DOM extraction vs DOM injection.
- **Vanilla JS & CSS** (No heavy frontend frameworks needed)
- **Local Analytics Storage**: Saves historical form-fill logs securely to your local browser storage.

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📝 License

[MIT](https://choosealicense.com/licenses/mit/)
