const mongoose = require("mongoose");

const rotKienSchema = new mongoose.Schema(
  {
    maCH: { type: String, required: true },
    tenCH: { type: String, required: true },
      soKienRot: { type: Number, min: 0 }, 
    soSoda: { type: String, min: 0 },
    ngayRotKien:  { type: Date, default: Date.now ,required: true},
    ghiChu: { type: String },
    trangThai: { type: Boolean, default: false }, // true: hoàn tất, false: chưa,
    boPhan: { type: String } // Thêm trường bộ phận

  },
  {
    timestamps: true // tự động thêm createdAt và updatedAt
  }
);

module.exports = mongoose.model("RotKien", rotKienSchema);
