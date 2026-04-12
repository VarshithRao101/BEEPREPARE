const { Schema, model } = require('mongoose');

const systemConfigSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  description: String,
  updatedBy: String
}, { timestamps: true });

module.exports = model('SystemConfig', systemConfigSchema);
