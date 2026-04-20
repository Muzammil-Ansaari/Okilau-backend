import { GoogleGenAI } from "@google/genai";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

import jwt from "jsonwebtoken";
import User from "../models/User.js";

const getUserFromToken = async (req) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer")) {
      return null;
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    console.log("Authenticated user:", user);
    console.log(token);

    return user || null;
  } catch (error) {
    console.log("Manual auth failed:", error.message);
    return null;
  }
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_CHATBOT_API_KEY,
});

export const chatbotController = async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    const { message } = req.body;
    const msg = message.toLowerCase().trim();

    // =========================
    // 📦 1. ORDER ID DETECTION
    // =========================
    const orderIdMatch = msg.match(/[a-f0-9]{24}/i);
    const isOrderIntent =
      msg.includes("order status") ||
      msg.includes("track my order") ||
      msg.includes("where is my order");

    if (isOrderIntent || orderIdMatch) {
      // 🔐 require login ONLY here
      console.log(user);
      if (!user) {
        return res.json({
          type: "text",
          reply: "Please login to track your order 📦 (for security 🔐)",
        });
      }

      // ask for ID if not provided
      if (!orderIdMatch) {
        return res.json({
          type: "text",
          reply: "Please provide your order ID 📦",
        });
      }

      // fetch ONLY user's own order
      const order = await Order.findOne({
        _id: orderIdMatch[0],
        user: user._id,
      });

      if (!order) {
        return res.json({
          type: "text",
          reply:
            "Order not found ❌ or you are not authorized to view this order.",
        });
      }

      return res.json({
        type: "text",
        reply: `📦 Your order status is: ${order.status}`,
      });
    }

    // =========================
    // 🧠 2. KNOWN INTENTS
    // =========================

    const isKnownIntent =
      msg.includes("men") ||
      msg.includes("women") ||
      msg.includes("kids") ||
      msg.includes("shirt") ||
      msg.includes("tshirt") ||
      msg.includes("return") ||
      msg.includes("payment") ||
      msg.includes("order");

    // 🛒 PRODUCT HANDLING
    if (isKnownIntent) {
      let category = null;

      if (msg.includes("men")) category = "men";
      if (msg.includes("women")) category = "women";
      if (msg.includes("kids")) category = "kids";

      if (category) {
        const products = await Product.find({ category }).limit(3);

        if (products.length > 0) {
          return res.json({
            type: "products",
            title: `Top ${category} picks 👕`,
            products: products.map((p) => ({
              id: p._id,
              title: p.title,
              price: p.price,
              image: p.image,
            })),
            viewAllLink: `/products?category=${category}`,
          });
        }

        // 🔥 if out of stock → go to Gemini
      }
    }

    // =========================
    // 🤖 3. GEMINI (FALLBACK)
    // =========================

    const prompt = `
You are an AI assistant for an online clothing store.

STRICT RULES (DO NOT BREAK):

1. You ONLY talk about:

   * clothing products (men, women, kids)
   * shopping help
   * order-related queries
   * store-related FAQs

2. If the user asks ANYTHING outside this scope:

   * DO NOT answer it
   * DO NOT explain it
   * DO NOT give general knowledge
   * Respond with:
     "I can only help with clothing, shopping, and orders 😊"

3. NEVER:

   * answer coding questions, general knowledge, unrelated topics (food, science, etc.)

4. Stock-related queries:

   * If a user asks "Is this in stock?" or similar:

     * DO NOT confirm availability
     * Respond with:
       "Please check stock by visiting the product page 😊"

5. Keep responses:

   * short (2–4 sentences), friendly, sales-focused

6. NEVER hallucinate products or data

7. NEVER leave the clothing domain

8. Working Hours or Opening Hours
Monday – Saturday: 10am – 8pm
Sunday: 12pm – 6pm

if user ask about something like working hours or opening hours or time to open or time to close or something like that, you should answer with the working hours above.

9. If user ask something related to budget like "what is available or what can i buy in 2000 or any amout ... you should answer that please visit the website and use the filter option to set your budget, we have a lot of products in different price ranges."

11. If user ask for suggestion or recommendation like "what do you suggest for me?" or "what do you recommend for me?" or "what is the best product?" or something like that, you should answer that please use the above buttons to get the best recommendations.

12. if user asks about his return like where is my return or anything related to return, you should answer that please check "My Account" page for the return status, if you have any issue please contact our support.And the supprot email is "support@okilau.com".

User: ${message}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.json({
      type: "text",
      reply: response.text,
    });
  } catch (error) {
    console.error(error);

    if (error.status === 429) {
      return res.json({
        type: "text",
        reply: "Too many requests 😅 Please try again shortly.",
      });
    }

    if (error.status === 503) {
      return res.json({
        type: "text",
        reply: "Server is busy right now 😅 Please try again.",
      });
    }

    res.status(500).json({ message: "Chat failed" });
  }
};
