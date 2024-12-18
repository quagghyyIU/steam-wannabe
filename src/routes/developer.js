const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isDeveloper } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

router.get('/developer-dashboard', isAuthenticated, isDeveloper, (req, res) => {
    const query = `SELECT Wallet FROM Developer WHERE DeveloperID = ?`;
    db.get(query, [req.session.user.id], (err, developer) => {
        if (err || !developer) return res.status(500).send('Database error');
        res.render('developer_dashboard', {
            developer: { ...req.session.user, wallet: developer.Wallet }
        });
    });
});

router.post('/upload-game', isAuthenticated, isDeveloper, upload.single('image'), (req, res) => {
    const { title, category, price, description, gameDetails } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const developerID = req.session.user.id;

    if (!title || !category || !price || !description || !gameDetails || !image) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const query = `
        INSERT INTO Game (Title, Category, Price, Description, GameDetails, Status, DeveloperID, Image)
        VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?)
    `;
    db.run(query, [title, category, parseFloat(price), description, gameDetails, developerID, image], function (err) {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.status(201).json({ message: 'Game uploaded successfully!' });
    });
});

router.get('/developer-games', isAuthenticated, isDeveloper, (req, res) => {
    const developerID = req.session.user.id;
    const query = `SELECT * FROM Game WHERE DeveloperID = ?`;
    db.all(query, [developerID], (err, rows) => {
        if (err) return res.status(500).send('Database error');
        res.render('developer_games', { games: rows });
    });
});

module.exports = router;
