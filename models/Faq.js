const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, maxlength: 300 },
  answer: { type: String, required: true, trim: true, maxlength: 10000 },
  isActive: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0, min: 0, max: 1000000, validate: Number.isInteger },
}, { timestamps: true, collection: 'faqs' });
faqSchema.index({ isActive: 1, sortOrder: 1, createdAt: 1, _id: 1 });

module.exports = mongoose.model('Faq', faqSchema);
