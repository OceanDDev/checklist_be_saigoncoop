// models/phuXe.js
const mongoose = require("mongoose");

const phuXeSchema = new mongoose.Schema(
  {
    khung_gio: { type: String, required: false },
    ten_cua_hang: { type: String, required: false },
    dich_vu: { type: String, required: false },
    ten_tai_xe: { type: String, required: false },
    bien_so_xe: { type: String, required: false },
    ten_phu_xe: { type: String, required: false },
  },
  { timestamps: true } // thêm createdAt và updatedAt
);

module.exports = mongoose.model("phuXe", phuXeSchema);
