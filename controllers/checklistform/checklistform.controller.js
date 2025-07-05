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

// Cập nhật checklist form theo ID
exports.updateChecklistForm = async (req, res) => {
  try {
    const updatedForm = await ChecklistForm.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true } // Trả về bản ghi mới sau khi cập nhật và kiểm tra ràng buộc
    );

    if (!updatedForm) {
      return res.status(404).json({ error: "Checklist form không tồn tại" });
    }

    res.json(updatedForm);
  } catch (err) {
    res.status(500).json({ error: "Cập nhật checklist form thất bại", details: err });
  }
};

// Xóa checklist form theo ID
exports.deleteChecklistForm = async (req, res) => {
  try {
    const deletedForm = await ChecklistForm.findByIdAndDelete(req.params.id);

    if (!deletedForm) {
      return res.status(404).json({ error: "Checklist form không tồn tại" });
    }

    res.json({ message: "Xóa checklist form thành công" });
  } catch (err) {
    res.status(500).json({ error: "Xóa checklist form thất bại", details: err });
  }
};
