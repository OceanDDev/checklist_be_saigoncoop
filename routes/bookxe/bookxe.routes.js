const express = require("express");
const router = express.Router();

const bookXeController = require("../../controllers/bookxe/bookxe.controller"); // chỉnh lại path cho đúng vị trí controller thực tế
const historyBookXeController = require("../../controllers/bookxe/historyBookXe.controller"); // chỉnh lại path cho đúng vị trí controller thực tế
const { verifyToken } = require("../../middlewares/authMiddleware"); // chỉnh lại path cho đúng vị trí middleware thực tế

// ── BookXe (admin - cần login) ───────────────────────────────────────────────
router.get("/bookxe", verifyToken, bookXeController.getAllBookXe);
router.get("/bookxe/:id", verifyToken, bookXeController.getBookXeById);
router.post("/bookxe", verifyToken, bookXeController.createBookXe);
router.put("/bookxe/:id", verifyToken, bookXeController.updateBookXe);
router.patch(
  "/bookxe/:id/trang-thai",
  verifyToken,
  bookXeController.updateTrangThai,
);
router.delete("/bookxe/:id", verifyToken, bookXeController.deleteBookXe);
router.delete("/bookxe", verifyToken, bookXeController.deleteManyBookXe);

// ── HistoryBookXe (admin - cần login) ────────────────────────────────────────
router.get(
  "/historybookxe",
  verifyToken,
  historyBookXeController.getAllHistoryBookXe,
);
router.get(
  "/historybookxe/:id",
  verifyToken,
  historyBookXeController.getHistoryBookXeById,
);
router.post(
  "/historybookxe",
  verifyToken,
  historyBookXeController.createHistoryBookXe,
);
router.post(
  "/historybookxe/import-many",
  verifyToken,
  historyBookXeController.importManyHistoryBookXe,
);
router.put(
  "/historybookxe/:id",
  verifyToken,
  historyBookXeController.updateHistoryBookXe,
);
router.delete(
  "/historybookxe/:id",
  verifyToken,
  historyBookXeController.deleteHistoryBookXe,
);
router.delete(
  "/historybookxe",
  verifyToken,
  historyBookXeController.deleteManyHistoryBookXe,
);

module.exports = router;
