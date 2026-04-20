import express from "express";
import { chatbotController } from "../controllers/chatbotController.js";
import { optionalAuth, protect } from "../middleware/authMiddleware.js";
const router = express.Router();

router.post("/chat", chatbotController);

export default router;
