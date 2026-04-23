const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const systemConfigSchema = new Schema({
  key:         { type: String, required: true, unique: true },
  value:       { type: Schema.Types.Mixed, required: true },
  description: String,
  updatedBy:   String
}, { timestamps: true });

let _SystemConfig = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_SystemConfig) _SystemConfig = getMainConn().model('SystemConfig', systemConfigSchema);
    return _SystemConfig[prop];
  },
  construct(_, args) {
    if (!_SystemConfig) _SystemConfig = getMainConn().model('SystemConfig', systemConfigSchema);
    return new _SystemConfig(...args);
  }
});
