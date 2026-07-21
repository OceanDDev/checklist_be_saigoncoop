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
    if (!info) return item;

    // Nơi Xuất Đến: ưu tiên "mã CH - tên CH" tra được từ DataCH,
    // nếu DataCH không có tên thì giữ nguyên giá trị Excel đã nhập.
    const noiXuatDenTuDataCH = info.tench // ← đổi ten_ch -> tench
      ? `${(item.maNXD || "").toString().trim()}-${info.tench}` // ← đổi ten_ch -> tench
      : "";

    return {
      ...item,
      chuyen: info.chuyen || item.chuyen || "",
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
      } else {
        validData.push({ ...item, soDonHang: code });
      }
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

    let result = [];
    try {
      result = await NhanSuSoan.insertMany(dataWithChuyenLichDiHang, {
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

    if (soDonHang) filter.soDonHang = { $regex: soDonHang, $options: "i" };
    if (soPhieuGop) filter.soPhieuGop = { $regex: soPhieuGop, $options: "i" };
    if (trangThai) filter.trangThai = trangThai;
    if (maNXD) filter.maNXD = { $regex: maNXD, $options: "i" };
    if (noiXuatDen) filter.noiXuatDen = { $regex: noiXuatDen, $options: "i" };
    if (chuyen) filter.chuyen = { $regex: chuyen, $options: "i" };
    // lichDiHang là text (VD: "T7/CN", "T2"), không phải ngày tháng
    // -> lọc kiểu "chứa chuỗi", KHÔNG lọc theo khoảng ngày (tuNgay/denNgay)
    if (lichDiHang) filter.lichDiHang = { $regex: lichDiHang, $options: "i" };
    // nvSoan/nvKC là mảng mã nhân viên -> regex trên field mảng sẽ khớp
    // nếu BẤT KỲ phần tử nào trong mảng chứa chuỗi tìm kiếm
    if (nvSoan) filter.nvSoan = { $regex: nvSoan, $options: "i" };
    if (nvKC) filter.nvKC = { $regex: nvKC, $options: "i" };

    // Lọc khoảng ngày theo TG import (tgImport) — tuNgay/denNgay dạng "YYYY-MM-DD"
    if (tuNgay || denNgay) {
      filter.tgImport = {};
      if (tuNgay) {
        const start = new Date(`${tuNgay}T00:00:00.000`);
        if (!Number.isNaN(start.getTime())) filter.tgImport.$gte = start;
      }
      if (denNgay) {
        const end = new Date(`${denNgay}T23:59:59.999`);
        if (!Number.isNaN(end.getTime())) filter.tgImport.$lte = end;
      }
      if (Object.keys(filter.tgImport).length === 0) delete filter.tgImport;
    }

    // Lọc khoảng ngày theo TG hoàn thành (tgHoanThanh)
    if (tuNgayHT || denNgayHT) {
      filter.tgHoanThanh = {};
      if (tuNgayHT) {
        const start = new Date(`${tuNgayHT}T00:00:00.000`);
        if (!Number.isNaN(start.getTime())) filter.tgHoanThanh.$gte = start;
      }
      if (denNgayHT) {
        const end = new Date(`${denNgayHT}T23:59:59.999`);
        if (!Number.isNaN(end.getTime())) filter.tgHoanThanh.$lte = end;
      }
      if (Object.keys(filter.tgHoanThanh).length === 0)
        delete filter.tgHoanThanh;
    }

    // Lọc khoảng ngày theo TG nhận phiếu (tgNhanPhieu)
    if (tuNgayNP || denNgayNP) {
      filter.tgNhanPhieu = {};
      if (tuNgayNP) {
        const start = new Date(`${tuNgayNP}T00:00:00.000`);
        if (!Number.isNaN(start.getTime())) filter.tgNhanPhieu.$gte = start;
      }
      if (denNgayNP) {
        const end = new Date(`${denNgayNP}T23:59:59.999`);
        if (!Number.isNaN(end.getTime())) filter.tgNhanPhieu.$lte = end;
      }
      if (Object.keys(filter.tgNhanPhieu).length === 0)
        delete filter.tgNhanPhieu;
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
    const updated = await NhanSuSoan.findByIdAndUpdate(
      id,
      { $set: req.body },
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
// body: { ids: [...], data: {...} }  -> áp cùng nội dung cho nhiều phiếu
// hoặc  { updates: [ { id, data }, ... ] } -> mỗi phiếu 1 nội dung khác nhau
const updateManyNhanSuSoan = async (req, res) => {
  try {
    const { ids, data, updates } = req.body;

    if (Array.isArray(ids) && ids.length > 0 && data) {
      const result = await NhanSuSoan.updateMany(
        { _id: { $in: ids } },
        { $set: data },
        { runValidators: true },
      );
      return res.status(200).json({
        message: `Đã cập nhật ${result.modifiedCount} phiếu`,
        result,
      });
    }

    if (Array.isArray(updates) && updates.length > 0) {
      const bulkOps = updates.map(({ id, data }) => ({
        updateOne: { filter: { _id: id }, update: { $set: data } },
      }));

      const result = await NhanSuSoan.bulkWrite(bulkOps);
      return res.status(200).json({
        message: `Đã cập nhật ${result.modifiedCount} phiếu`,
        result,
      });
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
};
