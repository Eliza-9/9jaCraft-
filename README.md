# 🔧 9jaCraft

**A Nigerian artisan-finder and booking marketplace.**

9jaCraft connects everyday Nigerians with trusted, skilled artisans — plumbers, electricians, tailors, carpenters, and more — across every state and LGA in Nigeria. Customers can search, filter, and book artisans directly; artisans can build a public listing, manage bookings, and grow a reputation through verified reviews.

Live app: `https://[your-render-url].onrender.com`

---

## ✨ Features

### Core Marketplace
- **Artisan profiles** — trade, state, LGA, street, city, area, price range, years of experience, and bio
- **Custom trades** — artisans can select from a curated list or enter their own trade if it isn't listed (e.g. "Dog Grooming"), fully searchable either way
- **Search & filter** — by trade/keyword, state, or LGA
- **Sort** — by rating, years of experience, or newest listing
- **Booking flow** — customers send a request with a message and an optional preferred date/time; artisans accept, decline, or mark the job completed
- **Server-enforced privacy** — an artisan's phone number/WhatsApp contact is only ever included in the API response after a real booking exists between that customer and artisan — never exposed by default

### Trust & Ratings
- **Star ratings** — customers rate completed bookings (1–5 stars, optional comment)
- **Live rating recalculation** — an artisan's average rating and review count update automatically whenever a new review is submitted
- **Reviews on profile** — recent reviews are shown directly on each artisan's card
- **Verified badge** — artisans are automatically marked verified once they reach 3+ completed reviews with an average rating of 4 stars or higher

### Accounts & Security
- **JWT-based authentication** with bcrypt password hashing
- **Role-based access** — separate customer and artisan account types, with artisan-only actions (creating listings, managing bookings) gated server-side

### Frontend Experience
- **Custom response modal** — consistent success/error feedback across every action (no native browser alerts)
- **Landing page** — marketing homepage with hero section, trust stats, feature highlights, popular trades, and a call to action, served at the root URL
- **Dark glassmorphic design system** — deep navy/teal palette, blurred background glows, translucent glass cards, built mobile-first with a fixed bottom icon navigation bar
- **Fully responsive** — tested from small mobile screens up through tablet and desktop layouts

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | PostgreSQL (hosted on Neon) |
| Auth | JSON Web Tokens (jsonwebtoken), bcryptjs for password hashing |
| Frontend | Vanilla HTML, CSS, JavaScript (no framework) |
| Hosting | Render — single service serving both the API and the static frontend |

---

## 📁 Project Structure
