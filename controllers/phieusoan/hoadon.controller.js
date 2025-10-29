const HoaDon = require("../models/HoaDon");
const Cuahang = require("../models/Cuahang");

// Tạo một hóa đơn
exports.createOne = async (req, res) => {
  try {
    const { store, type, soda_transfer, sku, name, luong } = req.body;

    // Kiểm tra store có tồn tại không
    const storeExists = await Cuahang.findById(store);
    if (!storeExists) {
      return res.status(404).json({ 
        success: false, 
        message: "Cửa hàng không tồn tại" 
      });
    }

    const hoaDon = new HoaDon({
      store,
      type,
      soda_transfer,
      sku,
      name,
      luong,
    });

    await hoaDon.save();
    
    res.status(201).json({
      success: true,
      message: "Tạo hóa đơn thành công",
      data: hoaDon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo hóa đơn",
      error: error.message,
    });
  }
};

// Tạo nhiều hóa đơn cùng lúc
exports.createMany = async (req, res) => {
  try {
    const { hoaDons } = req.body; // Mảng các hóa đơn

    if (!Array.isArray(hoaDons) || hoaDons.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu phải là một mảng và không được rỗng",
      });
    }

    // Kiểm tra tất cả store có tồn tại không
    const storeIds = [...new Set(hoaDons.map(hd => hd.store))];
    const stores = await Cuahang.find({ _id: { $in: storeIds } });
    
    if (stores.length !== storeIds.length) {
      return res.status(404).json({
        success: false,
        message: "Một hoặc nhiều cửa hàng không tồn tại",
      });
    }

    const createdHoaDons = await HoaDon.insertMany(hoaDons);

    res.status(201).json({
      success: true,
      message: `Tạo thành công ${createdHoaDons.length} hóa đơn`,
      data: createdHoaDons,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo nhiều hóa đơn",
      error: error.message,
    });
  }
};

// Lấy tất cả hóa đơn với phân trang và filter
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, store } = req.query;
    
    const filter = {};
    if (type) filter.type = type;
    if (store) filter.store = store;

    const hoaDons = await HoaDon.find(filter)
      .populate("store", "name address") // Populate thông tin cửa hàng
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ ngay_import: -1 });

    const count = await HoaDon.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: hoaDons,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách hóa đơn",
      error: error.message,
    });
  }
};

// Lấy một hóa đơn theo ID
exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;

    const hoaDon = await HoaDon.findById(id).populate("store");

    if (!hoaDon) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    res.status(200).json({
      success: true,
      data: hoaDon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy hóa đơn",
      error: error.message,
    });
  }
};

// Cập nhật một hóa đơn
exports.updateOne = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Nếu cập nhật store, kiểm tra store có tồn tại không
    if (updateData.store) {
      const storeExists = await Cuahang.findById(updateData.store);
      if (!storeExists) {
        return res.status(404).json({
          success: false,
          message: "Cửa hàng không tồn tại",
        });
      }
    }

    const hoaDon = await HoaDon.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!hoaDon) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật hóa đơn thành công",
      data: hoaDon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật hóa đơn",
      error: error.message,
    });
  }
};

// Xóa một hóa đơn
exports.deleteOne = async (req, res) => {
  try {
    const { id } = req.params;

    const hoaDon = await HoaDon.findByIdAndDelete(id);

    if (!hoaDon) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    res.status(200).json({
      success: true,
      message: "Xóa hóa đơn thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa hóa đơn",
      error: error.message,
    });
  }
};

// Xóa nhiều hóa đơn theo danh sách ID
exports.deleteMany = async (req, res) => {
  try {
    const { ids } = req.body; // Mảng các ID cần xóa

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu phải là một mảng ID và không được rỗng",
      });
    }

    const result = await HoaDon.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `Đã xóa ${result.deletedCount} hóa đơn`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa nhiều hóa đơn",
      error: error.message,
    });
  }
};

// Xóa tất cả hóa đơn (cẩn thận khi dùng)
exports.deleteAll = async (req, res) => {
  try {
    const { confirm } = req.body;

    // Yêu cầu xác nhận để tránh xóa nhầm
    if (confirm !== "DELETE_ALL") {
      return res.status(400).json({
        success: false,
        message: "Vui lòng xác nhận bằng cách gửi { confirm: 'DELETE_ALL' }",
      });
    }

    const result = await HoaDon.deleteMany({});

    res.status(200).json({
      success: true,
      message: `Đã xóa tất cả ${result.deletedCount} hóa đơn`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa tất cả hóa đơn",
      error: error.message,
    });
  }
};