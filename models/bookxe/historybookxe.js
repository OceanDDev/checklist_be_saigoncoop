const mongoose = require("mongoose");

const historyBookXeSchema = new mongoose.Schema(
  {
    concept: {
      type: String,
      trim: true,
    },
    lenh_dieu_dong: {
      type: String,
      required: true,
      trim: true,
    },
    ma_ch: {
      type: String,
      trim: true,
    },
    ten_ch: {
      type: String,
      trim: true,
    },
    ma_ncv: {
      type: String,
      trim: true,
    },
    ten_nvc: {
      type: String,
      trim: true,
    },
    thoi_gian_tao: {
      type: Date,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("HistoryBookXe", historyBookXeSchema);
