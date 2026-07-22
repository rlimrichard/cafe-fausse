# Café Fausse

Full-stack restaurant website with a React/Vite frontend, Flask API, and
PostgreSQL database. It supports public menus, reservation requests,
newsletter subscriptions, and an authenticated admin area.

## Stack

- Frontend: React 18 and Vite
- Backend: Flask and Gunicorn
- Database: PostgreSQL with `psycopg`
- Web server: Nginx
- Process management: systemd

## Prerequisites

Provision a Linux server with:

- Git
- Python 3.9 or later, including `venv`
- Node.js 18 or later and npm
- PostgreSQL 14 or later
- Nginx
- A DNS record pointing to the server, plus TLS certificates if serving HTTPS

For Oracle Cloud Infrastructure, also allow inbound TCP 80 and 443 in both the
OCI security list/network security group and the server firewall.

## 1. Clone the application

```bash
sudo mkdir -p /opt/cafe_fausse
sudo chown "$USER":"$USER" /opt/cafe_fausse
git clone https://github.com/rlimrichard/cafe-fausse.git /opt/cafe_fausse
cd /opt/cafe_fausse
```

## 2. Create the database

Create a PostgreSQL database and a dedicated application user. Replace all
placeholder values before running these commands.

```bash
sudo -u postgres psql
```

```sql
CREATE USER cafe_fausse_app WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE cafe_fausse OWNER cafe_fausse_app;
\q
```

Load the schema:

```bash
psql "postgresql://cafe_fausse_app:choose-a-strong-password@localhost/cafe_fausse" \
  -f /opt/cafe_fausse/database/schema.sql
```

The backend also creates and updates supporting tables when it starts, but the
schema file is the preferred first-time setup.

## 3. Configure the backend

Create a virtual environment and install Python dependencies:

```bash
cd /opt/cafe_fausse/backend
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt gunicorn
```

Create `/opt/cafe_fausse/backend/.env`, set its permissions to `600`, and use
your own values:

```dotenv
DATABASE_URL=postgresql://cafe_fausse_app:choose-a-strong-password@localhost/cafe_fausse
ADMIN_PASSWORD=choose-a-strong-admin-password

# Optional but required for live newsletter and reservation emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=restaurant@example.com
SMTP_PASSWORD=your-gmail-app-password
EMAIL_FROM=Cafe Fausse <restaurant@example.com>
```

```bash
chmod 600 /opt/cafe_fausse/backend/.env
```

For Gmail, enable two-step verification and create a Gmail App Password. Do
not use the normal account password. Never commit `.env`, private keys, or App
Passwords to Git.

## 4. Build the frontend

```bash
cd /opt/cafe_fausse/frontend
npm ci
npm run build
```

This creates `frontend/dist`, which Nginx serves as the public website.

## 5. Run the Flask API with systemd

Create `/etc/systemd/system/cafe_fausse.service`:

```ini
[Unit]
Description=Cafe Fausse Flask API
After=network.target postgresql.service

[Service]
User=opc
Group=opc
WorkingDirectory=/opt/cafe_fausse/backend
EnvironmentFile=/opt/cafe_fausse/backend/.env
ExecStart=/opt/cafe_fausse/backend/venv/bin/gunicorn --workers 2 --bind 127.0.0.1:5001 app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Replace `opc` with the Linux user that owns the deployment. Enable and start
the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cafe_fausse
sudo systemctl status cafe_fausse
```

## 6. Configure Nginx

The versioned Nginx configuration is at
`deployment/nginx/cafe_fausse.conf`. Copy it to `/etc/nginx/conf.d/cafe_fausse.conf`
and replace `example.com` with the site's domain. It enables gzip compression,
long-lived immutable caching for Vite's hashed static assets, and no-cache
responses for the HTML shell:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    root /opt/cafe_fausse/frontend/dist;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml application/rss+xml image/svg+xml;

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* \.(?:css|js|mjs|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|avif|ico)$ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }

    # React client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Enable HTTPS

Use a certificate provider such as Let's Encrypt after the domain resolves to
the server. On systems with Certbot available:

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Verify renewal is enabled:

```bash
sudo systemctl status certbot.timer
```

## Deploying updates

From the application directory, update source, install any changed
dependencies, build the frontend, and restart the API:

```bash
cd /opt/cafe_fausse
git pull origin main
backend/venv/bin/pip install -r backend/requirements.txt gunicorn
cd frontend && npm ci && npm run build
sudo systemctl restart cafe_fausse
sudo nginx -t && sudo systemctl reload nginx
```

The current server uses the same sequence through:

```bash
sudo /usr/local/sbin/deploy-cafe-fausse
```

## Verification and troubleshooting

```bash
# Public site and API service
curl -I https://example.com/
sudo systemctl status cafe_fausse
sudo journalctl -u cafe_fausse -n 100 --no-pager

# Nginx
sudo nginx -t
sudo systemctl status nginx

# Backend health from the server
curl -I http://127.0.0.1:5001/
```

The admin page is available at `/admin`. Keep its password in the protected
backend `.env` file only; do not add it to README files, staging notes, source
code, or version control.
