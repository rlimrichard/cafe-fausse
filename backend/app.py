import os
import random
import re
import smtplib
import logging
from collections import deque
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

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


def get_conn():
    return psycopg.connect(DB_URL, row_factory=dict_row)


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
        msg.attach(MIMEText(html_body, 'html'))
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
    send_email(to, subject, html)


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
    send_email(to, subject, html)


@app.post('/api/reservations')
def create_reservation():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()
    phone = (data.get('phone') or '').strip() or None
    guests = data.get('guests')
    time_slot_str = data.get('time_slot') or ''

    if not name:
        return jsonify(error='Name is required.'), 400
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


@app.post('/api/newsletter')
def newsletter_signup():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip()

    if not email or not EMAIL_RE.match(email):
        return jsonify(error='Please provide a valid email address.'), 400

    try:
        with get_conn() as conn:
            conn.execute(
                '''INSERT INTO customers (customer_name, email_address, newsletter_signup) VALUES (%s, %s, %s)
                   ON CONFLICT (email_address) DO UPDATE SET newsletter_signup = TRUE''',
                ('Newsletter Subscriber', email, True)
            )
            conn.commit()
        return jsonify(message='Successfully subscribed!'), 201
    except Exception as e:
        app.logger.error(f'Newsletter error: {e}')
        return jsonify(error='An unexpected error occurred.'), 500


# ── Admin endpoints ───────────────────────────────────────────────────────────

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


@app.get('/api/admin/db/<table_name>')
def admin_db_table(table_name):
    denied = check_admin(request)
    if denied:
        return denied

    ALLOWED = {'customers', 'reservations'}
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
