# SkillLink Nigeria

Full-stack artisan finder and booking MVP for customers across Nigeria.

## Features
- Artisan profiles
- Search by artisan name or service
- State and LGA filtering
- Artisan location and availability
- Ratings and experience
- Booking requests saved to SQLite
- WhatsApp contact
- Mobile-responsive interface

## Technology
HTML, CSS, JavaScript, Node.js, Express and SQLite (better-sqlite3).

## Run
npm install
npm start

The server serves the frontend and API. SQLite is created automatically in `data/skilllink.db`.

## API
GET /api/artisans
GET /api/artisans/:id
POST /api/bookings

## Architecture
Browser frontend -> Node.js/Express API -> SQLite database.

SQLite keeps the MVP self-contained and deployment-friendly. A production version can migrate to PostgreSQL.
