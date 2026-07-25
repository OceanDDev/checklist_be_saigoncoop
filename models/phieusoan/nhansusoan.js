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
  },
  { timestamps: true }
);

module.exports = mongoose.model("nhanSuSoan", nhanSuSoanSchema);