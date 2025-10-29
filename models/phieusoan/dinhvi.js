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
    ngay_import: { type: Date, default: Date.now },
  });

  module.exports = mongoose.model("DinhVi", dinhViSchema);