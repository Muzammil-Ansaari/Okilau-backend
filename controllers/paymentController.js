import Stripe from "stripe";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── Create Payment Intent ──
// POST /api/payment/create-intent
// Protected (user)
// export const createPaymentIntent = async (req, res) => {
//   try {
//     const { amount } = req.body; // amount in Rs.

//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(amount * 100), // stripe uses smallest currency unit
//       currency: "pkr",                  // Pakistani Rupee
//       automatic_payment_methods: {
//         enabled: true,
//       },
//     });

//     res.json({
//       clientSecret: paymentIntent.client_secret,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// ── Webhook ──
// POST /api/payment/webhook
// Public (called by Stripe)
export const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  const paymentIntent = event.data.object;

  try {
    // 🟢 PAYMENT SUCCESS
    if (event.type === "payment_intent.succeeded") {
      const order = await Order.findOne({
        paymentIntentId: paymentIntent.id,
      });

      if (!order) return;

      // ✅ Idempotency check
      if (order.paymentStatus === "paid") return;

      // ✅ Mark paid
      order.paymentStatus = "paid";
      order.status = "confirmed";

      await order.save();

      // ✅ Reduce stock NOW (not before)
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.qty },
        });
      }
    }

    // 🔴 PAYMENT FAILED
    if (event.type === "payment_intent.payment_failed") {
      const order = await Order.findOne({
        paymentIntentId: paymentIntent.id,
      });

      if (!order) return;

      order.paymentStatus = "failed";
      await order.save();
    }
  } catch (err) {
    console.error("Webhook error:", err.message);
  }

  res.json({ received: true });
};
