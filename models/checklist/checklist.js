const mongoose = require("mongoose");

const CheckListSchema = new mongoose.Schema({
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: "CheckListForm", required: true },
  ma_nhan_vien: String,
  ho_ten: String,
  don_vi: String,
  so_xe: String,
  ket_luan: String,
  kiem_tra_ben_ngoai: [
    {
      noidung: String,
      dap_an: String,
      ghi_chu: String,
    },
  ],
  kiem_tra_khi_van_hanh: [
    {
      noidung: String,
      dap_an: String,
      ghi_chu: String,
    },
  ],
  ngay_tao: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CheckList", CheckListSchema);
