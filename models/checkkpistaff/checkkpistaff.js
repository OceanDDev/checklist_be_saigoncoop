const mongoose = require("mongoose");

const checkKPIItemSchema = new mongoose.Schema({
  kpi: { type: String, required: true },
  ty_trong: { type: Number, required: true },
  so_loi: { type: Number, default: 0 },
  noi_dung_loi: { type: String, default: "" },
  ty_trong_cuoi: {
    type: Number,
    default: function () { return this.ty_trong; }
  },

  // 2 field cũ
  ky_hieu: { type: String, default: "" },
  don_vi_tinh: { type: String, default: "" },

  // Các field mới bổ sung
  da_thuc_hien: { type: String, default: "" },
  ke_hoach_quy: { type: String, default: "" },
  chu_ki: { type: String, default: "" },
  nv_danh_gia: { type: Number, default: null },  // Number
  cac_do_luong: { type: String, default: "" },
  bp_theo_doi: { type: String, default: "" },
});

// subdocument lưu lịch sử cập nhật
const updateLogSchema = new mongoose.Schema(
  {
    by_name: { type: String, default: "" },
    by_id:   { type: String, default: "" },
    note:    { type: String, default: "" },
    at:      { type: Date, default: Date.now },

    // snapshot TRƯỚC khi cập nhật (để FE so sánh lần đầu chính xác)
    snapshot_before: {
      danh_sach_check: { type: [checkKPIItemSchema], default: undefined },
      ghi_chu:         { type: String, default: undefined },
      ty_trong_thang:  { type: Number, default: undefined },
    },

    // snapshot SAU cập nhật (đang dùng)
    snapshot: {
      danh_sach_check: { type: [checkKPIItemSchema], default: undefined },
      ghi_chu:         { type: String, default: undefined },
      ty_trong_thang:  { type: Number, default: undefined },
    },
  },
  { _id: false }
);

const checkKPIStaffSchema = new mongoose.Schema({
  form_kpi_id: { type: mongoose.Schema.Types.ObjectId, ref: "FormKPIStaff", required: true },
  ma_nhan_vien:{ type: String, required: true },
  ho_ten:      { type: String, required: true },
  don_vi:      { type: String, required: true },
  chuc_danh:   { type: String, default: "" },
  thang:       { type: Number, min: 1, max: 12, required: true },
  nam:         { type: Number, min: 2000, max: 2100, required: true },

  ty_trong_thang: { type: Number, default: 100 },

  danh_sach_check: [checkKPIItemSchema],

  // đếm số lần cập nhật (sync theo updates.length)
  so_lan_update: { type: Number, default: 0 },

  // nhật ký cập nhật
  updates: { type: [updateLogSchema], default: [] },

  ghi_chu:  { type: String, default: "" },
  ngay_tao: { type: Date, default: Date.now },
});

checkKPIStaffSchema.index({ form_kpi_id: 1, thang: 1, nam: 1 }, { unique: true });

// luôn đồng bộ so_lan_update = updates.length trước khi save
checkKPIStaffSchema.pre("save", function (next) {
  if (Array.isArray(this.updates)) {
    this.so_lan_update = this.updates.length;
  }
  next();
});

module.exports = mongoose.model("CheckKPIStaff", checkKPIStaffSchema);
