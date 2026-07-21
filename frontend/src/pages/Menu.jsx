import './Menu.css'

const MENU = [
  {
    category: 'Starters',
    items: [
      { name: 'Bruschetta', description: 'Fresh tomatoes, basil, olive oil, and toasted baguette slices', price: 8.50 },
      { name: 'Caesar Salad', description: 'Crisp romaine with homemade Caesar dressing', price: 9.00 },
    ],
  },
  {
    category: 'Main Courses',
    items: [
      { name: 'Grilled Salmon', description: 'Served with lemon butter sauce and seasonal vegetables', price: 22.00 },
      { name: 'Ribeye Steak', description: '12 oz prime cut with garlic mashed potatoes', price: 28.00 },
      { name: 'Vegetable Risotto', description: 'Creamy Arborio rice with wild mushrooms', price: 18.00 },
    ],
  },
  {
    category: 'Desserts',
    items: [
      { name: 'Tiramisu', description: 'Classic Italian dessert with mascarpone', price: 7.50 },
      { name: 'Cheesecake', description: 'Creamy cheesecake with berry compote', price: 7.00 },
    ],
  },
  {
    category: 'Beverages',
    items: [
      { name: 'Red Wine (Glass)', description: 'A selection of Italian reds', price: 10.00 },
      { name: 'White Wine (Glass)', description: 'Crisp and refreshing', price: 9.00 },
      { name: 'Craft Beer', description: 'Local artisan brews', price: 6.00 },
      { name: 'Espresso', description: 'Strong and aromatic', price: 3.00 },
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
