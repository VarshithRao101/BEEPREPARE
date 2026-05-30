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
 * Handle Support Bot Requests (Free/Dynamic)
 */
const supportBotHandler = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim() === '') {
      return error(res, 'Message is required', 'EMPTY_CONTENT', 400);
    }
    const cleanMessage = message.trim();

    let aiResponseText = null;

    // 1. Try to use Groq for dynamic, highly-trained answers
    if (process.env.GROQ_API_KEY) {
      try {
        const systemPrompt = `You are the BEE Support Assistant, a friendly, intelligent customer care agent for the BEEPREPARE platform.
Your job is to assist users with their non-academic platform support, payments, activation, login, security, role switching, and contact queries.

BEEPREPARE SYSTEM INFORMATION:
1. LOGIN STUCK / LOOP: Clear browser cache, ensure the correct Google account is selected, or open an incognito/private browser tab.
2. CONFIRM PAYMENTS & UTR: Users must submit their 12-digit UTR number from their UPI/banking app (PhonePe, GPay, Paytm) into the app's billing portal. Verification takes 1-4 hours. Do not submit UTR multiple times.
3. ACCOUNT ACTIVATION / LICENSE: Unlock is automated once the UTR is verified by the admin team.
4. NATIVE MOBILE APP / PWA: Install BEEPREPARE on Android or iOS by opening Chrome or Safari and selecting "Add to Home Screen" from the menu.
5. SECURITY LOCKS: The "Fortress" security blocks IPs for 15 minutes if rate-limited. Wait 15 minutes to let it auto-lift.
6. WRONG ROLE (STUDENT vs TEACHER): If a user selected the wrong role, guide them to contact support via email or WhatsApp to switch roles.
7. ACADEMIC SOLVING: If the user asks general academic, math, science, or doubt questions, politely remind them that you are the Support Bot, and guide them to use the "BEE AI Assistant" in their sidebar (which is trained specifically for academic doubt-solving).

BEEPREPARE EMERGENCY CONTACTS:
- Main Support Email: beesociety101@gmail.com
- Main WhatsApp Support: 9059068384 (Ravindar Rao Devarneni - Priority 1)
- Support Phone 2: 9154267518 (Priority 2)
- Support Phone 3: 9391691094 (Priority 3)
- Support Phone 4: 7569064222 (Mani Kanta Reddy - Priority 4)
- Instagram: @beesociety101 and @vars.101

RULES:
- Be extremely polite, concise, professional, and empathetic.
- Provide direct, helpful answers based strictly on the BEEPREPARE ecosystem.
- Avoid overly generic or robotic filler phrases. Speak like a premium human care representative.`;

        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: cleanMessage }
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.5, // lower temperature for more precise/factual support answers
          max_tokens: 512,
          top_p: 1
        });

        aiResponseText = chatCompletion.choices[0]?.message?.content;
      } catch (groqErr) {
        console.warn('[Support Bot] Groq dynamic completion failed, falling back to static resolver:', groqErr.message);
      }
    }

    // 2. Fallback to keyword matching knowledge base if Groq is missing or fails
    if (!aiResponseText) {
      const lowerMsg = cleanMessage.toLowerCase();
      for (const entry of KNOWLEDGE_BASE) {
        if (entry.keys.some(k => lowerMsg.includes(k))) {
          aiResponseText = entry.ans;
          break;
        }
      }
    }

    // 3. Absolute catch-all fallback
    if (!aiResponseText) {
      aiResponseText = "I am the BEE Support Assistant. I can help you with questions about your login, payments, account activation, or managing your question banks. For direct assistance, WhatsApp us at 9059068384 or email beesociety101@gmail.com!";
    }

    return success(res, 'Support response generated', {
      aiMessage: aiResponseText,
      isFree: true
    });

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
