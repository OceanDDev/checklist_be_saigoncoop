const XuatHang = require("../../models/xuathang/xuathang"); // sửa lại đường dẫn cho đúng

// ============ CRUD cơ bản ============

// Lấy danh sách (có phân trang + filter cơ bản)
exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      ma_kho,
      ma_booking,
      ma_ldd,
      ma_ch,
      ma_nvc,
      so_bb,
      ten_nvc,
      ten_ch,
      nhan_vien_xuat_hang,
      nhan_vien_xuat_phu,
      loai_hinh_van_chuyen,
      concept,
      so_kien,
      tu_ngay,
      den_ngay,
      thoi_gian_luu_kho, // 'gt90' | 'lt90' | 'lt60' | 'lt30' | 'lt15' (đơn vị: phút)
    } = req.query;

    const filter = {};

    // Các field text -> tìm gần đúng, không phân biệt hoa thường
    const TEXT_FIELDS = {
      ma_kho,
      ma_booking,
      ma_ldd,
      ma_ch,
      ma_nvc,
      so_bb,
      ten_nvc,
      ten_ch,
      nhan_vien_xuat_hang,
      nhan_vien_xuat_phu,
      loai_hinh_van_chuyen,
      concept,
    };
    Object.entries(TEXT_FIELDS).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        filter[key] = { $regex: String(value).trim(), $options: "i" };
      }
    });

    // so_kien: lọc đúng bằng số
    if (so_kien !== undefined && so_kien !== "" && !isNaN(Number(so_kien))) {
      filter.so_kien = Number(so_kien);
    }

    // Lọc theo khoảng ngày xe vào TTPP (nếu có dùng tới)
    if (tu_ngay || den_ngay) {
      filter.ngay_xe_vao_ttpp = filter.ngay_xe_vao_ttpp || {};
      if (tu_ngay) filter.ngay_xe_vao_ttpp.$gte = new Date(tu_ngay);
      if (den_ngay) filter.ngay_xe_vao_ttpp.$lte = new Date(den_ngay);
    }

    // Thời gian lưu kho (PHÚT) = thoi_gian_roi_kho_cuoi - ngay_xe_vao_ttpp
    // Tính bằng $expr ngay trong query để phân trang/đếm tổng vẫn đúng.
    if (thoi_gian_luu_kho) {
      const MINUTE_MS = 60 * 1000;
      const diffExpr = {
        $subtract: ["$thoi_gian_roi_kho_cuoi", "$ngay_xe_vao_ttpp"],
      };
      const bothExist = {
        $and: [
          { $ne: ["$thoi_gian_roi_kho_cuoi", null] },
          { $ne: ["$ngay_xe_vao_ttpp", null] },
        ],
      };

      let cmp = null;
      switch (thoi_gian_luu_kho) {
        case "gt90":
          cmp = { $gt: [diffExpr, 90 * MINUTE_MS] };
          break;
        case "lt90":
          cmp = { $lt: [diffExpr, 90 * MINUTE_MS] };
          break;
        case "lt60":
          cmp = { $lt: [diffExpr, 60 * MINUTE_MS] };
          break;
        case "lt30":
          cmp = { $lt: [diffExpr, 30 * MINUTE_MS] };
          break;
        case "lt15":
          cmp = { $lt: [diffExpr, 15 * MINUTE_MS] };
          break;
      }

      if (cmp) filter.$expr = { $and: [bothExist, cmp] };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      XuatHang.find(filter)
        .sort({ ngay_xe_vao_ttpp: -1 })
        .skip(skip)
        .limit(Number(limit)),
      XuatHang.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy 1 bản ghi theo id
exports.getById = async (req, res) => {
  try {
    const item = await XuatHang.findById(req.params.id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bản ghi" });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tạo mới 1 bản ghi
exports.create = async (req, res) => {
  try {
    const item = new XuatHang(req.body);
    await item.save();
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Cập nhật 1 bản ghi
exports.update = async (req, res) => {
  try {
    const item = await XuatHang.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bản ghi" });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Xóa 1 bản ghi
exports.remove = async (req, res) => {
  try {
    const item = await XuatHang.findByIdAndDelete(req.params.id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bản ghi" });
    }
    res.json({ success: true, message: "Đã xóa" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ IMPORT NHIỀU / UPSERT THEO so_bb ============

// Các field ngày cần convert
const DATE_FIELDS = [
  "ngay_xe_vao_ttpp",
  "ngay_ttpp_yeu_cau_vao",
  "thoi_gian_roi_kho_cuoi",
  "ngay_bat_dau_len_hang",
  "ngay_ket_thuc_len_hang",
  "ngay_import",
];

const NUMBER_FIELDS = ["so_kien"];

function normalizeRow(row) {
  const cleaned = { ...row };

  DATE_FIELDS.forEach((field) => {
    if (
      cleaned[field] !== undefined &&
      cleaned[field] !== null &&
      cleaned[field] !== ""
    ) {
      const d = new Date(cleaned[field]);
      cleaned[field] = isNaN(d.getTime()) ? undefined : d;
    } else {
      delete cleaned[field];
    }
  });

  NUMBER_FIELDS.forEach((field) => {
    if (
      cleaned[field] !== undefined &&
      cleaned[field] !== null &&
      cleaned[field] !== ""
    ) {
      const n = Number(cleaned[field]);
      cleaned[field] = isNaN(n) ? undefined : n;
    } else {
      delete cleaned[field];
    }
  });

  // Trim string fields
  Object.keys(cleaned).forEach((key) => {
    if (typeof cleaned[key] === "string") {
      cleaned[key] = cleaned[key].trim();
    }
  });

  return cleaned;
}

// POST /xuat-hang/import-many
// Body: { data: [ {...}, {...}, ... ] }
// Trùng so_bb => update, không trùng => insert mới
exports.importMany = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu import phải là mảng và không được rỗng",
      });
    }

    const errors = [];
    const operations = [];

    data.forEach((row, index) => {
      if (!row.so_bb) {
        errors.push({ index, row, error: "Thiếu so_bb, bỏ qua dòng này" });
        return;
      }

      const cleaned = normalizeRow(row);

      operations.push({
        updateOne: {
          filter: { so_bb: cleaned.so_bb },
          update: { $set: cleaned },
          upsert: true,
        },
      });
    });

    if (operations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có dòng hợp lệ để import",
        errors,
      });
    }

    const result = await XuatHang.bulkWrite(operations, { ordered: false });

    res.json({
      success: true,
      message: "Import hoàn tất",
      summary: {
        tong_so_dong_gui_len: data.length,
        so_dong_hop_le: operations.length,
        so_dong_loi: errors.length,
        insertedCount: result.insertedCount,
        upsertedCount: result.upsertedCount,
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
