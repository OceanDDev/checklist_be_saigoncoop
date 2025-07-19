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
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ']
  }
}, {
  timestamps: true // tự động tạo createdAt, updatedAt
});

module.exports = mongoose.model("Cuahang", cuahangSchema);
