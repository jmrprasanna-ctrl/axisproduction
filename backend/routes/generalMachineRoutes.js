const express = require("express");
const router = express.Router();
const generalMachineController = require("../controllers/generalMachineController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", authMiddleware, roleMiddleware(["admin", "manager", "user"]), generalMachineController.getGeneralMachines);

module.exports = router;
