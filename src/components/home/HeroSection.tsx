import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import heroDashboard from "@/assets/hero-dashboard.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${heroDashboard})`,
        }}
      >
        {/* Luxury overlay gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
        
        {/* Subtle glow effect */}
        <div 
          className="absolute inset-0"
          style={{ 
            background: `radial-gradient(ellipse at 50% 60%, hsl(var(--primary) / 0.15), transparent 60%)`,
          }}
        />
        
        {/* Vignette effect */}
        <div 
          className="absolute inset-0"
          style={{ 
            boxShadow: `inset 0 0 120px 40px hsl(180 10% 5% / 0.8)`,
          }}
        />
      </div>

      {/* Static accent lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        
        {/* Corner accents */}
        <div className="absolute top-20 left-8 w-24 h-px bg-gradient-to-r from-primary/50 to-transparent" />
        <div className="absolute top-20 left-8 w-px h-24 bg-gradient-to-b from-primary/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-4 pt-20">
        <div className="max-w-3xl">
          <p className="text-primary/90 uppercase tracking-[0.3em] text-sm mb-4 animate-fade-in font-medium">
            Kenya's Premier Automotive Destination
          </p>
          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl leading-none tracking-wider animate-fade-in">
            DRIVE YOUR
            <span 
              className="block text-primary"
              style={{ 
                textShadow: `0 0 40px hsl(var(--primary) / 0.4)`,
              }}
            >
              PASSION
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl animate-fade-in" style={{ animationDelay: "0.2s" }}>
            East Africa's exclusive marketplace for performance cars and luxury SUVs. Buy, sell, or rent high-end vehicles from trusted dealers across Kenya and the continent.
          </p>
          <div className="flex flex-wrap gap-4 mt-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <Link to="/market">
              <Button variant="hero" size="xl" className="shadow-glow">
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

    </section>
  );
};

export default HeroSection;
