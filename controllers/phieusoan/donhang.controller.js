const DonHang = require("../../models/phieusoan/donhang");
const CuaHang = require("../../models/dieuvan/cuahang/cuahang");
const mongoose = require("mongoose");

// ============= OPTIMIZED getAllDonHang =============
exports.getAllDonHang = async (req, res) => {
  try {
    const {
      store,
      type,
      trang_thai,
      soda_transfer,
      sku,
      name,
      startDate,
      endDate,
      minLuong,
      maxLuong,
      search,
      page = 1,
      limit = 10,
      sort = "-ngay_import",
      skipStoreInfo = "false", // ✨ Tham số mới để skip populate
    } = req.query;

    // Tạo filter
    let filter = {};

    if (store) filter.store = store;
    if (type) filter.type = type;
    if (trang_thai !== undefined) filter.trang_thai = trang_thai === "true";
    if (soda_transfer) filter.soda_transfer = Number(soda_transfer);
    if (sku) filter.sku = Number(sku);
    if (name) filter.name = { $regex: name, $options: "i" };

    // Date range filter
    if (startDate || endDate) {
      filter.ngay_import = {};
      if (startDate) filter.ngay_import.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.ngay_import.$lte = end;
      }
    }

    // Range filter cho lượng
    if (minLuong || maxLuong) {
      filter.luong = {};
      if (minLuong) filter.luong.$gte = Number(minLuong);
      if (maxLuong) filter.luong.$lte = Number(maxLuong);
    }

    // Tìm kiếm tổng hợp
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: !isNaN(search) ? Number(search) : null },
        { soda_transfer: !isNaN(search) ? Number(search) : null },
      ].filter((item) => item.sku !== null && item.soda_transfer !== null);
    }

    // Tính toán phân trang
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // ✨ OPTIMIZATION 1: Chạy song song count và query
    const [totalDocuments, donHangs] = await Promise.all([
      DonHang.countDocuments(filter),
      DonHang.find(filter).sort(sort).skip(skip).limit(limitNumber).lean(), // ✨ OPTIMIZATION 2: Dùng .lean() để trả về plain object
    ]);

    const totalPages = Math.ceil(totalDocuments / limitNumber);

    let responseData = donHangs;

    // ✨ OPTIMIZATION 3: Chỉ populate storeInfo khi cần
    if (skipStoreInfo !== "true") {
      // ✨ OPTIMIZATION 4: Batch query thay vì loop
      const storeIds = [...new Set(donHangs.map((dh) => dh.store))];
      const cuaHangs = await CuaHang.find({ maCH: { $in: storeIds } }).lean();

      // Tạo Map để lookup nhanh
      const storeMap = new Map(cuaHangs.map((ch) => [ch.maCH, ch]));

      responseData = donHangs.map((dh) => ({
        ...dh,
        storeInfo: storeMap.get(dh.store) || null,
      }));
    }

    res.status(200).json({
      success: true,
      data: responseData,
      pagination: {
        currentPage: pageNumber,
        totalPages: totalPages,
        totalDocuments: totalDocuments,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách đơn hàng",
      error: error.message,
    });
  }
};

// ============= OPTIMIZED checkDuplicateDonHang =============
exports.checkDuplicateDonHang = async (req, res) => {
  try {
    let donHangs = req.body.donHangs || req.body;

    if (req.body.donHangs) {
      donHangs = req.body.donHangs;
    } else if (Array.isArray(req.body)) {
      donHangs = req.body;
    } else {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mảng đơn hàng hoặc { donHangs: [...] }",
      });
    }

    if (!Array.isArray(donHangs) || donHangs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu đơn hàng phải là mảng và không được rỗng",
      });
    }

    // Chuẩn hóa dữ liệu
    const normalizeDonHang = (item) => ({
      store: item.store || item.STORE || item.Store,
      type: item.type || item.TYPE || item.Type,
      soda_transfer: item.soda_transfer || item.SODA_TRANSFER,
      sku: item.sku || item.SKU,
      name: item.name || item.NAME || item.Name,
      luong: item.luong || item.LUONG,
      ngay_import: item.ngay_import || item.NGAY_IMPORT || new Date(),
    });

    const normalizedDonHangs = donHangs.map(normalizeDonHang);

    // ✨ OPTIMIZATION: Chỉ query những combination cần check
    const checks = normalizedDonHangs.map((row) => {
      const date = row.ngay_import
        ? new Date(row.ngay_import).toISOString().split("T")[0]
        : "";
      const dateObj = new Date(date);
      const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0));
      const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999));

      return {
        store: row.store,
        type: row.type,
        soda_transfer: row.soda_transfer,
        sku: row.sku,
        ngay_import: { $gte: startOfDay, $lte: endOfDay },
      };
    });

    // Query tất cả các potential duplicates cùng lúc
    const existingDonHangs = await DonHang.find({
      $or: checks,
    }).lean();

    // Tạo Map để check nhanh
    const existingMap = new Map();
    existingDonHangs.forEach((order) => {
      const date = order.ngay_import
        ? new Date(order.ngay_import).toISOString().split("T")[0]
        : "";
      const key = `${order.store}_${order.type}_${order.soda_transfer}_${order.sku}_${date}`;
      existingMap.set(key, order);
    });

    // Kiểm tra duplicate
    const validRows = [];
    const duplicates = [];

    normalizedDonHangs.forEach((row, index) => {
      const date = row.ngay_import
        ? new Date(row.ngay_import).toISOString().split("T")[0]
        : "";
      const key = `${row.store}_${row.type}_${row.soda_transfer}_${row.sku}_${date}`;

      if (existingMap.has(key)) {
        const existingOrder = existingMap.get(key);
        duplicates.push({
          rowIndex: index + 1,
          inputData: {
            store: row.store,
            type: row.type,
            soda_transfer: row.soda_transfer,
            sku: row.sku,
            name: row.name,
            luong: row.luong,
            ngay_import: date,
          },
          existingData: {
            id: existingOrder._id,
            store: existingOrder.store,
            type: existingOrder.type,
            soda_transfer: existingOrder.soda_transfer,
            sku: existingOrder.sku,
            name: existingOrder.name,
            luong: existingOrder.luong,
            ngay_import: existingOrder.ngay_import,
            created_at: existingOrder.createdAt,
          },
        });
      } else {
        validRows.push(row);
      }
    });

    res.status(200).json({
      success: true,
      message: "Kiểm tra duplicate hoàn tất",
      summary: {
        totalInput: donHangs.length,
        validCount: validRows.length,
        duplicateCount: duplicates.length,
        canImport: validRows.length > 0,
      },
      validRows: validRows,
      duplicates: duplicates,
      details: {
        duplicateKeys: duplicates.map((d) => ({
          rowIndex: d.rowIndex,
          key: `Store: ${d.inputData.store} | Type: ${d.inputData.type} | SD/TF: ${d.inputData.soda_transfer} | SKU: ${d.inputData.sku} | Date: ${d.inputData.ngay_import}`,
        })),
      },
    });
  } catch (error) {
    console.error("Error in checkDuplicateDonHang:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi kiểm tra duplicate",
      error: error.message,
    });
  }
};

// ============= OPTIMIZED searchDonHang =============
exports.searchDonHang = async (req, res) => {
  try {
    const {
      keyword,
      page = 1,
      limit = 10,
      sort = "-ngay_import",
      store,
      type,
      trang_thai,
      skipStoreInfo = "false",
    } = req.query;

    // Tạo filter tìm kiếm
    let filter = {};

    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { soda_transfer: { $regex: keyword, $options: "i" } },
        { sku: !isNaN(keyword) ? Number(keyword) : null },
      ].filter((item) => item.sku !== null);
    }

    if (store) filter.store = store;
    if (type) filter.type = type;
    if (trang_thai !== undefined) filter.trang_thai = trang_thai === "true";

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // ✨ Chạy song song count và query
    const [totalDocuments, donHangs] = await Promise.all([
      DonHang.countDocuments(filter),
      DonHang.find(filter).sort(sort).skip(skip).limit(limitNumber).lean(),
    ]);

    const totalPages = Math.ceil(totalDocuments / limitNumber);

    let responseData = donHangs;

    // ✨ Batch populate storeInfo
    if (skipStoreInfo !== "true") {
      const storeIds = [...new Set(donHangs.map((dh) => dh.store))];
      const cuaHangs = await CuaHang.find({ maCH: { $in: storeIds } }).lean();
      const storeMap = new Map(cuaHangs.map((ch) => [ch.maCH, ch]));

      responseData = donHangs.map((dh) => ({
        ...dh,
        storeInfo: storeMap.get(dh.store) || null,
      }));
    }

    res.status(200).json({
      success: true,
      data: responseData,
      pagination: {
        currentPage: pageNumber,
        totalPages: totalPages,
        totalDocuments: totalDocuments,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm đơn hàng",
      error: error.message,
    });
  }
};

// ============= Các API khác giữ nguyên =============
exports.createDonHang = async (req, res) => {
  try {
    const { store, ...otherData } = req.body;

    const cuaHang = await CuaHang.findOne({ maCH: store });
    if (!cuaHang) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cửa hàng với mã này",
      });
    }

    const donHang = new DonHang({ store, ...otherData });
    await donHang.save();

    res.status(201).json({
      success: true,
      message: "Tạo đơn hàng thành công",
      data: donHang,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Lỗi khi tạo đơn hàng",
      error: error.message,
    });
  }
};

exports.createManyDonHang = async (req, res) => {
  try {
    let donHangs = req.body.donHangs || req.body;

    if (req.body.donHangs) {
      donHangs = req.body.donHangs;
    } else if (Array.isArray(req.body)) {
      donHangs = req.body;
    } else {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mảng đơn hàng hoặc { donHangs: [...] }",
      });
    }

    if (!Array.isArray(donHangs) || donHangs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu đơn hàng phải là mảng và không được rỗng",
      });
    }

    const normalizeDonHang = (item) => ({
      store: item.store || item.STORE || item.Store,
      type: item.type || item.TYPE || item.Type,
      soda_transfer: item.soda_transfer || item.SODA_TRANSFER,
      sku: item.sku || item.SKU,
      name: item.name || item.NAME || item.Name,
      luong: item.luong || item.LUONG,
      ngay_import: item.ngay_import || item.NGAY_IMPORT || new Date(),
      trang_thai: item.trang_thai ?? false,
    });

    donHangs = donHangs.map(normalizeDonHang);

    const maCHs = [...new Set(donHangs.map((dh) => dh.store).filter(Boolean))];

    if (maCHs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy mã cửa hàng nào trong dữ liệu",
      });
    }

    const cuaHangs = await CuaHang.find({ maCH: { $in: maCHs } });
    const validMaCHs = cuaHangs.map((ch) => ch.maCH);

    const validDonHangs = donHangs.filter((dh) =>
      validMaCHs.includes(dh.store)
    );

    if (validDonHangs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có mã cửa hàng nào hợp lệ",
      });
    }

    const createdDonHangs = await DonHang.insertMany(validDonHangs);

    res.status(201).json({
      success: true,
      message: `Tạo thành công ${createdDonHangs.length} đơn hàng`,
      data: createdDonHangs,
      count: createdDonHangs.length,
      skipped: donHangs.length - validDonHangs.length,
    });
  } catch (error) {
    console.error("Error in createManyDonHang:", error);
    res.status(400).json({
      success: false,
      message: "Lỗi khi tạo nhiều đơn hàng",
      error: error.message,
    });
  }
};

exports.getDonHangById = async (req, res) => {
  try {
    const donHang = await DonHang.findById(req.params.id);

    if (!donHang) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    const cuaHang = await CuaHang.findOne({ maCH: donHang.store });

    res.status(200).json({
      success: true,
      data: {
        ...donHang.toObject(),
        storeInfo: cuaHang,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy đơn hàng",
      error: error.message,
    });
  }
};

exports.updateDonHang = async (req, res) => {
  try {
    const { store, ...otherData } = req.body;

    if (store) {
      const cuaHang = await CuaHang.findOne({ maCH: store });
      if (!cuaHang) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy cửa hàng với mã này",
        });
      }
    }

    const updateData = store ? { store, ...otherData } : otherData;

    const donHang = await DonHang.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!donHang) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    const cuaHang = await CuaHang.findOne({ maCH: donHang.store });

    res.status(200).json({
      success: true,
      message: "Cập nhật đơn hàng thành công",
      data: {
        ...donHang.toObject(),
        storeInfo: cuaHang,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Lỗi khi cập nhật đơn hàng",
      error: error.message,
    });
  }
};

exports.deleteDonHang = async (req, res) => {
  try {
    const donHang = await DonHang.findByIdAndDelete(req.params.id);

    if (!donHang) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    res.status(200).json({
      success: true,
      message: "Xóa đơn hàng thành công",
      data: donHang,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa đơn hàng",
      error: error.message,
    });
  }
};  

exports.deleteManyDonHang = async (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== "DELETE_ALL") {
      return res.status(400).json({
        message: '❌ Vui lòng nhập đúng "DELETE_ALL" để xác nhận',
        required: 'confirmation: "DELETE_ALL"',
      });
    }
    const result = await DonHang.deleteMany({});
    res
      .status(200)
      .json({ message: `🔥 Đã xóa ${result.deletedCount} đơn hàng` });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "❌ Xóa toàn bộ đơn hàng thất bại",
        error: error.message,
      });
  }
};
 
exports.updateTrangThai = async (req, res) => {
  try {
    const { trang_thai } = req.body;

    const donHang = await DonHang.findByIdAndUpdate(
      req.params.id,
      { trang_thai },
      { new: true, runValidators: true }
    );

    if (!donHang) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    const cuaHang = await CuaHang.findOne({ maCH: donHang.store });

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: {
        ...donHang.toObject(),
        storeInfo: cuaHang,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Lỗi khi cập nhật trạng thái",
      error: error.message,
    });
  }
};
