// controllers/nhanvien/nhanvien.controller.js
const NhanVien = require("../../models/chamcong/nhanvien");

// ─── Thêm nhân viên ──────────────────────────────────────────────────────────────
const themNhanVien = async (req, res) => {
  try {
    const {
      ma_nhan_vien,
      ten_nhan_vien,
      bo_phan,
      chuc_vu,
      email,
      so_dien_thoai,
    } = req.body;

    if (!ma_nhan_vien || !ten_nhan_vien || !bo_phan) {
      return res
        .status(400)
        .json({ message: "Thiếu thông tin bắt buộc (mã, tên, bộ phận)" });
    }

    const existing = await NhanVien.findOne({
      ma_nhan_vien: ma_nhan_vien.toUpperCase(),
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: `Mã nhân viên ${ma_nhan_vien} đã tồn tại` });
    }

    const nhanVien = await NhanVien.create({
      ma_nhan_vien: ma_nhan_vien.toUpperCase(),
      ten_nhan_vien,
      bo_phan,
      chuc_vu,
      email,
      so_dien_thoai,
    });

    res
      .status(201)
      .json({ message: "Thêm nhân viên thành công", data: nhanVien });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Thêm nhiều nhân viên (import) ───────────────────────────────────────────────
const themNhieuNhanVien = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({ message: "Dữ liệu import phải là mảng và không được rỗng" });
    }

    const MAX_IMPORT = 500;
    if (data.length > MAX_IMPORT) {
      return res
        .status(400)
        .json({
          message: `Chỉ được import tối đa ${MAX_IMPORT} nhân viên mỗi lần`,
        });
    }

    const results = {
      success: [], // nhân viên được thêm thành công
      skipped: [], // bỏ qua vì mã đã tồn tại
      failed: [], // lỗi validate hoặc lỗi khác
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowIndex = i + 1; // hiển thị số dòng (bắt đầu từ 1)

      // Validate các trường bắt buộc
      const {
        ma_nhan_vien,
        ten_nhan_vien,
        bo_phan,
        chuc_vu,
        email,
        so_dien_thoai,
      } = row;

      if (!ma_nhan_vien || !ten_nhan_vien || !bo_phan) {
        results.failed.push({
          row: rowIndex,
          ma_nhan_vien: ma_nhan_vien || "(trống)",
          reason: "Thiếu mã nhân viên, tên hoặc bộ phận",
        });
        continue;
      }

      const maNormalized = ma_nhan_vien.toString().trim().toUpperCase();

      try {
        // Kiểm tra trùng trong DB
        const existing = await NhanVien.findOne({ ma_nhan_vien: maNormalized });
        if (existing) {
          results.skipped.push({
            row: rowIndex,
            ma_nhan_vien: maNormalized,
            reason: "Mã đã tồn tại",
          });
          continue;
        }

        const created = await NhanVien.create({
          ma_nhan_vien: maNormalized,
          ten_nhan_vien: ten_nhan_vien.toString().trim(),
          bo_phan: bo_phan.toString().trim(),
          chuc_vu: chuc_vu?.toString().trim() || "",
          email: email?.toString().trim() || "",
          so_dien_thoai: so_dien_thoai?.toString().trim() || "",
        });

        results.success.push({
          row: rowIndex,
          ma_nhan_vien: maNormalized,
          id: created._id,
        });
      } catch (rowError) {
        results.failed.push({
          row: rowIndex,
          ma_nhan_vien: maNormalized,
          reason: rowError.message,
        });
      }
    }

    const statusCode = results.failed.length === data.length ? 400 : 207; // 207 Multi-Status
    return res.status(statusCode).json({
      message: `Import hoàn tất: ${results.success.length} thành công, ${results.skipped.length} bỏ qua, ${results.failed.length} lỗi`,
      total: data.length,
      success_count: results.success.length,
      skipped_count: results.skipped.length,
      failed_count: results.failed.length,
      results,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Tra cứu nhân viên theo mã ───────────────────────────────────────────────────
const traCuuNhanVien = async (req, res) => {
  try {
    const { ma_nhan_vien } = req.params;
    const nhanVien = await NhanVien.findOne({
      ma_nhan_vien: ma_nhan_vien.toUpperCase(),
    });

    if (!nhanVien) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });
    }

    if (!nhanVien.active) {
      return res
        .status(403)
        .json({ message: "Nhân viên này đã bị khóa, không thể chấm công" });
    }

    res.status(200).json({ data: nhanVien });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Lấy danh sách nhân viên ─────────────────────────────────────────────────────
const getDanhSach = async (req, res) => {
  try {
    const { bo_phan, active } = req.query;
    const filter = {};
    if (bo_phan) filter.bo_phan = bo_phan;
    if (active !== undefined) filter.active = active === "true";

    const danhSach = await NhanVien.find(filter).sort({ ma_nhan_vien: 1 });
    res.status(200).json({ total: danhSach.length, data: danhSach });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Cập nhật nhân viên ──────────────────────────────────────────────────────────
  const capNhatNhanVien = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    delete update.ma_nhan_vien; // không cho đổi mã

    // ✅ Dùng findById + save() để pre("save") hook chạy được
    const nhanVien = await NhanVien.findById(id);
    if (!nhanVien)
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });

    Object.assign(nhanVien, update);
    await nhanVien.save(); // hook validate chéo bo_phan/chuc_vu sẽ chạy ở đây

    res.status(200).json({ message: "Cập nhật thành công", data: nhanVien });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
// ─── Khóa / mở khóa nhân viên ───────────────────────────────────────────────────
const toggleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const nhanVien = await NhanVien.findById(id);
    if (!nhanVien)
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });

    nhanVien.active = !nhanVien.active;
    await nhanVien.save();

    res.status(200).json({
      message: nhanVien.active ? "Đã mở khóa nhân viên" : "Đã khóa nhân viên",
      data: nhanVien,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ─── Xóa nhân viên ───────────────────────────────────────────────────────────────
const xoaNhanVien = async (req, res) => {
  try {
    const { id } = req.params;
    const nhanVien = await NhanVien.findByIdAndDelete(id);
    if (!nhanVien)
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });

    res.status(200).json({ message: "Xóa nhân viên thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  themNhanVien,
  themNhieuNhanVien,
  traCuuNhanVien,
  getDanhSach,
  capNhatNhanVien,
  toggleActive,
  xoaNhanVien,
};
