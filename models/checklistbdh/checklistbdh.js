const mongoose = require("mongoose");

const chiTietSchema = new mongoose.Schema({
  noi_dung_chi_tiet: { type: String, required: true },
  da_chon: { type: Boolean, default: false },
});

const congViecSchema = new mongoose.Schema({
  noidung: { type: String, required: true },
  chi_tiet: [chiTietSchema],
  da_chon: { type: Boolean, default: false },
  so_lan: { type: Number, default: 0 },
  
  // ✅ Trường quy định checklist - CÓ PHÁT SINH
  quy_dinh: {
    loai: {
      type: String,
      enum: ["ngày", "tuần", "tháng", "phát sinh"], // ✅ Thêm "phát sinh"
      default: "ngày"
    },
    // Nếu loại = "tuần", chỉ định các ngày trong tuần
    ngay_trong_tuan: {
      type: [Number], // [0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7]
      default: null
    },
    // Nếu loại = "tháng", chỉ định các ngày trong tháng
    ngay_trong_thang: {
      type: [Number], // [1, 2, 3, ..., 31]
      default: null
    },
    // Tần suất (có thể dùng cho trường hợp đặc biệt)
    tan_suat: {
      type: Number, // VD: mỗi 2 ngày, mỗi 3 tuần
      default: 1
    },
    // ✅ Trường đánh dấu phát sinh
    phat_sinh: {
      type: Boolean,
      default: false
    }
  }
});

const mucChecklistSchema = new mongoose.Schema({
  ten_muc: { type: String, required: true },
  cong_viec: [congViecSchema],
});

const ChecklistBDHSchema = new mongoose.Schema({
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChecklistBDHForm", required: true },
  ma_nhan_vien: String,
  ho_ten: String,
  don_vi: String,
  ghi_chu: String,
  so_lan: { type: Number, default: 0 },

  cac_muc: [mucChecklistSchema],
  cong_viec_khac: [congViecSchema],

  status: {
    type: String,
    enum: ["Đi làm","Nghỉ ca", "Nghỉ bù", "Nghỉ phép", "Nghỉ không lương"],
    default: null,
  },

  ngay_tao: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChecklistBDH", ChecklistBDHSchema);