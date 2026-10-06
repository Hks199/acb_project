const mongoose = require('mongoose');
// Serialize mutations so concurrent toggles of the same announcement retry
// against its latest state. Announcements activate independently.
module.exports = mongoose.model('AnnouncementLock', new mongoose.Schema({
  _id: { type: String }, revision: { type: Number, default: 0 },
}));
