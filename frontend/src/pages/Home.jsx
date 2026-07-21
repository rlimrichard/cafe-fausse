import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-overlay">
          <h1>Trattoria Bellavista</h1>
          <p>Traditional Italian flavors meet modern culinary innovation</p>
          <div className="hero-actions">
            <Link to="/reservations" className="btn btn-primary">Reserve a Table</Link>
            <Link to="/menu" className="btn btn-outline">View Menu</Link>
          </div>
        </div>
      </section>

      <section className="section welcome">
        <div className="container">
          <p className="section-subtitle">Welcome</p>
          <h2 className="section-title">An Unforgettable Dining Experience</h2>
          <div className="divider" />
          <p className="welcome-text">
            Founded in 2010 by Chef Antonio Rossi and restaurateur Maria Lopez, Trattoria Bellavista has become
            Washington DC's premier destination for refined Italian dining. Every dish is crafted from
            locally sourced ingredients, delivering quality and creativity on every plate.
          </p>
          <Link to="/about" className="btn btn-outline" style={{ marginTop: '2rem' }}>Our Story</Link>
        </div>
      </section>

      <section className="section info-strip">
        <div className="container info-grid">
          <div className="info-card">
            <h3>Location</h3>
            <p>1234 Culinary Ave, Suite 100</p>
            <p>Washington, DC 20002</p>
          </div>
          <div className="info-card">
            <h3>Hours</h3>
            <p>Monday – Saturday</p>
            <p>5:00 PM – 11:00 PM</p>
            <p style={{ marginTop: '0.5rem' }}>Sunday</p>
            <p>5:00 PM – 9:00 PM</p>
          </div>
          <div className="info-card">
            <h3>Reservations</h3>
            <p>(202) 555-4567</p>
            <Link to="/reservations" className="btn btn-primary" style={{ marginTop: '1rem' }}>Book Online</Link>
          </div>
        </div>
      </section>

      <section className="section awards-preview">
        <div className="container">
          <p className="section-subtitle">Recognition</p>
          <h2 className="section-title">Award-Winning Excellence</h2>
          <div className="divider" />
          <div className="awards-grid">
            <div className="award-item">
              <span className="award-year">2022</span>
              <h4>Culinary Excellence Award</h4>
            </div>
            <div className="award-item">
              <span className="award-year">2023</span>
              <h4>Restaurant of the Year</h4>
            </div>
            <div className="award-item">
              <span className="award-year">2023</span>
              <h4>Best Fine Dining Experience</h4>
              <p>Foodie Magazine</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
