// controllers/chamcong/chamcong.controller.js
const ChamCong = require("../../models/chamcong/chamcong");
const NhanVien = require("../../models/chamcong/nhanvien");

const COMPANY_LOCATION = {
  latitude: 10.890972,
  longitude: 106.748611,
  RADIUS_METERS: 200,
};

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

// ─── Middleware: Kiểm tra nhân viên ─────────────────────────────────────────
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
      return res.status(403).json({
        message: "Tài khoản nhân viên đã bị khóa, không thể chấm công",
      });
    }
    req.nhanVien = nhanVien;
    next();
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Middleware: Kiểm tra GPS ────────────────────────────────────────────────
const kiemTraGPS = (req, res, next) => {
  const { latitude, longitude, gps_timestamp } = req.body;

  if (!latitude || !longitude || !gps_timestamp) {
    return res.status(400).json({ message: "Thiếu thông tin GPS" });
  }

  const diff = Math.abs(Date.now() - Number(gps_timestamp));
  if (diff > 60_000) {
    return res
      .status(400)
      .json({ message: "Yêu cầu đã hết hạn. Vui lòng thử lại." });
  }

  const distance = tinhKhoangCach(
    latitude,
    longitude,
    COMPANY_LOCATION.latitude,
    COMPANY_LOCATION.longitude,
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

// ─── Middleware: Kiểm tra Device ID ─────────────────────────────────────────
//
//  Luồng hoạt động:
//    1. FE dùng FingerprintJS tạo device_id TRƯỚC khi gọi API
//    2. FE gửi device_id lên cùng với request check-in
//    3. Middleware này kiểm tra: hôm nay device_id này đã chấm cho ai chưa?
//       - Nếu device_id đã chấm cho người KHÁC → BLOCK (chấm hộ)
//       - Nếu device_id đã chấm cho CHÍNH người này → cho qua (checkout)
//       - Nếu chưa có → cho qua
//
const kiemTraDeviceId = async (req, res, next) => {
  try {
    const { device_id, ma_nhan_vien } = req.body;

    // Nếu FE không gửi device_id thì bỏ qua (backward compatible)
    // Bạn có thể đổi thành return 400 nếu muốn bắt buộc
    if (!device_id) {
      return next();
    }

    const now = new Date();
    const ngayHomNay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // Tìm xem hôm nay device_id này đã được dùng để check-in chưa
    const recordCungDevice = await ChamCong.findOne({
      device_id,
      ngay: ngayHomNay,
    });

    if (recordCungDevice) {
      const maNormalized = (ma_nhan_vien || "").toUpperCase();
      if (recordCungDevice.ma_nhan_vien !== maNormalized) {
        // ❌ Khác người → BLOCK + ghi vi phạm vào record của người bị chấm hộ
        await ChamCong.findByIdAndUpdate(recordCungDevice._id, {
          vi_pham_cham_ho: true,
          vi_pham_device_id: device_id,
          vi_pham_thoi_gian: now,
          $inc: { vi_pham_so_lan: 1 },
        });

        return res.status(403).json({
          message: `Thiết bị này đã được dùng để chấm công cho nhân viên khác hôm nay (${recordCungDevice.ma_nhan_vien}). Không thể chấm hộ.`,
          blocked_by: "device_id",
        });
      }
      // ✅ Cùng người → cho qua (checkout bình thường)
    }

    // Gắn device_id vào req để controller dùng khi lưu DB
    req.deviceId = device_id;
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
      // ─── CHECK-IN ────────────────────────────────────────────────────────
      chamCongHomNay = await ChamCong.create({
        ten_nhan_vien,
        ma_nhan_vien,
        bo_phan,
        ngay: ngayHomNay,
        gio_vao: now,
        vi_tri_vao: { latitude, longitude, distance: req.gpsDistance },
        device_id: req.deviceId || "", // ← Lưu device_id khi check-in
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
      // ─── CHECK-OUT ───────────────────────────────────────────────────────
      const tongGio = (now - chamCongHomNay.gio_vao) / (1000 * 60 * 60);
      chamCongHomNay.gio_ra = now;
      chamCongHomNay.tong_gio = parseFloat(tongGio.toFixed(2));
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

// ─── Trạng thái hôm nay ──────────────────────────────────────────────────────
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

// ─── Danh sách / Chi tiết / CRUD ─────────────────────────────────────────────
// controllers/chamcong/chamcong.controller.js
const getDanhSach = async (req, res) => {
  try {
    const { ngay, bo_phan, ma_nhan_vien, tu_ngay, den_ngay } = req.query;
    const filter = {};

    if (ngay) {
      filter.ngay = new Date(ngay);
    } else if (tu_ngay || den_ngay) {
      filter.ngay = {};
      if (tu_ngay) filter.ngay.$gte = new Date(tu_ngay);
      if (den_ngay) {
        // include cả ngày cuối (đến hết 23:59:59)
        const end = new Date(den_ngay);
        end.setHours(23, 59, 59, 999);
        filter.ngay.$lte = end;
      }
    }

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
const adminAddChamCong = async (req, res) => {
  try {
    const { ma_nhan_vien, ngay, gio_vao, gio_ra, ghi_chu } = req.body;

    if (!ma_nhan_vien || !ngay || !gio_vao) {
      return res
        .status(400)
        .json({ message: "Thiếu thông tin bắt buộc: mã NV, ngày, giờ vào" });
    }

    // Lấy thông tin nhân viên
    const nhanVien = await NhanVien.findOne({
      ma_nhan_vien: ma_nhan_vien.toUpperCase(),
    });
    if (!nhanVien) {
      return res
        .status(404)
        .json({ message: "Mã nhân viên không tồn tại trong hệ thống" });
    }

    const ngayDate = new Date(ngay);
    ngayDate.setHours(0, 0, 0, 0);

    // Kiểm tra đã tồn tại chưa
    const exists = await ChamCong.findOne({
      ma_nhan_vien: nhanVien.ma_nhan_vien,
      ngay: ngayDate,
    });
    if (exists) {
      return res.status(409).json({
        message: `Nhân viên ${nhanVien.ma_nhan_vien} đã có bản ghi chấm công ngày ${ngayDate.toLocaleDateString("vi-VN")}`,
      });
    }

    const gioVaoDate = new Date(`${ngay}T${gio_vao}:00`);
    let gioRaDate = null;
    let tongGio = null;

    if (gio_ra) {
      gioRaDate = new Date(`${ngay}T${gio_ra}:00`);
      if (gioRaDate <= gioVaoDate) {
        return res.status(400).json({ message: "Giờ ra phải sau giờ vào" });
      }
      tongGio = parseFloat(((gioRaDate - gioVaoDate) / 3_600_000).toFixed(2));
    }

    const record = await ChamCong.create({
      ma_nhan_vien: nhanVien.ma_nhan_vien,
      ten_nhan_vien: nhanVien.ten_nhan_vien,
      bo_phan: nhanVien.bo_phan,
      ngay: ngayDate,
      gio_vao: gioVaoDate,
      gio_ra: gioRaDate,
      tong_gio: tongGio,
      ghi_chu: ghi_chu || "",
      device_id: "ADMIN",
    });

    return res.status(201).json({ message: "Thêm thành công", data: record });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Admin: Sửa bản ghi chấm công ────────────────────────────────────────────
const adminEditChamCong = async (req, res) => {
  try {
    const { id } = req.params;
    const { ngay, gio_vao, gio_ra, ghi_chu, ma_nhan_vien } = req.body;

    const record = await ChamCong.findById(id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    }

    // Nếu đổi mã NV thì verify
    if (ma_nhan_vien && ma_nhan_vien.toUpperCase() !== record.ma_nhan_vien) {
      const nhanVien = await NhanVien.findOne({
        ma_nhan_vien: ma_nhan_vien.toUpperCase(),
      });
      if (!nhanVien) {
        return res.status(404).json({ message: "Mã nhân viên không tồn tại" });
      }
      record.ma_nhan_vien = nhanVien.ma_nhan_vien;
      record.ten_nhan_vien = nhanVien.ten_nhan_vien;
      record.bo_phan = nhanVien.bo_phan;
    }

    const ngayStr = ngay || record.ngay.toISOString().slice(0, 10);

    if (gio_vao) {
      record.gio_vao = new Date(`${ngayStr}T${gio_vao}:00`);
    }
    if (gio_ra !== undefined) {
      if (gio_ra === "" || gio_ra === null) {
        record.gio_ra = null;
        record.tong_gio = null;
      } else {
        const gioRaDate = new Date(`${ngayStr}T${gio_ra}:00`);
        if (gioRaDate <= record.gio_vao) {
          return res.status(400).json({ message: "Giờ ra phải sau giờ vào" });
        }
        record.gio_ra = gioRaDate;
        record.tong_gio = parseFloat(
          ((gioRaDate - record.gio_vao) / 3_600_000).toFixed(2),
        );
      }
    }
    if (ngay) {
      const ngayDate = new Date(ngay);
      ngayDate.setHours(0, 0, 0, 0);
      record.ngay = ngayDate;
    }
    if (ghi_chu !== undefined) record.ghi_chu = ghi_chu;

    await record.save();
    return res
      .status(200)
      .json({ message: "Cập nhật thành công", data: record });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const importNangSuat = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: "Thiếu dữ liệu" });
    }

    const ketQua = {
      cap_nhat_thanh_cong: [],
      khong_di_lam: [],
    };

    for (const item of data) {
      const ma = (item.id || "").toUpperCase().trim();
      if (!ma || !item.ngay_nang_suat) continue;

      const ngayDate = new Date(item.ngay_nang_suat);
      ngayDate.setHours(0, 0, 0, 0);
      const ngayEnd = new Date(ngayDate);
      ngayEnd.setHours(23, 59, 59, 999);

      const record = await ChamCong.findOne({
        ma_nhan_vien: ma,
        ngay: { $gte: ngayDate, $lte: ngayEnd },
      });

      if (!record) {
        ketQua.khong_di_lam.push({
          ma_nhan_vien: ma,
          ngay_nang_suat: item.ngay_nang_suat,
          so_phieu: item.phieu,
          so_kien: item.kien,
          so_dong: item.dong,
        });
        continue;
      }

      record.ngay_nang_suat = ngayDate;
      record.so_phieu = item.phieu ?? record.so_phieu;
      record.so_kien = item.kien ?? record.so_kien;
      record.so_dong = item.dong ?? record.so_dong;
      await record.save();

      ketQua.cap_nhat_thanh_cong.push(ma);
    }

    return res.status(200).json({
      message: "Import hoàn tất",
      tong_import: data.length,
      thanh_cong: ketQua.cap_nhat_thanh_cong.length,
      khong_di_lam_so: ketQua.khong_di_lam.length,
      cap_nhat_thanh_cong: ketQua.cap_nhat_thanh_cong,
      khong_di_lam: ketQua.khong_di_lam,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  chamCong,
  getDanhSach,
  getChiTiet,
  updateGhiChu,
  xoaChamCong,
  deleteManyChamCong,
  kiemTraGPS,
  kiemTraNhanVien,
  kiemTraDeviceId, // ← export mới
  trangThaiHomNay,
  adminAddChamCong,
  adminEditChamCong,
  importNangSuat,
};
