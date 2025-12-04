// models/ttb/ttb.js
const mongoose = require("mongoose");

const ttbItemSchema = new mongoose.Schema({
  ten_ttb: { 
    type: String, 
    required: false,
    trim: true,
    uppercase: true
    // ✅ Đã xóa enum - cho phép mọi giá trị thiết bị
  },
  di_ch: { 
    type: Number, 
    required: false,
    min: 0,
    default: 0
  },
  ch_tra_ve: { 
    type: Number, 
    required: false,
    min: 0,
    default: 0
  },
  can_tru: { 
    type: Number, 
    required: false,
    min: -Infinity,
    default: 0
  } 
});

const daySchema = new mongoose.Schema({
  ngay_di: { type: Date, required: false },
  ngay_ve: { type: Date, required: false }
});

// Validate ngày về phải sau ngày đi
daySchema.pre('validate', function(next) {
  if (this.ngay_ve && this.ngay_di && this.ngay_ve < this.ngay_di) {
    return next(new Error('Ngày về phải sau ngày đi'));
  }
  next();
});

const ttbSchema = new mongoose.Schema({
  day: { 
    type: daySchema, 
    required: false 
  },
  so_bb: { 
    type: String, 
    required: false,
    trim: true
  },
  ma_cua_hang: { 
    type: String, 
    required: false,
    trim: true
  },
  cua_hang: { 
    type: String, 
    required: false,
    trim: true
  },
  tai_xe: { 
    type: String,
    required: false,
    trim: true
  },
  bien_so_xe: { 
    type: String,
    required: false,
    trim: true
  },
  ttb: { 
    type: [ttbItemSchema], 
    required: false
  },
  ghi_chu: { 
    type: String,
    trim: true
  }
}, { 
  timestamps: true // Tự động thêm createdAt, updatedAt
});

// Index để tìm kiếm nhanh
ttbSchema.index({ ma_cua_hang: 1, 'day.ngay_di': -1 });
ttbSchema.index({ so_bb: 1 });
ttbSchema.index({ createdAt: -1 });

const Ttb = mongoose.model("Ttb", ttbSchema);

module.exports = Ttb;