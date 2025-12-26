const mongoose = require("mongoose");

const chiTietFormSchema = new mongoose.Schema({
  noi_dung_chi_tiet: { type: String, required: true },
});

const congViecFormSchema = new mongoose.Schema({
  noidung: { type: String, required: true },
  chi_tiet: [chiTietFormSchema],
  
  // ✅ Thêm trường quy_dinh
  quy_dinh: {
    loai: {
      type: String,
      enum: ["ngày", "tuần", "tháng"],
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
    // Tần suất
    tan_suat: {
      type: Number,
      default: 1
    }
  }
});

const mucChecklistFormSchema = new mongoose.Schema({
  ten_muc: { type: String, required: true },
  cong_viec: [congViecFormSchema],
});

const checklistBDHFormSchema = new mongoose.Schema({
  tieu_de: { type: String, required: true },
  mo_ta: String,
  cac_muc: [mucChecklistFormSchema],
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChecklistBDHForm", checklistBDHFormSchema);