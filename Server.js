const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database(path.join(__dirname, "data", "skilllink.db"));

db.exec(`
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
);

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
);
`);

if (db.prepare("SELECT COUNT(*) AS count FROM artisans").get().count === 0) {
  const add = db.prepare(`
    INSERT INTO artisans
    (name, profession, state, lga, location, experience, rating, phone, bio, available)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  [
    ["Adebayo Electrical Services","Electrician","Ekiti","Oye","Oye-Ekiti",8,4.8,"08012345678","Residential and commercial electrical services.",1],
    ["Chinedu Plumbing Works","Plumber","Lagos","Ikeja","Ikeja",10,4.9,"08023456789","Plumbing repairs, installations and maintenance.",1],
    ["Mariam Fashion House","Tailor","Abuja","Garki","Garki",6,4.7,"08034567890","Custom tailoring and fashion design.",1],
    ["Tunde Auto Repairs","Mechanic","Oyo","Ibadan North","Ibadan",12,4.9,"08045678901","Automobile repair and maintenance.",0],
    ["Blessing Hair Studio","Hair Stylist","Rivers","Port Harcourt","Port Harcourt",7,4.8,"08056789012","Hair styling, braiding and beauty services.",1],
    ["Emeka Carpentry Works","Carpenter","Enugu","Enugu North","Enugu",9,4.6,"08067890123","Furniture making, repairs and custom woodwork.",1]
  ].forEach(a => add.run(...a));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/artisans", (req, res) => {
  const q = req.query.q || "";
  const state = req.query.state || "";
  const lga = req.query.lga || "";
  const term = `%${q}%`;

  const artisans = db.prepare(`
    SELECT * FROM artisans
    WHERE (name LIKE ? OR profession LIKE ?)
    AND state LIKE ?
    AND lga LIKE ?
    ORDER BY rating DESC
  `).all(term, term, `%${state}%`, `%${lga}%`);

  res.json(artisans);
});

app.get("/api/artisans/:id", (req, res) => {
  const artisan = db
    .prepare("SELECT * FROM artisans WHERE id = ?")
    .get(req.params.id);

  if (!artisan) {
    return res.status(404).json({ error: "Artisan not found." });
  }

  res.json(artisan);
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

  const artisan = db
    .prepare("SELECT id FROM artisans WHERE id = ?")
    .get(artisanId);

  if (!artisan) {
    return res.status(404).json({ error: "Artisan not found." });
  }

  const result = db.prepare(`
    INSERT INTO bookings
    (artisan_id, customer_name, customer_phone, service,
     booking_date, booking_time, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    artisanId,
    customerName,
    customerPhone,
    service,
    bookingDate,
    bookingTime,
    location,
    notes
  );

  res.status(201).json({
    message: "Booking request submitted successfully.",
    bookingId: result.lastInsertRowid,
    status: "Pending"
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`SkillLink Nigeria running on port ${PORT}`);
});
