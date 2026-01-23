// models/checkkpistaff/checkkpistaff.js
const mongoose = require("mongoose");

// ✅ Schema cho KPI phụ - so_loi mặc định 0, validate >= 0
const kpiPhuSchema = new mongoose.Schema(
  {
    ten_kpi_phu: { type: String, required: true },
    so_loi: {
      type: Number,
      default: 0,
      min: [0, "Số lỗi phải >= 0"],
    },
  },
  { _id: false },
);

const checkKPIItemSchema = new mongoose.Schema(
  {
    kpi: { type: String, required: true },
    ty_trong: { type: Number, required: true },
    ty_trong_cuoi: { type: Number, required: true },
    so_loi: { type: Number, default: 0 },
    noi_dung_loi: { type: String, default: "" },
    ky_hieu: { type: String, default: "" },
    don_vi_tinh: { type: String, default: "" },
    da_thuc_hien: { type: String, default: "" },
    ke_hoach_quy: { type: String, default: "" },
    chu_ki: { type: String, default: "" },
    nv_danh_gia: { type: Number, default: 0 },
    cac_do_luong: { type: String, default: "" },
    bp_theo_doi: { type: String, default: "" },
  },
  { _id: true },
);

const updateLogSchema = new mongoose.Schema(
  {
    by_name: { type: String, default: "" },
    by_id: { type: String, default: "" },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    snapshot_before: { type: mongoose.Schema.Types.Mixed },
    snapshot: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

// ✅ Schema cho đơn vị (chính + phụ không bắt buộc)
const donViSchema = new mongoose.Schema(
  {
    chinh: { type: String, required: true },
    phu: { type: String, default: "" },
  },
  { _id: false },
);

const checkKPIStaffSchema = new mongoose.Schema({
  form_kpi_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FormKPIStaff",
    required: true,
  },
  ma_nhan_vien: { type: String, required: true },
  ho_ten: { type: String, required: true },
  
  // ✅ Đổi don_vi thành object có chinh (bắt buộc) và phu (không bắt buộc)
  don_vi: {
    type: donViSchema,
    required: true,
  },
  
  chuc_danh: { type: String, default: "" },

  quy: { type: Number, min: 1, max: 4, required: true },
  nam: { type: Number, min: 2000, max: 2100, required: true },

  ty_trong_quy: { type: Number, default: 100 },
  danh_sach_check: [checkKPIItemSchema],

  // ✅ kpi_phu nằm ngang hàng với danh_sach_check - Mặc định NULL
  kpi_phu: {
    type: [kpiPhuSchema],
    default: null,
  },

  so_lan_update: { type: Number, default: 0 },
  updates: [updateLogSchema],
  ghi_chu: { type: String, default: "" },
  ngay_tao: { type: Date, default: Date.now },
});

checkKPIStaffSchema.index({ form_kpi_id: 1, quy: 1, nam: 1 }, { unique: true });

checkKPIStaffSchema.pre("save", function (next) {
  if (Array.isArray(this.updates)) {
    this.so_lan_update = this.updates.length;
  }
  next();
});

module.exports = mongoose.model("CheckKPIStaff", checkKPIStaffSchema);