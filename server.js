const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
require('dotenv').config();

// Load environment variables
const {
  MONGODB_URI,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  JWT_SECRET,
  ALPHA_VANTAGE_API_KEY,
  SESSION_SECRET,
  PORT,
} = process.env;

const app = express();
app.use(cors());
app.use(express.json());

// Session middleware
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  twitterId: { type: String },
});
const User = mongoose.model('User', userSchema);

const portfolioSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  userId: { type: String, required: true }, // Supports both MongoDB ObjectId and unique guest IDs
});
const Portfolio = mongoose.model('Portfolio', portfolioSchema);

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Passport Serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:5000/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = new User({
        email: profile.emails[0].value,
        googleId: profile.id,
      });
      await user.save();
    }
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

// Twitter OAuth Strategy
passport.use(new TwitterStrategy({
  consumerKey: TWITTER_API_KEY,
  consumerSecret: TWITTER_API_SECRET,
  callbackURL: 'http://localhost:5000/auth/twitter/callback',
  includeEmail: true,
}, async (token, tokenSecret, profile, done) => {
  try {
    let user = await User.findOne({ twitterId: profile.id });
    if (!user) {
      user = new User({
        email: profile.emails[0].value,
        twitterId: profile.id,
      });
      await user.save();
    }
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

// Middleware to verify JWT or handle guest mode
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      // Check if the token is a guest ID (starts with "guest_")
      if (token.startsWith('guest_')) {
        req.user = { id: token };
        next();
      } else {
        // Otherwise, it's a JWT token for a logged-in user
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('JWT decoded:', decoded); // Debug log
        req.user = { id: decoded.id.toString() }; // Ensure userId is a string
        next();
      }
    } catch (err) {
      console.error('Token verification error:', err); // Debug log
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  } else {
    return res.status(401).json({ error: 'No token provided' });
  }
};

// API Routes - Authentication
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ message: 'User registered', token });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ error: 'Failed to register' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Google OAuth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login.html' }), (req, res) => {
  const token = jwt.sign({ id: req.user._id }, JWT_SECRET, { expiresIn: '1h' });
  res.redirect(`/dashboard.html?token=${token}`);
});

// Twitter OAuth Routes
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login.html' }), (req, res) => {
  const token = jwt.sign({ id: req.user._id }, JWT_SECRET, { expiresIn: '1h' });
  res.redirect(`/index.html?token=${token}`);
});

// API Routes - Portfolio
app.get('/api/portfolio', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching portfolio for userId:', req.user.id); // Debug log
    const portfolio = await Portfolio.find({ userId: req.user.id });
    console.log('Portfolio found:', portfolio); // Debug log
    res.json(portfolio);
  } catch (error) {
    console.error('GET /api/portfolio error:', error.message);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

app.post('/api/portfolio', authenticateToken, async (req, res) => {
  try {
    const { symbol, quantity, price } = req.body;
    if (!symbol || !quantity || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Enforce portfolio limit for guest users
    if (req.user.id.startsWith('guest_')) {
      const portfolioCount = await Portfolio.countDocuments({ userId: req.user.id });
      if (portfolioCount >= 5) {
        return res.status(403).json({ error: 'Guest mode limit: Only 5 stocks allowed per session' });
      }
    }
    const stock = new Portfolio({ ...req.body, userId: req.user.id });
    await stock.save();
    res.status(201).json({ message: 'Stock added successfully', id: stock._id });
  } catch (error) {
    console.error('POST /api/portfolio error:', error.message);
    res.status(500).json({ error: 'Failed to add stock' });
  }
});

app.delete('/api/portfolio/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const stock = await Portfolio.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    res.status(200).json({ message: 'Stock removed successfully' });
  } catch (error) {
    console.error('DELETE /api/portfolio error:', error.message);
    res.status(500).json({ error: 'Failed to remove stock' });
  }
});

app.post('/api/portfolio/migrate', authenticateToken, async (req, res) => {
  try {
    if (req.user.id.startsWith('guest_')) {
      return res.status(400).json({ error: 'Cannot migrate portfolio for guest user' });
    }

    const guestId = req.headers['x-guest-id'];
    if (!guestId || !guestId.startsWith('guest_')) {
      return res.status(400).json({ error: 'Invalid guest ID' });
    }

    // Find all portfolio entries for the guest user
    const guestPortfolio = await Portfolio.find({ userId: guestId });
    if (guestPortfolio.length === 0) {
      return res.status(200).json({ message: 'No guest portfolio to migrate' });
    }

    // Update the userId of all guest portfolio entries to the logged-in user's userId
    const result = await Portfolio.updateMany(
      { userId: guestId },
      { $set: { userId: req.user.id } }
    );
    res.status(200).json({ message: `Migrated ${result.modifiedCount} portfolio entries to user` });
  } catch (error) {
    console.error('POST /api/portfolio/migrate error:', error.message);
    res.status(500).json({ error: 'Failed to migrate portfolio' });
  }
});

// API Routes - Stock Data (Alpha Vantage Proxy)
app.get('/api/stock/symbol-search', async (req, res) => {
  try {
    const { keywords } = req.query;
    if (!keywords) {
      return res.status(400).json({ error: 'Keywords required' });
    }
    const response = await fetch(
      `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${keywords}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/stock/symbol-search:', error.message);
    res.status(500).json({ error: 'Failed to fetch symbol search data' });
  }
});

app.get('/api/stock/overview', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }
    const response = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/stock/overview:', error.message);
    res.status(500).json({ error: 'Failed to fetch overview data' });
  }
});

app.get('/api/stock/income-statement', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }
    const response = await fetch(
      `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/stock/income-statement:', error.message);
    res.status(500).json({ error: 'Failed to fetch income statement data' });
  }
});

app.get('/api/stock/balance-sheet', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }
    const response = await fetch(
      `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/stock/balance-sheet:', error.message);
    res.status(500).json({ error: 'Failed to fetch balance sheet data' });
  }
});

app.get('/api/stock/cash-flow', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }
    const response = await fetch(
      `https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/stock/cash-flow:', error.message);
    res.status(500).json({ error: 'Failed to fetch cash flow data' });
  }
});

app.get('/api/stock/time-series-intraday', async (req, res) => {
  try {
    const { symbol, interval } = req.query;
    if (!symbol || !interval) {
      return res.status(400).json({ error: 'Symbol and interval required' });
    }
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/stock/time-series-intraday:', error.message);
    res.status(500).json({ error: 'Failed to fetch intraday time series data' });
  }
});

app.get('/api/stock/time-series-daily', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/stock/time-series-daily:', error.message);
    res.status(500).json({ error: 'Failed to fetch daily time series data' });
  }
});

app.get('/api/stock/time-series-weekly', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/stock/time-series-weekly:', error.message);
    res.status(500).json({ error: 'Failed to fetch weekly time series data' });
  }
});

app.get('/api/stock/time-series-monthly', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/stock/time-series-monthly:', error.message);
    res.status(500).json({ error: 'Failed to fetch monthly time series data' });
  }
});

app.get('/api/stock/global-quote', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/stock/global-quote:', error.message);
    res.status(500).json({ error: 'Failed to fetch global quote data' });
  }
});

// Serve Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
