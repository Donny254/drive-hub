import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import heroDashboard from "@/assets/hero-dashboard.jpg";

const HeroSection = () => {
  const [revLevel, setRevLevel] = useState(0);

  // Simulate revving animation on load
  useEffect(() => {
    const intervals = [
      setTimeout(() => setRevLevel(30), 300),
      setTimeout(() => setRevLevel(70), 600),
      setTimeout(() => setRevLevel(100), 900),
      setTimeout(() => setRevLevel(60), 1200),
      setTimeout(() => setRevLevel(85), 1500),
    ];
    return () => intervals.forEach(clearTimeout);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with 3D effect */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 transition-transform duration-1000"
        style={{ 
          backgroundImage: `url(${heroDashboard})`,
          transform: `scale(${1.05 + revLevel * 0.001})`,
        }}
      >
        {/* Luxury overlay gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
        {/* Orange glow effect */}
        <div 
          className="absolute inset-0 transition-opacity duration-300"
          style={{ 
            background: `radial-gradient(circle at 50% 50%, hsl(var(--primary) / ${revLevel * 0.002}), transparent 70%)`,
          }}
        />
      </div>

      {/* Animated rev lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent transition-opacity duration-500"
          style={{ opacity: revLevel > 50 ? 0.8 : 0 }}
        />
        <div 
          className="absolute top-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent transition-opacity duration-700"
          style={{ opacity: revLevel > 70 ? 0.6 : 0 }}
        />
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-4 pt-20">
        <div className="max-w-3xl">
          <p className="text-primary/80 uppercase tracking-[0.3em] text-sm mb-4 animate-fade-in">
            Kenya's Premier Automotive Destination
          </p>
          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl leading-none tracking-wider animate-fade-in">
            DRIVE YOUR
            <span className="block text-primary drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]">PASSION</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl animate-fade-in" style={{ animationDelay: "0.2s" }}>
            East Africa's exclusive marketplace for performance cars and luxury SUVs. Buy, sell, or rent high-end vehicles from trusted dealers across Kenya and the continent.
          </p>
          <div className="flex flex-wrap gap-4 mt-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <Link to="/market">
              <Button variant="hero" size="xl" className="shadow-[0_0_30px_hsl(var(--primary)/0.3)]">
                Explore Market
              </Button>
            </Link>
            <Link to="/services">
              <Button variant="heroOutline" size="xl">
                Our Services
              </Button>
            </Link>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-8 mt-16 animate-fade-in" style={{ animationDelay: "0.6s" }}>
            <div className="text-center">
              <p className="font-display text-3xl text-primary">500+</p>
              <p className="text-sm text-muted-foreground">Premium Cars</p>
            </div>
            <div className="text-center">
              <p className="font-display text-3xl text-primary">50+</p>
              <p className="text-sm text-muted-foreground">Trusted Dealers</p>
            </div>
            <div className="text-center">
              <p className="font-display text-3xl text-primary">10+</p>
              <p className="text-sm text-muted-foreground">African Countries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-primary/50 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-primary rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
