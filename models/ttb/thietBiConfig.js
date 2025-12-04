// models/thietBiConfig.js
const mongoose = require("mongoose");

const thietBiConfigSchema = new mongoose.Schema({
  ten_thiet_bi: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  mo_ta: {
    type: String,
    trim: true
  },
  trang_thai: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  thu_tu: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

// Index để tìm kiếm nhanh
thietBiConfigSchema.index({ trang_thai: 1, thu_tu: 1 });
thietBiConfigSchema.index({ ten_thiet_bi: 1 });

module.exports = mongoose.model("ThietBiConfig", thietBiConfigSchema);