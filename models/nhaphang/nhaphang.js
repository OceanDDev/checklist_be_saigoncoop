const mongoose = require("mongoose");

const nhapHangSchema = new mongoose.Schema({
  sku: { type: String },
  name: { type: String },
  vi_tri: { type: String },
  kien: { type: Number },
  kho: { type: Number },
  tong_sl: { type: Number, default: 0 }, // "Let" import không có cột này -> mặc định 0
  lpn: { type: String },
  trang_thai: { type: String },
  loai_hinh: { type: String }, // "Nhập" | "Put" | "Let"
  nhan_vien_nhap: { type: String },
  nhan_vien_put: { type: String },
  nhan_vien_let: { type: String },
  ngay_nhap_kho: { type: Date }, // chỉ dùng cho loai_hinh "Nhập"/"Put"
  ngay_nhan_let: { type: Date }, // chỉ dùng cho loai_hinh "Let"
  ngay_gio_tao_let: { type: Date }, // chỉ dùng cho loai_hinh "Let"
  ngay_gio_hoan_thanh: { type: Date },
  ngay_import: { type: Date },
});

// Đảm bảo mỗi LPN chỉ có 1 bản ghi cho loai_hinh "Nhập"/"Put" — dùng cho
// upsert khi import Excel (LPN trùng -> cập nhật lại, không tạo bản ghi
// lặp). partialFilterExpression loại trừ:
//  - bản ghi lpn = null/undefined (dữ liệu cũ hoặc dòng lỗi không có LPN)
//  - loai_hinh = "Let" (1 LPN có thể được châm hàng nhiều lần -> mỗi lần
//    Let là 1 bản ghi riêng, không được upsert đè lên nhau)
nhapHangSchema.index(
  { lpn: 1, loai_hinh: 1 },
  {
    unique: true,
    partialFilterExpression: {
      lpn: { $type: "string" },
      loai_hinh: { $ne: "Let" },
    },
  },
);

module.exports = mongoose.model("NhapHang", nhapHangSchema);
