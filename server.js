require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// ─── Config ────────────────────────────────────────────────────────────────
const IS_PRODUCTION = process.env.MPESA_ENV === "production";
const BASE_URL = IS_PRODUCTION
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE || "174379";
const PASSKEY = process.env.MPESA_PASSKEY;
const RECEIVER = process.env.MPESA_RECEIVER || "254720313769";
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL;

// In-memory transaction store (use a DB in production)
const transactions = {};

// ─── Helpers ───────────────────────────────────────────────────────────────
function getTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
}

function getPassword(timestamp) {
  return Buffer.from(SHORTCODE + PASSKEY + timestamp).toString("base64");
}

async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString(
    "base64"
  );
  const { data } = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return data.access_token;
}

// ─── Routes ────────────────────────────────────────────────────────────────

// Initiate STK Push
app.post("/api/stk-push", async (req, res) => {
  try {
    const { phone, amount, description } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: "Phone and amount are required." });
    }

    // Normalize phone: strip leading 0 or +254, ensure 254XXXXXXXXX
    let normalizedPhone = String(phone).replace(/\s+/g, "");
    if (normalizedPhone.startsWith("+")) normalizedPhone = normalizedPhone.slice(1);
    if (normalizedPhone.startsWith("0")) normalizedPhone = "254" + normalizedPhone.slice(1);
    if (!normalizedPhone.startsWith("254")) normalizedPhone = "254" + normalizedPhone;

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount < 1) {
      return res.status(400).json({ error: "Amount must be at least KES 1." });
    }

    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = getPassword(timestamp);

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: parsedAmount,
      PartyA: normalizedPhone,
      PartyB: SHORTCODE,
      PhoneNumber: normalizedPhone,
      CallBackURL: CALLBACK_URL,
      AccountReference: "ALMEER",
      TransactionDesc: description || "ALMEER Payment",
    };

    const { data } = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (data.ResponseCode === "0") {
      // Store pending transaction
      transactions[data.CheckoutRequestID] = {
        status: "pending",
        phone: normalizedPhone,
        amount: parsedAmount,
        description: description || "ALMEER Payment",
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        createdAt: new Date().toISOString(),
      };

      return res.json({
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        customerMessage: data.CustomerMessage,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: data.errorMessage || "STK Push failed. Try again.",
      });
    }
  } catch (err) {
    console.error("STK Push error:", err?.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error:
        err?.response?.data?.errorMessage ||
        "Server error. Check your credentials and try again.",
    });
  }
});

// Poll transaction status
app.get("/api/status/:checkoutRequestId", async (req, res) => {
  const { checkoutRequestId } = req.params;
  const txn = transactions[checkoutRequestId];

  if (!txn) {
    return res.status(404).json({ error: "Transaction not found." });
  }

  // If still pending after 70s, mark as expired
  const age = Date.now() - new Date(txn.createdAt).getTime();
  if (txn.status === "pending" && age > 70000) {
    transactions[checkoutRequestId].status = "expired";
    txn.status = "expired";
  }

  return res.json(txn);
});

// M-Pesa Callback (Safaricom posts result here)
app.post("/api/mpesa/callback", (req, res) => {
  try {
    const { Body } = req.body;
    const callback = Body?.stkCallback;

    if (!callback) return res.json({ ResultCode: 0 });

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } =
      callback;

    if (transactions[CheckoutRequestID]) {
      if (ResultCode === 0) {
        const items = CallbackMetadata?.Item || [];
        const get = (name) => items.find((i) => i.Name === name)?.Value;

        transactions[CheckoutRequestID] = {
          ...transactions[CheckoutRequestID],
          status: "success",
          mpesaReceiptNumber: get("MpesaReceiptNumber"),
          transactionDate: get("TransactionDate"),
          phoneNumber: get("PhoneNumber"),
          amount: get("Amount"),
          completedAt: new Date().toISOString(),
        };

        console.log(
          `✅  Payment SUCCESS | Receipt: ${get("MpesaReceiptNumber")} | Amount: KES ${get("Amount")} | Phone: ${get("PhoneNumber")}`
        );
      } else {
        transactions[CheckoutRequestID].status = "failed";
        transactions[CheckoutRequestID].failReason = ResultDesc;
        console.log(`❌  Payment FAILED | ${ResultDesc}`);
      }
    }

    return res.json({ ResultCode: 0 });
  } catch (e) {
    console.error("Callback error:", e);
    return res.json({ ResultCode: 0 });
  }
});

// Serve frontend for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀  ALMEER M-Pesa Server running on http://localhost:${PORT}`);
  console.log(`🌍  Environment : ${IS_PRODUCTION ? "PRODUCTION" : "SANDBOX"}`);
  console.log(`📱  Shortcode   : ${SHORTCODE}`);
  console.log(`💰  Receiver    : ${RECEIVER}`);
  console.log(`🔗  Callback    : ${CALLBACK_URL || "(not set)"}\n`);
});
