const User = require('../models/User');
const { success, error } = require('../utils/responseHelper');

/**
 * BEE ASSISTANT — High-Accuracy Local Resolver
 * Replaces external AI APIs with a robust, zero-latency support engine.
 */
const KNOWLEDGE_BASE = [
  { 
    keys: ['login', 'signin', 'sign in', 'access', 'redirect', 'loop', 'stuck', 'enter'], 
    ans: "### 🔐 Login & Access Issues\nIf you're stuck in a redirect loop:\n1. **Clear Browser Cache**: Go to Settings > Privacy > Clear Browsing Data.\n2. **Check Google Account**: Ensure you're signed into the same Google account you used for registration.\n3. **Incognito Mode**: Try opening BEEPREPARE in an Incognito/Private window.\n4. **Internet**: Ensure you have a stable 4G/5G/Wi-Fi connection." 
  },
  { 
    keys: ['payment', 'utr', 'screenshot', 'pay', 'transaction', 'upi', 'money', 'billing'], 
    ans: "### 💳 Payment & UTR Help\n1. **Submit UTR**: After paying via the QR code, copy the 12-digit UTR number from your banking app (PhonePe/GPay/Paytm).\n2. **Wait Time**: Manual verification takes **1 to 4 hours**. Do not submit the same UTR twice.\n3. **Failed Payment**: If money was deducted but not updated, wait 24 hours for the bank to refund or the system to sync." 
  },
  { 
    keys: ['activate', 'license', 'key', 'active', 'plan', 'price', 'subscription', 'unlock'], 
    ans: "### 🚀 Account Activation\n*   **Activation Price**: ₹250 (One-time for full node access).\n*   **Extra Slots**: ₹100 per additional subject/exam.\n*   **Process**: Submit Payment > Get Approved > Key is auto-applied to your profile." 
  },
  { 
    keys: ['question', 'bank', 'syllabus', 'chapters', 'marks', 'paper', 'generate', 'bulk'], 
    ans: "### 📚 Question Bank & Paper Generation\n*   **Generate Paper**: Go to 'Practice' > Select Chapters > Set Difficulty > Click 'Generate'.\n*   **Bulk Upload**: Teachers can upload questions via the Admin Dashboard using Excel or Image Scanning.\n*   **Syllabus**: We currently support Class 8, 9, and 10 (SSC/CBSE/ICSE)." 
  },
  { 
    keys: ['error', 'fault', 'glitch', 'not working', 'crash', 'fault', 'broken', 'bug'], 
    ans: "### 🛠️ Technical Troubleshooting\n*   **Refresh**: 90% of issues are fixed by a simple page refresh.\n*   **Update**: Ensure your browser (Chrome recommended) is updated to the latest version.\n*   **Report**: If a feature is broken, email **beesociety101@gmail.com** with a screenshot." 
  },
  { 
    keys: ['ai', 'limit', 'quota', 'messages', 'neural', 'bot', 'chat'], 
    ans: "### 🤖 AI Assistant Quota\n*   **Free Users**: 30 messages/day limit.\n*   **Paid Users**: Unlimited AI support for academic doubts.\n*   **Status**: You are currently talking to the **BEE Support Resolver**." 
  },
  { 
    keys: ['student', 'teacher', 'role', 'switch', 'change', 'profile'], 
    ans: "### 👤 Profile & Role Management\n*   **Change Role**: Currently, roles cannot be changed manually. Please contact support if you registered as a Student but meant to be a Teacher.\n*   **Profile**: You can update your Name and School in the 'Profile' section." 
  },
  { 
    keys: ['mobile', 'app', 'android', 'ios', 'phone', 'install', 'pwa'], 
    ans: "### 📱 Mobile Experience (PWA)\nBEEPREPARE is a Progressive Web App. To install it:\n1. Open Chrome on Android or Safari on iOS.\n2. Tap the **'Share'** or **'Menu'** button.\n3. Select **'Add to Home Screen'**." 
  },
  { 
    keys: ['security', 'blocked', 'ip', 'ban', 'flagged', 'strikes', 'fortress'], 
    ans: "### 🛡️ Security Protocol\n*   **IP Block**: Happens if multiple invalid requests are detected. Wait **15 minutes** for the block to lift automatically.\n*   **Strikes**: Repeatedly trying to bypass security will result in a permanent ban." 
  },
  { 
    keys: ['help', 'contact', 'support', 'assistance', 'customer', 'talk', 'human', 'call'], 
    ans: "### 📞 Direct Support\n*   **WhatsApp**: 9059068384\n*   **Email**: beesociety101@gmail.com\n*   **Hours**: 9 AM to 9 PM IST" 
  }
];

const sendMessage = async (req, res) => {
  try {
    const googleUid = req.user.googleUid;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return error(res, 'Message is required', 'EMPTY_CONTENT', 400);
    }
    const cleanMessage = message.trim().toLowerCase();

    // ── STEP 1: KEYWORD MATCHING ──
    let aiResponseText = null;
    for (const entry of KNOWLEDGE_BASE) {
      if (entry.keys.some(k => cleanMessage.includes(k))) {
        aiResponseText = entry.ans;
        break;
      }
    }

    // Default Fallback
    if (!aiResponseText) {
      aiResponseText = "I'm the BEE Assistant. I can help with **Login, Payments, Activation, or Question Banks**. Please try rephrasing your concern or asking about a specific feature!";
    }

    // ── STEP 2: SESSION TRACKING & SUPPORT ESCALATION ──
    let aiMessagesToday = req.user.aiMessagesToday || 0;
    
    // Increment count
    await User.updateOne({ googleUid }, { $inc: { aiMessagesToday: 1 } });
    aiMessagesToday += 1;

    // Suggest human support after 5 queries
    if (aiMessagesToday >= 5) {
      aiResponseText += "\n\n---\n⚠️ **Note**: If your issue persists after " + aiMessagesToday + " queries, please contact our human support directly for faster resolution:\n📞 **WhatsApp**: 9059068384\n✉️ **Email**: beesociety101@gmail.com";
    }

    // Award EXP
    const { awardExp } = require('../utils/expService');
    awardExp(googleUid, 'AI_DOUBT_SOLVED'); 

    // ── STEP 3: RESPONSE ──
    // Delaying response slightly to allow frontend 'dots' animation to feel natural
    return setTimeout(() => {
      return success(res, 'Assistant response generated', {
        aiMessage: aiResponseText,
        messagesUsedToday: aiMessagesToday
      });
    }, 800);

  } catch (err) {
    console.error('BEE Assistant Error:', err);
    return error(res, 'System offline', 'SERVER_ERROR', 500);
  }
};

module.exports = {
  sendMessage,
  getSessions: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
  getSessionMessages: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
  deleteSession: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
};
