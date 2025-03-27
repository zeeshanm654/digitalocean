const mongoose = require('mongoose');

const Creator = new mongoose.Schema({
    linkedAccountId: { type: String, required: true, },
    linkedAccountPageId: { type: String },
    name: { type: String },
    url: { type: String },
    imageUrl: { type: String },
    tagLine: { type: String },
    status: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Creator', Creator);
