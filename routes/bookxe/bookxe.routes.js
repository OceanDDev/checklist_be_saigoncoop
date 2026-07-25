const express = require("express");
const router = express.Router();

const {
  getAllBookXe,
  getBookXeById,
  createBookXe,
  updateBookXe,
  updateTrangThai,
  deleteBookXe,
  deleteManyBookXe,
} = require("../../controllers/bookxe/bookxe.controller"); // chỉnh lại path cho đúng vị trí controller thực tế

// (nếu có middleware auth, thêm vào đây, vd: const { verifyToken } = require("../middleware/auth");)

router.get("bookxe/", getAllBookXe);
router.get("bookxe/:id", getBookXeById);
router.post("bookxe/", createBookXe);
router.put("bookxe/:id", updateBookXe);
router.patch("bookxe/:id/trang-thai", updateTrangThai);
router.delete("bookxe/:id", deleteBookXe);
router.delete("bookxe/", deleteManyBookXe);

module.exports = router;