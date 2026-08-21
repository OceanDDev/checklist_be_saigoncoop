// models/Staff.js
const mongoose = require("mongoose");

const qcDacThuSchema = new mongoose.Schema({
  sku: { type: String, required: true },
  name: { type: String, required: true },
  quy_cach: { type: Numeber, required: true },
});

module.exports = mongoose.model("QcDacThu", qcDacThuSchema);
