const express = require("express");
const router = express.Router();
const controller = require("../../controllers/checklistformbdh/checklistformbdh.controller");

router.post("/checklistbdhform", controller.createForm);
router.get("/checklistbdhform", controller.getAllForms);
router.get("/checklistbdhform/:id", controller.getFormById);
router.delete("/checklistbdhform/:id", controller.deleteForm);
router.put("/checklistbdhform/:id", controller.updateFormById);

        
module.exports = router;
