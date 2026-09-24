const mongoose = require("mongoose");

const ASNSchema = new mongoose.Schema({
    po: { type: String },
    ngay_asn: { type: Date },
    so_booking:{ type: String },
    ma_ncc: { type: Number },
    ten_ncc: { type: String },
    so_luong_sku: { type: String },
    so_kien:{ type: Number },
    loai_hinh: { type: String },
    ten_nganh_hang: { type: String },
    kho:{ type: String },
    ngay_import: { type: Date },  
});

module.exports = mongoose.model("ASN", ASNSchema);
