const mongoose = require("mongoose");

const nhapHangSchema = new mongoose.Schema({
  sku: { type: String, required: true },
  name: { type: String, required: true },
  vi_tri:{ type: String, required: true },
  kien: { type: Number, required: true },
  kho:{ type: Number, required: true },
  tong_sl: { type: Number, required: true },
  trang_thai: { type: String, required: true },
  ngay_nhap_kho: { type: Date },
  ngay_import: { type: Date },
  
});

module.exports = mongoose.model("NhapHang", nhapHangSchema);
