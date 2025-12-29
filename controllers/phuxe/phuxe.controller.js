// controllers/phuXeController.js
const PhuXe = require("../../models/phuxe/phuxe");
const PhuXeName = require("../../models/phuxe/tenphuxe");
const multer = require("multer");
const path = require("path");
const CuaHang = require("../../models/dieuvan/cuahang/cuahang");
const Chbx = require("../../models/phuxe/chbx");

// 📸 Cấu hình multer để upload hình ảnh
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/phuxe/"); // thư mục lưu ảnh
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "phuxe-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  // Chỉ cho phép file ảnh
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file ảnh!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // giới hạn 5MB
});

// Export middleware upload để dùng trong route
exports.uploadImage = upload.single("hinh_anh");
exports.uploadImages = upload.array("images", 10); // 🆕 Upload nhiều ảnh

// 📦 Lấy danh sách tất cả phụ xe (có ngày import)
exports.getAllPhuXe = async (req, res) => {
  try {
    const list = await PhuXe.find().sort({ createdAt: -1 });

    // 🆕 Map lại tên cửa hàng
    const listWithNames = await Promise.all(
      list.map(async (item) => {
        const itemObj = item.toObject();

        // Nếu ten_cua_hang trống hoặc giống ma_cua_hang (chưa map)
        if (
          !itemObj.ten_cua_hang ||
          itemObj.ten_cua_hang === itemObj.ma_cua_hang
        ) {
          if (itemObj.ma_cua_hang) {
            try {
              // ✅ Sửa: Dùng maCH thay vì ma_cua_hang
              const cuaHang = await CuaHang.findOne({
                maCH: itemObj.ma_cua_hang,
              });
              if (cuaHang) {
                // ✅ Sửa: Dùng tenCH thay vì ten_cua_hang
                itemObj.ten_cua_hang = cuaHang.tenCH;
              }
            } catch (error) {
              console.error(`Lỗi khi map mã ${itemObj.ma_cua_hang}:`, error);
            }
          }
        }

        return itemObj;
      })
    );

    res.status(200).json(listWithNames);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách phụ xe", error });
  }
};

// 📄 Lấy thông tin 1 phụ xe theo ID
exports.getPhuXeById = async (req, res) => {
  try {
    const phuXe = await PhuXe.findById(req.params.id);
    if (!phuXe) {
      return res.status(404).json({ message: "Không tìm thấy phụ xe" });
    }
    res.status(200).json(phuXe);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy thông tin phụ xe", error });
  }
};

// ➕ Thêm 1 phụ xe (có thể có hình ảnh)
exports.addPhuXe = async (req, res) => {
  try {
    const phuXeData = req.body;

    // Nếu có upload file ảnh
    if (req.file) {
      phuXeData.hinh_anh = `/uploads/phuxe/${req.file.filename}`;
      phuXeData.thoi_gian_xong_chuyen = new Date(); // 🆕 Lưu thời gian upload ảnh
    }

    const newPhuXe = new PhuXe(phuXeData);
    const saved = await newPhuXe.save();

    res.status(201).json({
      message: "Thêm phụ xe thành công",
      data: saved,
      ngay_import: saved.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi thêm phụ xe", error });
  }
};

// 🔥 Thêm nhiều phụ xe cùng lúc (import)
exports.addManyPhuXe = async (req, res) => {
  try {
    let data = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({ message: "Dữ liệu không hợp lệ hoặc rỗng" });
    }

    // Lọc bỏ các bản ghi hoàn toàn rỗng
    data = data.filter(
      (item) =>
        item.khung_gio ||
        item.ten_cua_hang ||
        item.ma_cua_hang ||
        item.dich_vu ||
        item.ten_tai_xe ||
        item.bien_so_xe ||
        item.ten_phu_xe ||
        item.dieu_van_xac_nhan
    );

    if (data.length === 0) {
      return res.status(400).json({ message: "Dữ liệu sau khi lọc rỗng hết" });
    }

    const inserted = await PhuXe.insertMany(data);

    res.status(201).json({
      message: `Đã thêm ${inserted.length} phụ xe thành công`,
      data: inserted,
      ngay_import: inserted[0]?.createdAt || null,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi import danh sách phụ xe", error });
  }
};

// 🆕 API xác nhận điều vận (khung giờ đi)
exports.xacNhanDieuVan = async (req, res) => {
  try {
    const { id } = req.params;
    const { dieu_van_xac_nhan } = req.body;

    const phuXe = await PhuXe.findByIdAndUpdate(
      id,
      {
        dieu_van_xac_nhan,
        thoi_gian_di: new Date(), // 🆕 Lưu thời gian xác nhận điều vận (giờ đi)
      },
      { new: true }
    );

    if (!phuXe) {
      return res.status(404).json({ message: "Không tìm thấy phụ xe" });
    }

    res.status(200).json({
      message: "Xác nhận điều vận thành công",
      data: phuXe,
    });
  } catch (error) {
    console.error("Lỗi xác nhận điều vận:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ✏️ Cập nhật phụ xe theo ID (có thể cập nhật hình ảnh)
exports.updatePhuXe = async (req, res) => {
  try {
    const updateData = req.body;

    // 🆕 Nếu có cập nhật điều vận xác nhận
    if (updateData.dieu_van_xac_nhan) {
      updateData.thoi_gian_di = new Date(); // Lưu thời gian xác nhận điều vận
    }

    // Nếu có upload file ảnh mới (single)
    if (req.file) {
      updateData.hinh_anh = `/uploads/phuxe/${req.file.filename}`;
      updateData.thoi_gian_xong_chuyen = new Date(); // Lưu thời gian xác nhận hình ảnh
    }

    // Nếu có upload nhiều ảnh (multiple)
    if (req.files && req.files.length > 0) {
      const imageUrls = req.files.map(
        (file) => `/uploads/phuxe/${file.filename}`
      );

      // Lưu ảnh đầu tiên
      updateData.hinh_anh = imageUrls[0];
      updateData.thoi_gian_xong_chuyen = new Date(); // Lưu thời gian xác nhận hình ảnh
    } else if (!req.file) {
      console.log("⚠️ No files received!");
    }
    const updated = await PhuXe.findByIdAndUpdate(req.params.id, updateData, {
      new: true, // Trả về document sau khi update
    });

    if (!updated) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy phụ xe để cập nhật" });
    }

    console.log("✅ Updated document:", updated);
    res.status(200).json(updated);
  } catch (error) {
    console.error("❌ Error updating phu xe:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi cập nhật phụ xe", error: error.message });
  }
};

// 🗑️ Xóa phụ xe theo ID
exports.deletePhuXe = async (req, res) => {
  try {
    const deleted = await PhuXe.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy phụ xe để xóa" });
    }

    // TODO: Xóa file ảnh nếu có
    // if (deleted.hinh_anh) {
    //   const fs = require('fs');
    //   fs.unlinkSync('./uploads/phuxe/' + path.basename(deleted.hinh_anh));
    // }

    res.status(200).json({ message: "Đã xóa phụ xe thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa phụ xe", error });
  }
};

// 📋 Lấy tất cả tên phụ xe
exports.getAllPhuXeNames = async (req, res) => {
  try {
    const list = await PhuXeName.find().sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách tên phụ xe", error });
  }
};

// ➕ Thêm tên phụ xe mới
exports.addPhuXeName = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Thiếu tên phụ xe" });

    const existed = await PhuXeName.findOne({ name });
    if (existed)
      return res.status(400).json({ message: "Tên phụ xe đã tồn tại" });

    const newName = new PhuXeName({ name });
    const saved = await newName.save();

    res.status(201).json({
      message: "Thêm tên phụ xe thành công",
      data: saved,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi thêm tên phụ xe", error });
  }
};

// 🗑️ Xóa tên phụ xe theo ID
exports.deletePhuXeName = async (req, res) => {
  try {
    const deleted = await PhuXeName.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tên phụ xe để xóa" });
    }
    res.status(200).json({ message: "Đã xóa tên phụ xe thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa tên phụ xe", error });
  }
};

exports.getAllStores = async (req, res) => {
  try {
    const stores = await Chbx.find().sort({ createdAt: -1 });
    res.status(200).json(stores);
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách cửa hàng",
      error: error.message,
    });
  }
};

// 2. Lấy chi tiết một cửa hàng theo ID
exports.getStoreById = async (req, res) => {
  try {
    const store = await Chbx.findById(req.params.id);
    if (!store)
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    res.status(200).json(store);
  } catch (error) {
    res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};

// 3. Tạo mới một cửa hàng
exports.createStore = async (req, res) => {
  try {
    const { ma_cua_hang, ten_cua_hang } = req.body;

    // ✅ Kiểm tra trùng mã trước khi thêm
    const existed = await Chbx.findOne({ ma_cua_hang });
    if (existed) {
      return res.status(400).json({
        message: `Mã cửa hàng ${ma_cua_hang} đã tồn tại!`,
      });
    }

    const newStore = new Chbx({
      ma_cua_hang,
      ten_cua_hang,
    });

    const savedStore = await newStore.save();
    res.status(201).json(savedStore);
  } catch (error) {
    // ✅ Bắt lỗi duplicate key từ MongoDB
    if (error.code === 11000) {
      return res.status(400).json({
        message: `Mã cửa hàng ${req.body.ma_cua_hang} đã tồn tại!`,
      });
    }
    res.status(400).json({
      message: "Không thể tạo cửa hàng",
      error: error.message,
    });
  }
};

// 4. Cập nhật thông tin cửa hàng
exports.updateStore = async (req, res) => {
  try {
    const updatedStore = await Chbx.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true } // new: true để trả về dữ liệu sau khi update
    );

    if (!updatedStore)
      return res
        .status(404)
        .json({ message: "Không tìm thấy cửa hàng để cập nhật" });
    res.status(200).json(updatedStore);
  } catch (error) {
    res.status(400).json({ message: "Lỗi khi cập nhật", error: error.message });
  }
};

// 5. Xóa cửa hàng
exports.deleteStore = async (req, res) => {
  try {
    const deletedStore = await Chbx.findByIdAndDelete(req.params.id);
    if (!deletedStore)
      return res
        .status(404)
        .json({ message: "Không tìm thấy cửa hàng để xóa" });
    res.status(200).json({ message: "Xóa cửa hàng thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa", error: error.message });
  }
};

exports.addManyStores = async (req, res) => {
  try {
    let data = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        message: "Dữ liệu không hợp lệ hoặc rỗng",
      });
    }

    // Lọc bỏ các bản ghi rỗng
    data = data.filter((item) => item.ma_cua_hang && item.ten_cua_hang);

    if (data.length === 0) {
      return res.status(400).json({
        message: "Không có dữ liệu hợp lệ để thêm",
      });
    }

    // Kiểm tra trùng mã cửa hàng trong database
    const existingCodes = await Chbx.find({
      ma_cua_hang: { $in: data.map((item) => item.ma_cua_hang) },
    }).select("ma_cua_hang");

    const existingCodesSet = new Set(
      existingCodes.map((item) => item.ma_cua_hang)
    );

    // Lọc bỏ các mã đã tồn tại
    const validData = data.filter(
      (item) => !existingCodesSet.has(item.ma_cua_hang)
    );
    const duplicates = data.filter((item) =>
      existingCodesSet.has(item.ma_cua_hang)
    );

    if (validData.length === 0) {
      return res.status(400).json({
        message: "Tất cả mã cửa hàng đã tồn tại",
        duplicates: duplicates.map((item) => item.ma_cua_hang),
      });
    }

    // Thêm vào database
    const inserted = await Chbx.insertMany(validData);

    res.status(201).json({
      message: `Đã thêm ${inserted.length} cửa hàng thành công`,
      data: inserted,
      skipped:
        duplicates.length > 0
          ? {
              count: duplicates.length,
              codes: duplicates.map((item) => item.ma_cua_hang),
            }
          : null,
    });
  } catch (error) {
    console.error("❌ Lỗi addManyStores:", error);
    res.status(500).json({
      message: "Lỗi khi import danh sách cửa hàng",
      error: error.message,
    });
  }
};
