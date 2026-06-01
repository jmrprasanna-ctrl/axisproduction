const express = require("express");
const router = express.Router();
const purchaseOrderController = require("../controllers/purchaseOrderController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const manageOrDemoUserMiddleware = require("../middleware/manageOrDemoUserMiddleware");

router.get("/next-code", authMiddleware, roleMiddleware(["admin", "manager", "user"]), purchaseOrderController.getNextCode);
router.get("/", authMiddleware, roleMiddleware(["admin", "manager", "user"]), purchaseOrderController.listPurchaseOrders);
router.post("/", authMiddleware, manageOrDemoUserMiddleware, purchaseOrderController.createPurchaseOrder);

module.exports = router;
