const mongoose = require("mongoose");

const CheckListSchema = new mongoose.Schema({
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: "CheckListForm", required: true },
  ma_nhan_vien: String,
  ho_ten: String,
  don_vi: String,
  ghi_chu: String,

  // Danh sách người dùng chọn từ option của ChecklistForm
  option_da_chon: [
    {
      label: String,        // ví dụ: "Chọn khu vực kiểm tra"
      value: String         // ví dụ: "Khu A"
    }
  ],

  kiem_tra_ben_ngoai: [
    {
      noidung: String,
      dap_an: String,
    },
  ],
  kiem_tra_khi_van_hanh: [
    {
      noidung: String,

      dap_an: String,
    },
  ],
  ngay_tao: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CheckList", CheckListSchema);
