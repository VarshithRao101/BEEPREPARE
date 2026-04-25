const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const appSettingsSchema = new Schema({
  key:       { type: String, required: true, unique: true },
  value:     { type: Schema.Types.Mixed },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

let _AppSettings = null;

const getAppSettings = () => {
  if (!_AppSettings) _AppSettings = getMainConn().model('AppSettings', appSettingsSchema);
  return _AppSettings;
};

const AppSettings = new Proxy(function() {}, {
  get(_, prop) { return getAppSettings()[prop]; },
  construct(_, args) { return new (getAppSettings())(...args); }
});

const seedSettings = async () => {
  const AppSettingsModel = getAppSettings();
  const defaultSettings = [
    { key: 'maintenance_mode', value: false },
    { key: 'maintenance_message', value: 'We are upgrading BEEPREPARE. Back soon!' },
    { key: 'announcement_active', value: false },
    { key: 'announcement_text', value: '' },
    { key: 'announcement_target', value: 'all' },
    { key: 'announcement_expires', value: null },
    { key: 'activation_price', value: 250 },
    { key: 'extra_slot_price', value: 100 },
    { key: 'allowed_origins', value: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5000', 'https://beeprepare.vercel.app'] }
  ];

  try {
    for (const setting of defaultSettings) {
      const exists = await AppSettingsModel.findOne({ key: setting.key });
      if (!exists) {
        await AppSettingsModel.create(setting);
        console.log(`[Seed] Created setting: ${setting.key}`);
      }
    }
  } catch (err) {
    console.error('[Seed Error] AppSettings:', err);
  }
};

module.exports = AppSettings;
module.exports.seedSettings = seedSettings;
