// controllers/xuatTra.controller.js
const XuatTra = require("../../../models/dieuvan/xuattra/xuattra");
const Product = require("../../../models/dieuvan/xuattra/product");
const Vendor = require("../../../models/dieuvan/xuattra/vendor");
const mongoose = require("mongoose"); // Cần thiết cho Aggregation

// Helper function để xây dựng filter cho các hàm Read
const buildFilter = (query) => {
  const filter = {};

  if (query.trangThai !== undefined) {
    filter.trangThai = query.trangThai === "true";
  }

  // Filter tìm kiếm theo RegExp (tìm kiếm không phân biệt chữ hoa/thường)
  if (query.maCH) {
    filter.maCH = new RegExp(query.maCH, "i");
  }
  if (query.vendor) {
    filter.vendor = new RegExp(query.vendor, "i");
  }
  if (query.upc) {
    filter.upc = new RegExp(query.upc, "i");
  }
  if (query.soHoaDon) {
    filter.soHoaDon = new RegExp(query.soHoaDon, "i");
  }
  if (query.soRTV) {
    filter.soRTV = new RegExp(query.soRTV, "i");
  }

  // Filter theo Hạn sử dụng
  if (query.hanSuDung) {
    const now = new Date();
    if (query.hanSuDung === "het-han") {
      // Lấy những bản ghi có hanSuDung nhỏ hơn ngày hiện tại
      filter.hanSuDung = { $lt: now };
    } else if (query.hanSuDung === "sap-het-han") {
      // Lấy những bản ghi sắp hết hạn (trong vòng 1 tháng tới)
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      filter.hanSuDung = { $gte: now, $lte: nextMonth };
    }
  }
  return filter;
};

// ====== CREATE ======
exports.createXuatTra = async (req, res) => {
  try {
    const {
      ngayXuatTra,
      soSoda,
      maCH,
      tenCH,
      sku,
      luong,
      vendor,
      vendorName,
      ngaySanXuat,
      hanSuDung,
      ghiChu,
      boPhan, // Giả định boPhan được gửi từ Frontend hoặc Middleware
      ...otherFields
    } = req.body;

    // 1. VALIDATE & LẤY THÔNG TIN CHUẨN CỦA PRODUCT
    if (!sku) {
      return res
        .status(400)
        .json({ success: false, message: "SKU là trường bắt buộc." });
    }

    // Kiểm tra luong (quantity)
    const parsedLuong = Number(luong);
    if (isNaN(parsedLuong) || parsedLuong <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Lượng (luong) phải là số dương hợp lệ.",
        });
    }

    const product = await Product.findOne({ sku });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `SKU "${sku}" không tồn tại trong hệ thống Sản phẩm.`,
      });
    }

    // 2. TÌM VÀ LẤY THÔNG TIN VENDOR (Giữ nguyên logic của bạn)
    let finalVendorName = vendorName;
    if (vendor) {
      const vendorInfo = await Vendor.findOne({ vendor });
      if (vendorInfo) {
        finalVendorName = vendorInfo.vendorName;
      } else {
        console.warn(
          `⚠️ Vendor "${vendor}" không tìm thấy. Sử dụng Vendor Name từ request.`
        );
      }
    } else {
      finalVendorName = "";
    }

    // =========================================================
    // 3. LOGIC KIỂM TRA VÀ CẬP NHẬT TRÙNG LẶP
    // =========================================================

    // Tiêu chí xác định trùng lặp: Cửa hàng, SKU, và Lượng (Quantity)
    const duplicateCriteria = {
      maCH: maCH,
      sku: sku,
      luong: parsedLuong, // Sử dụng giá trị đã parse
    };

    // Tìm tất cả các bản ghi đang tồn tại thỏa mãn tiêu chí trùng lặp
    const existingRecords = await XuatTra.find(duplicateCriteria);

    // Giá trị kiem_tra_trung mới (bao gồm cả bản ghi đang tạo)
    const newDuplicateCount = existingRecords.length + 1;

    if (existingRecords.length > 0) {
      // Cập nhật tất cả các bản ghi cũ về giá trị đếm mới
      // Ví dụ: Đang có 2 bản ghi (kiem_tra_trung = 2), bản ghi mới là thứ 3.
      // Ta cập nhật 2 bản ghi cũ lên 3.
      await XuatTra.updateMany(duplicateCriteria, {
        $set: { kiem_tra_trung: newDuplicateCount },
      });
      console.log(
        `✅ Cập nhật ${existingRecords.length} bản ghi cũ về trùng lặp lần ${newDuplicateCount}`
      );
    }

    // 4. TẠO BẢN GHI MỚI
    const newDoc = new XuatTra({
      // Thông tin chung
      ...otherFields,
      ngayXuatTra,
      soSoda,
      maCH,
      tenCH,
      ghiChu,

      // Thông tin chi tiết sản phẩm (Lấy chuẩn từ Product)
      sku: sku,
      tenHang: product.tenHang, // Lấy tên hàng chuẩn từ Product
      upc: product.upc, // Lấy UPC chuẩn từ Product
      luong: parsedLuong, // Lưu giá trị đã parse

      // Thông tin Vendor
      vendor: vendor || "",
      vendorName: finalVendorName || "",

      // Ngày tháng
      ngaySanXuat: ngaySanXuat || null,
      hanSuDung: hanSuDung || null,
      ngayCapNhap: new Date(),
      trangThai: req.body.trangThai ?? false,

      // Bộ phận (Thêm vào nếu chưa có trong Schema và body)
      boPhan: boPhan || mapNameToBoPhan(req.body.userName || "UnknownUser"),

      // Trường mới: kiem_tra_trung
      kiem_tra_trung: newDuplicateCount,
    });

    await newDoc.save();  

    res.status(201).json({
      success: true,
      message: `Tạo phiếu xuất trả thành công (Trùng lặp lần ${newDuplicateCount})`,
      data: newDoc,
    });
  } catch (error) {
    console.error("❌ Lỗi khi tạo phiếu xuất trả:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi tạo phiếu xuất trả",
        error: error.message,
      });
  }
};

// ====== READ ALL (Simple List) ======
exports.getAllXuatTra = async (req, res) => {
  try {
    const filter = buildFilter(req.query);

    // Lấy danh sách XuatTra cơ bản, không cần join
    const list = await XuatTra.find(filter).sort({ createdAt: -1 });

    res.json({ success: true, data: list });
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách phiếu xuất trả:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phiếu xuất trả",
      error: error.message,
    });
  }
};

// ====== GET WITH PRODUCT AND VENDOR INFO (OPTIMIZED for big data) ======
exports.getAllXuatTraWithDetails = async (req, res) => {
  try {
    const filter = buildFilter(req.query);

    // Sử dụng Aggregation Pipeline để join Product và Vendor trên Database
    const pipeline = [
      { $match: filter },
      { $sort: { createdAt: -1 } },
      // Giới hạn số lượng trả về (optional, thêm nếu cần pagination)
      // { $limit: 100 },

      // 1. $lookup Product (Join dựa trên trường 'sku')
      {
        $lookup: {
          from: "products",
          localField: "sku",
          foreignField: "sku",
          as: "productInfoArray",
        },
      },
      // Giả định 1 sku chỉ có 1 product, un-nest nó
      {
        $unwind: {
          path: "$productInfoArray",
          preserveNullAndEmptyArrays: true,
        },
      },

      // 2. $lookup Vendor (Join dựa trên trường 'vendor')
      {
        $lookup: {
          from: "vendors",
          localField: "vendor",
          foreignField: "vendor",
          as: "vendorInfoArray",
        },
      },
      // Giả định 1 vendor code chỉ có 1 vendor, un-nest nó
      {
        $unwind: { path: "$vendorInfoArray", preserveNullAndEmptyArrays: true },
      },

      // 3. $project để định dạng lại kết quả (chọn các trường cần thiết)
      {
        $project: {
          // Chọn các trường từ collection XuatTra
          _id: 1,
          maCH: 1,
          tenCH: 1,
          sku: 1,
          luong: 1,
          ngayXuatTra: 1,
          ghiChu: 1,
          trangThai: 1,
          vendor: 1,
          vendorName: 1,
          soSoda: 1,
          ngaySanXuat: 1,
          hanSuDung: 1,
          ngayCapNhap: 1,
          // Bổ sung thông tin chi tiết từ Product và Vendor
          tenHang: { $ifNull: ["$productInfoArray.tenHang", "$tenHang"] },
          upc: { $ifNull: ["$productInfoArray.upc", "$upc"] },
          vendorName: {
            $ifNull: ["$vendorInfoArray.vendorName", "$vendorName"],
          },

          productInfo: {
            tenHang: "$productInfoArray.tenHang",
            upc: "$productInfoArray.upc",
            productId: "$productInfoArray._id",
          },
          vendorInfo: {
            vendorName: "$vendorInfoArray.vendorName",
            vendorId: "$vendorInfoArray._id",
          },
        },
      },
    ];

    const list = await XuatTra.aggregate(pipeline);

    res.json({ success: true, data: list });
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy danh sách phiếu xuất trả với chi tiết:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phiếu xuất trả với chi tiết",
      error: error.message,
    });
  }
};

// ====== READ ONE ======
exports.getXuatTraById = async (req, res) => {
  try {
    // Tìm theo _id (ObjectId)
    let doc;
    try {
      doc = await XuatTra.findById(req.params.id);
    } catch (err) {
      // Nếu không phải ObjectId hợp lệ, tìm theo số (so)
      doc = await XuatTra.findOne({ so: req.params.id });
    }

    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu xuất trả" });
    }

    // Tối ưu: Nếu cần thông tin chi tiết nhất, dùng Aggregation cho 1 bản ghi
    const [result] = await XuatTra.aggregate([
      { $match: { _id: doc._id } },
      // Re-use logic từ getAllXuatTraWithDetails để join Product/Vendor
      {
        $lookup: {
          from: "products",
          localField: "sku",
          foreignField: "sku",
          as: "productInfoArray",
        },
      },
      {
        $unwind: {
          path: "$productInfoArray",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "vendors",
          localField: "vendor",
          foreignField: "vendor",
          as: "vendorInfoArray",
        },
      },
      {
        $unwind: { path: "$vendorInfoArray", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          ...Object.keys(doc.toObject()).reduce(
            (acc, key) => ({ ...acc, [key]: 1 }),
            {}
          ),
          productInfo: {
            tenHang: "$productInfoArray.tenHang",
            upc: "$productInfoArray.upc",
            productId: "$productInfoArray._id",
          },
          vendorInfo: {
            vendorName: "$vendorInfoArray.vendorName",
            vendorId: "$vendorInfoArray._id",
          },
        },
      },
    ]);

    if (!result) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu xuất trả" });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("❌ Lỗi khi lấy chi tiết phiếu xuất trả:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chi tiết phiếu xuất trả",
      error: error.message,
    });
  }
};

// ====== UPDATE ======
exports.updateXuatTra = async (req, res) => {
  try {
    const updateData = { ...req.body, ngayCapNhap: new Date() };

    // 1. Xử lý SKU: Lấy tên hàng và UPC chính xác
    if (req.body.sku) {
      const product = await Product.findOne({ sku: req.body.sku });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "SKU không tồn tại",
        });
      }
      updateData.tenHang = product.tenHang;
      updateData.upc = product.upc;
    }

    // 2. Xử lý Vendor: Lấy Vendor Name chính xác
    // Kiểm tra xem trường vendor có được gửi lên không (bao gồm cả trường hợp rỗng)
    if (req.body.vendor !== undefined) {
      if (req.body.vendor) {
        const vendor = await Vendor.findOne({ vendor: req.body.vendor });
        if (!vendor) {
          return res.status(404).json({
            success: false,
            message: "Vendor không tồn tại",
          });
        }
        updateData.vendorName = vendor.vendorName;
      } else {
        // Nếu Vendor code bị xóa/đặt là rỗng, xóa cả vendorName
        updateData.vendor = "";
        updateData.vendorName = "";
      }
    }

    // Tìm và cập nhật
    let updated;
    try {
      updated = await XuatTra.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
      });
    } catch (err) {
      // Nếu không phải ObjectId hợp lệ, tìm theo số (so)
      updated = await XuatTra.findOneAndUpdate(
        { so: req.params.id },
        updateData,
        { new: true, runValidators: true }
      );
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu xuất trả để cập nhật",
      });
    }

    res.json({ success: true, message: "Cập nhật thành công", data: updated });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật phiếu xuất trả:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật phiếu xuất trả",
      error: error.message,
    });
  }
};

// ====== DELETE ======
exports.deleteXuatTra = async (req, res) => {
  try {
    // Thử xóa theo _id trước
    let deleted = await XuatTra.findByIdAndDelete(req.params.id);

    // Nếu không tìm thấy, thử xóa theo số (so)
    if (!deleted) {
      deleted = await XuatTra.findOneAndDelete({ so: req.params.id });
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu xuất trả để xóa",
      });
    }

    res.json({ success: true, message: "Xóa phiếu xuất trả thành công" });
  } catch (error) {
    console.error("❌ Lỗi khi xóa phiếu xuất trả:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa phiếu xuất trả",
      error: error.message,
    });
  }
};
