import express from "express";
// import { handleWebhook } from "../controllers/paymentController.js";
// import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// router.post("/create-intent", protect, createPaymentIntent);

// webhook needs raw body — special route
// router.post(
//   "/webhook",
//   express.raw({ type: "application/json" }),
//   handleWebhook
// );

export default router;