import os
import random
import re
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

DB_URL = os.environ.get('DATABASE_URL', 'postgresql://localhost/cafe_fausse')

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

    if not is_valid_time_slot(dt):
        return jsonify(error='The selected time is outside our operating hours. Mon–Sat 5–11 PM, Sun 5–9 PM.'), 400

    try:
        with get_conn() as conn:
            booked = {row['table_number'] for row in conn.execute(
                'SELECT table_number FROM reservations WHERE time_slot = %s', (dt,)
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

            conn.execute(
                'INSERT INTO reservations (customer_id, time_slot, table_number) VALUES (%s, %s, %s)',
                (customer_id, dt, table)
            )
            conn.commit()

        return jsonify(
            message='Reservation confirmed.',
            table_number=table,
            guests=guests,
            email=email,
            time_slot=dt.isoformat(),
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


if __name__ == '__main__':
    app.run(debug=True)
