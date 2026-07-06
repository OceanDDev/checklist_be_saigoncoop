// controllers/phieusoan/nhanSuSoan.controller.js
const NhanSuSoan = require("../../models/phieusoan/nhansusoan");
const NhanVien = require("../../models/chamcong/nhanvien");

// Helper: nhận vào mảng document NhanSuSoan (hoặc 1 document), trả về bản có kèm
// thông tin nhân viên (ten_nhan_vien, bo_phan, chuc_vu) cho nvSoan/nvKC
const ganThongTinNhanVien = async (docs) => {
  const isArray = Array.isArray(docs);
  const list = isArray ? docs : [docs];

  const allMaNV = new Set();
  list.forEach((doc) => {
    (doc.nvSoan || []).forEach((ma) => allMaNV.add(ma));
    (doc.nvKC || []).forEach((ma) => allMaNV.add(ma));
  });

  if (allMaNV.size === 0) {
    return isArray ? list : list[0];
  }

  const nhanViens = await NhanVien.find({
    ma_nhan_vien: { $in: Array.from(allMaNV) },
  }).lean();

  const nvMap = {};
  nhanViens.forEach((nv) => {
    nvMap[nv.ma_nhan_vien] = {
      ma_nhan_vien: nv.ma_nhan_vien,
      ten_nhan_vien: nv.ten_nhan_vien,
      bo_phan: nv.bo_phan,
      chuc_vu: nv.chuc_vu,
    };
  });

  const ketQua = list.map((doc) => {
    const obj = doc.toObject ? doc.toObject() : doc;
    obj.nvSoanChiTiet = (obj.nvSoan || []).map(
      (ma) =>
        nvMap[ma] || { ma_nhan_vien: ma, ten_nhan_vien: "(Không tìm thấy)" },
    );
    obj.nvKCChiTiet = (obj.nvKC || []).map(
      (ma) =>
        nvMap[ma] || { ma_nhan_vien: ma, ten_nhan_vien: "(Không tìm thấy)" },
    );
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

    // Chuẩn hoá danh sách số đơn hàng để kiểm tra trùng
    const soDonHangList = data.map((it) =>
      (it.soDonHang || "").toString().trim(),
    );

    if (soDonHangList.some((code) => !code)) {
      return res.status(400).json({
        message:
          "Có dòng thiếu số đơn hàng (soDonHang), vui lòng kiểm tra lại file.",
      });
    }

    // 1) Kiểm tra trùng ngay trong file import (không phân biệt hoa/thường)
    const seen = new Map();
    const dupInFileSet = new Set();
    soDonHangList.forEach((code) => {
      const key = code.toUpperCase();
      if (seen.has(key)) dupInFileSet.add(code);
      else seen.set(key, code);
    });

    if (dupInFileSet.size > 0) {
      return res.status(400).json({
        message: `Phát hiện ${dupInFileSet.size} số đơn hàng bị trùng ngay trong file import`,
        duplicates: Array.from(dupInFileSet),
      });
    }

    // 2) Kiểm tra trùng với dữ liệu đã có sẵn trong hệ thống (không phân biệt hoa/thường)
    const existing = await NhanSuSoan.find({
      soDonHang: { $in: soDonHangList },
    })
      .collation({ locale: "vi", strength: 2 })
      .select("soDonHang")
      .lean();

    if (existing.length > 0) {
      const existingCodes = existing.map((e) => e.soDonHang);
      return res.status(409).json({
        message: `${existingCodes.length} số đơn hàng đã tồn tại trong hệ thống, không thể import`,
        duplicates: existingCodes,
      });
    }

    const result = await NhanSuSoan.insertMany(data, { ordered: false });
    res.status(201).json({
      message: `Đã thêm ${result.length} phiếu thành công`,
      data: result,
    });
  } catch (error) {
    // Trùng key do unique index (nếu có) ở tầng DB
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Có số đơn hàng bị trùng trong hệ thống",
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Lỗi khi import phiếu",
      error: error.message,
      inserted: error.insertedDocs || undefined,
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
