import { useState } from 'react'
import './Gallery.css'
import cafeInteriorImage from '../../../MSEE_Web_Application_and_Interface_Design_Cafe_Fausse_Images/gallery-cafe-interior.webp'
import ribeyeSteakImage from '../../../MSEE_Web_Application_and_Interface_Design_Cafe_Fausse_Images/gallery-ribeye-steak.webp'
import specialEventImage from '../../../MSEE_Web_Application_and_Interface_Design_Cafe_Fausse_Images/gallery-special-event.webp'
import diningRoomImage from '../../../MSEE_Web_Application_and_Interface_Design_Cafe_Fausse_Images/home-cafe-fausse.webp'

const IMAGES = [
  { id: 1, src: cafeInteriorImage, alt: 'Café Fausse restaurant interior', category: 'Interior' },
  { id: 2, src: diningRoomImage, alt: 'Café Fausse elegant dining room', category: 'Interior' },
  { id: 6, src: specialEventImage, alt: 'Café Fausse special event dinner', category: 'Events' },
  { id: 3, src: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80', alt: 'Grilled salmon dish', category: 'Dishes' },
  { id: 4, src: ribeyeSteakImage, alt: 'Café Fausse ribeye steak', category: 'Dishes' },
  { id: 5, src: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80', alt: 'Tiramisu dessert', category: 'Dishes' },
  { id: 8, src: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80', alt: 'Bruschetta starter', category: 'Dishes' },
  { id: 7, src: 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80', alt: 'Kitchen behind the scenes', category: 'Behind the Scenes' },
]

const AWARDS = [
  { year: '2022', title: 'Culinary Excellence Award', source: 'Gusto Quarterly' },
  { year: '2023', title: 'Restaurant of the Year', source: 'The Table Guide' },
  { year: '2023', title: 'Best Fine Dining Experience', source: 'Foodie Magazine' },
]

const REVIEWS = [
  { quote: 'Exceptional ambiance and unforgettable flavors.', source: 'Gourmet Review' },
  { quote: 'A must-visit restaurant for food enthusiasts.', source: 'The Daily Bite' },
]

export default function Gallery() {
  const [lightbox, setLightbox] = useState(null)

  function closeLightbox(e) {
    if (e.target === e.currentTarget) setLightbox(null)
  }

  return (
    <div className="gallery-page section">
      <div className="container">
        <p className="section-subtitle">Gallery</p>
        <h1 className="section-title">Our World</h1>
        <div className="divider" />

        <div className="gallery-grid">
          {IMAGES.map(img => (
            <button key={img.id} className="gallery-item" onClick={() => setLightbox(img)}>
              <img src={img.src} alt={img.alt} loading="lazy" />
              <span className="gallery-caption">{img.category}</span>
            </button>
          ))}
        </div>

        {lightbox && (
          <div className="lightbox" onClick={closeLightbox} role="dialog" aria-modal="true">
            <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Close">&#x2715;</button>
            <img src={lightbox.src.replace('w=800', 'w=1200')} alt={lightbox.alt} />
            <p className="lightbox-caption">{lightbox.alt}</p>
          </div>
        )}

        <section className="section awards-section">
          <p className="section-subtitle">Recognition</p>
          <h2 className="section-title">Awards</h2>
          <div className="divider" />
          <div className="awards-list">
            {AWARDS.map(a => (
              <div key={a.title} className="award-card">
                <span className="award-badge">{a.year}</span>
                <div>
                  <h4>{a.title}</h4>
                  {a.source && <p>{a.source}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="reviews-section">
          <p className="section-subtitle">What People Say</p>
          <h2 className="section-title">Guest Reviews</h2>
          <div className="divider" />
          <div className="reviews-grid">
            {REVIEWS.map(r => (
              <blockquote key={r.source} className="review-card">
                <p>&#8220;{r.quote}&#8221;</p>
                <footer>— {r.source}</footer>
              </blockquote>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
