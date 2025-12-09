const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    vendor: {
      type: String,
      required: true,
    },
    vendorName: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Vendor", vendorSchema);
