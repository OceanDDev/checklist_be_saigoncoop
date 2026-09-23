const NhapHang = require("../../models/nhaphang/nhaphang");

exports.create = async (req, res) => {
  try {
    const {
      sku,
      name,
      vi_tri,
      kien,
      kho,
      tong_sl,
      lpn,
      trang_thai,
      loai_hinh,
      so_phieu_nhap,
      loai_hinh_nhap,
      so_po,
      nhan_vien_nhap,
      nhan_vien_put,
      nhan_vien_let,
      ngay_nhap_kho,
      ngay_nhan_let,
      ngay_gio_tao_let,
      ngay_gio_hoan_thanh,
      ngay_san_xuat,
      ngay_het_han,
    } = req.body; // req.body, không phải req.query

    const newItem = new NhapHang({
      sku,
      name,
      vi_tri,
      kien,
      kho,
      tong_sl,
      lpn,
      trang_thai,
      loai_hinh,
      so_phieu_nhap,
      loai_hinh_nhap,
      so_po,
      nhan_vien_nhap,
      nhan_vien_put,
      nhan_vien_let,
      ngay_nhap_kho,
      ngay_nhan_let,
      ngay_gio_tao_let,
      ngay_gio_hoan_thanh,
      ngay_san_xuat, // THÊM
      ngay_het_han, // THÊM
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
      lpn,
      trang_thai,
      loai_hinh,
      so_phieu_nhap,
      loai_hinh_nhap,
      so_po,
      nhan_vien_nhap,
      nhan_vien_put,
      nhan_vien_let,
      ngay_nhap_kho,
      ngay_nhan_let,
      ngay_nhan_let_from,
      ngay_nhan_let_to,
      ngay_gio_tao_let,
      ngay_gio_tao_let_from,
      ngay_gio_tao_let_to,
      ngay_gio_hoan_thanh,
      ngay_gio_hoan_thanh_from,
      ngay_gio_hoan_thanh_to,
      ngay_import,
      ngay_import_from,
      ngay_import_to,
    } = req.query;

    const query = {};

    // Text field -> regex, không phân biệt hoa thường, tìm gần đúng
    const textFilter = (field, value) => {
      if (value) query[field] = { $regex: value, $options: "i" };
    };
    textFilter("sku", sku);
    textFilter("name", name);
    textFilter("vi_tri", vi_tri);
    textFilter("lpn", lpn);
    textFilter("trang_thai", trang_thai);
    textFilter("loai_hinh", loai_hinh);
    textFilter("nhan_vien_nhap", nhan_vien_nhap);
    textFilter("nhan_vien_put", nhan_vien_put);
    textFilter("nhan_vien_let", nhan_vien_let);
    textFilter("so_phieu_nhap", so_phieu_nhap);
    textFilter("loai_hinh_nhap", loai_hinh_nhap);
    textFilter("so_po", so_po);

    // Số -> match chính xác (nếu value không phải số hợp lệ thì bỏ qua)
    const numberFilter = (field, value) => {
      if (value !== undefined && value !== "" && !isNaN(Number(value))) {
        query[field] = Number(value);
      }
    };
    numberFilter("kien", kien);
    numberFilter("kho", kho);
    numberFilter("tong_sl", tong_sl);

    // Parse "dd/mm/yyyy" hoặc ISO -> Date (chỉ lấy phần ngày, bỏ giờ)
    const parseDateOnly = (value) => {
      if (!value) return null;
      let date;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        const [d, m, y] = value.split("/");
        date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
      } else {
        date = new Date(value);
      }
      return isNaN(date.getTime()) ? null : date;
    };

    // Ngày -> match nguyên ngày đó (00:00 -> 23:59 UTC), dùng cho filter 1 ngày
    const dateFilter = (field, value) => {
      const date = parseDateOnly(value);
      if (!date) return;
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

    // Ngày -> lọc theo khoảng (Từ ngày - Đến ngày), chỉ quan tâm ngày,
    // bỏ qua giờ (Từ ngày lấy từ 00:00 UTC, Đến ngày lấy tới 23:59:59 UTC).
    // 1 trong 2 mốc có thể bỏ trống (chỉ lọc 1 chiều).
    const dateRangeFilter = (field, fromValue, toValue) => {
      const range = {};
      const fromDate = parseDateOnly(fromValue);
      if (fromDate) {
        range.$gte = new Date(
          Date.UTC(
            fromDate.getUTCFullYear(),
            fromDate.getUTCMonth(),
            fromDate.getUTCDate(),
            0,
            0,
            0,
          ),
        );
      }
      const toDate = parseDateOnly(toValue);
      if (toDate) {
        range.$lte = new Date(
          Date.UTC(
            toDate.getUTCFullYear(),
            toDate.getUTCMonth(),
            toDate.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        );
      }
      if (Object.keys(range).length > 0) query[field] = range;
    };

    dateFilter("ngay_nhap_kho", ngay_nhap_kho);

    // 4 cột ngày giờ dùng filter khoảng (Từ ngày/Đến ngày). Nếu FE lỡ gửi
    // giá trị đơn (không có _from/_to) thì vẫn fallback về match 1 ngày
    // như cũ để tương thích ngược.
    if (ngay_nhan_let_from || ngay_nhan_let_to) {
      dateRangeFilter("ngay_nhan_let", ngay_nhan_let_from, ngay_nhan_let_to);
    } else {
      dateFilter("ngay_nhan_let", ngay_nhan_let);
    }
    if (ngay_gio_tao_let_from || ngay_gio_tao_let_to) {
      dateRangeFilter(
        "ngay_gio_tao_let",
        ngay_gio_tao_let_from,
        ngay_gio_tao_let_to,
      );
    } else {
      dateFilter("ngay_gio_tao_let", ngay_gio_tao_let);
    }
    if (ngay_gio_hoan_thanh_from || ngay_gio_hoan_thanh_to) {
      dateRangeFilter(
        "ngay_gio_hoan_thanh",
        ngay_gio_hoan_thanh_from,
        ngay_gio_hoan_thanh_to,
      );
    } else {
      dateFilter("ngay_gio_hoan_thanh", ngay_gio_hoan_thanh);
    }
    if (ngay_import_from || ngay_import_to) {
      dateRangeFilter("ngay_import", ngay_import_from, ngay_import_to);
    } else {
      dateFilter("ngay_import", ngay_import);
    }

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
//
// - Dòng KHÔNG có LPN -> KHÔNG cho import (bỏ qua hẳn, không insert cũng
//   không upsert). LPN là định danh bắt buộc của 1 dòng nhập.
// - Không còn coi "trùng LPN" là trùng dòng. 1 LPN có thể nằm ở nhiều
//   "dãy"/vị trí khác nhau trong cùng phiếu nhập (ví dụ 1 LPN chia ra
//   DV0089, DV0086, DV0087...) -> mỗi vị trí đó PHẢI là 1 bản ghi riêng,
//   không được gộp/ghi đè lẫn nhau.
//
// Khóa để xác định "đây là cùng 1 dòng hay là dòng mới" (khớp với unique
// index bên model) là tổ hợp: lpn + loai_hinh + vi_tri + sku + kho
// -> Đúng khớp CẢ tổ hợp trên (đã tồn tại y hệt dòng đó) => UPDATE lại
//    (đè các field còn lại như kiện, tổng SL, trạng thái... theo file mới).
// -> Khác đi dù chỉ 1 phần (khác vị trí, khác SKU, khác kho...) => dòng
//    mới => INSERT thêm, không đụng tới bản ghi cũ.
// ─────────────────────────────────────────────
exports.importMany = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách items không hợp lệ hoặc rỗng" });
    }

    // Dòng thiếu LPN -> loại bỏ ngay từ đầu, không import
    const rejectedNoLpnCount = items.filter(
      (item) => !item.lpn || String(item.lpn).trim() === "",
    ).length;
    const validItems = items.filter(
      (item) => item.lpn && String(item.lpn).trim() !== "",
    );

    if (validItems.length === 0) {
      return res.status(400).json({
        message: "Tất cả dòng đều thiếu LPN, không có dòng nào để import",
        rejectedNoLpnCount,
      });
    }

    const now = new Date();
  const docs = validItems.map((item) => ({
  sku: item.sku,
  name: item.name,
  vi_tri: item.vi_tri,
  kien: Number(item.kien),
  kho: Number(item.kho),
  tong_sl:
    item.tong_sl !== undefined && item.tong_sl !== ""
      ? Number(item.tong_sl)
      : undefined,
  lpn: item.lpn,
  trang_thai: item.trang_thai || "Chưa xử lý",
  loai_hinh: item.loai_hinh || "Nhập",
  so_phieu_nhap: item.so_phieu_nhap || undefined,
  loai_hinh_nhap: item.loai_hinh_nhap || undefined,
  so_po: item.so_po || undefined,
  nhan_vien_nhap: item.nhan_vien_nhap || undefined,
  nhan_vien_put: item.nhan_vien_put || undefined,
  nhan_vien_let: item.nhan_vien_let || undefined,
  ngay_nhap_kho: item.ngay_nhap_kho ? new Date(item.ngay_nhap_kho) : undefined,
  ngay_san_xuat: item.ngay_san_xuat ? new Date(item.ngay_san_xuat) : undefined,   // THÊM
  ngay_het_han: item.ngay_het_han ? new Date(item.ngay_het_han) : undefined,       // THÊM
  ngay_nhan_let: item.ngay_nhan_let ? new Date(item.ngay_nhan_let) : undefined,
  ngay_gio_tao_let: item.ngay_gio_tao_let ? new Date(item.ngay_gio_tao_let) : undefined,
  ngay_gio_hoan_thanh: item.ngay_gio_hoan_thanh ? new Date(item.ngay_gio_hoan_thanh) : undefined,
  ngay_import: now,
}));

    // "Let" -> 1 LPN có thể được châm hàng nhiều lần -> KHÔNG upsert,
    // luôn insert như bản ghi mới (kể cả trùng y hệt tổ hợp khóa với 1 bản
    // ghi Let khác).
    // "Nhập"/"Put" -> upsert theo tổ hợp khóa bên dưới.
    const letItems = docs.filter((d) => d.loai_hinh === "Let");
    const nonLetItems = docs.filter((d) => d.loai_hinh !== "Let");

    let insertedCount = 0;
    let upsertedCount = 0;
    let modifiedCount = 0;
    const writeErrors = [];

    // Let -> insert thẳng, không match/upsert
    if (letItems.length > 0) {
      try {
        const inserted = await NhapHang.insertMany(letItems, {
          ordered: false,
        });
        insertedCount += inserted.length;
      } catch (err) {
        if (err.writeErrors) {
          insertedCount += err.result?.result?.nInserted || 0;
          writeErrors.push(
            ...err.writeErrors.map((e) => ({
              index: e.index,
              message: e.errmsg,
            })),
          );
        } else {
          throw err;
        }
      }
    }

    // Nhập/Put -> khớp đủ 10 field khóa => chỉ update Kiện/Tổng SL/Trạng thái
    // (+ ngay_import). Khác 1 field bất kỳ trong khóa => insert dòng mới với
    // đầy đủ dữ liệu (qua $setOnInsert).
    if (nonLetItems.length > 0) {
      const bulkOps = nonLetItems.map((doc) => {
        const { kien, tong_sl, trang_thai, ngay_import, ...restFields } = doc;
        return {
          updateOne: {
            filter: {
              lpn: doc.lpn,
              kho: doc.kho,
              sku: doc.sku,
              name: doc.name,
              so_phieu_nhap: doc.so_phieu_nhap,
              vi_tri: doc.vi_tri,
              loai_hinh_nhap: doc.loai_hinh_nhap,
              so_po: doc.so_po,
              ngay_san_xuat: doc.ngay_san_xuat,
              ngay_het_han: doc.ngay_het_han,
            },
            update: {
              $set: { kien, tong_sl, trang_thai, ngay_import },
              $setOnInsert: restFields,
            },
            upsert: true,
          },
        };
      });

      const bulkResult = await NhapHang.bulkWrite(bulkOps, { ordered: false });
      upsertedCount += bulkResult.upsertedCount || 0;
      modifiedCount += bulkResult.modifiedCount || 0;
    }

    return res.status(201).json({
      message: `Import xong: ${insertedCount} dòng mới (Let), ${upsertedCount} dòng mới (Nhập/Put), ${modifiedCount} dòng đã cập nhật lại${
        rejectedNoLpnCount
          ? `, ${rejectedNoLpnCount} dòng bị bỏ qua do thiếu LPN`
          : ""
      }`,
      insertedCount,
      upsertedCount,
      modifiedCount,
      rejectedNoLpnCount,
      writeErrors: writeErrors.length ? writeErrors : undefined,
    });
  } catch (error) {
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
