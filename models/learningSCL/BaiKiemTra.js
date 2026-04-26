const mongoose = require("mongoose");

const cauHoiSchema = new mongoose.Schema({
  noiDung: { type: String, required: true },
  cacLuaChon: [{ type: String, required: true }], // 2–6 lựa chọn
  dapAnDung: { type: Number, required: true },     // index đáp án đúng
  giaiThich: { type: String, default: "" },        // hiển thị sau khi nộp bài
});

const baiKiemTraSchema = new mongoose.Schema(
  {
    tieuDe: { type: String, required: true },
    baiHocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaiHoc",
      default: null,
    },
    nguoiTao: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    danhSachCauHoi: [cauHoiSchema],
    caiDat: {
      thoiGianLamBai: { type: Number, default: 0 },     // giây, 0 = không giới hạn
      diemDauVao: { type: Number, default: 60 },         // % để pass
      xaoTronCauHoi: { type: Boolean, default: false },
      xaoTronDapAn: { type: Boolean, default: false },
      hienThiKetQua: { type: Boolean, default: true },
      soLanToiDa: { type: Number, default: 0 },          // 0 = không giới hạn
    },
    qrToken: { type: String, default: null },
    qrHetHanLuc: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BaiKiemTra", baiKiemTraSchema);