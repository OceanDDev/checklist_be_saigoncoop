const mongoose = require("mongoose");

const rotKienSchema = new mongoose.Schema(
  {
    stt: { type: Number, required: false },
    maCH: { type: String, required: true },
    tenCH: { type: String, required: true },
    soKienRot: { type: Number, required: true },
    soSoda: { type: Number, required: true },
    ngayRotKien: { type: Date, required: true },
    ghiChu: { type: String },
    trangThai: { type: Boolean, default: false } // true: hoàn tất, false: chưa
  },
  {
    timestamps: true // tự động thêm createdAt và updatedAt
  }
);

module.exports = mongoose.model("RotKien", rotKienSchema);
