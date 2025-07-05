const mongoose = require("mongoose");

// Schema cho từng mục kiểm tra
const itemSchema = new mongoose.Schema({
  noidung: { type: String, required: true },
});

// Schema cho nhóm mục kiểm tra
const groupSchema = new mongoose.Schema({
  label: { type: String, required: true },
  items: [itemSchema],
});

// Schema cho tuỳ chọn lựa chọn (option), không bắt buộc
const optionSchema = new mongoose.Schema({
  label: { type: String }, // Không required
  choices: {
    type: [String],
    default: [],            // Mặc định là mảng rỗng
  },
});

// Schema chính cho form checklist
const checklistformSchema = new mongoose.Schema({
  tieu_de: { type: String, required: true },
  mo_ta: { type: String },
  checklist_groups: {
    type: [groupSchema],
    default: [],            // Mặc định rỗng
  },
  option: {
    type: [optionSchema],
    default: [],            // Mặc định rỗng
  },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChecklistForm", checklistformSchema);
