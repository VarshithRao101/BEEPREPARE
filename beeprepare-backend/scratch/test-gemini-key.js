require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testKey() {
  const key = process.env.GEMINI_API_KEY;
  console.log('Testing key:', key);
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  try {
    const result = await model.generateContent('Hi');
    console.log('✅ Success:', result.response.text());
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.response) {
       console.error('Status:', err.response.status);
    }
  }
}

testKey();
