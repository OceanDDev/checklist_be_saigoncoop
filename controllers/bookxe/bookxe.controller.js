const BookXe = require("../../models/bookxe/bookxe");
const NhanSuSoan = require("../../models/phieusoan/nhansusoan");
const HistoryBookXe = require("../../models/bookxe/historybookxe");
const DataCH = require("../../models/phieusoan/dataCH");
const RotKien = require("../../models/dieuvan/rotkien/rotkien");
const normalizeMaCh = (raw) => {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s.toUpperCase();
};
const startOfDayVN = (ymd) => {
  if (!ymd) return null;
  return new Date(`${ymd}T00:00:00.000+07:00`);
};
const endOfDayVN = (ymd) => {
  if (!ymd) return null;
  return new Date(`${ymd}T23:59:59.999+07:00`);
};
const getAllBookXe = async (req, res) => {
  try {
    const {
      quan,
      ma_ch,
      ten_ch,
      ma_ncv,
      ten_nvc,
      lich_di_hang,
      ghi_chu,
      trangThai,
      tu_ngay, // lọc theo Ngày Đi Hàng (ngay_di_hang)
      den_ngay,
      tu_ngay_tao, // lọc theo Ngày Tạo (thoi_gian_tao)
      den_ngay_tao,
      tu_ngay_ht, // lọc theo Ngày Hoàn Thành (thoi_gian_hoan_thanh)
      den_ngay_ht,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    // Các field text: dùng regex case-insensitive để lọc theo từng cột độc
    // lập (trước đây ma_ch/quan/ma_ncv là exact match, ten_ch/ten_nvc/
    // lich_di_hang/ghi_chu chưa có filter riêng — gộp hết qua "search").
    const addRegexFilter = (field, value) => {
      if (value) filter[field] = { $regex: value, $options: "i" };
    };
    addRegexFilter("quan", quan);
    addRegexFilter("ma_ch", ma_ch);
    addRegexFilter("ten_ch", ten_ch);
    addRegexFilter("ma_ncv", ma_ncv);
    addRegexFilter("ten_nvc", ten_nvc);
    addRegexFilter("lich_di_hang", lich_di_hang);
    addRegexFilter("ghi_chu", ghi_chu);

    if (trangThai) filter.trangThai = trangThai;

    // Lưu ý: đổi từ lọc theo thoi_gian_xuat sang lọc theo ngay_di_hang, để
    // khớp đúng cột "Ngày Đi Hàng" trên bảng FE.
    if (tu_ngay || den_ngay) {
      filter.ngay_di_hang = {};
      if (tu_ngay) filter.ngay_di_hang.$gte = startOfDayVN(tu_ngay);
      if (den_ngay) filter.ngay_di_hang.$lte = endOfDayVN(den_ngay);
    }

    if (tu_ngay_tao || den_ngay_tao) {
      filter.thoi_gian_tao = {};
      if (tu_ngay_tao) filter.thoi_gian_tao.$gte = startOfDayVN(tu_ngay_tao);
      if (den_ngay_tao) filter.thoi_gian_tao.$lte = endOfDayVN(den_ngay_tao);
    }

    if (tu_ngay_ht || den_ngay_ht) {
      filter.thoi_gian_hoan_thanh = {};
      if (tu_ngay_ht)
        filter.thoi_gian_hoan_thanh.$gte = startOfDayVN(tu_ngay_ht);
      if (den_ngay_ht)
        filter.thoi_gian_hoan_thanh.$lte = endOfDayVN(den_ngay_ht);
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 50, 1);
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      BookXe.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      BookXe.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("getAllBookXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách book xe",
      error: error.message,
    });
  }
};

const getBookXeById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await BookXe.findById(id);

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu book xe" });
    }

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("getBookXeById error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi lấy phiếu book xe",
      error: error.message,
    });
  }
};

const createBookXe = async (req, res) => {
  try {
    const { nhan_su_soan_ids, rot_kien_ids, ...payload } = req.body;

    if (!payload.thoi_gian_xuat) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thời gian xuất" });
    }
    if (!payload.thoi_gian_dk_toi_ch) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thời gian dự kiến tới cửa hàng",
      });
    }
    if (!payload.ngay_di_hang) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu ngày đi hàng" });
    }

    const newItem = new BookXe({
      trangThai: "Chờ xe",
      ...payload,
      // Lưu lại ids để sau này toggle trạng thái (Hoàn thành ⇄ Chờ xe) có
      // thể cascade cập nhật đúng những phiếu NhanSuSoan / RotKien gốc.
      nhan_su_soan_ids: Array.isArray(nhan_su_soan_ids) ? nhan_su_soan_ids : [],
      rot_kien_ids: Array.isArray(rot_kien_ids) ? rot_kien_ids : [],
      thoi_gian_tao: new Date(),
    });

    await newItem.save();

    if (Array.isArray(nhan_su_soan_ids) && nhan_su_soan_ids.length) {
      try {
        await NhanSuSoan.updateMany(
          { _id: { $in: nhan_su_soan_ids } },
          { $set: { trangThaiBookXe: "Chờ Xe" } },
        );
      } catch (subErr) {
        console.error(
          "createBookXe: cập nhật NhanSuSoan thất bại sau khi đã tạo BookXe",
          newItem._id,
          subErr,
        );
      }
    }

    if (Array.isArray(rot_kien_ids) && rot_kien_ids.length) {
      try {
        await RotKien.updateMany(
          { _id: { $in: rot_kien_ids } },
          { $set: { trangThai: true } },
        );
      } catch (subErr) {
        console.error(
          "createBookXe: cập nhật RotKien thất bại sau khi đã tạo BookXe",
          newItem._id,
          subErr,
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Tạo phiếu book xe thành công",
      data: newItem,
    });
  } catch (error) {
    console.error("createBookXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi tạo phiếu book xe",
      error: error.message,
    });
  }
};

const updateBookXe = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    // Lấy trạng thái CŨ trước khi update, để biết có đang chuyển trạng thái
    // hay không (tránh cascade nhầm khi chỉ sửa giờ xuất, ghi chú...).
    const before = await BookXe.findById(id).lean();
    if (!before) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu book xe" });
    }

    const updated = await BookXe.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    const trangThaiChanged =
      payload.trangThai && payload.trangThai !== before.trangThai;

    if (trangThaiChanged) {
      const nhanSuSoanIds = before.nhan_su_soan_ids || [];
      const rotKienIds = before.rot_kien_ids || [];

      if (payload.trangThai === "Hoàn thành") {
        if (nhanSuSoanIds.length) {
          await NhanSuSoan.updateMany(
            { _id: { $in: nhanSuSoanIds } },
            { $set: { trangThaiBookXe: "Hoàn thành" } },
          );
        }
        if (rotKienIds.length) {
          await RotKien.updateMany(
            { _id: { $in: rotKienIds } },
            { $set: { trangThai: true } },
          );
        }
      } else if (payload.trangThai === "Chờ xe") {
        // Bấm lại lần nữa để quay ngược trạng thái -> đưa các phiếu gốc về
        // đúng trạng thái "đang chờ xe" như lúc mới book.
        if (nhanSuSoanIds.length) {
          await NhanSuSoan.updateMany(
            { _id: { $in: nhanSuSoanIds } },
            { $set: { trangThaiBookXe: "Chờ Xe" } },
          );
        }
        if (rotKienIds.length) {
          await RotKien.updateMany(
            { _id: { $in: rotKienIds } },
            { $set: { trangThai: false } },
          );
        }
      }
    }

    return res
      .status(200)
      .json({ success: true, message: "Cập nhật thành công", data: updated });
  } catch (error) {
    console.error("updateBookXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi cập nhật phiếu book xe",
      error: error.message,
    });
  }
};

const updateTrangThai = async (req, res) => {
  try {
    const { id } = req.params;
    const { trangThai, kien_rot } = req.body;

    const validStatuses = ["Chưa Book", "Chờ xe", "Có kiện rớt", "Hoàn thành"];
    if (!validStatuses.includes(trangThai)) {
      return res
        .status(400)
        .json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const update = { trangThai };

    if (trangThai === "Hoàn thành") {
      update.thoi_gian_hoan_thanh = new Date();
    }

    if (trangThai === "Có kiện rớt") {
      const soKienRot = Number(kien_rot);
      if (!Number.isFinite(soKienRot) || soKienRot <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Thiếu hoặc sai số kiện rớt" });
      }
      update.kien_rot = soKienRot;
      update.thoi_gian_hoan_thanh = new Date();
    }

    const updated = await BookXe.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu book xe" });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: updated,
    });
  } catch (error) {
    console.error("updateTrangThai error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi cập nhật trạng thái",
      error: error.message,
    });
  }
};

const deleteBookXe = async (req, res) => {
  try {
    const { id } = req.params;

    // Lấy trước để biết những phiếu NhanSuSoan/RotKien nào cần trả về trạng
    // thái ban đầu sau khi xoá chuyến này.
    const deleted = await BookXe.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu book xe" });
    }

    const nhanSuSoanIds = deleted.nhan_su_soan_ids || [];
    const rotKienIds = deleted.rot_kien_ids || [];

    if (nhanSuSoanIds.length) {
      await NhanSuSoan.updateMany(
        { _id: { $in: nhanSuSoanIds } },
        { $set: { trangThaiBookXe: "Chờ Book" } },
      );
    }
    if (rotKienIds.length) {
      await RotKien.updateMany(
        { _id: { $in: rotKienIds } },
        { $set: { trangThai: false } },
      );
    }

    return res.status(200).json({ success: true, message: "Xóa thành công" });
  } catch (error) {
    console.error("deleteBookXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi xóa phiếu book xe",
      error: error.message,
    });
  }
};

const deleteManyBookXe = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Danh sách id không hợp lệ" });
    }

    // Lấy trước danh sách các phiếu sẽ bị xoá để cascade trả trạng thái
    const docsToDelete = await BookXe.find(
      { _id: { $in: ids } },
      { nhan_su_soan_ids: 1, rot_kien_ids: 1 },
    ).lean();

    const allNhanSuSoanIds = docsToDelete.flatMap(
      (d) => d.nhan_su_soan_ids || [],
    );
    const allRotKienIds = docsToDelete.flatMap((d) => d.rot_kien_ids || []);

    const result = await BookXe.deleteMany({ _id: { $in: ids } });

    if (allNhanSuSoanIds.length) {
      await NhanSuSoan.updateMany(
        { _id: { $in: allNhanSuSoanIds } },
        { $set: { trangThaiBookXe: "Chờ Book" } },
      );
    }
    if (allRotKienIds.length) {
      await RotKien.updateMany(
        { _id: { $in: allRotKienIds } },
        { $set: { trangThai: false } },
      );
    }

    return res.status(200).json({
      success: true,
      message: "Xóa thành công",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("deleteManyBookXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi xóa nhiều phiếu book xe",
      error: error.message,
    });
  }
};
// Thêm hàm helper này cạnh normalizeMaCh ở đầu file
const toYMD = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// GET /api/book-xe/suggest
const suggestBookXe = async (req, res) => {
  try {
    const phieuTrongNgay = await NhanSuSoan.find({
      trangThaiBookXe: "Chờ Book",
      trangThai: { $in: ["Hoàn thành", "Đang soạn", "Chưa soạn"] }, // 👈 thêm Chưa soạn
    }).lean();

    const groupMap = new Map();
    phieuTrongNgay.forEach((p) => {
      const maCh = (p.maNXD || "").toString().trim();
      if (!maCh) return;

      const isGiaoKhach =
        typeof p.chuyen === "string" &&
        p.chuyen.trim().toLowerCase().includes("giao khách");

      const groupKey = isGiaoKhach ? `${maCh}::giaokhach` : `${maCh}::thuong`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          ma_ch: maCh,
          ten_ch: p.noiXuatDen || maCh,
          kien: 0,
          lich_di_hang: p.lichDiHang || "",
          soDonHangMau: p.soDonHang || "",
          coChuaSoan: false, // 👈 thêm

          coDangSoan: false,
          coGiaoKhach: isGiaoKhach,
          ngayPhatSinh: toYMD(p.tgHoanThanh || p.tgNhanPhieu),
          nhanSuSoanIds: [],
          chuyen: p.chuyen || "",
        });
      }
      const g = groupMap.get(groupKey);
      const soKien =
        p.trangThai === "Đang soạn" || p.trangThai === "Chưa soạn"
          ? Number(p.kien_du_kien ?? 0)
          : Number(p.kien ?? 0);
      g.kien += soKien;
      g.nhanSuSoanIds.push(p._id.toString());
      if (p.trangThai === "Đang soạn") g.coDangSoan = true;
      if (p.trangThai === "Chưa soạn") g.coChuaSoan = true; // 👈 thêm
    });

    const groupKeys = Array.from(groupMap.keys());
    const maChListKienMoi = Array.from(
      new Set(groupKeys.map((k) => groupMap.get(k).ma_ch)),
    );

    // Nguồn kiện rớt: RotKien chưa hoàn thành (trangThai: false)
    const rotKienDocs = await RotKien.find({ trangThai: false }).lean();

    // Gộp chung danh sách mã CH cần tra quận / lịch sử NCV cho cả 2 nguồn
    const maChListKienRot = rotKienDocs.map((r) => (r.maCH || "").toString());
    const maChList = Array.from(
      new Set([...maChListKienMoi, ...maChListKienRot]),
    );

    const maChNormalizedList = maChList.map(normalizeMaCh).filter(Boolean);
    const dataCHDocs = maChNormalizedList.length
      ? await DataCH.find(
          { mach: { $in: maChNormalizedList } },
          { mach: 1, quan: 1, lich_di_hang_bookxe: 1, _id: 0 }, // 👈 thêm
        ).lean()
      : [];
    const quanMap = new Map();
    const lichBookXeMap = new Map(); // 👈 thêm
    dataCHDocs.forEach((d) => {
      const key = normalizeMaCh(d.mach);
      if (key) {
        quanMap.set(key, d.quan || "");
        lichBookXeMap.set(key, d.lich_di_hang_bookxe || ""); // 👈 thêm
      }
    });
    const historyDocs = maChList.length
      ? await HistoryBookXe.find({ ma_ch: { $in: maChList } })
          .sort({ createdAt: -1 })
          .lean()
      : [];
    const allGroupedDocs = await BookXe.find(
      { ma_ch: { $exists: true, $ne: "" } },
      { ma_ch: 1, _id: 0 },
    ).lean();

    const pairMap = new Map(); // ma_ch (normalized) -> Set các ma_ch từng ghép chung
    allGroupedDocs.forEach((doc) => {
      const maChList = (doc.ma_ch || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (maChList.length < 2) return; // chuyến chỉ có 1 CH thì bỏ qua

      maChList.forEach((maCh) => {
        const key = normalizeMaCh(maCh);
        if (!key) return;
        if (!pairMap.has(key)) pairMap.set(key, new Set());
        maChList.forEach((other) => {
          if (other === maCh) return;
          pairMap.get(key).add(other);
        });
      });
    });

    const getTungGhepChung = (maCh) =>
      Array.from(pairMap.get(normalizeMaCh(maCh)) || []);
    const ncvGoiYMap = new Map();
    const lddMap = new Map();
    historyDocs.forEach((h) => {
      if (!ncvGoiYMap.has(h.ma_ch) && (h.ma_ncv || h.ten_nvc)) {
        ncvGoiYMap.set(h.ma_ch, { ma_ncv: h.ma_ncv, ten_nvc: h.ten_nvc });
      }
      if (!lddMap.has(h.ma_ch)) lddMap.set(h.ma_ch, new Set());
      if (h.lenh_dieu_dong) lddMap.get(h.ma_ch).add(h.lenh_dieu_dong);
    });

    const kienMoiItems = groupKeys.map((groupKey) => {
      const g = groupMap.get(groupKey);
      const maCh = g.ma_ch;
      const loaiCuaHang = g.soDonHangMau
        .toString()
        .toUpperCase()
        .startsWith("TO")
        ? "CF"
        : "CS";
      const ncv = ncvGoiYMap.get(maCh) || {};
      const quan = quanMap.get(normalizeMaCh(maCh)) || "";
      const lich_di_hang_bookxe = lichBookXeMap.get(normalizeMaCh(maCh)) || ""; // 👈 thêm
      const trangThaiSoan = g.coDangSoan
        ? "Đang soạn"
        : g.coChuaSoan
          ? "Chưa soạn"
          : "Hoàn thành";
      return {
        nguon: "kien_moi",
        sourceId: groupKey,
        ma_ch: maCh,
        ten_ch: g.ten_ch,
        kien: g.kien,
        quan,
        ma_ncv: ncv.ma_ncv || "",
        ten_nvc: ncv.ten_nvc || "",
        lich_di_hang: g.lich_di_hang,
        lich_di_hang_bookxe, // 👈 thêm
        chuyen: g.chuyen,
        loaiCuaHang,
        trangThaiSoan,
        lenhDieuDongLienQuan: Array.from(lddMap.get(maCh) || []),
        coGiaoKhach: g.coGiaoKhach,
        ngayGiaoKhach: g.coGiaoKhach ? g.ngayPhatSinh : null,
        nhanSuSoanIds: g.nhanSuSoanIds,
        rotKienIds: [],
        tungGhepChungVoi: getTungGhepChung(maCh),
      };
    });

      const kienRotItems = rotKienDocs.map((r) => {
      const maCh = (r.maCH || "").toString();
      const ncv = ncvGoiYMap.get(maCh) || {};
      const quan = quanMap.get(normalizeMaCh(maCh)) || "";
      const lich_di_hang_bookxe = lichBookXeMap.get(normalizeMaCh(maCh)) || ""; // 👈 thêm
      return {
        nguon: "kien_rot",
        sourceId: r._id.toString(),
        ma_ch: maCh,
        ten_ch: r.tenCH || maCh,
        kien: Number(r.soKienRot ?? 0),
        quan,
        ma_ncv: ncv.ma_ncv || "",
        ten_nvc: ncv.ten_nvc || "",
        lich_di_hang: "",
        lich_di_hang_bookxe, // 👈 thêm
        loaiCuaHang: "",
        trangThaiSoan: "",
        lenhDieuDongLienQuan: Array.from(lddMap.get(maCh) || []),
        coGiaoKhach: false,
        ngayGiaoKhach: null,
        ngayRotKien: toYMD(r.ngayRotKien),
        ghiChuRotKien: r.ghiChu || "",
        nhanSuSoanIds: [],
        rotKienIds: [r._id.toString()],
        tungGhepChungVoi: getTungGhepChung(maCh),
      };
    });

    return res
      .status(200)
      .json({ success: true, data: [...kienMoiItems, ...kienRotItems] });
  } catch (error) {
    console.error("suggestBookXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi lấy gợi ý ghép chuyến",
      error: error.message,
    });
  }
};
module.exports = {
  getAllBookXe,
  getBookXeById,
  createBookXe,
  updateBookXe,
  updateTrangThai,
  deleteBookXe,
  deleteManyBookXe,
  suggestBookXe,
};
