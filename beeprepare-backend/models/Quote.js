const { Schema, model } = require('mongoose');

const quoteSchema = new Schema({
  text:   { type: String, required: true },
  author: { type: String, default: 'BEE Motivation' },
  category: { type: String, default: 'academic' }
}, { timestamps: true });

module.exports = model('Quote', quoteSchema);
