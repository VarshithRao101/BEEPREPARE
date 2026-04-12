require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGuess3() {
  const key = 'AIzaSyC1qTmtRMgAh4MFliiWSEf0rmPbvk2OgYA'; 
  console.log('Testing key:', key);
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  try {
    const result = await model.generateContent('Hi');
    console.log('✅ Success:', result.response.text());
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testGuess3();
