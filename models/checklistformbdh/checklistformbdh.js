const mongoose = require("mongoose");

const congViecFormSchema = new mongoose.Schema({
  noidung: { type: String, required: true },
});

const mucChecklistFormSchema = new mongoose.Schema({
  ten_muc: { type: String, required: true }, // ví dụ: 'Văn Phòng', 'Ngoài Kho'
  cong_viec: [congViecFormSchema],
});

const checklistBDHFormSchema = new mongoose.Schema({
  tieu_de: { type: String, required: true },
  mo_ta: String,
  
  // SỬA: Đổi từ cong_viec_mac_dinh sang cac_muc để khớp với ChecklistBDH
  cac_muc: [mucChecklistFormSchema], // Danh sách các mục chứa các công việc
  
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChecklistBDHForm", checklistBDHFormSchema);