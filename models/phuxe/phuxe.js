// models/phuXe.js
const mongoose = require("mongoose");

const phuXeSchema = new mongoose.Schema(
  {
    // Thông tin khung giờ và cửa hàng
    khung_gio: {
      type: String,
      required: false,
      // Ghi chú: Khung giờ làm việc (VD: "06:00-08:00", "08:00-10:00")
    },
    ten_cua_hang: {
      type: String,
      required: false,
      // Ghi chú: Tên cửa hàng được phục vụ
    },  
    ma_cua_hang: {
      type: String,
      required: false,
      // Ghi chú: Mã định danh duy nhất của cửa hàng
    },

    // Thông tin dịch vụ
    dich_vu: {
      type: String,
      required: false,
      // Ghi chú: Loại dịch vụ (VD: "Giao hàng", "Lấy hàng", "Cả hai")
    },

    // Thông tin nhân sự và phương tiện
    ten_tai_xe: {
      type: String,
      required: false,
      // Ghi chú: Họ tên tài xế phụ trách
    },
    bien_so_xe: {
      type: String,
      required: false,
      // Ghi chú: Biển số xe được sử dụng (VD: "51A-12345")
    },
    ten_phu_xe: {
      type: String,
      required: false,
      // Ghi chú: Họ tên phụ xe đi cùng (nếu có)
    },

    // Điều vận xác nhận (khung giờ đi)
    dieu_van_xac_nhan: {
      type: String,
      required: false,
      // Ghi chú: Trạng thái xác nhận điều vận (VD: "Đã xác nhận", "Chưa xác nhận")
    },
    thoi_gian_di: {
      type: Date,
      required: false,
      // Ghi chú: Thời điểm xuất phát/bắt đầu chuyến đi
    },

    // Hình ảnh xác nhận (khung giờ xong chuyến)
    hinh_anh: {
      type: String,
      required: false,
      // Ghi chú: Đường dẫn hoặc URL của hình ảnh xác nhận hoàn thành
      //          (VD: "/uploads/images/abc123.jpg" hoặc "https://...")
    },
    thoi_gian_xong_chuyen: {
      type: Date,
      required: false,
      // Ghi chú: Thời điểm hoàn thành chuyến đi và upload hình ảnh
    },
    ghi_chu: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
    // Ghi chú: Tự động thêm createdAt và updatedAt cho mỗi document
  }
);

module.exports = mongoose.model("phuXe", phuXeSchema);
