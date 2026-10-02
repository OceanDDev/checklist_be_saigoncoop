const mongoose = require("mongoose");

const xuatHangSchema = new mongoose.Schema({
  ma_kho: { type: String },
  so_bb: { type: String },
  ma_booking: { type: String },
  ma_ldd: { type: String },
  ngay_xe_vao_ttpp: { type: Date },
  ngay_ttpp_yeu_cau_vao: { type: Date },
  thoi_gian_roi_kho_cuoi: { type: Date },
  ngay_bat_dau_len_hang: { type: Date },
  ngay_ket_thuc_len_hang: { type: Date },
  ma_nvc: { type: String },
  ten_nvc: { type: String },
  so_kien: { type: Number },
  ma_ch: { type: String },
  ten_ch: { type: String },
  nhan_vien_xuat_hang: { type: String },
  nhan_vien_xuat_phu: { type: String },
  loai_hinh_van_chuyen: { type: String },
  concept: { type: String },
  ngay_import: { type: Date },
});

module.exports = mongoose.model("XuatHang", xuatHangSchema);
