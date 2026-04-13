import express from "express";
import {
  getAddress,
  getAllUsers,
  getProfile,
  saveAddress,
  updateProfile,
} from "../controllers/userController.js";
import { admin, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.get("/address", protect, getAddress);
router.put("/address", protect, saveAddress);

router.get("/", protect, admin, getAllUsers);

export default router;
