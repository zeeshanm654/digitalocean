const mongoose = require('mongoose');

const CommentDetail = new mongoose.Schema({
    userid: { type: String, required: true, },
    creatorid: { type: String },
    keywordid: { type: String },
    comment: { type: String, },
    postData: { type: String },
    postUrl: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('CommentDetail', CommentDetail);
