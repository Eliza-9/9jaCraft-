const express = require("express");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "skilllink-secret-key-2026";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar TEXT,
      bio TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS artisans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      profession TEXT NOT NULL,
      state TEXT NOT NULL,
      lga TEXT NOT NULL,
      location TEXT NOT NULL,
      experience INTEGER DEFAULT 0,
      rating REAL DEFAULT 5,
      bio TEXT,
      available INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE artisans ADD COLUMN IF NOT EXISTS city TEXT`);
  await pool.query(`ALTER TABLE artisans ADD COLUMN IF NOT EXISTS area TEXT`);
  await pool.query(`ALTER TABLE artisans ADD COLUMN IF NOT EXISTS price_range TEXT`);
  await pool.query(`ALTER TABLE artisans ADD COLUMN IF NOT EXISTS verified INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE artisans ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      artisan_id INTEGER NOT NULL REFERENCES artisans(id),
      customer_id INTEGER NOT NULL REFERENCES users(id),
      service TEXT NOT NULL,
      booking_date TEXT,
      booking_time TEXT,
      location TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS message TEXT`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
      artisan_id INTEGER NOT NULL REFERENCES artisans(id),
      customer_id INTEGER NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Database tables ready");
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
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, email, phone || "", hashedPassword, role]
    );
    const id = result.rows[0].id;
    const token = jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ message: "Signup successful", token, user: { id, name, email, role } });
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
    const result = await pool.query(
      "SELECT id, name, email, password, role FROM users WHERE email = $1",
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ message: "Login successful", token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// ARTISAN ROUTES (Protected)
app.get("/api/artisans", verifyToken, async (req, res) => {
  const q = req.query.q || "";
  const state = req.query.state || "";
  const lga = req.query.lga || "";
  const sort = req.query.sort || "rating";

  const sortMap = {
    rating: "a.rating DESC",
    experience: "a.experience DESC",
    newest: "a.created_at DESC"
  };
  const orderBy = sortMap[sort] || sortMap.rating;

  try {
    const result = await pool.query(
      `SELECT a.*, u.name, u.bio,
        CASE WHEN EXISTS (
          SELECT 1 FROM bookings b WHERE b.artisan_id = a.id AND b.customer_id = $4
        ) OR a.user_id = $4 THEN u.phone ELSE NULL END AS phone,
        (SELECT COALESCE(json_agg(json_build_object('rating', rv.rating, 'comment', rv.comment) ORDER BY rv.created_at DESC), '[]')
         FROM (SELECT * FROM reviews WHERE reviews.artisan_id = a.id ORDER BY created_at DESC LIMIT 2) rv) AS recent_reviews
       FROM artisans a
       JOIN users u ON a.user_id = u.id
       WHERE (u.name ILIKE $1 OR a.profession ILIKE $1)
       AND a.state ILIKE $2
       AND a.lga ILIKE $3
       AND a.available = 1
       ORDER BY ${orderBy}`,
      [`%${q}%`, `%${state}%`, `%${lga}%`, req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});

app.get("/api/artisans/:id", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name, u.bio,
        CASE WHEN EXISTS (
          SELECT 1 FROM bookings b WHERE b.artisan_id = a.id AND b.customer_id = $2
        ) OR a.user_id = $2 THEN u.phone ELSE NULL END AS phone,
        (SELECT COALESCE(json_agg(json_build_object('rating', rv.rating, 'comment', rv.comment) ORDER BY rv.created_at DESC), '[]')
         FROM (SELECT * FROM reviews WHERE reviews.artisan_id = a.id ORDER BY created_at DESC LIMIT 5) rv) AS recent_reviews
       FROM artisans a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = $1`,
      [parseInt(req.params.id), req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Artisan not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch artisan" });
  }
});

app.get("/api/me/artisan-profile", verifyToken, async (req, res) => {
  if (req.user.role !== "artisan") {
    return res.status(403).json({ error: "Only artisans have this" });
  }
  try {
    const result = await pool.query("SELECT * FROM artisans WHERE user_id = $1", [req.user.id]);
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

app.post("/api/artisans", verifyToken, async (req, res) => {
  if (req.user.role !== "artisan") {
    return res.status(403).json({ error: "Only artisans can create profiles" });
  }
  const { profession, state, lga, location, city, area, price_range, experience, bio } = req.body;
  if (!profession || !state || !lga || !location) {
    return res.status(400).json({ error: "All fields required" });
  }
  try {
    const existing = await pool.query("SELECT id FROM artisans WHERE user_id = $1", [req.user.id]);

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE artisans SET profession=$1, state=$2, lga=$3, location=$4, city=$5, area=$6, price_range=$7, experience=$8, bio=$9
         WHERE user_id = $10`,
        [profession, state, lga, location, city || "", area || "", price_range || "", experience || 0, bio || "", req.user.id]
      );
      return res.json({ message: "Artisan profile updated" });
    }

    await pool.query(
      `INSERT INTO artisans (user_id, profession, state, lga, location, city, area, price_range, experience, bio, available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)`,
      [req.user.id, profession, state, lga, location, city || "", area || "", price_range || "", experience || 0, bio || ""]
    );
    res.status(201).json({ message: "Artisan profile created" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// BOOKING ROUTES (Protected)
app.post("/api/bookings", verifyToken, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ error: "Only customers can book" });
  }
  const { artisan_id, service, message, booking_date, booking_time, location, notes = "" } = req.body;
  if (!artisan_id || !message || !location) {
    return res.status(400).json({ error: "artisan_id, message, and location are required" });
  }
  try {
    const artisan = await pool.query("SELECT id, profession FROM artisans WHERE id = $1", [artisan_id]);
    if (artisan.rows.length === 0) {
      return res.status(404).json({ error: "Artisan not found" });
    }
    const result = await pool.query(
      `INSERT INTO bookings
       (artisan_id, customer_id, service, booking_date, booking_time, location, notes, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [artisan_id, req.user.id, service || artisan.rows[0].profession, booking_date || null, booking_time || null, location, notes, message]
    );
    res.status(201).json({ message: "Booking submitted", bookingId: result.rows[0].id, status: "Pending" });
  } catch (error) {
    res.status(500).json({ error: "Booking failed" });
  }
});

app.patch("/api/bookings/:id/status", verifyToken, async (req, res) => {
  if (req.user.role !== "artisan") {
    return res.status(403).json({ error: "Only artisans can update booking status" });
  }
  const { status } = req.body;
  const allowed = ["Accepted", "Declined", "Completed"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Status must be Accepted, Declined, or Completed" });
  }
  try {
    const booking = await pool.query(
      `SELECT b.id FROM bookings b
       JOIN artisans a ON b.artisan_id = a.id
       WHERE b.id = $1 AND a.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (booking.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found or not yours" });
    }
    await pool.query("UPDATE bookings SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ message: `Booking marked ${status}` });
  } catch (error) {
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// Submit a review for a completed booking
app.post("/api/bookings/:id/review", verifyToken, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ error: "Only customers can leave reviews" });
  }
  const { rating, comment } = req.body;
  const ratingNum = parseInt(rating);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }
  try {
    const booking = await pool.query(
      "SELECT id, artisan_id, status FROM bookings WHERE id = $1 AND customer_id = $2",
      [req.params.id, req.user.id]
    );
    if (booking.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.rows[0].status !== "Completed") {
      return res.status(400).json({ error: "You can only review completed bookings" });
    }

    const existingReview = await pool.query("SELECT id FROM reviews WHERE booking_id = $1", [req.params.id]);
    if (existingReview.rows.length > 0) {
      return res.status(400).json({ error: "You already reviewed this booking" });
    }

    const artisanId = booking.rows[0].artisan_id;

    await pool.query(
      `INSERT INTO reviews (booking_id, artisan_id, customer_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, artisanId, req.user.id, ratingNum, comment || ""]
    );

    // Recalculate live average rating + review count
    await pool.query(
      `UPDATE artisans SET
        rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE artisan_id = $1),
        review_count = (SELECT COUNT(*) FROM reviews WHERE artisan_id = $1)
       WHERE id = $1`,
      [artisanId]
    );

    res.status(201).json({ message: "Review submitted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit review" });
  }
});

app.get("/api/bookings", verifyToken, async (req, res) => {
  try {
    const query = req.user.role === "customer"
      ? `SELECT b.*, a.profession, u.name, r.rating AS existing_rating, r.comment AS existing_comment
         FROM bookings b
         JOIN artisans a ON b.artisan_id = a.id
         JOIN users u ON a.user_id = u.id
         LEFT JOIN reviews r ON r.booking_id = b.id
         WHERE b.customer_id = $1
         ORDER BY b.created_at DESC`
      : `SELECT b.*, u.name as customer_name, u.phone FROM bookings b
         JOIN artisans a ON b.artisan_id = a.id
         JOIN users u ON b.customer_id = u.id
         WHERE a.user_id = $1
         ORDER BY b.created_at DESC`;
    const result = await pool.query(query, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// USER PROFILE
app.get("/api/me", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, phone, role FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

app.listen(PORT, async () => {
  await initDB();
  console.log(`✨ SkillLink Nigeria running on port ${PORT}`);
});
