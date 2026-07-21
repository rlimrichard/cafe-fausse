import './Menu.css'
import bruschettaImage from '../assets/menu/bruschetta.png'
import caesarSaladImage from '../assets/menu/caesar-salad.png'
import grilledSalmonImage from '../assets/menu/grilled-salmon.png'
import ribeyeSteakImage from '../assets/menu/ribeye-steak.png'
import vegetableRisottoImage from '../assets/menu/vegetable-risotto.png'
import tiramisuImage from '../assets/menu/tiramisu.png'
import cheesecakeImage from '../assets/menu/cheesecake.png'
import redWineImage from '../assets/menu/red-wine.png'
import whiteWineImage from '../assets/menu/white-wine.png'
import craftBeerImage from '../assets/menu/craft-beer.png'
import espressoImage from '../assets/menu/espresso.png'

const MENU = [
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

export default function Menu() {
  return (
    <div className="menu-page section">
      <div className="container">
        <p className="section-subtitle">Our Menu</p>
        <h1 className="section-title">Curated with Care</h1>
        <div className="divider" />

        {MENU.map(({ category, items }) => (
          <section key={category} className="menu-category">
            <h2 className="category-title">{category}</h2>
            <div className="menu-items">
              {items.map(item => (
                <div key={item.name} className="menu-item">
                  <img className="menu-item-image" src={item.image} alt={item.name} loading="lazy" />
                  <div className="menu-item-info">
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                  </div>
                  <span className="menu-item-price">${item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
