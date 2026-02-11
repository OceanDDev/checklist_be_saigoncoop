const mongoose = require("mongoose");

const chiTietPhieuLeSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true },
    slot: { type: String, required: true },
    sku: { type: Number, required: true },
    vendor: { type: Number, required: true },
    part_number: { type: String, default: null },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    pack_unit: { type: Number, required: true },
    pck_um: { type: String, required: true },
    packs_to_pick: { type: Number, required: true },
    store: { type: Number, required: true },
    khoi_luong: { type: Number, default: 0 }, // ✅ SỬA: Number thay vì String
    pack_unit_1: { type: Number, default: null },
    packs_to_pick_1: { type: Number, default: null },
  },
  { _id: false },
);

const phieuLeSchema = new mongoose.Schema(
  {
    so_document: { type: Number, required: true, unique: true },
    chi_tiet: [chiTietPhieuLeSchema],
    so_lan_in_phieu: { type: Number, default: 0 },
    trang_thai: {
      type: String,
      enum: ["Chờ xử lý", "Đã xử lý", "Đã Xuất"],
      default: "Chờ xử lý",
    },
    ghi_chu_phieu: { type: String, default: "" },

    // ===== FIELDS FROM DataCH =====
    sd_tf: { type: Number, default: null },
    mach: { type: String, default: "" },
    quan: { type: String, default: "" },
    tench: { type: String, default: "" },
    chuyen: { type: String, default: "" },
    ghi_chu_ch: { type: String, default: "" },
    ngay_in_phieu: { type: Date, default: null },
    ngay_import: { type: Date, default: Date.now },
    ngay_cap_nhat: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ✅ Virtual field: Tổng kiện
phieuLeSchema.virtual("tong_kien").get(function () {
  if (!this.chi_tiet || this.chi_tiet.length === 0) return 0;

  let total = 0; // ✅ Giữ số thập phân

  for (const item of this.chi_tiet) {
    // ✅ ƯU TIÊN: packs_to_pick_1 nếu có giá trị > 0
    if (item.packs_to_pick_1 && item.packs_to_pick_1 > 0) {
      total += item.packs_to_pick_1; // ✅ CỘNG TRỰC TIẾP, KHÔNG LÀM TRÒN
    }
    // ✅ FALLBACK: Dùng packs_to_pick
    else if (item.packs_to_pick && item.packs_to_pick > 0) {
      total += item.packs_to_pick; // ✅ CỘNG TRỰC TIẾP, KHÔNG LÀM TRÒN
    }
  }

  // ✅ LÀM TRÒN LÊN MỘT LẦN DUY NHẤT Ở CUỐI
  return Math.ceil(total);
});

// ✅ NEW: Virtual field - Tổng khối lượng = SUM(quantity * khoi_luong)
phieuLeSchema.virtual("tong_khoi_luong").get(function () {
  if (!this.chi_tiet || this.chi_tiet.length === 0) return 0;

  const total = this.chi_tiet.reduce((sum, item) => {
    const quantity = item.quantity || 0;
    const khoiLuong = item.khoi_luong || 0;
    return sum + quantity * khoiLuong;
  }, 0);

  // Làm tròn 2 chữ số thập phân
  return Math.round(total * 100) / 100;
});

// Index để tìm kiếm nhanh
phieuLeSchema.index({ so_document: 1 });
phieuLeSchema.index({ "chi_tiet.sku": 1 });
phieuLeSchema.index({ "chi_tiet.slot": 1 });
phieuLeSchema.index({ trang_thai: 1 });
phieuLeSchema.index({ mach: 1 });
phieuLeSchema.index({ chuyen: 1 });

module.exports = mongoose.model("PhieuLe", phieuLeSchema);
