// controllers/checkkpistaff.controller.js
const mongoose = require("mongoose");
const CheckKPIStaff = require("../../models/checkkpistaff/checkkpistaff");
const FormKPIStaff = require("../../models/formkpistaff/formkpistaff");

/** Helpers */
const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const toStr = (v, def = "") => (typeof v === "string" ? v : def);

/** Chuẩn hoá 1 item KPI theo schema hiện tại */
const normalizeCheckItem = (it = {}) => {
  const tyTrong = toNum(it.ty_trong);
  
  return {
    kpi: toStr(it.kpi),
    ty_trong: tyTrong,
    ty_trong_cuoi: toNum(it.ty_trong_cuoi, tyTrong), // Dùng tyTrong làm giá trị mặc định

    so_loi: toNum(it.so_loi),
    noi_dung_loi: toStr(it.noi_dung_loi),

    ky_hieu: toStr(it.ky_hieu),
    don_vi_tinh: toStr(it.don_vi_tinh),

    // các field mới bổ sung (đều là string theo schema)
    da_thuc_hien: toStr(it.da_thuc_hien),
    ke_hoach_quy: toStr(it.ke_hoach_quy),
    chu_ki: toStr(it.chu_ki),
    nv_danh_gia: toNum(it.nv_danh_gia, null),
    cac_do_luong: toStr(it.cac_do_luong),
    bp_theo_doi: toStr(it.bp_theo_doi),
  };
};
/** Xây danh_sach_check từ:
 *  - danh_sach_check payload (ưu tiên)
 *  - kpis payload (map sang field mới)
 *  - formKPI.kpis (mặc định)
 */
const buildChecklistFromSources = (payload = {}, formKPI) => {
  const { danh_sach_check, kpis } = payload;

  if (Array.isArray(danh_sach_check)) {
    return danh_sach_check.map(normalizeCheckItem);
  }

  if (Array.isArray(kpis)) {
    return kpis.map((it) =>
      normalizeCheckItem({
        kpi: it.kpi,
        ty_trong: it.ty_trong,
        ty_trong_cuoi: it.ty_trong_cuoi,

        so_loi: it.loi?.so_loi ?? 0,
        noi_dung_loi: it.loi?.noi_dung ?? "",
        ky_hieu: it.ky_hieu,
        don_vi_tinh: it.don_vi_tinh,

        da_thuc_hien: it.da_thuc_hien,
        ke_hoach_quy: it.ke_hoach_quy,
        chu_ki: it.chu_ki,
        nv_danh_gia: it.nv_danh_gia,
        cac_do_luong: it.cac_do_luong,
        bp_theo_doi: it.bp_theo_doi,
      })
    );
  }

  // fallback từ formKPI.kpis
  return (formKPI?.kpis || []).map((k) =>
    normalizeCheckItem({
      kpi: k.kpi,
      ty_trong: k.ty_trong,
      so_loi: 0,
      noi_dung_loi: "",
      ky_hieu: k.ky_hieu,
      don_vi_tinh: k.don_vi_tinh,
    })
  );
};

/** Lấy actor từ req (ưu tiên middleware auth) */
const extractActor = (req) => {
  const nameFromAuth = req.user && (req.user.name || req.user.fullName);
  const idFromAuth = req.user && (req.user.id || req.user._id);
  return {
    by_name: toStr(
      req.body.by_name ||
        req.body.actor_name ||
        req.headers["x-actor-name"] ||
        nameFromAuth ||
        ""
    ),
    by_id: toStr(
      req.body.actor_id || req.headers["x-actor-id"] || idFromAuth || ""
    ),
  };
};

/** Tạo check KPI từ form KPI đã có */
exports.createCheckKPI = async (req, res) => {
  try {
    const {
      form_kpi_id,
      thang,
      nam,
      ghi_chu,
      ty_trong_thang,
      danh_sach_check,
      kpis,
    } = req.body;

    if (!form_kpi_id) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu form_kpi_id" });
    }
    const formKPI = await FormKPIStaff.findById(form_kpi_id);
    if (!formKPI) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy form KPI" });
    }

    const existing = await CheckKPIStaff.findOne({
      form_kpi_id,
      thang: toNum(thang),
      nam: toNum(nam),
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Đã có check KPI cho form này trong tháng/năm",
      });
    }

    const list = buildChecklistFromSources({ danh_sach_check, kpis }, formKPI);

    const doc = new CheckKPIStaff({
      form_kpi_id,
      ma_nhan_vien: formKPI.ma_nhan_vien,
      ho_ten: formKPI.ho_ten,
      don_vi: formKPI.don_vi,
      chuc_danh: formKPI.chuc_danh,
      thang: toNum(thang),
      nam: toNum(nam),
      ty_trong_thang: toNum(ty_trong_thang, 100),
      danh_sach_check: list,
      ghi_chu: toStr(ghi_chu),
    });

    await doc.save();
    res
      .status(201)
      .json({ success: true, message: "Tạo check KPI thành công", data: doc });
  } catch (error) {
    // Bắt duplicate key (unique index)
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Bản ghi check KPI đã tồn tại (form_kpi_id + thang + nam là duy nhất)",
      });
    }
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi tạo check KPI",
        error: error.message,
      });
  }
};

/** Tạo check KPI từ mã nhân viên (không cần form_kpi_id) */
exports.createCheckKPIFromStaff = async (req, res) => {
  try {
    const { ma_nhan_vien, thang, nam, ghi_chu, ty_trong_thang, kpis } =
      req.body;

    if (!ma_nhan_vien) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu ma_nhan_vien" });
    }

    const formKPI = await FormKPIStaff.findOne({
      ma_nhan_vien,
      thang: toNum(thang),
      nam: toNum(nam),
    });
    if (!formKPI) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy form KPI cho nhân viên này trong tháng/năm",
      });
    }

    const dup = await CheckKPIStaff.findOne({
      form_kpi_id: formKPI._id,
      thang: toNum(thang),
      nam: toNum(nam),
    });
    if (dup) {
      return res.status(400).json({
        success: false,
        message: "Đã có check KPI cho nhân viên này trong tháng/năm",
      });
    }

    const list = buildChecklistFromSources({ kpis }, formKPI);

    const doc = new CheckKPIStaff({
      form_kpi_id: formKPI._id,
      ma_nhan_vien: formKPI.ma_nhan_vien,
      ho_ten: formKPI.ho_ten,
      don_vi: formKPI.don_vi,
      chuc_danh: formKPI.chuc_danh,
      thang: toNum(thang),
      nam: toNum(nam),
      ty_trong_thang: toNum(ty_trong_thang, 100),
      danh_sach_check: list,
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
      return res.status(409).json({
        success: false,
        message:
          "Bản ghi check KPI đã tồn tại (form_kpi_id + thang + nam là duy nhất)",
      });
    }
    res.status(500).json({
      success: false,
      message: "Lỗi tạo check KPI",
      error: error.message,
    });
  }
};

/** Cập nhật check KPI + log (ghi snapshot trước & sau) */
// controllers/checkkpistaff.controller.js
exports.updateCheckKPI = async (req, res) => {
  try {
    const { danh_sach_check, ghi_chu, update_note, ty_trong_thang } = req.body;

    const doc = await CheckKPIStaff.findById(req.params.id);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check KPI" });
    }

    // ---- snapshot trước khi cập nhật (deep clone) ----
    const snapshotBefore = {
      danh_sach_check: JSON.parse(JSON.stringify(doc.danh_sach_check || [])),
      ghi_chu: doc.ghi_chu ?? "",
      ty_trong_thang: doc.ty_trong_thang ?? 0,
    };

    // ---- cập nhật dữ liệu ----
    if (Array.isArray(danh_sach_check)) {
      doc.danh_sach_check = danh_sach_check.map(normalizeCheckItem);
      doc.markModified("danh_sach_check");
    }
    if (typeof ghi_chu === "string") {
      doc.ghi_chu = ghi_chu;
    }
    if (typeof ty_trong_thang !== "undefined") {
      doc.ty_trong_thang = toNum(ty_trong_thang, doc.ty_trong_thang);
    }

    // ---- actor & log ----
    const { by_name, by_id } = extractActor(req);
    doc.updates = doc.updates || [];
    doc.so_lan_update = (doc.so_lan_update || 0) + 1;

    const snapshotAfter = {
      danh_sach_check: JSON.parse(JSON.stringify(doc.danh_sach_check || [])),
      ghi_chu: doc.ghi_chu ?? "",
      ty_trong_thang: doc.ty_trong_thang ?? 0,
    };

    doc.updates.push({
      by_name,
      by_id,
      note: toStr(update_note),
      at: new Date(),
      snapshot_before: snapshotBefore,  // <--- LƯU ẢNH TRƯỚC
      snapshot: snapshotAfter,          // <--- ẢNH SAU
    });
    doc.markModified("updates");

    await doc.save();

    return res.json({
      success: true,
      message: "Cập nhật check KPI thành công",
      data: doc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi cập nhật check KPI",
      error: error.message,
    });
  }
};


/** Lấy tất cả check KPI (có filter cơ bản) */
exports.getAllCheckKPI = async (req, res) => {
  try {
    const { thang, nam, ma_nhan_vien, don_vi } = req.query;

    const filter = {};
    if (thang) filter.thang = toNum(thang);
    if (nam) filter.nam = toNum(nam);
    if (ma_nhan_vien)
      filter.ma_nhan_vien = { $regex: ma_nhan_vien, $options: "i" };
    if (don_vi) filter.don_vi = { $regex: don_vi, $options: "i" };

    const data = await CheckKPIStaff.find(filter)
      .populate("form_kpi_id")
      .sort({ ngay_tao: -1 });

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách check KPI",
      error: error.message,
    });
  }
};

/** Lấy check KPI theo ID */
exports.getCheckKPIById = async (req, res) => {
  try {
    const doc = await CheckKPIStaff.findById(req.params.id).populate(
      "form_kpi_id"
    );
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check KPI" });
    }
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thông tin check KPI",
      error: error.message,
    });
  } 
};

/** Lấy check KPI theo nhân viên và năm */
exports.getCheckKPIByStaff = async (req, res) => {
  try {
    const { ma_nhan_vien, nam } = req.params;

    const list = await CheckKPIStaff.find({
      ma_nhan_vien,
      nam: toNum(nam),
    })
      .populate("form_kpi_id")
      .sort({ thang: 1 });

    if (!list || list.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy check KPI cho nhân viên ${ma_nhan_vien} trong năm ${nam}`,
      });
    }

    const stats = {
      totalMonths: list.length,
      months: list.map((k) => k.thang).sort((a, b) => a - b),
      averageWeight:
        list.length > 0
          ? Math.round(
              (list.reduce((s, k) => s + (Number(k.ty_trong_thang) || 0), 0) /
                list.length) *
                100
            ) / 100
          : 0,
      totalRecords: list.length,
    };

    res.json({ success: true, data: list, stats, count: list.length });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy check KPI theo nhân viên và năm",
      error: error.message,
    });
  }
};

/** Xoá check KPI */
exports.deleteCheckKPI = async (req, res) => {
  try {
    const deleted = await CheckKPIStaff.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check KPI để xóa" });
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

/** Thống kê check KPI */
exports.getCheckKPIStats = async (req, res) => {
  try {
    const { thang, nam } = req.query;
    const filter = {};
    if (thang) filter.thang = toNum(thang);
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
      data: stats[0] || { total_checks: 0, total_updates: 0, avg_updates: 0 },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thống kê",
      error: error.message,
    });
  }
};
