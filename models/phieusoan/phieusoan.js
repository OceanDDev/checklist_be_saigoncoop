const mongoose = require("mongoose");

const phieuSoanSchema = new mongoose.Schema({
  don_hang_id: { type: mongoose.Schema.Types.ObjectId, ref: "DonHang", required: true },
  phieu_soan_id: { type: String, unique: true, index: true },
  maNCC: { type: String },
  maNH: { type: String },
  Dept: { type: String },
  SubDept: { type: String },
  store: { type: String, required: true },
  type: { type: String, required: false },
  soda_transfer: { type: Number, required: true },
  sku: { type: Number, required: true },
  name: { type: String, required: true },
  luong: { type: Number, required: true },
  luong_dieu_chinh: { type: Number, default: null },
  slot: { type: String, required: true },
  pack: { type: Number, required: true },
  kien_hang: { type: Number, default: 0 },
  chan_le: { type: String, enum: ["Chẵn", "Lẻ"], required: true },
  loai_hang: {
    type: String,
    enum: ["Bình thường", "Đặc thù"],
    default: function () { return this.pack === 1 ? "Đặc thù" : "Bình thường"; },
  },
  trang_thai: { type: Boolean, default: false },
  ngay_ra_phieu: { type: Date, default: Date.now },
});
  
phieuSoanSchema.index({ loai_hang: 1, trang_thai: 1 });
phieuSoanSchema.index({ pack: 1 });
phieuSoanSchema.index({ don_hang_id: 1 });

// ---- ID generator
async function generatePhieuSoanId(doc) {
  const store = doc.store || "";
  const chanLeChar = doc.chan_le ? doc.chan_le.charAt(0) : "X"; // C hoặc L
  const date = doc.ngay_ra_phieu || new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const baseId = `${store}${chanLeChar}${day}${month}${year}`;

  const PhieuSoan = mongoose.model("PhieuSoan");
  let counter = 1;
  let finalId = baseId;
  while (await PhieuSoan.exists({ phieu_soan_id: finalId, _id: { $ne: doc._id } })) {
    finalId = `${baseId}-${counter}`;
    counter++;
  }
  return finalId;
}

// pre-save: tạo id khi tạo mới
phieuSoanSchema.pre("save", async function (next) {
  if (this.isNew && !this.phieu_soan_id) {
    try {
      this.phieu_soan_id = await generatePhieuSoanId(this);
    } catch (e) { return next(e); }
  }
  next();
});

// statics
phieuSoanSchema.statics.findDacThu = function (filter = {}) {
  return this.find({ pack: 1, loai_hang: "Đặc thù", ...filter });
};
phieuSoanSchema.statics.countDacThuPending = function () {
  return this.countDocuments({ pack: 1, loai_hang: "Đặc thù", trang_thai: false });
};
phieuSoanSchema.statics.getStatsByLoaiHang = function () {
  return this.aggregate([{ $group: { _id: "$loai_hang", count: { $sum: 1 }, total_luong: { $sum: "$luong" } } }]);
};

// instance
phieuSoanSchema.methods.regeneratePhieuSoanId = async function () {
  this.phieu_soan_id = await generatePhieuSoanId(this);
  return this.save();
};

const PhieuSoan = mongoose.model("PhieuSoan", phieuSoanSchema);
module.exports = PhieuSoan;