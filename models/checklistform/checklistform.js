const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  noidung: { type: String, required: true },
});

const groupSchema = new mongoose.Schema({
  label: { type: String, required: true },       // Tên nhóm kiểm tra, ví dụ: "Kiểm tra bên ngoài"
  items: [itemSchema],                           // Danh sách các mục kiểm tra trong nhóm
});

const optionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  choices: [{ type: String, required: true }],
});

const checklistformSchema = new mongoose.Schema({
  tieu_de: { type: String, required: true },
  mo_ta: { type: String },
  checklist_groups: [groupSchema],               // ← dùng array thay vì 2 field cố định
  option: [optionSchema],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ChecklistForm", checklistformSchema);
