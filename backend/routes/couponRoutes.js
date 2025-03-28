const express = require("express");
const router = express.Router();
const Coupon = require("../models/Coupon");
const Claim = require("../models/Claim");
const crypto = require("crypto");

const RATE_LIMIT_TIME = 60 * 60 * 1000; // 1 hour in milliseconds
 // const RATE_LIMIT_TIME =  6 * 1000; // 6 seconds in milliseconds. 6 seconds = 6000ms .

// Function to hash IP addresses
const hashIP = (ip) => crypto.createHash("sha256").update(ip).digest("hex");

router.get("/claim", async (req, res) => {
  const realIP = req.headers["x-forwarded-for"]?.split(",")[0] || req.connection.remoteAddress;
  const hashedIP = hashIP(realIP); // Hash the IP before storing

  const userCookie = req.cookies.user_cookie || Math.random().toString(36).substring(2);
  res.cookie("user_cookie", userCookie, { maxAge: RATE_LIMIT_TIME, httpOnly: true });

  // Check previous claims
  const lastClaim = await Claim.findOne({
    $or: [{ ip: hashedIP }, { cookieId: userCookie }],
  }).sort({ timestamp: -1 });

  if (lastClaim && new Date() - lastClaim.timestamp < RATE_LIMIT_TIME) {
    const remainingTime = Math.ceil((RATE_LIMIT_TIME - (new Date() - lastClaim.timestamp)) / 1000);
    return res.status(429).json({ message: `Please wait ${remainingTime} seconds before claiming another coupon.` });
  }

 // Find an unclaimed coupon
  const coupon = await Coupon.findOne({ claimed: false }).sort({ _id: 1 });
  if (!coupon) return res.status(404).json({ message: "No coupons available." });

  // Mark coupon as claimed
  coupon.claimed = true;
  await coupon.save();

  // Record the claim
  await Claim.create({ ip: hashedIP, cookieId: userCookie });

  res.json({ message: "Coupon claimed successfully!", couponCode: coupon.code });

});

module.exports = router;
