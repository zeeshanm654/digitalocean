// app.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');  // Import CORS
const connectDB = require('./config/database');
const adminApiRoutes = require('./routes/adminroutes');
const userroutes = require('./routes/userroutes');
const extensionroute = require('./routes/extensionroute');
const dotenv = require('dotenv');
const { backendURL } = require('./config/sanitization');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

app.use("/uploads", express.static("uploads"));

// Middleware
app.use(cors({
  origin: ['http://localhost:3005','http://localhost:3000', 'chrome-extension://blnlaibiljcjljkbobcahdlgagffjmaf', 'chrome-extension://blnlaibiljcjljkbobcahdlgagffjmaf'],
  methods: ['GET', 'POST']
}));

app.use(bodyParser.json());

// const userProfile = backendURL + 'assets/user.png';
// console.log("🚀 ~ userProfile:", userProfile)

// Routes
app.use('/api', adminApiRoutes);
app.use('/api/user', userroutes);
app.use('/api/extension', extensionroute);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
