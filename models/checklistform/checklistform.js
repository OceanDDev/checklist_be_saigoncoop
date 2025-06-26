const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  noidung: { type: String, required: true },
});

const optionSchema = new mongoose.Schema({
  label: { type: String, required: true },          // tiêu đề hiển thị
  choices: [{ type: String, required: true }],      // danh sách option để chọn
});

const checklistformSchema = new mongoose.Schema({
  tieu_de: { type: String, required: true },
  mo_ta: { type: String },
  kiem_tra_ben_ngoai: [itemSchema],
  kiem_tra_khi_van_hanh: [itemSchema],
  option: [optionSchema], // ← thêm trường này
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ChecklistForm", checklistformSchema);
