# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Café Fausse — a full-stack restaurant web application. The project is **greenfield**; source code does not exist yet and must be built from the SRS document in this directory.

## Tech Stack

- **Frontend:** React with JSX, CSS Flexbox/Grid for responsive layout (no CSS framework required)
- **Backend:** Python/Flask (RESTful API)
- **Database:** PostgreSQL

## Assumed Project Structure

```
/
├── frontend/          # React app (create-react-app or Vite)
│   └── src/
│       ├── pages/     # Home, Menu, Reservations, AboutUs, Gallery
│       └── components/
├── backend/           # Flask app
│   ├── app.py
│   ├── models.py
│   └── requirements.txt
└── database/          # SQL schema/migrations
```

## Development Commands

Once scaffolded, the expected commands are:

```bash
# Frontend
cd frontend && npm install
npm start              # dev server (default: http://localhost:3000)
npm run build          # production build

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
flask run              # default: http://localhost:5000

# Database
psql -U postgres -c "CREATE DATABASE cafe_fausse;"
psql -U postgres -d cafe_fausse -f database/schema.sql
```

## Database Schema

Two required tables (FR-17):

```sql
CREATE TABLE customers (
    customer_id   SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    phone         VARCHAR(50),
    newsletter    BOOLEAN DEFAULT FALSE
);

CREATE TABLE reservations (
    reservation_id SERIAL PRIMARY KEY,
    customer_id    INTEGER REFERENCES customers(customer_id),
    time_slot      TIMESTAMP NOT NULL,
    table_number   INTEGER NOT NULL  -- 1–30
);
```

## Flask API Endpoints

These are the required endpoints (FR-18):

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/reservations` | Check availability, assign random table (1–30), insert customer + reservation |
| POST | `/api/newsletter` | Validate email format, store in customers table |

The reservation endpoint must check whether all 30 tables are already booked for the requested `time_slot` before inserting. Return `409` if fully booked, `201` with table number on success.

## Key Business Rules

- **Tables:** 30 total. On booking, select a random unbooked table for the given time slot (FR-8).
- **Time slots:** Operating hours are Mon–Sat 5–11 PM, Sun 5–9 PM. Validate submitted time slots against these hours (FR-7).
- **No double-booking:** A table cannot be assigned twice for the same time slot (NFR-5).
- **Newsletter signup** is separate from reservations but shares the `customers` table via the `newsletter` flag.

## Pages and Content

All static content (menu items, prices, awards, reviews, founders) is specified exactly in the SRS PDF. Use those values verbatim — do not invent placeholder content.

- **Gallery:** Requires a lightbox component for full-size image viewing (FR-13).
- **Reservations form fields:** time slot, guest count, name, email, phone (optional).

## Frontend–Backend Integration

- Run Flask with CORS enabled (`flask-cors`) during development so the React dev server (`:3000`) can call the Flask API (`:5000`).
- In production, serve the React build from Flask's `static` folder or configure a reverse proxy.
