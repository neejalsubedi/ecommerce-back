const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const authenticate = require("./../middleware/authMiddlewar");
const authorizeRoles = require("./../middleware/roleMiddleware");



// GET all categories
router.get('/category', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Error fetching categories", error });
  }
});

// POST a category
router.post('/addCategory', authenticate,authorizeRoles("admin"), async (req, res) => {
  try {
    const category = new Category(req.body);
    await category.save();
    res.status(201).json({ message: "Category added", category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

module.exports = router;
