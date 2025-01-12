const express = require("express");
const nodemailer = require("nodemailer");
const axios = require("axios");

const app = express();
app.use(express.json());

// Example root route
app.get("/", (req, res) => {
  res.send("Server is up and running!");
});

// Replace this with your database or list of keys
const keyDatabase = [
  "KEY1-XXXX-XXXX-XXXX",
  "KEY2-XXXX-XXXX-XXXX",
  "KEY3-XXXX-XXXX-XXXX",
];

// PayPal API credentials (from environment variables)
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = "https://api-m.paypal.com"; // Use "https://api-m.sandbox.paypal.com" for testing

// PayPal webhook endpoint
app.post("/payment-success", async (req, res) => {
  const { email, discord, paymentID } = req.body;

  try {
    // Validate the payment using PayPal API
    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders/${paymentID}/capture`,
      {},
      {
        auth: {
          username: PAYPAL_CLIENT_ID,
          password: PAYPAL_SECRET,
        },
      }
    );

    const isValidPayment = response.data.status === "COMPLETED";

    if (!isValidPayment) {
      return res.status(400).send("Invalid payment.");
    }

    // Fetch the first available key from the database
    const key = keyDatabase.shift();
    if (!key) {
      return res.status(500).send("No keys available.");
    }

    // Send the key to the user's email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Purchase Key",
      text: `Thank you for your purchase! Here is your key: ${key}\n\nDiscord: ${discord}`,
    };

    await transporter.sendMail(mailOptions);
    res.send("Key sent successfully!");
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to validate payment or send email.");
  }
});

module.exports = app; // Export the app for Vercel
