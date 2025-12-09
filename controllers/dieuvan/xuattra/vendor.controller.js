// controllers/vendor.controller.js
const Vendor = require("../../../models/dieuvan/xuattra/vendor");

// ====== CREATE ONE ======
exports.createVendor = async (req, res) => {
  try {
    const { vendor, vendorName, sku } = req.body;

    // Kiểm tra CẢ vendor VÀ sku đã tồn tại cùng lúc chưa
    const existing = await Vendor.findOne({ vendor, sku });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Mã vendor và SKU này đã tồn tại",
      });
    }

    const newVendor = new Vendor({ vendor, vendorName, sku });
    await newVendor.save();

    res.status(201).json({
      success: true,
      message: "Tạo vendor thành công",
      data: newVendor,
    });
  } catch (error) {
    console.error("❌ Lỗi khi tạo vendor:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo vendor",
      error,
    });
  }
};

// ====== CREATE MANY ======
exports.createManyVendors = async (req, res) => {
  try {
    const { vendors } = req.body;

    if (!Array.isArray(vendors) || vendors.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ. Cần một mảng vendors",
      });
    }

    // Kiểm tra trùng CẢ vendor VÀ sku trong database
    const duplicates = [];
    for (const v of vendors) {
      const existing = await Vendor.findOne({ 
        vendor: v.vendor, 
        sku: v.sku 
      });
      if (existing) {
        duplicates.push(`${v.vendor} - ${v.sku}`);
      }
    }

    if (duplicates.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Một số cặp (vendor + SKU) đã tồn tại",
        duplicates,
      });
    }

    const result = await Vendor.insertMany(vendors);

    res.status(201).json({
      success: true,
      message: `Tạo thành công ${result.length} vendor`,
      data: result,
    });
  } catch (error) {
    console.error("❌ Lỗi khi tạo nhiều vendor:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo nhiều vendor",
      error,
    });
  }
};

// ====== READ ALL ======
exports.getAllVendors = async (req, res) => {
  try {
    const filter = {};

    // Tìm kiếm theo mã, tên vendor hoặc SKU
    if (req.query.search) {
      filter.$or = [
        { vendor: new RegExp(req.query.search, "i") },
        { vendorName: new RegExp(req.query.search, "i") },
        { sku: new RegExp(req.query.search, "i") },
      ];
    }

    const vendors = await Vendor.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: vendors,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách vendor:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách vendor",
      error,
    });
  }
};

// ====== READ ONE ======
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vendor",
      });
    }

    res.json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy chi tiết vendor:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chi tiết vendor",
      error,
    });
  }
};

// ====== GET BY CODE ======
exports.getVendorByCode = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ vendor: req.params.code });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy mã vendor",
      });
    }

    res.json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    console.error("❌ Lỗi khi tìm vendor theo mã:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm vendor theo mã",
      error,
    });
  }
};

// ====== UPDATE ======
exports.updateVendor = async (req, res) => {
  try {
    const { sku } = req.body;
    
    // Nếu update SKU, kiểm tra trùng lặp với vendor code hiện tại
    if (sku) {
      const currentVendor = await Vendor.findById(req.params.id);
      if (!currentVendor) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy vendor để cập nhật",
        });
      }

      // Kiểm tra xem có vendor nào khác có CÙNG vendor code VÀ SKU mới không
      const duplicate = await Vendor.findOne({ 
        vendor: currentVendor.vendor,
        sku: sku,
        _id: { $ne: req.params.id } // Loại trừ chính nó
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Mã vendor và SKU này đã tồn tại",
        });
      }
    }

    const updated = await Vendor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vendor để cập nhật",
      });
    }

    res.json({
      success: true,
      message: "Cập nhật vendor thành công",
      data: updated,
    });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật vendor:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật vendor",
      error,
    });
  }
};

// ====== DELETE ONE ======
exports.deleteVendor = async (req, res) => {
  try {
    const deleted = await Vendor.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vendor để xóa",
      });
    }

    res.json({
      success: true,
      message: "Xóa vendor thành công",
    });
  } catch (error) {
    console.error("❌ Lỗi khi xóa vendor:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa vendor",
      error,
    });
  }
};

// ====== DELETE MANY ======
exports.deleteManyVendors = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ. Cần một mảng ids",
      });
    }

    const result = await Vendor.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `Xóa thành công ${result.deletedCount} vendor`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ Lỗi khi xóa nhiều vendor:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa nhiều vendor",
      error,
    });
  }
};