const mongoose = require("mongoose");

const dinhViSchema = new mongoose.Schema({
  slot: { type: String, required: true },
  sku: { type: Number, required: true },
  name: { type: String, required: true }, 
  pack: { type: Number, required: true },
  loaiHinh: {
    type: String,
    default: function() {
      return this.pack === "1" ? "Hàng Đặc Thù" : "Hàng bình thường";
    }
  },
  khoiluong:{ type: Number, required: true },
  ngay_import: { type: Date, default: Date.now },
  maNCC: { type: String },
  maNH: { type: String },
  Dept: { type: String },
  SubDept: { type: String }
});

module.exports = mongoose.model("DinhVi", dinhViSchema);