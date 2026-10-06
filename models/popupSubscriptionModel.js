const mongoose = require('mongoose');
const { validEmail } = require('../helpers/popupValidation');
const schema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'PopupCampaign', required: true },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, validate: validEmail },
}, { timestamps: true });
schema.index({ campaignId: 1, email: 1 }, { unique: true });
module.exports = mongoose.model('PopupSubscription', schema);
