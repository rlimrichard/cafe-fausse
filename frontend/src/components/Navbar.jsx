import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [adminActive, setAdminActive] = useState(() => Boolean(sessionStorage.getItem('cafe-fausse-admin-password')))

  useEffect(() => {
    const updateAdminState = () => setAdminActive(Boolean(sessionStorage.getItem('cafe-fausse-admin-password')))
    window.addEventListener('admin-session-change', updateAdminState)
    return () => window.removeEventListener('admin-session-change', updateAdminState)
  }, [])

  return (
    <header className="navbar">
      <div className="navbar-inner container">
        <NavLink to="/" className="navbar-brand">Café Fausse</NavLink>
        <button
          className={`navbar-toggle ${open ? 'active' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle navigation"
        >
          <span /><span /><span />
        </button>
        <nav className={`navbar-links ${open ? 'open' : ''}`}>
          {[['/', 'Home'], ['/menu', 'Menu'], ['/reservations', 'Reservations'], ['/about', 'About Us'], ['/gallery', 'Gallery']].map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
              {label}
            </NavLink>
          ))}
          {adminActive && (
            <NavLink to="/admin" className="admin-navigation-link" onClick={() => setOpen(false)}>
              Admin
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  )
}
