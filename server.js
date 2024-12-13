const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');

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

// Configure file storage
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// File Filter Function for PNG Only
const fileFilter = (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (fileExt === '.png') {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('Only .png files are allowed'), false); // Reject the file
    }
};

// Initialize Multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter
});

// Render the homepage (home.ejs)
app.get('/', (req, res) => {
    res.render('home'); // Render the home.ejs file
});

// Render the user dashboard
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.render('user_dashboard', { user: req.session.user });
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

// Render the developer dashboard
app.get('/developer-dashboard', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'developer') {
        return res.status(403).send('Access denied');
    }
    res.render('developer_dashboard', { user: req.session.user });
});

// Render Admin Dashboard with Pending Games
app.get('/admin', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied');
    }

    const query = `
        SELECT Game.GameID, Game.Title, Game.Category, Game.Price, Game.Description, 
               Game.Status, Game.Image, Developer.StudioName
        FROM Game
        JOIN Developer ON Game.DeveloperID = Developer.DeveloperID
        WHERE Game.Status = 'Pending'
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Database error');
        }
        res.render('admin_dashboard', { games: rows });
    });
});


// Handle Admin Game Approval or Decline
app.post('/admin/action', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const { gameID, status } = req.body;

    if (!gameID || !['Approved', 'Declined'].includes(status)) {
        return res.status(400).json({ message: 'Invalid request' });
    }

    const query = `UPDATE Game SET Status = ? WHERE GameID = ?`;

    db.run(query, [status, gameID], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ message: 'Database error' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'Game not found' });
        }

        res.status(200).json({ message: `Game ${status.toLowerCase()} successfully!` });
    });
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

    // Admin Login Check
    if (username === 'admin' && password === 'admin') {
        req.session.user = { id: 0, username: 'admin', role: 'admin' };
        return res.status(200).json({ message: 'Admin login successful!', redirect: '/admin' });
    }

    // Database Login Check
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

        // Successful Login
        req.session.user = { id: row.id, username: row.Username, role: row.Role };
        const redirectUrl = row.Role === 'developer' ? '/developer-dashboard' : '/dashboard';

        res.status(200).json({
            message: 'Login successful!',
            redirect: redirectUrl
        });
    });
});

// Upload Game Route with File Upload
app.post('/upload-game', upload.single('image'), (req, res) => {
    const { title, category, price, description } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const developerID = req.session.user.id;

    // Validate input fields
    if (!title || !category || !price || !description || !image) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const query = `
        INSERT INTO Game (Title, Category, Price, Description, Status, DeveloperID, Image)
        VALUES (?, ?, ?, ?, 'Pending', ?, ?)
    `;

    db.run(query, [title, category, parseFloat(price), description, developerID, image], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ message: 'Database error' });
        }
        res.status(201).json({ message: 'Game uploaded successfully!' });
    });
});

// Developer Game Status Route
app.get('/developer-games', isAuthenticated, (req, res) => {
    const developerID = req.session.user.id;

    const query = `SELECT * FROM Game WHERE DeveloperID = ?`;

    db.all(query, [developerID], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Database error');
        }

        res.render('developer_games', { games: rows });
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
