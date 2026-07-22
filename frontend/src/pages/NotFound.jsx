import { Link } from 'react-router-dom'
import './NotFound.css'

export default function NotFound() {
  return (
    <section className="not-found section" aria-labelledby="not-found-title">
      <div className="container not-found__content">
        <p className="section-subtitle">404</p>
        <h1 id="not-found-title" className="section-title">Page Not Found</h1>
        <div className="divider" />
        <p>The page you requested doesn&apos;t exist or may have moved.</p>
        <Link className="btn btn-primary" to="/">Return Home</Link>
      </div>
    </section>
  )
}
