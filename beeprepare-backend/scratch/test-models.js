require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    // There isn't a direct listModels in the SDK for node easily like this.
    // But we can try a few model names.
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const res = await model.generateContent('hi');
        console.log(`✅ Model ${m} works!`);
        process.exit(0);
      } catch (e) {
        console.log(`❌ Model ${m} failed:`, e.message);
      }
    }
  } catch (err) {
    console.error('Fatal:', err.message);
  }
}

listModels();
