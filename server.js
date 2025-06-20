const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

// Load biến môi trường từ .env
dotenv.config();

const app = express();

// Cổng do Render cung cấp
const PORT = process.env.PORT || 5000;

// Middleware
cors({
    origin: "https://checklist-fe-saigoncoop.onrender.com", 
    credentials: true,
  })
app.use(express.json());

// Routes
const userRoutes = require("./routes/users/user.routes");
const checklistRoutes = require("./routes/checklist/checklist.routes");
const authRoutes = require("./routes/auth/auth.routes");

app.use("/api/saigoncoop", userRoutes);
app.use("/api/saigoncoop", checklistRoutes);
app.use("/api/saigoncoop", authRoutes);

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));
