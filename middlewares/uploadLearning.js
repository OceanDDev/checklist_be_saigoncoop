const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ── CLOUDINARY (video) ────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storageVideo = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "saigoncoop/videos",
    resource_type: "video",
    allowed_formats: ["mp4", "mov", "avi", "mkv"],
  },
});

const filterVideo = (req, file, cb) => {
  const allowed = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
  ];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Chỉ chấp nhận file video"), false);
};

const storageAnhBia = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "saigoncoop/anh-bia",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 1280, height: 720, crop: "limit", quality: "auto" },
    ], // tự nén xuống
  },
});

exports.uploadAnhBia = multer({
  storage: storageAnhBia,
  limits: { fileSize: 20 * 1024 * 1024 }, // tăng lên 20MB
}).single("anhBia");

// ── BACKBLAZE B2 ──────────────────────────────
const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
});

const filterTaiLieu = (req, file, cb) => {
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Chỉ chấp nhận PDF hoặc Word"), false);
};

// Bước 1: đọc file vào RAM
exports.uploadTaiLieu = multer({
  storage: multer.memoryStorage(),
  fileFilter: filterTaiLieu,
  limits: { fileSize: 200 * 1024 * 1024 },
}).single("doc");

// Bước 2: nén PDF (nếu có) rồi đẩy lên B2
exports.uploadTaiLieuToB2 = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const ext = req.file.originalname.split(".").pop().toLowerCase();
    const safeName = req.file.originalname
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "_");
    const key = `tailieu/${Date.now()}-${safeName}.${ext}`;

    let fileBuffer = req.file.buffer;

    // Tự động nén nếu là PDF
    if (ext === "pdf") {
      const tmpIn = path.join(os.tmpdir(), `in_${Date.now()}.pdf`);
      const tmpOut = path.join(os.tmpdir(), `out_${Date.now()}.pdf`);

      fs.writeFileSync(tmpIn, fileBuffer);

      try {
        execSync(
          `"C:\\Program Files\\gs\\gs10.07.0\\bin\\gswin64c.exe" -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${tmpOut}" "${tmpIn}"`,
          { timeout: 120000 },
        );
        fileBuffer = fs.readFileSync(tmpOut);
        console.log(
          `✅ Nén PDF: ${(req.file.size / 1024 / 1024).toFixed(1)}MB → ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB`,
        );
      } catch (e) {
        console.warn("⚠ Nén thất bại, dùng file gốc:", e.message);
      } finally {
        if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
        if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
      }
    }

    const upload = new Upload({
      client: s3,
      params: {
        Bucket: process.env.B2_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: req.file.mimetype,
      },
    });

    await upload.done();
    req.file.b2Key = key;
    console.log("✅ B2 OK:", key);
    next();
  } catch (err) {
    console.error("❌ B2 Error:", err.message);
    res.status(500).json({ loi: "Lỗi upload B2: " + err.message });
  }
};

exports.s3 = s3;
