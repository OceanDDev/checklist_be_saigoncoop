const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

// Load .env
dotenv.config();

const app = express();

// Port và Host để chạy nội bộ
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0"; // Cho phép các thiết bị trong cùng Wi-Fi truy cập

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const userRoutes = require("./routes/users/user.routes");
const checklistRoutes = require("./routes/checklist/checklist.routes");
const authRoutes = require("./routes/auth/auth.routes");

app.use("/api/saigoncoop", userRoutes);
app.use("/api/saigoncoop", checklistRoutes);
app.use("/api/saigoncoop", authRoutes);

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, HOST, () =>
      console.log(`🚀 Server running at http://${getLocalIP()}:${PORT}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Hàm lấy IP mạng LAN (IPv4)
function getLocalIP() {
  const os = require("os");
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}
