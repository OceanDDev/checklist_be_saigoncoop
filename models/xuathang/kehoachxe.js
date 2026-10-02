const mongoose = require("mongoose");

const keHoachXeSchema = new mongoose.Schema({
  ten_ke_hoach: { type: String },
  ghi_chu_ke_hoach: { type: String },
  ngay_xe_vao_kho_dau_yeu_cau: { type: Date }, // pin UTC 00:00 (chỉ ngày)
  thoi_gian_xe_vao_kho_dau_yeu_cau: { type: String }, // "HH:mm"
  ma_kho: { type: String }, // có thể là "810" hoặc "810+810"
  ma_sieu_thi: { type: String }, // có thể là "CH00272+CH00351"
  ti_le: { type: String }, // "100", "50-50", "30-30-40" -> KHÔNG phải Number
  ma_nvc: { type: String },
  ma_loai_hang: { type: String },
  trong_tai_nho_nhat: { type: Number },
  trong_tai_lon_nhat: { type: Number },
  tong_khoi_luong_hang: { type: Number },
  ma_loai_xe: { type: String },
  hinh_thuc_giao_nhan: { type: String },
  so_luong_xe: { type: Number },
  ghi_chu_booking: { type: String },
  ngay_import: { type: Date },
});

// Khóa upsert của importMany + lọc theo ngày
keHoachXeSchema.index({ ten_ke_hoach: 1, ghi_chu_ke_hoach: 1 });
keHoachXeSchema.index({ ngay_xe_vao_kho_dau_yeu_cau: -1 });

module.exports = mongoose.model("KeHoachXe", keHoachXeSchema);
