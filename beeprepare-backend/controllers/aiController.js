const User = require('../models/User');
const { success, error } = require('../utils/responseHelper');

/**
 * BEE ASSISTANT — Human-Tone Local Resolver
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
    ans: "You are currently chatting with the BEE Assistant. Free accounts have a limit of 30 messages per day, while activated accounts have full access to our academic support features." 
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

const sendMessage = async (req, res) => {
  try {
    const googleUid = req.user.googleUid;
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
      aiResponseText = "I am the BEE Assistant. I can help you with questions about your login, payments, account activation, or managing your question banks. Is there something specific you would like to know about?";
    }

    let aiMessagesToday = req.user.aiMessagesToday || 0;
    await User.updateOne({ googleUid }, { $inc: { aiMessagesToday: 1 } });
    aiMessagesToday += 1;

    if (aiMessagesToday >= 5) {
      aiResponseText += "\n\nSince we have been chatting for a while and I want to make sure you get the best help, please feel free to contact our support team directly if your issue is still not resolved. You can reach us on WhatsApp at 9059068384 or email beesociety101@gmail.com.";
    }

    const { awardExp } = require('../utils/expService');
    awardExp(googleUid, 'AI_DOUBT_SOLVED'); 

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
