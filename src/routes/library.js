const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

// Library Route with Advanced Filter and Sort
router.get('/library', isAuthenticated, (req, res) => {
    const userID = req.session.user.id;
    const { category, sort, minPrice, maxPrice, startDate, endDate } = req.query;

    let query = `
        SELECT g.GameID, g.Title, g.Category, g.Price, g.Image, l.PurchaseDate
        FROM Library l
                 JOIN Game g ON l.GameID = g.GameID
        WHERE l.UserID = ?
    `;
    const params = [userID];

    // Add Category Filter
    if (category) {
        query += ` AND g.Category = ?`;
        params.push(category);
    }

    // Add Price Range Filter
    if (minPrice) {
        query += ` AND g.Price >= ?`;
        params.push(minPrice);
    }
    if (maxPrice) {
        query += ` AND g.Price <= ?`;
        params.push(maxPrice);
    }

    // Add Purchase Date Range Filter
    if (startDate) {
        query += ` AND DATE(l.PurchaseDate) >= ?`;
        params.push(startDate);
    }
    if (endDate) {
        query += ` AND DATE(l.PurchaseDate) <= ?`;
        params.push(endDate);
    }

    // Add Sort Options
    switch (sort) {
        case 'price-asc':
            query += ` ORDER BY g.Price ASC`;
            break;
        case 'price-desc':
            query += ` ORDER BY g.Price DESC`;
            break;
        case 'date-newest':
            query += ` ORDER BY l.PurchaseDate DESC`;
            break;
        case 'date-oldest':
            query += ` ORDER BY l.PurchaseDate ASC`;
            break;
        case 'title-desc':
            query += ` ORDER BY g.Title DESC`;
            break;
        default:
            query += ` ORDER BY g.Title ASC`;
    }

    db.all(query, params, (err, games) => {
        if (err) {
            console.error('Error retrieving library:', err.message);
            return res.status(500).send('Database error.');
        }

        res.render('library_page', {
            games,
            user: req.session.user,
            category: category || '',
            sort: sort || 'title-asc',
            minPrice: minPrice || '',
            maxPrice: maxPrice || '',
            startDate: startDate || '',
            endDate: endDate || ''
        });
    });
});

module.exports = router;
