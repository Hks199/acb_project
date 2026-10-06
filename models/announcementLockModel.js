const mongoose = require('mongoose');
// Every mutation writes this singleton first inside a transaction. Concurrent
// activations therefore conflict and retry, even when no bar is currently active.
module.exports = mongoose.model('AnnouncementLock', new mongoose.Schema({
  _id: { type: String }, revision: { type: Number, default: 0 },
}));
