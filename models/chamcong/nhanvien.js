// models/nhanvien/nhanvien.js
const mongoose = require("mongoose");

const BO_PHAN_CHUC_VU = {
  "Ngọc Phú": ["Kiểm chéo", "Soạn hàng", "Hỗ trợ xuất"],
  "Xuất hàng": [
    "Xử lý đơn hàng TV",
    "Soạn hàng CT",
    "Soạn hàng TV",
    "Xuất hàng TV",
    "Xuất hàng CT",
    "Điều vận TV",
    "Điều vận CT",
    "Sinh Viên",
  ],
  "Nhập hàng": ["Nhập hàng TV", "Nhập hàng CT", "Sinh Viên"],

  "Hỗ trợ Kho": ["Kiểm chéo", "Điều phối Xuất", "Sinh Viên"],
  "Kế toán": ["Kế toán TV", "Kế Toán CT", "Sinh Viên"],
};

const ALL_BO_PHAN = Object.keys(BO_PHAN_CHUC_VU);
const ALL_CHUC_VU = [...new Set(Object.values(BO_PHAN_CHUC_VU).flat())];

const nhanVienSchema = new mongoose.Schema(
  {
    ma_nhan_vien: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    ten_nhan_vien: {
      type: String,
      required: true,
      trim: true,
    },
    bo_phan: {
      type: String,
      required: true,
      trim: true,
      enum: {
        values: ALL_BO_PHAN,
        message: "Bộ phận '{VALUE}' không hợp lệ!",
      },
    },
    chuc_vu: {
      type: String,
      default: "",
      enum: {
        values: ["", ...ALL_CHUC_VU],
        message: "Chức vụ '{VALUE}' không hợp lệ!",
      },
   
    },
    email: { type: String, default: "" },
    so_dien_thoai: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },

  { timestamps: true },
);

// ✅ Validate chức vụ phải thuộc bộ phận tương ứng
nhanVienSchema.pre("save", function (next) {
  if (this.chuc_vu && this.bo_phan) {
    const chucVuHopLe = BO_PHAN_CHUC_VU[this.bo_phan] || [];
    if (!chucVuHopLe.includes(this.chuc_vu)) {
      return next(
        new Error(
          `Chức vụ "${this.chuc_vu}" không thuộc bộ phận "${this.bo_phan}"!`,
        ),
      );
    }
  }
  next();
});

// ✅ Export thêm constant để dùng ở nơi khác (route, frontend, v.v.)
module.exports = mongoose.model("NhanVien", nhanVienSchema);
module.exports.BO_PHAN_CHUC_VU = BO_PHAN_CHUC_VU;
module.exports.ALL_BO_PHAN = ALL_BO_PHAN;
module.exports.ALL_CHUC_VU = ALL_CHUC_VU;
