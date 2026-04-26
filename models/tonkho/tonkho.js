const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  zone: {
    type: String,
    required: true,
    trim: true
  },
  slot: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  onHand: {
    type: Number,
    required: true,
    min: 0
  },
  pack: {
    type: Number,
    required: true,
    min: 1
  },
  ngay_ton: {
    type: Date,
    required: true,
    default: Date.now // nếu không truyền thì lấy ngày hiện tại
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Inventory", inventorySchema);