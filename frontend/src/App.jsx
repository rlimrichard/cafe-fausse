import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Menu from './pages/Menu'
import Reservations from './pages/Reservations'
import AboutUs from './pages/AboutUs'
import Gallery from './pages/Gallery'
import Admin from './pages/Admin'

export default function App() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/admin') return
    const storageKey = 'trattoria-bellavista-visitor-id'
    let visitorId = localStorage.getItem(storageKey)
    if (!visitorId) {
      visitorId = crypto.randomUUID()
      localStorage.setItem(storageKey, visitorId)
    }
    fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor_id: visitorId, path: location.pathname }),
    }).catch(() => {})
  }, [location.pathname])

  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
