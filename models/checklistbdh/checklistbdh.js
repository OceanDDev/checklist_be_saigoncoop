const mongoose = require("mongoose");

const congViecSchema = new mongoose.Schema({
  noidung: { type: String, required: true },
  da_chon: { type: Boolean, default: false }, // Được tích chọn hay chưa
  so_lan: { type: Number, default: 0 },

});

const mucChecklistSchema = new mongoose.Schema({
  ten_muc: { type: String, required: true }, // ví dụ: 'Văn Phòng', 'Ngoài Kho'
  cong_viec: [congViecSchema],
});

const ChecklistBDHSchema = new mongoose.Schema({
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChecklistBDHForm", required: true },
  ma_nhan_vien: String,
  ho_ten: String,
  don_vi: String,
  ghi_chu: String,
  so_lan: { type: Number, default: 0 },

  cac_muc: [mucChecklistSchema], // Danh sách các mục chứa các công việc

  cong_viec_khac: [congViecSchema], // Các công việc tự thêm bên ngoài

  ngay_tao: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChecklistBDH", ChecklistBDHSchema);
