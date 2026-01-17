import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const slides = [
  {
    id: 1,
    title: "PERFORMANCE",
    subtitle: "Track-Ready Machines",
    description: "Experience the thrill of world-class supercars and sports cars. From Porsche to Lamborghini, find your dream performance vehicle.",
    cta: "View Performance Cars",
    image: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=1200",
  },
  {
    id: 2,
    title: "COMFORT",
    subtitle: "Luxury SUVs & Sedans",
    description: "Travel in style with premium SUVs and luxury sedans. Range Rover, Mercedes GLS, BMW X7 - the finest comfort on African roads.",
    cta: "Explore Luxury Fleet",
    image: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200",
  },
  {
    id: 3,
    title: "ADVERTISE",
    subtitle: "List Your Premium Vehicle",
    description: "Reach thousands of high-end buyers across Kenya and Africa. Premium visibility for your premium vehicle.",
    cta: "Start Selling",
    image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200",
  },
];

const MarketSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="relative w-full bg-card border-b border-border overflow-hidden">
      {/* Main slider container */}
      <div className="relative h-[400px] md:h-[500px]">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-700 ease-in-out ${
              index === currentSlide 
                ? "opacity-100 translate-x-0" 
                : index < currentSlide 
                  ? "opacity-0 -translate-x-full" 
                  : "opacity-0 translate-x-full"
            }`}
          >
            {/* Background image */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${slide.image})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/50" />
            </div>

            {/* Content */}
            <div className="relative h-full container mx-auto px-4 flex items-center">
              <div className="max-w-2xl">
                <p className="text-primary uppercase tracking-[0.3em] text-sm mb-2 animate-fade-in">
                  {slide.subtitle}
                </p>
                <h2 className="font-display text-6xl md:text-8xl tracking-wider mb-4">
                  {slide.title.split("").map((char, i) => (
                    <span 
                      key={i} 
                      className={char === "O" || char === "A" ? "text-primary" : ""}
                    >
                      {char}
                    </span>
                  ))}
                </h2>
                <p className="text-muted-foreground text-lg max-w-lg mb-8">
                  {slide.description}
                </p>
                <Link to="/market">
                  <Button variant="hero" size="xl" className="shadow-[0_0_30px_hsl(var(--primary)/0.3)]">
                    {slide.cta}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-background/80 border border-border hover:border-primary hover:bg-primary/10 transition-all duration-300 z-10"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-background/80 border border-border hover:border-primary hover:bg-primary/10 transition-all duration-300 z-10"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentSlide 
                ? "w-8 bg-primary" 
                : "w-2 bg-muted-foreground/50 hover:bg-muted-foreground"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default MarketSlider;
