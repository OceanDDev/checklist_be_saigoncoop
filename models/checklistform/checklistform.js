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
  label: { type: String },
  choices: {
    type: [String],
    default: [],
  },
});

// Schema chính cho form checklist
const checklistformSchema = new mongoose.Schema({
  tieu_de: { type: String, required: true },
  mo_ta: { type: String },
  loai: {
    type: String,
    required: true,
    enum: ["Ban Điều Hành", "Nhà Kho"], // 🔒 chỉ chấp nhận 2 giá trị
  },
  checklist_groups: {
    type: [groupSchema],
    default: [],
  },
  option: {
    type: [optionSchema],
    default: [],
  },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChecklistForm", checklistformSchema);
