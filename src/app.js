const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

// Initialize app
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Session
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: true
}));

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const gameRoutes = require('./routes/game');
const developerRoutes = require('./routes/developer');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payment');

app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/', gameRoutes);
app.use('/', developerRoutes);
app.use('/', adminRoutes);
app.use('/', paymentRoutes);

// Global error handler (optional)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Graceful shutdown for db
const db = require('./config/db');
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) console.error(err.message);
        console.log('Closed the database connection.');
        process.exit(0);
    });
});

module.exports = app;
