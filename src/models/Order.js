// models/Order.js
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: String,
  price: Number,
  quantity: Number,
  image: String,
});

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [orderItemSchema],
  deliveryInfo: {
    name: String,
    phone: String,
    address: String,
  },
  paymentMethod: {
    type: String,
    enum: ["COD", "Khalti", "eSewa", "Stripe"],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid", "Failed"],
    default: "Pending",
  },
  orderStatus: {
    type: String,
    enum: ["Processing", "On the Way", "Delivered", "Completed", "Cancelled"],
    default: "Processing",
  },
  totalPrice: Number,
  transactionUUID: String, // ✅ Used separately for eSewa txn id
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
