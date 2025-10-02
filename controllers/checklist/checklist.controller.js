const Checklist = require("../../models/checklist/checklist");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

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
      return res
        .status(400)
        .json({ error: "Trường option_da_chon phải là mảng." });
    }

    // SET THỜI GIAN THEO TIMEZONE VN
    if (!req.body.ngay_tao) {
      req.body.ngay_tao = dayjs().tz("Asia/Ho_Chi_Minh").toDate();
    }

    const checklist = new Checklist(req.body);
    await checklist.save();

    res.status(201).json({ message: "Checklist đã được lưu", checklist });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lấy toàn bộ checklist với phân trang và filter
exports.getAllChecklist = async (req, res) => {
  try {
    // Lấy tham số phân trang từ query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Lấy các tham số filter
    const search = req.query.search || "";
    const searchMaNV = req.query.searchMaNV || "";
    const selectedOption = req.query.selectedOption || "";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Tạo query filter
    let filter = {};
    let andConditions = [];

    // Filter theo search chung
    if (search) {
      andConditions.push({
        $or: [
          { ma_nhan_vien: { $regex: search, $options: "i" } },
          { ho_ten: { $regex: search, $options: "i" } },
          { "option_da_chon.value": { $regex: search, $options: "i" } },
        ],
      });
    }

    // Filter theo mã nhân viên
    if (searchMaNV) {
      andConditions.push({
        ma_nhan_vien: { $regex: searchMaNV, $options: "i" },
      });
    }

    // Filter theo option đã chọn (format: "label: value")
    if (selectedOption) {
      const [label, value] = selectedOption.split(":").map((s) => s.trim());
      if (label && value) {
        andConditions.push({
          option_da_chon: {
            $elemMatch: {
              label: { $regex: `^\\s*${label}\\s*$`, $options: "i" },
              value: { $regex: `^\\s*${value}\\s*$`, $options: "i" },
            },
          },
        });
      }
    }

    // Filter theo khoảng ngày - FIX TIMEZONE VN
    if (startDate && endDate) {
      const start = dayjs
        .tz(startDate, "Asia/Ho_Chi_Minh")
        .startOf("day")
        .toDate();
      const end = dayjs.tz(endDate, "Asia/Ho_Chi_Minh").endOf("day").toDate();
      andConditions.push({
        ngay_tao: { $gte: start, $lte: end },
      });
    }

    // Kết hợp tất cả điều kiện
    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    // Thực hiện query với phân trang
    const data = await Checklist.find(filter)
      .sort({ ngay_tao: -1 })
      .skip(skip)
      .limit(limit);

    // Đếm tổng số record để tính pagination info
    const total = await Checklist.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Lỗi getAllChecklist:", err);
    res.status(500).json({ error: err.message });
  }
};

// Lấy checklist theo form ID với phân trang và filter
exports.getCheckListsByFormId = async (req, res) => {
  try {
    const { formId } = req.params;

    // Lấy tham số phân trang từ query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Lấy các tham số filter
    const search = req.query.search || "";
    const searchMaNV = req.query.searchMaNV || "";
    const selectedOption = req.query.selectedOption || "";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Tạo query filter - bắt đầu với form_id
    let filter = { form_id: formId };
    let andConditions = [{ form_id: formId }];

    // Filter theo search chung
    if (search) {
      andConditions.push({
        $or: [
          { ma_nhan_vien: { $regex: search, $options: "i" } },
          { ho_ten: { $regex: search, $options: "i" } },
          { "option_da_chon.value": { $regex: search, $options: "i" } },
        ],
      });
    }

    // Filter theo mã nhân viên
    if (searchMaNV) {
      andConditions.push({
        ma_nhan_vien: { $regex: searchMaNV, $options: "i" },
      });
    }

    // Filter theo option đã chọn (format: "label: value")
    if (selectedOption) {
      const [label, value] = selectedOption.split(":").map((s) => s.trim());
      if (label && value) {
        andConditions.push({
          option_da_chon: {
            $elemMatch: {
              label: { $regex: `^\\s*${label}\\s*$`, $options: "i" },
              value: { $regex: `^\\s*${value}\\s*$`, $options: "i" },
            },
          },
        });
      }
    }

    // Filter theo khoảng ngày - FIX TIMEZONE VN
    if (startDate && endDate) {
      const start = dayjs
        .tz(startDate, "Asia/Ho_Chi_Minh")
        .startOf("day")
        .toDate();
      const end = dayjs.tz(endDate, "Asia/Ho_Chi_Minh").endOf("day").toDate();
      andConditions.push({
        ngay_tao: { $gte: start, $lte: end },
      });
    }

    // Kết hợp tất cả điều kiện
    if (andConditions.length > 1) {
      filter = { $and: andConditions };
    }

    // Thực hiện query với phân trang
    const checklists = await Checklist.find(filter)
      .sort({ ngay_tao: -1 })
      .skip(skip)
      .limit(limit);

    // Đếm tổng số record
    const total = await Checklist.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      data: checklists,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy checklist theo form:", error);
    res.status(500).json({ error: "Server error" });
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

// Xóa checklist theo ID
exports.deleteChecklist = async (req, res) => {
  try {
    const checklist = await Checklist.findByIdAndDelete(req.params.id);

    if (!checklist) {
      return res.status(404).json({ error: "Checklist không tồn tại." });
    }

    res.json({ message: "Checklist đã được xóa thành công." });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi xóa checklist." });
  }
};

// Kiểm tra trùng lặp
exports.checkDuplicate = async (req, res) => {
  const { formId } = req.params;
  const { soHieuXe } = req.query;

  if (!soHieuXe) {
    return res.status(400).json({ error: "Thiếu tham số soHieuXe." });
  }

  // Sử dụng múi giờ VN để reset đúng 00:00 VN
  const start = dayjs().tz("Asia/Ho_Chi_Minh").startOf("day").toDate();
  const end = dayjs().tz("Asia/Ho_Chi_Minh").endOf("day").toDate();

  // Debug log (có thể xóa sau khi test xong)
  console.log("VN Start:", start);
  console.log("VN End:", end);
  console.log("Current VN:", dayjs().tz("Asia/Ho_Chi_Minh").toDate());

  try {
    const checklist = await Checklist.findOne({
      form_id: formId,
      option_da_chon: {
        $elemMatch: {
          label: { $regex: /^\s*Số hiệu xe\s*$/i },
          value: { $regex: `^\\s*${soHieuXe}\\s*$`, $options: "i" },
        },
      },
      ngay_tao: { $gte: start, $lte: end },
    });

    if (checklist) {
      // Debug log
      console.log("Found checklist ngay_tao:", checklist.ngay_tao);

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

exports.getAvailableOptions = async (req, res) => {
  try {
    const { formId } = req.params;
    const { startDate, endDate } = req.query;

    if (!formId) return res.status(400).json({ error: "Thiếu formId." });
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Thiếu startDate hoặc endDate (YYYY-MM-DD)." });
    }

    // Cắt ngày theo múi giờ VN để không lệch ngày - FIX TIMEZONE
    const start = dayjs
      .tz(startDate, "Asia/Ho_Chi_Minh")
      .startOf("day")
      .toDate();
    const end = dayjs.tz(endDate, "Asia/Ho_Chi_Minh").endOf("day").toDate();

    const results = await Checklist.aggregate([
      {
        // Match cho cả trường hợp form_id là ObjectId hoặc string
        $match: {
          $expr: { $eq: [{ $toString: "$form_id" }, String(formId)] },
          ngay_tao: { $gte: start, $lte: end },
          option_da_chon: { $type: "array", $ne: [] },
        },
      },
      { $unwind: "$option_da_chon" },
      {
        $project: {
          originalLabel: { $ifNull: ["$option_da_chon.label", ""] },
          originalValue: { $ifNull: ["$option_da_chon.value", ""] },
          normLabel: {
            $toLower: {
              $trim: { input: { $ifNull: ["$option_da_chon.label", ""] } },
            },
          },
          normValue: {
            $toLower: {
              $trim: { input: { $ifNull: ["$option_da_chon.value", ""] } },
            },
          },
        },
      },
      { $match: { normLabel: { $ne: "" }, normValue: { $ne: "" } } },
      {
        // Group theo giá trị chuẩn hoá để gộp đúng, nhưng giữ lại phiên bản hiển thị gốc
        $group: {
          _id: { label: "$normLabel", value: "$normValue" },
          count: { $sum: 1 },
          firstLabel: { $first: "$originalLabel" },
          firstValue: { $first: "$originalValue" },
        },
      },
      {
        $project: {
          _id: 0,
          label: "$firstLabel",
          value: "$firstValue",
          count: 1,
        },
      },
      { $sort: { label: 1, value: 1 } },
    ]);

    return res.json({ options: results }); // [{label, value, count}]
  } catch (err) {
    console.error("Lỗi getAvailableOptions:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
