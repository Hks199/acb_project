const mongoose = require('mongoose');
const Campaign = require('../models/popupCampaignModel');
const Subscription = require('../models/popupSubscriptionModel');
const Lock = require('../models/popupCampaignLockModel');
const { s3UploadHandler } = require('../helpers/s3BucketUploadHandler');
const { CustomError } = require('../errors/CustomErrorHandler');
const { validatePopup, validateCompletePopup, validEmail } = require('../helpers/popupValidation');
const order = { priority_order: 1, createdAt: 1, _id: 1 };
const validId = (id) => /^[a-f\d]{24}$/i.test(id || '');
const requireId = (id) => { if (!validId(id)) throw new CustomError('InvalidInput', 'Invalid campaign ID.', 400); };
async function mutate(work) {
  try { await Lock.updateOne({ _id: 'queue' }, { $setOnInsert: { revision: 0 } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      await Lock.updateOne({ _id: 'queue' }, { $inc: { revision: 1 } }, { session });
      result = await work(session);
    });
    return result;
  } finally { await session.endSession(); }
}
async function find(id, session) {
  const campaign = await Campaign.findById(id).session(session);
  if (!campaign) throw new CustomError('NotFound', 'Campaign not found.', 404);
  return campaign;
}
exports.active = async (req, res, next) => {
  try {
    const campaigns = await Campaign.find({ isActive: true, $or: [{ endsAt: null }, { endsAt: { $gt: new Date() } }] }).sort(order).lean();
    res.set('Cache-Control', 'no-store'); res.json(campaigns);
  } catch (error) { next(error); }
};
exports.list = async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store'); res.json(await Campaign.find().sort(order).lean()); }
  catch (error) { next(error); }
};
exports.create = async (req, res, next) => {
  try {
    const fields = validatePopup(req.body);
    const campaign = await mutate(async (session) => {
      if (fields.priority_order === undefined) {
        const last = await Campaign.findOne().sort({ priority_order: -1 }).session(session);
        fields.priority_order = (last?.priority_order || 0) + 1;
      }
      const document = new Campaign(fields);
      validateCompletePopup(document);
      return document.save({ session });
    });
    res.status(201).json(campaign);
  } catch (error) { next(error); }
};
exports.update = async (req, res, next) => {
  try {
    requireId(req.params.id);
    const fields = validatePopup(req.body, true);
    res.json(await mutate(async (session) => {
      const document = await find(req.params.id, session);
      Object.entries(fields).forEach(([key, value]) => document.set(key, value));
      validateCompletePopup(document);
      return document.save({ session });
    }));
  } catch (error) { next(error); }
};
exports.toggle = async (req, res, next) => {
  try {
    requireId(req.params.id);
    const fields = validatePopup(req.body || {}, true);
    res.json(await mutate(async (session) => {
      const document = await find(req.params.id, session);
      document.isActive = fields.isActive ?? !document.isActive;
      validateCompletePopup(document);
      return document.save({ session });
    }));
  } catch (error) { next(error); }
};
exports.reorder = async (req, res, next) => {
  try {
    const ids = req.body?.campaignIds;
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && validId(id)) || new Set(ids.map((id) => id.toLowerCase())).size !== ids.length) {
      throw new CustomError('InvalidInput', 'Supply every campaign ID exactly once.', 400);
    }
    const normalized = ids.map((id) => id.toLowerCase());
    const result = await mutate(async (session) => {
      const documents = await Campaign.find().session(session);
      if (documents.length !== normalized.length || documents.some((document) => !normalized.includes(String(document._id)))) {
        throw new CustomError('QueueChanged', 'Campaigns changed. Refresh the queue and try again.', 409);
      }
      if (normalized.length) await Campaign.bulkWrite(normalized.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { priority_order: index + 1 } } } })), { session });
      return Campaign.find().sort(order).session(session).lean();
    });
    res.json(result);
  } catch (error) { next(error); }
};
exports.remove = async (req, res, next) => {
  try {
    requireId(req.params.id);
    await mutate(async (session) => { await find(req.params.id, session); await Campaign.deleteOne({ _id: req.params.id }, { session }); });
    res.json({ success: true });
  } catch (error) { next(error); }
};
exports.upload = async (req, res, next) => {
  try {
    const file = req.files?.image;
    if (!file || Array.isArray(file)) throw new CustomError('InvalidInput', 'Choose one campaign image.', 400);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype) || !file.size || file.size > 8 * 1024 * 1024) {
      throw new CustomError('InvalidInput', 'Use a JPG, PNG, WebP or AVIF image up to 8 MB.', 400);
    }
    // Generate a safe object name rather than using paths from the client filename.
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[file.mimetype];
    const uploaded = await s3UploadHandler({ ...file, name: `${new mongoose.Types.ObjectId()}.${extension}` }, 'promotional-popups');
    res.status(201).json({ imageUrl: uploaded.publicUrl });
  } catch (error) { next(error instanceof CustomError ? error : new CustomError('ImageUploadError', error.message || 'Image upload failed.', 500)); }
};
exports.subscribe = async (req, res, next) => {
  try {
    requireId(req.params.id);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!validEmail(email)) throw new CustomError('InvalidInput', 'Enter a valid email address.', 400);
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign || !campaign.isActive || campaign.displayType !== 'newsletter_signup' || (campaign.endsAt && campaign.endsAt <= new Date())) {
      throw new CustomError('CampaignUnavailable', 'This signup campaign is no longer available.', 400);
    }
    try {
      await Subscription.updateOne({ campaignId: campaign._id, email }, { $setOnInsert: { campaignId: campaign._id, email } }, { upsert: true, runValidators: true });
    } catch (error) { if (error.code !== 11000) throw error; }
    res.json({ success: true });
  } catch (error) { next(error); }
};
exports.subscriptions = async (req, res, next) => {
  try {
    requireId(req.params.id);
    res.set('Cache-Control', 'no-store');
    res.json(await Subscription.find({ campaignId: req.params.id }).sort({ createdAt: -1 }).limit(200).select('email createdAt').lean());
  } catch (error) { next(error); }
};
