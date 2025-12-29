// models/phuxe/chbx.js
const mongoose = require("mongoose");

const chbxSchema = new mongoose.Schema(
  {
    ma_cua_hang: {
      type: String,
      required: [true, "Mã cửa hàng là bắt buộc"],
      unique: true, // ⬅️ Đảm bảo mã không trùng
      trim: true,
      uppercase: true, // Tự động chuyển thành chữ hoa (CH00001)
    },
    ten_cua_hang: {
      type: String,
      required: [true, "Tên cửa hàng là bắt buộc"],
      trim: true,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
    collection: "chbx", // Tên collection trong MongoDB
  }
);

// ⬅️ Tạo index để tìm kiếm nhanh hơn
chbxSchema.index({ ma_cua_hang: 1 }, { unique: true });
chbxSchema.index({ ten_cua_hang: 1 });

module.exports = mongoose.model("Chbx", chbxSchema);
