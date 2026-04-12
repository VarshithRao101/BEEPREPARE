require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testV1() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Specify version as v1
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }, { apiVersion: 'v1' });

  try {
    const result = await model.generateContent('Hi');
    console.log('✅ Success:', result.response.text());
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testV1();
