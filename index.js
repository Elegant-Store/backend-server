const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');
const app = express();
app.use(express.json());

// Enable CORS for specific frontend (elegant-store.github.io)
app.use(cors({
  origin: 'https://elegant-store.github.io', // Only allow this frontend origin
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// Get PayPal Access Token (OAuth)
const getPaypalAccessToken = async () => {
  const paypalClientId = process.env.PAYPAL_CLIENT_ID;
  const paypalSecret = process.env.PAYPAL_SECRET;
  
  try {
    const response = await axios.post(
      'https://api.paypal.com/v1/oauth2/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${paypalClientId}:${paypalSecret}`).toString('base64')}`
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error);
    throw new Error('Could not retrieve PayPal access token.');
  }
};

// Payment creation route (POST)
app.post('/create-paypal-payment', async (req, res) => {
  const { email, totalPrice } = req.body;

  if (!email || !totalPrice) {
    return res.status(400).send("Email and totalPrice are required.");
  }

  try {
    const accessToken = await getPaypalAccessToken();
    const paypalPaymentUrl = 'https://api.paypal.com/v1/payments/payment'; // Live URL for PayPal API

    // Make a POST request to PayPal's API to create the payment
    const response = await axios.post(paypalPaymentUrl, {
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      transactions: [{
        amount: {
          total: totalPrice,
          currency: 'USD'
        },
        description: 'Product Purchase'
      }],
      redirect_urls: {
        return_url: 'https://my-backend-henna-zeta.vercel.app/payment-success',
        cancel_url: 'https://my-backend-henna-zeta.vercel.app/payment-cancel'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (response.data && response.data.links) {
      const approvalUrl = response.data.links.find(link => link.rel === 'approval_url').href;
      res.status(200).json({ approvalUrl });
    } else {
      res.status(500).send("Failed to create PayPal payment.");
    }
  } catch (error) {
    console.error('Error creating PayPal payment:', error);
    res.status(500).send("Error creating PayPal payment.");
  }
});

// Payment success route (GET)
app.get('/payment-success', (req, res) => {
  try {
    const email = req.query.email;  // Assuming email is passed as a query param
    if (!email) {
      return res.status(400).send("Email is required.");
    }

    // Example: Generate a product key (replace with your actual logic)
    const keyDatabase = ['KEY-1234-ABCD', 'KEY-5678-EFGH']; // Replace with actual key database logic
    const key = keyDatabase.shift();

    if (!key) {
      return res.status(500).send("No keys available.");
    }

    // Send email with the product key
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,  // Your Gmail email address (use App Password if 2FA enabled)
        pass: process.env.GMAIL_PASS   // Your Gmail password (use App Password if 2FA enabled)
      }
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Your Product Key',
      text: `Thank you for your purchase! Your product key is: ${key}`
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Error sending email:', err);
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
app.get('/payment-cancel', (req, res) => {
  res.send("Payment was cancelled. Please try again.");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});