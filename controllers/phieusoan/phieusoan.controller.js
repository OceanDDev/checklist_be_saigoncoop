const PhieuSoan = require("../../models/phieusoan/phieusoan");
const DonHang = require("../../models/phieusoan/donhang");
const DinhVi = require("../../models/phieusoan/dinhvi");
const mongoose = require("mongoose");

// ==================== HELPER FUNCTION ====================

/**
 * Tạo documents phiếu soạn từ đơn hàng và định vị
 * Xử lý cả pack = 1 (đặc thù) và pack > 1 (bình thường)
 * ✅ BỎ LOGIC TON - Chỉ dựa vào pack và luong
 */
function createPhieuSoanDocuments(donHang, dinhVis) {
  console.log("📦 Processing đơn hàng:", {
    don_hang_id: donHang.don_hang_id,
    sku: donHang.sku,
    luong: donHang.luong,
    dinhVis_count: dinhVis.length,
  });

  const phieuSoans = [];
  const totalLuong = parseInt(donHang.luong);

  console.log("🔢 Total quantity:", totalLuong);

  for (const dinhVi of dinhVis) {
    const pack = parseInt(dinhVi.pack);

    console.log("📍 Định vị:", {
      slot: dinhVi.slot,
      pack: pack,
      pack_valid: pack > 0,
    });

    if (pack <= 0 || isNaN(pack)) {
      console.log("⚠️ Bỏ qua định vị không hợp lệ");
      continue;
    }

    // ✅ CASE 1: PACK = 1 → Hàng đặc thù (bán lẻ)
    if (pack === 1) {
      console.log("🎯 Tạo phiếu đặc thù:", {
        pack: 1,
        luong: totalLuong,
      });

      const phieuSoan = {
        phieu_soan_id: donHang.don_hang_id || `DH-${donHang._id}`,
        don_hang_id: donHang._id,
        store: donHang.store,
        type: donHang.type || "SD",
        soda_transfer: parseInt(donHang.soda_transfer) || 0,
        name: donHang.name,
        sku: donHang.sku,
        slot: dinhVi.slot,
        pack: 1,
        luong: totalLuong,
        luong_dieu_chinh: null,
        kien_hang: 0,
        chan_le: "Chẵn", // Tạm để Chẵn, sẽ update sau
        loai_hang: "Đặc thù",
        trang_thai: false,
        ngay_ra_phieu: new Date(),
      };

      phieuSoans.push(phieuSoan); 
      break;
    }

    // ✅ CASE 2: PACK > 1 → Hàng bình thường
    const kienHang = Math.floor(totalLuong / pack);
    const soDu = totalLuong % pack; // 🔥 KEY: Số dư quyết định chẵn/lẻ

    // ✅ LOGIC MỚI:
    // - Chẵn: lượng chia hết cho pack (soDu === 0)
    // - Lẻ: lượng KHÔNG chia hết cho pack (soDu !== 0)
    const chanLe = soDu === 0 ? "Chẵn" : "Lẻ";

    console.log("📊 Tính toán kiện:", {
      pack: pack,
      totalLuong: totalLuong,
      kienHang: kienHang,
      soDu: soDu,
      chanLe: chanLe, // ✅ Dựa vào số dư
    });

    const phieuSoan = {
      phieu_soan_id: donHang.don_hang_id || `DH-${donHang._id}`,
      don_hang_id: donHang._id,
      store: donHang.store,
      type: donHang.type || "SD",
      soda_transfer: parseInt(donHang.soda_transfer) || 0,
      name: donHang.name,
      sku: donHang.sku,
      slot: dinhVi.slot,
      pack: pack,
      luong: totalLuong,
      luong_dieu_chinh: null,
      kien_hang: kienHang,
      chan_le: chanLe, // ✅ FIXED: Dựa vào số dư
      loai_hang: "Bình thường",
      trang_thai: false,
      ngay_ra_phieu: new Date(),
    };

    phieuSoans.push(phieuSoan);
    break;
  }

  console.log("📋 Kết quả tạo phiếu:", {
    tong_phieu: phieuSoans.length,
    luong_don_hang: totalLuong,
  });

  return phieuSoans;
}

// ==================== XỬ LÝ ĐƠN HÀNG ====================

/**
 * POST /phieusoan/process
 * Xử lý đơn hàng và tạo phiếu soạn
 */
exports.processOrders = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { donHangIds } = req.body;

    console.log("📦 Request IDs:", donHangIds);

    if (!Array.isArray(donHangIds) || donHangIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Danh sách ID đơn hàng không hợp lệ",
      });
    }

    const validIds = donHangIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    console.log("✅ Valid IDs:", validIds.length);

    if (validIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Không có ID nào có định dạng hợp lệ",
      });
    }

    const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));

    // ✅ Lấy tất cả đơn hàng cần xử lý
    const donHangs = await DonHang.find({
      _id: { $in: objectIds },
      trang_thai: false,
    }).session(session);

    console.log("📦 Đơn hàng tìm thấy:", donHangs.length);

    if (donHangs.length === 0) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng hợp lệ hoặc đơn đã được xử lý",
      });
    }

    // ✅ 1. Lấy tất cả SKU cần thiết (1 query thay vì N queries)
    const uniqueSkus = [...new Set(donHangs.map((dh) => parseInt(dh.sku)))];

    console.log("🔍 Unique SKUs:", uniqueSkus);

    const allDinhVis = await DinhVi.find({
      sku: { $in: uniqueSkus },
    })
      .sort({ sku: 1, ngay_import: 1 })
      .session(session);

    console.log("📍 Định vị tìm thấy:", allDinhVis.length);

    // ✅ 2. Group định vị theo SKU để lookup nhanh
    const dinhVisBySku = {};
    allDinhVis.forEach((dv) => {
      const sku = parseInt(dv.sku);
      if (!dinhVisBySku[sku]) {
        dinhVisBySku[sku] = [];
      }
      dinhVisBySku[sku].push(dv);
    });

    const results = [];
    const errors = [];
    const phieuSoansToInsert = [];
    const donHangIdsToUpdate = [];

    // ✅ 3. Xử lý tất cả đơn hàng và prepare bulk data
    for (const donHang of donHangs) {
      try {
        const sku = parseInt(donHang.sku);
        const dinhVis = dinhVisBySku[sku] || [];

        console.log("🔍 Xử lý đơn hàng:", {
          id: donHang._id,
          don_hang_id: donHang.don_hang_id,
          sku: sku,
          luong: donHang.luong,
          dinhVis_found: dinhVis.length,
        });

        if (dinhVis.length === 0) {
          throw new Error(`SKU ${donHang.sku} không tồn tại trong định vị`);
        }

        const phieuSoans = createPhieuSoanDocuments(donHang, dinhVis);

        console.log("✅ Đã tạo phiếu:", phieuSoans.length);

        phieuSoansToInsert.push(...phieuSoans);
        donHangIdsToUpdate.push(donHang._id);
      } catch (error) {
        console.error(
          `❌ Error processing order ${donHang._id}:`,
          error.message
        );
        errors.push({
          don_hang_id: donHang._id,
          sku: donHang.sku,
          name: donHang.name,
          error: error.message,
        });
      }
    }

    console.log("📊 Tổng kết:", {
      phieuSoansToInsert: phieuSoansToInsert.length,
      donHangIdsToUpdate: donHangIdsToUpdate.length,
      errors: errors.length,
    });

    // ✅ 4. Bulk insert tất cả phiếu soạn (1 query thay vì N queries)
    let insertedPhieuSoans = [];
    if (phieuSoansToInsert.length > 0) {
      insertedPhieuSoans = await PhieuSoan.insertMany(phieuSoansToInsert, {
        session,
        ordered: false,
      });

      console.log("✅ Đã insert phiếu soạn:", insertedPhieuSoans.length);
    }

    // ✅ 5. Bulk update trạng thái đơn hàng (1 query thay vì N queries)
    if (donHangIdsToUpdate.length > 0) {
      const updateResult = await DonHang.updateMany(
        { _id: { $in: donHangIdsToUpdate } },
        { $set: { trang_thai: true } }
      ).session(session);

      console.log("✅ Đã update đơn hàng:", updateResult.modifiedCount);
    }

    await session.commitTransaction();

    // ✅ Đếm số phiếu soạn đặc thù (pack = 1)
    const specialPhieuSoans = insertedPhieuSoans.filter(
      (ps) => parseInt(ps.pack) === 1
    );

    console.log("🎯 Phiếu đặc thù:", specialPhieuSoans.length);

    res.status(201).json({
      success: true,
      message: `Đã tạo ${insertedPhieuSoans.length} phiếu soạn từ ${donHangs.length} đơn hàng`,
      data: insertedPhieuSoans,
      errors: errors.length > 0 ? errors : null,
      summary: {
        total_orders: donHangs.length,
        processed: insertedPhieuSoans.length,
        failed: errors.length,
        special_pack_one: specialPhieuSoans.length,
      },
      ...(specialPhieuSoans.length > 0 && {
        warning: `Có ${specialPhieuSoans.length} phiếu soạn đặc thù (pack=1) cần cập nhật chẵn/lẻ`,
      }),
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("💥 Fatal error in processOrders:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi khi xử lý đơn hàng",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// ==================== HÀNG ĐẶC THÙ ====================

exports.getSpecialOrders = async (req, res) => {
  try {
    const { page = 1, limit = 1000, store, type } = req.query;

    const filter = {
      pack: 1,
      loai_hang: "Đặc thù",
      trang_thai: false,
    };

    if (store) filter.store = store;
    if (type) filter.type = type;

    const phieuSoans = await PhieuSoan.find(filter)
      .populate("don_hang_id")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ ngay_ra_phieu: -1 });

    const count = await PhieuSoan.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Danh sách phiếu soạn đặc thù (pack=1)",
      data: phieuSoans,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        totalDocuments: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy phiếu soạn đặc thù",
      error: error.message,
    });
  }
};

exports.getSpecialOrdersCount = async (req, res) => {
  try {
    const { store, type } = req.query;

    const filter = {
      pack: 1,
      loai_hang: "Đặc thù",
      trang_thai: false,
    };

    if (store) filter.store = store;
    if (type) filter.type = type;

    const count = await PhieuSoan.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: { count },
      message: `Có ${count} phiếu soạn đặc thù (pack=1) chưa xử lý`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi đếm phiếu soạn đặc thù",
      error: error.message,
    });
  }
};

exports.updateSpecialChanLe = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message:
          "Cần cung cấp mảng updates với format: [{ phieuSoanId, chan_le }]",
      });
    }

    const results = [];
    const errors = [];
    let regeneratedCount = 0;

    for (const update of updates) {
      try {
        const { phieuSoanId, chan_le } = update;

        if (!["Chẵn", "Lẻ"].includes(chan_le)) {
          throw new Error("chan_le phải là 'Chẵn' hoặc 'Lẻ'");
        }

        const phieuSoan = await PhieuSoan.findOne({
          _id: phieuSoanId,
          pack: 1,
          loai_hang: "Đặc thù",
        }).session(session);

        if (!phieuSoan) {
          throw new Error(
            `Không tìm thấy phiếu soạn đặc thù với ID: ${phieuSoanId}`
          );
        }

        const isChanLeChanged = phieuSoan.chan_le !== chan_le;

        phieuSoan.chan_le = chan_le;
        phieuSoan.loai_hang = "Bình thường";

        if (isChanLeChanged) {
          await phieuSoan.regeneratePhieuSoanId();
          regeneratedCount++;
        } else {
          await phieuSoan.save({ session });
        }

        results.push(phieuSoan);
      } catch (error) {
        errors.push({
          phieuSoanId: update.phieuSoanId,
          error: error.message,
        });
      }
    }

    await session.commitTransaction();

    const message =
      regeneratedCount > 0
        ? `Đã cập nhật ${results.length} phiếu soạn → Chuyển sang hàng bình thường (${regeneratedCount} phiếu đã regenerate mã)`
        : `Đã cập nhật ${results.length} phiếu soạn → Chuyển sang hàng bình thường`;

    res.status(200).json({
      success: true,
      message,
      data: results,
      regeneratedCount,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật phiếu soạn đặc thù",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// ==================== CRUD OPERATIONS ====================

exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      trang_thai,
      type,
      sku,
      soda_transfer,
      store,
      chan_le,
      loai_hang = "Bình thường",
      tu_ngay,
      den_ngay,
      ngay,
      search,
      phieu_soan_id,
    } = req.query;

    const filter = {};

    if (phieu_soan_id) {
      filter.phieu_soan_id = {
        $regex: phieu_soan_id,
        $options: "i",
      };
    }
    if (search && search.trim()) {
      const searchTerm = search.trim();

      // Kiểm tra nếu search là số thì tìm theo SKU
      if (!isNaN(searchTerm)) {
        filter.sku = parseInt(searchTerm);
      } else {
        // Nếu không phải số thì tìm theo tên sản phẩm
        filter.name = {
          $regex: searchTerm,
          $options: "i", // Case insensitive
        };
      }
    }
    if (trang_thai !== undefined) {
      filter.trang_thai = trang_thai === "true" || trang_thai === true;
    }

    if (type) filter.type = type;
    if (sku) filter.sku = parseInt(sku);
    if (soda_transfer) filter.soda_transfer = parseInt(soda_transfer);
    if (store) filter.store = store;
    if (chan_le) filter.chan_le = chan_le;

    if (loai_hang && ["Bình thường", "Đặc thù"].includes(loai_hang)) {
      filter.loai_hang = loai_hang;
    }

    let useDefaultDateRange = !tu_ngay && !den_ngay && !ngay;

    if (tu_ngay || den_ngay || ngay || useDefaultDateRange) {
      filter.ngay_ra_phieu = {};

      if (useDefaultDateRange) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
        threeDaysAgo.setHours(0, 0, 0, 0);

        filter.ngay_ra_phieu = {
          $gte: threeDaysAgo,
          $lte: today,
        };
      } else if (ngay) {
        const startOfDay = new Date(ngay);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(ngay);
        endOfDay.setHours(23, 59, 59, 999);

        filter.ngay_ra_phieu = {
          $gte: startOfDay,
          $lte: endOfDay,
        };
      } else {
        if (tu_ngay) {
          const startDate = new Date(tu_ngay);
          startDate.setHours(0, 0, 0, 0);
          filter.ngay_ra_phieu.$gte = startDate;
        }

        if (den_ngay) {
          const endDate = new Date(den_ngay);
          endDate.setHours(23, 59, 59, 999);
          filter.ngay_ra_phieu.$lte = endDate;
        }
      }
    }

    const phieuSoans = await PhieuSoan.find(filter)
      .populate("don_hang_id")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ ngay_ra_phieu: -1 });

    const count = await PhieuSoan.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: phieuSoans,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        totalDocuments: count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phiếu soạn",
      error: error.message,
    });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const phieuSoan = await PhieuSoan.findById(id).populate("don_hang_id");

    if (!phieuSoan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu soạn",
      });
    }

    res.status(200).json({
      success: true,
      data: phieuSoan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy phiếu soạn",
      error: error.message,
    });
  }
};

exports.updateMany = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ids, updateData } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Dữ liệu phải là một mảng ID và không được rỗng",
      });
    }

    if (!updateData || typeof updateData !== "object") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "updateData phải là object chứa dữ liệu cần cập nhật",
      });
    }

    delete updateData.don_hang_id;
    delete updateData.ngay_ra_phieu;
    delete updateData._id;
    delete updateData.phieu_soan_id;

    if (
      updateData.loai_hang &&
      !["Bình thường", "Đặc thù"].includes(updateData.loai_hang)
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "loai_hang phải là 'Bình thường' hoặc 'Đặc thù'",
      });
    }

    if (updateData.chan_le && !["Chẵn", "Lẻ"].includes(updateData.chan_le)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "chan_le phải là 'Chẵn' hoặc 'Lẻ'",
      });
    }

    if (
      updateData.trang_thai !== undefined &&
      typeof updateData.trang_thai !== "boolean"
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "trang_thai phải là true hoặc false",
      });
    }

    const isChanLeChanged = updateData.chan_le !== undefined;

    let result;
    let regeneratedCount = 0;

    if (isChanLeChanged) {
      const phieuSoans = await PhieuSoan.find({ _id: { $in: ids } }).session(
        session
      );

      for (const phieuSoan of phieuSoans) {
        if (phieuSoan.chan_le !== updateData.chan_le) {
          Object.assign(phieuSoan, updateData);
          await phieuSoan.regeneratePhieuSoanId();
          regeneratedCount++;
        } else {
          Object.assign(phieuSoan, updateData);
          await phieuSoan.save({ session });
        }
      }

      result = {
        matchedCount: phieuSoans.length,
        modifiedCount: phieuSoans.length,
      };
    } else {
      result = await PhieuSoan.updateMany(
        { _id: { $in: ids } },
        { $set: updateData }
      ).session(session);
    }

    await session.commitTransaction();

    const message =
      regeneratedCount > 0
        ? `Đã cập nhật ${result.modifiedCount} phiếu soạn (${regeneratedCount} phiếu đã regenerate mã do đổi chẵn/lẻ)`
        : `Đã cập nhật ${result.modifiedCount} phiếu soạn`;

    res.status(200).json({
      success: true,
      message,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      regeneratedCount,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Lỗi updateMany:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật nhiều phiếu soạn",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { trang_thai } = req.body;

    if (typeof trang_thai !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Trạng thái phải là true hoặc false",
      });
    }

    const phieuSoan = await PhieuSoan.findById(id);

    if (!phieuSoan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu soạn",
      });
    }

    phieuSoan.trang_thai = trang_thai;
    await phieuSoan.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: phieuSoan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật trạng thái",
      error: error.message,
    });
  }
};

exports.updateOne = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    delete updateData.don_hang_id;
    delete updateData.ngay_ra_phieu;

    if (
      updateData.loai_hang &&
      !["Bình thường", "Đặc thù"].includes(updateData.loai_hang)
    ) {
      return res.status(400).json({
        success: false,
        message: "loai_hang phải là 'Bình thường' hoặc 'Đặc thù'",
      });
    }

    if (updateData.pack !== undefined || updateData.luong !== undefined) {
      const phieuSoan = await PhieuSoan.findById(id);
      if (phieuSoan) {
        const pack =
          updateData.pack !== undefined ? updateData.pack : phieuSoan.pack;
        const luong =
          updateData.luong !== undefined ? updateData.luong : phieuSoan.luong;
        updateData.kien_hang = pack > 0 ? Math.floor(luong / pack) : 0;
      }
    }

    const phieuSoan = await PhieuSoan.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!phieuSoan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu soạn",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật phiếu soạn thành công",
      data: phieuSoan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật phiếu soạn",
      error: error.message,
    });
  }
};

exports.deleteOne = async (req, res) => {
  try {
    const { id } = req.params;
    const phieuSoan = await PhieuSoan.findByIdAndDelete(id);

    if (!phieuSoan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu soạn",
      });
    }

    res.status(200).json({
      success: true,
      message: "Xóa phiếu soạn thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa phiếu soạn",
      error: error.message,
    });
  }
};

exports.deleteMany = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Dữ liệu phải là một mảng ID và không được rỗng",
      });
    }

    const phieuSoans = await PhieuSoan.find({ _id: { $in: ids } }).session(
      session
    );
    const donHangIds = [...new Set(phieuSoans.map((ps) => ps.don_hang_id))];

    const result = await PhieuSoan.deleteMany({ _id: { $in: ids } }).session(
      session
    );

    await DonHang.updateMany(
      { _id: { $in: donHangIds } },
      { $set: { trang_thai: false } }
    ).session(session);

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Đã xóa ${result.deletedCount} phiếu soạn và reset ${donHangIds.length} đơn hàng`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa nhiều phiếu soạn",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== "DELETE_ALL") {
      return res.status(400).json({
        success: false,
        message: "Vui lòng xác nhận bằng cách gửi { confirm: 'DELETE_ALL' }",
      });
    }

    const result = await PhieuSoan.deleteMany({});

    res.status(200).json({
      success: true,
      message: `Đã xóa tất cả ${result.deletedCount} phiếu soạn`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa tất cả phiếu soạn",
      error: error.message,
    });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const stats = await PhieuSoan.aggregate([
      {
        $group: {
          _id: "$trang_thai",
          count: { $sum: 1 },
          total_luong: { $sum: "$luong" },
        },
      },
    ]);

    const total = await PhieuSoan.countDocuments();

    const chanLeStats = await PhieuSoan.aggregate([
      {
        $group: {
          _id: "$chan_le",
          count: { $sum: 1 },
          total_luong: { $sum: "$luong" },
        },
      },
    ]);

    const storeStats = await PhieuSoan.aggregate([
      {
        $group: {
          _id: "$store",
          count: { $sum: 1 },
          total_luong: { $sum: "$luong" },
        },
      },
    ]);

    const loaiHangStats = await PhieuSoan.aggregate([
      {
        $group: {
          _id: "$loai_hang",
          count: { $sum: 1 },
          total_luong: { $sum: "$luong" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        by_status: stats,
        by_chan_le: chanLeStats,
        by_store: storeStats,
        by_loai_hang: loaiHangStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê",
      error: error.message,
    });
  }
};
