const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

// User Dashboard
router.get('/dashboard', isAuthenticated, (req, res) => {
    const search = req.query.search || '';
    const category = req.query.category || '';

    const userQuery = `SELECT Wallet FROM User WHERE UserID = ?`;
    db.get(userQuery, [req.session.user.id], (err, user) => {
        if (err || !user) return res.status(500).send('Database error');

        let query = 'SELECT GameID, Title, Category, Price, Image, Description FROM Game WHERE Status = "Approved"';
        const params = [];

        if (search) {
            query += ' AND Title LIKE ?';
            params.push(`%${search}%`);
        }

        if (category) {
            query += ' AND Category = ?';
            params.push(category);
        }

        db.all(query, params, (err, games) => {
            if (err) return res.status(500).send('Database error');
            res.render('user_dashboard', {
                user: { ...req.session.user, wallet: user.Wallet },
                games,
                search,
                category
            });
        });
    });
});

// View Cart
router.get('/cart', isAuthenticated, (req, res) => {
    const userID = req.session.user.id;
    const query = `
        SELECT g.GameID, g.Title, g.Price, g.Image
        FROM CartGame cg
        JOIN Cart c ON cg.CartID = c.CartID
        JOIN Game g ON cg.GameID = g.GameID
        WHERE c.UserID = ?;
    `;
    db.all(query, [userID], (err, games) => {
        if (err) return res.status(500).send("Error retrieving cart.");
        res.render('cart_page', { user: req.session.user, games });
    });
});

// Remove Game from Cart
router.post('/cart/remove', isAuthenticated, (req, res) => {
    const { gameID } = req.body;
    const userID = req.session.user.id;
    const query = `
        DELETE FROM CartGame
        WHERE GameID = ? AND CartID = (SELECT CartID FROM Cart WHERE UserID = ?);
    `;
    db.run(query, [gameID, userID], (err) => {
        if (err) return res.status(500).send("Error removing game.");
        res.redirect('/cart');
    });
});

// Checkout Page
router.post('/cart/checkout', isAuthenticated, (req, res) => {
    const userID = req.session.user.id;
    const userQuery = `SELECT Wallet FROM User WHERE UserID = ?`;
    const cartQuery = `
        SELECT SUM(g.Price) AS TotalPrice
        FROM CartGame cg
        JOIN Cart c ON cg.CartID = c.CartID
        JOIN Game g ON cg.GameID = g.GameID
        WHERE c.UserID = ?;
    `;
    db.get(userQuery, [userID], (err, user) => {
        if (err || !user) return res.status(500).send('Failed to fetch wallet information.');
        db.get(cartQuery, [userID], (err, result) => {
            if (err || !result.TotalPrice) return res.status(400).send('Your cart is empty.');
            res.render('payment_page', {
                userWallet: user.Wallet,
                totalAmount: result.TotalPrice,
                user: req.session.user
            });
        });
    });
});

module.exports = router;
