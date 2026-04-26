const mongoose = require("mongoose");

const khoaHocSchema = new mongoose.Schema(
  {
    tieuDe: { type: String, required: true },
    moTa: { type: String, default: "" },
    anhBia: { type: String, default: "" },
    danhSachBaiHoc: [{ type: mongoose.Schema.Types.ObjectId, ref: "BaiHoc" }],
    nguoiTao: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    daXuatBan: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KhoaHoc", khoaHocSchema);