const mongoose = require("mongoose");

const nhaXeSchema = new mongoose.Schema(
  {
    ma_ch: {
      type: String,
      trim: true,
    },
    ten_ch: {
      type: String,
      trim: true,
    },
     quan: {
      type: String,
      trim: true,
    },
    thoi_gian_xuat: {
      type: String,
      trim: true,
    },
    lich_di_hang:{
        type: String,
    },
    nvc: {
      type: String,
      trim: true,
    },

    ghi_chu: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("NhaXe", nhaXeSchema);
