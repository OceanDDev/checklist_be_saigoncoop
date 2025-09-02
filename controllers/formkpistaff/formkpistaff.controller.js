// controllers/formkpistaff.controller.js
const mongoose = require("mongoose");
const FormKPIStaff = require("../../models/formkpistaff/formkpistaff");

/** ===== Helpers ===== */
const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const toStr = (v, def = "") => (typeof v === "string" ? v : def);

const normalizeKpiItem = (it = {}) => ({
  kpi: toStr(it.kpi),
  ty_trong: toNum(it.ty_trong),
  ty_trong_cuoi: toNum(it.ty_trong_cuoi),


  // cũ
  ky_hieu: toStr(it.ky_hieu),
  don_vi_tinh: toStr(it.don_vi_tinh),

  // mới
  da_thuc_hien: toStr(it.da_thuc_hien),
  ke_hoach_quy: toStr(it.ke_hoach_quy),
  chu_ki: toStr(it.chu_ki),
  nv_danh_gia: toStr(it.nv_danh_gia),
  cac_do_luong: toStr(it.cac_do_luong),
  bp_theo_doi: toStr(it.bp_theo_doi),
});

const normalizeFormPayload = (body = {}) => {
  const kpis = Array.isArray(body.kpis) ? body.kpis.map(normalizeKpiItem) : [];
  return {
    ma_nhan_vien: toStr(body.ma_nhan_vien),
    ho_ten: toStr(body.ho_ten),
    don_vi: toStr(body.don_vi),
    chuc_danh: toStr(body.chuc_danh),
    thang: toNum(body.thang),
    nam: toNum(body.nam),
    ghi_chu: toStr(body.ghi_chu),
    kpis,
  };
};

const handleDupKey = (res, err, extraMsg) => {
  if (err?.code === 11000) {
    return res.status(409).json({
      success: false,
      message:
        extraMsg ||
        "Form KPI đã tồn tại cho (ma_nhan_vien, thang, nam). Kiểm tra unique index.",
    });
  }
  return null;
};

/** ===== CREATE ===== */
// Tạo 1 form KPI
exports.createFormKPI = async (req, res) => {
  try {
    const data = normalizeFormPayload(req.body);

    // kiểm tra tồn tại (phủ đầu trước khi đụng unique index)
    const exists = await FormKPIStaff.findOne({
      ma_nhan_vien: data.ma_nhan_vien,
      thang: data.thang,
      nam: data.nam,
    });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Form KPI cho nhân viên này trong tháng/năm đã tồn tại",
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

// Tạo nhiều form KPI cùng lúc
exports.createManyFormKPI = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ success: false, message: "Body phải là mảng form" });
    }

    // chuẩn hoá
    const forms = req.body.map(normalizeFormPayload);

    // kiểm tra trùng trong DB trước (nhanh)
    const checks = await Promise.all(
      forms.map((f) =>
        FormKPIStaff.findOne({
          ma_nhan_vien: f.ma_nhan_vien,
          thang: f.thang,
          nam: f.nam,
        })
      )
    );
    const existed = checks.filter(Boolean).map((f) => `${f.ma_nhan_vien}-${f.thang}/${f.nam}`);
    if (existed.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Các form đã tồn tại: ${existed.join(", ")}`,
      });
    }

    // insertMany với ordered:false để không bị dừng khi gặp lỗi một phần
    const newForms = await FormKPIStaff.insertMany(forms, { ordered: false });
    res.status(201).json({
      success: true,
      message: "Tạo nhiều form KPI thành công",
      count: newForms.length,
      data: newForms,
    });
  } catch (error) {
    if (handleDupKey(res, error, "Có form đã tồn tại; kiểm tra lại danh sách gửi lên.")) return;
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
    const { thang, nam, ma_nhan_vien, don_vi } = req.query;
    const filter = {};
    if (thang) filter.thang = toNum(thang);
    if (nam) filter.nam = toNum(nam);
    if (ma_nhan_vien) filter.ma_nhan_vien = { $regex: ma_nhan_vien, $options: "i" };
    if (don_vi) filter.don_vi = { $regex: don_vi, $options: "i" };

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
      return res.status(404).json({ success: false, message: "Không tìm thấy form KPI" });
    res.json({ success: true, data: formKPI });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi lấy form KPI", error: error.message });
  }
};

exports.getFormKPIByStaff = async (req, res) => {
  try {
    const { ma_nhan_vien, thang, nam } = req.params;
    const formKPI = await FormKPIStaff.findOne({
      ma_nhan_vien,
      thang: toNum(thang),
      nam: toNum(nam),
    });
    if (!formKPI)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy form KPI cho nhân viên" });
    res.json({ success: true, data: formKPI });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Lỗi lấy form KPI theo nhân viên", error: error.message });
  }
};

/** ===== UPDATE ===== */
exports.updateFormKPI = async (req, res) => {
  try {
    // chuẩn hoá phần kpis nếu có gửi lên
    const payload = { ...req.body };
    if (Array.isArray(payload.kpis)) {
      payload.kpis = payload.kpis.map(normalizeKpiItem);
    }
    if (payload.thang !== undefined) payload.thang = toNum(payload.thang);
    if (payload.nam !== undefined) payload.nam = toNum(payload.nam);
    if (payload.chuc_danh !== undefined) payload.chuc_danh = toStr(payload.chuc_danh);

    const updatedFormKPI = await FormKPIStaff.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );
    if (!updatedFormKPI)
      return res.status(404).json({ success: false, message: "Không tìm thấy form KPI để cập nhật" });

    res.json({ success: true, message: "Cập nhật form KPI thành công", data: updatedFormKPI });
  } catch (error) {
    if (handleDupKey(res, error)) return;
    res.status(500).json({ success: false, message: "Lỗi cập nhật form KPI", error: error.message });
  }
};

/** ===== DELETE ===== */
exports.deleteFormKPI = async (req, res) => {
  try {
    const deletedFormKPI = await FormKPIStaff.findByIdAndDelete(req.params.id);
    if (!deletedFormKPI)
      return res.status(404).json({ success: false, message: "Không tìm thấy form KPI để xóa" });
    res.json({ success: true, message: "Xóa form KPI thành công", data: deletedFormKPI });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi xóa form KPI", error: error.message });
  }
};

/** ===== LIST STAFF (kèm chức danh) ===== */
exports.getStaffList = async (req, res) => {
  try {
    const { thang, nam } = req.query;
    const filter = {};
    if (thang) filter.thang = toNum(thang);
    if (nam) filter.nam = toNum(nam);

    const staffList = await FormKPIStaff.find(filter)
      .select("ma_nhan_vien ho_ten don_vi chuc_danh thang nam")
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
