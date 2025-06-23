// models/ChecklistForm.js
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  noidung: { type: String, required: true },
});

const checklistformSchema = new mongoose.Schema({
  tieu_de: { type: String, required: true },
  mo_ta: { type: String },
  kiem_tra_ben_ngoai: [itemSchema],
  kiem_tra_khi_van_hanh: [itemSchema],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ChecklistForm", checklistformSchema);
