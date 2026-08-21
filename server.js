const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { startQrRotation } = require("./controllers/chamcong/qr.controller");
const multer = require("multer");

dotenv.config();
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// 🔥 TỐI ƯU 1: Cấu hình Timeout cho HTTP Server để tránh treo request dắt dây gây lỗi 502
server.keepAliveTimeout = 65000; // Giữ kết nối lâu hơn Nginx một chút (Nginx thường là 60s)
server.headersTimeout = 66000;

const allowedOrigins = process.env.CORS_ORIGINS?.split(",") || [];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// 🔥 TỐI ƯU 2: Tối ưu cấu hình Socket.io cho môi trường Production qua Nginx Proxy
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"], // Ưu tiên kết nối thẳng bằng websocket trước
  pingTimeout: 60000, // Tăng thời gian chờ ping/pong lên 60s chống rớt mạng ảo
  pingInterval: 25000, // Gửi gói tin ping định kỳ mỗi 25s để duy trì kết nối sống qua Cloudflare
});

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected:", socket.id);
  });
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) {
    const size = JSON.stringify(req.body).length;
    console.log(
      `📦 Request size: ${(size / 1024).toFixed(2)} KB - Path: ${req.path}`,
    );
  }
  next();
});

// ── Routes (Giữ nguyên 100%) ──────────────────────────────────────────────────
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
const PhieuLeRoutes = require("./routes/phieusoan/phieule.routes.js");
const ChamCongRoutes = require("./routes/chamcong/chamcong.routes.js");
const NangSuatRoutes = require("./routes/nangsuat/nangsuat.routes.js");
const LearningRoutes = require("./routes/leaningSCL/learning.routes.js");
const TonKhoRoutes = require("./routes/tonkho/tonkho.routes.js");
const QuanLyHDRoutes = require("./routes/quanlyhd/quanlyhd.routes.js");
const TrangThietBiRoutes = require("./routes/trangthietbi/trangthiebi.routes.js");
const BookXeRoutes = require("./routes/bookxe/bookxe.routes.js");
const KhuyenMaiRoutes = require("./routes/khuyenmai/khuyenmai.routes.js");
const NhapHangRoutes = require("./routes/nhaphang/nhaphang.routes.js");

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
app.use("/api/saigoncoop", PhieuLeRoutes);
app.use("/api/saigoncoop", ChamCongRoutes);
app.use("/api/saigoncoop", NangSuatRoutes);
app.use("/api/saigoncoop", LearningRoutes);
app.use("/api/saigoncoop", TonKhoRoutes);
app.use("/api/saigoncoop", QuanLyHDRoutes);
app.use("/api/saigoncoop", TrangThietBiRoutes);
app.use("/api/saigoncoop", BookXeRoutes);
app.use("/api/saigoncoop", KhuyenMaiRoutes);
app.use("/api/saigoncoop", NhapHangRoutes);



app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ loi: "File quá lớn" });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ loi: err.message });
  }
  next(err);
});

// 🔥 TỐI ƯU 3: Cấu hình Connection Pool cho MongoDB để tránh nghẽn luồng truy vấn lúc cao điểm
mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 50, // Cho phép tối đa 50 kết nối đồng thời gánh tải (mặc định là 10)
    minPoolSize: 10, // Luôn duy trì sẵn 10 kết nối trống để chạy ngay không mất công đợi khởi tạo
    serverSelectionTimeoutMS: 5000, // Nếu MongoDB đơ quá 5s thì ngắt lệnh ngay, tránh làm đứng cứng ngắc toàn bộ Node.js
    socketTimeoutMS: 45000, // Ngắt các truy vấn treo quá 45 giây
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      startQrRotation(io);
      console.log("📱 QR rotation started");
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));
