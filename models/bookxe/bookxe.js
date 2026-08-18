const mongoose = require("mongoose");

const bookXeSchema = new mongoose.Schema(
  {
    thoi_gian_xuat: {
      type: Date,
      required: true,
      trim: true,
    },
    thoi_gian_dk_toi_ch: {
      type: Date,
      required: true,
      trim: true,
    },
     ngay_di_hang: {
      type: Date,
      required: true,
      trim: true,
    },
    quan: {
      type: String,
      trim: true,
    },
    so_luong_ch: {
      type: String,
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

    lich_di_hang: {
      type: String,
    },

    kien: {
      type: Number,
      default: 0,
    },

    kien_rot: {
      type: Number,
      default: 0,
    },
 ghi_chu: {
      type: String,
    },

    trangThai: {
      type: String,
      enum: ["Chưa Book", "Chờ xe", "Có kiện rớt", "Hoàn thành"],
      default: "Chưa Book",
    },
    thoi_gian_tao: {
      type: Date,
    },
    thoi_gian_hoan_thanh: {
      type: Date,
    },
    // thêm vào bookxe schema (cạnh các field kien, kien_rot, quan,...)
    co_giao_khach: {
      type: Boolean,
      default: false,
    },
    ngay_giao_khach: {
      type: String, // "YYYY-MM-DD" — ngày phát sinh giao khách, lấy từ ngày book
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("bookXe", bookXeSchema);
