const mongoose = require("mongoose");

const bookXeSchema = new mongoose.Schema(
  {
    thoi_gian_xuat: {
      type: String,
      required: true,
      trim: true,
    },
    quan: {
      type: String,
      trim: true,
    },
    so_luong_ch: {
      type: String,
      trim: true,
    },
    ma_ch: {
      type: String,
      trim: true,
    },
    ten_ch: {
      type: String,
      trim: true,
    },
    ma_ncv: {
      type: String,
      trim: true,
    },
    ten_nvc: {
      type: String,
      trim: true,
    },

    lich_di_hang: {
      type: String,
    },

    kien: {
      type: Number,
      default: 0,
    },
    trangThai: {
      type: String,
      enum: ["Chưa Book", "Chờ xe", "Hoàn thành"],
      default: "Chưa soạn",
    },
    tgImport: {
      type: Date,
    },
    tgHoanThanh: {
      type: Date,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("bookXe", bookXeSchema);
