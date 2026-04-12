require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testSimple() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  try {
    const result = await model.generateContent('Hi');
    console.log('✅ Success:', result.response.text());
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testSimple();
