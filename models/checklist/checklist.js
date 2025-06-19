const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  noidung: String,
  dap_an: String,  // Y hoặc N
  ghi_chu: String
});

const checklistSchema = new mongoose.Schema({
  ma_nhan_vien: String,
  ho_ten: String,
  don_vi: String,
  kiem_tra_ben_ngoai: [itemSchema],
  kiem_tra_khi_van_hanh: [itemSchema],
  ket_luan: String,
  ngay_tao: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Checklist", checklistSchema);
