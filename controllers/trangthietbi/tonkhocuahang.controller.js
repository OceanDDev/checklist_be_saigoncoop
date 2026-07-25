const TonKhoCuaHang = require("../../models/trangthietbi/tonkhocuahang"); // chỉnh lại path cho đúng
const TrangThietBi = require("../../models/trangthietbi/trangthietbi"); // chỉnh lại path cho đúng

// Lùi 1 kỳ (VD "2026-06" -> "2026-05")
const kyTruoc = (ky) => {
  const [nam, thang] = ky.split("-").map(Number);
  const d = new Date(Date.UTC(nam, thang - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// [GET] Lấy bảng tồn kho theo cửa hàng (filter theo ky / ma_ch / loai_ttb)
// Đây là API trả về đúng dạng bảng như file Excel "TỔNG HỢP TRANG THIẾT BỊ CÁC CỬA HÀNG"
const getBangTonKho = async (req, res) => {
  try {
    const { ky, ma_ch, loai_ttb } = req.query;

    if (!ky) {
      return res
        .status(400)
        .json({ success: false, message: "Cần truyền ky (VD: 2026-06)" });
    }

    const filter = { ky };
    if (ma_ch) filter.ma_ch = ma_ch;
    if (loai_ttb) filter.loai_ttb = loai_ttb;

    const data = await TonKhoCuaHang.find(filter).sort({ ma_ch: 1, loai_ttb: 1 });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [GET] Lấy 1 record tồn kho theo id
const getByIdTonKho = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await TonKhoCuaHang.findById(id);

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dữ liệu tồn kho" });
    }

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [POST] Chốt kỳ: tự động aggregate từ TrangThietBi (theo ky) group theo (ma_ch, loai_ttb),
// lấy ton_cuoi_ky của kỳ trước làm ton_dau_ky, tính ton_cuoi_ky mới, rồi upsert vào TonKhoCuaHang.
// Body: { ky: "2026-06" }
const chotKyTheoCuaHang = async (req, res) => {
  try {
    const { ky } = req.body;

    if (!ky || !/^\d{4}-\d{2}$/.test(ky)) {
      return res.status(400).json({
        success: false,
        message: "Cần truyền ky hợp lệ dạng YYYY-MM (VD: 2026-06)",
      });
    }

    // 1. Gom số liệu giao/trả trong kỳ, group theo cửa hàng + loại TTB
    const aggregated = await TrangThietBi.aggregate([
      { $match: { ky, ma_ch: { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: { ma_ch: "$ma_ch", loai_ttb: "$loai_ttb" },
          ten_ch: { $first: "$ten_ch" },
          tong_giao: { $sum: "$ttb_giao" },
          tong_tra: { $sum: "$ttb_sieu_thi_tra" },
        },
      },
    ]);

    if (aggregated.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Không có dữ liệu giao/trả nào trong kỳ ${ky} để chốt`,
      });
    }

    // 2. Lấy tồn cuối kỳ trước (làm tồn đầu kỳ này) cho tất cả cặp (ma_ch, loai_ttb) liên quan
    const kyTruocDo = kyTruoc(ky);
    const tonKyTruoc = await TonKhoCuaHang.find({ ky: kyTruocDo });

    const tonKyTruocMap = new Map(
      tonKyTruoc.map((t) => [`${t.ma_ch}|${t.loai_ttb}`, t.ton_cuoi_ky || 0]),
    );

    // 3. Build bulk upsert cho kỳ hiện tại
    const bulkOps = aggregated.map((g) => {
      const ma_ch = g._id.ma_ch;
      const loai_ttb = g._id.loai_ttb;
      const key = `${ma_ch}|${loai_ttb}`;
      const ton_dau_ky = tonKyTruocMap.get(key) || 0;
      const ton_cuoi_ky = ton_dau_ky + g.tong_giao - g.tong_tra;

      return {
        updateOne: {
          filter: { ma_ch, loai_ttb, ky },
          update: {
            $set: {
              ten_ch: g.ten_ch,
              ton_dau_ky,
              tong_giao: g.tong_giao,
              tong_tra: g.tong_tra,
              ton_cuoi_ky,
            },
          },
          upsert: true,
        },
      };
    });

    const result = await TonKhoCuaHang.bulkWrite(bulkOps, { ordered: false });

    return res.status(200).json({
      success: true,
      message: `Đã chốt kỳ ${ky} cho ${bulkOps.length} cặp cửa hàng/loại TTB`,
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [PUT] Sửa tay 1 record tồn kho (VD: chỉnh ton_dau_ky ban đầu khi mới bắt đầu theo dõi)
const updateTonKho = async (req, res) => {
  try {
    const { id } = req.params;
    const { ton_dau_ky, tong_giao, tong_tra } = req.body;

    const item = await TonKhoCuaHang.findById(id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dữ liệu tồn kho" });
    }

    if (ton_dau_ky !== undefined) item.ton_dau_ky = Number(ton_dau_ky);
    if (tong_giao !== undefined) item.tong_giao = Number(tong_giao);
    if (tong_tra !== undefined) item.tong_tra = Number(tong_tra);

    // Luôn tính lại tồn cuối kỳ theo công thức, không cho sửa tay trực tiếp
    item.ton_cuoi_ky = item.ton_dau_ky + item.tong_giao - item.tong_tra;

    await item.save();

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// [DELETE] Xóa 1 record tồn kho (dùng khi chốt nhầm kỳ)
const deleteTonKho = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await TonKhoCuaHang.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dữ liệu tồn kho" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Xóa thành công", data: deleted });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBangTonKho,
  getByIdTonKho,
  chotKyTheoCuaHang,
  updateTonKho,
  deleteTonKho,
};