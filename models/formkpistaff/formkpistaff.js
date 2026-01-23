// models/formkpistaff/formkpistaff.js
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

const kpiItemSchema = new mongoose.Schema(
  {
    kpi: { type: String, required: true },
    ty_trong: { type: Number, required: true },
    ty_trong_cuoi: {
      type: Number,
      default: function () {
        return this.ty_trong;
      },
    },

    ky_hieu: { type: String, default: "" },
    don_vi_tinh: { type: String, default: "" },

    da_thuc_hien: { type: String, default: "" },
    ke_hoach_quy: { type: String, default: "" },
    chu_ki: { type: String, default: "Quý" },
    nv_danh_gia: { type: String, default: "" },
    cac_do_luong: { type: String, default: "" },
    bp_theo_doi: { type: String, default: "" },
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

const formKPIStaffSchema = new mongoose.Schema(
  {
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

    kpis: { type: [kpiItemSchema], default: [] },
    
    // ✅ kpi_phu nằm ngang hàng với kpis - Mặc định NULL
    kpi_phu: {
      type: [kpiPhuSchema],
      default: null,
    },
    
    ghi_chu: { type: String, default: "" },
  },
  {
    timestamps: true,
  },
);

formKPIStaffSchema.index({ ma_nhan_vien: 1, quy: 1, nam: 1 }, { unique: true });

formKPIStaffSchema.set("toJSON", {
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("FormKPIStaff", formKPIStaffSchema);