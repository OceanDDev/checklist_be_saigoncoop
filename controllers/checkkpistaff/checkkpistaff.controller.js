const mongoose = require("mongoose");
const CheckKPIStaff = require("../../models/checkkpistaff/checkkpistaff");
const FormKPIStaff = require("../../models/formkpistaff/formkpistaff");

/** Helpers */
const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const toStr = (v, def = "") => (typeof v === "string" ? v : def);

// ✅ Normalize đơn vị (object có chinh + phu)
const normalizeDonVi = (dv = {}) => {
  if (typeof dv === "string") {
    // Backward compatibility: nếu gửi lên string cũ, chuyển thành object
    return { chinh: dv, phu: "" };
  }
  return {
    chinh: toStr(dv.chinh),
    phu: toStr(dv.phu),
  };
};

/** Chuẩn hoá 1 item KPI phụ */
const normalizeKpiPhu = (item = {}) => ({
  ten_kpi_phu: toStr(item.ten_kpi_phu),
  so_loi: toNum(item.so_loi, 0),
});

/** Chuẩn hoá 1 item KPI */
const normalizeCheckItem = (it = {}) => {
  const tyTrong = toNum(it.ty_trong);

  return {
    kpi: toStr(it.kpi),
    ty_trong: tyTrong,
    ty_trong_cuoi: toNum(it.ty_trong_cuoi, tyTrong),
    so_loi: toNum(it.so_loi),
    noi_dung_loi: toStr(it.noi_dung_loi),
    ky_hieu: toStr(it.ky_hieu),
    don_vi_tinh: toStr(it.don_vi_tinh),
    da_thuc_hien: toStr(it.da_thuc_hien),
    ke_hoach_quy: toStr(it.ke_hoach_quy),
    chu_ki: toStr(it.chu_ki),
    nv_danh_gia: toNum(it.nv_danh_gia),
    cac_do_luong: toStr(it.cac_do_luong),
    bp_theo_doi: toStr(it.bp_theo_doi),
  };
};

/** Xây danh_sach_check từ các nguồn */
const buildChecklistFromSources = (payload = {}, formKPI) => {
  const { danh_sach_check, kpis } = payload;

  // Trường hợp 1: Có sẵn danh_sach_check
  if (Array.isArray(danh_sach_check) && danh_sach_check.length > 0) {
    return danh_sach_check.map(normalizeCheckItem);
  }

  // Trường hợp 2: Có kpis
  if (Array.isArray(kpis) && kpis.length > 0) {
    return kpis.map((it) =>
      normalizeCheckItem({
        kpi: it.kpi,
        ty_trong: it.ty_trong,
        ty_trong_cuoi: it.ty_trong_cuoi,
        so_loi: it.so_loi ?? it.loi?.so_loi ?? 0,
        noi_dung_loi: it.noi_dung_loi ?? it.loi?.noi_dung ?? "",
        ky_hieu: it.ky_hieu,
        don_vi_tinh: it.don_vi_tinh,
        da_thuc_hien: it.da_thuc_hien,
        ke_hoach_quy: it.ke_hoach_quy,
        chu_ki: it.chu_ki,
        nv_danh_gia: it.nv_danh_gia,
        cac_do_luong: it.cac_do_luong,
        bp_theo_doi: it.bp_theo_doi,
      }),
    );
  }

  // Trường hợp 3: Lấy từ formKPI
  if (formKPI?.kpis && Array.isArray(formKPI.kpis)) {
    return formKPI.kpis.map((k) =>
      normalizeCheckItem({
        kpi: k.kpi,
        ty_trong: k.ty_trong,
        ty_trong_cuoi: k.ty_trong_cuoi,
        so_loi: 0,
        noi_dung_loi: "",
        ky_hieu: k.ky_hieu,
        don_vi_tinh: k.don_vi_tinh,
        da_thuc_hien: k.da_thuc_hien,
        ke_hoach_quy: k.ke_hoach_quy,
        chu_ki: k.chu_ki,
        nv_danh_gia: k.nv_danh_gia,
        cac_do_luong: k.cac_do_luong,
        bp_theo_doi: k.bp_theo_doi,
      }),
    );
  }

  return [];
};

/** Xử lý kpi_phu từ payload hoặc formKPI */
const buildKpiPhu = (payload = {}, formKPI) => {
  // Ưu tiên lấy từ payload
  if (payload.kpi_phu !== undefined) {
    if (payload.kpi_phu === null) return null;
    if (Array.isArray(payload.kpi_phu)) {
      return payload.kpi_phu.map(normalizeKpiPhu);
    }
  }

  // Fallback về formKPI
  if (formKPI?.kpi_phu !== undefined) {
    if (formKPI.kpi_phu === null) return null;
    if (Array.isArray(formKPI.kpi_phu)) {
      return formKPI.kpi_phu.map(normalizeKpiPhu);
    }
  }

  return null;
};

/** Lấy actor từ req */
const extractActor = (req) => {
  const nameFromAuth = req.user && (req.user.name || req.user.fullName);
  const idFromAuth = req.user && (req.user.id || req.user._id);

  return {
    by_name: toStr(
      req.body.by_name ||
        req.body.actor_name ||
        req.headers["x-actor-name"] ||
        nameFromAuth,
    ),
    by_id: toStr(req.body.actor_id || req.headers["x-actor-id"] || idFromAuth),
  };
};

/**
 * 1. Tạo check KPI từ form KPI đã có
 */
exports.createCheckKPI = async (req, res) => {
  try {
    const {
      form_kpi_id,
      quy,
      nam,
      ghi_chu,
      ty_trong_quy,
      danh_sach_check,
      kpis,
      kpi_phu,
    } = req.body;

    if (!form_kpi_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu form_kpi_id",
      });
    }

    const quyNum = toNum(quy);
    const namNum = toNum(nam);

    // ✅ KIỂM TRA QUÝ HỢP LỆ
    if (quyNum < 1 || quyNum > 4) {
      return res.status(400).json({
        success: false,
        message: "Quý phải từ 1 đến 4",
      });
    }

    // Lấy form KPI gốc
    const formKPI = await FormKPIStaff.findById(form_kpi_id);
    if (!formKPI) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy form KPI",
      });
    }

    // ✅ KIỂM TRA TRÙNG LẶP CHÍNH XÁC: form_kpi_id + quy + nam
    const existing = await CheckKPIStaff.findOne({
      form_kpi_id: form_kpi_id,
      quy: quyNum,
      nam: namNum,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Đã tồn tại bản ghi đánh giá KPI cho Form KPI này ở Quý ${quyNum}/${namNum}. Không thể tạo mới!`,
        existing_id: existing._id,
        existing_data: {
          ma_nhan_vien: existing.ma_nhan_vien,
          ho_ten: existing.ho_ten,
          quy: existing.quy,
          nam: existing.nam,
        },
      });
    }

    // Xây dựng danh sách check và kpi_phu
    const list = buildChecklistFromSources({ danh_sach_check, kpis }, formKPI);
    const kpiPhuData = buildKpiPhu({ kpi_phu }, formKPI);

    // Tạo document mới
    const doc = new CheckKPIStaff({
      form_kpi_id,
      ma_nhan_vien: formKPI.ma_nhan_vien,
      ho_ten: formKPI.ho_ten,
      don_vi: normalizeDonVi(formKPI.don_vi), // ✅ Normalize đơn vị
      chuc_danh: formKPI.chuc_danh,
      quy: quyNum,
      nam: namNum,
      ty_trong_quy: toNum(ty_trong_quy, 100),
      danh_sach_check: list,
      kpi_phu: kpiPhuData,
      ghi_chu: toStr(ghi_chu),
    });

    await doc.save();

    res.status(201).json({
      success: true,
      message: "Tạo check KPI thành công",
      data: doc,
    });
  } catch (error) {
    // ✅ XỬ LÝ LỖI UNIQUE CONSTRAINT TỪ MONGODB
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {}).join(", ");
      return res.status(409).json({
        success: false,
        message: `Bản ghi đã tồn tại. Trường trùng lặp: ${duplicateField || "form_kpi_id + quy + nam"}`,
        error_code: 11000,
      });
    }

    console.error("❌ Lỗi createCheckKPI:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi tạo check KPI",
      error: error.message,
    });
  }
};

/**
 * 2. Tạo check KPI từ mã nhân viên
 */
exports.createCheckKPIFromStaff = async (req, res) => {
  try {
    const {
      ma_nhan_vien,
      quy,
      nam,
      ghi_chu,
      ty_trong_quy,
      kpis,
      danh_sach_check,
      kpi_phu,
    } = req.body;

    if (!ma_nhan_vien) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ma_nhan_vien",
      });
    }

    const quyNum = toNum(quy);
    const namNum = toNum(nam);

    // ✅ KIỂM TRA QUÝ HỢP LỆ
    if (quyNum < 1 || quyNum > 4) {
      return res.status(400).json({
        success: false,
        message: "Quý phải từ 1 đến 4",
      });
    }

    // Tìm form KPI của nhân viên
    const formKPI = await FormKPIStaff.findOne({
      ma_nhan_vien,
      quy: quyNum,
      nam: namNum,
    });

    if (!formKPI) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy Form KPI cho nhân viên ${ma_nhan_vien} ở Quý ${quyNum}/${namNum}`,
      });
    }

    // ✅ KIỂM TRA TRÙNG LẶP
    const dup = await CheckKPIStaff.findOne({
      form_kpi_id: formKPI._id,
      quy: quyNum,
      nam: namNum,
    });

    if (dup) {
      return res.status(409).json({
        success: false,
        message: `Đã tồn tại bản ghi đánh giá KPI cho nhân viên ${ma_nhan_vien} ở Quý ${quyNum}/${namNum}. Không thể tạo mới!`,
        existing_id: dup._id,
      });
    }

    // Xây dựng danh sách check và kpi_phu
    const list = buildChecklistFromSources({ danh_sach_check, kpis }, formKPI);
    const kpiPhuData = buildKpiPhu({ kpi_phu }, formKPI);

    // Tạo document mới
    const doc = new CheckKPIStaff({
      form_kpi_id: formKPI._id,
      ma_nhan_vien: formKPI.ma_nhan_vien,
      ho_ten: formKPI.ho_ten,
      don_vi: normalizeDonVi(formKPI.don_vi), // ✅ Normalize đơn vị
      chuc_danh: formKPI.chuc_danh,
      quy: quyNum,
      nam: namNum,
      ty_trong_quy: toNum(ty_trong_quy, 100),
      danh_sach_check: list,
      kpi_phu: kpiPhuData,
      ghi_chu: toStr(ghi_chu),
    });

    await doc.save();

    res.status(201).json({
      success: true,
      message: "Tạo check KPI từ thông tin nhân viên thành công",
      data: doc,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {}).join(", ");
      return res.status(409).json({
        success: false,
        message: `Bản ghi đã tồn tại. Trường trùng lặp: ${duplicateField || "form_kpi_id + quy + nam"}`,
        error_code: 11000,
      });
    }

    console.error("❌ Lỗi createCheckKPIFromStaff:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi tạo check KPI",
      error: error.message,
    });
  }
};

/**
 * 3. Cập nhật check KPI + log
 */
exports.updateCheckKPI = async (req, res) => {
  try {
    const { danh_sach_check, kpi_phu, ghi_chu, update_note, ty_trong_quy } =
      req.body;

    const doc = await CheckKPIStaff.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy check KPI",
      });
    }

    // Snapshot trước khi cập nhật
    const snapshotBefore = {
      danh_sach_check: JSON.parse(JSON.stringify(doc.danh_sach_check || [])),
      kpi_phu: JSON.parse(JSON.stringify(doc.kpi_phu ?? null)),
      ghi_chu: doc.ghi_chu ?? "",
      ty_trong_quy: doc.ty_trong_quy ?? 0,
    };

    // Cập nhật dữ liệu
    if (Array.isArray(danh_sach_check)) {
      doc.danh_sach_check = danh_sach_check.map(normalizeCheckItem);
      doc.markModified("danh_sach_check");
    }

    if (kpi_phu !== undefined) {
      if (kpi_phu === null) {
        doc.kpi_phu = null;
      } else if (Array.isArray(kpi_phu)) {
        doc.kpi_phu = kpi_phu.map(normalizeKpiPhu);
      }
      doc.markModified("kpi_phu");
    }

    if (typeof ghi_chu === "string") {
      doc.ghi_chu = ghi_chu;
    }

    if (typeof ty_trong_quy !== "undefined") {
      doc.ty_trong_quy = toNum(ty_trong_quy, doc.ty_trong_quy);
    }

    // Actor & log
    const { by_name, by_id } = extractActor(req);
    doc.updates = doc.updates || [];

    const snapshotAfter = {
      danh_sach_check: JSON.parse(JSON.stringify(doc.danh_sach_check || [])),
      kpi_phu: JSON.parse(JSON.stringify(doc.kpi_phu ?? null)),
      ghi_chu: doc.ghi_chu ?? "",
      ty_trong_quy: doc.ty_trong_quy ?? 0,
    };

    doc.updates.push({
      by_name,
      by_id,
      note: toStr(update_note),
      at: new Date(),
      snapshot_before: snapshotBefore,
      snapshot: snapshotAfter,
    });

    doc.markModified("updates");

    await doc.save();

    return res.json({
      success: true,
      message: "Cập nhật check KPI thành công",
      data: doc,
    });
  } catch (error) {
    console.error("❌ Lỗi updateCheckKPI:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi cập nhật check KPI",
      error: error.message,
    });
  }
};

/**
 * 4. Lấy tất cả check KPI
 */
exports.getAllCheckKPI = async (req, res) => {
  try {
    const { quy, nam, ma_nhan_vien, don_vi } = req.query;

    const filter = {};
    if (quy) filter.quy = toNum(quy);
    if (nam) filter.nam = toNum(nam);
    if (ma_nhan_vien)
      filter.ma_nhan_vien = { $regex: ma_nhan_vien, $options: "i" };

    // ✅ Sửa: query theo don_vi.chinh hoặc don_vi.phu
    if (don_vi) {
      filter.$or = [
        { "don_vi.chinh": { $regex: don_vi, $options: "i" } },
        { "don_vi.phu": { $regex: don_vi, $options: "i" } },
      ];
    }

    const data = await CheckKPIStaff.find(filter)
      .populate("form_kpi_id")
      .sort({ ngay_tao: -1 });

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách check KPI",
      error: error.message,
    });
  }
};

/**
 * 5. Lấy check KPI theo ID
 */
exports.getCheckKPIById = async (req, res) => {
  try {
    const doc = await CheckKPIStaff.findById(req.params.id).populate(
      "form_kpi_id",
    );

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy check KPI",
      });
    }

    res.json({
      success: true,
      data: doc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thông tin check KPI",
      error: error.message,
    });
  }
};

/**
 * 6. Lấy check KPI theo nhân viên và năm
 */
exports.getCheckKPIByStaff = async (req, res) => {
  try {
    const { ma_nhan_vien, nam } = req.params;

    const list = await CheckKPIStaff.find({
      ma_nhan_vien,
      nam: toNum(nam),
    })
      .populate("form_kpi_id")
      .sort({ quy: 1 });

    if (!list || list.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy check KPI cho nhân viên ${ma_nhan_vien} trong năm ${nam}`,
      });
    }

    const stats = {
      totalQuarters: list.length,
      quarters: list.map((k) => k.quy).sort((a, b) => a - b),
      averageWeight:
        list.length > 0
          ? Math.round(
              (list.reduce((s, k) => s + (Number(k.ty_trong_quy) || 0), 0) /
                list.length) *
                100,
            ) / 100
          : 0,
      totalRecords: list.length,
    };

    res.json({
      success: true,
      data: list,
      stats,
      count: list.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy check KPI theo nhân viên và năm",
      error: error.message,
    });
  }
};

/**
 * 7. Xoá check KPI
 */
exports.deleteCheckKPI = async (req, res) => {
  try {
    const deleted = await CheckKPIStaff.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy check KPI để xóa",
      });
    }

    res.json({
      success: true,
      message: "Xóa check KPI thành công",
      data: deleted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi xóa check KPI",
      error: error.message,
    });
  }
};

/**
 * 8. Thống kê check KPI
 */
exports.getCheckKPIStats = async (req, res) => {
  try {
    const { quy, nam } = req.query;
    const filter = {};

    if (quy) filter.quy = toNum(quy);
    if (nam) filter.nam = toNum(nam);

    const stats = await CheckKPIStaff.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total_checks: { $sum: 1 },
          total_updates: { $sum: "$so_lan_update" },
          avg_updates: { $avg: "$so_lan_update" },
        },
      },
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        total_checks: 0,
        total_updates: 0,
        avg_updates: 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thống kê",
      error: error.message,
    });
  }
};
