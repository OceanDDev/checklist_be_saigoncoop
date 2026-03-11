// models/chamcong/chamcong.js
const mongoose = require("mongoose");

const chamCongSchema = new mongoose.Schema({
  ten_nhan_vien: { type: String, required: true },
  ma_nhan_vien:  { type: String, required: true },
  bo_phan:       { type: String, required: true },
  ngay:          { type: Date,   required: true },
  gio_vao:       { type: Date,   default: null },
  gio_ra:        { type: Date,   default: null },
  tong_gio:      { type: Number, default: 0 },
  ghi_chu:       { type: String, default: "" },
  device_id:     { type: String, default: "" },

  // ─── Năng suất cuối ngày (import từ bảng tổng kết) ──────────────────────
  ngay_nang_suat: { type: Date,   default: null }, // ngày của bảng năng suất
  so_phieu:       { type: Number, default: null }, // cột Phiếu
  so_kien:       { type: Number, default: null }, // cột Kiện
  so_dong:       { type: Number, default: null }, // cột Dòng

  // ─── Ghi nhận vi phạm chấm hộ ───────────────────────────────────────────
  vi_pham_cham_ho:   { type: Boolean, default: false },
  vi_pham_device_id: { type: String,  default: "" },
  vi_pham_thoi_gian: { type: Date,    default: null },
  vi_pham_so_lan:    { type: Number,  default: 0 },
});

chamCongSchema.index({ ma_nhan_vien: 1, ngay: 1 }, { unique: true });

module.exports = mongoose.model("ChamCong", chamCongSchema);