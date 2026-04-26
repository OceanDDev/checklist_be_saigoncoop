const BaiHoc = require("../../models/learningSCL/BaiHoc");
const KhoaHoc = require("../../models/learningSCL/khoaHoc");
const { s3 } = require("../../middlewares/uploadLearning");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Tạo bài học mới trong khóa học
exports.taoMoi = async (req, res) => {
  try {
    const baiHoc = await BaiHoc.create({
      ...req.body,
      khoaHocId: req.params.khoaHocId,
    });
    await KhoaHoc.findByIdAndUpdate(req.params.khoaHocId, {
      $push: { danhSachBaiHoc: baiHoc._id },
    });
    res.status(201).json(baiHoc);
  } catch (err) {
    res.status(400).json({ loi: err.message });
  }
};

// Lấy 1 bài học theo id
exports.layMot = async (req, res) => {
  try {
    const baiHoc = await BaiHoc.findById(req.params.id).populate(
      "baiKiemTraId",
      "tieuDe caiDat danhSachCauHoi",
    );
    if (!baiHoc) return res.status(404).json({ loi: "Không tìm thấy bài học" });
    res.json(baiHoc);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Cập nhật bài học
exports.capNhat = async (req, res) => {
  try {
    const baiHoc = await BaiHoc.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!baiHoc) return res.status(404).json({ loi: "Không tìm thấy bài học" });
    res.json(baiHoc);
  } catch (err) {
    res.status(400).json({ loi: err.message });
  }
};



// Upload tài liệu lên Backblaze B2
exports.uploadTaiLieu = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ loi: "Không có file tài liệu" });

    const { originalname, b2Key } = req.file; // ← thêm dòng này

    const ext = originalname.split(".").pop().toLowerCase();
    const loai = ext === "pdf" ? "pdf" : ext === "docx" ? "docx" : "khac";

    const baiHoc = await BaiHoc.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          taiLieu: { ten: originalname, b2Key, loai },
        },
      },
      { new: true },
    );
    res.json(baiHoc);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Lấy presigned URL để xem tài liệu (hết hạn sau 1 giờ)
exports.layUrlTaiLieu = async (req, res) => {
  try {
    const baiHoc = await BaiHoc.findById(req.params.id);
    if (!baiHoc) return res.status(404).json({ loi: "Không tìm thấy bài học" });

    const taiLieu = baiHoc.taiLieu.id(req.params.taiLieuId);
    if (!taiLieu)
      return res.status(404).json({ loi: "Không tìm thấy tài liệu" });

    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET,
      Key: taiLieu.b2Key,
    });

    // Link tạm thời, hết hạn sau 1 tiếng
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.json({ url });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Xóa tài liệu khỏi bài học
exports.xoaTaiLieu = async (req, res) => {
  try {
    const baiHoc = await BaiHoc.findByIdAndUpdate(
      req.params.id,
      { $pull: { taiLieu: { _id: req.params.taiLieuId } } },
      { new: true },
    );
    res.json(baiHoc);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Xóa bài học
exports.xoa = async (req, res) => {
  try {
    const baiHoc = await BaiHoc.findByIdAndDelete(req.params.id);
    if (!baiHoc) return res.status(404).json({ loi: "Không tìm thấy bài học" });
    await KhoaHoc.findByIdAndUpdate(baiHoc.khoaHocId, {
      $pull: { danhSachBaiHoc: baiHoc._id },
    });
    res.json({ thongBao: "Đã xóa bài học" });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};
