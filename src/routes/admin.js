const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.get('/admin', isAuthenticated, isAdmin, (req, res) => {
    const query = `
        SELECT Game.GameID, Game.Title, Game.Category, Game.Price, Game.Description,
               Game.Status, Game.Image, Developer.StudioName
        FROM Game
        JOIN Developer ON Game.DeveloperID = Developer.DeveloperID
        WHERE Game.Status = 'Pending'
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).send('Database error');
        res.render('admin_dashboard', { games: rows });
    });
});

router.post('/admin/action', isAuthenticated, isAdmin, (req, res) => {
    const { gameID, status } = req.body;
    if (!gameID || !['Approved', 'Declined'].includes(status)) {
        return res.status(400).json({ message: 'Invalid request' });
    }

    const query = `UPDATE Game SET Status = ? WHERE GameID = ?`;
    db.run(query, [status, gameID], function (err) {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ message: 'Game not found' });
        res.status(200).json({ message: `Game ${status.toLowerCase()} successfully!` });
    });
});

module.exports = router;
