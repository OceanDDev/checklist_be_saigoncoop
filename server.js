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

// ✅ Middleware xử lý JSON & form - THÊM LIMIT Ở ĐÂY
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ (Optional) Middleware log request size để debug
app.use((req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) {
    const size = JSON.stringify(req.body).length;
    console.log(`📦 Request size: ${(size / 1024).toFixed(2)} KB - Path: ${req.path}`);
  }
  next();
});

// ✅ Routes
const userRoutes = require("./routes/users/user.routes");
const checklistRoutes = require("./routes/checklist/checklist.routes");
const authRoutes = require("./routes/auth/auth.routes");
const checklistformRoutes = require("./routes/checklistform/checklistform.routes");
const staffRoutes = require("./routes/staff/staff.routes");
const cuaHangRoutes = require("./routes/dieuvan/cuahang/cuahang.routes");
const rotKienRoutes = require("./routes/dieuvan/rotkien/rotkien.routes");
const checklistBDHFormRoutes = require("./routes/checklistformbdh/checklistformbdh.routes");
const checklistBDHRoutes = require("./routes/checklistbdh/checklistbdh.routes");
const kpiStaff = require("./routes/kpistaff/kpi.routes");
const checkKpiStaff = require("./routes/checkkpistaff/checkkpistaff.routes");
const formKpiStaff = require("./routes/formkpistaff/formkpistaff.routes");
const xuatTraRoutes = require("./routes/dieuvan/xuattra/xuattra.routes.js");
const phieuSoanRoutes = require("./routes/phieusoan/phieusoan.routes.js");
const phuXeRoutes = require("./routes/phuxe/phuxe.routes.js");  
const TbbRoutes = require("./routes/ttb/ttb.routes.js");  
const ThietBiRoutes = require("./routes/ttb/ttb.routes.js");  
app.use("/api/saigoncoop", userRoutes);
app.use("/api/saigoncoop", checklistRoutes);
app.use("/api/saigoncoop", authRoutes);
app.use("/api/saigoncoop", checklistformRoutes);
app.use("/api/saigoncoop", staffRoutes);
app.use("/api/saigoncoop", cuaHangRoutes);
app.use("/api/saigoncoop", rotKienRoutes);
app.use("/api/saigoncoop", checklistBDHFormRoutes);
app.use("/api/saigoncoop", checklistBDHRoutes);
app.use("/api/saigoncoop", kpiStaff);
app.use("/api/saigoncoop", checkKpiStaff);
app.use("/api/saigoncoop", formKpiStaff);
app.use("/api/saigoncoop", xuatTraRoutes);
app.use("/api/saigoncoop", phieuSoanRoutes);
app.use("/api/saigoncoop", phuXeRoutes);
app.use("/api/saigoncoop", TbbRoutes);
app.use("/api/saigoncoop", ThietBiRoutes);



// ✅ Kết nối MongoDB
 mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));
