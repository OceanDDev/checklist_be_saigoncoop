const Checklist = require("../../models/checklist/checklist");

// Tạo checklist mới
exports.createChecklist = async (req, res) => {
  try {
    const formId = req.params.formId;

    if (!formId) {
      return res.status(400).json({ error: "Thiếu formId trong URL." });
    }

    // Gắn form_id vào body
    req.body.form_id = formId;

    const checklist = new Checklist(req.body);
    await checklist.save();

    res.status(201).json({ message: "Checklist đã được lưu", checklist });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


// Lấy toàn bộ checklist
exports.getAllChecklist = async (req, res) => {
  try {
    const data = await Checklist.find().sort({ ngay_tao: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getChecklistById = async (req, res) => {
  try {
    const checklist = await Checklist.findById(req.params.id);
    if (!checklist) {
      return res.status(404).json({ error: "Checklist không tồn tại" });
    }
    res.json(checklist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCheckListsByFormId = async (req, res) => {
  try {
    const { formId } = req.params;
    const checklists = await Checklist.find({ form_id: formId });
    res.json(checklists);
  } catch (error) {
    console.error("Lỗi khi lấy checklist theo form:", error);
    res.status(500).json({ error: "Server error" });
  }
};