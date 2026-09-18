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

// Đảm bảo mỗi TỔ HỢP (lpn + loai_hinh + vi_tri + sku + kho) chỉ có 1 bản
// ghi cho loai_hinh "Nhập"/"Put" — dùng cho upsert khi import Excel:
// trùng CẢ tổ hợp -> cập nhật lại, khác đi dù chỉ 1 phần (vd cùng LPN
// nhưng khác vi_tri, vì 1 LPN có thể chia ra nhiều vị trí) -> bản ghi mới.
//
// partialFilterExpression loại trừ:
//  - bản ghi lpn không phải string (dữ liệu cũ/lỗi không có LPN — hiện
//    controller đã chặn không cho các dòng này import nữa, giữ điều kiện
//    này để an toàn với data cũ đã có sẵn trong DB)
//  - loai_hinh = "Let" (1 LPN có thể được châm hàng nhiều lần -> mỗi lần
//    Let là 1 bản ghi riêng, không được upsert đè lên nhau)
//
// ⚠️ Vì đây là index MỚI thay cho index cũ { lpn: 1, loai_hinh: 1 }, cần
// xóa index cũ trên MongoDB trước khi deploy (mongoose không tự đổi tên/
// định nghĩa index đã tồn tại), ví dụ chạy trong mongo shell / Compass:
//   db.nhaphangs.dropIndex("lpn_1_loai_hinh_1")
// rồi để mongoose tự tạo lại index mới theo khai báo bên dưới (hoặc chạy
// syncIndexes() cho model này khi khởi động server).
nhapHangSchema.index(
  { lpn: 1, loai_hinh: 1, vi_tri: 1, sku: 1, kho: 1 },
  {
    unique: true,
    partialFilterExpression: {
      lpn: { $type: "string" },
      loai_hinh: { $ne: "Let" },
    },
  },
);

module.exports = mongoose.model("NhapHang", nhapHangSchema);
