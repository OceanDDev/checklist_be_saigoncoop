const ChecklistBDHForm = require("../../models/checklistformbdh/checklistformbdh");

// Tạo form
exports.createForm = async (req, res) => {
  try {
    const newForm = new ChecklistBDHForm(req.body);
    const saved = await newForm.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy tất cả form
exports.getAllForms = async (req, res) => {
  try {
    const forms = await ChecklistBDHForm.find();
    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy theo ID
exports.getFormById = async (req, res) => {
  try {
    const form = await ChecklistBDHForm.findById(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found" });
    res.json(form);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteForm = async (req, res) => {
  try {
    const deletedForm = await ChecklistBDHForm.findByIdAndDelete(req.params.id);
    if (!deletedForm) return res.status(404).json({ message: "Form not found" });
    res.json({ message: "Form deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cập nhật form theo ID
exports.updateFormById = async (req, res) => {
  try {
    const updatedForm = await ChecklistBDHForm.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedForm) return res.status(404).json({ message: "Form not found" });
    res.json(updatedForm);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

