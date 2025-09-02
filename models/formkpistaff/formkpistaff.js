// models/formkpistaff/formkpistaff.js
const mongoose = require("mongoose");

const kpiItemSchema = new mongoose.Schema({
  kpi: { type: String, required: true },        // Tên KPI
  ty_trong: { type: Number, required: true },   // Tỷ trọng %
  ty_trong_cuoi: { type: Number, required: true },

  // Các field cũ
  ky_hieu: { type: String, default: "" },       // Ký hiệu KPI (F1, P1, ...)
  don_vi_tinh: { type: String, default: "" },   // Đơn vị tính (%, Lỗi, ...)

  // ✅ Các field bổ sung để đồng bộ với CheckKPIStaff
  da_thuc_hien: { type: String, default: "" },   // Thực hiện được gì (hoặc %)
  ke_hoach_quy: { type: String, default: "" },   // Kế hoạch theo quý
  chu_ki: { type: String, default: "" },         // Chu kỳ (tuần/tháng/quý)
  nv_danh_gia: { type: String, default: "" },    // Nhân viên tự đánh giá
  cac_do_luong: { type: String, default: "" },   // Các đo lường liên quan
  bp_theo_doi: { type: String, default: "" }     // Bộ phận theo dõi
}, { _id: false });

const formKPIStaffSchema = new mongoose.Schema({
  ma_nhan_vien: { type: String, required: true },
  ho_ten: { type: String, required: true },
  don_vi: { type: String, required: true },
  chuc_danh: { type: String, default: "" },     // ✅ Thêm chức danh

  thang: { type: Number, min: 1, max: 12, required: true },
  nam:   { type: Number, min: 2000, max: 2100, required: true },

  // Danh sách KPI gốc của nhân viên
  kpis: { type: [kpiItemSchema], default: [] },

  ghi_chu: { type: String, default: "" }
}, {
  timestamps: true
});

// Unique: 1 NV chỉ có 1 Form KPI cho mỗi tháng/năm
formKPIStaffSchema.index({ ma_nhan_vien: 1, thang: 1, nam: 1 }, { unique: true });

formKPIStaffSchema.set("toJSON", {
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});

module.exports = mongoose.model("FormKPIStaff", formKPIStaffSchema);
