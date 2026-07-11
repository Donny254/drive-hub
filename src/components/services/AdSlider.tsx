import { useEffect, useState } from "react";
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
    id: "fallback-service-advert",
    title: "SERVICE SUPPORT",
    subtitle: "Maintenance & Repairs",
    description:
      "Keep your vehicle in top condition with our certified service specialists and premium aftercare support.",
    ctaLabel: "Book a Service",
    ctaLink: "/services",
    imageUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200",
  },
];

const normalizeSlide = (raw: Record<string, unknown>): AdvertSlide | null => {
  const id = String(raw.id ?? "");
  const title = String(raw.title ?? raw.name ?? "").trim();
  const subtitle = String(raw.subtitle ?? raw.sub_title ?? "").trim() || null;
  const description = String(raw.description ?? raw.body ?? "").trim() || null;
  const ctaLabel = String(raw.ctaLabel ?? raw.cta_label ?? "").trim() || null;
  const ctaLink = String(raw.ctaLink ?? raw.cta_link ?? "").trim() || null;
  const imageUrl = String(raw.imageUrl ?? raw.image_url ?? "").trim() || null;

  if (!id || title.length < 2 || !description) return null;

  return { id, title, subtitle, description, ctaLabel, ctaLink, imageUrl };
};

const AdSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<AdvertSlide[]>(fallbackSlides);

  useEffect(() => {
    let mounted = true;

    apiFetch("/api/adverts")
      .then((resp) => (resp.ok ? resp.json() : []))
      .then((data: unknown) => {
        if (!mounted || !Array.isArray(data)) return;

        const valid = (data as Record<string, unknown>[])
          .map(normalizeSlide)
          .filter((slide): slide is AdvertSlide => slide !== null)
          .filter((slide) => slide.ctaLink === "/services");

        if (valid.length > 0) {
          setSlides(valid);
          setCurrentSlide(0);
        }
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

  const activeSlides = slides.length > 0 ? slides : fallbackSlides;
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);

  const renderTitle = (title: string) =>
    title.split("").map((char, index) => (
      <span key={`${title}-${index}`} className={char === "O" || char === "A" ? "text-primary" : ""}>
        {char}
      </span>
    ));

  return (
    <div className="relative w-full border-b border-border overflow-hidden bg-card">
      <div className="relative h-[260px] md:h-[340px]">
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
            <div className="absolute inset-0 bg-[hsl(180_10%_6%)]">
              {slide.imageUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-60"
                  style={{ backgroundImage: `url(${resolveImageUrl(slide.imageUrl)})` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[hsl(180_10%_6%)] via-[hsl(180_10%_6%)/85%] to-transparent" />
            </div>

            <div className="relative h-full flex items-center px-6 md:px-12">
              <div className="max-w-xl">
                {slide.subtitle && (
                  <p className="text-primary uppercase tracking-[0.3em] text-xs md:text-sm mb-2">
                    {slide.subtitle}
                  </p>
                )}
                <h2 className="font-display text-3xl md:text-5xl mb-3 text-white leading-tight break-words">
                  {renderTitle(slide.title)}
                </h2>
                <p className="text-white/70 text-sm max-w-lg mb-5 line-clamp-2">
                  {slide.description}
                </p>
                {slide.ctaLink?.startsWith("/") ? (
                  <Link to={slide.ctaLink}>
                    <Button variant="hero" size="default" className="shadow-[0_0_30px_hsl(var(--primary)/0.3)]">
                      {slide.ctaLabel || "Learn More"}
                    </Button>
                  </Link>
                ) : (
                  <a href={slide.ctaLink || "#"} target="_blank" rel="noreferrer">
                    <Button variant="hero" size="default" className="shadow-[0_0_30px_hsl(var(--primary)/0.3)]">
                      {slide.ctaLabel || "Learn More"}
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeSlides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 border border-white/20 hover:border-primary hover:bg-primary/10 transition-all duration-300 z-10 text-white"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 border border-white/20 hover:border-primary hover:bg-primary/10 transition-all duration-300 z-10 text-white"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {activeSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? "w-8 bg-primary"
                : "w-1.5 bg-white/30 hover:bg-white/60"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default AdSlider;
