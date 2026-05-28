const express = require("express");
const router = express.Router();
const rentalMachineController = require("../controllers/rentalMachineController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", authMiddleware, roleMiddleware(["admin", "manager", "user"]), rentalMachineController.getRentalMachines);

module.exports = router;
