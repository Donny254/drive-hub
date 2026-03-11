import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import heroDashboard from "@/assets/hero-dashboard.jpg";

const HeroSection = () => {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
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
          <h1 className="font-display animate-fade-in text-5xl leading-none tracking-wider min-[380px]:text-6xl md:text-8xl lg:text-9xl">
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
          <p className="mt-6 max-w-xl text-base text-muted-foreground animate-fade-in md:text-xl" style={{ animationDelay: "0.2s" }}>
            East Africa's exclusive marketplace for performance cars and luxury SUVs. Buy, sell, or rent high-end vehicles from trusted dealers across Kenya and the continent.
          </p>
          <div className="mt-10 flex flex-col gap-4 animate-fade-in sm:flex-row sm:flex-wrap" style={{ animationDelay: "0.4s" }}>
            <Link to="/market" className="w-full sm:w-auto">
              <Button variant="hero" size="xl" className="w-full shadow-glow sm:w-auto">
                Explore Market
              </Button>
            </Link>
            <Link to="/services" className="w-full sm:w-auto">
              <Button variant="heroOutline" size="xl" className="w-full sm:w-auto">
                Our Services
              </Button>
            </Link>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-1 gap-6 animate-fade-in sm:grid-cols-3 sm:gap-8" style={{ animationDelay: "0.6s" }}>
            <div className="text-center sm:text-left">
              <p className="font-display text-3xl text-primary">500+</p>
              <p className="text-sm text-muted-foreground">Premium Cars</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="font-display text-3xl text-primary">50+</p>
              <p className="text-sm text-muted-foreground">Trusted Dealers</p>
            </div>
            <div className="text-center sm:text-left">
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
