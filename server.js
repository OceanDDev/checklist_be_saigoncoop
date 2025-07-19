const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Khai báo allowedOrigins trước khi dùng
const allowedOrigins = process.env.CORS_ORIGINS?.split(",") || [];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// ✅ Middleware xử lý JSON & form
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Routes
const userRoutes = require("./routes/users/user.routes");
const checklistRoutes = require("./routes/checklist/checklist.routes");
const authRoutes = require("./routes/auth/auth.routes");
const checklistformRoutes = require("./routes/checklistform/checklistform.routes");
const staffRoutes = require("./routes/staff/staff.routes");
const cuaHangRoutes =  require("./routes/dieuvan/cuahang/cuahang.routes");
const rotKienRoutes =  require("./routes/dieuvan/rotkien/rotkien.routes");


app.use("/api/saigoncoop", userRoutes);
app.use("/api/saigoncoop", checklistRoutes);
app.use("/api/saigoncoop", authRoutes);
app.use("/api/saigoncoop", checklistformRoutes);
app.use("/api/saigoncoop", staffRoutes);
app.use("/api/saigoncoop", cuaHangRoutes);
app.use("/api/saigoncoop", rotKienRoutes);


// ✅ Kết nối MongoDB
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
