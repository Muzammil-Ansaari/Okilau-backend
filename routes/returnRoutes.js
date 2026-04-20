import express from "express";
import { protect, admin } from "../middleware/authMiddleware.js";
import {
  getAllReturns,
  getMyReturns,
  requestReturn,
  updateReturnStatus,
} from "../controllers/returnController.js";

const router = express.Router();

// user routes
router.post("/", protect, requestReturn);
router.get("/mine", protect, getMyReturns);

// admin routes
router.get("/", protect, admin, getAllReturns);
router.put("/:id", protect, admin, updateReturnStatus);

export default router;
