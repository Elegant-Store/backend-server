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

// PayPal API credentials
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = "https://api-m.paypal.com"; // Live URL
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;


// PayPal payment creation endpoint (POST)
app.post("/create-paypal-payment", async (req, res) => {
  const { email, totalPrice } = req.body;

  try {
    // Request PayPal to create the payment
    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: "USD",
            value: totalPrice,
          },
        }],
        application_context: {
          return_url: "https://my-backend-henna-zeta.vercel.app/payment-success", // URL after successful payment
          cancel_url: "https://my-backend-henna-zeta.vercel.app/payment-cancel",  // URL for payment cancellation
        },
      },
      {
        auth: {
          username: PAYPAL_CLIENT_ID,
          password: PAYPAL_SECRET,
        },
      }
    );

    // Send the approval URL to frontend
    res.json({ approvalUrl: response.data.links.find(link => link.rel === 'approve').href });
  } catch (error) {
    console.error("Error creating PayPal payment:", error);
    res.status(500).send("Error creating PayPal payment.");
  }
});

// Payment success route (POST)
app.post("/payment-success", async (req, res) => {
  const { email, discord, paymentID } = req.body;

  try {
    // Validate the payment via PayPal API
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

    if (response.data.status !== "COMPLETED") {
      return res.status(400).send("Invalid payment.");
    }

    // Get the key from the database
    const key = keyDatabase.shift();
    if (!key) {
      return res.status(500).send("No keys available.");
    }

    // Send the key to the buyer via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER, // Your Gmail address
        pass: process.env.GMAIL_PASS, // Your Gmail password
      },
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: "Your Product Key",
      text: `Thank you for your purchase! Your product key is: ${key}`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
        return res.status(500).send("Error sending email.");
      }
      res.status(200).send("Payment successful and key sent to your email.");
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).send("Error processing payment.");
  }
});

// Payment cancel route (GET)
app.get("/payment-cancel", (req, res) => {
  res.send("Payment was cancelled. Please try again.");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
