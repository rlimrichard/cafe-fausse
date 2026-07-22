import os
import random
import re
import smtplib
import logging
import uuid
import shutil
from io import BytesIO
from collections import deque
from email.utils import formatdate, make_msgid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
from werkzeug.utils import safe_join, secure_filename
from PIL import Image

load_dotenv()

app = Flask(__name__)
CORS(app)

# ── In-memory log buffer (last 200 entries) ───────────────────────────────────
_log_buffer = deque(maxlen=200)

_ANSI_RE = re.compile(r'\x1b\[[0-9;]*m')

class _BufferHandler(logging.Handler):
    def emit(self, record):
        _log_buffer.append({
            'ts': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'msg': _ANSI_RE.sub('', self.format(record)),
        })

_buf_handler = _BufferHandler()
_buf_handler.setFormatter(logging.Formatter('%(message)s'))
logging.getLogger().addHandler(_buf_handler)
logging.getLogger().setLevel(logging.DEBUG)

DB_URL        = os.environ.get('DATABASE_URL', 'postgresql://localhost/cafe_fausse')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
SMTP_HOST     = os.environ.get('SMTP_HOST', '')
SMTP_PORT     = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER     = os.environ.get('SMTP_USER', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
EMAIL_FROM    = os.environ.get('EMAIL_FROM', SMTP_USER)
MENU_UPLOAD_DIR = os.environ.get('MENU_UPLOAD_DIR', os.path.join(os.path.dirname(__file__), 'uploads', 'menu'))
MAX_MENU_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_MENU_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
MENU_IMAGE_VARIANT_WIDTHS = {320, 640}
DEFAULT_MENU_IMAGES = {
    'Bruschetta': 'bruschetta.jpg',
    'Caesar Salad': 'caesar-salad.jpg',
    'Grilled Salmon': 'grilled-salmon.jpg',
    'Ribeye Steak': 'ribeye-steak.jpg',
    'Vegetable Risotto': 'vegetable-risotto.jpg',
    'Tiramisu': 'tiramisu.jpg',
    'Cheesecake': 'cheesecake.jpg',
    'Red Wine (Glass)': 'red-wine.jpg',
    'White Wine (Glass)': 'white-wine.jpg',
    'Craft Beer': 'craft-beer.jpg',
    'Espresso': 'espresso.jpg',
}

os.makedirs(MENU_UPLOAD_DIR, exist_ok=True)
app.config['MAX_CONTENT_LENGTH'] = MAX_MENU_IMAGE_BYTES

# Keyed by Python weekday: Mon=0 … Sun=6
HOURS = {
    0: (17, 23),
    1: (17, 23),
    2: (17, 23),
    3: (17, 23),
    4: (17, 23),
    5: (17, 23),
    6: (17, 21),  # Sunday closes at 9 PM
}

EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
HTML_TAG_RE = re.compile(r'<[^>]*>')


def get_conn():
    return psycopg.connect(DB_URL, row_factory=dict_row)


def ensure_menu_table():
    """Create and seed the menu table on existing deployments without a migration runner."""
    seed_items = [
        ('Starters', 'Bruschetta', 'Fresh tomatoes, basil, olive oil, and toasted baguette slices', Decimal('8.50'), 10),
        ('Starters', 'Caesar Salad', 'Crisp romaine with homemade Caesar dressing', Decimal('9.00'), 20),
        ('Main Courses', 'Grilled Salmon', 'Served with lemon butter sauce and seasonal vegetables', Decimal('22.00'), 10),
        ('Main Courses', 'Ribeye Steak', '12 oz prime cut with garlic mashed potatoes', Decimal('28.00'), 20),
        ('Main Courses', 'Vegetable Risotto', 'Creamy Arborio rice with wild mushrooms', Decimal('18.00'), 30),
        ('Desserts', 'Tiramisu', 'Classic Italian dessert with mascarpone', Decimal('7.50'), 10),
        ('Desserts', 'Cheesecake', 'Creamy cheesecake with berry compote', Decimal('7.00'), 20),
        ('Beverages', 'Red Wine (Glass)', 'A selection of Italian reds', Decimal('10.00'), 10),
        ('Beverages', 'White Wine (Glass)', 'Crisp and refreshing', Decimal('9.00'), 20),
        ('Beverages', 'Craft Beer', 'Local artisan brews', Decimal('6.00'), 30),
        ('Beverages', 'Espresso', 'Strong and aromatic', Decimal('3.00'), 40),
    ]
    try:
        with get_conn() as conn:
            table_exists = conn.execute("SELECT to_regclass('public.menu_items') AS table_name").fetchone()['table_name'] is not None
            conn.execute('''
                CREATE TABLE IF NOT EXISTS menu_items (
                    id SERIAL PRIMARY KEY,
                    category VARCHAR(80) NOT NULL,
                    item_name VARCHAR(120) NOT NULL UNIQUE,
                    description TEXT NOT NULL,
                    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
                    image_url VARCHAR(500),
                    display_order INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            ''')
            image_source_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'assets', 'menu'))
            image_urls = {}
            for item_name, source_name in DEFAULT_MENU_IMAGES.items():
                source_path = os.path.join(image_source_dir, source_name)
                target_name = f'default-{source_name}'
                target_path = os.path.join(MENU_UPLOAD_DIR, target_name)
                if os.path.isfile(source_path) and not os.path.isfile(target_path):
                    shutil.copyfile(source_path, target_path)
                if os.path.isfile(target_path):
                    image_urls[item_name] = f'/api/menu-images/{target_name}'
            if not table_exists:
                for category, item_name, description, price, display_order in seed_items:
                    conn.execute('''
                        INSERT INTO menu_items (category, item_name, description, price, image_url, display_order)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    ''', (category, item_name, description, price, image_urls.get(item_name), display_order))
            else:
                for item_name, image_url in image_urls.items():
                    old_default_url = f"/api/menu-images/default-{os.path.splitext(DEFAULT_MENU_IMAGES[item_name])[0]}.png"
                    conn.execute('''
                        UPDATE menu_items
                        SET image_url = %s
                        WHERE item_name = %s AND (image_url IS NULL OR image_url = %s)
                    ''', (image_url, item_name, old_default_url))
            conn.commit()
    except Exception as e:
        app.logger.warning(f'Menu table setup skipped: {e}')


def ensure_visitor_table():
    """Create anonymous, persistent visit tracking for the admin dashboard."""
    try:
        with get_conn() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS visitor_events (
                    id SERIAL PRIMARY KEY,
                    visitor_id UUID NOT NULL,
                    path VARCHAR(200) NOT NULL,
                    visited_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            ''')
            conn.execute('CREATE INDEX IF NOT EXISTS visitor_events_visited_at_idx ON visitor_events (visited_at DESC)')
            conn.commit()
    except Exception as e:
        app.logger.warning(f'Visitor tracking setup skipped: {e}')


def ensure_customer_extensions():
    """Add newsletter delivery tracking to databases created before this field existed."""
    try:
        with get_conn() as conn:
            conn.execute('ALTER TABLE customers ADD COLUMN IF NOT EXISTS newsletter_confirmed_at TIMESTAMP')
            conn.commit()
    except Exception as e:
        app.logger.warning(f'Customer table setup skipped: {e}')


def serialize_menu_item(row):
    return {
        'id': row['id'],
        'category': row['category'],
        'name': row['item_name'],
        'description': row['description'],
        'price': float(row['price']),
        'image_url': row['image_url'],
        'display_order': row['display_order'],
    }


def validate_menu_form(data):
    category = (data.get('category') or '').strip()
    name = (data.get('name') or '').strip()
    description = (data.get('description') or '').strip()
    image_url = (data.get('image_url') or '').strip() or None
    try:
        price = Decimal(str(data.get('price'))).quantize(Decimal('0.01'))
        if price < 0:
            raise InvalidOperation
    except (InvalidOperation, TypeError, ValueError):
        return None, 'Price must be a non-negative amount.'
    try:
        display_order = int(data.get('display_order') or 0)
    except (TypeError, ValueError):
        return None, 'Display order must be a whole number.'
    if not category or len(category) > 80:
        return None, 'Category is required and must be 80 characters or fewer.'
    if not name or len(name) > 120:
        return None, 'Item name is required and must be 120 characters or fewer.'
    if not description:
        return None, 'Description is required.'
    if image_url and not (image_url.startswith('/') or image_url.startswith('https://')):
        return None, 'Image URL must start with / or https://.'
    return (category, name, description, price, image_url, display_order), None


def save_menu_image(file):
    if not file or not file.filename:
        return None, None
    if file.content_length and file.content_length > MAX_MENU_IMAGE_BYTES:
        return None, 'Image must be 5 MB or smaller.'
    safe_name = secure_filename(file.filename)
    extension = os.path.splitext(safe_name)[1].lower()
    if extension not in ALLOWED_MENU_IMAGE_EXTENSIONS:
        return None, 'Use a JPG, PNG, or WebP image.'
    filename = f'{uuid.uuid4().hex}{extension}'
    file.save(os.path.join(MENU_UPLOAD_DIR, filename))
    return f'/api/menu-images/{filename}', None


def delete_uploaded_menu_image(image_url):
    if not image_url or not image_url.startswith('/api/menu-images/'):
        return
    filename = os.path.basename(image_url)
    path = os.path.join(MENU_UPLOAD_DIR, filename)
    if os.path.isfile(path):
        os.remove(path)


def is_valid_time_slot(dt: datetime) -> bool:
    open_h, close_h = HOURS[dt.weekday()]
    return open_h <= dt.hour < close_h


def check_admin(req):
    auth = req.headers.get('X-Admin-Password', '')
    if auth != ADMIN_PASSWORD:
        return jsonify(error='Unauthorized'), 401
    return None


def fmt_dt(iso_str):
    """Format an ISO datetime string for display in emails."""
    dt = datetime.fromisoformat(iso_str) if isinstance(iso_str, str) else iso_str
    return dt.strftime('%A, %B %-d, %Y at %-I:%M %p')


def send_email(to_address, subject, html_body):
    """Send an HTML email. Logs full content regardless of whether SMTP is configured."""
    # Strip HTML tags for a readable plain-text log preview
    plain = re.sub(r'<[^>]+>', '', html_body)
    plain = re.sub(r'\n{3,}', '\n\n', plain).strip()

    app.logger.info(
        f'[EMAIL] To: {to_address} | Subject: {subject}\n'
        f'{"─" * 60}\n{plain}\n{"─" * 60}'
    )

    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        app.logger.warning('[EMAIL] Not sent — SMTP credentials not configured in .env')
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = EMAIL_FROM
        msg['To']      = to_address
        # Supply both formats. This makes the message readable in clients that
        # block HTML and gives mail filters a normal multipart alternative.
        msg['Date'] = formatdate(localtime=False)
        msg['Message-ID'] = make_msgid(domain=SMTP_USER.rsplit('@', 1)[-1])
        msg.attach(MIMEText(plain, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.sendmail(SMTP_USER, to_address, msg.as_string())
        app.logger.info(f'[EMAIL] Sent successfully to {to_address}')
        return True
    except Exception as e:
        app.logger.error(f'[EMAIL] Send failed: {e}')
        return False


def email_accepted(name, to, time_slot, table_number, guests):
    subject = 'Your Café Fausse Reservation is Confirmed'
    html = f'''
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <div style="background:#1a1a1a;padding:24px 32px">
        <h1 style="color:#b8972a;margin:0;font-size:1.4rem;letter-spacing:0.05em">CAFÉ FAUSSE</h1>
      </div>
      <div style="padding:32px">
        <h2 style="margin-top:0">Reservation Confirmed</h2>
        <p>Dear {name},</p>
        <p>We are delighted to confirm your reservation. We look forward to welcoming you.</p>
        <table style="border-collapse:collapse;width:100%;margin:24px 0;background:#f5f0e8;border-radius:6px">
          <tr><td style="padding:10px 16px;color:#666;width:40%">Date &amp; Time</td>
              <td style="padding:10px 16px;font-weight:bold">{fmt_dt(time_slot)}</td></tr>
          <tr><td style="padding:10px 16px;color:#666">Guests</td>
              <td style="padding:10px 16px;font-weight:bold">{guests}</td></tr>
          <tr><td style="padding:10px 16px;color:#666">Table</td>
              <td style="padding:10px 16px;font-weight:bold">{table_number}</td></tr>
        </table>
        <p>If you need to modify or cancel your reservation, please call us at <strong>(202) 555-4567</strong>
           at least 24 hours in advance.</p>
        <p style="color:#888;font-size:0.875rem">1234 Culinary Ave, Suite 100 · Washington, DC 20002<br>
           Mon–Sat 5–11 PM · Sun 5–9 PM</p>
        <p>Warm regards,<br><strong>The Café Fausse Team</strong></p>
      </div>
      <div style="background:#f0ebe0;padding:16px 32px;font-size:0.75rem;color:#888;text-align:center">
        © Café Fausse · 1234 Culinary Ave, Washington, DC
      </div>
    </div>
    '''
    return send_email(to, subject, html)


def email_denied(name, to, time_slot, guests):
    subject = 'Update on Your Café Fausse Reservation Request'
    html = f'''
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <div style="background:#1a1a1a;padding:24px 32px">
        <h1 style="color:#b8972a;margin:0;font-size:1.4rem;letter-spacing:0.05em">CAFÉ FAUSSE</h1>
      </div>
      <div style="padding:32px">
        <h2 style="margin-top:0">We're Sorry</h2>
        <p>Dear {name},</p>
        <p>Thank you for your interest in dining with us. Unfortunately, we are unable to accommodate
           your reservation request for <strong>{fmt_dt(time_slot)}</strong>
           ({guests} guest{'s' if guests != 1 else ''}) — no tables are available for that time.</p>
        <p>We would love to find a time that works for you. Please call us directly and our team
           will do their best to find you a suitable slot:</p>
        <p style="font-size:1.25rem;font-weight:bold;color:#b8972a">(202) 555-4567</p>
        <p style="color:#888;font-size:0.875rem">1234 Culinary Ave, Suite 100 · Washington, DC 20002<br>
           Mon–Sat 5–11 PM · Sun 5–9 PM</p>
        <p>We hope to welcome you soon.<br><strong>The Café Fausse Team</strong></p>
      </div>
      <div style="background:#f0ebe0;padding:16px 32px;font-size:0.75rem;color:#888;text-align:center">
        © Café Fausse · 1234 Culinary Ave, Washington, DC
      </div>
    </div>
    '''
    return send_email(to, subject, html)


def email_reservation_received(name, to, time_slot, guests):
    """Confirm that a reservation request was received and is awaiting review."""
    subject = 'We received your Cafe Fausse reservation request'
    html = f'''
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <div style="background:#1a1a1a;padding:24px 32px">
        <h1 style="color:#b8972a;margin:0;font-size:1.4rem;letter-spacing:0.05em">CAFE FAUSSE</h1>
      </div>
      <div style="padding:32px">
        <h2 style="margin-top:0">Reservation request received</h2>
        <p>Dear {name},</p>
        <p>Thank you for your reservation request. Our team will review it shortly and email you once it is confirmed.</p>
        <p><strong>Requested time:</strong> {fmt_dt(time_slot)}<br>
           <strong>Guests:</strong> {guests}</p>
        <p>Warm regards,<br><strong>The Cafe Fausse Team</strong></p>
      </div>
    </div>
    '''
    return send_email(to, subject, html)


def email_newsletter_welcome(to):
    subject = 'Thanks for subscribing to the Café Fausse newsletter'
    html = '''
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <div style="background:#1a1a1a;padding:24px 32px">
        <h1 style="color:#b8972a;margin:0;font-size:1.4rem;letter-spacing:0.05em">CAFÉ FAUSSE</h1>
      </div>
      <div style="padding:32px">
        <h2 style="margin-top:0">Thanks for subscribing</h2>
        <p>We are delighted to have you at our table.</p>
        <p>We will send you updates including amazing new chef specials and seasonal fare.</p>
        <p>Until then, we look forward to welcoming you to Café Fausse.</p>
        <p style="color:#888;font-size:0.875rem">1234 Culinary Ave, Suite 100 · Washington, DC 20002<br>
           Mon–Sat 5–11 PM · Sun 5–9 PM</p>
        <p>Warm regards,<br><strong>The Café Fausse Team</strong></p>
      </div>
      <div style="background:#f0ebe0;padding:16px 32px;font-size:0.75rem;color:#888;text-align:center">
        © Café Fausse · 1234 Culinary Ave, Washington, DC
      </div>
    </div>
    '''
    return send_email(to, subject, html)


ensure_menu_table()
ensure_visitor_table()
ensure_customer_extensions()


@app.post('/api/visits')
def record_visit():
    data = request.get_json(silent=True) or {}
    visitor_id = (data.get('visitor_id') or '').strip()
    path = (data.get('path') or '/').strip()
    try:
        visitor_id = str(uuid.UUID(visitor_id))
    except (ValueError, AttributeError):
        return jsonify(error='Invalid visitor ID.'), 400
    if not path.startswith('/') or len(path) > 200:
        return jsonify(error='Invalid path.'), 400

    try:
        with get_conn() as conn:
            conn.execute(
                'INSERT INTO visitor_events (visitor_id, path) VALUES (%s, %s)',
                (visitor_id, path)
            )
            conn.commit()
        return '', 204
    except Exception as e:
        app.logger.error(f'Visit tracking error: {e}')
        return jsonify(error='Unable to record visit.'), 500


@app.post('/api/reservations')
def create_reservation():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    phone = (data.get('phone') or '').strip()
    phone_digits = re.sub(r'\D', '', phone)
    guests = data.get('guests')
    time_slot_str = data.get('time_slot') or ''

    if not name:
        return jsonify(error='Name is required.'), 400
    if HTML_TAG_RE.search(name):
        return jsonify(error='Names cannot contain HTML markup.'), 400
    if not email or not EMAIL_RE.match(email):
        return jsonify(error='A valid email address is required.'), 400
    try:
        guests = int(guests)
        assert 1 <= guests <= 30
    except (TypeError, ValueError, AssertionError):
        return jsonify(error='Guests must be between 1 and 30.'), 400
    try:
        dt = datetime.fromisoformat(time_slot_str)
    except (ValueError, TypeError):
        return jsonify(error='Invalid date/time format.'), 400

    if dt <= datetime.now():
        return jsonify(error='Reservations must be made for a future date and time.'), 400

    if not is_valid_time_slot(dt):
        return jsonify(error='The selected time is outside our operating hours. Mon–Sat 5–11 PM, Sun 5–9 PM.'), 400

    try:
        with get_conn() as conn:
            booked = {row['table_number'] for row in conn.execute(
                "SELECT table_number FROM reservations WHERE time_slot = %s AND status != 'denied'",
                (dt,)
            ).fetchall()}

            available = [t for t in range(1, 31) if t not in booked]
            if not available:
                return jsonify(error='Sorry, no tables are available for that time slot.'), 409

            table = random.choice(available)

            # An email can already belong to a newsletter subscriber or an
            # earlier guest. Reuse that customer rather than failing on the
            # unique email constraint when they make another reservation.
            row = conn.execute(
                'SELECT id FROM customers WHERE LOWER(email_address) = %s',
                (email,)
            ).fetchone()
            if row:
                customer_id = row['id']
                conn.execute(
                    '''UPDATE customers
                       SET customer_name = %s,
                           phone_number = COALESCE(%s, phone_number)
                       WHERE id = %s''',
                    (name, phone, customer_id)
                )
            else:
                row = conn.execute(
                    'INSERT INTO customers (customer_name, email_address, phone_number, newsletter_signup) VALUES (%s, %s, %s, %s) RETURNING id',
                    (name, email, phone, False)
                ).fetchone()
                customer_id = row['id']

            res_row = conn.execute(
                'INSERT INTO reservations (customer_id, time_slot, table_number, guest_count, status) VALUES (%s, %s, %s, %s, %s) RETURNING id',
                (customer_id, dt, table, guests, 'pending')
            ).fetchone()
            conn.commit()

        # A mail problem must not undo a successfully saved reservation.
        email_reservation_received(name, email, dt, guests)

        return jsonify(
            message='Your reservation request has been received. The restaurant will confirm shortly.',
            reservation_id=res_row['id'],
            table_number=table,
            guests=guests,
            email=email,
            time_slot=dt.isoformat(),
            status='pending',
        ), 201

    except Exception as e:
        app.logger.error(f'Reservation error: {e}')
        return jsonify(error='An unexpected error occurred. Please try again.'), 500


@app.post('/api/reservations/lookup')
def lookup_reservations():
    """Return reservation status only when both guest identifiers match."""
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    phone_digits = re.sub(r'\D', '', (data.get('phone') or ''))

    if not email or not EMAIL_RE.match(email):
        return jsonify(error='Please provide a valid email address.'), 400
    if not 7 <= len(phone_digits) <= 15:
        return jsonify(error='Please provide a valid phone number.'), 400

    try:
        with get_conn() as conn:
            rows = conn.execute(
                '''SELECT r.id, r.time_slot, r.guest_count, r.status
                   FROM reservations r
                   JOIN customers c ON c.id = r.customer_id
                   WHERE LOWER(c.email_address) = %s
                     AND regexp_replace(COALESCE(c.phone_number, ''), '[^0-9]', '', 'g') = %s
                   ORDER BY r.time_slot DESC
                   LIMIT 10''',
                (email, phone_digits)
            ).fetchall()
        return jsonify([
            {
                'id': row['id'],
                'time_slot': row['time_slot'].isoformat(),
                'guests': row['guest_count'],
                'status': row['status'],
            }
            for row in rows
        ]), 200
    except Exception as e:
        app.logger.error(f'Reservation lookup error: {e}')
        return jsonify(error='Unable to look up reservation requests.'), 500


@app.post('/api/newsletter')
def newsletter_signup():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()

    if not email or not EMAIL_RE.match(email):
        return jsonify(error='Please provide a valid email address.'), 400

    try:
        with get_conn() as conn:
            existing = conn.execute(
                'SELECT id, newsletter_signup FROM customers WHERE LOWER(email_address) = %s',
                (email,)
            ).fetchone()
            already_subscribed = bool(existing and existing['newsletter_signup'])
            if already_subscribed:
                return jsonify(message='This email is already subscribed to the newsletter.', already_subscribed=True), 200
            if existing:
                conn.execute('UPDATE customers SET newsletter_signup = TRUE WHERE id = %s', (existing['id'],))
            else:
                conn.execute(
                    'INSERT INTO customers (customer_name, email_address, newsletter_signup) VALUES (%s, %s, %s)',
                    ('Newsletter Subscriber', email, True)
                )
            conn.commit()
        email_newsletter_welcome(email)
        return jsonify(message='Successfully subscribed!'), 201
    except Exception as e:
        app.logger.error(f'Newsletter error: {e}')
        return jsonify(error='An unexpected error occurred.'), 500


@app.get('/api/menu')
def list_menu_items():
    try:
        with get_conn() as conn:
            rows = conn.execute('''
                SELECT id, category, item_name, description, price, image_url, display_order
                FROM menu_items
                ORDER BY CASE category
                    WHEN 'Starters' THEN 1
                    WHEN 'Main Courses' THEN 2
                    WHEN 'Desserts' THEN 3
                    WHEN 'Beverages' THEN 4
                    ELSE 99
                END, category, display_order, item_name
            ''').fetchall()
        return jsonify([serialize_menu_item(row) for row in rows]), 200
    except Exception as e:
        app.logger.error(f'Menu list error: {e}')
        return jsonify(error='Failed to load menu.'), 500


@app.get('/api/menu-images/<path:filename>')
def menu_image(filename):
    width = request.args.get('width', type=int)
    if width is None:
        return send_from_directory(MENU_UPLOAD_DIR, filename)
    if width not in MENU_IMAGE_VARIANT_WIDTHS:
        return jsonify(error='Unsupported image width.'), 400

    path = safe_join(MENU_UPLOAD_DIR, filename)
    if not path or not os.path.isfile(path):
        return jsonify(error='Image not found.'), 404

    try:
        with Image.open(path) as source:
            source.load()
            if source.width <= width:
                return send_from_directory(MENU_UPLOAD_DIR, filename, max_age=3600)

            image_format = source.format or 'JPEG'
            source.thumbnail((width, width), Image.Resampling.LANCZOS)
            image = source
            if image_format == 'JPEG' and source.mode not in ('RGB', 'L'):
                image = source.convert('RGB')

            image_data = BytesIO()
            save_options = {'format': image_format}
            if image_format in ('JPEG', 'WEBP'):
                save_options.update(quality=82, optimize=True)
            image.save(image_data, **save_options)
            image_data.seek(0)
            return send_file(
                image_data,
                mimetype=Image.MIME.get(image_format, 'application/octet-stream'),
                max_age=3600,
            )
    except (OSError, ValueError):
        return jsonify(error='Unable to process image.'), 400


@app.get('/api/admin/menu-items')
def admin_list_menu_items():
    denied = check_admin(request)
    if denied:
        return denied
    return list_menu_items()


@app.post('/api/admin/menu-items')
def admin_create_menu_item():
    denied = check_admin(request)
    if denied:
        return denied

    values, error = validate_menu_form(request.form)
    if error:
        return jsonify(error=error), 400
    category, name, description, price, image_url, display_order = values
    uploaded_url, error = save_menu_image(request.files.get('image'))
    if error:
        return jsonify(error=error), 400
    image_url = uploaded_url or image_url

    try:
        with get_conn() as conn:
            row = conn.execute('''
                INSERT INTO menu_items (category, item_name, description, price, image_url, display_order)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, category, item_name, description, price, image_url, display_order
            ''', (category, name, description, price, image_url, display_order)).fetchone()
            conn.commit()
        return jsonify(serialize_menu_item(row)), 201
    except Exception as e:
        delete_uploaded_menu_image(uploaded_url)
        app.logger.error(f'Menu create error: {e}')
        return jsonify(error='Unable to create menu item. The item name may already exist.'), 400


@app.patch('/api/admin/menu-items/<int:item_id>')
def admin_update_menu_item(item_id):
    denied = check_admin(request)
    if denied:
        return denied

    values, error = validate_menu_form(request.form)
    if error:
        return jsonify(error=error), 400
    category, name, description, price, image_url, display_order = values
    uploaded_url, error = save_menu_image(request.files.get('image'))
    if error:
        return jsonify(error=error), 400

    try:
        with get_conn() as conn:
            existing = conn.execute('SELECT image_url FROM menu_items WHERE id = %s', (item_id,)).fetchone()
            if not existing:
                return jsonify(error='Menu item not found.'), 404
            if uploaded_url:
                final_image_url = uploaded_url
            elif request.form.get('remove_image') == 'true':
                final_image_url = None
            else:
                final_image_url = image_url or existing['image_url']
            row = conn.execute('''
                UPDATE menu_items
                SET category = %s, item_name = %s, description = %s, price = %s,
                    image_url = %s, display_order = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING id, category, item_name, description, price, image_url, display_order
            ''', (category, name, description, price, final_image_url, display_order, item_id)).fetchone()
            conn.commit()
        if existing['image_url'] != final_image_url:
            delete_uploaded_menu_image(existing['image_url'])
        return jsonify(serialize_menu_item(row)), 200
    except Exception as e:
        delete_uploaded_menu_image(uploaded_url)
        app.logger.error(f'Menu update error: {e}')
        return jsonify(error='Unable to update menu item. The item name may already exist.'), 400


@app.delete('/api/admin/menu-items/<int:item_id>')
def admin_delete_menu_item(item_id):
    denied = check_admin(request)
    if denied:
        return denied
    try:
        with get_conn() as conn:
            row = conn.execute('DELETE FROM menu_items WHERE id = %s RETURNING image_url', (item_id,)).fetchone()
            conn.commit()
        if not row:
            return jsonify(error='Menu item not found.'), 404
        delete_uploaded_menu_image(row['image_url'])
        return jsonify(message='Menu item deleted.', id=item_id), 200
    except Exception as e:
        app.logger.error(f'Menu delete error: {e}')
        return jsonify(error='Unable to delete menu item.'), 500


# ── Admin endpoints ───────────────────────────────────────────────────────────

@app.get('/api/admin/newsletter-subscribers')
def admin_list_newsletter_subscribers():
    denied = check_admin(request)
    if denied:
        return denied

    try:
        with get_conn() as conn:
            rows = conn.execute('''
                SELECT email_address, created_at
                FROM customers
                WHERE newsletter_signup = TRUE
                ORDER BY created_at DESC, email_address ASC
            ''').fetchall()
        return jsonify([
            {'email': row['email_address'], 'created_at': row['created_at'].isoformat()}
            for row in rows
        ]), 200
    except Exception as e:
        app.logger.error(f'Newsletter subscriber list error: {e}')
        return jsonify(error='Failed to fetch newsletter subscribers.'), 500


@app.delete('/api/admin/newsletter-subscribers')
def admin_remove_newsletter_subscriber():
    denied = check_admin(request)
    if denied:
        return denied

    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    if not email or not EMAIL_RE.match(email):
        return jsonify(error='A valid email address is required.'), 400

    try:
        with get_conn() as conn:
            row = conn.execute('''
                UPDATE customers
                SET newsletter_signup = FALSE
                WHERE LOWER(email_address) = %s AND newsletter_signup = TRUE
                RETURNING email_address
            ''', (email,)).fetchone()
            conn.commit()
        if not row:
            return jsonify(error='Newsletter subscriber not found.'), 404
        return jsonify(message='Subscriber removed from the newsletter.', email=row['email_address']), 200
    except Exception as e:
        app.logger.error(f'Newsletter subscriber removal error: {e}')
        return jsonify(error='Failed to remove newsletter subscriber.'), 500


@app.get('/api/admin/reservations')
def admin_list_reservations():
    denied = check_admin(request)
    if denied:
        return denied

    status_filter = request.args.get('status')

    try:
        with get_conn() as conn:
            if status_filter:
                rows = conn.execute(
                    '''SELECT r.id, r.time_slot, r.table_number, r.guest_count, r.status, r.created_at,
                              c.customer_name, c.email_address, c.phone_number
                       FROM reservations r
                       JOIN customers c ON c.id = r.customer_id
                       WHERE r.status = %s
                       ORDER BY r.time_slot ASC''',
                    (status_filter,)
                ).fetchall()
            else:
                rows = conn.execute(
                    '''SELECT r.id, r.time_slot, r.table_number, r.guest_count, r.status, r.created_at,
                              c.customer_name, c.email_address, c.phone_number
                       FROM reservations r
                       JOIN customers c ON c.id = r.customer_id
                       ORDER BY r.time_slot ASC'''
                ).fetchall()

        def serialize(row):
            return {
                'id': row['id'],
                'name': row['customer_name'],
                'email': row['email_address'],
                'phone': row['phone_number'],
                'time_slot': row['time_slot'].isoformat(),
                'table_number': row['table_number'],
                'guests': row['guest_count'],
                'status': row['status'],
                'created_at': row['created_at'].isoformat(),
            }

        return jsonify([serialize(r) for r in rows]), 200

    except Exception as e:
        app.logger.error(f'Admin list error: {e}')
        return jsonify(error='Failed to fetch reservations.'), 500


@app.patch('/api/admin/reservations/<int:res_id>')
def admin_update_reservation(res_id):
    denied = check_admin(request)
    if denied:
        return denied

    data = request.get_json(silent=True) or {}
    new_status = data.get('status')

    if new_status not in ('accepted', 'denied', 'pending'):
        return jsonify(error="status must be 'accepted', 'denied', or 'pending'."), 400

    try:
        with get_conn() as conn:
            row = conn.execute(
                '''UPDATE reservations SET status = %s WHERE id = %s
                   RETURNING id, time_slot, table_number, guest_count, customer_id''',
                (new_status, res_id)
            ).fetchone()

            if not row:
                conn.commit()
                return jsonify(error='Reservation not found.'), 404

            customer = conn.execute(
                'SELECT customer_name, email_address FROM customers WHERE id = %s',
                (row['customer_id'],)
            ).fetchone()
            conn.commit()

        # Send notification emails only for accept/deny, not when reverting to pending
        if customer and new_status != 'pending':
            if new_status == 'accepted':
                email_accepted(
                    name=customer['customer_name'],
                    to=customer['email_address'],
                    time_slot=row['time_slot'],
                    table_number=row['table_number'],
                    guests=row['guest_count'],
                )
            else:
                email_denied(
                    name=customer['customer_name'],
                    to=customer['email_address'],
                    time_slot=row['time_slot'],
                    guests=row['guest_count'],
                )

        return jsonify(message=f'Reservation {new_status}.', id=res_id, status=new_status), 200

    except Exception as e:
        app.logger.error(f'Admin update error: {e}')
        return jsonify(error='Failed to update reservation.'), 500


@app.delete('/api/admin/reservations/<int:res_id>')
def admin_delete_reservation(res_id):
    denied = check_admin(request)
    if denied:
        return denied

    try:
        with get_conn() as conn:
            row = conn.execute(
                'DELETE FROM reservations WHERE id = %s RETURNING id', (res_id,)
            ).fetchone()
            conn.commit()

        if not row:
            return jsonify(error='Reservation not found.'), 404
        return jsonify(message='Reservation deleted.', id=res_id), 200

    except Exception as e:
        app.logger.error(f'Admin delete error: {e}')
        return jsonify(error='Failed to delete reservation.'), 500


@app.post('/api/admin/reservations/bulk')
def admin_bulk_reservations():
    denied = check_admin(request)
    if denied:
        return denied

    data = request.get_json(silent=True) or {}
    action = data.get('action')
    ids = data.get('ids')

    if not isinstance(ids, list) or not ids:
        return jsonify(error='ids must be a non-empty list.'), 400
    if action not in ('accepted', 'denied', 'pending', 'delete'):
        return jsonify(error="action must be 'accepted', 'denied', 'pending', or 'delete'."), 400

    # Ensure all ids are integers
    try:
        ids = [int(i) for i in ids]
    except (TypeError, ValueError):
        return jsonify(error='All ids must be integers.'), 400

    try:
        with get_conn() as conn:
            if action == 'delete':
                rows = conn.execute(
                    'DELETE FROM reservations WHERE id = ANY(%s) RETURNING id',
                    (ids,)
                ).fetchall()
            else:
                rows = conn.execute(
                    '''UPDATE reservations SET status = %s WHERE id = ANY(%s)
                       RETURNING id, time_slot, table_number, guest_count, customer_id''',
                    (action, ids)
                ).fetchall()

                # Send notification emails only for accept/deny
                for row in rows:
                    if action == 'pending':
                        continue
                    customer = conn.execute(
                        'SELECT customer_name, email_address FROM customers WHERE id = %s',
                        (row['customer_id'],)
                    ).fetchone()
                    if customer:
                        if action == 'accepted':
                            email_accepted(
                                name=customer['customer_name'],
                                to=customer['email_address'],
                                time_slot=row['time_slot'],
                                table_number=row['table_number'],
                                guests=row['guest_count'],
                            )
                        else:
                            email_denied(
                                name=customer['customer_name'],
                                to=customer['email_address'],
                                time_slot=row['time_slot'],
                                guests=row['guest_count'],
                            )

            conn.commit()

        affected = [r['id'] for r in rows]
        return jsonify(message=f'{len(affected)} reservation(s) {action}.', ids=affected), 200

    except Exception as e:
        app.logger.error(f'Bulk action error: {e}')
        return jsonify(error='Bulk action failed.'), 500


@app.get('/api/admin/insights')
def admin_insights():
    denied = check_admin(request)
    if denied:
        return denied

    try:
        with get_conn() as conn:
            totals = conn.execute('''
                SELECT
                    COUNT(DISTINCT visitor_id) AS unique_visitors,
                    COUNT(*) AS visit_events,
                    COUNT(DISTINCT visitor_id) FILTER (WHERE visited_at::date = CURRENT_DATE) AS visitors_today
                FROM visitor_events
            ''').fetchone()
        return jsonify(dict(totals)), 200
    except Exception as e:
        app.logger.error(f'Admin insights error: {e}')
        return jsonify(error='Failed to fetch visitor insights.'), 500


@app.get('/api/admin/db-counts')
def admin_db_counts():
    denied = check_admin(request)
    if denied:
        return denied

    try:
        with get_conn() as conn:
            counts = {
                'customers': conn.execute('SELECT COUNT(*) AS count FROM customers').fetchone()['count'],
                'reservations': conn.execute('SELECT COUNT(*) AS count FROM reservations').fetchone()['count'],
                'menu_items': conn.execute('SELECT COUNT(*) AS count FROM menu_items').fetchone()['count'],
            }
        return jsonify(counts), 200
    except Exception as e:
        app.logger.error(f'DB count error: {e}')
        return jsonify(error='Failed to fetch table counts.'), 500


@app.get('/api/admin/db/<table_name>')
def admin_db_table(table_name):
    denied = check_admin(request)
    if denied:
        return denied

    ALLOWED = {'customers', 'reservations', 'menu_items'}
    if table_name not in ALLOWED:
        return jsonify(error=f"Unknown table '{table_name}'."), 404

    try:
        with get_conn() as conn:
            rows = conn.execute(f'SELECT * FROM {table_name} ORDER BY id DESC').fetchall()
        return jsonify([dict(r) for r in rows]), 200
    except Exception as e:
        app.logger.error(f'DB view error ({table_name}): {e}')
        return jsonify(error='Failed to fetch table data.'), 500


@app.get('/api/admin/logs')
def admin_logs():
    denied = check_admin(request)
    if denied:
        return denied
    since = request.args.get('since')  # ISO timestamp — return only entries after this
    entries = list(_log_buffer)
    if since:
        entries = [e for e in entries if e['ts'] > since]
    return jsonify(entries), 200


if __name__ == '__main__':
    app.run(debug=True, port=5001)
