import { Car, Wrench, Calendar, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Car,
    title: "Car Market",
    description: "Buy, sell, or rent from our curated selection of premium vehicles.",
    link: "/market",
    color: "from-primary to-orange-400",
  },
  {
    icon: Wrench,
    title: "Expert Services",
    description: "Professional maintenance, tuning, and detailing by certified experts.",
    link: "/services",
    color: "from-blue-500 to-cyan-400",
  },
  {
    icon: Calendar,
    title: "Events & Culture",
    description: "Join car meets, rallies, and stay updated with automotive news.",
    link: "/events",
    color: "from-purple-500 to-pink-400",
  },
  {
    icon: ShoppingBag,
    title: "Merch Store",
    description: "Premium apparel and accessories for true car enthusiasts.",
    link: "/store",
    color: "from-green-500 to-emerald-400",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl tracking-wider">
            WHAT WE <span className="text-primary">OFFER</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Everything you need for your automotive journey, all in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Link
              key={feature.title}
              to={feature.link}
              className="group relative p-8 rounded-lg bg-card border border-border hover:border-primary/50 transition-all duration-500 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-display text-2xl tracking-wider mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
              <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-primary">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
