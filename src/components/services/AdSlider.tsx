import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const adverts = [
  {
    id: 1,
    title: "Premium Auto Insurance",
    description: "Protect your ride with our comprehensive coverage plans. Get 20% off your first year!",
    cta: "Get Quote",
    gradient: "from-primary/20 via-primary/10 to-background",
    sponsor: "AutoShield Insurance",
  },
  {
    id: 2,
    title: "Michelin Performance Tires",
    description: "Experience the road like never before. Engineered for precision, built for performance.",
    cta: "Shop Now",
    gradient: "from-blue-600/20 via-blue-500/10 to-background",
    sponsor: "Michelin",
  },
  {
    id: 3,
    title: "Mobile Car Wash Pro",
    description: "We come to you! Professional detailing at your doorstep. Book your first wash free.",
    cta: "Book Free Wash",
    gradient: "from-purple-600/20 via-purple-500/10 to-background",
    sponsor: "WashPro Mobile",
  },
];

const AdSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % adverts.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % adverts.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + adverts.length) % adverts.length);
  };

  return (
    <div className="relative w-full h-32 md:h-40 overflow-hidden bg-card border-b border-border">
      {/* Slides */}
      <div
        className="flex transition-transform duration-700 ease-in-out h-full"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {adverts.map((ad) => (
          <div
            key={ad.id}
            className={`min-w-full h-full flex items-center justify-center bg-gradient-to-r ${ad.gradient}`}
          >
            <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                  Sponsored by {ad.sponsor}
                </p>
                <h3 className="font-display text-xl md:text-2xl tracking-wider text-foreground">
                  {ad.title}
                </h3>
                <p className="text-muted-foreground text-sm mt-1 max-w-md hidden md:block">
                  {ad.description}
                </p>
              </div>
              <button className="px-6 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap">
                {ad.cta}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 border border-border flex items-center justify-center text-foreground hover:bg-background transition-colors"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 border border-border flex items-center justify-center text-foreground hover:bg-background transition-colors"
        aria-label="Next slide"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {adverts.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              currentSlide === index
                ? "bg-primary w-6"
                : "bg-muted-foreground/40 hover:bg-muted-foreground"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default AdSlider;
