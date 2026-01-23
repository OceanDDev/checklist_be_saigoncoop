// controllers/phuXeController.js
const PhuXe = require("../../models/phuxe/phuxe");
const PhuXeName = require("../../models/phuxe/tenphuxe");
const CuaHang = require("../../models/dieuvan/cuahang/cuahang");
const Chbx = require("../../models/phuxe/chbx");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// ✅ Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Cấu hình Cloudinary Storage cho Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "phuxe", // Thư mục trên Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      {
        width: 1920,
        height: 1080,
        crop: "limit", // Giữ tỷ lệ, không vượt quá kích thước
        quality: 80, // Giảm quality để tiết kiệm dung lượng
      },
    ],
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

// ✅ Hàm tự động xóa ảnh cũ khi storage gần đầy
const autoCleanupOldImages = async () => {
  try {
    console.log("🔍 Đang kiểm tra storage quota...");

    // 1. Kiểm tra quota Cloudinary
    const usage = await cloudinary.api.usage();
    const usedPercentage = (usage.storage.used / usage.storage.limit) * 100;

    console.log(`📊 Storage usage: ${usedPercentage.toFixed(1)}%`);
    console.log(
      `💾 Used: ${(usage.storage.used / 1024 / 1024).toFixed(2)}MB / ${(
        usage.storage.limit /
        1024 /
        1024
      ).toFixed(2)}MB`
    );

    // 2. Nếu đạt ngưỡng 90% → Bắt đầu xóa
    if (usedPercentage >= 90) {
      console.log("🗑️ Storage đạt 90%, đang tự động xóa ảnh cũ...");

      // 3. Lấy danh sách ảnh cũ nhất
      const oldRecords = await PhuXe.find({
        hinh_anh: { $exists: true, $ne: null, $ne: "" },
      })
        .sort({ thoi_gian_xong_chuyen: 1 }) // Sắp xếp từ cũ → mới
        .limit(50); // Xóa tối đa 50 ảnh/lần

      if (oldRecords.length === 0) {
        console.log("⚠️ Không tìm thấy ảnh cũ để xóa");
        return { deleted: 0, message: "No images to delete" };
      }

      console.log(`📋 Tìm thấy ${oldRecords.length} ảnh cũ để xóa`);
      let deletedCount = 0;
      const deletedImages = [];

      for (const record of oldRecords) {
        try {
          const imageUrl = record.hinh_anh;

          // Extract public_id từ URL Cloudinary
          // URL mẫu: https://res.cloudinary.com/xxx/image/upload/v123456/phuxe/phuxe-123.jpg
          const matches = imageUrl.match(/\/phuxe\/([^\.]+)/);

          if (matches && matches[1]) {
            const publicId = `phuxe/${matches[1]}`;

            // Xóa ảnh trên Cloudinary
            const result = await cloudinary.uploader.destroy(publicId);

            if (result.result === "ok" || result.result === "not found") {
              console.log(`🗑️ Đã xóa ảnh: ${publicId}`);

              // Xóa URL trong database
              await PhuXe.findByIdAndUpdate(record._id, {
                $unset: { hinh_anh: "" },
              });

              deletedCount++;
              deletedImages.push({
                id: record._id,
                publicId: publicId,
                date: record.thoi_gian_xong_chuyen,
              });
            } else {
              console.warn(`⚠️ Không thể xóa ảnh ${publicId}:`, result);
            }
          } else {
            console.warn(`⚠️ Không parse được public_id từ URL: ${imageUrl}`);
          }
        } catch (err) {
          console.error(`❌ Lỗi xóa ảnh ${record._id}:`, err.message);
        }

        // 6. Kiểm tra lại quota sau mỗi 10 ảnh
        if (deletedCount % 10 === 0 && deletedCount > 0) {
          const newUsage = await cloudinary.api.usage();
          const newPercentage =
            (newUsage.storage.used / newUsage.storage.limit) * 100;

          console.log(
            `📊 Quota sau khi xóa ${deletedCount} ảnh: ${newPercentage.toFixed(
              1
            )}%`
          );

          // Dừng khi xuống dưới 85%
          if (newPercentage < 85) {
            console.log(
              `✅ Đã giải phóng đủ dung lượng: ${newPercentage.toFixed(1)}%`
            );
            break;
          }
        }
      }

      // Kiểm tra quota cuối cùng
      const finalUsage = await cloudinary.api.usage();
      const finalPercentage =
        (finalUsage.storage.used / finalUsage.storage.limit) * 100;

      console.log(`✅ Cleanup hoàn tất: Đã xóa ${deletedCount} ảnh`);
      console.log(`📊 Storage sau cleanup: ${finalPercentage.toFixed(1)}%`);

      return {
        deleted: deletedCount,
        newUsage: finalPercentage,
        deletedImages: deletedImages,
      };
    }

    return { deleted: 0, message: "Storage vẫn còn đủ" };
  } catch (error) {
    console.error("❌ Lỗi autoCleanupOldImages:", error);
    throw error;
  }
};

// ✅ Middleware kiểm tra và xóa tự động trước khi upload
const autoCleanupMiddleware = async (req, res, next) => {
  try {
    const usage = await cloudinary.api.usage();
    const usedPercentage = (usage.storage.used / usage.storage.limit) * 100;

    console.log(`📊 Current storage: ${usedPercentage.toFixed(1)}%`);

    // Nếu đạt 90% → Tự động xóa ảnh cũ
    if (usedPercentage >= 90) {
      console.log(
        `⚠️ Storage đạt ${usedPercentage.toFixed(1)}% - Đang tự động dọn dẹp...`
      );

      const cleanupResult = await autoCleanupOldImages();

      console.log(`✅ Đã xóa ${cleanupResult.deleted} ảnh cũ`);

      // Nếu vẫn đầy sau khi xóa → Từ chối upload
      if (cleanupResult.newUsage && cleanupResult.newUsage >= 95) {
        return res.status(400).json({
          message:
            "Hệ thống lưu trữ vẫn đầy sau khi dọn dẹp. Vui lòng liên hệ quản trị viên.",
          errorType: "STORAGE_FULL_AFTER_CLEANUP",
          usage: cleanupResult.newUsage,
        });
      }
    }

    next();
  } catch (error) {
    console.error("❌ Lỗi autoCleanupMiddleware:", error);
    // Vẫn cho phép upload nếu cleanup lỗi
    next();
  }
};

// Export cleanup functions
exports.autoCleanupMiddleware = autoCleanupMiddleware;
exports.autoCleanupOldImages = autoCleanupOldImages;

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

    // ✅ Cloudinary tự động trả URL đầy đủ trong req.file.path
    if (req.file) {
      phuXeData.hinh_anh = req.file.path; // URL từ Cloudinary
      phuXeData.thoi_gian_xong_chuyen = new Date();
      console.log("📸 Image saved to Cloudinary:", phuXeData.hinh_anh);
    }

    const newPhuXe = new PhuXe(phuXeData);
    const saved = await newPhuXe.save();

    res.status(201).json({
      message: "Thêm phụ xe thành công",
      data: saved,
      ngay_import: saved.createdAt,
    });
  } catch (error) {
    console.error("❌ Error adding phu xe:", error);
    res.status(500).json({
      message: "Lỗi khi thêm phụ xe",
      error: error.message,
    });
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

  exports.updatePhuXe = async (req, res) => {
    try {
      console.log("📥 Update request body:", req.body);
      console.log("📷 Upload file:", req.file);

      // ✅ QUAN TRỌNG: Tách riêng updateData
      const updateData = {};

      // Copy các field từ req.body (KHÔNG BAO GỒM hinh_anh)
      Object.keys(req.body).forEach((key) => {
        if (key !== "hinh_anh") {
          // ✅ Bỏ qua hinh_anh từ body
          updateData[key] = req.body[key];
        }
      });

      // Nếu có cập nhật điều vận xác nhận
      if (updateData.dieu_van_xac_nhan) {
        updateData.thoi_gian_di = new Date();
      }

      // ✅ CHỈ CÂP NHẬT hinh_anh khi có file upload
      if (req.file) {
        updateData.hinh_anh = req.file.path; // URL từ Cloudinary
        updateData.thoi_gian_xong_chuyen = new Date();
        console.log("✅ New image URL:", updateData.hinh_anh);
      } else {
        console.log("⚠️ No file uploaded, keeping existing image");
      }

      console.log("📝 Final update data:", updateData);

      const updated = await PhuXe.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: false, // ✅ Tắt validation để không bắt buộc các field
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
      console.error("Error stack:", error.stack);

      // Xử lý lỗi Cloudinary cụ thể
      if (error.message?.includes("storage quota") || error.http_code === 400) {
        return res.status(400).json({
          message: "Hệ thống lưu trữ đã đầy. Vui lòng liên hệ quản trị viên.",
          errorType: "STORAGE_LIMIT_EXCEEDED",
        });
      }

      res.status(500).json({
        message: "Lỗi khi cập nhật phụ xe",
        error: error.message,
      });
    }
  };

// 🗑️ Xóa phụ xe theo ID
exports.deletePhuXe = async (req, res) => {
  try {
    const deleted = await PhuXe.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy phụ xe để xóa" });
    }

    // ✅ Xóa ảnh trên Cloudinary (optional)
    if (deleted.hinh_anh) {
      try {
        const matches = deleted.hinh_anh.match(/\/phuxe\/([^\.]+)/);
        if (matches && matches[1]) {
          const publicId = `phuxe/${matches[1]}`;
          await cloudinary.uploader.destroy(publicId);
          console.log(`🗑️ Đã xóa ảnh Cloudinary: ${publicId}`);
        }
      } catch (err) {
        console.error("⚠️ Không thể xóa ảnh Cloudinary:", err.message);
        // Không throw error, vẫn xóa record trong DB
      }
    }

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
