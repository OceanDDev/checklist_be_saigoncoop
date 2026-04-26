const express = require("express");
const router = express.Router();

const inventoryController = require("../../controllers/TonKho/tonkho.controller");

// ==========================
// 📥 GET (lọc theo query)
// ==========================
router.get("/tonkho", inventoryController.getInventories);
router.get("/tonkho/:id", inventoryController.getInventoryById);
// ==========================
// ➕ ADD
// ==========================
router.post("/tonkho", inventoryController.addInventory); // thêm 1
router.post("/tonkho/many", inventoryController.addManyInventory); // thêm nhiều

// ==========================
// 🔥 UPSERT (QUAN TRỌNG NHẤT)
// ==========================
router.post("/tonkho/upsert", inventoryController.upsertManyInventory);
// ==========================
// 🔄 UPDATE
// ==========================
router.put("/tonkho/:id", inventoryController.updateInventory); // update 1

// ==========================
// ❌ DELETE
// ==========================
router.delete("/tonkho/:id", inventoryController.deleteInventory); // xóa 1
router.delete("/tonkho/many", inventoryController.deleteManyInventory); // xóa nhiều

module.exports = router;
