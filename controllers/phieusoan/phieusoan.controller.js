// controllers/phieusoan.controller.js
/* eslint-disable no-console */
const mongoose = require("mongoose");
const PhieuSoan = require("../../models/phieusoan/phieusoan");
const DonHang = require("../../models/phieusoan/donhang");
const DinhVi = require("../../models/phieusoan/dinhvi");

// ==================== Small utils ====================
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const log = (...args) => {
  // Bật debug theo ENV để tránh spam log ở prod
  if (process.env.DEBUG_PS === "1") console.log(...args);
};

// ==================== CORE BUILDER ====================
/**
 * Tạo 1 phiếu soạn từ đơn hàng + định vị đầu tiên hợp lệ.
 * - pack = 1  → Đặc thù, chan_le tạm "Chẵn" (sẽ cập nhật sau)
 * - pack > 1  → Bình thường, chan_le theo số dư luong % pack
 * Ghi chú: follow logic cũ "chỉ lấy định vị đầu tiên hợp lệ".
 */
function buildSinglePhieuSoan(donHang, dinhVisSorted) {
  const totalLuong = toInt(donHang.luong, 0);
  if (totalLuong <= 0) return null;

  // chọn định vị đầu tiên có pack > 0
  const dinhVi = dinhVisSorted.find((dv) => toInt(dv.pack, 0) > 0);
  if (!dinhVi) return null;

  const pack = toInt(dinhVi.pack, 0);
  const base = {
    phieu_soan_id: donHang.don_hang_id || `DH-${donHang._id}`,
    don_hang_id: donHang._id,
    store: donHang.store,
    type: donHang.type || "SD",
    soda_transfer: toInt(donHang.soda_transfer, 0),
    name: donHang.name,
    sku: toInt(donHang.sku, 0),
    slot: dinhVi.slot,
    pack,
    maNCC: dinhVi.maNCC || "",
    maNH: dinhVi.maNH || "",
    Dept: dinhVi.Dept || "",
    SubDept: dinhVi.SubDept || "",
    luong: totalLuong,
    luong_dieu_chinh: null,
    kien_hang: 0,
    chan_le: "Chẵn",
    loai_hang: "Bình thường",
    trang_thai: false,
    ngay_ra_phieu: new Date(),
  };

  if (pack === 1) {
    // Hàng đặc thù
    return {
      ...base,
      kien_hang: 0,
      chan_le: "Chẵn", // giữ như cũ, chỉnh sau ở flow đặc thù
      loai_hang: "Đặc thù",
    };
  }

  // Hàng bình thường
  const soDu = totalLuong % pack;
  const kien_hang = Math.floor(totalLuong / pack);
  const chan_le = soDu === 0 ? "Chẵn" : "Lẻ";

  return {
    ...base,
    kien_hang,
    chan_le,
    loai_hang: "Bình thường",
  };
}

// ==================== PROCESS ORDERS ====================
/**
 * POST /phieusoan/process
 * Xử lý nhiều đơn hàng:
 * - 1 query lấy toàn bộ DonHang (lean)
 * - 1 query lấy toàn bộ DinhVi theo SKU (lean, sorted)
 * - Group DinhVi theo SKU (Map) → build phieuSoans (mảng plain)
 * - insertMany + updateMany trong 1 transaction
 */
exports.processOrders = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { donHangIds } = req.body;
      if (!Array.isArray(donHangIds) || donHangIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Danh sách ID đơn hàng không hợp lệ",
        });
      }

      const validIds = donHangIds.filter(mongoose.Types.ObjectId.isValid);
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Không có ID nào có định dạng hợp lệ",
        });
      }

      // 1) Lấy DonHang cần xử lý (chỉ trường cần dùng) - lean để giảm overhead
      const donHangs = await DonHang.find(
        { _id: { $in: validIds }, trang_thai: false },
        {
          don_hang_id: 1,
          store: 1,
          type: 1,
          soda_transfer: 1,
          name: 1,
          sku: 1,
          luong: 1,
        }
      )
        .lean()
        .session(session);

      if (donHangs.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn hàng hợp lệ hoặc đã được xử lý",
        });
      }

      // 2) Lấy toàn bộ DinhVi theo SKU (lean + sort) - bao gồm cả 4 trường mới
      const uniqueSkus = [...new Set(donHangs.map((d) => toInt(d.sku)))];
      const allDinhVis = await DinhVi.find(
        { sku: { $in: uniqueSkus } },
        {
          sku: 1,
          slot: 1,
          pack: 1,
          maNCC: 1,
          maNH: 1,
          Dept: 1,
          SubDept: 1,
          ngay_import: 1,
        }
      )
        .sort({ sku: 1, ngay_import: 1 })
        .lean()
        .session(session);

      // Group DinhVi theo SKU để lookup O(1)
      const mapDv = new Map(); // sku(int) -> array
      for (const dv of allDinhVis) {
        const key = toInt(dv.sku);
        if (!mapDv.has(key)) mapDv.set(key, []);
        mapDv.get(key).push(dv);
      }

      // 3) Build tất cả phiếu soạn & collect order ids
      const phieuSoansToInsert = [];
      const donHangIdsToUpdate = [];
      const errors = [];

      for (const dh of donHangs) {
        try {
          const sku = toInt(dh.sku);
          const dinhVis = mapDv.get(sku) || [];
          if (dinhVis.length === 0) {
            throw new Error(`SKU ${dh.sku} không tồn tại trong định vị`);
          }

          const ps = buildSinglePhieuSoan(dh, dinhVis);
          if (!ps) {
            throw new Error(
              `Không tạo được phiếu cho đơn ${dh._id} (luong/pack không hợp lệ)`
            );
          }

          phieuSoansToInsert.push(ps);
          donHangIdsToUpdate.push(dh._id);
        } catch (e) {
          errors.push({
            don_hang_id: dh._id,
            sku: dh.sku,
            name: dh.name,
            error: e.message || String(e),
          });
        }
      }

      // 4) Bulk insert + bulk update
      let insertedCount = 0;
      let insertedDocs = [];
      if (phieuSoansToInsert.length > 0) {
        insertedDocs = await PhieuSoan.insertMany(phieuSoansToInsert, {
          session,
          ordered: false,
        });
        insertedCount = insertedDocs.length;
      }

      if (donHangIdsToUpdate.length > 0) {
        await DonHang.updateMany(
          { _id: { $in: donHangIdsToUpdate } },
          { $set: { trang_thai: true } },
          { session }
        );
      }

      // Đếm pack = 1 trong insertedDocs (đã là doc mới từ insertMany)
      const specialCount = insertedDocs.reduce(
        (acc, d) => (toInt(d.pack) === 1 ? acc + 1 : acc),
        0
      );

      return res.status(201).json({
        success: true,
        message: `Đã tạo ${insertedCount} phiếu soạn từ ${donHangs.length} đơn hàng`,
        data: insertedDocs,
        errors: errors.length ? errors : null,
        summary: {
          total_orders: donHangs.length,
          processed: insertedCount,
          failed: errors.length,
          special_pack_one: specialCount,
        },
        ...(specialCount > 0 && {
          warning: `Có ${specialCount} phiếu soạn đặc thù (pack=1) cần cập nhật chẵn/lẻ`,
        }),
      });
    });
  } catch (error) {
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
      ...(store && { store }),
      ...(type && { type }),
    };

    const [data, count] = await Promise.all([
      PhieuSoan.find(filter)
        .populate("don_hang_id")
        .limit(toInt(limit))
        .skip((toInt(page) - 1) * toInt(limit))
        .sort({ ngay_ra_phieu: -1 }),
      PhieuSoan.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Danh sách phiếu soạn đặc thù (pack=1)",
      data,
      pagination: {
        totalPages: Math.ceil(count / toInt(limit)),
        currentPage: toInt(page),
        totalDocuments: count,
        limit: toInt(limit),
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
      ...(store && { store }),
      ...(type && { type }),
    };
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
  try {
    await session.withTransaction(async () => {
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "Cần cung cấp mảng updates với format: [{ phieuSoanId, chan_le }]",
        });
      }

      const results = [];
      const errors = [];
      let regeneratedCount = 0;

      // Không dùng lean vì cần gọi method & save
      for (const { phieuSoanId, chan_le } of updates) {
        try {
          if (!["Chẵn", "Lẻ"].includes(chan_le)) {
            throw new Error("chan_le phải là 'Chẵn' hoặc 'Lẻ'");
          }

          const ps = await PhieuSoan.findOne({
            _id: phieuSoanId,
            pack: 1,
            loai_hang: "Đặc thù",
          }).session(session);

          if (!ps) {
            throw new Error(
              `Không tìm thấy phiếu soạn đặc thù: ${phieuSoanId}`
            );
          }

          const changed = ps.chan_le !== chan_le;
          ps.chan_le = chan_le;
          ps.loai_hang = "Bình thường";

          if (changed && typeof ps.regeneratePhieuSoanId === "function") {
            await ps.regeneratePhieuSoanId(); // method trên Schema
            regeneratedCount++;
          } else {
            await ps.save({ session });
          }

          results.push(ps);
        } catch (e) {
          errors.push({ phieuSoanId, error: e.message || String(e) });
        }
      }

      const message =
        regeneratedCount > 0
          ? `Đã cập nhật ${results.length} phiếu soạn → Chuyển sang hàng bình thường (${regeneratedCount} phiếu regenerate mã)`
          : `Đã cập nhật ${results.length} phiếu soạn → Chuyển sang hàng bình thường`;

      return res.status(200).json({
        success: true,
        message,
        data: results,
        regeneratedCount,
        errors: errors.length ? errors : null,
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật phiếu soạn đặc thù",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// ==================== CRUD & QUERIES ====================
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
      maNCC,
      maNH,
      Dept,
      SubDept,
      tu_ngay,
      den_ngay,
      ngay,
      search,
      phieu_soan_id,
    } = req.query;

    const filter = {};

    if (phieu_soan_id) {
      filter.phieu_soan_id = { $regex: phieu_soan_id, $options: "i" };
    }

    if (search && String(search).trim()) {
      const s = String(search).trim();
      if (/^\d+$/.test(s)) {
        filter.sku = toInt(s);
      } else {
        filter.name = { $regex: s, $options: "i" };
      }
    }

    if (trang_thai !== undefined) {
      filter.trang_thai =
        trang_thai === true || trang_thai === "true" ? true : false;
    }
    if (type) filter.type = type;
    if (sku) filter.sku = toInt(sku);
    if (soda_transfer) filter.soda_transfer = toInt(soda_transfer);
    if (store) filter.store = store;
    if (chan_le) filter.chan_le = chan_le;
    if (["Bình thường", "Đặc thù"].includes(loai_hang)) {
      filter.loai_hang = loai_hang;
    }
    if (maNCC) filter.maNCC = { $regex: String(maNCC), $options: "i" };
    if (maNH) filter.maNH = { $regex: String(maNH), $options: "i" };
    if (Dept) filter.Dept = { $regex: String(Dept), $options: "i" };
    if (SubDept) filter.SubDept = { $regex: String(SubDept), $options: "i" };

    // Date filter: mặc định 3 ngày gần nhất nếu không truyền tham số thời gian
    if (tu_ngay || den_ngay || ngay) {
      filter.ngay_ra_phieu = {};
      if (ngay) {
        filter.ngay_ra_phieu.$gte = startOfDay(ngay);
        filter.ngay_ra_phieu.$lte = endOfDay(ngay);
      } else {
        if (tu_ngay) filter.ngay_ra_phieu.$gte = startOfDay(tu_ngay);
        if (den_ngay) filter.ngay_ra_phieu.$lte = endOfDay(den_ngay);
      }
    } else {
      const todayEnd = endOfDay(new Date());
      const threeDaysAgoStart = startOfDay(
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      );
      filter.ngay_ra_phieu = { $gte: threeDaysAgoStart, $lte: todayEnd };
    }

    // Chỉ populate khi cần; nếu performance căng, cân nhắc bỏ populate hoặc chọn fields
    const [data, count] = await Promise.all([
      PhieuSoan.find(filter)
        .populate("don_hang_id")
        .limit(toInt(limit))
        .skip((toInt(page) - 1) * toInt(limit))
        .sort({ ngay_ra_phieu: -1 })
        .lean(),
      PhieuSoan.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data,
      pagination: {
        totalPages: Math.ceil(count / toInt(limit)),
        currentPage: toInt(page),
        totalDocuments: count,
        limit: toInt(limit),
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
    res.status(200).json({ success: true, data: phieuSoan });
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
  try {
    await session.withTransaction(async () => {
      const { ids, updateData } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Dữ liệu phải là một mảng ID và không được rỗng",
        });
      }
      if (!updateData || typeof updateData !== "object") {
        return res.status(400).json({
          success: false,
          message: "updateData phải là object chứa dữ liệu cần cập nhật",
        });
      }

      // không cho cập nhật các field hệ thống
      delete updateData.don_hang_id;
      delete updateData.ngay_ra_phieu;
      delete updateData._id;
      delete updateData.phieu_soan_id;

      if (
        updateData.loai_hang &&
        !["Bình thường", "Đặc thù"].includes(updateData.loai_hang)
      ) {
        return res.status(400).json({
          success: false,
          message: "loai_hang phải là 'Bình thường' hoặc 'Đặc thù'",
        });
      }

      if (updateData.chan_le && !["Chẵn", "Lẻ"].includes(updateData.chan_le)) {
        return res.status(400).json({
          success: false,
          message: "chan_le phải là 'Chẵn' hoặc 'Lẻ'",
        });
      }

      if (
        updateData.trang_thai !== undefined &&
        typeof updateData.trang_thai !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message: "trang_thai phải là true hoặc false",
        });
      }

      // Nếu đổi chan_le → cần regenerate mã → phải load doc (không lean)
      const isChanLeChanged = Object.prototype.hasOwnProperty.call(
        updateData,
        "chan_le"
      );

      let matchedCount = 0;
      let modifiedCount = 0;
      let regeneratedCount = 0;

      if (isChanLeChanged) {
        const docs = await PhieuSoan.find({ _id: { $in: ids } }).session(
          session
        );
        matchedCount = docs.length;

        for (const doc of docs) {
          const before = doc.chan_le;
          Object.assign(doc, updateData);

          if (
            before !== doc.chan_le &&
            typeof doc.regeneratePhieuSoanId === "function"
          ) {
            await doc.regeneratePhieuSoanId();
            regeneratedCount++;
          } else {
            await doc.save({ session });
          }
          modifiedCount++;
        }
      } else {
        const r = await PhieuSoan.updateMany(
          { _id: { $in: ids } },
          { $set: updateData }
        ).session(session);

        matchedCount = r.matchedCount || 0;
        modifiedCount = r.modifiedCount || 0;
      }

      const message =
        regeneratedCount > 0
          ? `Đã cập nhật ${modifiedCount} phiếu soạn (${regeneratedCount} regenerate mã do đổi chẵn/lẻ)`
          : `Đã cập nhật ${modifiedCount} phiếu soạn`;

      return res.status(200).json({
        success: true,
        message,
        matchedCount,
        modifiedCount,
        regeneratedCount,
      });
    });
  } catch (error) {
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

    const phieuSoan = await PhieuSoan.findByIdAndUpdate(
      id,
      { $set: { trang_thai } },
      { new: true }
    );

    if (!phieuSoan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu soạn",
      });
    }

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
    const updateData = { ...req.body };

    delete updateData.don_hang_id;
    delete updateData.ngay_ra_phieu;

    // Nếu thay đổi pack/luong → cập nhật lại kien_hang
    if (updateData.pack !== undefined || updateData.luong !== undefined) {
      const ps = await PhieuSoan.findById(id);
      if (!ps) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy phiếu soạn",
        });
      }
      const pack = toInt(updateData.pack ?? ps.pack, 0);
      const luong = toInt(updateData.luong ?? ps.luong, 0);
      updateData.kien_hang = pack > 0 ? Math.floor(luong / pack) : 0;
    }

    if (
      updateData.loai_hang &&
      !["Bình thường", "Đặc thù"].includes(updateData.loai_hang)
    ) {
      return res.status(400).json({
        success: false,
        message: "loai_hang phải là 'Bình thường' hoặc 'Đặc thù'",
      });
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
  try {
    await session.withTransaction(async () => {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Dữ liệu phải là một mảng ID và không được rỗng",
        });
      }

      // Lấy don_hang_id để reset trạng thái; dùng lean để nhẹ
      const phieuSoans = await PhieuSoan.find(
        { _id: { $in: ids } },
        { don_hang_id: 1 }
      )
        .lean()
        .session(session);

      const donHangIds = [
        ...new Set(phieuSoans.map((ps) => String(ps.don_hang_id))),
      ];

      const result = await PhieuSoan.deleteMany({ _id: { $in: ids } }).session(
        session
      );

      if (donHangIds.length) {
        await DonHang.updateMany(
          { _id: { $in: donHangIds } },
          { $set: { trang_thai: false } }
        ).session(session);
      }

      return res.status(200).json({
        success: true,
        message: `Đã xóa ${result.deletedCount} phiếu soạn và reset ${donHangIds.length} đơn hàng`,
        deletedCount: result.deletedCount,
      });
    });
  } catch (error) {
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
    // 3 pipeline độc lập để dùng index hiệu quả; có thể gom nếu cần
    const [byStatus, total, byChanLe, byStore, byLoai] = await Promise.all([
      PhieuSoan.aggregate([
        {
          $group: {
            _id: "$trang_thai",
            count: { $sum: 1 },
            total_luong: { $sum: "$luong" },
          },
        },
      ]),
      PhieuSoan.countDocuments(),
      PhieuSoan.aggregate([
        {
          $group: {
            _id: "$chan_le",
            count: { $sum: 1 },
            total_luong: { $sum: "$luong" },
          },
        },
      ]),
      PhieuSoan.aggregate([
        {
          $group: {
            _id: "$store",
            count: { $sum: 1 },
            total_luong: { $sum: "$luong" },
          },
        },
      ]),
      PhieuSoan.aggregate([
        {
          $group: {
            _id: "$loai_hang",
            count: { $sum: 1 },
            total_luong: { $sum: "$luong" },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        by_status: byStatus,
        by_chan_le: byChanLe,
        by_store: byStore,
        by_loai_hang: byLoai,
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
