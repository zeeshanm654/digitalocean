const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require('multer');
const path = require('path');
const cron = require('node-cron');
require("dotenv").config();
// const url = "https://backendapp.threearrowstech.com"

const encryptionKey = process.env.KEY;

const { adminAuthorization } = require("../config/sanitization");
const secretKey = process.env.jwtSecretKey;

// const image_base_url = process.env.image_base_url;
const image_base_url = '';

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const employeeName = req.body.name.replace(/\s+/g, '_').toLowerCase(); // Replace spaces with underscores and make lowercase
    const fileExtension = path.extname(file.originalname);
    cb(null, `${employeeName}${fileExtension}`); // Save file with employee name + original extension
  },
});

const upload = multer({ storage: storage });


module.exports = router;
