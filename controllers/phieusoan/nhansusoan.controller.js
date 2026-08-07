// controllers/phieusoan/nhanSuSoan.controller.js
const NhanSuSoan = require("../../models/phieusoan/nhansusoan");
const NhanVien = require("../../models/chamcong/nhanvien");
const DataCH = require("../../models/phieusoan/dataCH");

/**
 * Chuẩn hoá mã cửa hàng để so khớp giữa maNXD (NhanSuSoan) và mach (DataCH):
 * - Nếu là số thuần (VD "02034") -> bỏ số 0 ở đầu ("2034")
 * - Nếu là mã chữ (VD "ch00273") -> viết hoa toàn bộ ("CH00273")
 */
const normalizeMaCh = (raw) => {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s.toUpperCase();
};

// ─── Helper: lọc khoảng ngày luôn theo giờ VN (UTC+7), không phụ thuộc TZ server ─
const VN_OFFSET = "+07:00";

const startOfDayVN = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00.000${VN_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const endOfDayVN = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T23:59:59.999${VN_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Gắn điều kiện lọc khoảng ngày (giờ VN) cho 1 field ngày vào object filter,
 *  chỉ thêm nếu có ít nhất 1 trong 2 mốc tuNgay/denNgay hợp lệ. */
const applyDateRangeFilter = (filter, field, tuNgay, denNgay) => {
  const range = {};
  const start = startOfDayVN(tuNgay);
  const end = endOfDayVN(denNgay);
  if (start) range.$gte = start;
  if (end) range.$lte = end;
  if (Object.keys(range).length > 0) filter[field] = range;
};

const ganThongTinTuDataCHTheoMaCh = async (data) => {
  const maChSet = new Set();
  data.forEach((item) => {
    const key = normalizeMaCh(item.maNXD);
    if (key) maChSet.add(key);
  });

  if (maChSet.size === 0) return data;

  const dataCHDocs = await DataCH.find(
    { mach: { $in: Array.from(maChSet) } },
    { mach: 1, chuyen: 1, lich_di_hang: 1, tench: 1, _id: 0 }, // ← đổi ten_ch -> tench
  ).lean();

  const machInfoMap = new Map();
  dataCHDocs.forEach((d) => {
    const key = normalizeMaCh(d.mach);
    if (!key) return;
    machInfoMap.set(key, {
      chuyen: d.chuyen || "",
      lich_di_hang: d.lich_di_hang || "",
      tench: d.tench || "", // ← đổi ten_ch -> tench
    });
  });

  return data.map((item) => {
    const key = normalizeMaCh(item.maNXD);
    const info = machInfoMap.get(key);

    // Chuyến: nếu người dùng đã điền trong file thì ưu tiên dùng giá trị đó,
    // ngược lại lấy mặc định từ DataCH theo Mã NXĐ. Luôn chuẩn hoá viết HOA.
    const chuyenNhapTay = (item.chuyen || "").toString().trim();
    const chuyenMacDinh = info?.chuyen || "";
    const chuyenFinal = (chuyenNhapTay || chuyenMacDinh || "").toUpperCase();

    if (!info) {
      return { ...item, chuyen: chuyenFinal };
    }

    const noiXuatDenTuDataCH = info.tench
      ? `${(item.maNXD || "").toString().trim()}-${info.tench}`
      : "";

    return {
      ...item,
      chuyen: chuyenFinal,
      lichDiHang: info.lich_di_hang || item.lichDiHang || "",
      noiXuatDen: noiXuatDenTuDataCH || item.noiXuatDen || "",
    };
  });
};
// Helper: nhận vào mảng document NhanSuSoan (hoặc 1 document), trả về bản có kèm
// thông tin nhân viên (ten_nhan_vien, bo_phan, chuc_vu) cho nvSoan/nvKC
const ganThongTinNhanVien = async (docs) => {
  const isArray = Array.isArray(docs);
  const list = isArray ? docs : [docs];

  const allMa = new Set();
  list.forEach((doc) => {
    (doc.nvSoan || []).forEach((ma) => allMa.add(ma));
    (doc.nvKC || []).forEach((ma) => allMa.add(ma));
  });

  if (allMa.size === 0) {
    return isArray ? list : list[0];
  }

  const maList = Array.from(allMa);

  const nhanViens = await NhanVien.find({
    $or: [{ ma_nhan_vien: { $in: maList } }, { ma_phu: { $in: maList } }],
  }).lean();

  const resolveMap = {};
  nhanViens.forEach((nv) => {
    resolveMap[nv.ma_nhan_vien] = {
      ma_nhan_vien: nv.ma_nhan_vien,
      ten_nhan_vien: nv.ten_nhan_vien,
      bo_phan: nv.bo_phan,
      chuc_vu: nv.chuc_vu,
      via: "chinh",
    };
    if (nv.ma_phu) {
      resolveMap[nv.ma_phu] = {
        ma_nhan_vien: nv.ma_nhan_vien, // vẫn quy về mã chính -> dùng để GỘP số liệu
        ten_nhan_vien: nv.ten_nhan_vien,
        bo_phan: nv.bo_phan,
        chuc_vu: nv.chuc_vu,
        via: "phu",
      };
    }
  });

  const resolveOne = (maGoc) => {
    const info = resolveMap[maGoc] || {
      ma_nhan_vien: maGoc,
      ten_nhan_vien: "(Không tìm thấy)",
      bo_phan: "",
      chuc_vu: "",
      via: "chinh",
    };
    return {
      ma_nhan_vien: info.ma_nhan_vien, // ✅ mã CHÍNH — dùng để gộp số liệu/KPI
      ma_hien_thi: maGoc, // ✅ mã ĐÃ NHẬP GỐC trên phiếu (chính hoặc phụ) — dùng để HIỂN THỊ
      ten_nhan_vien: info.ten_nhan_vien,
      bo_phan: info.bo_phan,
      chuc_vu: info.chuc_vu,
      via_ma_phu: info.via === "phu",
    };
  };

  const ketQua = list.map((doc) => {
    const obj = doc.toObject ? doc.toObject() : doc;
    obj.nvSoanChiTiet = (obj.nvSoan || []).map((ma) => resolveOne(ma));
    obj.nvKCChiTiet = (obj.nvKC || []).map((ma) => resolveOne(ma));
    return obj;
  });

  return isArray ? ketQua : ketQua[0];
};

// ─── Thêm phiếu ───────────────────────────────────────────────────────────────
const createNhanSuSoan = async (req, res) => {
  try {
    const newDoc = await NhanSuSoan.create(req.body);
    res.status(201).json({ message: "Thêm phiếu thành công", data: newDoc });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
// ─── Helper dùng chung: lọc dòng thiếu/sai số đơn hàng + loại trùng trong
// file + loại trùng với DB. Dùng lại cho cả import thường và import Phân Bổ. ─
const locVaLoaiTrungKhiImport = async (data) => {
  const skipped = []; // { soDonHang, reason }
  const validData = [];

  data.forEach((item) => {
    const code = (item.soDonHang || "").toString().trim();
    if (!code) {
      skipped.push({ soDonHang: "(trống)", reason: "Thiếu số đơn hàng" });
      return;
    }
    const codeUpper = code.toUpperCase();
    if (!codeUpper.startsWith("SO") && !codeUpper.startsWith("TO")) {
      skipped.push({
        soDonHang: code,
        reason: "Số đơn hàng phải bắt đầu bằng SO hoặc TO",
      });
      return;
    }
    validData.push({ ...item, soDonHang: code });
  });

  const seenInFile = new Map();
  const dedupedData = [];
  validData.forEach((item) => {
    const key = item.soDonHang.toUpperCase();
    if (seenInFile.has(key)) {
      skipped.push({
        soDonHang: item.soDonHang,
        reason: "Trùng trong file import (chỉ giữ dòng đầu tiên)",
      });
    } else {
      seenInFile.set(key, true);
      dedupedData.push(item);
    }
  });

  let toInsert = dedupedData;
  if (dedupedData.length > 0) {
    const codesToCheck = dedupedData.map((it) => it.soDonHang);
    const existing = await NhanSuSoan.find({
      soDonHang: { $in: codesToCheck },
    })
      .collation({ locale: "vi", strength: 2 })
      .select("soDonHang")
      .lean();

    if (existing.length > 0) {
      const existingKeySet = new Set(
        existing.map((e) => e.soDonHang.toUpperCase()),
      );
      toInsert = [];
      dedupedData.forEach((item) => {
        if (existingKeySet.has(item.soDonHang.toUpperCase())) {
          skipped.push({
            soDonHang: item.soDonHang,
            reason: "Đã tồn tại trong hệ thống",
          });
        } else {
          toInsert.push(item);
        }
      });
    }
  }

  return { toInsert, skipped };
};
// ─── Thêm nhiều phiếu (import) ────────────────────────────────────────────────
const importManyNhanSuSoan = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({ message: "Dữ liệu import phải là mảng và không được rỗng" });
    }

    const skipped = []; // { soDonHang, reason }
    const validData = [];

    // 1) Loại các dòng thiếu số đơn hàng
    data.forEach((item) => {
      const code = (item.soDonHang || "").toString().trim();
      if (!code) {
        skipped.push({ soDonHang: "(trống)", reason: "Thiếu số đơn hàng" });
        return;
      }
      const codeUpper = code.toUpperCase();
      if (!codeUpper.startsWith("SO") && !codeUpper.startsWith("TO")) {
        skipped.push({
          soDonHang: code,
          reason: "Số đơn hàng phải bắt đầu bằng SO hoặc TO",
        });
        return;
      }
      validData.push({ ...item, soDonHang: code });
    });

    // 2) Loại các dòng trùng NGAY TRONG FILE (chỉ giữ dòng đầu tiên, không phân biệt hoa/thường)
    const seenInFile = new Map();
    const dedupedData = [];
    validData.forEach((item) => {
      const key = item.soDonHang.toUpperCase();
      if (seenInFile.has(key)) {
        skipped.push({
          soDonHang: item.soDonHang,
          reason: "Trùng trong file import (chỉ giữ dòng đầu tiên)",
        });
      } else {
        seenInFile.set(key, true);
        dedupedData.push(item);
      }
    });

    // 3) Loại các dòng đã tồn tại trong hệ thống
    let toInsert = dedupedData;
    if (dedupedData.length > 0) {
      const codesToCheck = dedupedData.map((it) => it.soDonHang);
      const existing = await NhanSuSoan.find({
        soDonHang: { $in: codesToCheck },
      })
        .collation({ locale: "vi", strength: 2 })
        .select("soDonHang")
        .lean();

      if (existing.length > 0) {
        const existingKeySet = new Set(
          existing.map((e) => e.soDonHang.toUpperCase()),
        );
        toInsert = [];
        dedupedData.forEach((item) => {
          if (existingKeySet.has(item.soDonHang.toUpperCase())) {
            skipped.push({
              soDonHang: item.soDonHang,
              reason: "Đã tồn tại trong hệ thống",
            });
          } else {
            toInsert.push(item);
          }
        });
      }
    }

    if (toInsert.length === 0) {
      return res.status(200).json({
        message: `Không có phiếu nào hợp lệ để import. Đã bỏ qua ${skipped.length} phiếu.`,
        inserted: [],
        skipped,
      });
    }

    const dataWithChuyenLichDiHang =
      await ganThongTinTuDataCHTheoMaCh(toInsert);
    const dataWithTgImport = dataWithChuyenLichDiHang.map((item) => ({
      ...item,
      tgImport: new Date(),
    }));

    let result = [];
    try {
      result = await NhanSuSoan.insertMany(dataWithTgImport, {
        ordered: false,
      });
    } catch (insertError) {
      // Một số dòng có thể lỗi do trùng key ở tầng DB (race condition) -
      // vẫn lấy các dòng insert thành công, dòng lỗi coi như bị bỏ qua
      if (insertError.insertedDocs) {
        result = insertError.insertedDocs;
      } else {
        throw insertError;
      }
      if (Array.isArray(insertError.writeErrors)) {
        insertError.writeErrors.forEach((we) => {
          skipped.push({
            soDonHang: we.err?.op?.soDonHang || "(?)",
            reason: "Lỗi khi lưu (có thể trùng số đơn hàng)",
          });
        });
      }
    }

    res.status(201).json({
      message: `Đã thêm ${result.length} phiếu thành công${
        skipped.length > 0 ? `, bỏ qua ${skipped.length} phiếu` : ""
      }`,
      inserted: result,
      skipped,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi import phiếu",
      error: error.message,
    });
  }
};

// ─── Lấy danh sách phiếu ──────────────────────────────────────────────────────
const getAllNhanSuSoan = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      soDonHang,
      soPhieuGop,
      trangThai,
      trangThaiBookXe,
      maNXD,
      noiXuatDen,
      chuyen,
      lichDiHang,
      nvSoan,
      nvKC,
      tuNgay,
      denNgay,
      tuNgayHT,
      denNgayHT,
      tuNgayNP,
      denNgayNP,
    } = req.query;

    const filter = {};
    const andConditions = [];
    const buildArrayFieldCondition = (field, value) => {
      const v = (value || "").toString().trim();
      if (!v) return null;
      if (v === "!") {
        return {
          $or: [
            { [field]: { $exists: false } },
            { [field]: null },
            { [field]: { $size: 0 } },
          ],
        };
      }
      return { [field]: { $regex: v, $options: "i" } };
    };

    if (soDonHang) filter.soDonHang = { $regex: soDonHang, $options: "i" };
    if (soPhieuGop) filter.soPhieuGop = { $regex: soPhieuGop, $options: "i" };
    if (trangThai) filter.trangThai = trangThai;
    if (trangThaiBookXe) filter.trangThaiBookXe = trangThaiBookXe;
    if (maNXD) filter.maNXD = { $regex: maNXD, $options: "i" };
    if (noiXuatDen) filter.noiXuatDen = { $regex: noiXuatDen, $options: "i" };
    if (chuyen) filter.chuyen = { $regex: chuyen, $options: "i" };
    if (lichDiHang) filter.lichDiHang = { $regex: lichDiHang, $options: "i" };

    const nvSoanCond = buildArrayFieldCondition("nvSoan", nvSoan);
    if (nvSoanCond) andConditions.push(nvSoanCond);
    const nvKCCond = buildArrayFieldCondition("nvKC", nvKC);
    if (nvKCCond) andConditions.push(nvKCCond);

    // ✅ FIX: nếu request có truyền tuNgayNP/denNgayNP và/hoặc tuNgayHT/denNgayHT
    // (màn hình Năng suất cần cả 2 field cùng lúc để không phải refetch khi
    // đổi tab vai trò Soạn/KC), thì OR 2 điều kiện lại với nhau — một phiếu
    // được lấy về nếu tgNhanPhieu HOẶC tgHoanThanh rơi vào đúng khoảng ngày.
    // Nếu chỉ truyền tuNgay/denNgay như cũ (không truyền NP/HT) thì vẫn giữ
    // hành vi cũ: lọc theo tgImport, không đổi để tránh phá các chỗ khác
    // đang dùng field tuNgay/denNgay cho mục đích lọc theo TG import.
    const hasNPRange = tuNgayNP || denNgayNP;
    const hasHTRange = tuNgayHT || denNgayHT;

    if (hasNPRange || hasHTRange) {
      const orConditions = [];
      if (hasNPRange) {
        const npFilter = {};
        applyDateRangeFilter(npFilter, "tgNhanPhieu", tuNgayNP, denNgayNP);
        if (npFilter.tgNhanPhieu) orConditions.push(npFilter);
      }
      if (hasHTRange) {
        const htFilter = {};
        applyDateRangeFilter(htFilter, "tgHoanThanh", tuNgayHT, denNgayHT);
        if (htFilter.tgHoanThanh) orConditions.push(htFilter);
      }
      if (orConditions.length > 0) andConditions.push({ $or: orConditions });
    } else {
      // hành vi cũ: lọc theo tgImport khi chỉ có tuNgay/denNgay
      applyDateRangeFilter(filter, "tgImport", tuNgay, denNgay);
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }
    const skip = (Number(page) - 1) * Number(limit);

    const [itemsRaw, total] = await Promise.all([
      NhanSuSoan.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      NhanSuSoan.countDocuments(filter),
    ]);

    const data = await ganThongTinNhanVien(itemsRaw);

    res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
// ─── Lấy 1 phiếu theo id ──────────────────────────────────────────────────────
const getNhanSuSoanById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await NhanSuSoan.findById(id);
    if (!doc) return res.status(404).json({ message: "Không tìm thấy phiếu" });

    const data = await ganThongTinNhanVien(doc);
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Cập nhật 1 phiếu ─────────────────────────────────────────────────────────
const updateNhanSuSoan = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };
    delete body.tgImport;
    delete body.tgHoanThanh;
    delete body.tgNhanPhieu;

    if (body.trangThai) {
      const current = await NhanSuSoan.findById(id).select(
        "trangThai tgNhanPhieu",
      );
      if (!current)
        return res.status(404).json({ message: "Không tìm thấy phiếu" });

      if (body.trangThai === "Đang soạn" && !current.tgNhanPhieu) {
        body.tgNhanPhieu = new Date();
      }
      if (body.trangThai === "Hoàn thành") {
        body.tgHoanThanh = new Date();
      }
    }

    const updated = await NhanSuSoan.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true },
    );
    if (!updated)
      return res.status(404).json({ message: "Không tìm thấy phiếu" });
    res.status(200).json({ message: "Cập nhật thành công", data: updated });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Cập nhật nhiều phiếu ─────────────────────────────────────────────────────
const updateManyNhanSuSoan = async (req, res) => {
  try {
    const { ids, data, updates } = req.body;
    const now = new Date(); // 1 mốc chung cho cả batch

    const stamp = (payload) => {
      const clean = { ...payload };
      delete clean.tgImport;
      delete clean.tgHoanThanh;
      delete clean.tgNhanPhieu;
      if (clean.trangThai === "Hoàn thành") clean.tgHoanThanh = now;
      if (clean.trangThai === "Đang soạn") clean.tgNhanPhieu = now;
      return clean;
    };

    if (Array.isArray(ids) && ids.length > 0 && data) {
      const result = await NhanSuSoan.updateMany(
        { _id: { $in: ids } },
        { $set: stamp(data) },
        { runValidators: true },
      );
      return res
        .status(200)
        .json({ message: `Đã cập nhật ${result.modifiedCount} phiếu`, result });
    }

    if (Array.isArray(updates) && updates.length > 0) {
      const bulkOps = updates.map(({ id, data }) => ({
        updateOne: { filter: { _id: id }, update: { $set: stamp(data) } },
      }));
      const result = await NhanSuSoan.bulkWrite(bulkOps);
      return res
        .status(200)
        .json({ message: `Đã cập nhật ${result.modifiedCount} phiếu`, result });
    }

    res.status(400).json({
      message: "Cần truyền { ids, data } hoặc { updates: [{ id, data }] }",
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Xoá 1 phiếu ──────────────────────────────────────────────────────────────
const deleteNhanSuSoan = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await NhanSuSoan.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ message: "Không tìm thấy phiếu" });

    res.status(200).json({ message: "Xoá phiếu thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Xoá nhiều phiếu ──────────────────────────────────────────────────────────
// body: { ids: [...] }
const deleteManyNhanSuSoan = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: "Cần truyền mảng 'ids' và không được rỗng" });
    }

    const result = await NhanSuSoan.deleteMany({ _id: { $in: ids } });
    res.status(200).json({
      message: `Đã xoá ${result.deletedCount} phiếu`,
      result,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Xoá toàn bộ phiếu ────────────────────────────────────────────────────────
const deleteAllNhanSuSoan = async (req, res) => {
  try {
    const result = await NhanSuSoan.deleteMany({});
    res.status(200).json({
      message: `Đã xoá toàn bộ ${result.deletedCount} phiếu`,
      result,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
// ─── Cập nhật trạng thái Book Xe cho nhiều phiếu ──────────────────────────────
// body: { ids: [...], trangThaiBookXe: "Chờ Book" | "Chờ Xe" | "Hoàn thành" }
const updateTrangThaiBookXe = async (req, res) => {
  try {
    const { ids, trangThaiBookXe } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: "Cần truyền mảng 'ids' và không được rỗng" });
    }

    const validValues = ["Chờ Book", "Chờ Xe", "Hoàn thành"];
    if (!validValues.includes(trangThaiBookXe)) {
      return res.status(400).json({
        message: `trangThaiBookXe không hợp lệ. Giá trị cho phép: ${validValues.join(", ")}`,
      });
    }

    const result = await NhanSuSoan.updateMany(
      { _id: { $in: ids } },
      { $set: { trangThaiBookXe } },
      { runValidators: true },
    );

    res.status(200).json({
      message: `Đã cập nhật trạng thái Book Xe cho ${result.modifiedCount} phiếu`,
      result,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const importUpdateNhanSuSoan = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({ message: "Dữ liệu import phải là mảng và không được rỗng" });
    }

    const skipped = []; // { soDonHang, reason }
    const validData = [];

    // 1) Loại dòng thiếu số đơn hàng
    data.forEach((item) => {
      const code = (item.soDonHang || "").toString().trim();
      if (!code) {
        skipped.push({ soDonHang: "(trống)", reason: "Thiếu số đơn hàng" });
        return;
      }
      validData.push({ ...item, soDonHang: code });
    });

    // 2) Loại trùng trong file (chỉ giữ dòng đầu tiên)
    const seenInFile = new Map();
    const dedupedData = [];
    validData.forEach((item) => {
      const key = item.soDonHang.toUpperCase();
      if (seenInFile.has(key)) {
        skipped.push({
          soDonHang: item.soDonHang,
          reason: "Trùng trong file import (chỉ giữ dòng đầu tiên)",
        });
      } else {
        seenInFile.set(key, true);
        dedupedData.push(item);
      }
    });

    if (dedupedData.length === 0) {
      return res.status(200).json({
        message: `Không có phiếu nào hợp lệ để cập nhật. Đã bỏ qua ${skipped.length} phiếu.`,
        matchedCount: 0,
        modifiedCount: 0,
        skipped,
      });
    }

    // 3) Tìm các đơn ĐÃ TỒN TẠI trong hệ thống theo soDonHang, lấy kèm
    // tgNhanPhieu hiện tại để quyết định có set lại hay không.
    const codesToCheck = dedupedData.map((it) => it.soDonHang);
    const existingDocs = await NhanSuSoan.find({
      soDonHang: { $in: codesToCheck },
    })
      .collation({ locale: "vi", strength: 2 })
      .select("soDonHang tgNhanPhieu")
      .lean();

    const existingMap = new Map();
    existingDocs.forEach((d) => {
      existingMap.set(d.soDonHang.toUpperCase(), d);
    });

    const toUpdate = [];
    dedupedData.forEach((item) => {
      const existing = existingMap.get(item.soDonHang.toUpperCase());
      if (!existing) {
        skipped.push({
          soDonHang: item.soDonHang,
          reason: "Không tìm thấy số đơn hàng trong hệ thống",
        });
        return;
      }
      toUpdate.push({
        ...item, // giữ nguyên maNXD, soPhieuGop, nvSoan, nvKC, kien, dong từ file
        tgNhanPhieu: existing.tgNhanPhieu, // giá trị hiện có trong DB (có thể null)
      });
    });

    if (toUpdate.length === 0) {
      return res.status(200).json({
        message: `Không có phiếu nào để cập nhật. Đã bỏ qua ${skipped.length} phiếu.`,
        matchedCount: 0,
        modifiedCount: 0,
        skipped,
      });
    }

    // Tự điền lại Nơi Xuất Đến/Lịch Đi Hàng theo Mã NXĐ (đồng bộ với các
    // luồng import khác) — vì maNXD có thể đã thay đổi so với lúc tạo phiếu.
    const dataWithDataCH = await ganThongTinTuDataCHTheoMaCh(toUpdate);

    const now = new Date(); // 1 mốc chung cho cả batch

    const bulkOps = dataWithDataCH.map((item) => {
      const setPayload = {
        maNXD: item.maNXD,
        soPhieuGop: item.soPhieuGop,
        nvSoan: item.nvSoan,
        nvKC: item.nvKC,
        kien: item.kien,
        dong: item.dong,
        chuyen: item.chuyen,
        noiXuatDen: item.noiXuatDen,
        lichDiHang: item.lichDiHang,
        trangThai: "Hoàn thành",
        tgHoanThanh: now,
      };
      if (!item.tgNhanPhieu) {
        setPayload.tgNhanPhieu = now; // chưa có -> set = thời điểm import
      }
      // đã có tgNhanPhieu -> không đưa vào $set, giữ nguyên giá trị cũ

      return {
        updateOne: {
          filter: { soDonHang: item.soDonHang },
          collation: { locale: "vi", strength: 2 },
          update: { $set: setPayload },
        },
      };
    });

    const result = await NhanSuSoan.bulkWrite(bulkOps, { ordered: false });

    res.status(200).json({
      message: `Đã cập nhật ${result.modifiedCount} phiếu${
        skipped.length > 0 ? `, bỏ qua ${skipped.length} phiếu` : ""
      }`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      skipped,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi Import Update",
      error: error.message,
    });
  }
};

module.exports = {
  createNhanSuSoan,
  importManyNhanSuSoan,
  getAllNhanSuSoan,
  getNhanSuSoanById,
  updateNhanSuSoan,
  updateManyNhanSuSoan,
  deleteNhanSuSoan,
  deleteManyNhanSuSoan,
  deleteAllNhanSuSoan,
  updateTrangThaiBookXe,
  importUpdateNhanSuSoan,
  locVaLoaiTrungKhiImport,
  ganThongTinTuDataCHTheoMaCh, // 👈 thêm dòng này
};
