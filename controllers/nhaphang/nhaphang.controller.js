const NhapHang = require("../../models/nhaphang/nhaphang");

// ─────────────────────────────────────────────
// CREATE (tạo 1 bản ghi)
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      sku,
      name,
      vi_tri,
      kien,
      kho,
      tong_sl,
      trang_thai,
      loai_hinh,
      ngay_nhap_kho,
      ngay_let,
    } = req.body;

    const newItem = new NhapHang({
      sku,
      name,
      vi_tri,
      kien,
      kho,
      tong_sl,
      trang_thai,
      loai_hinh,
      ngay_nhap_kho,
      ngay_let,
      ngay_import: new Date(),
    });

    const saved = await newItem.save();
    return res.status(201).json({ message: "Tạo thành công", data: saved });
  } catch (error) {
    console.error("Lỗi create NhapHang:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi tạo", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET ALL (phân trang + search theo từng field)
// ─────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sku,
      name,
      vi_tri,
      kien,
      kho,
      tong_sl,
      trang_thai,
      loai_hinh,
      ngay_nhap_kho,
      ngay_let,
      ngay_import,
    } = req.query;

    const query = {};

    // Text field -> regex, không phân biệt hoa thường, tìm gần đúng
    const textFilter = (field, value) => {
      if (value) query[field] = { $regex: value, $options: "i" };
    };
    textFilter("sku", sku);
    textFilter("name", name);
    textFilter("vi_tri", vi_tri);
    textFilter("trang_thai", trang_thai);
    textFilter("loai_hinh", loai_hinh);

    // Số -> match chính xác (nếu value không phải số hợp lệ thì bỏ qua)
    const numberFilter = (field, value) => {
      if (value !== undefined && value !== "" && !isNaN(Number(value))) {
        query[field] = Number(value);
      }
    };
    numberFilter("kien", kien);
    numberFilter("kho", kho);
    numberFilter("tong_sl", tong_sl);

    // Ngày -> nhận "dd/mm/yyyy" hoặc ISO, match nguyên ngày đó (00:00 -> 23:59 UTC)
    const dateFilter = (field, value) => {
      if (!value) return;
      let date;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        const [d, m, y] = value.split("/");
        date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
      } else {
        date = new Date(value);
      }
      if (isNaN(date.getTime())) return;
      const start = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          0,
          0,
          0,
        ),
      );
      const end = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      );
      query[field] = { $gte: start, $lte: end };
    };
    dateFilter("ngay_nhap_kho", ngay_nhap_kho);
    dateFilter("ngay_let", ngay_let);
    dateFilter("ngay_import", ngay_import);

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      NhapHang.find(query)
        .sort({ ngay_import: -1 })
        .skip(skip)
        .limit(Number(limit)),
      NhapHang.countDocuments(query),
    ]);

    return res.status(200).json({
      data,
      total,
      page: Number(page),
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    });
  } catch (error) {
    console.error("Lỗi getAll NhapHang:", error);
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
    const item = await NhapHang.findById(id);

    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    }

    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("Lỗi getOne NhapHang:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi lấy chi tiết", error: error.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE (theo id, 1 bản ghi)
// ─────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await NhapHang.findByIdAndUpdate(id, updateData, {
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
    console.error("Lỗi update NhapHang:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi cập nhật", error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE (theo id, 1 bản ghi)
// ─────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await NhapHang.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi để xóa" });
    }

    return res.status(200).json({ message: "Xóa thành công", data: deleted });
  } catch (error) {
    console.error("Lỗi remove NhapHang:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi xóa", error: error.message });
  }
};

// ─────────────────────────────────────────────
// IMPORT MANY (tạo mới hàng loạt, dùng cho import Excel — cả Nhập & Let)
// ─────────────────────────────────────────────
exports.importMany = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách items không hợp lệ hoặc rỗng" });
    }

    const now = new Date();
    const docs = items.map((item) => ({
      sku: item.sku,
      name: item.name,
      vi_tri: item.vi_tri,
      kien: Number(item.kien),
      kho: Number(item.kho),
      // "Let" không có cột Tổng SL -> để undefined, schema default sẽ tự set 0
      tong_sl:
        item.tong_sl !== undefined && item.tong_sl !== ""
          ? Number(item.tong_sl)
          : undefined,
      trang_thai: item.trang_thai || "Chưa xử lý",
      loai_hinh: item.loai_hinh || "Nhập",
      ngay_nhap_kho: item.ngay_nhap_kho
        ? new Date(item.ngay_nhap_kho)
        : undefined,
      ngay_let: item.ngay_let ? new Date(item.ngay_let) : undefined,
      ngay_import: now,
    }));

    const result = await NhapHang.insertMany(docs, { ordered: false });

    return res.status(201).json({
      message: `Import thành công ${result.length}/${items.length} dòng`,
      inserted: result.length,
      data: result,
    });
  } catch (error) {
    if (error.writeErrors) {
      return res.status(207).json({
        message: "Import một phần thành công, có lỗi ở một số dòng",
        insertedCount: error.result?.result?.nInserted || 0,
        errors: error.writeErrors.map((e) => ({
          index: e.index,
          message: e.errmsg,
        })),
      });
    }
    console.error("Lỗi importMany NhapHang:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi import", error: error.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE MANY
// ─────────────────────────────────────────────
exports.updateMany = async (req, res) => {
  try {
    const { ids, sku_list, filter, update } = req.body;

    if (
      !update ||
      typeof update !== "object" ||
      Object.keys(update).length === 0
    ) {
      return res.status(400).json({ message: "Thiếu dữ liệu update" });
    }

    let query = {};

    if (Array.isArray(ids) && ids.length > 0) {
      query._id = { $in: ids };
    } else if (Array.isArray(sku_list) && sku_list.length > 0) {
      query.sku = { $in: sku_list };
    } else if (filter && typeof filter === "object") {
      query = filter;
    } else {
      return res
        .status(400)
        .json({ message: "Cần cung cấp ids, sku_list hoặc filter" });
    }

    const result = await NhapHang.updateMany(
      query,
      { $set: update },
      { runValidators: true },
    );

    return res.status(200).json({
      message: `Đã cập nhật ${result.modifiedCount} bản ghi`,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    console.error("Lỗi updateMany NhapHang:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi update", error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE MANY
// ─────────────────────────────────────────────
exports.deleteMany = async (req, res) => {
  try {
    const { ids, sku_list, filter } = req.body;

    let query = {};

    if (Array.isArray(ids) && ids.length > 0) {
      query._id = { $in: ids };
    } else if (Array.isArray(sku_list) && sku_list.length > 0) {
      query.sku = { $in: sku_list };
    } else if (
      filter &&
      typeof filter === "object" &&
      Object.keys(filter).length > 0
    ) {
      query = filter;
    } else {
      return res
        .status(400)
        .json({ message: "Cần cung cấp ids, sku_list hoặc filter" });
    }

    const result = await NhapHang.deleteMany(query);

    return res.status(200).json({
      message: `Đã xóa ${result.deletedCount} bản ghi`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Lỗi deleteMany NhapHang:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi xóa", error: error.message });
  }
};
