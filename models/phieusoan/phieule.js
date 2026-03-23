const mongoose = require("mongoose");

const chiTietPhieuLeSchema = new mongoose.Schema(
  {
    seq: { type: Number, default: 0 },
    slot: { type: String, default: "" }, // ✅ bỏ required — 8101 không có slot
    sku: { type: Number, required: true },
    vendor: { type: Number, default: 0 }, // ✅ bỏ required — 8101 không có vendor
    part_number: { type: String, default: null },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    pack_unit: { type: Number, default: 1 }, // ✅ bỏ required — 8101 mặc định 1
    pck_um: { type: String, default: "EA" }, // ✅ bỏ required — 8101 mặc định EA
    packs_to_pick: { type: Number, default: 0 }, // ✅ bỏ required — 8101 tính từ quantity
    store: { type: Number, default: 0 }, // ✅ bỏ required — 8101 không có store
    khoi_luong: { type: Number, default: 0 },
    pack_unit_1: { type: Number, default: null },
    packs_to_pick_1: { type: Number, default: null },
  },
  { _id: false },
);

const phieuLeSchema = new mongoose.Schema(
  {
    so_document: {
      type: Number,
      default: null,
      sparse: true, // ← cho phép nhiều document có so_document = null
    },
    chi_tiet: [chiTietPhieuLeSchema],
    so_lan_in_phieu: { type: Number, default: 0 },
    trang_thai: {
      type: String,
      enum: ["Chờ xử lý", "Đã xử lý", "Đã Xuất"],
      default: "Chờ xử lý",
    },
    ghi_chu_phieu: { type: String, default: "" },
    loai_phieu: {
      type: String,
      enum: ["SD", "TF", "8101"],
      default: "TF",
    },
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

// Virtual field: Tổng kiện
phieuLeSchema.virtual("tong_kien").get(function () {
  if (!this.chi_tiet || this.chi_tiet.length === 0) return 0;

  let total = 0;

  for (const item of this.chi_tiet) {
    if (item.packs_to_pick_1 && item.packs_to_pick_1 > 0) {
      total += item.packs_to_pick_1;
    } else if (item.packs_to_pick && item.packs_to_pick > 0) {
      total += item.packs_to_pick;
    }
  }

  return Math.ceil(total);
});

// Virtual field: Tổng khối lượng = SUM(quantity * khoi_luong)
phieuLeSchema.virtual("tong_khoi_luong").get(function () {
  if (!this.chi_tiet || this.chi_tiet.length === 0) return 0;

  const total = this.chi_tiet.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.khoi_luong || 0);
  }, 0);

  return Math.round(total * 100) / 100;
});

// Index
phieuLeSchema.index({ so_document: 1 });
phieuLeSchema.index({ "chi_tiet.sku": 1 });
phieuLeSchema.index({ "chi_tiet.slot": 1 });
phieuLeSchema.index({ trang_thai: 1 });
phieuLeSchema.index({ mach: 1 });
phieuLeSchema.index({ chuyen: 1 });

module.exports = mongoose.model("PhieuLe", phieuLeSchema);
