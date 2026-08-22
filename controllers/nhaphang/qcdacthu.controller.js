const QcDacThu = require("../../models/nhaphang/qcdacthu");

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { sku, name, quy_cach } = req.body;

    const newItem = new QcDacThu({ sku, name, quy_cach });
    const saved = await newItem.save();

    return res.status(201).json({ message: "Tạo thành công", data: saved });
  } catch (error) {
    console.error("Lỗi create QcDacThu:", error);
    return res.status(500).json({ message: "Lỗi server khi tạo", error: error.message });
  }
};

// ─────────────────────────────────────────────
// IMPORT MANY (nhập nhiều bản ghi cùng lúc)
// Body: { items: [ { sku, name, quy_cach }, ... ] }
// ─────────────────────────────────────────────
exports.importMany = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Danh sách items không hợp lệ hoặc rỗng" });
    }

    // Lọc bỏ những dòng thiếu sku (tránh lỗi validate hàng loạt)
    const validItems = items.filter((item) => item && item.sku);
    const invalidCount = items.length - validItems.length;

    if (validItems.length === 0) {
      return res.status(400).json({ message: "Không có bản ghi hợp lệ để import (thiếu sku)" });
    }

    const result = await QcDacThu.insertMany(validItems, { ordered: false });

    return res.status(201).json({
      message: "Import thành công",
      insertedCount: result.length,
      skippedInvalid: invalidCount,
      data: result,
    });
  } catch (error) {
    // insertMany với ordered:false vẫn insert các bản ghi hợp lệ, lỗi trùng key sẽ nằm trong writeErrors
    if (error.writeErrors) {
      const insertedCount = error.result?.result?.nInserted ?? error.insertedDocs?.length ?? 0;
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

    console.error("Lỗi importMany QcDacThu:", error);
    return res.status(500).json({ message: "Lỗi server khi import", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET ALL (phân trang + search theo sku/name)
// ─────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, sku, name } = req.query;

    const query = {};
    if (sku) query.sku = { $regex: sku, $options: "i" };
    if (name) query.name = { $regex: name, $options: "i" };

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      QcDacThu.find(query).sort({ _id: -1 }).skip(skip).limit(Number(limit)),
      QcDacThu.countDocuments(query),
    ]);

    return res.status(200).json({
      data,
      total,
      page: Number(page),
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    });
  } catch (error) {
    console.error("Lỗi getAll QcDacThu:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET ONE (theo id)
// ─────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await QcDacThu.findById(id);

    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    }

    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("Lỗi getOne QcDacThu:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy chi tiết", error: error.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE (theo id)
// ─────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await QcDacThu.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi để cập nhật" });
    }

    return res.status(200).json({ message: "Cập nhật thành công", data: updated });
  } catch (error) {
    console.error("Lỗi update QcDacThu:", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật", error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE (theo id)
// ─────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await QcDacThu.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi để xóa" });
    }

    return res.status(200).json({ message: "Xóa thành công", data: deleted });
  } catch (error) {
    console.error("Lỗi remove QcDacThu:", error);
    return res.status(500).json({ message: "Lỗi server khi xóa", error: error.message });
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
      return res.status(400).json({ message: "Danh sách ids không hợp lệ hoặc rỗng" });
    }
    if (!updateData || typeof updateData !== "object" || Array.isArray(updateData)) {
      return res.status(400).json({ message: "updateData không hợp lệ" });
    }

    const result = await QcDacThu.updateMany(
      { _id: { $in: ids } },
      { $set: updateData },
      { runValidators: true }
    );

    return res.status(200).json({
      message: "Cập nhật hàng loạt thành công",
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Lỗi updateMany QcDacThu:", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật hàng loạt", error: error.message });
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
      return res.status(400).json({ message: "Danh sách ids không hợp lệ hoặc rỗng" });
    }

    const result = await QcDacThu.deleteMany({ _id: { $in: ids } });

    return res.status(200).json({
      message: "Xóa hàng loạt thành công",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Lỗi deleteMany QcDacThu:", error);
    return res.status(500).json({ message: "Lỗi server khi xóa hàng loạt", error: error.message });
  }
};