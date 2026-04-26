const mongoose = require("mongoose");

const tailLieuSchema = new mongoose.Schema({
  b2Key: { type: String },
  ten: { type: String },
  duongDan: { type: String },
  publicId: { type: String },
  loai: { type: String, enum: ["pdf", "docx", "khac"], default: "khac" },
});

const baiHocSchema = new mongoose.Schema(
  {
    tieuDe: { type: String, required: true },
    khoaHocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KhoaHoc",
      required: true,
    },
    thuTu: { type: Number, default: 0 },
   youtubeUrl: { type: String, default: "" },

    taiLieu: [tailLieuSchema],
    baiKiemTraId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaiKiemTra",
      default: null,
    },
    cheDoBaiKiemTra: {
      type: String,
      enum: ["sau_video", "thu_cong"],
      default: "sau_video",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BaiHoc", baiHocSchema);
