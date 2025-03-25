const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  username: { type: String },
  loginType: { type: String, required: true },
  emailStatus: { type: String, default: 'verified' },
  forgotpasswordotp: { type: String },
  packageid: { type: String },
  cookie: { type: String },
  extensionStatus: { type: Boolean },
  cookieStatus: { type: Boolean },
  contact: { type: String },  // New field
  address1: { type: String }, // New field
  address2: { type: String }, // New field
  city: { type: String },     // New field
  country: { type: String },  // New field
  bio: { type: String },      // New field
  image: { type: String }     // New field
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
