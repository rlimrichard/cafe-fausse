import { useState } from 'react'
import './Reservations.css'

const HOURS = {
  0: { open: 17, close: 21 },  // Sunday
  1: { open: 17, close: 23 },  // Monday
  2: { open: 17, close: 23 },
  3: { open: 17, close: 23 },
  4: { open: 17, close: 23 },
  5: { open: 17, close: 23 },
  6: { open: 17, close: 23 },  // Saturday
}

function buildTimeOptions() {
  const slots = []
  for (let h = 17; h < 23; h++) {
    slots.push(`${h}:00`, `${h}:30`)
  }
  return slots
}

const TIME_OPTIONS = buildTimeOptions()

const INITIAL = { date: '', time: '', guests: 2, name: '', email: '', phone: '' }

export default function Reservations() {
  const [form, setForm] = useState(INITIAL)
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)
  const [errors, setErrors] = useState({})

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function validate() {
    const errs = {}
    if (!form.date) errs.date = 'Please select a date.'
    if (!form.time) errs.time = 'Please select a time.'
    if (form.date && form.time) {
      const dt = new Date(`${form.date}T${form.time}:00`)
      if (dt <= new Date()) {
        errs.time = 'Please select a future date and time.'
      } else {
        const day = dt.getDay()
        const hour = dt.getHours()
        const minutes = dt.getMinutes()
        const { open, close } = HOURS[day]
        if (hour < open || hour >= close || (hour === close - 1 && minutes > 0 && close === 23)) {
          errs.time = `Sorry, we are not open at that time. Hours: Mon–Sat 5–11 PM, Sun 5–9 PM.`
        }
      }
    }
    if (!form.name.trim()) errs.name = 'Name is required.'
    if (!form.email.trim()) errs.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Please enter a valid email.'
    if (!form.guests || form.guests < 1 || form.guests > 30) errs.guests = 'Guests must be between 1 and 30.'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStatus('loading')
    setResult(null)

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          guests: Number(form.guests),
          time_slot: `${form.date}T${form.time}:00`,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setResult(data)
        setForm(INITIAL)
      } else {
        setStatus('error')
        setResult({ error: data.error || 'Booking failed. Please try again.' })
      }
    } catch {
      setStatus('error')
      setResult({ error: 'Network error. Please try again.' })
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="reservations-page section">
      <div className="container">
        <p className="section-subtitle">Reserve</p>
        <h1 className="section-title">Book a Table</h1>
        <div className="divider" />

        <div className="reservations-layout">
          <form className="reservation-form" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="date">Date</label>
                <input id="date" type="date" min={today} value={form.date} onChange={set('date')} />
                {errors.date && <span className="field-error">{errors.date}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="time">Time</label>
                <select id="time" value={form.time} onChange={set('time')}>
                  <option value="">Select a time</option>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                </select>
                {errors.time && <span className="field-error">{errors.time}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="guests">Number of Guests</label>
              <input id="guests" type="number" min="1" max="30" value={form.guests} onChange={set('guests')} />
              {errors.guests && <span className="field-error">{errors.guests}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input id="name" type="text" placeholder="Jane Smith" value={form.name} onChange={set('name')} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input id="email" type="email" placeholder="jane@example.com" value={form.email} onChange={set('email')} />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number <span className="optional">(optional)</span></label>
              <input id="phone" type="tel" placeholder="(202) 555-0000" value={form.phone} onChange={set('phone')} />
            </div>

            <p className="reservation-expectations">
              You&apos;ll receive an email receipt right away. Reservations are confirmed after our team reviews the request; for changes or cancellations, please call at least 24 hours in advance.
            </p>
            <button type="submit" className="btn btn-primary submit-btn" disabled={status === 'loading'}>
              {status === 'loading' ? 'Sending request...' : 'Place Reservation Request'}
            </button>

            {status === 'success' && result && (
              <div className="booking-success">
                <h3>Request Received!</h3>
                <p>Your request for {result.guests} guest{result.guests !== 1 ? 's' : ''} on {formatSlot(result.time_slot)} is pending confirmation.</p>
                <p>We will reach out to <strong>{result.email}</strong> once the restaurant confirms your table.</p>
              </div>
            )}
            {status === 'error' && result && (
              <div className="booking-error">
                <p>{result.error}</p>
              </div>
            )}
          </form>

          <aside className="reservations-info">
            <h3>Hours</h3>
            <dl>
              <dt>Monday – Saturday</dt><dd>5:00 PM – 11:00 PM</dd>
              <dt>Sunday</dt><dd>5:00 PM – 9:00 PM</dd>
            </dl>
            <h3>Contact</h3>
            <p><a href="tel:+12025554567">(202) 555-4567</a></p>
            <p><a href="https://www.google.com/maps/search/?api=1&query=1234+Culinary+Ave%2C+Washington%2C+DC+20002" target="_blank" rel="noreferrer">1234 Culinary Ave, Suite 100<br />Washington, DC 20002</a></p>
            <a className="directions-link" href="https://www.google.com/maps/dir/?api=1&destination=1234+Culinary+Ave%2C+Washington%2C+DC+20002" target="_blank" rel="noreferrer">Get directions ↗</a>
            <iframe
              className="reservation-map"
              title="Map to Cafe Fausse"
              src="https://www.google.com/maps?q=1234+Culinary+Ave%2C+Washington%2C+DC+20002&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

function formatSlot(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}
