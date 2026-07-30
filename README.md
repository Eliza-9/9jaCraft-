
# SkillLink Nigeria

> Connecting Skilled Hands to Those Who Need Them

SkillLink Nigeria is a modern full-stack web application that connects customers with verified artisans across Nigeria. Customers can search for skilled professionals by profession and location, view artisan profiles, book services, and leave reviews. Artisans can create professional profiles, manage their availability, and receive bookings.

## Features

### For Customers
- Search artisans by name or profession
- Filter by state, local government area (LGA), and town/city
- View detailed artisan profiles with ratings and reviews
- Book artisans with preferred date, time, and service details
- Contact artisans via phone call or WhatsApp
- Leave ratings and reviews after completed jobs

### For Artisans
- Create and edit a professional profile
- Upload a profile picture
- Set availability status (Available, Busy, Offline)
- Receive and manage booking requests
- Accept or reject bookings
- Mark jobs as completed

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Backend & Database:** Bolt Database (PostgreSQL with Row-Level Security)
- **Authentication:** Bolt Database Auth (email/password)

## Supported Professions

Electricians, Plumbers, Carpenters, Tailors, Painters, Mechanics, Hairdressers, Welders, AC Technicians, and Masons.

## Location Coverage

All 36 Nigerian states plus the Federal Capital Territory (FCT), with local government areas for major states including Lagos, FCT, Rivers, Kano, Oyo, Enugu, Kaduna, Abia, Ogun, and Delta.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/skilllink-nigeria.git
cd skilllink-nigeria

# Install dependencies
npm install

# Start the development server
npm run dev
