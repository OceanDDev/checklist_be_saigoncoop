const ASN = require("../../models/nhaphang/asn"); // sửa lại đường dẫn cho đúng project

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      po,
      ngay_asn,
      so_booking,
      ma_ncc,
      ten_ncc,
      so_luong_sku,
      so_kien,
      loai_hinh,
      ten_nganh_hang,
      kho,
      ngay_import,
    } = req.body;

    const newItem = new ASN({
      po,
      ngay_asn,
      so_booking,
      ma_ncc,
      ten_ncc,
      so_luong_sku,
      so_kien,
      loai_hinh,
      ten_nganh_hang,
      kho,
      ngay_import,
    });
    const saved = await newItem.save();

    return res.status(201).json({ message: "Tạo thành công", data: saved });
  } catch (error) {
    console.error("Lỗi create ASN:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi tạo", error: error.message });
  }
};

// ─────────────────────────────────────────────
// IMPORT MANY (chỉ insert, giữ đủ mọi dòng kể cả thiếu field)
// Body: { items: [ { so_booking, po, ... }, ... ] }
// ─────────────────────────────────────────────
exports.importMany = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách items không hợp lệ hoặc rỗng" });
    }

    const validItems = items.filter((item) => item && typeof item === "object");
    const invalidCount = items.length - validItems.length;

    if (validItems.length === 0) {
      return res
        .status(400)
        .json({ message: "Không có bản ghi hợp lệ để import" });
    }

    const result = await ASN.insertMany(validItems, { ordered: false });

    return res.status(201).json({
      message: "Import thành công",
      insertedCount: result.length,
      skippedInvalid: invalidCount,
      data: result,
    });
  } catch (error) {
    // insertMany với ordered:false vẫn insert các bản ghi hợp lệ, lỗi trùng key sẽ nằm trong writeErrors
    if (error.writeErrors) {
      const insertedCount =
        error.result?.result?.nInserted ?? error.insertedDocs?.length ?? 0;
      const failedItems = error.writeErrors.map((e) => ({
        index: e.index,
        message: e.errmsg || e.err?.errmsg,
      }));

      return res.status(207).json({
        message: "Import hoàn tất một phần (có bản ghi bị lỗi/trùng)",
        insertedCount,
        insertedDocs: error.insertedDocs || [],
        failedItems,
      });
    }

    console.error("Lỗi importMany ASN:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi import", error: error.message });
  }
};

// ─────────────────────────────────────────────
// IMPORT + CẬP NHẬT
//
// Dữ liệu phải lấy ĐỦ — không bỏ qua bản ghi nào, kể cả thiếu field.
//
// Khóa để coi 1 dòng là "trùng" (và cập nhật lại): phải khớp ĐỦ CẢ 3
// field ten_ncc + po + so_booking (+ cùng kho, để không lẫn dữ liệu
// giữa các kho khi import nhiều kho một lượt). Thiếu 1 trong 3 field đó
// -> không đủ điều kiện để match, luôn tạo bản ghi mới (insert), tránh
// gộp nhầm các dòng không thật sự trùng nhau.
//
// Body: { items: [ { ten_ncc, po, so_booking, ... }, ... ] }
// ─────────────────────────────────────────────
exports.importUpdate = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách items không hợp lệ hoặc rỗng" });
    }

    // Có đủ cả 3 field định danh (khác rỗng/null) thì mới match để update,
    // ngược lại luôn insert mới -> không đánh rớt dữ liệu.
    const hasFullKey = (item) =>
      !!(
        item &&
        item.ten_ncc &&
        item.po !== undefined &&
        item.po !== null &&
        item.po !== "" &&
        item.so_booking
      );

    const operations = items.map((item) =>
      hasFullKey(item)
        ? {
            updateOne: {
              filter: {
                ten_ncc: item.ten_ncc,
                po: item.po,
                so_booking: item.so_booking,
                kho: item.kho,
              },
              update: { $set: item },
              upsert: true,
            },
          }
        : { insertOne: { document: item } },
    );

    const result = await ASN.bulkWrite(operations, { ordered: false });

    return res.status(200).json({
      message: "Import & cập nhật thành công",
      insertedCount: result.insertedCount,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
    });
  } catch (error) {
    console.error("Lỗi importUpdate ASN:", error);
    return res.status(500).json({
      message: "Lỗi server khi import & cập nhật",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET ALL (phân trang + search theo so_booking/po/ten_ncc)
// ─────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      so_booking,
      po,
      ten_ncc,
      kho,
      loai_hinh,
      ngay_asn_from,
      ngay_asn_to,
      ngay_import_from,
      ngay_import_to,
    } = req.query;

    const query = {};
    if (so_booking) query.so_booking = { $regex: so_booking, $options: "i" };
    if (po) query.po = { $regex: po, $options: "i" };
    if (ten_ncc) query.ten_ncc = { $regex: ten_ncc, $options: "i" };
    if (kho) query.kho = { $regex: kho, $options: "i" };
    if (loai_hinh) query.loai_hinh = loai_hinh;

    // Lọc theo khoảng ngày ASN — nhận "YYYY-MM-DD" từ input type=date,
    // quy đổi về mốc đầu ngày / cuối ngày theo UTC để không lệch timezone
    if (ngay_asn_from || ngay_asn_to) {
      query.ngay_asn = {};
      if (ngay_asn_from) {
        const [y, m, d] = ngay_asn_from.split("-").map(Number);
        query.ngay_asn.$gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      }
      if (ngay_asn_to) {
        const [y, m, d] = ngay_asn_to.split("-").map(Number);
        query.ngay_asn.$lte = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      }
    }

    // Lọc theo khoảng ngày import — cùng cách quy đổi như ngày ASN
    if (ngay_import_from || ngay_import_to) {
      query.ngay_import = {};
      if (ngay_import_from) {
        const [y, m, d] = ngay_import_from.split("-").map(Number);
        query.ngay_import.$gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      }
      if (ngay_import_to) {
        const [y, m, d] = ngay_import_to.split("-").map(Number);
        query.ngay_import.$lte = new Date(
          Date.UTC(y, m - 1, d, 23, 59, 59, 999),
        );
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      ASN.find(query).sort({ _id: -1 }).skip(skip).limit(Number(limit)),
      ASN.countDocuments(query),
    ]);

    return res.status(200).json({
      data,
      total,
      page: Number(page),
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    });
  } catch (error) {
    console.error("Lỗi getAll ASN:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi lấy danh sách", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET ONE (theo id)
// ─────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await ASN.findById(id);

    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    }

    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("Lỗi getOne ASN:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi lấy chi tiết", error: error.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE (theo id)
// ─────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await ASN.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản ghi để cập nhật" });
    }

    return res
      .status(200)
      .json({ message: "Cập nhật thành công", data: updated });
  } catch (error) {
    console.error("Lỗi update ASN:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi cập nhật", error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE (theo id)
// ─────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ASN.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi để xóa" });
    }

    return res.status(200).json({ message: "Xóa thành công", data: deleted });
  } catch (error) {
    console.error("Lỗi remove ASN:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi xóa", error: error.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE MANY (cập nhật nhiều bản ghi theo danh sách id)
// Body: { ids: [id1, id2, ...], updateData: { field: value, ... } }
// ─────────────────────────────────────────────
exports.updateMany = async (req, res) => {
  try {
    const { ids, updateData } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách ids không hợp lệ hoặc rỗng" });
    }
    if (
      !updateData ||
      typeof updateData !== "object" ||
      Array.isArray(updateData)
    ) {
      return res.status(400).json({ message: "updateData không hợp lệ" });
    }

    const result = await ASN.updateMany(
      { _id: { $in: ids } },
      { $set: updateData },
      { runValidators: true },
    );

    return res.status(200).json({
      message: "Cập nhật hàng loạt thành công",
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Lỗi updateMany ASN:", error);
    return res.status(500).json({
      message: "Lỗi server khi cập nhật hàng loạt",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// DELETE MANY (xóa nhiều bản ghi theo danh sách id)
// Body: { ids: [id1, id2, ...] }
// ─────────────────────────────────────────────
exports.deleteMany = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách ids không hợp lệ hoặc rỗng" });
    }

    const result = await ASN.deleteMany({ _id: { $in: ids } });

    return res.status(200).json({
      message: "Xóa hàng loạt thành công",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Lỗi deleteMany ASN:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi xóa hàng loạt", error: error.message });
  }
};
