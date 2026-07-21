import { useState } from 'react'
import './Footer.css'

export default function Footer() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)

  async function handleSignup(e) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus(data.already_subscribed ? 'already-subscribed' : 'success')
        setEmail('')
      } else {
        setStatus(data.error || 'error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <footer className="footer">
      <div className="footer-inner container">
        <div className="footer-col">
          <h3>Café Fausse</h3>
          <p>1234 Culinary Ave, Suite 100<br />Washington, DC 20002</p>
          <p>(202) 555-4567</p>
        </div>
        <div className="footer-col">
          <h4>Hours</h4>
          <p>Monday – Saturday: 5:00 PM – 11:00 PM</p>
          <p>Sunday: 5:00 PM – 9:00 PM</p>
        </div>
        <div className="footer-col">
          <h4>Newsletter</h4>
          <p>Stay updated with our latest events and menus.</p>
          <form onSubmit={handleSignup} className="newsletter-form">
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? '...' : 'Subscribe'}
            </button>
          </form>
          {status === 'success' && <p className="form-success">Thanks for subscribing!</p>}
          {status === 'already-subscribed' && <p className="form-success">This email is already subscribed to the newsletter.</p>}
          {status === 'error' && <p className="form-error">Something went wrong. Please try again.</p>}
          {status && status !== 'success' && status !== 'error' && status !== 'loading' && (
            <p className="form-error">{status}</p>
          )}
        </div>
      </div>
      <p className="footer-copy">&copy; {new Date().getFullYear()} Café Fausse. All rights reserved.</p>
    </footer>
  )
}
