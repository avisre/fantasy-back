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
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  JWT_SECRET,
  ALPHA_VANTAGE_API_KEY,
  SESSION_SECRET,
  PORT = 3000,
} = process.env;

const app = express();

// Middleware setup
app.use(cors({ origin: 'https://www.stockportfolio.pro', credentials: true }));
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Schemas and Models
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
  userId: { type: String, required: true },
});
const Portfolio = mongoose.model('Portfolio', portfolioSchema);

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Passport Serialization and Deserialization
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
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://www.stockportfolio.pro/auth/google/callback',
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
    console.error('Google OAuth Error:', err);
    done(err, null);
  }
}));

// Twitter OAuth Strategy
passport.use(new TwitterStrategy({
  consumerKey: TWITTER_CONSUMER_KEY,
  consumerSecret: TWITTER_CONSUMER_SECRET,
  callbackURL: 'https://www.stockportfolio.pro/auth/twitter/callback',
  includeEmail: true,
}, async (token, tokenSecret, profile, done) => {
  try {
    console.log('Twitter Profile:', profile);
    let user = await User.findOne({ twitterId: profile.id });
    if (!user) {
      user = new User({
        email: profile.emails?.[0]?.value || `${profile.id}@twitter.com`,
        twitterId: profile.id,
      });
      await user.save();
    }
    done(null, user);
  } catch (err) {
    console.error('Twitter OAuth Error:', err);
    done(err, null);
  }
}));

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    if (token.startsWith('guest_')) {
      req.user = { id: token };
      return next();
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id.toString() };
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Serve favicon explicitly
app.get('/favicon.ico', (req, res) => {
  res.set('Content-Type', 'image/x-icon');
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'), (err) => {
    if (err) {
      // Fallback to redirecting to the favicon specified in login.html
      res.redirect('/media/use.png');
    }
  });
});

// Authentication Routes
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

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('Google Auth Error:', err);
      return res.status(401).json({ error: 'Google authentication failed', details: err.message });
    }
    if (!user) {
      return res.redirect('/login.html?error=auth_failed');
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('Login Error:', loginErr);
        return res.status(500).json({ error: 'Login failed after Google authentication' });
      }
      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
      res.redirect(`/dashboard.html?token=${token}`);
    });
  })(req, res, next);
});

// Twitter OAuth Routes with Error Handling
app.get('/auth/twitter', passport.authenticate('twitter', { scope: ['email'] }));

app.get('/auth/twitter/callback', (req, res, next) => {
  passport.authenticate('twitter', (err, user, info) => {
    if (err) {
      console.error('Twitter Auth Error:', err);
      return res.status(401).json({ error: 'Twitter authentication failed', details: err.message });
    }
    if (!user) {
      return res.redirect('/login.html?error=auth_failed');
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('Login Error:', loginErr);
        return res.status(500).json({ error: 'Login failed after Twitter authentication' });
      }
      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
      res.redirect(`/dashboard.html?token=${token}`);
    });
  })(req, res, next);
});

// Portfolio Routes
app.get('/api/portfolio', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching portfolio for userId:', req.user.id);
    const portfolio = await Portfolio.find({ userId: req.user.id });
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
    const guestPortfolio = await Portfolio.find({ userId: guestId });
    if (guestPortfolio.length === 0) {
      return res.status(200).json({ message: 'No guest portfolio to migrate' });
    }
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

// Stock Data Routes (Alpha Vantage Proxy)
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

// Updated News Route to Support Filters
app.get('/api/news', authenticateToken, async (req, res) => {
  try {
    const { tickers, topics } = req.query;
    let url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=1000&apikey=${ALPHA_VANTAGE_API_KEY}`;
    if (tickers) url += `&tickers=${encodeURIComponent(tickers)}`;
    if (topics) url += `&topics=${encodeURIComponent(topics)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alpha Vantage API responded with status: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching news:', error.message);
    res.status(500).json({ error: 'Failed to fetch news data' });
  }
});

// Static Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/news.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'news.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server
app.listen(PORT, () => {
  console.log('Server Time:', new Date().toISOString());
  console.log('Twitter Consumer Key:', process.env.TWITTER_CONSUMER_KEY);
  console.log('Twitter Consumer Secret:', process.env.TWITTER_CONSUMER_SECRET);
  console.log(`Server running on port ${PORT}`);
});
