const mongoose = require("mongoose");

// ── Sub-schema: 1 câu trả lời của học viên ──────────────────────────────────
const cauTraLoiSchema = new mongoose.Schema(
  {
    cauHoiIndex: { type: Number, required: true }, // vị trí câu trong danhSachCauHoi
    dapAnChon:   { type: Number, default: null  }, // null = chưa chọn
  },
  { _id: false }
);

// ── Sub-schema: kết quả 1 lượt nộp ─────────────────────────────────────────
const ketQuaSchema = new mongoose.Schema(
  {
    tenNguoiLam:       { type: String, required: true },
    thoiGianBatDau:    { type: Date,   required: true },
    thoiGianNop:       { type: Date,   default: null  },
    thoiGianLamBai:    { type: Number, default: null  }, // giây
    danhSachCauTraLoi: [cauTraLoiSchema],
    soCauDung:         { type: Number,  default: 0     },
    tongSoCau:         { type: Number,  default: 0     },
    diem:              { type: Number,  default: 0     }, // %
    dat:               { type: Boolean, default: false },
    tuDongNop:         { type: Boolean, default: false }, // admin kết thúc, chưa kịp nộp
  },
  { timestamps: true }
);

// ── Sub-schema: câu hỏi ─────────────────────────────────────────────────────
const cauHoiSchema = new mongoose.Schema({
  noiDung:    { type: String, required: true },
  cacLuaChon: [{ type: String, required: true }], // 2–6 lựa chọn
  dapAnDung:  { type: Number, required: true    }, // index đáp án đúng
  giaiThich:  { type: String, default: ""       }, // hiển thị sau khi nộp
});

// ── Main schema ─────────────────────────────────────────────────────────────
const baiKiemTraSchema = new mongoose.Schema(
  {
    tieuDe:   { type: String, required: true },
    moTa:     { type: String, default: ""    },
    baiHocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaiHoc",
      default: null,
    },
    nguoiTao: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    danhSachCauHoi: [cauHoiSchema],

    caiDat: {
      xaoTronCauHoi: { type: Boolean, default: false },
      xaoTronDapAn:  { type: Boolean, default: false },
      hienThiKetQua: { type: Boolean, default: true  }, // học viên thấy điểm sau khi nộp
      soLanToiDa:    { type: Number,  default: 0      }, // 0 = không giới hạn
      diemDauVao:    { type: Number,  default: 60     }, // % để pass
       thoiGianLamBai: { type: Number, default: 0      },
    },

    // ── Trạng thái phiên ────────────────────────────────────────────────────
    trangThai: {
      type: String,
      enum: ["nhap", "dang_mo", "da_ket_thuc"],
      default: "nhap",
      // nhap        → mới tạo, QR chưa hoạt động
      // dang_mo     → học viên có thể quét QR và làm bài
      // da_ket_thuc → admin kết thúc, không nhận bài mới
    },
    thoiGianMo:      { type: Date, default: null },
    thoiGianKetThuc: { type: Date, default: null },

    // ── QR — sinh 1 lần khi tạo, hết hiệu lực khi trangThai = da_ket_thuc ──
    qrToken: { type: String, default: null },
    qrUrl:   { type: String, default: null },

    // ── Kết quả nhúng trực tiếp ─────────────────────────────────────────────
    ketQua: [ketQuaSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("BaiKiemTra", baiKiemTraSchema);