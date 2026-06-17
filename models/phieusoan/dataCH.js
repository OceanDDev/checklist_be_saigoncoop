const mongoose = require("mongoose");

const dataCHSchema = new mongoose.Schema({
  sd_tf:{ type: Number, required: false },
  so_document: { type: Number, required: false },
  mach: { type: String, required: true },
  tench: { type: String, required: true },
   quan: { type: String, required: true },
  chuyen: { type: String, required: true },
  ghi_chu_ch: { type: String, required: false },
  ngay_import: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DataCH", dataCHSchema);
