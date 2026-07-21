import './AboutUs.css'
import antonioRossiPortrait from '../assets/founders/antonio-rossi.jpg'
import mariaLopezPortrait from '../assets/founders/maria-lopez.jpg'
import cafeFausseStaff from '../assets/about/cafe-fausse-staff.jpg'

export default function AboutUs() {
  return (
    <div className="about-page section">
      <div className="container">
        <p className="section-subtitle">Our Story</p>
        <h1 className="section-title">About Café Fausse</h1>
        <div className="divider" />

        <div className="about-intro">
          <p>
            Founded in 2010 by Chef Antonio Rossi and restaurateur Maria Lopez, Café Fausse blends
            traditional Italian flavors with modern culinary innovation. Our mission is to provide an
            unforgettable dining experience that reflects both quality and creativity.
          </p>
          <p>
            Every dish at Café Fausse is crafted with locally sourced ingredients, ensuring the
            freshest flavors and supporting our community's farmers and producers. We believe that
            exceptional food begins long before it reaches your plate.
          </p>
        </div>

        <figure className="staff-photo">
          <img src={cafeFausseStaff} alt="The Café Fausse culinary and hospitality team together in the dining room" />
          <figcaption>The people who make every Café Fausse evening memorable.</figcaption>
        </figure>

        <section className="founders">
          <h2>Meet the Founders</h2>
          <div className="founders-grid">
            <div className="founder-card">
              <img className="founder-photo" src={antonioRossiPortrait} alt="Chef Antonio Rossi" />
              <h3>Chef Antonio Rossi</h3>
              <p className="founder-title">Executive Chef & Co-Founder</p>
              <p>
                Chef Antonio Rossi brings over 25 years of culinary expertise to Café Fausse.
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
                Café Fausse. With a background in luxury hotel management and an innate sense for
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
              <h4>Locally Sourced</h4>
              <p>We partner with local farmers and producers to bring the freshest seasonal ingredients to your table.</p>
            </div>
            <div className="commitment-item">
              <h4>Culinary Excellence</h4>
              <p>Every dish is prepared with meticulous attention to detail, honoring classical techniques and flavors.</p>
            </div>
            <div className="commitment-item">
              <h4>Unforgettable Dining</h4>
              <p>From ambiance to service, we craft every aspect of your visit to create lasting memories.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
