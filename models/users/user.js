const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: Number, default: 0 } // 0: user, 1: admin, 2: superadmin (ví dụ)
});

module.exports = mongoose.model("User", userSchema);
