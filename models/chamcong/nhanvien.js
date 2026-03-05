// models/nhanvien/nhanvien.js
const mongoose = require("mongoose");

const nhanVienSchema = new mongoose.Schema(
  {
    ma_nhan_vien:  { type: String, required: true, unique: true, trim: true, uppercase: true },
    ten_nhan_vien: { type: String, required: true, trim: true },
    bo_phan:       { type: String, required: true, trim: true },
    chuc_vu:       { type: String, default: "" },
    email:         { type: String, default: "" },
    so_dien_thoai: { type: String, default: "" },
    active:        { type: Boolean, default: true }, // false = bị khóa, không cho chấm công
  },
  { timestamps: true }
);

module.exports = mongoose.model("NhanVien", nhanVienSchema);