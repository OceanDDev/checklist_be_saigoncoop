const mongoose = require("mongoose");

const itemKiemTraSchema = new mongoose.Schema({
  noidung: String,     // nội dung cần kiểm tra
  dap_an: String       // đáp án được chọn hoặc ghi nhận
});

const groupKiemTraSchema = new mongoose.Schema({
  label: String,               // ví dụ: "Kiểm tra bên ngoài"
  items: [itemKiemTraSchema]   // danh sách các mục trong nhóm
});

const CheckListSchema = new mongoose.Schema({
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChecklistForm", required: true },
  ma_nhan_vien: String,
  ho_ten: String,
  don_vi: String,
  ghi_chu: String,

  // Danh sách người dùng chọn từ option của ChecklistForm
  option_da_chon: [
    {
      label: String,
      value: String
    }
  ],

  checklist_groups: [groupKiemTraSchema], // ← thay thế hai trường cũ bằng trường mới

  ngay_tao: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CheckList", CheckListSchema);
