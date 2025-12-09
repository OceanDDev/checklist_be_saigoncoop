const mongoose = require("mongoose");

const xuatTraSchema = new mongoose.Schema(
  {
    ngayNhapTra: { type: Date },
    so: { type: String },
    taiXe: { type: String },
    bienSoXe: { type: String },
    ngayCHTraNVC: { type: Date },
    nvNhapTra: { type: String },
    kyHieu: { type: String },
    soHoaDon: { type: String },
    soTienSauThue: { type: Number, min: 0 },
    ngayHoaDon: { type: Date },
    maCH: { type: String },
    tenCH: { type: String },
    sku: {
      type: String,
      ref: "Product",
      required: true,
    },
    tenHang: { type: String },
    upc: { type: String },
    luong: { type: Number, min: 0 },
    vendor: {
      type: String,
      ref: "Vendor",
    },
    vendorName: { type: String },
    ngayBGKeToan: { type: Date },
    soRTV: { type: String },
    nvKeToanNhapTra: { type: String },
    ngayBGXuatTra: { type: Date },
    ghiChu: { type: String },
    ngaySanXuat: { type: Date },
    hanSuDung: { type: Date },
    ngayCapNhap: { type: Date, default: Date.now },
    trangThai: { type: Boolean, default: false },
    kiem_tra_trung: { type: Number, default: 1, min: 1 },
  },
  {
    timestamps: true,
  }
);
xuatTraSchema.index({ maCH: 1, sku: 1, luong: 1 });
xuatTraSchema.index({ sku: 1 });
xuatTraSchema.index({ vendor: 1 });
xuatTraSchema.index({ maCH: 1 });
xuatTraSchema.index({ ngayNhapTra: -1 });
xuatTraSchema.index({ hanSuDung: 1 });
xuatTraSchema.index({ upc: 1 });
xuatTraSchema.index({ soHoaDon: 1 });
xuatTraSchema.index({ soRTV: 1 });

module.exports = mongoose.model("XuatTra", xuatTraSchema);
