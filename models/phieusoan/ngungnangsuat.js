// models/phieusoan/ngungnangsuat.js
const mongoose = require("mongoose");

const ngungNangSuatSchema = new mongoose.Schema(
  {
    batDau: {
      type: Date,
      required: true,
    },
    ketThuc: {
      type: Date,
      default: null, // null = đang trong khoảng ngưng, chưa bật lại
    },
    nguoiThucHien: {
      type: String,
      trim: true,
    },
    ghiChu: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ngungNangSuat", ngungNangSuatSchema);