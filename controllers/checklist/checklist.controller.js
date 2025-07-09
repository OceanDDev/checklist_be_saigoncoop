const Checklist = require("../../models/checklist/checklist");
const dayjs = require("dayjs");
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

// Tạo checklist mới
exports.createChecklist = async (req, res) => {
  try {
    const formId = req.params.formId;

    if (!formId) {
      return res.status(400).json({ error: "Thiếu formId trong URL." });
    }

    req.body.form_id = formId;

    // Kiểm tra xem option_da_chon có đúng định dạng không
    if (req.body.option_da_chon && !Array.isArray(req.body.option_da_chon)) {
      return res.status(400).json({ error: "Trường option_da_chon phải là mảng." });
    }

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

// /controllers/checklist.controller.js
exports.checkDuplicate = async (req, res) => {
  const { formId } = req.params;
  const { soHieuXe } = req.query;

  if (!soHieuXe) {
    return res.status(400).json({ error: "Thiếu tham số soHieuXe." });
  }

  // Sử dụng múi giờ VN để reset đúng 00:00 VN
  const start = dayjs().tz('Asia/Ho_Chi_Minh').startOf("day").toDate();    
  const end = dayjs().tz('Asia/Ho_Chi_Minh').endOf("day").toDate();

  // Debug log (có thể xóa sau khi test xong)
  console.log('VN Start:', start);
  console.log('VN End:', end);
  console.log('Current VN:', dayjs().tz('Asia/Ho_Chi_Minh').toDate());

  try {
    const checklist = await Checklist.findOne({
      form_id: formId,
      option_da_chon: {
        $elemMatch: {
          label: { $regex: /^\s*Số hiệu xe\s*$/i },
          value: { $regex: `^\\s*${soHieuXe}\\s*$`, $options: "i" }
        },
      },
      ngay_tao: { $gte: start, $lte: end },
    });

    if (checklist) {
      // Debug log
      console.log('Found checklist ngay_tao:', checklist.ngay_tao);
      
      return res.json({
        exists: true,
        ma_nhan_vien: checklist.ma_nhan_vien,
        ho_ten: checklist.ho_ten,
      });
    }

    res.json({ exists: false });
  } catch (err) {
    console.error("Lỗi kiểm tra trùng số hiệu xe:", err);
    res.status(500).json({ error: "Lỗi kiểm tra số hiệu xe nâng." });
  }
};


