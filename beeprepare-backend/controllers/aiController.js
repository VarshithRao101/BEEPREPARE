const Groq = require('groq-sdk');
const User = require('../models/User');
const { success, error } = require('../utils/responseHelper');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const DAILY_LIMIT = 30;

// ══════════════════════════════════════════════════════════════════════════════
// 1. POST /api/ai/chat (STATELESS — FAST CONVERSATION)
// ══════════════════════════════════════════════════════════════════════════════
const sendMessage = async (req, res) => {
  try {
    const userRole = req.user.role;
    const googleUid = req.user.googleUid;

    // Step 1: Validate message/image
    const { message, image } = req.body;
    if ((!message || message.trim() === '') && !image) {
      return error(res, 'Message or image is required', 'EMPTY_CONTENT', 400);
    }
    const cleanMessage = (message || '').trim();

    // Step 2: Check daily message limit
    let aiMessagesToday = req.user.aiMessagesToday || 0;
    let aiMessagesResetAt = req.user.aiMessagesResetAt || null;

    const now = new Date();

    // RESET LOGIC: If never reset OR current time passed the reset mark
    if (!aiMessagesResetAt || now >= new Date(aiMessagesResetAt)) {
      aiMessagesToday = 0;
      // Set reset to exactly 24 hours from the first message of the new cycle
      aiMessagesResetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await User.updateOne({ googleUid }, { 
        $set: { 
          aiMessagesToday: 0, 
          aiMessagesResetAt: aiMessagesResetAt 
        } 
      });
    }

    if (aiMessagesToday >= DAILY_LIMIT) {
      return res.status(429).json({
        success: false,
        message: `Daily AI usage limit reached (${DAILY_LIMIT}). ✨ Activate your account for unlimited academic help, advanced problem solving, and priority access!`,
        error: { 
          code: 'DAILY_LIMIT_REACHED', 
          limit: DAILY_LIMIT,
          resetAt: aiMessagesResetAt
        }
      });
    }

    // Step 3: Build Context and System Instruction
    let systemInstruction = "";
    if (userRole === 'teacher') {
      systemInstruction = `You are BEE AI, a professional academic assistant for teachers in BEEPREPARE.
Help with question generation, marking schemes, chapter summaries, and lesson planning for Class 8-10 (CBSE/Indian boards).
If an image is provided, analyze it to help the teacher.
Be professional, structured, and helpful. Use Markdown.`;
    } else {
      systemInstruction = `You are BEE AI, a friendly academic assistant for students in BEEPREPARE.
Help students understand Class 8-10 concepts (CBSE/Indian boards). If they provide a photo of a doubt or question, solve it step-by-step.
Use simple language, mnemonics, and step-by-step solutions.
Be encouraging and concise. Use Markdown.`;
    }

    // Step 4: Build Groq Content (Support Vision)
    let userContent = [];
    if (cleanMessage) {
      userContent.push({ type: 'text', text: cleanMessage });
    }
    if (image) {
      userContent.push({
        type: 'image_url',
        image_url: { url: image }
      });
    }

    try {
      const VISION_MODELS = [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant'
      ];

      let completion = null;
      let lastError = null;
      let successfulModel = '';

      console.log('--- BEE AI SYNC START ---');
      
      for (const modelId of VISION_MODELS) {
        try {
          console.log(`Attempting Sync with Model: ${modelId}...`);
          completion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userContent },
            ],
            model: modelId,
            temperature: 0.7,
            max_tokens: 1024,
          });
          
          if (completion) {
            successfulModel = modelId;
            break; 
          }
        } catch (err) {
          lastError = err;
          console.warn(`Model ${modelId} failed/decommissioned. Trying next...`);
        }
      }

      if (!completion) {
        throw lastError; // Pass to the groqError catch block
      }

      const aiResponseText = completion.choices[0]?.message?.content || "";
      console.log(`--- BEE AI SYNC SUCCESS (${successfulModel}) ---`);

      // Step 6: Update User Limit
      await User.updateOne({ googleUid }, { $inc: { aiMessagesToday: 1 } });

      return success(res, 'AI Response successful', {
        aiMessage: aiResponseText,
        messagesUsedToday: aiMessagesToday + 1,
        dailyLimit: DAILY_LIMIT,
        remainingToday: DAILY_LIMIT - (aiMessagesToday + 1),
        resetAt: aiMessagesResetAt
      });

    } catch (groqError) {
      console.error('CRITICAL: Groq API Error Detected!');
      console.error('Error Code:', groqError.status || 'N/A');
      console.error('Error Message:', groqError.message);
      
      const errorMsg = groqError.message || "";
      
      if (errorMsg.includes('429') || errorMsg.includes('quota') || groqError.status === 429) {
        return error(res, 'BEE AI is currently processing high traffic. Please retry in 60 seconds.', 'QUOTA_EXHAUSTED', 429);
      }

      if (groqError.status === 401 || groqError.status === 403) {
        return error(res, 'Neural Link Authentication Failed. Contact Admin.', 'AUTH_ERROR', 500);
      }

      return error(res, `AI Service Insight: ${errorMsg || 'Connection reset by peer.'}`, 'API_ERROR', 500);
    }
  } catch (err) {
    console.error('sendMessage error:', err);
    return error(res, 'Failed to process message', 'SERVER_ERROR', 500);
  }
};

module.exports = {
  sendMessage,
  // Remaining empty handlers to avoid breaking route imports temporarily
  getSessions: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
  getSessionMessages: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
  deleteSession: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
};
