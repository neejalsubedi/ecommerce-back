const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Products");
const authenticate = require("../middleware/authMiddlewar");
const axios = require("axios");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const authorizeRoles = require("./../middleware/roleMiddleware");
// var request = require("request");

const ESEWA_MERCHANT_CODE = "EPAYTEST";
const KHALTI_SECRET_KEY = "9e7c49d6b8da4645b7e6b7cb89f2d0bb";

// Generate HMAC signature
function generateEsewaSignature({
  total_amount,
  transaction_uuid,
  product_code,
}) {
  const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
  return crypto
    .createHmac("sha256", ESEWA_SECRET_KEY)
    .update(message)
    .digest("base64");
}

// POST /api/orders/place
router.post("/place", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, deliveryInfo, paymentMethod } = req.body;

    if (!items?.length)
      return res.status(400).json({ message: "Cart is empty" });

    if (paymentMethod !== "COD") {
      return res.status(400).json({ message: "Only COD supported here" });
    }

    const orderItems = await Promise.all(
      items.map(async ({ productId, quantity }) => {
        const product = await Product.findById(productId);
        if (!product) throw new Error("Invalid product in cart");
        if (product.stock < quantity) {
          throw new Error(`${product.name} has only ${product.stock} left`);
        }
        product.stock -= quantity;
        await product.save();
        return {
          product: product._id,
          name: product.name,
          price: product.price,
          quantity,
          image: product.image,
        };
      })
    );

    const totalPrice = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const order = new Order({
      user: userId,
      items: orderItems,
      deliveryInfo,
      paymentMethod,
      totalPrice,
      paymentStatus: "Pending", // COD is auto marked paid
      transactionUUID: uuidv4(),
    });

    await order.save();

    return res.status(201).json({
      message: "COD Order placed successfully",
      orderId: order._id,
    });
  } catch (err) {
    console.error("COD Order Error:", err);
    res.status(500).json({ message: "Failed to place COD order" });
  }
});
router.post("/khalti/initiate", authenticate, async (req, res) => {
  const { items, deliveryInfo } = req.body;
  const userId = req.user.id;

  try {
    if (!items?.length) return res.status(400).json({ message: "Cart empty" });

    const orderItems = await Promise.all(
      items.map(async ({ productId, quantity }) => {
        const product = await Product.findById(productId);
        if (!product) throw new Error("Invalid product in cart");
        if (product.stock < quantity) {
          throw new Error(`${product.name} has only ${product.stock} left`);
        }

        return {
          product: product._id,
          name: product.name,
          price: product.price,
          quantity,
          image: product.image,
        };
      })
    );

    const totalPrice = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const transactionUUID = uuidv4();

    const response = await axios.post(
      "https://dev.khalti.com/api/v2/epayment/initiate/",
      {
        return_url: `http://localhost:5173/payment-success?transactionUUID=${transactionUUID}`,
        website_url: "http://localhost:5173",
        amount: totalPrice * 100,
        purchase_order_id: transactionUUID,
        purchase_order_name: "Order via Khalti",
        customer_info: {
          name: deliveryInfo.name,
          email: deliveryInfo.email,
          phone: deliveryInfo.phone,
        },
      },
      {
        headers: {
          Authorization: `Key ${KHALTI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json({
      ...response.data,
      tempOrder: {
        userId,
        items: orderItems,
        deliveryInfo,
        totalPrice,
        transactionUUID,
      },
    });
  } catch (err) {
    console.error("Khalti Init Error", err.response?.data || err.message);
    return res.status(500).json({ message: "Failed to initiate Khalti" });
  }
});

// GET /api/orders/esewa/success
router.post("/khalti/verify-and-save", authenticate, async (req, res) => {
  const { pidx, tempOrder } = req.body;

  try {
    const response = await axios.post(
      "https://dev.khalti.com/api/v2/epayment/lookup/",
      { pidx },
      {
        headers: {
          Authorization: `Key ${KHALTI_SECRET_KEY}`,
        },
      }
    );

    const data = response.data;
    for (const item of tempOrder.items) {
      const product = await Product.findById(item.product);

      if (!product) throw new Error("Invalid product in cart");
      if (product.stock < item.quantity) {
        throw new Error(`${product.name} has only ${product.stock} left`);
      }

      product.stock -= item.quantity;
      await product.save();
    }

    if (data.status === "Completed") {
      const order = new Order({
        user: tempOrder.userId,
        items: tempOrder.items,
        deliveryInfo: tempOrder.deliveryInfo,
        paymentMethod: "Khalti",
        totalPrice: tempOrder.totalPrice,
        paymentStatus: "Paid",
        transactionUUID: tempOrder.transactionUUID,
      });

      await order.save();

      return res
        .status(201)
        .json({ message: "Order placed", orderId: order._id });
    } else {
      return res.status(400).json({ message: "Payment not completed" });
    }
  } catch (err) {
    console.error("Khalti Verify Error:", err);
    return res.status(500).json({ message: "Failed to verify Khalti payment" });
  }
});

router.get("/my-orders", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }); // most recent first

    res.json(orders);
  } catch (error) {
    console.error("Fetch Orders Error:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// PUT /api/orders/:id/cancel
router.put("/:id/cancel", authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (["Delivered", "Completed"].includes(order.orderStatus)) {
      return res.status(400).json({
        message:
          "Order cannot be cancelled as it is already delivered or completed",
      });
    }
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    order.orderStatus = "Cancelled";
    await order.save();

    res.status(200).json({ message: "Order cancelled successfully", order });
  } catch (error) {
    console.error("Cancel Order Error:", error);
    res.status(500).json({ message: "Failed to cancel order" });
  }
});
// Update only the order status (Admin only)
router.put(
  "/:id/update-order-status",
  authenticate,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const { orderStatus } = req.body;

      if (!orderStatus) {
        return res.status(400).json({ message: "Order status is required" });
      }

      const order = await Order.findById(req.params.id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      order.orderStatus = orderStatus;
      await order.save();

      return res.status(200).json({ message: "Order status updated", order });
    } catch (err) {
      console.error("Order Status Update Error:", err);
      return res.status(500).json({ message: "Failed to update order status" });
    }
  }
);
// Update only the payment status (Admin only)
router.put(
  "/:id/update-payment-status",
  authenticate,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const { paymentStatus } = req.body;

      if (!paymentStatus) {
        return res.status(400).json({ message: "Payment status is required" });
      }

      const order = await Order.findById(req.params.id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      order.paymentStatus = paymentStatus;
      await order.save();

      return res.status(200).json({ message: "Payment status updated", order });
    } catch (err) {
      console.error("Payment Status Update Error:", err);
      return res
        .status(500)
        .json({ message: "Failed to update payment status" });
    }
  }
);
// GET all orders (admin only)
router.get("/all", authenticate, authorizeRoles("Admin"), async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "username email") // populate user info
      .sort({ createdAt: -1 }); // latest first

    res.status(200).json(orders);
  } catch (error) {
    console.error("Fetch All Orders Error:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

module.exports = router;
