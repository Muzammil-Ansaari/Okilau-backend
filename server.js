import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import returnRoutes from "./routes/returnRoutes.js";
import errorHandler from "./middleware/errorMiddleware.js";
import chatbotRoute from "./routes/chatbotRoute.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { handleWebhook } from "./controllers/paymentController.js";

connectDB();

const app = express();

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook,
);

app.use(express.json());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/chatbot", chatbotRoute);
app.use("/api/payments", paymentRoutes);

app.use(errorHandler);

app.listen(process.env.PORT);
