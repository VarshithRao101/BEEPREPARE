const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../models/User');
const AiChat = require('../models/AiChat');
const { success, error } = require('../utils/responseHelper');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const DAILY_LIMIT = 30; // Same for ALL users regardless of plan

// ══════════════════════════════════════════════════════════════════════════════
// 1. GET /api/ai/sessions (Fetch user's chat history)
// ══════════════════════════════════════════════════════════════════════════════
const getSessions = async (req, res) => {
  try {
    const googleUid = req.user.googleUid;
    const sessions = await AiChat.find({ userId: googleUid })
      .sort({ lastMessageAt: -1 })
      .select('title lastMessageAt messageCount');

    return success(res, 'Sessions fetched', sessions);
  } catch (err) {
    console.error('getSessions error:', err);
    return error(res, 'Failed to fetch chat sessions', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. GET /api/ai/sessions/:sessionId (Fetch specific session messages)
// ══════════════════════════════════════════════════════════════════════════════
const getSessionMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const googleUid = req.user.googleUid;

    const chat = await AiChat.findOne({ _id: sessionId, userId: googleUid });
    if (!chat) return error(res, 'Session not found', 'NOT_FOUND', 404);

    return success(res, 'Messages fetched', chat.messages);
  } catch (err) {
    console.error('getSessionMessages error:', err);
    return error(res, 'Failed to fetch messages', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. POST /api/ai/chat (STATEFUL — Persistent History)
// ══════════════════════════════════════════════════════════════════════════════
const sendMessage = async (req, res) => {
  try {
    const { message, sessionId = null } = req.body;
    const userRole = req.user.role;
    const googleUid = req.user.googleUid;

    // Step 1: Validate message
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return error(res, 'Message is required', 'EMPTY_MESSAGE', 400);
    }
    const cleanMessage = message.trim();

    // Step 2: Check daily message limit
    let aiMessagesToday = req.user.aiMessagesToday || 0;
    let aiMessagesResetAt = req.user.aiMessagesResetAt || null;

    const now = new Date();
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (!aiMessagesResetAt || new Date(aiMessagesResetAt) < todayMidnight) {
      aiMessagesToday = 0;
      await User.updateOne({ googleUid }, { $set: { aiMessagesToday: 0, aiMessagesResetAt: now } });
    }

    if (aiMessagesToday >= DAILY_LIMIT) {
      return res.status(429).json({
        success: false,
        error: { code: 'DAILY_LIMIT_REACHED', limit: DAILY_LIMIT }
      });
    }

    // Step 3: Manage Session
    let chat;
    if (sessionId) {
      chat = await AiChat.findOne({ _id: sessionId, userId: googleUid });
    }

    if (!chat) {
      // Create new session if none provided or none found
      chat = await AiChat.create({
        userId: googleUid,
        userRole: userRole,
        title: cleanMessage.length > 30 ? cleanMessage.substring(0, 30) + '...' : cleanMessage,
        messages: []
      });
    }

    // Step 4: Build Context and System Instruction
    let systemInstruction = "";
    if (userRole === 'teacher') {
      systemInstruction = `You are BEE AI, a premium academic assistant for teachers in BEEPREPARE.
Help with question generation, marking schemes, chapter summaries, and lesson planning for Class 8-10 (CBSE/Indian boards).
Be professional, structured, and helpful. Use LaTeX for math if needed. Use Markdown.`;
    } else {
      systemInstruction = `You are BEE AI, a friendly academic assistant for students in BEEPREPARE.
Help students understand Class 8-10 concepts (CBSE/Indian boards). Use simple language, mnemonics, and step-by-step solutions.
Be encouraging and concise. Use Markdown and LaTeX for math.`;
    }

    // Prepare history (last 5 messages)
    const recentMessages = chat.messages.slice(-5).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    // Step 5: Call Gemini
    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-flash-latest',
        systemInstruction: systemInstruction 
      });

      const chatSession = model.startChat({
        history: recentMessages,
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });

      const result = await chatSession.sendMessage(cleanMessage);
      const aiResponseText = result.response.text();

      // Step 6: Update Database
      chat.messages.push({ role: 'user', content: cleanMessage });
      chat.messages.push({ role: 'model', content: aiResponseText });
      chat.messageCount += 2;
      chat.lastMessageAt = new Date();
      await chat.save();

      await User.updateOne({ googleUid }, { $inc: { aiMessagesToday: 1 } });

      return success(res, 'AI Response successful', {
        aiMessage: aiResponseText,
        sessionId: chat._id,
        messagesUsedToday: aiMessagesToday + 1,
        dailyLimit: DAILY_LIMIT,
        remainingToday: DAILY_LIMIT - (aiMessagesToday + 1)
      });

    } catch (geminiError) {
      console.error('Gemini Error:', geminiError);
      return error(res, 'AI Error: ' + geminiError.message, 'API_ERROR', 500);
    }
  } catch (err) {
    console.error('sendMessage error:', err);
    return error(res, 'Failed to send message', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 4. DELETE /api/ai/sessions/:sessionId (Delete session)
// ══════════════════════════════════════════════════════════════════════════════
const deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const googleUid = req.user.googleUid;
    await AiChat.deleteOne({ _id: sessionId, userId: googleUid });
    return success(res, 'Session deleted');
  } catch (err) {
    return error(res, 'Failed to delete session', 'SERVER_ERROR', 500);
  }
};

module.exports = {
  getSessions,
  getSessionMessages,
  sendMessage,
  deleteSession
};
