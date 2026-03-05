// controllers/chamcong/chamcong.controller.js
const ChamCong = require("../../models/chamcong/chamcong");
const NhanVien = require("../../models/chamcong/nhanvien");
const crypto = require("crypto");

const COMPANY_LOCATION = {
  latitude: 10.890972,
  longitude: 106.748611,
  RADIUS_METERS: 200,
};

// ─── Bí mật dùng để ký request — lưu trong .env ──────────────────────────────
const GPS_SECRET = process.env.GPS_SECRET || "doi_ten_bi_mat_nay_trong_env";

function tinhKhoangCach(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const φ1 = lat1 * rad,
    φ2 = lat2 * rad;
  const Δφ = (lat2 - lat1) * rad,
    Δλ = (lon2 - lon1) * rad;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}



const kiemTraNhanVien = async (req, res, next) => {
  try {
    const { ma_nhan_vien } = req.body;
    if (!ma_nhan_vien) {
      return res.status(400).json({ message: "Thiếu mã nhân viên" });
    }
    const nhanVien = await NhanVien.findOne({
      ma_nhan_vien: ma_nhan_vien.toUpperCase(),
    });
    if (!nhanVien) {
      return res
        .status(404)
        .json({ message: "Mã nhân viên không tồn tại trong hệ thống" });
    }
    if (!nhanVien.active) {
      return res
        .status(403)
        .json({
          message: "Tài khoản nhân viên đã bị khóa, không thể chấm công",
        });
    }
    req.nhanVien = nhanVien;
    next();
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Chấm công vào/ra ────────────────────────────────────────────────────────
const chamCong = async (req, res) => {
  try {
    const { ma_nhan_vien, ten_nhan_vien, bo_phan } = req.nhanVien;
    const { action, latitude, longitude } = req.body;

    const now = new Date();
    const ngayHomNay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    let chamCongHomNay = await ChamCong.findOne({
      ma_nhan_vien,
      ngay: ngayHomNay,
    });

    if (action === "checkout" && !chamCongHomNay) {
      return res.status(400).json({
        message:
          "Bạn chưa check-in hôm nay. Vui lòng check-in trước khi check-out.",
      });
    }

    if (!chamCongHomNay) {
      chamCongHomNay = await ChamCong.create({
        ten_nhan_vien,
        ma_nhan_vien,
        bo_phan,
        ngay: ngayHomNay,
        gio_vao: now,
        // Lưu lại tọa độ + khoảng cách để audit sau
        vi_tri_vao: { latitude, longitude, distance: req.gpsDistance },
      });
      return res.status(201).json({
        message: "✅ Chấm công vào thành công",
        ten_nhan_vien,
        data: chamCongHomNay,
      });
    }

    if (!chamCongHomNay.gio_ra) {
      if (action === "checkin") {
        return res.status(400).json({
          message: "Bạn đã check-in hôm nay rồi. Vui lòng chọn Check-Out.",
        });
      }
      const tongGio = (now - chamCongHomNay.gio_vao) / (1000 * 60 * 60);
      chamCongHomNay.gio_ra = now;
      chamCongHomNay.tong_gio = parseFloat(tongGio.toFixed(2));
      // Lưu lại tọa độ checkout để audit
      chamCongHomNay.vi_tri_ra = {
        latitude,
        longitude,
        distance: req.gpsDistance,
      };
      await chamCongHomNay.save();
      return res.status(200).json({
        message: "✅ Chấm công ra thành công",
        ten_nhan_vien,
        data: chamCongHomNay,
      });
    }

    return res
      .status(400)
      .json({ message: "Bạn đã chấm công đủ vào/ra hôm nay" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── API lấy GPS_SECRET để FE tạo chữ ký ─────────────────────────────────────


const trangThaiHomNay = async (req, res) => {
  try {
    const ma = (req.query.ma_nhan_vien || "").toUpperCase();
    if (!ma) return res.status(400).json({ message: "Thiếu mã nhân viên" });
    const now = new Date();
    const ngayHomNay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const record = await ChamCong.findOne({
      ma_nhan_vien: ma,
      ngay: ngayHomNay,
    });
    return res.status(200).json({
      ma_nhan_vien: ma,
      da_checkin: !!record,
      da_checkout: !!record?.gio_ra,
      gio_vao: record?.gio_vao ?? null,
      gio_ra: record?.gio_ra ?? null,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const getDanhSach = async (req, res) => {
  try {
    const { ngay, bo_phan, ma_nhan_vien } = req.query;
    const filter = {};
    if (ngay) filter.ngay = new Date(ngay);
    if (bo_phan) filter.bo_phan = bo_phan;
    if (ma_nhan_vien) filter.ma_nhan_vien = ma_nhan_vien;
    const danhSach = await ChamCong.find(filter).sort({
      ngay: -1,
      gio_vao: -1,
    });
    res.status(200).json({ total: danhSach.length, data: danhSach });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const getChiTiet = async (req, res) => {
  try {
    const record = await ChamCong.findById(req.params.id);
    if (!record)
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    res.status(200).json({ data: record });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const updateGhiChu = async (req, res) => {
  try {
    const record = await ChamCong.findByIdAndUpdate(
      req.params.id,
      { ghi_chu: req.body.ghi_chu },
      { new: true },
    );
    if (!record)
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    res.status(200).json({ message: "Cập nhật thành công", data: record });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const xoaChamCong = async (req, res) => {
  try {
    const record = await ChamCong.findByIdAndDelete(req.params.id);
    if (!record)
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    res.status(200).json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const deleteManyChamCong = async (req, res) => {
  try {
    const { ids } = req.body;
    await ChamCong.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
const kiemTraGPS = (req, res, next) => {
  const { latitude, longitude, gps_timestamp } = req.body;

  if (!latitude || !longitude || !gps_timestamp) {
    return res.status(400).json({ message: "Thiếu thông tin GPS" });
  }

  const diff = Math.abs(Date.now() - Number(gps_timestamp));
  if (diff > 60_000) {
    return res.status(400).json({ message: "Yêu cầu đã hết hạn. Vui lòng thử lại." });
  }

  const distance = tinhKhoangCach(
    latitude, longitude,
    COMPANY_LOCATION.latitude, COMPANY_LOCATION.longitude
  );
  if (distance > COMPANY_LOCATION.RADIUS_METERS) {
    return res.status(403).json({
      message: `Bạn đang ở ngoài khu vực công ty (${distance.toFixed(1)}m)`,
      allowed_radius: COMPANY_LOCATION.RADIUS_METERS,
      detected_distance: parseFloat(distance.toFixed(2)),
    });
  }

  req.gpsDistance = parseFloat(distance.toFixed(2));
  next();
};

module.exports = {
  chamCong,
  getDanhSach,
  getChiTiet,
  updateGhiChu,
  xoaChamCong,
  kiemTraGPS,
  deleteManyChamCong,
  kiemTraNhanVien,
  trangThaiHomNay,
};
