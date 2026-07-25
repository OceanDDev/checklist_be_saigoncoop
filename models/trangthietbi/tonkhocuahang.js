const mongoose = require("mongoose");

// Tồn kho trang thiết bị theo TỪNG CỬA HÀNG + TỪNG LOẠI TTB + TỪNG KỲ (tháng)
// Công thức: ton_cuoi_ky = ton_dau_ky + tong_giao - tong_tra
const tonKhoCuaHangSchema = new mongoose.Schema(
  {
    ma_ch: {
      type: String,
      required: true,
      trim: true,
    },
    ten_ch: {
      type: String,
      trim: true,
    },
    loai_ttb: {
      type: String,
      required: true,
      trim: true,
    },

    // Kỳ dạng "YYYY-MM", ví dụ "2026-06"
    ky: {
      type: String,
      required: true,
      trim: true,
    },

    ton_dau_ky: {
      type: Number,
      default: 0,
      min: 0,
    },
    tong_giao: {
      type: Number,
      default: 0,
      min: 0,
    },
    tong_tra: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Có thể âm: cửa hàng trả dư (tong_tra > ton_dau_ky + tong_giao)
    ton_cuoi_ky: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Mỗi cửa hàng + loại TTB + kỳ chỉ có duy nhất 1 record
tonKhoCuaHangSchema.index({ ma_ch: 1, loai_ttb: 1, ky: 1 }, { unique: true });

module.exports = mongoose.model("TonKhoCuaHang", tonKhoCuaHangSchema);
