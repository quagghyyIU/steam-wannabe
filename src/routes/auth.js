const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Render the register page
router.get('/register', (req, res) => {
    const message = req.session.message || '';
    req.session.message = null;
    res.render('register_page', { message });
});

// Render the login page
router.get('/login', (req, res) => {
    const message = req.session.message || '';
    req.session.message = null;
    res.render('login_page', { message });
});

// POST Register
router.post('/register', (req, res) => {
    const { username, password, email, role, studioName } = req.body;
    if (!username || !password || !email || !role) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const checkQuery = `SELECT 1 FROM User WHERE Username = ? UNION SELECT 1 FROM Developer WHERE Username = ?`;
    db.get(checkQuery, [username, username], (err, row) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (row) return res.status(400).json({ message: 'Username already taken' });

        let query, params;
        if (role === 'developer') {
            if (!studioName) return res.status(400).json({ message: 'Studio Name is required' });
            query = `INSERT INTO Developer (Username, Password, Email, StudioName) VALUES (?, ?, ?, ?)`;
            params = [username, password, email, studioName];
        } else {
            query = `INSERT INTO User (Username, Password, Email) VALUES (?, ?, ?)`;
            params = [username, password, email];
        }

        db.run(query, params, (err) => {
            if (err) return res.status(500).json({ message: 'Error registering account' });
            res.status(201).json({ message: 'Registration successful!' });
        });
    });
});

// POST Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'All fields are required' });

    // Admin Login Check
    if (username === 'admin' && password === 'admin') {
        req.session.user = { id: 0, username: 'admin', role: 'admin' };
        return res.status(200).json({ message: 'Admin login successful!', redirect: '/admin' });
    }

    const userQuery = `SELECT UserID AS id, Username, 'user' AS Role FROM User WHERE Username = ? AND Password = ?`;
    const developerQuery = `SELECT DeveloperID AS id, Username, 'developer' AS Role FROM Developer WHERE Username = ? AND Password = ?`;

    db.get(`${userQuery} UNION ${developerQuery}`, [username, password, username, password], (err, row) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (!row) return res.status(400).json({ message: 'Invalid username or password' });

        req.session.user = { id: row.id, username: row.Username, role: row.Role };
        const redirectUrl = row.Role === 'developer' ? '/developer-dashboard' : '/dashboard';
        res.status(200).json({ message: 'Login successful!', redirect: redirectUrl });
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err.message);
        res.redirect('/login');
    });
});

module.exports = router;
