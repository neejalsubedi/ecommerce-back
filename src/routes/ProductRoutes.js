const express = require("express");
const multer = require("multer");
const router = express.Router();
const Product = require("../models/Products");
const authenticate = require("./../middleware/authMiddlewar");
const authorizeRoles = require("./../middleware/roleMiddleware");

router.get("/product", async (req, res) => {
  try {
    const products = await Product.find().populate("category");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error });
  }
});
router.get("/product/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category");
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Error fetching product", error });
  }
});

// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Make sure 'uploads' folder exists
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName); // ✅ this is correct
  },
});

const upload = multer({ storage });

// POST a product with image
router.post(
  "/addProduct",
  upload.single("image"),
  authenticate,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const { name, description, price, category, stock, size } = req.body;
      const imagePath = req.file ? req.file.filename : null;
         const parsedSize = typeof size === "string" ? JSON.parse(size) : size;

      const product = new Product({
        name,
        description,
        price,
        category,
        size:parsedSize,
        stock,
        image: imagePath, // just the filename
      });

      await product.save();
      res.status(201).json({ message: "Product created", product });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error saving product", error: error.message });
    }
  }
);

// DELETE product by ID
router.delete(
  "/delete/:id",
  authenticate,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const deletedProduct = await Product.findByIdAndDelete(req.params.id);
      if (!deletedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting product", error });
    }
  }
);

// PUT update product (with optional image)
router.put(
  "/update/:id",
  upload.single("image"),
  authenticate,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const { name, description, price, category, stock, size } = req.body;
      const imagePath = req.file ? req.file.filename : undefined;
         const parsedSize = typeof size === "string" ? JSON.parse(size) : size;

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        {
          name,
          description,
          price,
          stock,
          size:parsedSize,
          category,
          ...(imagePath && { image: imagePath }),
        },
        { new: true }
      );

      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json({ message: "Product updated", product: updatedProduct });
    } catch (error) {
      res.status(500).json({ message: "Error updating product", error });
    }
  }
);

module.exports = router;
