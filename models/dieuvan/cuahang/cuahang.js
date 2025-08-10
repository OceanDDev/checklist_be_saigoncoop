const mongoose = require("mongoose");

const cuahangSchema = new mongoose.Schema({
  maCH: {
    type: String,
    required: true,
    unique: true, // Mã CH là duy nhất
    trim: true
  },
  tenCH: {
    type: String,
    required: true,
    trim: true
  },
  tenCHTruong: {
    type: String,
    trim: true // Không bắt buộc
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'] // Không bắt buộc
  },
  sdt: {
    type: String,
    trim: true,
    match: [/^\d{9,11}$/, 'Số điện thoại không hợp lệ'] // 9–11 số
  }
}, {
  timestamps: true // tự động tạo createdAt, updatedAt
});

module.exports = mongoose.model("Cuahang", cuahangSchema);
