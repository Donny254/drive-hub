import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, X } from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string;
  sizes?: string[];
}

interface CartItem extends Product {
  quantity: number;
  selectedSize?: string;
}

const products: Product[] = [
  {
    id: 1,
    name: "Velocity Racing Hoodie",
    price: 89,
    category: "Apparel",
    image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: 2,
    name: "Classic Logo Tee",
    price: 45,
    category: "Apparel",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: 3,
    name: "Performance Cap",
    price: 35,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600",
  },
  {
    id: 4,
    name: "Carbon Fiber Keychain",
    price: 25,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1622434641406-a158123450f9?w=600",
  },
  {
    id: 5,
    name: "Motorsport Watch",
    price: 299,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600",
  },
  {
    id: 6,
    name: "Racing Gloves",
    price: 79,
    category: "Gear",
    image: "https://images.unsplash.com/photo-1584467735815-f778f274e296?w=600",
    sizes: ["S", "M", "L"],
  },
  {
    id: 7,
    name: "Velocity Duffle Bag",
    price: 129,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600",
  },
  {
    id: 8,
    name: "Limited Edition Poster",
    price: 49,
    category: "Collectibles",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600",
  },
];

const categories = ["All", "Apparel", "Accessories", "Gear", "Collectibles"];

const Store = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredProducts = activeCategory === "All" 
    ? products 
    : products.filter(p => p.category === activeCategory);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-16 bg-secondary">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-5xl md:text-6xl tracking-wider animate-fade-in">
              MERCH <span className="text-primary">STORE</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Premium apparel and accessories for true car enthusiasts.
            </p>

            {/* Categories */}
            <div className="flex flex-wrap justify-center gap-2 mt-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? "hero" : "secondary"}
                  size="default"
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Products Grid */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="group bg-card rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-all duration-500 animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="relative h-64 overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <Badge className="absolute top-3 left-3 bg-secondary text-secondary-foreground">
                      {product.category}
                    </Badge>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-xl tracking-wider">{product.name}</h3>
                    <div className="flex items-center justify-between mt-4">
                      <span className="font-display text-2xl text-primary">${product.price}</span>
                      <Button 
                        variant="hero" 
                        size="sm"
                        onClick={() => addToCart(product)}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {/* Floating Cart Button */}
      <button
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-gradient-to-r from-primary to-orange-400 flex items-center justify-center shadow-[0_0_30px_hsl(25_95%_53%_/_0.4)] hover:scale-110 transition-transform z-50"
      >
        <ShoppingCart className="w-6 h-6 text-primary-foreground" />
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-background text-xs flex items-center justify-center font-bold">
            {cartCount}
          </span>
        )}
      </button>

      {/* Cart Sidebar */}
      {isCartOpen && (
        <>
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={() => setIsCartOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 animate-slide-in-left overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-display text-2xl tracking-wider">YOUR CART</h2>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={24} />
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">Your cart is empty</p>
              ) : (
                <>
                  <div className="space-y-6">
                    {cart.map((item) => (
                      <div key={item.id} className="flex gap-4 pb-6 border-b border-border">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-primary font-display text-lg">${item.price}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <span>{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="ml-auto text-muted-foreground hover:text-destructive"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-border">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-lg">Total</span>
                      <span className="font-display text-3xl text-primary">${cartTotal}</span>
                    </div>
                    <Button variant="hero" size="xl" className="w-full">
                      Checkout
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Store;
