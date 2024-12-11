const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Set up session management
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: true
}));

// Add EJS as the template engine
app.set('view engine', 'ejs');

// Connect to SQLite database
let db = new sqlite3.Database('./game_store.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Render the register page
app.get('/register', (req, res) => {
    const message = req.session.message || ''; // Ensure message is defined
    req.session.message = null; // Clear message after displaying
    res.render('register_page', { message }); // Pass message to EJS
});

// Register route
app.post('/register', (req, res) => {
    const { username, password, email, role, studioName } = req.body;

    if (!username || !password || !email || !role) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const checkQuery = `SELECT 1 FROM User WHERE Username = ? UNION SELECT 1 FROM Developer WHERE Username = ?`;

    db.get(checkQuery, [username, username], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ message: 'Database error' });
        }

        if (row) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        let query, params;
        if (role === 'developer') {
            if (!studioName) {
                return res.status(400).json({ message: 'Studio Name is required' });
            }
            query = `INSERT INTO Developer (Username, Password, Email, StudioName) VALUES (?, ?, ?, ?)`;
            params = [username, password, email, studioName];
        } else {
            query = `INSERT INTO User (Username, Password, Email) VALUES (?, ?, ?)`;
            params = [username, password, email];
        }

        db.run(query, params, (err) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ message: 'Error registering account' });
            }
            res.status(201).json({ message: 'Registration successful!' });
        });
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

// Close database connection on exit
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Closed the database connection.');
        process.exit(0);
    });
});
