// models/move/move.js
const mongoose = require("mongoose");

const nangSuatSchema = new mongoose.Schema(
  {
    doc_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    status: {
      type: String,
      required: true,
    },

    from_zone: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    to_zone: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    date_created: {
      type: Date,
      default: Date.now,
    },

    date_assigned: {
      type: Date,
      default: null,
    },

    time_assigned: {
      type: String, // "HH:MM" format
      default: "",
    },

    date_completed: {
      type: Date,
      default: null,
    },

    time_completed: {
      type: String, // "HH:MM" format
      default: "",
    },

    assigned_to: {
      type: String,
      default: null,
    },

    total_lines: {
      type: Number,
      default: 0,
      min: 0,
    },

    total_eaches: {
      type: Number,
      default: 0,
      min: 0,
    },

    total_reaches: {
      type: Number,
      default: 0,
      min: 0,
    },

    time_complete_phieu: {
      type: String, // "HH:MM" format
      default: "",
    },

    status_phieu: {
      type: Number,
      default: 0,
      min: 0,
    },
    loai: {
      type: String,
      default: "",
    },
  },

  { timestamps: true },
);

module.exports = mongoose.model("NangSuat", nangSuatSchema);
