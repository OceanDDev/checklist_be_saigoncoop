const mongoose = require("mongoose");

const quanlyhdSchema = new mongoose.Schema(
  {
    so_phieu_wms: {
      type: String,
      required: true,
      trim: true,
    },
    so_phieu_hd: {
      type: String,
      trim: true,
      // Không required nữa: document được TẠO bởi WMS trước, lúc đó chưa có hóa đơn
      // nên so_phieu_hd hợp lệ khi để trống (chỉ được set sau khi HĐ import khớp vào).
    },

    ma_ch: {
      type: String,
      required: true,
      trim: true,
    },

    so_hoa_don: {
      type: String,
      trim: true,
    },
    tf_sd_hd: {
      type: String,
      trim: true,
    },
    ten_ch_hd: {
      type: String,
      trim: true,
    },
    luong_hd: {
      type: Number,
      min: 0,
      default: 0,
    },
    ngay_hoa_don: {
      type: Date,
    },

    tf_sd_wms: {
      type: String,
      trim: true,
    },
    ten_ch_wms: {
      type: String,
      trim: true,
    },
    luong_wms: {
      type: Number,
      min: 0,
      default: 0,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },

    trangThai: {
      type: String,
      enum: ["No Data WMS","Chưa có hóa đơn", "Không khớp lượng", "Hoàn thành", "Đã xử lý"],
    },

    ngay_import: {
      type: Date,
    },
      ngay_xu_ly: {
      type: Date,
    },
  },
  
  {
    timestamps: true,
  },
);

// Khóa nghiệp vụ mới: 1 PHIẾU WMS là 1 document riêng (trước đây chỉ {ma_ch, sku} nên
// nhiều phiếu cùng SKU/cửa hàng bị đè lẫn nhau). HĐ ra sau sẽ update vào đúng document
// có sẵn theo so_phieu, không tạo document mới.
quanlyhdSchema.index({ ma_ch: 1, sku: 1, so_phieu_wms: 1 }, { unique: true });
quanlyhdSchema.index({ so_hoa_don: 1 });
quanlyhdSchema.index({ trangThai: 1 });

module.exports = mongoose.model("QuanLyHd", quanlyhdSchema);
