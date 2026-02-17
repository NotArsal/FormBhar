# Google Forms AI Auto-Filler

Chrome extension that automatically fills Google Forms using Gemini AI.

## 🚀 Installation

1. Get your **Gemini API Key** from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Open Chrome and go to `chrome://extensions/`
3. Enable **"Developer mode"** (top-right toggle)
4. Click **"Load unpacked"**
5. Select the `google_form_filler` folder

## ⚙️ Configuration

1. Click the extension icon 🧩 in Chrome toolbar
2. Enter your **Gemini API Key**
3. Click **"Save Key"**
4. You're ready to go!

## 📖 Usage

### Option 1: AI Mode (Uses Gemini API)
1. Open any Google Form
2. Click the floating **"🤖 Auto Fill with AI"** button
3. Extension will fill MCQs automatically using AI
4. **Review all answers** before submitting
5. Submit manually

### Option 2: ChatGPT Mode (No API Quota!)
1. Open any Google Form
2. Click **"💬 Use ChatGPT"** button
3. Follow the on-screen instructions to get answers from ChatGPT
4. Paste answers back to fill the form

## ⚠️ Important

- Extension **ONLY fills Multiple Choice Questions (MCQs)**
- **Skips all text fields** to ensure accuracy
- **NEVER auto-submits** - you are in control
- API Key is stored locally on your device for security

## 🔧 Troubleshooting

**Extension not working?**
1. Go to `chrome://extensions/`
2. Remove the extension
3. Click "Load unpacked" again
4. Select the folder

**API Quota Exhausted?**
- Extension shows: "❌ API quota exhausted"
- **Solution**: Wait 10 minutes, refresh page, click button again
- Free tier limit: ~5-20 requests per minute
- Extension auto-retries up to 3 times before stopping

**Still having issues?**
- Check console (F12) for errors
- Verify internet connection
- Check API quota at [Google AI Studio](https://makersuite.google.com/app/apikey)

---

**Remember**: Always review AI-generated answers before submitting!

