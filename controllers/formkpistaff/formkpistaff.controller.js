// controllers/formkpistaff/formkpistaff.controller.js
const mongoose = require("mongoose");
const FormKPIStaff = require("../../models/formkpistaff/formkpistaff");

/** ===== Helpers ===== */
const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const toStr = (v, def = "") => (typeof v === "string" ? v : def);

// ✅ Normalize đơn vị (object có chinh + phu)
const normalizeDonVi = (dv = {}) => {
  if (typeof dv === "string") {
    // Nếu gửi lên string cũ, chuyển thành object
    return { chinh: dv, phu: "" };
  }
  return {
    chinh: toStr(dv.chinh),
    phu: toStr(dv.phu),
  };
};

// ✅ Normalize KPI phụ
const normalizeKpiPhu = (it = {}) => {
  const soLoi = toNum(it.so_loi, 0);

  if (soLoi < 0) {
    throw new Error("Số lỗi phải >= 0");
  }

  return {
    ten_kpi_phu: toStr(it.ten_kpi_phu),
    so_loi: soLoi,
  };
};

const normalizeKpiItem = (it = {}) => ({
  kpi: toStr(it.kpi),
  ty_trong: toNum(it.ty_trong),
  ty_trong_cuoi: toNum(it.ty_trong_cuoi, toNum(it.ty_trong)),
  ky_hieu: toStr(it.ky_hieu),
  don_vi_tinh: toStr(it.don_vi_tinh),
  da_thuc_hien: toStr(it.da_thuc_hien),
  ke_hoach_quy: toStr(it.ke_hoach_quy),
  chu_ki: toStr(it.chu_ki, "Quý"),
  nv_danh_gia: toStr(it.nv_danh_gia),
  cac_do_luong: toStr(it.cac_do_luong),
  bp_theo_doi: toStr(it.bp_theo_doi),
});

const normalizeFormPayload = (body = {}) => {
  const kpis = Array.isArray(body.kpis) ? body.kpis.map(normalizeKpiItem) : [];

  const kpi_phu = Array.isArray(body.kpi_phu)
    ? body.kpi_phu.map(normalizeKpiPhu)
    : null;

  return {
    ma_nhan_vien: toStr(body.ma_nhan_vien),
    ho_ten: toStr(body.ho_ten),
    don_vi: normalizeDonVi(body.don_vi), // ✅ Sửa: dùng normalizeDonVi
    chuc_danh: toStr(body.chuc_danh),
    quy: toNum(body.quy),
    nam: toNum(body.nam),
    ghi_chu: toStr(body.ghi_chu),
    kpis,
    kpi_phu,
  };
};

const handleDupKey = (res, err, extraMsg) => {
  if (err?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: extraMsg || "Form KPI đã tồn tại cho (ma_nhan_vien, quy, nam).",
    });
  }
  return null;
};

/** ===== CREATE ===== */
exports.createFormKPI = async (req, res) => {
  try {
    const data = normalizeFormPayload(req.body);

    const exists = await FormKPIStaff.findOne({
      ma_nhan_vien: data.ma_nhan_vien,
      quy: data.quy,
      nam: data.nam,
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Form KPI cho nhân viên này trong quý/năm đã tồn tại",
      });
    }

    const form = await FormKPIStaff.create(data);
    res.status(201).json({
      success: true,
      message: "Tạo form KPI thành công",
      data: form,
    });
  } catch (err) {
    if (handleDupKey(res, err)) return;
    res.status(500).json({
      success: false,
      message: "Lỗi tạo form KPI",
      error: err.message,
    });
  }
};

exports.createManyFormKPI = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Body phải là mảng form",
      });
    }

    const forms = req.body.map(normalizeFormPayload);

    const checks = await Promise.all(
      forms.map((f) =>
        FormKPIStaff.findOne({
          ma_nhan_vien: f.ma_nhan_vien,
          quy: f.quy,
          nam: f.nam,
        }),
      ),
    );

    const existed = checks
      .filter(Boolean)
      .map((f) => `${f.ma_nhan_vien}-Q${f.quy}/${f.nam}`);

    if (existed.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Các form đã tồn tại: ${existed.join(", ")}`,
      });
    }

    const newForms = await FormKPIStaff.insertMany(forms, { ordered: false });
    res.status(201).json({
      success: true,
      message: "Tạo nhiều form KPI thành công",
      count: newForms.length,
      data: newForms,
    });
  } catch (error) {
    if (handleDupKey(res, error)) return;
    res.status(500).json({
      success: false,
      message: "Lỗi tạo nhiều form KPI",
      error: error.message,
    });
  }
};

/** ===== READ ===== */
exports.getAllFormKPI = async (req, res) => {
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

    const formKPIs = await FormKPIStaff.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: formKPIs.length, data: formKPIs });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách form KPI",
      error: error.message,
    });
  }
};

exports.getFormKPIById = async (req, res) => {
  try {
    const formKPI = await FormKPIStaff.findById(req.params.id);
    if (!formKPI)
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy form KPI",
      });
    res.json({ success: true, data: formKPI });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy form KPI",
      error: error.message,
    });
  }
};

exports.getFormKPIByStaff = async (req, res) => {
  try {
    const { ma_nhan_vien, quy, nam } = req.params;
    const formKPI = await FormKPIStaff.findOne({
      ma_nhan_vien,
      quy: toNum(quy),
      nam: toNum(nam),
    });

    if (!formKPI)
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy form KPI cho nhân viên",
      });

    res.json({ success: true, data: formKPI });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy form KPI theo nhân viên",
      error: error.message,
    });
  }
};

/** ===== UPDATE ===== */
exports.updateFormKPI = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (Array.isArray(payload.kpis)) {
      payload.kpis = payload.kpis.map(normalizeKpiItem);
    }

    if (Array.isArray(payload.kpi_phu)) {
      payload.kpi_phu = payload.kpi_phu.map(normalizeKpiPhu);
    } else if (payload.kpi_phu === null) {
      payload.kpi_phu = null;
    }

    // ✅ Sửa: normalize don_vi khi update
    if (payload.don_vi !== undefined) {
      payload.don_vi = normalizeDonVi(payload.don_vi);
    }

    if (payload.quy !== undefined) payload.quy = toNum(payload.quy);
    if (payload.nam !== undefined) payload.nam = toNum(payload.nam);
    if (payload.chuc_danh !== undefined)
      payload.chuc_danh = toStr(payload.chuc_danh);

    const updatedFormKPI = await FormKPIStaff.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true },
    );

    if (!updatedFormKPI)
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy form KPI để cập nhật",
      });

    res.json({
      success: true,
      message: "Cập nhật form KPI thành công",
      data: updatedFormKPI,
    });
  } catch (error) {
    if (handleDupKey(res, error)) return;
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật form KPI",
      error: error.message,
    });
  }
};

/** ===== DELETE ===== */
exports.deleteFormKPI = async (req, res) => { 
  try {
    const deletedFormKPI = await FormKPIStaff.findByIdAndDelete(req.params.id);
    if (!deletedFormKPI)
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy form KPI để xóa",
      });

    res.json({
      success: true,
      message: "Xóa form KPI thành công",
      data: deletedFormKPI,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi xóa form KPI",
      error: error.message,
    });
  }
};

/** ===== LIST STAFF ===== */
exports.getStaffList = async (req, res) => {
  try {
    const { quy, nam } = req.query;
    const filter = {};

    if (quy) filter.quy = toNum(quy);
    if (nam) filter.nam = toNum(nam);

    const staffList = await FormKPIStaff.find(filter)
      .select("ma_nhan_vien ho_ten don_vi chuc_danh quy nam")
      .sort({ ho_ten: 1 });

    res.json({ success: true, count: staffList.length, data: staffList });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách nhân viên",
      error: error.message,
    });
  }
};