const mongoose = require("mongoose");

const kpiItemSchema = new mongoose.Schema({
  kpi: { type: String, required: true },           // Tên KPI
  ty_trong: { type: Number, required: true },      // Tỷ trọng %
  loi: {
    so_loi: { type: Number, default: 0 },          // Số lỗi
    noi_dung: { type: String, default: "" },       // Mô tả lỗi nếu có
  },
});

const kpiStaffSchema = new mongoose.Schema({
  ma_nhan_vien: { type: String, required: true }, // Mã nhân viên
  ho_ten: { type: String, required: true },       // Họ tên
  don_vi: { type: String, required: true },       // Đơn vị

  thang: {
    type: Number,
    min: 1,
    max: 12,
    required: true, // bắt buộc phải có tháng
  },

  nam: {
    type: Number,
    min: 2000, // có thể set khoảng năm hợp lệ
    max: 2100,
    required: true, // bắt buộc phải có năm, bạn sẽ nhập vào
  },

  kpis: [kpiItemSchema], // Danh sách KPI trong tháng

  createdAt: {
    type: Date,
    default: Date.now,
  },
});


module.exports = mongoose.model("KPIStaff", kpiStaffSchema);
