const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

// Game Detail
router.get('/game/:id', isAuthenticated, (req, res) => {
    const gameId = req.params.id;
    const { message } = req.query;

    const query = `
        SELECT GameID, Title, Price, Image, Description, GameDetails
        FROM Game
        WHERE GameID = ?;
    `;
    db.get(query, [gameId], (err, game) => {
        if (err) return res.status(500).send('Database error');
        if (!game) return res.status(404).send('Game not found');
        res.render('game_detail', { game, message });
    });
});

// Add to Cart
router.post('/cart/add', isAuthenticated, (req, res) => {
    const { gameID } = req.body;
    const userID = req.session.user.id;
    if (!gameID) return res.status(400).send("Invalid game ID.");

    const libraryCheckQuery = `SELECT 1 FROM Library WHERE UserID = ? AND GameID = ?`;
    db.get(libraryCheckQuery, [userID, gameID], (err, row) => {
        if (err) return res.status(500).send("Database error.");
        if (row) {
            return res.redirect(`/game/${gameID}?message=already_in_cart`);
        }

        const cartCheckQuery = `SELECT CartID FROM Cart WHERE UserID = ?`;
        db.get(cartCheckQuery, [userID], (err, cart) => {
            if (err) return res.status(500).send("Error retrieving cart.");
            const cartID = cart ? cart.CartID : null;

            function addGameToCart(cartID, gameID, res) {
                const cartGameCheck = `SELECT 1 FROM CartGame WHERE CartID = ? AND GameID = ?`;
                db.get(cartGameCheck, [cartID, gameID], (err, row) => {
                    if (err) return res.status(500).send("Error checking cart.");
                    if (row) return res.status(400).send("Game already in cart.");

                    const insertQuery = `INSERT INTO CartGame (CartID, GameID) VALUES (?, ?)`;
                    db.run(insertQuery, [cartID, gameID], (err) => {
                        if (err) return res.status(500).send("Error adding game to cart.");
                        res.redirect('/cart');
                    });
                });
            }

            if (!cartID) {
                const createCartQuery = `INSERT INTO Cart (UserID) VALUES (?)`;
                db.run(createCartQuery, [userID], function (err) {
                    if (err) return res.status(500).send("Error creating cart.");
                    addGameToCart(this.lastID, gameID, res);
                });
            } else {
                addGameToCart(cartID, gameID, res);
            }
        });
    });
});

module.exports = router;
