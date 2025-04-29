const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const app = express();
const cors = require('cors');
const port = 3000;

const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const JWT_SECRET = 'sdfhsdofhowhjdfoj'
// const emailjs = require('emailjs-com');
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public')));
// Database connection
app.use(cors());
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '0816',
    database: 'financetracking'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        console.error(err); // Log the full error for debugging
        throw err;
    }
    console.log('MySQL Connected...');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json()); // Make sure this is added to your server


app.post(
    '/signup',
    [
        body('username').notEmpty().withMessage('Username is required'),
        body('email').isEmail().withMessage('Invalid email format'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { userId, username, email, password } = req.body;

        // Check if the email already exists
        db.query('SELECT * FROM Users WHERE email = ?', [email], async (err, results) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (results.length > 0) return res.status(400).json({ error: 'Email already registered' });

            
            db.query(
                'INSERT INTO Users (user_id,username, password_hash, email) VALUES (?, ?, ?,?)',
                [userId,username, password, email],
                (err, result) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    return res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
                }
            );
        });
    }
);


// Login Route
app.post(
    '/login',
    [
        body('email').isEmail().withMessage('Invalid email format'),
        body('password').exists().withMessage('Password is required'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;  // Access email and password directly from req.body

        // Check if the email exists in the database
        db.query('SELECT * FROM Users WHERE email = ?', [email], async (err, results) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (results.length === 0) return res.status(400).json({ error: 'Invalid email or password' });

            const user = results[0];

            // Compare the provided password with the hashed password
            const passwordTrimmed = password.trim();
            const isPasswordMatch = await bcrypt.compare(passwordTrimmed, user.password_hash);

            console.log(isPasswordMatch);
            console.log('Stored hash:', user.password_hash);
            console.log('Password ', password);
            if (password!=user.password_hash) return res.status(400).json({ error: 'Invalid email or password' });

            // Generate a JWT token
            const id = user.user_id;
            const username = user.username;
            console.log(id);
            const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '1h' });
            return res.status(200).json({ message: 'Login successful', token, userId:id,username:username });
        });
    }
);

// Create a new account for a user
app.post('/add-account', (req, res) => {
    const { user_id, account_name, account_type, balance } = req.body;
    // Check if the user exists
    const checkUserSql = 'SELECT * FROM Users WHERE user_id = ?';
    db.query(checkUserSql, [user_id], (err, result) => {
        if (err) throw err;
        if (result.length === 0) {
            res.status(400).send('User does not exist.');
        } else {
            const sql = 'INSERT INTO Accounts (user_id, account_name, account_type, balance) VALUES (?, ?, ?, ?)';
            db.query(sql, [user_id, account_name, account_type, balance], (err, result) => {
                if (err) throw err;
                res.send('Account added...');
            });
        }
    });
});

//getting the category
app.get('/get-category', (req, res) => {
    // Assuming you want to filter by user_id passed as a query parameter
    const userId = req.query.user_id;  // For example, /get-category?user_id=1

    // Check if user_id is provided
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const sql = 'SELECT * FROM Categories WHERE user_id = ?';
    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(result);  // Send the result back as JSON
    });
});
//getting the transactions

app.get('/get-transactions', (req, res) => {
    // Assuming you want to filter by user_id passed as a query parameter
    const userId = req.query.user_id;  // For example, /get-category?user_id=1

    // Check if user_id is provided
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const sql = 'SELECT * FROM Transactions WHERE user_id = ?';
    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(result);  // Send the result back as JSON
    });
});

//getting the budgets

app.get('/get-budgets', (req, res) => {
    const userId = req.query.user_id;  // For example, /get-budgets?user_id=1

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const sql = `
        SELECT b.budget_id, b.amount, b.start_date, b.end_date, c.category_name
        FROM Budgets b
        JOIN Categories c ON b.category_id = c.category_id
        WHERE b.user_id = ?
    `;

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(result);  // Send the result back as JSON
    });
});

//getting the goals

app.get('/get-goals', (req, res) => {
    const userId = req.query.user_id;  // For example, /get-goals?user_id=1

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const sql = `
        SELECT goal_id, goal_name, target_amount, current_amount, due_date
        FROM Goals
        WHERE user_id = ?
    `;

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(result);  // Send the result back as JSON
    });
});

//getting the notification
app.get('/get-notifications', (req, res) => {
    const userId = req.query.user_id;  // For example, /get-notifications?user_id=1

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const sql = 'SELECT notification_id, message, notification_date, is_read FROM Notifications WHERE user_id = ? ORDER BY notification_date DESC';

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(result);  // Send the result back as JSON
    });
});



// Create a new category for a user
app.post('/add-category', (req, res) => {
    // const userIdd = localStorage.get('userId');
    const { user_id, category_name, category_type } = req.body;
    const sql = 'INSERT INTO Categories (user_id, category_name, category_type) VALUES (?, ?, ?)';
    db.query(sql, [user_id, category_name, category_type], (err, result) => {
        if (err) throw err;
        res.send('Category added...');
    });
});

// Create a new transaction for a user
app.post('/add-transaction', (req, res) => {
    const { user_id, account_id, category_id, amount, transaction_date, description } = req.body;
    const sql = 'INSERT INTO Transactions (user_id, account_id, category_id, amount, transaction_date, description) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [user_id, account_id, category_id, amount, transaction_date, description], (err, result) => {
        if (err) throw err;
        res.send('Transaction added...');
    });
});

// Create a new budget for a user
app.post('/add-budget', (req, res) => {
    const { user_id, category_id, amount, start_date, end_date } = req.body;
    const sql = 'INSERT INTO Budgets (user_id, category_id, amount, start_date, end_date) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [user_id, category_id, amount, start_date, end_date], (err, result) => {
        if (err) throw err;
        res.send('Budget added...');
    });
});

// Create a new goal for a user
app.post('/add-goal', (req, res) => {
    const { user_id, goal_name, target_amount, current_amount, due_date } = req.body;
    const sql = 'INSERT INTO Goals (user_id, goal_name, target_amount, current_amount, due_date) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [user_id, goal_name, target_amount, current_amount, due_date], (err, result) => {
        if (err) throw err;
        res.send('Goal added...');
    });
});

// Create a new notification for a user
app.post('/add-notification', (req, res) => {
    const { user_id, message, is_read } = req.body;
    const sql = 'INSERT INTO Notifications (user_id, message, is_read) VALUES (?, ?, ?)';
    db.query(sql, [user_id, message, is_read], (err, result) => {
        if (err) throw err;
        res.send('Notification added...');
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join('C:', 'Users', 'DHRUV KAPOOR', 'Desktop', 'financetracking', 'finance-tracking', 'financeTracking.html'));
});
app.get('/dashboard', (req, res) => {
    const userId = req.query.user_id;
    // Fetch accounts, categories, etc., for the user
    const sql = `
        SELECT * FROM Accounts WHERE user_id = ?;
        SELECT * FROM Categories WHERE user_id = ?;
        SELECT * FROM Transactions WHERE user_id = ?;
    `;
    db.query(sql, [userId, userId, userId], (err, results) => {
        if (err) throw err;

        // Send data as JSON or render a view
        res.send({
            accounts: results[0],
            categories: results[1],
            transactions: results[2],
        });
    });
});     

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
// Start server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});



// Route handler for the root URL

