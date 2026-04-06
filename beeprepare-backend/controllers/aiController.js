const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../models/User');
const { success, error } = require('../utils/responseHelper');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const DAILY_LIMIT = 30; // Same for ALL users regardless of plan

// ══════════════════════════════════════════════════════════════════════════════
// 1. POST /api/ai/chat (STATELESS)
// ══════════════════════════════════════════════════════════════════════════════
const sendMessage = async (req, res) => {
  try {
    const { message, attachmentUrls = [] } = req.body;
    const userRole = req.user.role;
    const googleUid = req.user.googleUid;

    // Step 1: Validate message
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return error(res, 'Message is required and cannot be empty', 'EMPTY_MESSAGE', 400);
    }
    const cleanMessage = message.trim();
    if (cleanMessage.length > 4000) {
      return error(res, 'Message too long (max 4000 characters)', 'MESSAGE_TOO_LONG', 400);
    }

    // Step 2: Check daily message limit
    let aiMessagesToday = req.user.get('aiMessagesToday') || 0;
    let aiMessagesResetAt = req.user.get('aiMessagesResetAt') || null;

    const now = new Date();
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (!aiMessagesResetAt || new Date(aiMessagesResetAt) < todayMidnight) {
      aiMessagesToday = 0;
      aiMessagesResetAt = now;
      await User.updateOne(
        { googleUid },
        { $set: { aiMessagesToday: 0, aiMessagesResetAt: now } },
        { strict: false }
      );
    }

    // Daily limit is flat 30 for everyone
    if (aiMessagesToday >= DAILY_LIMIT) {
      const tomorrowMidnight = new Date(todayMidnight);
      tomorrowMidnight.setUTCDate(tomorrowMidnight.getUTCDate() + 1);
      
      return res.status(429).json({
        success: false,
        error: {
          code: 'DAILY_LIMIT_REACHED',
          message: 'Daily limit reached',
          limit: DAILY_LIMIT,
          messagesUsedToday: aiMessagesToday,
          resetAt: tomorrowMidnight.toISOString()
        }
      });
    }

    // Step 3: Build system instruction based on user role
    let systemInstruction = '';
    if (userRole === 'teacher') {
      systemInstruction = `You are BEE AI, a smart academic assistant inside BEEPREPARE, an EdTech platform for Class 8-10.
You are helping a TEACHER. Help them create questions, write marking schemes, summarize chapters, generate practice questions, create short notes, and give exam preparation tips. Keep responses clear, structured, and educationally accurate.
Focus on Indian school curriculum (CBSE/State boards).
Subjects: Physics, Chemistry, Mathematics, Biology, English, Social Studies for Class 8, 9, 10.`;
    } else {
      systemInstruction = `You are BEE AI, a friendly academic assistant inside BEEPREPARE, an EdTech platform for Class 8-10.
You are helping a STUDENT. Explain concepts simply, help them understand topics, give exam tips, create mnemonics, solve practice problems step by step, and motivate them to study. Keep responses friendly, encouraging, and easy to understand.
Focus on Indian school curriculum (CBSE/State boards).
Subjects: Physics, Chemistry, Mathematics, Biology, English, Social Studies for Class 8, 9, 10.`;
    }

    // Step 4: Call Gemini API (STATELESS — no history)
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Combine system instruction and user message
      const combinedPrompt = `${systemInstruction}\n\nUser Question: ${cleanMessage}`;
      
      const result = await model.generateContent(combinedPrompt);
      const aiResponseText = result.response.text();

      // Step 5: Increment daily message count
      aiMessagesToday += 1;
      await User.updateOne(
        { googleUid },
        { $inc: { aiMessagesToday: 1 } },
        { strict: false }
      );

      // Step 6: Return response
      return success(res, 'AI Response successful', {
        aiMessage: aiResponseText,
        modelUsed: 'gemini-1.5-flash',
        messagesUsedToday: aiMessagesToday,
        dailyLimit: DAILY_LIMIT,
        remainingToday: DAILY_LIMIT - aiMessagesToday
      });
    } catch (geminiError) {
      console.error('Gemini API Error:', geminiError.message);
      return error(res, 'BEE AI is temporarily unavailable.', 'AI_UNAVAILABLE', 503);
    }
  } catch (err) {
    console.error('sendMessage error:', err);
    return error(res, 'Failed to process AI chat', 'SERVER_ERROR', 500);
  }
};

module.exports = {
  sendMessage
};
