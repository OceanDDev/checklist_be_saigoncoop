const mongoose = require("mongoose");

const chamCongSchema = new mongoose.Schema({
  ho_ten: { type: String, required: true },
  ten_nhan_vien: { type: String, required: true },
  ma_nhan_vien: { type: String, required: true },
  bo_phan: { type: String, required: true },
  mac_address: { type: String, required: true },
  ngay: { type: Date, required: true },
  gio_vao: { type: Date, default: null },
  gio_ra: { type: Date, default: null },
  tong_gio: { type: Number, default: 0 },
  ghi_chu: { type: String, default: "" },
});

// Mỗi nhân viên chỉ có 1 bản ghi mỗi ngày
chamCongSchema.index({ ma_nhan_vien: 1, ngay: 1 }, { unique: true });

module.exports = mongoose.model("ChamCong", chamCongSchema);