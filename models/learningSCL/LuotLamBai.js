const mongoose = require("mongoose");

const cauTraLoiSchema = new mongoose.Schema({
  viTriCauHoi: { type: Number },
  luaChonCuaHoc: { type: Number },
  dung: { type: Boolean },
});

const luotLamBaiSchema = new mongoose.Schema(
  {
    tenNguoiLam: { type: String, required: true },   // tên điền vào form
    baiKiemTraId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaiKiemTra",
      required: true,
    },
    baiHocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaiHoc",
      default: null,
    },
    danhSachCauTraLoi: [cauTraLoiSchema],
    diem: { type: Number, default: 0 },
    soCauDung: { type: Number, default: 0 },
    tongSoCau: { type: Number, default: 0 },
    dat: { type: Boolean, default: false },
    nopLuc: { type: Date, default: null },
    quaKenh: { type: String, enum: ["qr", "truc_tiep"], default: "qr" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LuotLamBai", luotLamBaiSchema);