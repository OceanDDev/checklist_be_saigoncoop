const BookXe = require("../../models/bookxe/bookxe");
const NhanSuSoan = require("../../models/phieusoan/nhansusoan");
const HistoryBookXe = require("../../models/bookxe/historybookxe");
const DataCH = require("../../models/phieusoan/dataCH");

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
      ma_ncv,
      trangThai,
      tu_ngay,
      den_ngay,
      tu_ngay_tao,
      den_ngay_tao,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    if (quan) filter.quan = quan;
    if (ma_ch) filter.ma_ch = ma_ch;
    if (ma_ncv) filter.ma_ncv = ma_ncv;
    if (trangThai) filter.trangThai = trangThai;

    // Lọc theo Ngày Xuất (thoi_gian_xuat)
    if (tu_ngay || den_ngay) {
      filter.thoi_gian_xuat = {};
      if (tu_ngay) filter.thoi_gian_xuat.$gte = startOfDayVN(tu_ngay);
      if (den_ngay) filter.thoi_gian_xuat.$lte = endOfDayVN(den_ngay);
    }

    // Lọc theo Ngày Tạo (thoi_gian_tao) — khớp bộ lọc "Ngày tạo" ở FE
    if (tu_ngay_tao || den_ngay_tao) {
      filter.thoi_gian_tao = {};
      if (tu_ngay_tao) filter.thoi_gian_tao.$gte = startOfDayVN(tu_ngay_tao);
      if (den_ngay_tao) filter.thoi_gian_tao.$lte = endOfDayVN(den_ngay_tao);
    }

    if (search) {
      filter.$or = [
        { ten_ch: { $regex: search, $options: "i" } },
        { ten_nvc: { $regex: search, $options: "i" } },
        { ma_ch: { $regex: search, $options: "i" } },
      ];
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

// POST /api/book-xe
const createBookXe = async (req, res) => {
  try {
    const { nhan_su_soan_ids, ...payload } = req.body;

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
      trangThai: "Chưa Book",
      ...payload,
      thoi_gian_tao: new Date(),
    });

    await newItem.save();

    // Đánh dấu các phiếu NhanSuSoan tương ứng đã chuyển sang "Chờ Xe" (khớp
    // đúng enum TRANG_THAI_BOOK_XE_OPTIONS bên NhanSuSoanTable). Nhờ vậy
    // suggestBookXe (đang lọc trangThaiBookXe: "Chờ Book") sẽ tự động loại
    // các cửa hàng này khỏi danh sách gợi ý ở modal "Thêm Chuyến".
    if (Array.isArray(nhan_su_soan_ids) && nhan_su_soan_ids.length) {
      await NhanSuSoan.updateMany(
        { _id: { $in: nhan_su_soan_ids } },
        { $set: { trangThaiBookXe: "Chờ Xe" } },
      );
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

    const updated = await BookXe.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu book xe" });
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
    const deleted = await BookXe.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu book xe" });
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

    const result = await BookXe.deleteMany({ _id: { $in: ids } });

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
// Lấy TẤT CẢ cửa hàng đang "Chờ Book" (không lọc theo ngày nữa, tránh sót
// các phiếu phát sinh từ trước), chỉ giữ điều kiện trạng thái phiếu là
// "Đang soạn" hoặc "Hoàn thành".
const suggestBookXe = async (req, res) => {
  try {
    const phieuTrongNgay = await NhanSuSoan.find({
      trangThaiBookXe: "Chờ Book",
      trangThai: { $in: ["Hoàn thành", "Đang soạn"] },
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
          coDangSoan: false,
          coGiaoKhach: isGiaoKhach,
          // Ngày thực tế phát sinh phiếu — ưu tiên ngày hoàn thành, fallback
          // ngày nhận phiếu (dùng để hiển thị "Giao khách — ngày ..." vì
          // không còn ngày filter từ FE nữa).
          ngayPhatSinh: toYMD(p.tgHoanThanh || p.tgNhanPhieu),
          // Lưu lại _id của từng phiếu NhanSuSoan gộp vào nhóm này, để FE
          // gửi ngược lên khi tạo BookXe -> đánh dấu "Đã Book".
          nhanSuSoanIds: [],
        });
      }
      const g = groupMap.get(groupKey);
      const soKien =
        p.trangThai === "Đang soạn"
          ? Number(p.kien_du_kien ?? 0)
          : Number(p.kien ?? 0);
      g.kien += soKien;
      g.nhanSuSoanIds.push(p._id.toString());
      if (p.trangThai === "Đang soạn") g.coDangSoan = true;
    });

    const groupKeys = Array.from(groupMap.keys());
    const maChList = Array.from(
      new Set(groupKeys.map((k) => groupMap.get(k).ma_ch)),
    );

    const maChNormalizedList = maChList.map(normalizeMaCh).filter(Boolean);
    const dataCHDocs = maChNormalizedList.length
      ? await DataCH.find(
          { mach: { $in: maChNormalizedList } },
          { mach: 1, quan: 1, _id: 0 },
        ).lean()
      : [];
    const quanMap = new Map();
    dataCHDocs.forEach((d) => {
      const key = normalizeMaCh(d.mach);
      if (key) quanMap.set(key, d.quan || "");
    });

    const historyDocs = maChList.length
      ? await HistoryBookXe.find({ ma_ch: { $in: maChList } })
          .sort({ createdAt: -1 })
          .lean()
      : [];

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
        loaiCuaHang,
        trangThaiSoan: g.coDangSoan ? "Đang soạn" : "Hoàn thành",
        lenhDieuDongLienQuan: Array.from(lddMap.get(maCh) || []),
        coGiaoKhach: g.coGiaoKhach,
        ngayGiaoKhach: g.coGiaoKhach ? g.ngayPhatSinh : null,
        nhanSuSoanIds: g.nhanSuSoanIds,
      };
    });

    const bookXeRotDocs = await BookXe.find({
      trangThai: "Có kiện rớt",
    }).lean();
    const kienRotItems = bookXeRotDocs.map((b) => ({
      nguon: "kien_rot",
      sourceId: b._id.toString(),
      ma_ch: b.ma_ch,
      ten_ch: b.ten_ch,
      kien: b.kien_rot || 0,
      quan: b.quan || "",
      ma_ncv: b.ma_ncv || "",
      ten_nvc: b.ten_nvc || "",
      lich_di_hang: b.lich_di_hang || "",
      loaiCuaHang: "",
      lenhDieuDongLienQuan: [],
      coGiaoKhach: b.co_giao_khach || false,
      ngayGiaoKhach: b.ngay_giao_khach || null,
      nhanSuSoanIds: [], // kiện rớt không gắn với NhanSuSoan
    }));

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
