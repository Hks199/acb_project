const mongoose = require('mongoose');
const Announcement = require('../models/announcementModel');
const Lock = require('../models/announcementLockModel');
const { CustomError } = require('../errors/CustomErrorHandler');
const { validateAnnouncement } = require('../helpers/announcementValidation');

async function mutate(work) {
  // Initialize outside the transaction; the fixed _id prevents duplicate locks.
  try { await Lock.updateOne({ _id: 'single-bar' }, { $setOnInsert: { revision: 0 } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      await Lock.updateOne({ _id: 'single-bar' }, { $inc: { revision: 1 } }, { session });
      result = await work(session);
    });
    return result;
  } finally { await session.endSession(); }
}
const requireId = (id) => {
  if (!/^[a-f\d]{24}$/i.test(id || '')) throw new CustomError('InvalidInput', 'Invalid announcement ID.', 400);
};
const findDocument = async (id, session) => {
  const document = await Announcement.findById(id).session(session);
  if (!document) throw new CustomError('NotFound', 'Announcement not found.', 404);
  return document;
};
exports.getActive = async (req, res, next) => {
  try {
    const announcements = await Announcement.find({ isActive: true }).sort({ createdAt: 1, _id: 1 }).lean();
    res.set('Cache-Control', 'no-store');
    res.json(announcements);
  } catch (error) { next(error); }
};
exports.getAll = async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store'); res.json(await Announcement.find().sort({ updatedAt: -1 }).lean()); }
  catch (error) { next(error); }
};
exports.create = async (req, res, next) => {
  try {
    const fields = validateAnnouncement(req.body);
    const result = await mutate(async (session) => {
      const document = new Announcement();
      Object.entries(fields).forEach(([key, value]) => document.set(key, value));
      return document.save({ session });
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
};
exports.update = async (req, res, next) => {
  try {
    requireId(req.params.id);
    const fields = validateAnnouncement(req.body, true);
    const result = await mutate(async (session) => {
      const document = await findDocument(req.params.id, session);
      Object.entries(fields).forEach(([key, value]) => document.set(key, value));
      return document.save({ session });
    });
    res.json(result);
  } catch (error) { next(error); }
};
exports.toggle = async (req, res, next) => {
  try {
    requireId(req.params.id);
    const fields = validateAnnouncement(req.body || {}, true);
    const result = await mutate(async (session) => {
      const document = await findDocument(req.params.id, session);
      document.isActive = fields.isActive ?? !document.isActive;
      return document.save({ session });
    });
    res.json(result);
  } catch (error) { next(error); }
};
