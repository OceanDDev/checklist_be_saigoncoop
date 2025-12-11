const mongoose = require("mongoose");

const chiTietSchema = new mongoose.Schema({
  noi_dung_chi_tiet: { type: String, required: true },
  da_chon: { type: Boolean, default: false },
});

const congViecSchema = new mongoose.Schema({
  noidung: { type: String, required: true },
  chi_tiet: [chiTietSchema], // Mảng các chi tiết
  da_chon: { type: Boolean, default: false },
  so_lan: { type: Number, default: 0 },
});

const mucChecklistSchema = new mongoose.Schema({
  ten_muc: { type: String, required: true },
  cong_viec: [congViecSchema],
});

const ChecklistBDHSchema = new mongoose.Schema({
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChecklistBDHForm", required: true },
  ma_nhan_vien: String,
  ho_ten: String,
  don_vi: String,
  ghi_chu: String,
  so_lan: { type: Number, default: 0 },
  
  cac_muc: [mucChecklistSchema],
  cong_viec_khac: [congViecSchema],
  
  ngay_tao: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChecklistBDH", ChecklistBDHSchema);