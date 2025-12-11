const mongoose = require("mongoose");

const chiTietFormSchema = new mongoose.Schema({
  noi_dung_chi_tiet: { type: String, required: true },
});

const congViecFormSchema = new mongoose.Schema({
  noidung: { type: String, required: true },
  chi_tiet: [chiTietFormSchema], // Thêm chi tiết cho công việc
});

const mucChecklistFormSchema = new mongoose.Schema({
  ten_muc: { type: String, required: true },
  cong_viec: [congViecFormSchema],
});

const checklistBDHFormSchema = new mongoose.Schema({
  tieu_de: { type: String, required: true },
  mo_ta: String,
  cac_muc: [mucChecklistFormSchema],
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChecklistBDHForm", checklistBDHFormSchema);