const mongoose = require("mongoose");

const nhanSuSoanSchema = new mongoose.Schema(
  {
    soDonHang: {
      type: String,
      required: true,
      trim: true,
    },
    soPhieuGop: {
      type: String,
      trim: true,
    },
    maNXD: {
      type: String,
      trim: true,
    },
    noiXuatDen: {
      type: String,
      trim: true,
    },
    chuyen: {
      type: String,
      trim: true,
    },
    lichDiHang: {
      type: String,
    },
    nvSoan: {
      type: [String], // mảng ma_nhan_vien, tra cứu tên/bộ phận qua API NhanVien có sẵn (model NhanVien, field ma_nhan_vien)
      default: [],
    },
    nvKC: {
      type: [String], // mảng ma_nhan_vien, tra cứu tên/bộ phận qua API NhanVien có sẵn (model NhanVien, field ma_nhan_vien)
      default: [],
    },
    kien: {
      type: Number,
      default: 0,
    },
    dong: {
      type: Number,
      default: 0,
    },
    trangThai: {
      type: String,
      enum: ["Chưa soạn", "Đang soạn", "Hoàn thành"],
      default: "Chưa soạn",
    },
    tgImport: {
      type: Date,
    },
    tgHoanThanh: {
      type: Date,
    },
    tgNhanPhieu: {
      type: Date,
    },
    trangThaiBookXe: {
      type: String,
      enum: ["Chờ Book", "Chờ Xe", "Hoàn thành"],
      default: "Chờ Book",
    },
    kien_du_kien: {
      type: Number,
      default: 0,
    },
    // [MỚI] true khi phiếu đã được cập nhật bằng chức năng "Update Kiện DK".
    // suggestBookXe dùng cờ này để luôn lấy kien_du_kien (thay vì kien thực tế),
    // kể cả khi phiếu đã Hoàn thành. Kiện dự kiến có từ lúc import thì cờ vẫn false.
    daUpdateKienDuKien: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("nhanSuSoan", nhanSuSoanSchema);
