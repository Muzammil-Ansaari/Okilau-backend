import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Return from "../models/Return.js";
import User from "../models/User.js";

export const placeOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      totalPrice,
      shippingPrice,
      paymentMethod,
      // paymentIntentId,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items in the order." });
    }

    // ── Check stock ──
    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res
          .status(404)
          .json({ message: `Product not found: ${item.title}` });
      }

      if (product.stock < item.qty) {
        return res.status(400).json({
          message: `Only ${product.stock} items left in stock for ${product.title}`,
        });
      }
    }

    const order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress,
      totalPrice,
      shippingPrice,
      paymentMethod,
      // paymentIntentId: paymentIntentId || null,
      paymentStatus: "pending",
    });

    if (paymentMethod === "cod") {
      // 🟢 Reduce stock for COD
      for (const item of items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.qty },
        });
      }
      return res.status(201).json({
        order,
        message: "Order placed with Cash on Delivery",
      });
    }

    // 🔵 4. CARD FLOW (Stripe)
    const stripe = new (await import("stripe")).default(
      process.env.STRIPE_SECRET_KEY,
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100),
      currency: "usd",
      metadata: {
        orderId: order._id.toString(),
      },
    });

    // Save intent
    order.paymentIntentId = paymentIntent.id;
    await order.save();

    // Send clientSecret to frontend
    res.status(201).json({
      order,
      clientSecret: paymentIntent.client_secret,
    });

    // res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate("user", "name email").sort({
      createdAt: -1,
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // 🔐 Security: ensure user owns the order
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "processing",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // ❌ Prevent changes if already cancelled or delivered
    if (["cancelled", "delivered"].includes(order.status)) {
      return res.status(400).json({
        message: `Order already ${order.status}, cannot update further`,
      });
    }

    // ✅ Update order status
    order.status = status;

    if (status === "cancelled") {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.qty },
        });
      }
    }

    // 🟢 COD logic → auto mark paid on delivery
    if (order.paymentMethod === "cod" && status === "delivered") {
      order.paymentStatus = "paid";
    }

    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();

    // ── Revenue from paid + delivered orders ──
    const revenueResult = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          // status: "delivered",
        },
      },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    // ── Refunds from completed + processed returns ──
    const refundResult = await Return.aggregate([
      {
        $match: {
          status: "completed",
          refundStatus: "processed",
        },
      },
      { $group: { _id: null, total: { $sum: "$refundAmount" } } },
    ]);

    const revenue = revenueResult[0]?.total || 0;
    const refunds = refundResult[0]?.total || 0;

    // ── Net revenue = revenue - refunds ──
    const totalRevenue = revenue - refunds;

    const totalProducts = await Product.countDocuments();
    const totalUsers = await User.countDocuments();

    const recentOrders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalOrders,
      totalRevenue,
      totalProducts,
      totalUsers,
      recentOrders,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ❌ Prevent manual updates for card payments
    if (order.paymentMethod === "card") {
      return res.status(400).json({
        message: "Card payments are controlled by Stripe webhook",
      });
    }

    // ✅ Only allow COD orders
    if (order.paymentMethod === "cod") {
      const { paymentStatus } = req.body;

      // Optional: restrict allowed values
      if (!["paid", "pending"].includes(paymentStatus)) {
        return res.status(400).json({
          message: "Invalid payment status for COD",
        });
      }

      order.paymentStatus = paymentStatus;
      await order.save();

      return res.json(order);
    }

    res.status(400).json({ message: "Invalid payment method" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
