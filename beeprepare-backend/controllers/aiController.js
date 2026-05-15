const OpenAI = require('openai');
const User = require('../models/User');
const { success, error } = require('../utils/responseHelper');

// Initialize OpenAI with the provided key (or env variable)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

    // RESET LOGIC
    if (!aiMessagesResetAt || now >= new Date(aiMessagesResetAt)) {
      aiMessagesToday = 0;
      aiMessagesResetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await User.updateOne({ googleUid }, { 
        $set: { 
          aiMessagesToday: 0, 
          aiMessagesResetAt: aiMessagesResetAt 
        } 
      });
    }

    const isPaidUser = req.user.isActivated || req.user.planType === 'active';
    
    if (!isPaidUser && aiMessagesToday >= DAILY_LIMIT) {
      return res.status(429).json({
        success: false,
        message: `Daily AI usage limit reached (${DAILY_LIMIT}). ✨ Activate your account for unlimited help!`,
        error: { 
          code: 'DAILY_LIMIT_REACHED', 
          limit: DAILY_LIMIT,
          resetAt: aiMessagesResetAt
        }
      });
    }

    // Step 3: Build System Instruction
    let systemInstruction = "";
    if (userRole === 'teacher') {
      systemInstruction = `You are BEE AI, a professional academic assistant for teachers in BEEPREPARE. Help with question generation, marking schemes, and lesson planning for Class 8-10. Be professional and use Markdown.`;
    } else {
      systemInstruction = `You are BEE AI, a friendly academic assistant for students in BEEPREPARE. Help students understand Class 8-10 concepts. If they provide a photo, solve it step-by-step. Be concise and use Markdown.`;
    }

    // Step 4: Build OpenAI Content
    let userContent = [];
    if (cleanMessage) {
      userContent.push({ type: 'text', text: cleanMessage });
    }
    if (image) {
      let accessibleUrl = image;
      if (image.includes('firebasestorage') || image.includes('storage.googleapis.com')) {
          try {
              const { bucket } = require('../config/firebase');
              const path = decodeURIComponent(image.split('/o/')[1].split('?')[0]);
              const [signedUrl] = await bucket.file(path).getSignedUrl({
                  action: 'read',
                  expires: Date.now() + 15 * 60 * 1000 
              });
              accessibleUrl = signedUrl;
          } catch (e) {
              console.warn('AI Signed URL failed:', e.message);
          }
      }
      userContent.push({
        type: 'image_url',
        image_url: { url: accessibleUrl }
      });
    }

    try {
      const MODELS = ['gpt-4o-mini', 'gpt-4o']; 
      let completion = null;
      let lastError = null;

      console.log('--- BEE AI OPENAI SYNC START ---');
      
      for (const modelId of MODELS) {
        try {
          console.log(`Attempting OpenAI: ${modelId}...`);
          completion = await openai.chat.completions.create({
            model: modelId,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userContent },
            ],
            temperature: 0.7,
            max_tokens: 1500,
          });
          if (completion) break;
        } catch (err) {
          lastError = err;
          console.warn(`Model ${modelId} failed. Trying next...`);
        }
      }

      if (!completion) throw lastError;

      const aiResponseText = completion.choices[0]?.message?.content || "";
      console.log('--- BEE AI OPENAI SUCCESS ---');

      // Step 6: Update User Limit and Award EXP
      const { awardExp } = require('../utils/expService');
      await User.updateOne({ googleUid }, { $inc: { aiMessagesToday: 1 } });
      awardExp(googleUid, 'AI_DOUBT_SOLVED'); 

      return success(res, 'AI Response successful', {
        aiMessage: aiResponseText,
        messagesUsedToday: aiMessagesToday + 1,
        dailyLimit: DAILY_LIMIT,
        resetAt: aiMessagesResetAt
      });

    } catch (apiError) {
      console.error('OpenAI Error:', apiError.message);
      return error(res, `Neural Link Error: ${apiError.message}`, 'API_ERROR', 500);
    }
  } catch (err) {
    console.error('sendMessage error:', err);
    return error(res, 'Failed to process message', 'SERVER_ERROR', 500);
  }
};

module.exports = {
  sendMessage,
  getSessions: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
  getSessionMessages: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
  deleteSession: (req, res) => error(res, 'History disabled', 'DISABLED', 400),
};
