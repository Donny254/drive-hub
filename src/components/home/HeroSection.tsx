import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const DriveScene3D = lazy(() => import("./DriveScene3D"));

const HeroSection = () => {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[hsl(180_10%_4%)]">
      {/* 3D Driving Scene */}
      <div className="absolute inset-0">
        <Suspense fallback={<div className="absolute inset-0 bg-[hsl(180_10%_4%)]" />}>
          <DriveScene3D />
        </Suspense>
      </div>

      {/* Left-side gradient overlay so text is readable */}
      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(180_10%_4%)] via-[hsl(180_10%_4%)/70%] to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(180_10%_4%)] via-transparent to-[hsl(180_10%_4%)/40%] pointer-events-none" />

      {/* Static accent lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute top-20 left-8 w-24 h-px bg-gradient-to-r from-primary/50 to-transparent" />
        <div className="absolute top-20 left-8 w-px h-24 bg-gradient-to-b from-primary/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-4 pt-20">
        <div className="max-w-3xl">
          <p className="text-primary/90 uppercase tracking-[0.3em] text-sm mb-4 animate-fade-in font-medium">
            Your Prefered Automotive Destination
          </p>
          <h1 className="font-display animate-fade-in text-5xl min-[380px]:text-6xl md:text-7xl lg:text-8xl text-white">
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
          <p
            className="mt-6 max-w-xl text-base text-white/70 animate-fade-in md:text-xl"
            style={{ animationDelay: "0.2s" }}
          >
            East Africa's exclusive marketplace for performance cars and luxury
            SUVs. Buy, sell, or rent high-end vehicles from trusted dealers
            across Kenya and the continent.
          <p className="mt-6 max-w-xl text-base text-muted-foreground animate-fade-in md:text-xl" style={{ animationDelay: "0.2s" }}>
            East Africa's exclusive marketplace for a variaty of cars. Buy, sell, or rent your prefered vehicles from trusted dealers across different location.
          </p>
          <div
            className="mt-10 flex flex-col gap-4 animate-fade-in sm:flex-row sm:flex-wrap"
            style={{ animationDelay: "0.4s" }}
          >
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
