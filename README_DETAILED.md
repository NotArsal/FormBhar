# 🧠 Detailed Documentation & System Architecture

This document provides a deep dive into the engineering, architecture, and security model of the **Google Forms AI Auto-Filler** Chrome Extension.

For basic installation and usage instructions, please refer to the main [README.md](README.md).

---

## 🏗️ System Architecture

The extension was built from the ground up for **Enterprise-Grade Security** compliant with Chrome's **Manifest V3**.

### Core Modules

1. **Background Service Worker (`background/`)**
   - **`background.js`:** The central message router. It handles all async communication between the Content Scripts and the AI Providers. 
   - **`sessionManager.js`:** Issues secure, temporary session tokens (`5-minute expiration`) when a fill request is initiated. Content scripts can only inject answers into the DOM if they query the background and verify a valid, active session.
   - **`analytics.js`:** Manages local offline telemetry. Logs historical form completions cleanly into chrome's `storage.local` without relying on a hosted Node.js backend.

2. **Content Scripts (`content/`)**
   - **`domObserver.js`:** Uses `MutationObserver` to watch for newly loaded DOM elements (useful for paginated or dynamic forms) and natively injects the floating UI action buttons onto the Google Form page.
   - **`formReader.js`:** Robust ARIA-based context parsing that understands required questions, radio groups, checkboxes, and text inputs without relying on fragile CSS selectors.
   - **`formFiller.js`:** The Context Injector. It fuzzy-matches the generated AI JSON responses against the live DOM elements. Automatically mimics real user-interactions by firing synthetic DOM `change` and `input` events so Google's internal React/Angular framework recognizes the data.

3. **AI Interface Layer (`providers/`)**
   - **`providerManager.js`:** The factory class routing generations.
   - Separate, modular provider files (`geminiProvider.js`, `openaiProvider.js`, `claudeProvider.js`) that enforce a standard `generate(formContext, userProfile)` interface.

4. **Storage Abstraction (`utils/`)**
   - **`storage.js`:** A clean Promise-wrapper around Chrome's asynchronous `chrome.storage.local` API.

---

## 🔒 Security & Privacy Model

This extension operates on a **Zero-Leakage** privacy model:

- **Zero External Backend Tracking:** User data never leaves the local machine. There are no proprietary databases collecting your form history.
- **API Key Isolation:** Private API keys (OpenAI, Gemini, Anthropic) are strictly isolated within the `background.js` Service Worker. They are NEVER passed to the active webpage or mounted to the `window` object of the content scripts. 
- **CORS Bypass Natively:** Because API `fetch()` requests happen entirely in the background worker rather than the content script, they natively bypass strict browser CORS policies.
- **Sanitized Extraction:** The `ContextExtractor` only reads generic structural inputs (`role="radio"`, `aria-label`) and avoids pulling hidden proprietary page tokens.

---

## 💡 The "No Quota" Fallback Engineering

For users without API keys, the traditional method of copying form data fails entirely because Google Forms heavily obfuscates its HTML structure.

The **ChatGPT No Quota Mode** solves this with intelligent structural decoupling:
1. `domObserver` extracts the exact total number of multiple-choice questions natively identified on the page using `formReader`.
2. It generates a rigid Markdown list format copied straight to the user's clipboard: `1. A`, `2. B`.
3. When the user pastes ChatGPT's answers back, a strict Regex mapping occurs: `new RegExp('^\\s*${qNum}[\\.\\)]\\s*([A-D])\\s*$', 'i')`
4. This absolutely structural approach guarantees that even if the user accidentally copies irrelevant text, instructions, or garbage data along with the answers, the system perfectly isolates and maps the correct option index strictly tied to the `qNum`.

---

## 🛠️ Tech Stack Constraints

- **Languages:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3.
- **Why no React/Webpack?** To ensure instantaneous load times and zero build-step initialization for developers, simplifying the Chrome loading mechanism.
- **Permissions Required:** `storage`, `activeTab`, `scripting`.
- **Host Permissions:** `*://docs.google.com/forms/*` 

---

## 🤝 Roadmap & Contribution

Future architectural improvements could include:
1. Support for mapping complex native Matrix Grid choice interactions.
2. Enhancing the `autoFillProfile` string matching distance heuristics.
3. Enabling OpenAI Streaming output for real-time DOM injection visualization.

*Pull requests are highly encouraged!*
