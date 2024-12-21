const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

router.post('/cart/confirm-payment', isAuthenticated, (req, res) => {
    const { paymentMethod } = req.body;
    const userID = req.session.user.id;
    const cartQuery = `
        SELECT g.GameID, g.Price, g.DeveloperID
        FROM CartGame cg
        JOIN Cart c ON cg.CartID = c.CartID
        JOIN Game g ON cg.GameID = g.GameID
        WHERE c.UserID = ?;
    `;
    db.all(cartQuery, [userID], (err, games) => {
        if (err || !games || games.length === 0) return res.status(400).send('Your cart is empty.');
        const totalPrice = games.reduce((sum, game) => sum + game.Price, 0);

        if (paymentMethod === 'wallet') {
            db.get(`SELECT Wallet FROM User WHERE UserID = ?`, [userID], (err, user) => {
                if (err || user.Wallet < totalPrice) return res.status(400).send('Insufficient wallet balance. Please add funds.');

                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    db.run(`UPDATE User SET Wallet = Wallet - ? WHERE UserID = ?`, [totalPrice, userID]);

                    games.forEach(game => {
                        db.run(`UPDATE Developer SET Wallet = Wallet + ? WHERE DeveloperID = ?`, [game.Price, game.DeveloperID]);
                    });

                    db.run(`
                        INSERT INTO Library (UserID, GameID, PurchaseDate)
                        SELECT c.UserID, cg.GameID, CURRENT_TIMESTAMP
                        FROM CartGame cg
                        JOIN Cart c ON cg.CartID = c.CartID
                        WHERE c.UserID = ?;
                    `, [userID]);

                    db.run(`DELETE FROM CartGame WHERE CartID = (SELECT CartID FROM Cart WHERE UserID = ?)`, [userID], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).send('Transaction failed.');
                        }
                        db.run('COMMIT', () => {
                            res.send('Payment successful! Games have been added to your library.');
                        });
                    });
                });
            });
        } else {
            res.send('Other methods in development!');
        }
    });
});

module.exports = router;
