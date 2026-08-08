// models/move/move.js
const mongoose = require("mongoose");

const TRANG_THAI_VALUES = ["Khớp", "Không Khớp", "Không có DATA"];

const khuyenMaiSchema = new mongoose.Schema(
  {
    slot: {
      type: String,
      default: "",
      // ⚠️ Không còn required — SKU chỉ có bên file txt (MMS) mà không có
      // bên excel (tồn kho) thì sẽ không có vị trí/LPN.
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    lpn: {
      type: String,
      default: "",
    },

    luong_onhand: {
      type: String,
      default: "0",
    },

    luong_available: {
      type: String,
      default: "0",
    },

    luong_allocate: {
      type: String,
      default: "0",
    },

    luong_mms: {
      type: String,
      default: "",
      // "" nghĩa là bên file txt (MMS) không có SKU này -> trangThai sẽ
      // là "Không có DATA".
    },

    // ✅ MỚI: kết quả so khớp luong_onhand (tổng theo SKU, cộng dồn mọi
    // slot/LPN) với luong_mms lấy từ file txt.
    // - "Khớp": 2 bên bằng nhau.
    // - "Không Khớp": có dữ liệu cả 2 bên nhưng số lệch nhau.
    // - "Không có DATA": chỉ có dữ liệu ở 1 bên (excel hoặc txt), bên còn
    //   lại không tìm thấy SKU này.
    trangThai: {
      type: String,
      enum: TRANG_THAI_VALUES,
      default: "Không có DATA",
      index: true,
    },

    thoi_gian_impport: {
      type: Date,
    },
  },

  { timestamps: true },
);

khuyenMaiSchema.statics.TRANG_THAI_VALUES = TRANG_THAI_VALUES;

module.exports = mongoose.model("KhuyenMai", khuyenMaiSchema);