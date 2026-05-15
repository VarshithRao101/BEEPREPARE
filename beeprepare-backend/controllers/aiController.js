const User = require('../models/User');
const { success, error } = require('../utils/responseHelper');
const Groq = require('groq-sdk');

// Initialize Groq Client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/**
 * CUSTOMER SUPPORT CHATBOT — Static Human-Tone Resolver (FREE)
 */
const KNOWLEDGE_BASE = [
  { 
    keys: ['login', 'signin', 'sign in', 'access', 'redirect', 'loop', 'stuck', 'enter'], 
    ans: "If you are having trouble logging in or are stuck in a loop, it is usually best to clear your browser cache first. You should also check that you are signed into the correct Google account. If that does not work, trying an incognito window often fixes the issue." 
  },
  { 
    keys: ['payment', 'utr', 'screenshot', 'pay', 'transaction', 'upi', 'money', 'billing'], 
    ans: "To confirm your payment, please enter the 12-digit UTR number from your payment app into the system. Our team usually verifies these within 1 to 4 hours. There is no need to submit the same UTR more than once; we will get to it as quickly as possible." 
  },
  { 
    keys: ['activate', 'license', 'key', 'active', 'plan', 'price', 'subscription', 'unlock'], 
    ans: "To activate your account, you will need to submit your payment details for verification. Once we approve the transaction, your subjects will be unlocked and your license will be applied to your profile automatically." 
  },
  { 
    keys: ['question', 'bank', 'syllabus', 'chapters', 'marks', 'paper', 'generate', 'bulk'], 
    ans: "You can manage your questions in the Bank section. If you want to generate a paper, go to the Practice module and choose your chapters. For teachers, the bulk upload tool is available in the admin dashboard to add multiple questions at once." 
  },
  { 
    keys: ['error', 'fault', 'glitch', 'not working', 'crash', 'fault', 'broken', 'bug'], 
    ans: "If you encounter an error or the app crashes, please try refreshing the page first as that fixes most minor glitches. If the problem continues, it would be very helpful if you could send a screenshot of the error to beesociety101@gmail.com." 
  },
  { 
    keys: ['ai', 'limit', 'quota', 'messages', 'neural', 'bot', 'chat'], 
    ans: "You are currently chatting with the BEE Assistant. Free accounts have a limit of 30 messages per day for academic support, but general support queries are always free!" 
  },
  { 
    keys: ['student', 'teacher', 'role', 'switch', 'change', 'profile'], 
    ans: "Roles are assigned when you first join the platform. If you have registered with the wrong role and need to switch, please reach out to our support team so we can assist you with that change." 
  },
  { 
    keys: ['mobile', 'app', 'android', 'ios', 'phone', 'install', 'pwa'], 
    ans: "You can install BEEPREPARE on your phone for a better experience. Just open the site in Chrome or Safari and select Add to Home Screen from your browser menu to use it like a regular app." 
  },
  { 
    keys: ['security', 'blocked', 'ip', 'ban', 'flagged', 'strikes', 'fortress'], 
    ans: "If your IP has been temporarily restricted, please wait about 15 minutes for the system to lift the block. This usually happens if there are too many rapid requests from your connection." 
  },
  { 
    keys: ['help', 'contact', 'support', 'assistance', 'customer', 'talk', 'human', 'call'], 
    ans: "If you need to talk to us directly, you can reach out on WhatsApp at 9059068384 or email us at beesociety101@gmail.com. We are generally available from 9 AM to 9 PM." 
  }
];

/**
 * Handle Support Bot Requests (Free/Static)
 */
const supportBotHandler = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim() === '') {
      return error(res, 'Message is required', 'EMPTY_CONTENT', 400);
    }
    const cleanMessage = message.trim().toLowerCase();

    let aiResponseText = null;
    for (const entry of KNOWLEDGE_BASE) {
      if (entry.keys.some(k => cleanMessage.includes(k))) {
        aiResponseText = entry.ans;
        break;
      }
    }

    if (!aiResponseText) {
      aiResponseText = "I am the BEE Support Assistant. I can help you with questions about your login, payments, account activation, or managing your question banks. For academic doubt solving, please use the BEE AI Assistant in the sidebar!";
    }

    // Support bot is free - no credit deduction

    return setTimeout(() => {
      return success(res, 'Support response generated', {
        aiMessage: aiResponseText,
        isFree: true
      });
    }, 600);

  } catch (err) {
    console.error('Support Bot Error:', err);
    return error(res, 'Support system offline', 'SERVER_ERROR', 500);
  }
};

/**
 * BEE AI ASSISTANT (BAI) — Academic AI using Groq (COSTS CREDITS)
 */
const academicAIHandler = async (req, res) => {
  try {
    const googleUid = req.user.googleUid;
    const { message, image } = req.body;

    if (!message || message.trim() === '') {
      return error(res, 'Message is required', 'EMPTY_CONTENT', 400);
    }

    // 1. Check Limits
    let aiMessagesToday = req.user.aiMessagesToday || 0;
    const limit = 30; // Standard limit

    if (aiMessagesToday >= limit) {
      return error(res, 'Daily neural limit reached. Please recharge tomorrow.', 'DAILY_LIMIT_REACHED', 403);
    }

    // 2. Prepare Groq Request
    if (!process.env.GROQ_API_KEY) {
      console.error('CRITICAL: GROQ_API_KEY is missing from .env');
      return error(res, 'AI Service Configuration Missing', 'CONFIG_ERROR', 500);
    }

    const systemPrompt = `You are BEE AI (BAI), a premium academic intelligence assistant for the BEEPREPARE platform. 
    Your goal is to solve students' doubts, explain complex concepts, and help teachers with academic queries.
    
    GUIDELINES:
    - Be professional, accurate, and encouraging.
    - Use LaTeX for mathematical formulas: use single '$' for inline math (e.g., $E=mc^2$) and double '$$' for block math.
    - If the user asks about BEEPREPARE system issues (payments, login, etc.), politely guide them to use the Support Bot in their profile.
    - Keep responses concise but comprehensive.
    - Your tone is 'Premium Academic Guru'.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: "llama-3.3-70b-versatile", // Latest stable versatile model
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1
    });

    const aiResponseText = chatCompletion.choices[0]?.message?.content || "Neural link timeout. Please retry.";

    // 3. Update Credits
    await User.updateOne({ googleUid }, { $inc: { aiMessagesToday: 1 } });
    aiMessagesToday += 1;

    // 4. Award EXP
    const { awardExp } = require('../utils/expService');
    awardExp(googleUid, 'AI_DOUBT_SOLVED'); 

    return success(res, 'BAI response generated', {
      aiMessage: aiResponseText,
      messagesUsedToday: aiMessagesToday
    });

  } catch (err) {
    console.error('BAI Groq Error:', err.message);
    return error(res, `Neural Core offline: ${err.message}`, 'SERVER_ERROR', 500);
  }
};

module.exports = {
  academicAIHandler,
  supportBotHandler,
  getSessions: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
  getSessionMessages: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
  deleteSession: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
};
