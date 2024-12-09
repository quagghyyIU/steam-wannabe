const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Initialize Express App
const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// SQLite Database Setup
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
});

// Const EJS
const path = require('path');

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Set views directory

// User Model
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    library: { type: DataTypes.JSON, defaultValue: [] }, // Store purchased game IDs
});

// Game Model
const Game = sequelize.define('Game', {
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    price: { type: DataTypes.FLOAT, allowNull: false },
    rating: { type: DataTypes.FLOAT, defaultValue: 0 },
    reviews: { type: DataTypes.JSON, defaultValue: [] },
});

// Middleware for Authentication
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'Access denied!' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid token!' });
    }
};

// Routes: Authentication
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, email, password: hashedPassword });
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: 'User not found!' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials!' });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/auth/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes Frontend for Web
app.get('/', (req, res) => {
    res.render('home'); // Serve home.ejs
});

app.get('/register', (req, res) => {
    res.render('register'); // Serve register.ejs
});

app.get('/login', (req, res) => {
    res.render('login'); // Serve login.ejs
});


// Routes: Game Management
app.get('/api/games/catalog', async (req, res) => {
    try {
        const games = await Game.findAll();
        res.json(games);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/games/add', authMiddleware, async (req, res) => {
    const { title, description, price } = req.body;
    try {
        const game = await Game.create({ title, description, price });
        res.status(201).json({ message: 'Game added successfully!', game });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/games/purchase', authMiddleware, async (req, res) => {
    const { gameId } = req.body;
    try {
        const game = await Game.findByPk(gameId);
        if (!game) return res.status(404).json({ message: 'Game not found!' });

        const user = await User.findByPk(req.user.id);
        const library = user.library || [];
        library.push(gameId);
        await user.update({ library });

        res.json({ message: 'Game added to library!', library });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Server and Sync Database
(async () => {
    await sequelize.sync();
    console.log('SQLite Database connected and synced');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();