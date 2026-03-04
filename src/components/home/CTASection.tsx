import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-background to-primary/10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" />

      <div className="container relative z-10 mx-auto px-4 text-center">
        <h2 className="font-display text-4xl md:text-6xl tracking-wider animate-fade-in">
          READY TO START YOUR
          <span className="block text-primary">JOURNEY?</span>
        </h2>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.2s" }}>
          Whether you're buying your first sports car or adding to your collection, we're here to make it happen.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <Link to="/market">
            <Button variant="hero" size="xl">
              Browse Cars
            </Button>
          </Link>
          <Link to="/services">
            <Button variant="heroOutline" size="xl">
              Book Service
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
