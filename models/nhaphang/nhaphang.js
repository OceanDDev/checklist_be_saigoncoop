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
  loai_hinh: { type: String }, // "Nhập" | "Put" | "Let" — loại BẢN GHI trong hệ thống
  so_phieu_nhap: { type: String }, // MỚI — cột "Số phiếu nhập" trong Excel
  loai_hinh_nhap: { type: String }, // MỚI — cột "Loại hình nhập" trong Excel (khác với field loai_hinh ở trên)
  so_po: { type: String }, // MỚI — cột "Số Po" trong Excel
  nhan_vien_nhap: { type: String },
  nhan_vien_put: { type: String },
  nhan_vien_let: { type: String },
  ngay_nhap_kho: { type: Date }, // chỉ dùng cho loai_hinh "Nhập"/"Put"
  ngay_nhan_let: { type: Date }, // chỉ dùng cho loai_hinh "Let"
  ngay_gio_tao_let: { type: Date }, // chỉ dùng cho loai_hinh "Let"
  ngay_gio_hoan_thanh: { type: Date },
  ngay_import: { type: Date },
  ngay_san_xuat: { type: Date },
  ngay_het_han: { type: Date },
});

// Đảm bảo mỗi TỔ HỢP:
//   lpn + kho + sku + name + so_phieu_nhap + vi_tri + loai_hinh_nhap +
//   so_po + ngay_san_xuat + ngay_het_han
// chỉ có 1 bản ghi cho loai_hinh "Nhập"/"Put" — dùng cho upsert khi import
// Excel: trùng CẢ 10 field trên -> cập nhật lại (Kiện/Tổng SL/Trạng thái),
// khác đi dù chỉ 1 field -> bản ghi mới (insert).
//
// partialFilterExpression loại trừ:
//  - bản ghi lpn không phải string (dữ liệu cũ/lỗi không có LPN)
//  - loai_hinh = "Let" (1 LPN có thể được châm hàng nhiều lần -> mỗi lần
//    Let là 1 bản ghi riêng, không được upsert đè lên nhau)
//
// ⚠️ ĐÂY LÀ INDEX MỚI thay cho index cũ { lpn, loai_hinh, vi_tri, sku, kho }.
// Cần xóa index cũ trên MongoDB trước khi deploy (mongoose không tự đổi
// định nghĩa index đã tồn tại), chạy trong mongo shell / Compass:
//   db.nhaphangs.dropIndex("lpn_1_loai_hinh_1_vi_tri_1_sku_1_kho_1")
// rồi để mongoose tự tạo lại index mới theo khai báo bên dưới (hoặc chạy
// syncIndexes() cho model này khi khởi động server).
nhapHangSchema.index(
  {
    lpn: 1,
    kho: 1,
    sku: 1,
    name: 1,
    so_phieu_nhap: 1,
    vi_tri: 1,
    loai_hinh_nhap: 1,
    so_po: 1,
    ngay_san_xuat: 1,
    ngay_het_han: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      lpn: { $type: "string" },
      loai_hinh: { $ne: "Let" },
    },
  },
);

module.exports = mongoose.model("NhapHang", nhapHangSchema);
