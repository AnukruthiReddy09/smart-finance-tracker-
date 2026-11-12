
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Transaction = require('./models/Transaction.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Disable caching and ETag responses
app.disable('etag');

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

// Home route
app.get('/', (req, res) => {
  res.send('Smart Finance Tracker Backend is Running!');
});

// GET all transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ADD transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { title, category, amount, type, date } = req.body;

    if (!title || !category || amount === undefined || !type || !date) {
      return res.status(400).json({
        message: 'Please provide all transaction details.'
      });
    }

    const transaction = await Transaction.create({
      title,
      category,
      amount: Number(amount),
      type: String(type).toLowerCase(),
      date
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Add error:', error);
    res.status(400).json({ message: error.message });
  }
});

// EDIT transaction
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { title, category, amount, type, date } = req.body;

    if (!title || !category || amount === undefined || !type || !date) {
      return res.status(400).json({
        message: 'Please provide all transaction details.'
      });
    }

    const updatedTransaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      {
        title,
        category,
        amount: Number(amount),
        type: String(type).toLowerCase(),
        date
      },
      { new: true, runValidators: true }
    );

    if (!updatedTransaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    res.status(200).json(updatedTransaction);
  } catch (error) {
    console.error('Update error:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const deletedTransaction = await Transaction.findByIdAndDelete(
      req.params.id
    );

    if (!deletedTransaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    res.status(200).json({
      message: 'Transaction deleted successfully.'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Connect to MongoDB Atlas and start server
async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing from .env file');
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log('MongoDB Atlas Connected Successfully');

    app.listen(PORT, () => {
      console.log(`Backend server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB Connection Failed:', error.message);
  }
}

startServer();
