const express = require("express");
const initSqlJs = require("sql.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "skilllink-secret-key-2026";

let db = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// JWT verification middleware
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Initialize database
async function initDB() {
  const SQL = await initSqlJs();
  db = new SQL.Database();

  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar TEXT,
      bio TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create artisans table
  db.run(`
    CREATE TABLE IF NOT EXISTS artisans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      profession TEXT NOT NULL,
      state TEXT NOT NULL,
      lga TEXT NOT NULL,
      location TEXT NOT NULL,
      experience INTEGER DEFAULT 0,
      rating REAL DEFAULT 5,
      bio TEXT,
      available INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Create bookings table
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artisan_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      service TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      location TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'Pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(artisan_id) REFERENCES artisans(id),
      FOREIGN KEY(customer_id) REFERENCES users(id)
    )
  `);
}

// AUTH ROUTES
app.post("/api/auth/signup", async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "All fields required" });
  }

  if (!["artisan", "customer"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    // Check if user exists
    const checkStmt = db.prepare("SELECT id FROM users WHERE email = ?");
    checkStmt.bind([email]);
    if (checkStmt.step()) {
      checkStmt.free();
      return res.status(400).json({ error: "Email already registered" });
    }
    checkStmt.free();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const insertStmt = db.prepare(`
      INSERT INTO users (name, email, phone, password, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertStmt.bind([name, email, phone || "", hashedPassword, role]);
    insertStmt.step();
    insertStmt.free();

    // Get user ID
    const idStmt = db.prepare("SELECT last_insert_rowid() as id");
    idStmt.step();
    const { id } = idStmt.getAsObject();
    idStmt.free();

    // Create JWT token
    const token = jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      message: "Signup successful",
      token,
      user: { id, name, email, role }
    });
  } catch (error) {
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const stmt = db.prepare("SELECT id, name, email, password, role FROM users WHERE email = ?");
    stmt.bind([email]);
    
    if (!stmt.step()) {
      stmt.free();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = stmt.getAsObject();
    stmt.free();

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// ARTISAN ROUTES (Protected)
app.get("/api/artisans", verifyToken, (req, res) => {
  const q = req.query.q || "";
  const state = req.query.state || "";
  const lga = req.query.lga || "";

  const query = `
    SELECT a.*, u.name, u.phone, u.bio FROM artisans a
    JOIN users u ON a.user_id = u.id
    WHERE (u.name LIKE ? OR a.profession LIKE ?)
    AND a.state LIKE ?
    AND a.lga LIKE ?
    AND a.available = 1
    ORDER BY a.rating DESC
  `;

  const stmt = db.prepare(query);
  stmt.bind([`%${q}%`, `%${q}%`, `%${state}%`, `%${lga}%`]);

  const artisans = [];
  while (stmt.step()) {
    artisans.push(stmt.getAsObject());
  }
  stmt.free();

  res.json(artisans);
});

app.get("/api/artisans/:id", verifyToken, (req, res) => {
  const query = `
    SELECT a.*, u.name, u.phone, u.bio FROM artisans a
    JOIN users u ON a.user_id = u.id
    WHERE a.id = ?
  `;
  const stmt = db.prepare(query);
  stmt.bind([parseInt(req.params.id)]);

  if (stmt.step()) {
    const artisan = stmt.getAsObject();
    stmt.free();
    return res.json(artisan);
  }

  stmt.free();
  res.status(404).json({ error: "Artisan not found" });
});

// Create artisan profile (after signup)
app.post("/api/artisans", verifyToken, (req, res) => {
  if (req.user.role !== "artisan") {
    return res.status(403).json({ error: "Only artisans can create profiles" });
  }

  const { profession, state, lga, location, experience, bio } = req.body;

  if (!profession || !state || !lga || !location) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    const insertStmt = db.prepare(`
      INSERT INTO artisans (user_id, profession, state, lga, location, experience, bio, available)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertStmt.bind([
      req.user.id,
      profession,
      state,
      lga,
      location,
      experience || 0,
      bio || ""
    ]);
    insertStmt.step();
    insertStmt.free();

    res.status(201).json({ message: "Artisan profile created" });
  } catch (error) {
    res.status(500).json({ error: "Failed to create profile" });
  }
});

// BOOKING ROUTES (Protected)
app.post("/api/bookings", verifyToken, (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ error: "Only customers can book" });
  }

  const {
    artisan_id,
    service,
    booking_date,
    booking_time,
    location,
    notes = ""
  } = req.body;

  if (!artisan_id || !service || !booking_date || !booking_time || !location) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    // Verify artisan exists
    const checkStmt = db.prepare("SELECT id FROM artisans WHERE id = ?");
    checkStmt.bind([artisan_id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return res.status(404).json({ error: "Artisan not found" });
    }
    checkStmt.free();

    // Insert booking
    const insertStmt = db.prepare(`
      INSERT INTO bookings
      (artisan_id, customer_id, service, booking_date, booking_time, location, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.bind([
      artisan_id,
      req.user.id,
      service,
      booking_date,
      booking_time,
      location,
      notes
    ]);
    insertStmt.step();
    insertStmt.free();

    // Get booking ID
    const idStmt = db.prepare("SELECT last_insert_rowid() as id");
    idStmt.step();
    const { id } = idStmt.getAsObject();
    idStmt.free();

    res.status(201).json({
      message: "Booking submitted",
      bookingId: id,
      status: "Pending"
    });
  } catch (error) {
    res.status(500).json({ error: "Booking failed" });
  }
});

app.get("/api/bookings", verifyToken, (req, res) => {
  const query = req.user.role === "customer"
    ? `SELECT b.*, a.profession, u.name FROM bookings b
       JOIN artisans a ON b.artisan_id = a.id
       JOIN users u ON a.user_id = u.id
       WHERE b.customer_id = ?
       ORDER BY b.created_at DESC`
    : `SELECT b.*, u.name as customer_name, u.phone FROM bookings b
       JOIN artisans a ON b.artisan_id = a.id
       JOIN users u ON b.customer_id = u.id
       WHERE a.user_id = ?
       ORDER BY b.created_at DESC`;

  const stmt = db.prepare(query);
  stmt.bind([req.user.id]);

  const bookings = [];
  while (stmt.step()) {
    bookings.push(stmt.getAsObject());
  }
  stmt.free();

  res.json(bookings);
});

// USER PROFILE
app.get("/api/me", verifyToken, (req, res) => {
  const stmt = db.prepare("SELECT id, name, email, phone, role FROM users WHERE id = ?");
  stmt.bind([req.user.id]);
  
  if (stmt.step()) {
    const user = stmt.getAsObject();
    stmt.free();
    return res.json(user);
  }
  
  stmt.free();
  res.status(404).json({ error: "User not found" });
});

app.listen(PORT, async () => {
  await initDB();
  console.log(`✨ SkillLink Nigeria running on port ${PORT}`);
});
