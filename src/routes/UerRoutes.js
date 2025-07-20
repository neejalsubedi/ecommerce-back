// src/routes/userRoute.js

const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authenticate = require("../middleware/authMiddlewar");

// ✅ Route: Get logged-in user
router.get("/user/details", authenticate, async (req, res) => {
  try {
    const userId = req.user.id; // From decoded token
    const user = await User.findById(userId).select("-password"); // exclude password

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

module.exports = router;
