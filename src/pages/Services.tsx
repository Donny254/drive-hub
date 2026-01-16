import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Wrench, Paintbrush, Shield, Gauge, Car, Settings, CheckCircle } from "lucide-react";
import serviceGarage from "@/assets/service-garage.jpg";

const services = [
  {
    icon: Wrench,
    title: "Performance Tuning",
    description: "Unlock your car's full potential with our expert ECU tuning, exhaust upgrades, and performance modifications.",
    features: ["ECU Remapping", "Exhaust Systems", "Intake Upgrades", "Suspension Tuning"],
    price: "From $299",
  },
  {
    icon: Paintbrush,
    title: "Detailing & Wrap",
    description: "Premium detailing services and vinyl wraps to keep your car looking its absolute best.",
    features: ["Full Detail", "Paint Correction", "Ceramic Coating", "Custom Wraps"],
    price: "From $149",
  },
  {
    icon: Shield,
    title: "Paint Protection",
    description: "Protect your investment with our PPF installation and ceramic coating services.",
    features: ["PPF Installation", "Ceramic Pro", "Tint Installation", "Interior Protection"],
    price: "From $499",
  },
  {
    icon: Settings,
    title: "Maintenance",
    description: "Regular maintenance and repairs by certified technicians using OEM parts.",
    features: ["Oil Changes", "Brake Service", "Tire Rotation", "Fluid Checks"],
    price: "From $79",
  },
  {
    icon: Gauge,
    title: "Diagnostics",
    description: "Full computer diagnostics and troubleshooting for all makes and models.",
    features: ["Error Code Scan", "Performance Analysis", "Health Check", "Pre-Purchase Inspection"],
    price: "From $49",
  },
  {
    icon: Car,
    title: "Custom Builds",
    description: "Turn your vision into reality with our custom build and restoration services.",
    features: ["Engine Swaps", "Restorations", "Widebody Kits", "Custom Interiors"],
    price: "Quote",
  },
];

const Services = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${serviceGarage})` }}
          >
            <div className="absolute inset-0 bg-background/90" />
          </div>
          <div className="container relative z-10 mx-auto px-4 text-center">
            <h1 className="font-display text-5xl md:text-6xl tracking-wider animate-fade-in">
              EXPERT <span className="text-primary">SERVICES</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Professional automotive services by certified technicians. Your car deserves the best.
            </p>
          </div>
        </section>

        {/* Services Grid */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service, index) => (
                <div
                  key={service.title}
                  className="group bg-card rounded-lg border border-border p-8 hover:border-primary/50 transition-all duration-500 animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <service.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  
                  <h3 className="font-display text-2xl tracking-wider mb-3">{service.title}</h3>
                  <p className="text-muted-foreground text-sm mb-6">{service.description}</p>
                  
                  <ul className="space-y-2 mb-6">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between pt-6 border-t border-border">
                    <span className="font-display text-xl text-primary">{service.price}</span>
                    <Button variant="hero" size="sm">
                      Book Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-secondary">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-4xl tracking-wider">
              NEED A <span className="text-primary">CUSTOM QUOTE?</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              Contact us for specialized services or custom build projects.
            </p>
            <Button variant="hero" size="xl" className="mt-8">
              Get Quote
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Services;
