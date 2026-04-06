// controllers/chamcong/chamcong.controller.js
const ChamCong = require("../../models/chamcong/chamcong");
const NhanVien = require("../../models/chamcong/nhanvien");

function getNgayHomNayVN() {
  const now = new Date();
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate()),
  );
}

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
const kiemTraDeviceId = async (req, res, next) => {
  try {
    const { device_id, ma_nhan_vien } = req.body;

    if (!device_id) {
      return next();
    }

    const ngayHomNay = getNgayHomNayVN();
    const now = new Date();
    const recordCungDevice = await ChamCong.findOne({
      device_id,
      ngay: ngayHomNay,
    });

    if (recordCungDevice) {
      const maNormalized = (ma_nhan_vien || "").toUpperCase();
      if (recordCungDevice.ma_nhan_vien !== maNormalized) {
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
    }

    req.deviceId = device_id;
    next();
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Chấm công vào/ra ────────────────────────────────────────────────────────
const chamCong = async (req, res) => {
  try {
    const { ma_nhan_vien, ten_nhan_vien, bo_phan, chuc_vu } = req.nhanVien;
    const { action, latitude, longitude } = req.body;
    const now = new Date();
    const ngayHomNay = getNgayHomNayVN();

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
        chuc_vu,
        ngay: ngayHomNay,
        gio_vao: now,
        vi_tri_vao: { latitude, longitude, distance: req.gpsDistance },
        device_id: req.deviceId || "",
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
    const ngayHomNay = getNgayHomNayVN();
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

// ─── Danh sách ───────────────────────────────────────────────────────────────
const getDanhSach = async (req, res) => {
  try {
    const { ngay, bo_phan, ma_nhan_vien, tu_ngay, den_ngay } = req.query;
    const filter = {};

    if (ngay) {
      filter.ngay = new Date(ngay);
    } else if (tu_ngay || den_ngay) {
      filter.ngay = {};
      if (tu_ngay) filter.ngay.$gte = new Date(`${tu_ngay}T00:00:00+07:00`);
      if (den_ngay) filter.ngay.$lte = new Date(`${den_ngay}T23:59:59+07:00`);
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

// ─── Admin: Thêm bản ghi chấm công ──────────────────────────────────────────
const adminAddChamCong = async (req, res) => {
  try {
    const {
      ma_nhan_vien,
      ngay,
      gio_vao,
      gio_ra,
      gio_vao_phu,
      gio_ra_phu,
      ghi_chu,
    } = req.body;

    if (!ma_nhan_vien || !ngay || !gio_vao) {
      return res
        .status(400)
        .json({ message: "Thiếu thông tin bắt buộc: mã NV, ngày, giờ vào" });
    }

    const nhanVien = await NhanVien.findOne({
      ma_nhan_vien: ma_nhan_vien.toUpperCase(),
    });
    if (!nhanVien) {
      return res
        .status(404)
        .json({ message: "Mã nhân viên không tồn tại trong hệ thống" });
    }

    const ngayDate = new Date(`${ngay}T00:00:00+07:00`); // ✅ timezone VN

    const exists = await ChamCong.findOne({
      ma_nhan_vien: nhanVien.ma_nhan_vien,
      ngay: ngayDate,
    });
    if (exists) {
      return res.status(409).json({
        message: `Nhân viên ${nhanVien.ma_nhan_vien} đã có bản ghi chấm công ngày ${ngayDate.toLocaleDateString("vi-VN")}`,
      });
    }

    // ─── Ca chính ───────────────────────────────────────────────────────────
    const gioVaoDate = new Date(`${ngay}T${gio_vao}:00+07:00`);
    let gioRaDate = null;
    let tongGio = null;

    if (gio_ra) {
      gioRaDate = new Date(`${ngay}T${gio_ra}:00+07:00`);
      if (gioRaDate <= gioVaoDate) {
        return res.status(400).json({ message: "Giờ ra phải sau giờ vào" });
      }
      tongGio = parseFloat(((gioRaDate - gioVaoDate) / 3_600_000).toFixed(2));
    }

    // ─── Ca phụ ─────────────────────────────────────────────────────────────
    let gioVaoPhuDate = null;
    let gioRaPhuDate = null;
    let tongGioPhu = null;

    if (gio_vao_phu) {
      gioVaoPhuDate = new Date(`${ngay}T${gio_vao_phu}:00+07:00`);
    }
    if (gio_ra_phu && gioVaoPhuDate) {
      gioRaPhuDate = new Date(`${ngay}T${gio_ra_phu}:00+07:00`);
      if (gioRaPhuDate <= gioVaoPhuDate) {
        return res
          .status(400)
          .json({ message: "Giờ ra phụ phải sau giờ vào phụ" });
      }
      tongGioPhu = parseFloat(
        ((gioRaPhuDate - gioVaoPhuDate) / 3_600_000).toFixed(2),
      );
    }

    const record = await ChamCong.create({
      ma_nhan_vien: nhanVien.ma_nhan_vien,
      ten_nhan_vien: nhanVien.ten_nhan_vien,
      bo_phan: nhanVien.bo_phan,
      chuc_vu: nhanVien.chuc_vu,
      ngay: ngayDate,
      gio_vao: gioVaoDate,
      gio_ra: gioRaDate,
      tong_gio: tongGio,
      gio_vao_phu: gioVaoPhuDate,
      gio_ra_phu: gioRaPhuDate,
      tong_gio_phu: tongGioPhu,
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
    const {
      ngay,
      gio_vao,
      gio_ra,
      gio_vao_phu,
      gio_ra_phu,
      ghi_chu,
      ma_nhan_vien,
    } = req.body;

    const record = await ChamCong.findById(id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    }

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
      record.chuc_vu = nhanVien.chuc_vu; // 👈 thêm
    }

    // ✅ Lấy ngayStr chuẩn VN để build DateTime
    const ngayStr = ngay
      ? ngay
      : (() => {
          const d = new Date(record.ngay.getTime() + 7 * 60 * 60 * 1000);
          return d.toISOString().slice(0, 10);
        })();

    // ─── Ca chính ───────────────────────────────────────────────────────────
    if (gio_vao) {
      record.gio_vao = new Date(`${ngayStr}T${gio_vao}:00+07:00`);
    }

    if (gio_ra !== undefined) {
      if (gio_ra === "" || gio_ra === null) {
        record.gio_ra = null;
        record.tong_gio = null;
      } else {
        const gioRaDate = new Date(`${ngayStr}T${gio_ra}:00+07:00`);
        if (gioRaDate <= record.gio_vao) {
          return res.status(400).json({ message: "Giờ ra phải sau giờ vào" });
        }
        record.gio_ra = gioRaDate;
        record.tong_gio = parseFloat(
          ((gioRaDate - record.gio_vao) / 3_600_000).toFixed(2),
        );
      }
    }

    // ─── Ca phụ ─────────────────────────────────────────────────────────────
    if (gio_vao_phu !== undefined) {
      record.gio_vao_phu = gio_vao_phu
        ? new Date(`${ngayStr}T${gio_vao_phu}:00+07:00`)
        : null;
      // Reset ca phụ nếu xóa giờ vào phụ
      if (!gio_vao_phu) {
        record.gio_ra_phu = null;
        record.tong_gio_phu = null;
      }
    }

    if (gio_ra_phu !== undefined) {
      if (gio_ra_phu === "" || gio_ra_phu === null) {
        record.gio_ra_phu = null;
        record.tong_gio_phu = null;
      } else {
        const gioRaPhuDate = new Date(`${ngayStr}T${gio_ra_phu}:00+07:00`);
        if (record.gio_vao_phu && gioRaPhuDate <= record.gio_vao_phu) {
          return res
            .status(400)
            .json({ message: "Giờ ra phụ phải sau giờ vào phụ" });
        }
        record.gio_ra_phu = gioRaPhuDate;
        record.tong_gio_phu = record.gio_vao_phu
          ? parseFloat(
              ((gioRaPhuDate - record.gio_vao_phu) / 3_600_000).toFixed(2),
            )
          : null;
      }
    }

    // ─── Ngày & Ghi chú ─────────────────────────────────────────────────────
    if (ngay) {
      record.ngay = new Date(`${ngay}T00:00:00+07:00`);
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

// ─── Import năng suất ────────────────────────────────────────────────────────
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

      // ✅ Parse đúng timezone VN — ngay_nang_suat phải là "YYYY-MM-DD"
      const ngayDate = new Date(`${item.ngay_nang_suat}T00:00:00+07:00`);
      const ngayEnd = new Date(`${item.ngay_nang_suat}T23:59:59+07:00`);

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
const toggleKhoa = async (req, res) => {
  try {
    const record = await ChamCong.findById(req.params.id);
    if (!record)
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });

    const { ly_do_khoa } = req.body;
    record.is_locked = !record.is_locked;
    // Khi mở khóa thì xóa lý do
    record.ly_do_khoa = record.is_locked ? ly_do_khoa || "" : "";
    await record.save();
    return res.status(200).json({
      message: record.is_locked ? "Đã khóa" : "Đã mở khóa",
      data: record,
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
  kiemTraDeviceId,
  trangThaiHomNay,
  adminAddChamCong,
  adminEditChamCong,
  importNangSuat,
  toggleKhoa,
};
