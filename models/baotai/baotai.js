const mongoose = require("mongoose");

const baoTaiSchema = new mongoose.Schema(
  {
    nvc: {
      type: String,
    },
    chuyen: {
      type: String,
    },
    stt: {
      type: String,
    },
    bsx: {
      type: String,
    },
    thoi_gian_vao: {
      type: String,
    },
    check_in: {
      type: String,
    },
    check_out: {
      type: String,
    },
    trangThai: {
      type: String,
    },
    nv_tk: {
      type: String,
    },
    cong_xuat: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BaoTai", baoTaiSchema);
