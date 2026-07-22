# Café Fausse

Full-stack restaurant website built with React/Vite, Flask, and PostgreSQL.
Supports public menus, reservation requests, newsletter subscriptions, a
photo gallery with lightbox navigation, and a password-protected admin area.

## Design

### Architecture

The application follows a standard three-tier architecture:

```
Browser (React SPA)
      ↕  HTTP/JSON  (/api/*)
Flask REST API (Python)
      ↕  psycopg3
PostgreSQL database
```

In development, Vite's dev server proxies `/api/*` requests to Flask on port
5001, so the frontend and backend run independently without CORS friction. In
production, Nginx serves the pre-built React bundle as static files and reverse-
proxies `/api/*` to Gunicorn, so there is only one origin from the browser's
perspective.

### Frontend

The frontend is a single-page application (SPA) using React 18 and React Router
v6. Each page is a standalone component under `frontend/src/pages/`. Shared UI
(navigation bar, footer) lives in `frontend/src/components/`.

Styling is written entirely in plain CSS using Flexbox and Grid — no UI
framework is used. Each page has its own `.css` file co-located next to the
component. Responsive breakpoints are handled with `@media` queries.

### Backend

The backend is a single Flask application (`backend/app.py`). All routes are
defined in one file to keep the surface area small for a project of this size.

Key design decisions:
- **psycopg3** (`psycopg[binary]`) is used instead of an ORM (SQLAlchemy) to
  keep SQL explicit and avoid hidden query overhead.
- **In-memory log buffer** (`collections.deque`, maxlen 200) captures Flask log
  output and exposes it via `/api/admin/logs` so the admin panel can display
  live logs without SSH access.
- **Email is fire-and-forget** — SMTP failures are caught and logged but do not
  roll back a successfully saved reservation.
- **Admin auth** uses a single shared password passed as an HTTP header
  (`X-Admin-Password`), which is sufficient for an internal management tool
  without user accounts.

### Database

Two core tables fulfil the course requirements (`customers` and `reservations`).
Two additional tables were added during development:

- `menu_items` — allows the admin to manage menu content without code changes.
- `visitor_events` — stores anonymous page-visit events (UUID per browser) for
  the admin analytics dashboard.

The `UNIQUE (time_slot, table_number)` constraint on `reservations` is the
database-level backstop that prevents double-booking even under concurrent
requests.

---

## Pages

| Route | Description |
|---|---|
| `/` | Home — hero, welcome, hours, awards |
| `/menu` | Menu — items grouped by category with images and prices |
| `/reservations` | Reservation request form + lookup by email |
| `/about` | About — founders, story, team |
| `/gallery` | Photo gallery with fullscreen lightbox (arrow/keyboard navigation) |
| `/admin` | Admin dashboard (password protected) |

## Stack

- **Frontend:** React 18 + Vite, CSS Flexbox/Grid (no framework)
- **Backend:** Flask 3 + Gunicorn, psycopg3 (PostgreSQL driver)
- **Database:** PostgreSQL
- **Web server:** Nginx (reverse proxy + static file server)
- **Process manager:** systemd

## Database Schema

```sql
customers       -- name, email (unique), phone, newsletter_signup flag
reservations    -- customer FK, time_slot, table_number (1–30), guest_count, status
menu_items      -- category, item_name (unique), description, price, image_url
visitor_events  -- visitor_id (UUID), path, visited_at
```

Reservation status is one of `pending`, `accepted`, or `denied`. All new
bookings start as `pending` and await review in the admin dashboard.

## API Endpoints

### Public

| Method | Path | Description |
|---|---|---|
| POST | `/api/reservations` | Submit a reservation request (future dates only, validates operating hours) |
| POST | `/api/reservations/lookup` | Look up reservation status by email |
| POST | `/api/newsletter` | Subscribe an email to the newsletter |
| GET | `/api/menu` | List all menu items |
| GET | `/api/menu-images/<filename>` | Serve uploaded menu images |
| POST | `/api/visits` | Record an anonymous page visit (visitor analytics) |

### Admin (require `X-Admin-Password` header)

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/reservations` | List reservations (optional `?status=pending\|accepted\|denied`) |
| PATCH | `/api/admin/reservations/<id>` | Update status to accepted/denied/pending; sends email on accept or deny |
| DELETE | `/api/admin/reservations/<id>` | Delete a single reservation |
| POST | `/api/admin/reservations/bulk` | Bulk accept/deny/pending/delete by list of IDs |
| GET | `/api/admin/menu-items` | List menu items |
| POST | `/api/admin/menu-items` | Create a menu item (multipart, supports image upload) |
| PATCH | `/api/admin/menu-items/<id>` | Update a menu item |
| DELETE | `/api/admin/menu-items/<id>` | Delete a menu item |
| GET | `/api/admin/newsletter-subscribers` | List newsletter subscribers |
| DELETE | `/api/admin/newsletter-subscribers` | Unsubscribe an email |
| GET | `/api/admin/db/<table>` | View raw table rows (allowed: customers, reservations, menu_items) |
| GET | `/api/admin/logs` | Tail in-memory Flask log buffer (supports `?since=<iso>` for polling) |
| GET | `/api/admin/insights` | Visitor analytics (unique visitors, page views, today count) |
| GET | `/api/admin/db-counts` | Row counts per table |

## Admin Dashboard

The admin page at `/admin` requires the password set in `ADMIN_PASSWORD`.
The session is stored in `sessionStorage` and persists across page reloads
until the browser tab is closed.

Features:

- **Reservations** — calendar and list views; filter by status (all / pending /
  accepted / denied); single-row Accept / Deny / Pending / Delete actions;
  bulk toolbar appears when rows are selected
- **Menu manager** — add, edit, and delete menu items with optional image upload
- **Newsletter subscribers** — view and remove subscribers
- **Database viewer** — browse raw rows in the customers, reservations, and
  menu_items tables
- **Logs panel** — live-polling Flask log stream with pause/resume/clear;
  email content is logged here when SMTP is not configured

## Email Notifications

Three automated emails are sent from the Flask backend via SMTP:

| Trigger | Email sent |
|---|---|
| Reservation request submitted | Acknowledgement to guest |
| Admin accepts reservation | Confirmation with date, time, and table number |
| Admin denies reservation | Regret message with phone number to call |
| Newsletter signup | Welcome email |

Email is logged to the admin log panel regardless of SMTP configuration.
If SMTP credentials are absent, the email is skipped but the action still
succeeds.

## Business Rules

- **30 tables** — a random unbooked table is assigned per time slot; returns
  `409` when all 30 are taken
- **Operating hours** — Mon–Sat 5–11 PM, Sun 5–9 PM; past dates and
  out-of-hours slots are rejected at both frontend and backend
- **No double-booking** — enforced in application logic and backed by a
  `UNIQUE (time_slot, table_number)` database constraint
- **Phone number** — optional on reservation submission; not required for lookup

---

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.9+
- PostgreSQL 14+

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create the database
createdb cafe_fausse_db
psql cafe_fausse_db -f ../database/schema.sql

# Configure environment
cp .env.example .env   # then edit with your values
flask run --port 5001
```

`.env` variables:

```dotenv
DATABASE_URL=postgresql://localhost/cafe_fausse_db
ADMIN_PASSWORD=choose-a-strong-password

# Optional — if absent, emails are logged but not sent
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=Café Fausse <your@gmail.com>
```

For Gmail, use a [Gmail App Password](https://myaccount.google.com/apppasswords),
not your normal account password. Never commit `.env` to Git.

### Frontend

```bash
cd frontend
npm install
npm run dev    # dev server at http://localhost:5173 (proxies /api → :5001)
```

---

## Production Deployment

### Prerequisites

- Linux server (Oracle Linux 9 or equivalent)
- Git, Python 3.9+, Node.js 18+, PostgreSQL, Nginx
- For Oracle Cloud: allow inbound TCP 80 and 443 in the OCI security list and
  the OS firewall (`firewall-cmd`)

### 1. Clone and set up the database

```bash
sudo mkdir -p /opt/cafe_fausse
sudo chown "$USER":"$USER" /opt/cafe_fausse
git clone https://github.com/rlimrichard/cafe-fausse.git /opt/cafe_fausse
cd /opt/cafe_fausse

sudo -u postgres psql -c "CREATE USER cafe_app WITH PASSWORD 'strongpassword';"
sudo -u postgres psql -c "CREATE DATABASE cafe_fausse OWNER cafe_app;"
psql "postgresql://cafe_app:strongpassword@localhost/cafe_fausse" -f database/schema.sql
```

### 2. Configure and install the backend

```bash
cd /opt/cafe_fausse/backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt gunicorn
chmod 600 .env   # after filling in .env with production values
```

### 3. Create the systemd service

`/etc/systemd/system/cafe_fausse.service`:

```ini
[Unit]
Description=Cafe Fausse Flask API
After=network.target postgresql.service

[Service]
User=opc
Group=opc
WorkingDirectory=/opt/cafe_fausse/backend
EnvironmentFile=/opt/cafe_fausse/backend/.env
ExecStart=/opt/cafe_fausse/backend/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5001 app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cafe_fausse
```

### 4. Build the frontend

```bash
cd /opt/cafe_fausse/frontend
npm ci
npm run build   # outputs to frontend/dist
```

### 5. Configure Nginx

`/etc/nginx/conf.d/cafe_fausse.conf`:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    root /opt/cafe_fausse/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

To also serve via IP address, add a second server block in
`/etc/nginx/conf.d/cafe_fausse_ip.conf`:

```nginx
server {
    listen 80;
    server_name <your-server-ip>;

    root /opt/cafe_fausse/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

On Oracle Linux with SELinux, also run:

```bash
sudo setsebool -P httpd_can_network_connect 1
sudo chcon -Rt httpd_sys_content_t /opt/cafe_fausse/frontend/dist
```

### 6. Enable HTTPS (optional)

```bash
sudo certbot --nginx -d example.com -d www.example.com
sudo systemctl status certbot.timer   # verify auto-renewal
```

### Deploying updates

```bash
cd /opt/cafe_fausse
git pull origin main
backend/venv/bin/pip install -r backend/requirements.txt
cd frontend && npm ci && npm run build && cd ..
sudo systemctl restart cafe_fausse
sudo nginx -t && sudo systemctl reload nginx
```

---

## Troubleshooting

```bash
# Service status and recent logs
sudo systemctl status cafe_fausse
sudo journalctl -u cafe_fausse -n 100 --no-pager

# Nginx config and status
sudo nginx -t
sudo systemctl status nginx

# Test the API directly on the server
curl -s http://127.0.0.1:5001/api/menu | python3 -m json.tool

# Connect to the database
psql "postgresql://cafe_app:password@localhost/cafe_fausse"
```

The admin log panel at `/admin` (Logs tab) streams Flask logs in real time
and is often the fastest way to diagnose reservation or email issues without
needing SSH access.
