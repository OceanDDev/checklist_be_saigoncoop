const mongoose = require("mongoose");

const ASNSchema = new mongoose.Schema({
    asn: { type: String },
    po: { type: String },
  ngay_asn: { type: Date },
    ma_ncc: { type: Number },
    ten_ncc: { type: String },
    loai_hinh: { type: String },
    kien_ke_hoach: { type: String },
    kien_con_lai: { type: String },
    ten_nganh_hang: { type: String },
    kho:{ type: String },
    ngay_import: { type: Date },  
});

module.exports = mongoose.model("ASN", ASNSchema);
