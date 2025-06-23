const ChecklistForm = require("../../models/checklistform/checklistform");

exports.createChecklistForm = async (req, res) => {
  try {
    const form = new ChecklistForm(req.body);
    const saved = await form.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: "Tạo checklist form thất bại", details: err });
  }
};

exports.getAllChecklistForms = async (req, res) => {
  try {
    const forms = await ChecklistForm.find();
    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: "Lấy danh sách checklist form thất bại", details: err });
  }
};

exports.getChecklistFormById = async (req, res) => {
  try {
    const form = await ChecklistForm.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ error: "Checklist form không tồn tại" });
    }
    res.json(form);
  } catch (err) {
    res.status(500).json({ error: "Lấy checklist form thất bại", details: err });
  }
};
