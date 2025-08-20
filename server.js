const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const authRoutes = require("./src/routes/authRoutes");
// const authenticate = require("./src/middleware/authMiddleware");
// const authorizeRoles = require("./src/middleware/roleMiddleware");

const app = express();
app.use(express.json());
const allowedOrigins = [
  "http://localhost:5173", // local dev frontend
  "https://shop.primosremit.com.au", // deployed frontend domain
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // important if you send cookies/auth headers
  })
);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error(err));

// Routes
app.use("/api/products", require("./src/routes/ProductRoutes"));
app.use("/api/categories", require("./src/routes/CategoryRoutes"));
app.use("/api/roles", require("./src/routes/roleRoute"));
app.use("/uploads", express.static("uploads"));
app.use("/api/auth", authRoutes);
app.use("/api/Users", require("./src/routes/UerRoutes"));
app.use("/api/Orders", require("./src/routes/OrderRoutes"));
