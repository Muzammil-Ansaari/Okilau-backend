import express from "express";
import {
  getAllOrders,
  getMyOrders,
  placeOrder,
  updateOrderStatus,
  getStats,
  updatePaymentStatus,
  getOrderById,
} from "../controllers/orderController.js";
import { admin, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// User Routes
router.post("/", protect, placeOrder);
router.get("/mine", protect, getMyOrders);
router.get("/id/:id", protect, getOrderById);

// Admin Routes
router.get("/", protect, admin, getAllOrders);
router.put("/:id", protect, admin, updateOrderStatus);
router.get("/stats", protect, admin, getStats);
router.put("/:id/payment", protect, admin, updatePaymentStatus);

export default router;
