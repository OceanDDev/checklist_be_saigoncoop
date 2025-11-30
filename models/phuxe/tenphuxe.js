const mongoose = require("mongoose");

const phuXeNameSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true } // thêm createdAt / updatedAt
);

module.exports = mongoose.model("PhuXeName", phuXeNameSchema);
