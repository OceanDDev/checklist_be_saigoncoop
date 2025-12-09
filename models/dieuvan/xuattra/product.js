const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    sku: { 
      type: String, 
      required: true, 
    },
    tenHang: { 
      type: String, 
      required: true 
    },
    upc: { 
      type: String, 
      required: false, // UPC không bắt buộc
      unique: true,    // UPC phải duy nhất (nếu có)
      sparse: true     // Cho phép nhiều document có upc = null/undefined
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);