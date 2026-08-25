// controllers/phieusoan/ngungnangsuat.controller.js
const NgungNangSuat = require("../../models/phieusoan/ngungnangsuat");

// ─── Giờ VN — copy cùng pattern với nhansusoan.controller.js ─────────────────
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

// ─── Bắt đầu ngưng năng suất ──────────────────────────────────────────────────
const batDauNgungNangSuat = async (req, res) => {
  try {
    const dangMo = await NgungNangSuat.findOne({ ketThuc: null });
    if (dangMo) {
      return res.status(400).json({
        message:
          "Đang trong khoảng ngưng năng suất, vui lòng bật lại trước khi ngưng tiếp.",
        data: dangMo,
      });
    }
    const { nguoiThucHien, ghiChu } = req.body || {};
    const newDoc = await NgungNangSuat.create({
      batDau: new Date(),
      ketThuc: null,
      nguoiThucHien: nguoiThucHien || "",
      ghiChu: ghiChu || "",
    });
    res.status(201).json({ message: "Đã ngưng năng suất", data: newDoc });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Bật lại (kết thúc khoảng ngưng đang mở gần nhất) ────────────────────────
const ketThucNgungNangSuat = async (req, res) => {
  try {
    const dangMo = await NgungNangSuat.findOne({ ketThuc: null }).sort({
      batDau: -1,
    });
    if (!dangMo) {
      return res
        .status(400)
        .json({ message: "Không có khoảng ngưng năng suất nào đang mở." });
    }
    dangMo.ketThuc = new Date();
    await dangMo.save();
    res.status(200).json({ message: "Đã bật lại năng suất", data: dangMo });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Trạng thái hiện tại (đang ngưng hay không) ──────────────────────────────
const getDangNgungNangSuat = async (req, res) => {
  try {
    const dangMo = await NgungNangSuat.findOne({ ketThuc: null })
      .sort({ batDau: -1 })
      .lean();
    res.status(200).json({ data: dangMo || null });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Danh sách khoảng ngưng theo khoảng ngày (overlap với [tuNgay, denNgay]) ─
const getAllNgungNangSuat = async (req, res) => {
  try {
    const { tuNgay, denNgay } = req.query;
    const start = startOfDayVN(tuNgay);
    const end = endOfDayVN(denNgay);

    const filter = {};
    const cond = [];
    if (end) cond.push({ batDau: { $lte: end } });
    if (start) {
      cond.push({ $or: [{ ketThuc: null }, { ketThuc: { $gte: start } }] });
    }
    if (cond.length) filter.$and = cond;

    const data = await NgungNangSuat.find(filter).sort({ batDau: 1 }).lean();
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  batDauNgungNangSuat,
  ketThucNgungNangSuat,
  getDangNgungNangSuat,
  getAllNgungNangSuat,
};