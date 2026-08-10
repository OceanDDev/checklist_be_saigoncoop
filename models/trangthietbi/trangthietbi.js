const mongoose = require("mongoose");

const trangthietbiSchema = new mongoose.Schema(
  {
    so_bbgn: {
      type: String,
      required: true,
      trim: true,
    },
    loai_ttb: {
      type: String,
      trim: true,
      required: true,
    },

    // Mã kho (VD: 810) — có trong file đối lưu, tách riêng với mã Co.op
    ma_kho: {
      type: String,
      trim: true,
    },

    ma_ch: {
      type: String,
      required: false,
      trim: true,
    },

    ten_ch: {
      type: String,
      trim: false,
    },
    so_xe: {
      type: String,
      trim: false,
    },
    nvc: {
      type: String,
      trim: false,
    },
    ttb_giao: {
      type: Number,
      min: 0,
      default: 0,
    },

    ttb_sieu_thi_nhan: {
      type: String,
      trim: true,
    },
    ttb_sieu_thi_tra: {
      type: Number,
      min: 0,
      default: 0,
    },

    ttb_nhan: {
      type: Number,
    },

    // Thiết bị lưu tại siêu thị — cột có trong file đối lưu
    ttb_luu_tai_st: {
      type: Number,
      min: 0,
      default: 0,
    },

    ngay_import: {
      type: Date,
    },
    ngay_tao: {
      type: Date,
    },

    // Kỳ dạng "YYYY-MM", tự sinh từ ngay_tao — dùng để group/lọc theo tháng
    // nhanh hơn thay vì query range ngay_tao mỗi lần chốt kỳ.
    ky: {
      type: String,
      trim: true,
      index: true,
    },
  },

  {
    timestamps: true,
  },
);

// Tự động sinh "ky" (YYYY-MM) từ ngay_tao trước khi lưu / khi cập nhật
function tinhKyTuNgay(ngay) {
  if (!ngay) return undefined;
  const d = new Date(ngay);
  if (Number.isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

trangthietbiSchema.pre("save", function (next) {
  if (this.ngay_tao) {
    this.ky = tinhKyTuNgay(this.ngay_tao);
  }
  next();
});

trangthietbiSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const setPart = update.$set || update;
  if (setPart.ngay_tao) {
    setPart.ky = tinhKyTuNgay(setPart.ngay_tao);
    if (update.$set) {
      update.$set = setPart;
    } else {
      this.setUpdate(setPart);
    }
  }
  next();
});

// Index hỗ trợ aggregate tồn kho theo cửa hàng + loại + kỳ
trangthietbiSchema.index({ ma_ch: 1, loai_ttb: 1, ky: 1 });

module.exports = mongoose.model("TrangThietBi", trangthietbiSchema);
