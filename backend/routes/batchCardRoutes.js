const express = require("express");
const router = express.Router();
const batchCardController = require("../controllers/batchCardController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const manageOrDemoUserMiddleware = require("../middleware/manageOrDemoUserMiddleware");

router.get("/generate-batch-no", authMiddleware, roleMiddleware(["admin", "manager", "user"]), batchCardController.generateBatchNumber);
router.get("/", authMiddleware, roleMiddleware(["admin", "manager", "user"]), batchCardController.listBatches);
router.get("/by-batch/:batchNumber", authMiddleware, roleMiddleware(["admin", "manager", "user"]), batchCardController.getBatchByBatchNumber);
router.get("/:id", authMiddleware, roleMiddleware(["admin", "manager", "user"]), batchCardController.getBatchById);
router.post("/", authMiddleware, manageOrDemoUserMiddleware, batchCardController.createBatch);
router.put("/by-batch/:batchNumber", authMiddleware, manageOrDemoUserMiddleware, batchCardController.updateBatchByBatchNumber);
router.put("/:id", authMiddleware, manageOrDemoUserMiddleware, batchCardController.updateBatch);
router.delete("/:id", authMiddleware, manageOrDemoUserMiddleware, batchCardController.deleteBatch);

module.exports = router;
