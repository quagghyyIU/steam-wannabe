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
    const search = req.query.search || '';
    const category = req.query.category || '';

    // Query to get user wallet
    const userQuery = `SELECT Wallet FROM User WHERE UserID = ?`;

    db.get(userQuery, [req.session.user.id], (err, user) => {
        if (err || !user) {
            console.error('User wallet retrieval error:', err?.message || 'User not found');
            return res.status(500).send('Database error');
        }

        // Construct SQL query for games
        let query = 'SELECT GameID, Title, Category, Price, Image, Description FROM Game WHERE Status = "Approved"';
        const params = [];

        // Add search condition
        if (search) {
            query += ' AND Title LIKE ?';
            params.push(`%${search}%`);
        }

        // Add category filter
        if (category) {
            query += ' AND Category = ?';
            params.push(category);
        }

        // Execute game query
        db.all(query, params, (err, games) => {
            if (err) {
                console.error('Game query error:', err.message);
                return res.status(500).send('Database error');
            }

            // Render the user dashboard
            res.render('user_dashboard', {
                user: { ...req.session.user, wallet: user.Wallet },
                games,
                search,
                category,
            });
        });
    });
});
    
// Game Detail Route
app.get('/game/:id', isAuthenticated, (req, res) => {
    const gameId = req.params.id;

    // Query to fetch game details
    const query = `
        SELECT GameID, Title, Price, Image, Description, GameDetails
        FROM Game
        WHERE GameID = ?
    `;

    db.get(query, [gameId], (err, game) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).send('Database error');
        }

        if (!game) {
            return res.status(404).send('Game not found');
        }

        // Render the game detail page with the fetched data
        res.render('game_detail', { game });
    });
});

// View Cart Route
app.get('/cart', isAuthenticated, (req, res) => {
    const userID = req.session.user.id;

    // Get user's active cart and associated games
    const query = `
        SELECT g.GameID, g.Title, g.Price, g.Image 
        FROM CartGame cg
        JOIN Cart c ON cg.CartID = c.CartID
        JOIN Game g ON cg.GameID = g.GameID
        WHERE c.UserID = ?;
    `;

    db.all(query, [userID], (err, games) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Error retrieving cart.");
        }
        res.render('cart_page', { user: req.session.user, games });
    });
});

app.post('/cart/add', isAuthenticated, (req, res) => {
    const { gameID } = req.body;
    const userID = req.session.user.id;

    if (!gameID) {
        return res.status(400).send("Invalid game ID.");
    }

    // Check if the user already owns the game in the Library
    const libraryCheckQuery = `SELECT 1 FROM Library WHERE UserID = ? AND GameID = ?`;
    db.get(libraryCheckQuery, [userID, gameID], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Database error.");
        }
        if (row) {
            return res.status(400).send("You already own this game.");
        }

        // Get or create a cart for the user
        const cartCheckQuery = `SELECT CartID FROM Cart WHERE UserID = ?`;
        db.get(cartCheckQuery, [userID], (err, cart) => {
            if (err) return res.status(500).send("Error retrieving cart.");

            const cartID = cart ? cart.CartID : null;

            // If no cart exists, create one
            if (!cartID) {
                const createCartQuery = `INSERT INTO Cart (UserID) VALUES (?)`;
                db.run(createCartQuery, [userID], function (err) {
                    if (err) return res.status(500).send("Error creating cart.");
                    addGameToCart(this.lastID, gameID, res);
                });
            } else {
                // Add game to the existing cart
                addGameToCart(cartID, gameID, res);
            }
        });
    });
});

// Helper function to add a game to the cart
function addGameToCart(cartID, gameID, res) {
    const cartGameCheck = `SELECT 1 FROM CartGame WHERE CartID = ? AND GameID = ?`;
    db.get(cartGameCheck, [cartID, gameID], (err, row) => {
        if (err) return res.status(500).send("Error checking cart.");
        if (row) return res.status(400).send("Game already in cart.");

        const insertQuery = `INSERT INTO CartGame (CartID, GameID) VALUES (?, ?)`;
        db.run(insertQuery, [cartID, gameID], (err) => {
            if (err) return res.status(500).send("Error adding game to cart.");
            res.redirect('/cart'); // Redirect to cart page
        });
    });
}


// Remove Game from Cart
app.post('/cart/remove', isAuthenticated, (req, res) => {
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

// Render Payment Page
app.post('/cart/checkout', isAuthenticated, (req, res) => {
    const userID = req.session.user.id;

    // Fetch user wallet and total cart amount
    const userQuery = `SELECT Wallet FROM User WHERE UserID = ?`;
    const cartQuery = `
        SELECT SUM(g.Price) AS TotalPrice
        FROM CartGame cg
        JOIN Cart c ON cg.CartID = c.CartID
        JOIN Game g ON cg.GameID = g.GameID
        WHERE c.UserID = ?;
    `;

    db.get(userQuery, [userID], (err, user) => {
        if (err || !user) {
            console.error('Error fetching wallet:', err?.message || 'User not found');
            return res.status(500).send('Failed to fetch wallet information.');
        }

        db.get(cartQuery, [userID], (err, result) => {
            if (err || !result.TotalPrice) {
                console.error('Error fetching cart total:', err?.message || 'Cart is empty');
                return res.status(400).send('Your cart is empty.');
            }

            // Render payment page with wallet balance and total amount
            res.render('payment_page', {
                userWallet: user.Wallet,
                totalAmount: result.TotalPrice,
                user: req.session.user
            });
        });
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

// Developer Dashboard Route
app.get('/developer-dashboard', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'developer') {
        return res.status(403).send('Access denied');
    }

    // Query to get developer wallet
    const query = `SELECT Wallet FROM Developer WHERE DeveloperID = ?`;

    db.get(query, [req.session.user.id], (err, developer) => {
        if (err || !developer) {
            console.error('Developer wallet retrieval error:', err?.message || 'Developer not found');
            return res.status(500).send('Database error');
        }

        // Render developer dashboard
        res.render('developer_dashboard', {
            developer: { ...req.session.user, wallet: developer.Wallet }
        });
    });
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
    const { title, category, price, description, gameDetails } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const developerID = req.session.user.id;

    // Validate input fields
    if (!title || !category || !price || !description || !gameDetails || !image) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const query = `
        INSERT INTO Game (Title, Category, Price, Description, GameDetails, Status, DeveloperID, Image)
        VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?)
    `;

    db.run(query, [title, category, parseFloat(price), description, gameDetails, developerID, image], function (err) {
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

// Render Payment Page
app.post('/cart/checkout', isAuthenticated, (req, res) => {
    const userID = req.session.user.id;

    // Fetch user wallet
    const userQuery = `SELECT Wallet FROM User WHERE UserID = ?`;

    db.get(userQuery, [userID], (err, user) => {
        if (err || !user) {
            console.error('User wallet retrieval error:', err?.message || 'User not found');
            return res.status(500).send('Database error');
        }

        // Render Payment Page
        res.render('payment_page', { user: { ...req.session.user, wallet: user.Wallet } });
    });
});

// Handle Payment Confirmation
app.post('/cart/confirm-payment', isAuthenticated, (req, res) => {
    const { paymentMethod } = req.body;
    const userID = req.session.user.id;

    // Fetch games in cart and calculate total price
    const cartQuery = `
        SELECT g.GameID, g.Price, g.DeveloperID 
        FROM CartGame cg
        JOIN Cart c ON cg.CartID = c.CartID
        JOIN Game g ON cg.GameID = g.GameID
        WHERE c.UserID = ?;
    `;

    db.all(cartQuery, [userID], (err, games) => {
        if (err || games.length === 0) {
            console.error('Cart retrieval error:', err?.message || 'Cart is empty');
            return res.status(400).send('Your cart is empty.');
        }

        const totalPrice = games.reduce((sum, game) => sum + game.Price, 0);

        if (paymentMethod === 'wallet') {
            // Check wallet balance
            db.get(`SELECT Wallet FROM User WHERE UserID = ?`, [userID], (err, user) => {
                if (err || user.Wallet < totalPrice) {
                    console.error('Insufficient funds or wallet error');
                    return res.status(400).send('Insufficient wallet balance. Please add funds.');
                }

                // Begin transaction logic
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    // Deduct wallet balance
                    db.run(`UPDATE User SET Wallet = Wallet - ? WHERE UserID = ?`, [totalPrice, userID]);

                    // Add money to developers' wallets
                    games.forEach(game => {
                        db.run(`UPDATE Developer SET Wallet = Wallet + ? WHERE DeveloperID = ?`, [game.Price, game.DeveloperID]);
                    });

                    // Add games to library
                    db.run(`
                        INSERT INTO Library (UserID, GameID, PurchaseDate)
                        SELECT c.UserID, cg.GameID, CURRENT_TIMESTAMP
                        FROM CartGame cg
                        JOIN Cart c ON cg.CartID = c.CartID
                        WHERE c.UserID = ?;
                    `, [userID]);

                    // Clear cart
                    db.run(`DELETE FROM CartGame WHERE CartID = (SELECT CartID FROM Cart WHERE UserID = ?)`, [userID], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('Error clearing cart:', err.message);
                            return res.status(500).send('Transaction failed.');
                        }

                        db.run('COMMIT', () => {
                            console.log('Payment successful via wallet.');
                            res.send('Payment successful! Games have been added to your library.');
                        });
                    });
                });
            });
        } else {
            // For other payment methods
            console.log('Payment completed using other methods.');
            res.send('Payment successful using other methods!');
        }
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
