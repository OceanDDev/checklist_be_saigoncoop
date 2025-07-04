// models/Staff.js
const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  ma_nhan_vien: { type: String, required: true },
  ho_ten: { type: String, required: true },
  don_vi: { type: String, required: true },
});

module.exports = mongoose.model("Staff", staffSchema);
