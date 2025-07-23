const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
  },
  image: String,
  size: {
    type: [String],
    enum: ["S", "M", "L", "XL", "XXL", "XXXL"],
  },
});

module.exports = mongoose.model("Product", productSchema);
