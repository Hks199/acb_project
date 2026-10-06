const mongoose = require('mongoose');
const { displayTypes, themes, validCtaUrl } = require('../helpers/popupValidation');
const { validTargetUrl } = require('../helpers/announcementValidation');
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  subtitle: { type: String, trim: true, maxlength: 500, default: '' },
  imageUrl: { type: String, trim: true, maxlength: 2048, default: '', validate: validTargetUrl },
  imageFit: { type: String, enum: ['cover', 'contain'], default: 'cover' },
  imagePosition: { type: String, enum: ['center', 'top', 'bottom', 'left', 'right'], default: 'center' },
  showImageOnMobile: { type: Boolean, default: true },
  ctaText: { type: String, required: true, trim: true, maxlength: 50 },
  ctaUrl: { type: String, trim: true, maxlength: 2048, default: '', validate: validCtaUrl },
  couponCode: { type: String, trim: true, maxlength: 40, default: '' },
  displayType: { type: String, enum: displayTypes, default: 'promotion' },
  backgroundTheme: { type: String, enum: themes, default: 'glass_dark' },
  priority_order: { type: Number, min: 1, default: 1, validate: Number.isSafeInteger },
  isActive: { type: Boolean, default: false },
  endsAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ isActive: 1, priority_order: 1, _id: 1 });
module.exports = mongoose.model('PopupCampaign', schema);
