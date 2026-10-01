import crypto from "crypto";
import { onShutdown } from "../../lifecycle/shutdown.js";

const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(otp).digest("hex");

export const generateOtp = (email, req) => {
  const otp = crypto.randomInt(100000, 1000000).toString();

  otpStore.set(email, {
    otpHash: hashOtp(otp),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    ua: req.headers["user-agent"],
    ip: req.clientIp || req.ip
  });

  return otp;
};

export const verifyOtp = (email, otp, req) => {
  const record = otpStore.get(email);
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return false;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(email);
    return false;
  }

  // Bind OTP to same device
  if (record.ua !== req.headers["user-agent"]) {
    return false;
  }

  record.attempts++;

  if (hashOtp(otp) !== record.otpHash) {
    return false;
  }

  // SUCCESS → delete OTP
  otpStore.delete(email);
  return true;
};

export const deleteOtp = (email) => {
  otpStore.delete(email);
};

// Cleanup expired OTPs (single timer, safe)
const otpSweeper = setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 60 * 1000);
otpSweeper.unref(); // never keep the process alive on its own
onShutdown('otp sweeper', () => clearInterval(otpSweeper), 'producers');

export default {
  generateOtp,
  verifyOtp,
  deleteOtp
};