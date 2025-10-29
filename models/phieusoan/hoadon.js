const mongoose = require("mongoose");

const hoaDonSchema = new mongoose.Schema({
  slot: { type: String, required: true },
  sku: { type: Number, required: true }, 
  name: { type: String, required: true }, 
  pack: { type: Number, required: true },
  ngay_import: { type: Date, default: Date.now },

});

module.exports = mongoose.model("HoaDon", hoaDonSchema);