// controllers/move/nangSuatController.js
const NangSuat = require("../../models/nangsuat/nangsuat");
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─────────────────────────────────────────────
// GET ALL  –  GET /api/nangsuat
// ─────────────────────────────────────────────
const getAllNangSuat = async (req, res) => {
  try {
    const {
      status,
      from_zone,
      to_zone,
      assigned_to,
      loai,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (from_zone) filter.from_zone = from_zone.toUpperCase();
    if (to_zone) filter.to_zone = to_zone.toUpperCase();
    if (assigned_to)
      filter.assigned_to = { $regex: assigned_to, $options: "i" };
    if (loai) filter.loai = loai;

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      NangSuat.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      NangSuat.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET ONE  –  GET /api/nangsuat/:id
// ─────────────────────────────────────────────
const getOneNangSuat = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id))
      return res
        .status(400)
        .json({ success: false, message: "ID không hợp lệ" });

    const doc = await NangSuat.findById(id);
    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu" });

    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET BY DOC_NUMBER  –  GET /api/nangsuat/doc/:doc_number
// ─────────────────────────────────────────────
const getByDocNumberNangSuat = async (req, res) => {
  try {
    const doc = await NangSuat.findOne({ doc_number: req.params.doc_number });
    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu" });

    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// ADD ONE  –  POST /api/nangsuat
// ─────────────────────────────────────────────
const addOneNangSuat = async (req, res) => {
  try {
    const {
      doc_number,
      status,
      from_zone,
      to_zone,
      date_assigned,
      time_assigned,
      date_completed,
      time_completed,
      assigned_to,
      total_lines,
      total_eaches,
      total_reaches,
      time_complete_phieu,
      status_phieu,
      loai,
    } = req.body;

    if (!doc_number || !status || !from_zone || !to_zone) {
      return res.status(400).json({
        success: false,
        message: "doc_number, status, from_zone, to_zone là bắt buộc",
      });
    }

    const existing = await NangSuat.findOne({ doc_number });
    if (existing)
      return res
        .status(409)
        .json({ success: false, message: "doc_number đã tồn tại" });

    const newDoc = await NangSuat.create({
      doc_number,
      status,
      from_zone,
      to_zone,
      date_assigned: date_assigned || null,
      time_assigned: time_assigned || "",
      date_completed: date_completed || null,
      time_completed: time_completed || "",
      assigned_to: assigned_to || null, // String thẳng từ TXT
      total_lines: total_lines || 0,
      total_eaches: total_eaches || 0,
      total_reaches: total_reaches || 0,
      time_complete_phieu: time_complete_phieu || "",
      status_phieu: status_phieu || 0,
      loai: loai || "",
    });

    return res.status(201).json({ success: true, data: newDoc });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ success: false, message: "doc_number đã tồn tại" });
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// ADD MANY  –  POST /api/nangsuat/many
// ─────────────────────────────────────────────
const addManyNangSuat = async (req, res) => {
  try {
    const { docs } = req.body;

    if (!Array.isArray(docs) || docs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Body phải có field 'docs' là mảng không rỗng",
      });
    }

    const errors = [];
    docs.forEach((d, idx) => {
      if (!d.doc_number || !d.status || !d.from_zone || !d.to_zone)
        errors.push(
          `Index ${idx}: doc_number, status, from_zone, to_zone là bắt buộc`,
        );
    });
    if (errors.length > 0)
      return res.status(400).json({ success: false, errors });

    const prepared = docs.map((d) => ({
      doc_number: d.doc_number,
      status: d.status,
      from_zone: d.from_zone,
      to_zone: d.to_zone,
      date_assigned: d.date_assigned || null,
      time_assigned: d.time_assigned || "",
      date_completed: d.date_completed || null,
      time_completed: d.time_completed || "",
      assigned_to: d.assigned_to || null, // ← String, bỏ isValidObjectId check
      total_lines: d.total_lines || 0,
      total_eaches: d.total_eaches || 0,
      total_reaches: d.total_reaches || 0,
      time_complete_phieu: d.time_complete_phieu || "",
      status_phieu: d.status_phieu || 0,
      loai: d.loai || "",
    }));

    const result = await NangSuat.insertMany(prepared, {
      ordered: false,
      rawResult: true,
    });

    return res.status(201).json({
      success: true,
      inserted: result.insertedCount,
      message: `Đã thêm ${result.insertedCount}/${docs.length} phiếu`,
    });
  } catch (error) {
    if (error.name === "MongoBulkWriteError") {
      const inserted = error.result?.nInserted ?? 0;
      const duplicates = error.writeErrors?.map((e) => e.err?.op?.doc_number);
      return res.status(207).json({
        success: false,
        message: `Chèn một phần: ${inserted} thành công`,
        inserted,
        duplicates,
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE ONE  –  PUT /api/nangsuat/:id
// ─────────────────────────────────────────────
const updateOneNangSuat = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id))
      return res
        .status(400)
        .json({ success: false, message: "ID không hợp lệ" });

    delete req.body.doc_number;

    const updated = await NangSuat.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true },
    );

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu" });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// ASSIGN  –  PATCH /api/nangsuat/:id/assign
// Body: { assigned_to (String), date_assigned, time_assigned }
// ─────────────────────────────────────────────
const assignOneNangSuat = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id))
      return res
        .status(400)
        .json({ success: false, message: "ID không hợp lệ" });

    const { assigned_to, date_assigned, time_assigned } = req.body;

    if (!assigned_to)
      return res
        .status(400)
        .json({ success: false, message: "assigned_to là bắt buộc" });

    const updated = await NangSuat.findByIdAndUpdate(
      id,
      {
        $set: {
          assigned_to,
          date_assigned: date_assigned || new Date(),
          time_assigned: time_assigned || "",
          status: "assigned",
        },
      },
      { new: true, runValidators: true },
    );

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu" });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// COMPLETE  –  PATCH /api/nangsuat/:id/complete
// ─────────────────────────────────────────────
const completeOneNangSuat = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id))
      return res
        .status(400)
        .json({ success: false, message: "ID không hợp lệ" });

    const { date_completed, time_completed, time_complete_phieu } = req.body;

    const updated = await NangSuat.findByIdAndUpdate(
      id,
      {
        $set: {
          date_completed: date_completed || new Date(),
          time_completed: time_completed || "",
          time_complete_phieu: time_complete_phieu || "",
          status: "completed",
          status_phieu: 1,
        },
      },
      { new: true, runValidators: true },
    );

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu" });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE ONE  –  DELETE /api/nangsuat/:id
// ─────────────────────────────────────────────
const deleteOneNangSuat = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id))
      return res
        .status(400)
        .json({ success: false, message: "ID không hợp lệ" });

    const deleted = await NangSuat.findByIdAndDelete(id);
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu" });

    return res
      .status(200)
      .json({ success: true, message: "Đã xóa phiếu thành công" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE MANY  –  DELETE /api/nangsuat/many
// ─────────────────────────────────────────────
const deleteManyNangSuat = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "'ids' phải là mảng không rỗng" });

    const validIds = ids.filter((id) => isValidObjectId(id));
    const result = await NangSuat.deleteMany({ _id: { $in: validIds } });

    return res.status(200).json({
      success: true,
      deleted: result.deletedCount,
      message: `Đã xóa ${result.deletedCount} phiếu`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE MANY  –  PUT /api/nangsuat/many
// ─────────────────────────────────────────────
const updateManyNangSuat = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Body phải có field 'updates' là mảng không rỗng",
      });
    }

    const errors = [];
    updates.forEach((u, idx) => {
      if (!u.id || !isValidObjectId(u.id))
        errors.push(`Index ${idx}: 'id' không hợp lệ`);
      if (!u.data || typeof u.data !== "object" || Array.isArray(u.data))
        errors.push(`Index ${idx}: 'data' phải là object`);
    });
    if (errors.length > 0)
      return res.status(400).json({ success: false, errors });

    const bulkOps = updates.map((u) => {
      const { doc_number, ...safeData } = u.data;
      return {
        updateOne: {
          filter: { _id: u.id },
          update: { $set: safeData },
          runValidators: true,
        },
      };
    });

    const result = await NangSuat.bulkWrite(bulkOps, { ordered: false });

    return res.status(200).json({
      success: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      message: `Đã cập nhật ${result.modifiedCount}/${updates.length} phiếu`,
    });
  } catch (error) {
    if (error.name === "MongoBulkWriteError") {
      return res.status(207).json({
        success: false,
        message: "Cập nhật một phần do lỗi",
        matched: error.result?.nMatched ?? 0,
        modified: error.result?.nModified ?? 0,
        errors: error.writeErrors?.map((e) => ({
          index: e.index,
          message: e.errmsg,
        })),
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllNangSuat,
  getOneNangSuat,
  getByDocNumberNangSuat,
  addOneNangSuat,
  addManyNangSuat,
  updateOneNangSuat,
  updateManyNangSuat,
  assignOneNangSuat,
  completeOneNangSuat,
  deleteOneNangSuat,
  deleteManyNangSuat,
};
