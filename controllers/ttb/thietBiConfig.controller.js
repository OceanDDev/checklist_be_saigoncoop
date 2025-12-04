// controllers/thietBiConfigController.js
const ThietBiConfig = require("../../models/ttb/thietBiConfig");

// Lấy tất cả thiết bị
exports.getAllThietBi = async (req, res) => {
  try {
    const { trang_thai } = req.query;
    
    const filter = {};
    if (trang_thai) filter.trang_thai = trang_thai;

    const thietBis = await ThietBiConfig.find(filter)
      .sort({ thu_tu: 1, ten_thiet_bi: 1 });

    res.status(200).json({
      success: true,
      data: thietBis,
      total: thietBis.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Lấy thiết bị theo ID
exports.getThietBiById = async (req, res) => {
  try {
    const thietBi = await ThietBiConfig.findById(req.params.id);

    if (!thietBi) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thiết bị"
      });
    }

    res.status(200).json({
      success: true,
      data: thietBi
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Thêm thiết bị mới
exports.createThietBi = async (req, res) => {
  try {
    const { ten_thiet_bi, mo_ta, thu_tu } = req.body;

    if (!ten_thiet_bi) {
      return res.status(400).json({
        success: false,
        message: "Tên thiết bị không được để trống"
      });
    }

    const newThietBi = new ThietBiConfig({
      ten_thiet_bi: ten_thiet_bi.toUpperCase().trim(),
      mo_ta: mo_ta ? mo_ta.trim() : undefined,
      thu_tu: thu_tu || 0
    });

    const savedThietBi = await newThietBi.save();

    res.status(201).json({
      success: true,
      message: "Thêm thiết bị thành công",
      data: savedThietBi
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Thiết bị đã tồn tại trong hệ thống"
      });
    }
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Cập nhật thiết bị
exports.updateThietBi = async (req, res) => {
  try {
    const { ten_thiet_bi, mo_ta, trang_thai, thu_tu } = req.body;

    const updateData = {};
    if (ten_thiet_bi !== undefined) {
      updateData.ten_thiet_bi = ten_thiet_bi.toUpperCase().trim();
    }
    if (mo_ta !== undefined) {
      updateData.mo_ta = mo_ta.trim();
    }
    if (trang_thai !== undefined) {
      updateData.trang_thai = trang_thai;
    }
    if (thu_tu !== undefined) {
      updateData.thu_tu = thu_tu;
    }

    const updatedThietBi = await ThietBiConfig.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedThietBi) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thiết bị"
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật thiết bị thành công",
      data: updatedThietBi
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Tên thiết bị đã tồn tại"
      });
    }
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Xóa thiết bị (soft delete - chuyển sang INACTIVE)
exports.deleteThietBi = async (req, res) => {
  try {
    const thietBi = await ThietBiConfig.findByIdAndUpdate(
      req.params.id,
      { $set: { trang_thai: 'INACTIVE' } },
      { new: true }
    );

    if (!thietBi) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thiết bị"
      });
    }

    res.status(200).json({
      success: true,
      message: "Vô hiệu hóa thiết bị thành công",
      data: thietBi
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Xóa vĩnh viễn thiết bị (hard delete)
exports.permanentDeleteThietBi = async (req, res) => {
  try {
    const thietBi = await ThietBiConfig.findByIdAndDelete(req.params.id);

    if (!thietBi) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thiết bị"
      });
    }

    res.status(200).json({
      success: true,
      message: "Xóa vĩnh viễn thiết bị thành công",
      data: thietBi
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Kích hoạt lại thiết bị
exports.activateThietBi = async (req, res) => {
  try {
    const thietBi = await ThietBiConfig.findByIdAndUpdate(
      req.params.id,
      { $set: { trang_thai: 'ACTIVE' } },
      { new: true }
    );

    if (!thietBi) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thiết bị"
      });
    }

    res.status(200).json({
      success: true,
      message: "Kích hoạt thiết bị thành công",
      data: thietBi
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Seed dữ liệu ban đầu
exports.seedThietBi = async (req, res) => {
  try {
    const initialData = [
      { ten_thiet_bi: 'TOTE', mo_ta: 'Thùng nhựa TOTE', thu_tu: 1 },
      { ten_thiet_bi: 'TÚI DÀY', mo_ta: 'Túi nhựa dày', thu_tu: 2 },
      { ten_thiet_bi: 'TÚI MỎNG', mo_ta: 'Túi nhựa mỏng', thu_tu: 3 },
      { ten_thiet_bi: 'GEL', mo_ta: 'Gel làm lạnh', thu_tu: 4 },
      { ten_thiet_bi: 'SỌT', mo_ta: 'Sọt nhựa', thu_tu: 5 },
      { ten_thiet_bi: 'XE SMT', mo_ta: 'Xe đẩy SMT', thu_tu: 6 },
      { ten_thiet_bi: 'MÂM XE', mo_ta: 'Mâm xe đẩy', thu_tu: 7 },
      { ten_thiet_bi: 'GEL NHỎ', mo_ta: 'Gel làm lạnh kích thước nhỏ', thu_tu: 8 }
    ];

    // Xóa dữ liệu cũ nếu có
    const existingCount = await ThietBiConfig.countDocuments();
    
    if (existingCount > 0) {
      return res.status(200).json({
        success: true,
        message: `Đã có ${existingCount} thiết bị trong hệ thống. Không cần seed lại.`,
        data: await ThietBiConfig.find().sort({ thu_tu: 1 })
      });
    }

    // Insert dữ liệu mới
    const result = await ThietBiConfig.insertMany(initialData);

    res.status(201).json({
      success: true,
      message: `Seed thành công ${result.length} thiết bị`,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Cập nhật thứ tự nhiều thiết bị
exports.updateOrderThietBi = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mảng updates với format: [{_id, thu_tu}]"
      });
    }

    const updatePromises = updates.map(item => 
      ThietBiConfig.findByIdAndUpdate(
        item._id,
        { $set: { thu_tu: item.thu_tu } },
        { new: true }
      )
    );

    const results = await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Cập nhật thứ tự thành công",
      data: results
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};