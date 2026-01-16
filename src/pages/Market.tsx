import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Car, Fuel, Gauge, Calendar, DollarSign } from "lucide-react";

const cars = [
  {
    id: 1,
    name: "Porsche 911 GT3",
    price: 185000,
    year: 2023,
    mileage: "5,200 mi",
    fuel: "Petrol",
    power: "502 HP",
    image: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=600",
    type: "buy",
    featured: true,
  },
  {
    id: 2,
    name: "BMW M4 Competition",
    price: 92000,
    year: 2024,
    mileage: "1,200 mi",
    fuel: "Petrol",
    power: "503 HP",
    image: "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=600",
    type: "buy",
    featured: false,
  },
  {
    id: 3,
    name: "Mercedes AMG GT",
    price: 450,
    year: 2023,
    mileage: "Daily Rate",
    fuel: "Petrol",
    power: "577 HP",
    image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=600",
    type: "rent",
    featured: true,
  },
  {
    id: 4,
    name: "Audi RS7 Sportback",
    price: 125000,
    year: 2023,
    mileage: "8,500 mi",
    fuel: "Petrol",
    power: "591 HP",
    image: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=600",
    type: "sell",
    featured: false,
  },
  {
    id: 5,
    name: "Lamborghini Huracán",
    price: 750,
    year: 2024,
    mileage: "Daily Rate",
    fuel: "Petrol",
    power: "631 HP",
    image: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600",
    type: "rent",
    featured: true,
  },
  {
    id: 6,
    name: "McLaren 720S",
    price: 295000,
    year: 2022,
    mileage: "12,000 mi",
    fuel: "Petrol",
    power: "710 HP",
    image: "https://images.unsplash.com/photo-1621135802920-133df287f89c?w=600",
    type: "buy",
    featured: false,
  },
];

const tabs = [
  { id: "all", label: "All Cars" },
  { id: "buy", label: "Buy" },
  { id: "rent", label: "Rent" },
  { id: "sell", label: "Sell Yours" },
];

const Market = () => {
  const [activeTab, setActiveTab] = useState("all");

  const filteredCars = activeTab === "all" 
    ? cars 
    : cars.filter(car => car.type === activeTab);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-16 bg-secondary">
          <div className="container mx-auto px-4">
            <h1 className="font-display text-5xl md:text-6xl tracking-wider text-center animate-fade-in">
              CAR <span className="text-primary">MARKET</span>
            </h1>
            <p className="text-center text-muted-foreground mt-4 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Find your dream car or list yours for sale. Premium vehicles from trusted sellers.
            </p>

            {/* Tabs */}
            <div className="flex justify-center gap-2 mt-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "hero" : "secondary"}
                  size="lg"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Car Grid */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCars.map((car, index) => (
                <div
                  key={car.id}
                  className="group bg-card rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all duration-500 animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Image */}
                  <div className="relative h-56 overflow-hidden">
                    <img
                      src={car.image}
                      alt={car.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    {car.featured && (
                      <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
                        Featured
                      </Badge>
                    )}
                    <Badge 
                      className="absolute top-4 right-4 capitalize"
                      variant={car.type === "rent" ? "secondary" : "outline"}
                    >
                      {car.type === "sell" ? "For Sale" : car.type}
                    </Badge>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="font-display text-2xl tracking-wider">{car.name}</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Calendar size={16} />
                        <span>{car.year}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Car size={16} />
                        <span>{car.mileage}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Fuel size={16} />
                        <span>{car.fuel}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Gauge size={16} />
                        <span>{car.power}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center gap-1">
                        <DollarSign className="text-primary" size={20} />
                        <span className="font-display text-2xl">
                          {car.price.toLocaleString()}
                          {car.type === "rent" && <span className="text-sm text-muted-foreground">/day</span>}
                        </span>
                      </div>
                      <Button variant="hero" size="sm">
                        {car.type === "rent" ? "Rent Now" : "View Details"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sell CTA */}
        <section className="py-16 bg-secondary">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-4xl tracking-wider">
              WANT TO <span className="text-primary">SELL YOUR CAR?</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              List your vehicle with us and reach thousands of potential buyers.
            </p>
            <Button variant="hero" size="xl" className="mt-8">
              List Your Car
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Market;
