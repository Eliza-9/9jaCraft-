const express = require("express");
const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory database
let db = null;

// Initialize database
async function initDB() {
  const SQL = await initSqlJs();
  db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS artisans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      profession TEXT NOT NULL,
      state TEXT NOT NULL,
      lga TEXT NOT NULL,
      location TEXT NOT NULL,
      experience INTEGER DEFAULT 0,
      rating REAL DEFAULT 5,
      phone TEXT,
      bio TEXT,
      available INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artisan_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      service TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      location TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'Pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert sample data
  const checkArtisans = db.exec("SELECT COUNT(*) as count FROM artisans");
  if (checkArtisans.length === 0 || checkArtisans[0].values.length === 0) {
    const sampleData = [
      ["Adebayo Electrical Services", "Electrician", "Ekiti", "Oye", "Oye-Ekiti", 8, 4.8, "08012345678", "Residential and commercial electrical services.", 1],
      ["Chinedu Plumbing Works", "Plumber", "Lagos", "Ikeja", "Ikeja", 10, 4.9, "08023456789", "Plumbing repairs, installations and maintenance.", 1],
      ["Mariam Fashion House", "Tailor", "Abuja", "Garki", "Garki", 6, 4.7, "08034567890", "Custom tailoring and fashion design.", 1],
      ["Tunde Auto Repairs", "Mechanic", "Oyo", "Ibadan North", "Ibadan", 12, 4.9, "08045678901", "Automobile repair and maintenance.", 0],
      ["Blessing Hair Studio", "Hair Stylist", "Rivers", "Port Harcourt", "Port Harcourt", 7, 4.8, "08056789012", "Hair styling, braiding and beauty services.", 1],
      ["Emeka Carpentry Works", "Carpenter", "Enugu", "Enugu North", "Enugu", 9, 4.6, "08067890123", "Furniture making, repairs and custom woodwork.", 1]
    ];

    sampleData.forEach(data => {
      db.run(
        `INSERT INTO artisans (name, profession, state, lga, location, experience, rating, phone, bio, available)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data
      );
    });
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/artisans", (req, res) => {
  const q = req.query.q || "";
  const state = req.query.state || "";
  const lga = req.query.lga || "";

  const query = `
    SELECT * FROM artisans
    WHERE (name LIKE ? OR profession LIKE ?)
    AND state LIKE ?
    AND lga LIKE ?
    ORDER BY rating DESC
  `;

  const stmt = db.prepare(query);
  stmt.bind([`%${q}%`, `%${q}%`, `%${state}%`, `%${lga}%`]);

  const artisans = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    artisans.push(row);
  }
  stmt.free();

  res.json(artisans);
});

app.get("/api/artisans/:id", (req, res) => {
  const query = "SELECT * FROM artisans WHERE id = ?";
  const stmt = db.prepare(query);
  stmt.bind([parseInt(req.params.id)]);

  if (stmt.step()) {
    const artisan = stmt.getAsObject();
    stmt.free();
    return res.json(artisan);
  }

  stmt.free();
  res.status(404).json({ error: "Artisan not found." });
});

app.post("/api/bookings", (req, res) => {
  const {
    artisanId,
    customerName,
    customerPhone,
    service,
    bookingDate,
    bookingTime,
    location,
    notes = ""
  } = req.body;

  // Validate required fields
  if (
    !artisanId ||
    !customerName ||
    !customerPhone ||
    !service ||
    !bookingDate ||
    !bookingTime ||
    !location
  ) {
    return res.status(400).json({
      error: "Please complete all required fields."
    });
  }

  // Check if artisan exists
  const checkStmt = db.prepare("SELECT id FROM artisans WHERE id = ?");
  checkStmt.bind([artisanId]);
  const artisanExists = checkStmt.step();
  checkStmt.free();

  if (!artisanExists) {
    return res.status(404).json({ error: "Artisan not found." });
  }

  // Insert booking
  const insertStmt = db.prepare(`
    INSERT INTO bookings
    (artisan_id, customer_name, customer_phone, service,
     booking_date, booking_time, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.bind([
    artisanId,
    customerName,
    customerPhone,
    service,
    bookingDate,
    bookingTime,
    location,
    notes
  ]);
  insertStmt.step();
  insertStmt.free();

  // Get the last insert ID
  const idStmt = db.prepare("SELECT last_insert_rowid() as id");
  idStmt.step();
  const { id } = idStmt.getAsObject();
  idStmt.free();

  res.status(201).json({
    message: "Booking request submitted successfully.",
    bookingId: id,
    status: "Pending"
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server after DB initialization
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`SkillLink Nigeria running on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
