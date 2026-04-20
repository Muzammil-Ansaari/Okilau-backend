import Return from "../models/Return.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

// ── Request Return ──
// POST /api/returns
// Protected (user)
export const requestReturn = async (req, res) => {
  try {
    const { orderId, items, reason, description } = req.body;

    // check order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // only delivered orders can be returned
    if (order.status !== "delivered") {
      return res.status(400).json({
        message: "Only delivered orders can be returned",
      });
    }

    // check if return already requested
    const existingReturn = await Return.findOne({ order: orderId });
    if (existingReturn) {
      return res.status(400).json({
        message: "Return already requested for this order",
      });
    }

    // calculate refund amount
    const refundAmount = items.reduce(
      (total, item) => total + item.price * item.qty,
      0,
    );

    const newReturn = await Return.create({
      order: orderId,
      user: req.user._id,
      items,
      reason,
      description,
      refundAmount,
    });

    res.status(201).json(newReturn);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get My Returns ──
// GET /api/returns/mine
// Protected (user)
export const getMyReturns = async (req, res) => {
  try {
    const returns = await Return.find({ user: req.user._id })
      .populate("order", "totalPrice status")
      .sort({ createdAt: -1 });
    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get All Returns ──
// GET /api/returns
// Admin only
export const getAllReturns = async (req, res) => {
  try {
    const returns = await Return.find()
      .populate("user", "name email")
      .populate("order", "totalPrice status paymentStatus")
      .sort({ createdAt: -1 });
    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Update Return Status ──
// PUT /api/returns/:id
// Admin only
// ── Update Return Status ──
export const updateReturnStatus = async (req, res) => {
  try {
    const returnRequest = await Return.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ message: "Return request not found" });
    }

    const { status, refundStatus } = req.body;

    // save old status before updating
    const oldStatus = returnRequest.status;

    if (status) returnRequest.status = status;

    // ── increase stock when completed (only once) ──
    if (status === "completed" && oldStatus !== "completed") {
      for (const item of returnRequest.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.qty },
        });
      }
    }

    // ── process refund ──
    if (refundStatus) {
      returnRequest.refundStatus = refundStatus;
    }

    // ❌ removed — don't mark entire order as refunded
    // this was causing entire order to be excluded from revenue

    await returnRequest.save();
    res.json(returnRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
