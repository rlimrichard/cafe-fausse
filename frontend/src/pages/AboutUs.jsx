import './AboutUs.css'
import antonioRossiPortrait from '../assets/founders/antonio-rossi.jpg'
import mariaLopezPortrait from '../assets/founders/maria-lopez.jpg'
import cafeFausseStaff from '../assets/about/cafe-fausse-staff.jpg'

export default function AboutUs() {
  return (
    <div className="about-page section">
      <div className="container">
        <p className="section-subtitle">Our Story</p>
        <h1 className="section-title">About Trattoria Bellavista</h1>
        <div className="divider" />

        <div className="about-intro">
          <p>
            Founded in 2010 by Chef Antonio Rossi and restaurateur Maria Lopez, Trattoria Bellavista blends
            traditional Italian flavors with modern culinary innovation. Our mission is to provide an
            unforgettable dining experience that reflects both quality and creativity.
          </p>
          <p>
            Every dish at Trattoria Bellavista is crafted with locally sourced ingredients, ensuring the
            freshest flavors and supporting our community's farmers and producers. We believe that
            exceptional food begins long before it reaches your plate.
          </p>
        </div>

        <figure className="staff-photo">
          <img src={cafeFausseStaff} alt="The Trattoria Bellavista culinary and hospitality team together in the dining room" />
          <figcaption>The people who make every Trattoria Bellavista evening memorable.</figcaption>
        </figure>

        <section className="founders">
          <h2>Meet the Founders</h2>
          <div className="founders-grid">
            <div className="founder-card">
              <img className="founder-photo" src={antonioRossiPortrait} alt="Chef Antonio Rossi" />
              <h3>Chef Antonio Rossi</h3>
              <p className="founder-title">Executive Chef & Co-Founder</p>
              <p>
                Chef Antonio Rossi brings over 25 years of culinary expertise to Trattoria Bellavista.
                Trained in the kitchens of Milan and Rome, Antonio has dedicated his career to
                honoring classical Italian techniques while embracing contemporary creativity.
                His passion for locally sourced, seasonal ingredients defines every dish on the menu.
              </p>
            </div>
            <div className="founder-card">
              <img className="founder-photo" src={mariaLopezPortrait} alt="Maria Lopez" />
              <h3>Maria Lopez</h3>
              <p className="founder-title">Restaurateur & Co-Founder</p>
              <p>
                Maria Lopez brings a sophisticated vision for hospitality and guest experience to
                Trattoria Bellavista. With a background in luxury hotel management and an innate sense for
                ambiance, Maria has shaped the restaurant into a warm and elegant destination where
                every guest feels personally welcomed.
              </p>
            </div>
          </div>
        </section>

        <section className="commitment">
          <h2>Our Commitment</h2>
          <div className="commitment-grid">
            <div className="commitment-item">
              <div className="commitment-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M24 40V23" />
                  <path d="M24 27C14 27 9 20 9 10c10 0 15 7 15 17Z" />
                  <path d="M24 20c0-10 6-16 16-16 0 10-6 16-16 16Z" />
                </svg>
              </div>
              <h4>Locally Sourced</h4>
              <p>We partner with local farmers and producers to bring the freshest seasonal ingredients to your table.</p>
            </div>
            <div className="commitment-item">
              <div className="commitment-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 37h28" />
                  <path d="M15 37c0-8 3-12 9-12s9 4 9 12" />
                  <path d="M17 25 13 9h22l-4 16" />
                  <path d="M19 9V6m10 3V6" />
                  <path d="M18 17h12" />
                </svg>
              </div>
              <h4>Culinary Excellence</h4>
              <p>Every dish is prepared with meticulous attention to detail, honoring classical techniques and flavors.</p>
            </div>
            <div className="commitment-item">
              <div className="commitment-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 39h26" />
                  <path d="M14 39V22h20v17" />
                  <path d="M18 22v-5h12v5" />
                  <path d="M20 30h8" />
                  <path d="M24 17V9" />
                  <path d="m24 9 3 3m-3-3-3 3" />
                </svg>
              </div>
              <h4>Unforgettable Dining</h4>
              <p>From ambiance to service, we craft every aspect of your visit to create lasting memories.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
