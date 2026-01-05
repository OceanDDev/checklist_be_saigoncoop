// controllers/phuXeController.js
const PhuXe = require("../../models/phuxe/phuxe");
const PhuXeName = require("../../models/phuxe/tenphuxe");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CuaHang = require("../../models/dieuvan/cuahang/cuahang");
const Chbx = require("../../models/phuxe/chbx");

// ✅ Tạo thư mục uploads nếu chưa có
const uploadsDir = path.join(__dirname, "../../uploads/phuxe");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Created uploads directory:", uploadsDir);
}

// 📸 Cấu hình multer để upload hình ảnh
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir); // Dùng đường dẫn tuyệt đối
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "phuxe-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file ảnh!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Export middleware upload
exports.uploadImage = upload.single("hinh_anh");
exports.uploadImages = upload.array("images", 10);

// 🔧 Helper function: Tạo URL đầy đủ
const getFullImageUrl = (req, filename) => {
  const protocol = req.protocol; // http hoặc https
  const host = req.get("host"); // localhost:5000 hoặc bes1.khovanscl.io.vn
  return `${protocol}://${host}/uploads/phuxe/${filename}`;
};

// 📦 Lấy danh sách tất cả phụ xe
exports.getAllPhuXe = async (req, res) => {
  try {
    const list = await PhuXe.find().sort({ createdAt: -1 });

    const listWithNames = await Promise.all(
      list.map(async (item) => {
        const itemObj = item.toObject();

        if (
          !itemObj.ten_cua_hang ||
          itemObj.ten_cua_hang === itemObj.ma_cua_hang
        ) {
          if (itemObj.ma_cua_hang) {
            try {
              const cuaHang = await CuaHang.findOne({
                maCH: itemObj.ma_cua_hang,
              });
              if (cuaHang) {
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

    // ✅ Nếu có upload file ảnh - LƯU URL ĐẦY ĐỦ
    if (req.file) {
      phuXeData.hinh_anh = getFullImageUrl(req, req.file.filename);
      phuXeData.thoi_gian_xong_chuyen = new Date();
      console.log("📸 Image saved:", phuXeData.hinh_anh);
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

    data = data.filter(
      (item) =>
        item.khung_gio ||
        item.ten_cua_hang ||
        item.ma_cua_hang ||
        item.dich_vu ||
        item.ten_tai_xe ||
        item.bien_so_xe ||
        item.ten_phu_xe ||
        item.dieu_van_xac_nhan ||
        item.ghi_chu
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

// 🆕 API xác nhận điều vận
exports.xacNhanDieuVan = async (req, res) => {
  try {
    const { id } = req.params;
    const { dieu_van_xac_nhan } = req.body;

    const phuXe = await PhuXe.findByIdAndUpdate(
      id,
      {
        dieu_van_xac_nhan,
        thoi_gian_di: new Date(),
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

    // Nếu có cập nhật điều vận xác nhận
    if (updateData.dieu_van_xac_nhan) {
      updateData.thoi_gian_di = new Date();
    }

    // ✅ Nếu có upload file ảnh mới (single) - LƯU URL ĐẦY ĐỦ
    if (req.file) {
      updateData.hinh_anh = getFullImageUrl(req, req.file.filename);
      updateData.thoi_gian_xong_chuyen = new Date();
      console.log("📸 Single image URL:", updateData.hinh_anh);
      console.log("📁 File path on disk:", req.file.path);
    }

    // ✅ Nếu có upload nhiều ảnh (multiple) - LƯU URL ĐẦY ĐỦ
    if (req.files && req.files.length > 0) {
      const imageUrls = req.files.map((file) =>
        getFullImageUrl(req, file.filename)
      );

      updateData.hinh_anh = imageUrls[0];
      updateData.thoi_gian_xong_chuyen = new Date();

      console.log("📸 Multiple images URLs:", imageUrls);
      console.log("📁 Files saved to disk:");
      req.files.forEach((file) => console.log("  -", file.path));
    } else if (!req.file) {
      console.log("⚠️ No files received!");
    }

    const updated = await PhuXe.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy phụ xe để cập nhật" });
    }

    console.log("✅ Updated document - hinh_anh:", updated.hinh_anh);
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
    //   const filename = path.basename(deleted.hinh_anh);
    //   const filePath = path.join(uploadsDir, filename);
    //   if (fs.existsSync(filePath)) {
    //     fs.unlinkSync(filePath);
    //   }
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

// === STORE MANAGEMENT ===

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

exports.createStore = async (req, res) => {
  try {
    const { ma_cua_hang, ten_cua_hang } = req.body;

    const existed = await Chbx.findOne({ ma_cua_hang });
    if (existed) {
      return res.status(400).json({
        message: `Mã cửa hàng ${ma_cua_hang} đã tồn tại!`,
      });
    }

    const newStore = new Chbx({ ma_cua_hang, ten_cua_hang });
    const savedStore = await newStore.save();
    res.status(201).json(savedStore);
  } catch (error) {
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

exports.updateStore = async (req, res) => {
  try {
    const updatedStore = await Chbx.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
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

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        message: "Dữ liệu không hợp lệ hoặc rỗng",
      });
    }

    data = data.filter((item) => item.ma_cua_hang && item.ten_cua_hang);

    if (data.length === 0) {
      return res.status(400).json({
        message: "Không có dữ liệu hợp lệ để thêm",
      });
    }

    const existingCodes = await Chbx.find({
      ma_cua_hang: { $in: data.map((item) => item.ma_cua_hang) },
    }).select("ma_cua_hang");

    const existingCodesSet = new Set(
      existingCodes.map((item) => item.ma_cua_hang)
    );

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
