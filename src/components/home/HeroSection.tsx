import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import heroCar from "@/assets/hero-car.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroCar})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-4 pt-20">
        <div className="max-w-3xl">
          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl leading-none tracking-wider animate-fade-in">
            DRIVE YOUR
            <span className="block text-primary">PASSION</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl animate-fade-in" style={{ animationDelay: "0.2s" }}>
            Your ultimate destination for automotive excellence. Buy, sell, rent, service, and celebrate the car culture with fellow enthusiasts.
          </p>
          <div className="flex flex-wrap gap-4 mt-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <Link to="/market">
              <Button variant="hero" size="xl">
                Explore Market
              </Button>
            </Link>
            <Link to="/services">
              <Button variant="heroOutline" size="xl">
                Our Services
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-muted-foreground rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-primary rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
