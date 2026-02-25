const mongoose = require("mongoose");

const macAddressSchema = new mongoose.Schema({
  mac_address: { type: String, required: true, unique: true },
  ho_ten: { type: String, required: true },
  ma_nhan_vien: { type: String, required: true, unique: true },
  bo_phan: { type: String, required: true },
  trang_thai: { type: Boolean, default: true }, // true = được phép check, false = bị khóa
  ghi_chu: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("MacAddress", macAddressSchema);