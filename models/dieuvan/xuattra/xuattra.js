const mongoose = require("mongoose");

const xuatTraSchema = new mongoose.Schema(
  {
    maCH: { type: String, required: true },
    tenCH: { type: String, required: true },
    soKien: { type: Number, min: 0 },
    sku: { type: Number, required: true },
    soSoda: { type: String, min: 0 },
    ngayCapNhap: { type: Date, default: Date.now, required: true },
    ghiChu: { type: String },
    trangThai: { type: Boolean, default: false }, // true: hoàn tất, false: chưa,
  },
  {
    timestamps: true, // tự động thêm createdAt và updatedAt
  }
);

module.exports = mongoose.model("XuatTra", xuatTraSchema);
