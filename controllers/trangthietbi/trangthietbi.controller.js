const ExcelJS = require("exceljs");
const TrangThietBi = require("../../models/trangthietbi/trangthietbi"); // chỉnh lại path cho đúng vị trí model của bạn

// [GET] Lấy tất cả trang thiết bị (có filter, phân trang, search cơ bản)
const getAllTrangThietBi = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      ma_ch,
      loai_ttb,
      so_bbgn,
      keyword,
      tu_ngay,
      den_ngay,
      ky,
    } = req.query;

    const filter = {};

    if (ma_ch) filter.ma_ch = ma_ch;
    if (loai_ttb) filter.loai_ttb = loai_ttb;
    if (so_bbgn) filter.so_bbgn = so_bbgn;
    if (ky) filter.ky = ky;

    if (tu_ngay || den_ngay) {
      filter.ngay_tao = {};
      if (tu_ngay) filter.ngay_tao.$gte = new Date(tu_ngay);
      if (den_ngay) filter.ngay_tao.$lte = new Date(den_ngay);
    }

    if (keyword) {
      filter.$or = [
        { ten_ch: { $regex: keyword, $options: "i" } },
        { so_xe: { $regex: keyword, $options: "i" } },
        { nvc: { $regex: keyword, $options: "i" } },
        { so_bbgn: { $regex: keyword, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      TrangThietBi.find(filter)
        .sort({ ngay_tao: 1 })
        .skip(skip)
        .limit(Number(limit)),
      TrangThietBi.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [GET] Lấy danh sách loại TTB (distinct trực tiếp từ dữ liệu giao dịch,
// không cần bảng danh mục riêng — loại mới sẽ tự xuất hiện ngay khi import Excel)
const getDistinctLoaiTTB = async (req, res) => {
  try {
    const data = await TrangThietBi.distinct("loai_ttb");
    const sorted = data.filter(Boolean).sort((a, b) => a.localeCompare(b));
    return res.status(200).json({ success: true, data: sorted });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [GET] Lấy 1 trang thiết bị theo id
const getByIdTrangThietBi = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await TrangThietBi.findById(id);

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy trang thiết bị" });
    }

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [POST] Tạo mới 1 trang thiết bị
const createOneTrangThietBi = async (req, res) => {
  try {
    const payload = req.body;

    const newItem = new TrangThietBi({
      ...payload,
      ngay_tao: payload.ngay_tao || new Date(),
    });

    const saved = await newItem.save();

    return res.status(201).json({ success: true, data: saved });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ----- Tạo mới nhiều trang thiết bị = import file Excel Đối Lưu Trang Thiết Bị -----
// (ExcelJS, dò header động, bulkWrite)

// Map tên cột trong file Excel -> tên field trong schema
const HEADER_MAP = {
  "Số BBGN": "so_bbgn",
  "Ngày tạo": "ngay_tao",
  "Loại Trang thiết bị": "loai_ttb",
  "Mã kho": "ma_kho",
  "Mã Co.op": "ma_ch",
  "Tên Co.op": "ten_ch",
  "Số xe": "so_xe",
  "Nhà vận chuyển": "nvc",
  "Trang thiết bị giao": "ttb_giao",
  "Trang thiết bị siêu thị nhận": "ttb_sieu_thi_nhan",
  "Trang thiết bị siêu thị trả": "ttb_sieu_thi_tra",
  "Trang thiết bị TTPP nhận": "ttb_nhan",
  "Thiết bị lưu tại siêu thị": "ttb_luu_tai_st",
};

// Excel lưu ngày dạng số serial (VD: 46219.834554) — quy đổi sang Date thật
const excelSerialToDate = (serial) => {
  if (serial === null || serial === undefined || serial === "") return null;
  if (serial instanceof Date) return serial;
  const n = Number(serial);
  if (Number.isNaN(n)) return null;
  // Epoch của Excel: 1899-12-30 (đã bù lỗi năm nhuận 1900 của Excel)
  const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
  return new Date(EXCEL_EPOCH + n * 24 * 60 * 60 * 1000);
};

// Tính "ky" dạng YYYY-MM từ 1 Date — dùng để group/lọc theo tháng nhanh
const tinhKyTuNgay = (ngay) => {
  if (!ngay) return undefined;
  const d = new Date(ngay);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// [POST] Import file Excel Đối Lưu Trang Thiết Bị (bulk-create)
const createManyTrangThietBi = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res
        .status(400)
        .json({ success: false, message: "Không tìm thấy file upload" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    // Dò động dòng header: quét vài dòng đầu, chọn dòng có nhiều cột khớp HEADER_MAP nhất
    // (file có 1 dòng tiêu đề "ĐỐI LƯU TRANG THIẾT BỊ" phía trên dòng header thật)
    let headerRowNumber = -1;
    let bestMatchCount = 0;
    const maxScanRows = Math.min(10, sheet.rowCount);

    for (let r = 1; r <= maxScanRows; r++) {
      const row = sheet.getRow(r);
      let matchCount = 0;
      row.eachCell({ includeEmpty: false }, (cell) => {
        const value = String(cell.value || "").trim();
        if (HEADER_MAP[value]) matchCount += 1;
      });
      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        headerRowNumber = r;
      }
    }

    if (headerRowNumber === -1 || bestMatchCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy dòng tiêu đề hợp lệ trong file Excel",
      });
    }

    // Xây map: số thứ tự cột -> tên field
    const headerRow = sheet.getRow(headerRowNumber);
    const colFieldMap = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const value = String(cell.value || "").trim();
      if (HEADER_MAP[value]) colFieldMap[colNumber] = HEADER_MAP[value];
    });

    const now = new Date();
    const bulkOps = [];

    for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      if (row.cellCount === 0) continue;

      const doc = { ngay_import: now };
      let hasData = false;

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const field = colFieldMap[colNumber];
        if (!field) return;

        let value = cell.value;
        // ExcelJS trả object { result, formula } cho cell công thức
        if (value && typeof value === "object" && "result" in value) {
          value = value.result;
        }

        if (field === "ngay_tao") {
          doc.ngay_tao = excelSerialToDate(value);
          doc.ky = tinhKyTuNgay(doc.ngay_tao);
        } else if (
          ["ttb_giao", "ttb_sieu_thi_tra", "ttb_luu_tai_st"].includes(field)
        ) {
          doc[field] = Number(value) || 0;
        } else {
          doc[field] =
            value === null || value === undefined ? "" : String(value).trim();
        }
        hasData = true;
      });

      if (!hasData || !doc.so_bbgn) continue;

      bulkOps.push({
        updateOne: {
          // Khớp theo số BBGN + loại TTB + mã cửa hàng: import lại file có
          // cùng số biên bản giao nhận -> CẬP NHẬT đè lên bản ghi cũ thay vì
          // tạo dòng trùng lặp.
          filter: {
            so_bbgn: doc.so_bbgn,
            loai_ttb: doc.loai_ttb,
            ma_ch: doc.ma_ch,
          },
          update: { $set: doc },
          upsert: true,
        },
      });
    }

    if (bulkOps.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Không có dữ liệu hợp lệ để import" });
    }

    const result = await TrangThietBi.bulkWrite(bulkOps, { ordered: false });

    return res.status(200).json({
      success: true,
      message: "Import thành công",
      matched: result.matchedCount,
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [PUT] Cập nhật 1 trang thiết bị theo id
const updateOneTrangThietBi = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (payload.ngay_tao) {
      payload.ky = tinhKyTuNgay(payload.ngay_tao);
    }

    const updated = await TrangThietBi.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy trang thiết bị" });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [PUT] Cập nhật nhiều trang thiết bị cùng lúc (bulk-update)
const bulkUpdateTrangThietBi = async (req, res) => {
  try {
    const { ids, data } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách id rỗng hoặc không hợp lệ",
      });
    }

    const result = await TrangThietBi.updateMany(
      { _id: { $in: ids } },
      { $set: data },
      { runValidators: true },
    );

    return res.status(200).json({
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [DELETE] Xóa 1 trang thiết bị theo id
const deleteOneTrangThietBi = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await TrangThietBi.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy trang thiết bị" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Xóa thành công", data: deleted });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [DELETE] Xóa nhiều trang thiết bị theo danh sách id (bulk-delete)
const bulkDeleteTrangThietBi = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách id rỗng hoặc không hợp lệ",
      });
    }

    const result = await TrangThietBi.deleteMany({ _id: { $in: ids } });

    return res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [DELETE] Xóa toàn bộ dữ liệu (delete-all) — cẩn trọng khi dùng
const deleteAllTrangThietBi = async (req, res) => {
  try {
    const result = await TrangThietBi.deleteMany({});

    return res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      message: "Đã xóa toàn bộ dữ liệu trang thiết bị",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllTrangThietBi,
  getDistinctLoaiTTB,
  getByIdTrangThietBi,
  createOneTrangThietBi,
  createManyTrangThietBi,
  updateOneTrangThietBi,
  bulkUpdateTrangThietBi,
  deleteOneTrangThietBi,
  bulkDeleteTrangThietBi,
  deleteAllTrangThietBi,
};
