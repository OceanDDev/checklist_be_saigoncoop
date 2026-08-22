const mongoose = require("mongoose");

const nhapHangSchema = new mongoose.Schema({
  sku: { type: String, required: true },
  name: { type: String, required: true },
  vi_tri: { type: String, required: true },
  kien: { type: Number, required: true },
  kho: { type: Number, required: true },
  tong_sl: { type: Number, required: true, default: 0 }, // "Let" import không có cột này -> mặc định 0
  trang_thai: { type: String, required: true },
  loai_hinh: { type: String, required: true }, // "Nhập" | "Put" | "Let"
  ngay_nhap_kho: { type: Date }, // chỉ dùng cho loai_hinh "Nhập"/"Put"
  ngay_let: { type: Date }, // chỉ dùng cho loai_hinh "Let" (map từ cột "Ngày Giờ Tạo")
  ngay_import: { type: Date },
});

module.exports = mongoose.model("NhapHang", nhapHangSchema);
