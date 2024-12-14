const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

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

// Authentication middleware
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Render the homepage (home.ejs)
app.get('/', (req, res) => {
    res.render('home'); // Render the home.ejs file
});

// Render the user dashboard (store)
app.get('/dashboard', isAuthenticated, (req, res) => {
    // Get search and category from query string
    const search = req.query.search || '';
    const category = req.query.category || '';

    // Construct SQL query
    let query = 'SELECT * FROM Game WHERE 1=1';
    const params = [];

    // Add search condition
    if (search) {
        query += ' AND Title LIKE ?';
        params.push(`%${search}%`);
    }

    // Add category condition
    if (category) {
        query += ' AND Category = ?';
        params.push(category);
    }

    // Execute query
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Database error');
        }

        // Render EJS file (only once!)
        res.render('user_dashboard', {
            user: req.session.user,
            games: rows,
            search,
            category
        });
    });
});

// Game detail route
app.get('/game/:id', isAuthenticated, (req, res) => {
    const gameId = req.params.id;

    // Query to fetch game details by GameID
    const query = `
        SELECT
            GameID, Title, Price, Image, Description
        FROM Game
        WHERE GameID = ?
    `;

    db.get(query, [gameId], (err, game) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Database error');
        }

        if (!game) {
            return res.status(404).send('Game not found');
        }

        // Render the game detail page with the fetched data
        res.render('game_detail', { game });
    });
});

// Render the register page
app.get('/register', (req, res) => {
    const message = req.session.message || ''; // Ensure message is defined
    req.session.message = null; // Clear message after displaying
    res.render('register_page', { message }); // Pass message to EJS
});

// Render the login page
app.get('/login', (req, res) => {
    const message = req.session.message || '';  // Ensure message is defined
    req.session.message = null;  // Clear message after displaying
    res.render('login_page', { message });
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

// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const userQuery = `SELECT UserID AS id, Username, 'user' AS Role FROM User WHERE Username = ? AND Password = ?`;
    const developerQuery = `SELECT DeveloperID AS id, Username, 'developer' AS Role FROM Developer WHERE Username = ? AND Password = ?`;

    db.get(`${userQuery} UNION ${developerQuery}`, [username, password, username, password], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ message: 'Database error' });
        }

        if (!row) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        req.session.user = { id: row.id, username: row.Username, role: row.Role };
        res.status(200).json({ message: 'Login successful!' });
    });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err.message);
        }
        res.redirect('/login');
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
