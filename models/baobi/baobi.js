const mongoose = require("mongoose");

const baoBiSchema = new mongoose.Schema(
  {
    ton_nhap_dau_ki: {
      type: Number,
      trim: true,
    },
    ton_xuat_trong_ki: {
      type: Number,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    luong_nhap: {
      type: Number,
    },
    luong_xuat: {
      type: Number,
    },
    ma_ch: {
      type: String,
      trim: true,
    },
    ten_ch: {
      type: String,
      trim: true,
    },
    ten_ncc: {
      type: String,
      trim: true,
    },
    so_hd: {
      type: Number,
      trim: true,
    },
    ngay_hd: {
      type: Date,
      trim: true,
    },
    tg_nhap: {
      type: Date,
      trim: true,
    },
    tg_xuat: {
      type: Date,
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BaoBi", baoBiSchema);
