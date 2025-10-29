const mongoose = require("mongoose");

const donHangSchema = new mongoose.Schema({
  store: {
    type: String, // Đổi thành String để lưu maCH
    required: true,
  },
  type: {
    type: String,
    enum: ["Soda", "Transfer"],
    required: true,
  },
  soda_transfer: { type: Number, required: true },
  sku: { type: Number, required: true },
  name: { type: String, required: true },
  luong: { type: Number, required: true },
  ngay_import: { type: Date, default: Date.now },

  trang_thai: {
    type: Boolean,
    default: false, // false = chưa hoàn thành, true = đã hoàn thành
  },
});

module.exports = mongoose.model("DonHang", donHangSchema);
