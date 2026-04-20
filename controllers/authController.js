import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmail } from "../config/email.js";

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// --- Signup ---
export const signup = async (req, res) => {
  try {
    // Step 01 - Get All Data
    const { name, email, password } = req.body;

    // Step 02 - Check any missing data
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please fill all the fields.",
      });
    }

    // Step 03 - Check if user already exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({
        message: "User already exist.",
      });
    }

    // Step 04 - Save user in DB
    const user = await User.create({
      name,
      email,
      password,
    });

    // Step 05 - Generate Token
    const token = generateToken(user._id, user.role);

    // Send Response
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message,
    });
  }
};

// --- Login ---

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please fill all the fields.",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// ── Forgot Password ──
// POST /api/auth/forgot-password
// Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("1. Email received:", email);

    const user = await User.findOne({ email });
    console.log("2. User found:", user ? "yes" : "no");
    if (!user) {
      // don't reveal if email exists or not
      return res.json({
        message: "If this email exists, a reset link has been sent.",
      });
    }

    // generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    console.log("3. Reset token generated:", resetToken);

    // save hashed token to DB
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // expires in 10 minutes
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    console.log("4. Saving user...");
    await user.save();
    console.log("5. User saved ✅");

    // reset URL for frontend
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    console.log("6. Reset URL:", resetUrl);

    // send email
    console.log("7. Sending email...");
    await sendEmail({
      to: user.email,
      subject: "Okilau — Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #000; text-transform: uppercase; letter-spacing: 2px;">
            Reset Your Password
          </h2>
          <p>Hi ${user.name},</p>
          <p>You requested a password reset. Click the button below to reset your password.</p>
          <p>This link expires in <strong>10 minutes</strong>.</p>
          <a href="${resetUrl}"
            style="display: inline-block; background: #000; color: #fff; padding: 12px 24px;
            text-decoration: none; text-transform: uppercase; letter-spacing: 2px; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #999; font-size: 12px;">
            If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    });
    console.log("8. Email sent ✅");

    res.json({ message: "If this email exists, a reset link has been sent." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// ── Reset Password ──
// POST /api/auth/reset-password/:token
// Public
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // hash token to compare with DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // find user with valid token that hasn't expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token." });
    }

    // update password
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save(); // pre("save") hashes password automatically ✅

    res.json({ message: "Password reset successfully. You can now login." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
