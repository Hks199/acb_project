const mongoose = require('mongoose');
const { badgeTypes, validTargetUrl } = require('../helpers/announcementValidation');
const schema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 255 },
  badge: {
    type: { type: String, enum: badgeTypes, default: 'info' },
    text: { type: String, trim: true, maxlength: 15, default: '' },
  },
  targetUrl: { type: String, trim: true, maxlength: 2048, default: '', validate: validTargetUrl },
  isActive: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ isActive: 1, updatedAt: -1 });
module.exports = mongoose.model('Announcement', schema);
