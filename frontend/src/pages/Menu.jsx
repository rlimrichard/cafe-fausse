import { useEffect, useState } from 'react'
import './Menu.css'
import bruschettaImage from '../assets/menu/bruschetta.jpg'
import caesarSaladImage from '../assets/menu/caesar-salad.jpg'
import grilledSalmonImage from '../assets/menu/grilled-salmon.jpg'
import ribeyeSteakImage from '../assets/menu/ribeye-steak.jpg'
import vegetableRisottoImage from '../assets/menu/vegetable-risotto.jpg'
import tiramisuImage from '../assets/menu/tiramisu.jpg'
import cheesecakeImage from '../assets/menu/cheesecake.jpg'
import redWineImage from '../assets/menu/red-wine.jpg'
import whiteWineImage from '../assets/menu/white-wine.jpg'
import craftBeerImage from '../assets/menu/craft-beer.jpg'
import espressoImage from '../assets/menu/espresso.jpg'

const FALLBACK_MENU = [
  {
    category: 'Starters',
    items: [
      { name: 'Bruschetta', description: 'Fresh tomatoes, basil, olive oil, and toasted baguette slices', price: 8.50, image: bruschettaImage },
      { name: 'Caesar Salad', description: 'Crisp romaine with homemade Caesar dressing', price: 9.00, image: caesarSaladImage },
    ],
  },
  {
    category: 'Main Courses',
    items: [
      { name: 'Grilled Salmon', description: 'Served with lemon butter sauce and seasonal vegetables', price: 22.00, image: grilledSalmonImage },
      { name: 'Ribeye Steak', description: '12 oz prime cut with garlic mashed potatoes', price: 28.00, image: ribeyeSteakImage },
      { name: 'Vegetable Risotto', description: 'Creamy Arborio rice with wild mushrooms', price: 18.00, image: vegetableRisottoImage },
    ],
  },
  {
    category: 'Desserts',
    items: [
      { name: 'Tiramisu', description: 'Classic Italian dessert with mascarpone', price: 7.50, image: tiramisuImage },
      { name: 'Cheesecake', description: 'Creamy cheesecake with berry compote', price: 7.00, image: cheesecakeImage },
    ],
  },
  {
    category: 'Beverages',
    items: [
      { name: 'Red Wine (Glass)', description: 'A selection of Italian reds', price: 10.00, image: redWineImage },
      { name: 'White Wine (Glass)', description: 'Crisp and refreshing', price: 9.00, image: whiteWineImage },
      { name: 'Craft Beer', description: 'Local artisan brews', price: 6.00, image: craftBeerImage },
      { name: 'Espresso', description: 'Strong and aromatic', price: 3.00, image: espressoImage },
    ],
  },
]

const FALLBACK_IMAGES = Object.fromEntries(
  FALLBACK_MENU.flatMap(({ items }) => items.map(item => [item.name, item.image]))
)

function formatMenuPrice(price) {
  return Number(price).toFixed(2).replace(/\.?0+$/, '')
}

function groupMenuItems(items) {
  const preferredOrder = FALLBACK_MENU.map(group => group.category)
  const grouped = items.reduce((groups, item) => {
    const category = item.category || 'Menu'
    if (!groups[category]) groups[category] = []
    groups[category].push({ ...item, image: item.image_url || FALLBACK_IMAGES[item.name] })
    return groups
  }, {})
  return Object.entries(grouped)
    .sort(([left], [right]) => {
      const leftIndex = preferredOrder.indexOf(left)
      const rightIndex = preferredOrder.indexOf(right)
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex) || left.localeCompare(right)
    })
    .map(([category, items]) => ({ category, items }))
}

export default function Menu() {
  const [menu, setMenu] = useState(FALLBACK_MENU)

  useEffect(() => {
    fetch('/api/menu')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(items => {
        if (Array.isArray(items) && items.length) setMenu(groupMenuItems(items))
      })
      .catch(() => {})
  }, [])

  return (
    <div className="menu-page section">
      <div className="container">
        <p className="section-subtitle">Our Menu</p>
        <h1 className="section-title">Curated with Care</h1>
        <div className="divider" />
        <p className="menu-price-note">All menu prices are in USD.</p>

        {menu.map(({ category, items }) => (
          <section key={category} className="menu-category">
            <h2 className="category-title">{category}</h2>
            <div className="menu-items">
              {items.map(item => (
                <div key={item.name} className="menu-item">
                  {item.image
                    ? <img className="menu-item-image" src={item.image} alt={item.name} loading="lazy" />
                    : <div className="menu-item-image menu-item-image--empty" aria-label={`No image for ${item.name}`}>No image</div>}
                  <div className="menu-item-info">
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                  </div>
                  <span className="menu-item-price">{formatMenuPrice(item.price)}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
