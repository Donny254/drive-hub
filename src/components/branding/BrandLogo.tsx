import { useState } from "react";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  showText?: boolean;
  imageOnlyWhenAvailable?: boolean;
};

const LOGO_SRC = "/brand/wheelsnationke-logo.png";

const BrandLogo = ({
  className,
  imageClassName,
  textClassName,
  showText = true,
  imageOnlyWhenAvailable = true,
}: BrandLogoProps) => {
  const [imageError, setImageError] = useState(false);
  const shouldShowText = showText && (imageError || !imageOnlyWhenAvailable);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {!imageError && (
        <img
          src={LOGO_SRC}
          alt="Wheelsnationke"
          className={cn("h-10 w-auto max-w-[180px] rounded-sm object-contain bg-white/95 p-1 sm:h-12 sm:max-w-[220px]", imageClassName)}
          onError={() => setImageError(true)}
        />
      )}
      {shouldShowText && (
        <div className={cn("leading-none", textClassName)}>
          <div className="font-display text-2xl tracking-[0.16em] text-primary uppercase">
            Wheels
          </div>
          <div className="text-xs uppercase tracking-[0.36em] text-muted-foreground">
            Nation Ke
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandLogo;
