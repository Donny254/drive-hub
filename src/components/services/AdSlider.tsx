import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch, resolveImageUrl } from "@/lib/api";

type Product = {
  id: string;
  name: string;
  priceCents: number;
  category: string | null;
  imageUrl: string | null;
};

const formatPrice = (cents: number) =>
  `KES ${(cents / 100).toLocaleString("en-KE")}`;

const SLIDE_INTERVAL = 5000;

const GRADIENTS = [
  "from-primary/15 via-primary/5 to-transparent",
  "from-blue-500/15 via-blue-500/5 to-transparent",
  "from-purple-500/15 via-purple-500/5 to-transparent",
  "from-orange-500/15 via-orange-500/5 to-transparent",
  "from-rose-500/15 via-rose-500/5 to-transparent",
  "from-cyan-500/15 via-cyan-500/5 to-transparent",
  "from-emerald-500/15 via-emerald-500/5 to-transparent",
  "from-yellow-500/15 via-yellow-500/5 to-transparent",
];

const AdSlider = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/products?active=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Product[]) => setProducts(data.slice(0, 8)))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const total = products.length;
  const next = useCallback(() => setCurrent((p) => (p + 1) % total), [total]);
  const prev = useCallback(() => setCurrent((p) => (p - 1 + total) % total), [total]);

  useEffect(() => {
    if (total < 2) return;
    const id = setInterval(next, SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, [next, total]);

  if (loading) {
    return (
      <div className="w-full h-24 bg-card border-b border-border flex items-center justify-center gap-4 px-8">
        <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
        <div className="flex flex-col gap-2 flex-1 max-w-xs">
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
          <div className="h-4 w-40 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (total === 0) return null;

  return (
    <div className="relative w-full overflow-hidden border-b border-border bg-card">
      {/* Slides */}
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {products.map((product, i) => (
          <div
            key={product.id}
            className={`min-w-full bg-gradient-to-r ${GRADIENTS[i % GRADIENTS.length]}`}
          >
            {/* Content row — padded clear of arrows */}
            <div className="flex items-center gap-4 px-14 md:px-16 py-3 md:py-4">

              {/* Image */}
              <div className="flex-shrink-0 w-14 h-14 md:w-20 md:h-20 rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center">
                {product.imageUrl ? (
                  <img
                    src={resolveImageUrl(product.imageUrl)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                {product.category && (
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1">
                    {product.category}
                  </span>
                )}
                <h3 className="font-display text-base md:text-xl text-foreground leading-tight line-clamp-1">
                  {product.name}
                </h3>
                <p className="text-primary font-semibold text-sm md:text-base mt-0.5">
                  {formatPrice(product.priceCents)}
                </p>
              </div>

              {/* CTA */}
              <Link
                to="/store"
                className="flex-shrink-0 hidden sm:flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 hover:scale-105 transition-all duration-200 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                Shop Now
              </Link>
              {/* Mobile CTA */}
              <Link
                to="/store"
                className="flex-shrink-0 sm:hidden flex items-center justify-center w-9 h-9 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors cursor-pointer"
                aria-label="Shop Now"
              >
                <ShoppingBag className="w-4 h-4" />
              </Link>
            </div>

            {/* Bottom dots row */}
            {total > 1 && (
              <div className="flex justify-center gap-1.5 pb-2">
                {products.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrent(idx)}
                    className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                      current === idx
                        ? "bg-primary w-5"
                        : "bg-muted-foreground/30 w-1 hover:bg-muted-foreground/60"
                    }`}
                    aria-label={`Go to product ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Arrows — fixed to sides, clear of text */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-background hover:text-primary transition-colors cursor-pointer z-10"
            aria-label="Previous product"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-background hover:text-primary transition-colors cursor-pointer z-10"
            aria-label="Next product"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
};

export default AdSlider;
