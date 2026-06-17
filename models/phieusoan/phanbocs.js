const mongoose = require("mongoose");

const phanboCSSchema = new mongoose.Schema({
  ten_phan_bo: { type: String, required: true },
  sku: { type: Number, required: true },
  sd_tf: { type: Number },
  name: { type: String, required: true },
  pack: { type: Number, required: true },
  mach: { type: String, required: true },
  tench: { type: String, required: true },
  luong_phan_bo: { type: Number, required: true },
  chuyen: { type: String },
  gia: { type: Number },
  trang_thai: {
    type: String,
    enum: ["cho_xu_li", "dang_xu_li", "da_xu_li"],
    default: "cho_xu_li",
  },
  ngay_xu_li: { type: Date, default: null },
  ngay_import: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PhanBoCS", phanboCSSchema);