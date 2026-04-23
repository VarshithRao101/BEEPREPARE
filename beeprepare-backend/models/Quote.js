const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const quoteSchema = new Schema({
  text:     { type: String, required: true },
  author:   { type: String, default: 'BEE Motivation' },
  category: { type: String, default: 'academic' }
}, { timestamps: true });

let _Quote = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_Quote) _Quote = getMainConn().model('Quote', quoteSchema);
    return _Quote[prop];
  },
  construct(_, args) {
    if (!_Quote) _Quote = getMainConn().model('Quote', quoteSchema);
    return new _Quote(...args);
  }
});
