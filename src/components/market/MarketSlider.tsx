import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { apiFetch, resolveImageUrl } from "@/lib/api";

type AdvertSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  ctaLabel: string | null;
  ctaLink: string | null;
  imageUrl: string | null;
};

const fallbackSlides: AdvertSlide[] = [
  {
    id: "fallback-performance",
    title: "PERFORMANCE",
    subtitle: "Track-Ready Machines",
    description:
      "Experience the thrill of world-class supercars and sports cars. From Porsche to Lamborghini, find your dream performance vehicle.",
    ctaLabel: "View Performance Cars",
    ctaLink: "/market",
    imageUrl: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=1200",
  },
  {
    id: "fallback-comfort",
    title: "COMFORT",
    subtitle: "Luxury SUVs & Sedans",
    description:
      "Travel in style with premium SUVs and luxury sedans. Range Rover, Mercedes GLS, BMW X7 - the finest comfort on African roads.",
    ctaLabel: "Explore Luxury Fleet",
    ctaLink: "/market",
    imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200",
  },
  {
    id: "fallback-advertise",
    title: "ADVERTISE",
    subtitle: "List Your Premium Vehicle",
    description:
      "Reach thousands of high-end buyers across Kenya and Africa. Premium visibility for your premium vehicle.",
    ctaLabel: "Contact Admin",
    ctaLink: "mailto:info@wheelsnationke.co.ke?subject=Vehicle%20Listing%20Support",
    imageUrl: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200",
  },
];

const MarketSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<AdvertSlide[]>(fallbackSlides);

  useEffect(() => {
    let mounted = true;
    apiFetch("/api/adverts")
      .then((resp) => (resp.ok ? resp.json() : []))
      .then((data) => {
        if (!mounted || !Array.isArray(data) || data.length === 0) return;
        setSlides(data);
        setCurrentSlide(0);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const activeSlides = useMemo(() => (slides.length > 0 ? slides : fallbackSlides), [slides]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);

  const renderTitle = (title: string) =>
    title.split("").map((char, i) => (
      <span key={`${title}-${i}`} className={char === "O" || char === "A" ? "text-primary" : ""}>
        {char}
      </span>
    ));

  return (
    <div className="relative w-full bg-card border-b border-border overflow-hidden">
      {/* Main slider container */}
      <div className="relative h-[400px] md:h-[500px]">
        {activeSlides.map((slide, index) => (
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
              style={{ backgroundImage: `url(${resolveImageUrl(slide.imageUrl)})` }}
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
                  {renderTitle(slide.title)}
                </h2>
                <p className="text-muted-foreground text-lg max-w-lg mb-8">
                  {slide.description}
                </p>
                {slide.ctaLink?.startsWith("/") ? (
                  <Link to={slide.ctaLink}>
                    <Button variant="hero" size="xl" className="shadow-[0_0_30px_hsl(var(--primary)/0.3)]">
                      {slide.ctaLabel || "Learn More"}
                    </Button>
                  </Link>
                ) : (
                  <a href={slide.ctaLink || "#"} target="_blank" rel="noreferrer">
                    <Button variant="hero" size="xl" className="shadow-[0_0_30px_hsl(var(--primary)/0.3)]">
                      {slide.ctaLabel || "Learn More"}
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation arrows */}
      {activeSlides.length > 1 && (
        <>
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
        </>
      )}

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {activeSlides.map((_, index) => (
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
          style={{ width: `${((currentSlide + 1) / activeSlides.length) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default MarketSlider;
