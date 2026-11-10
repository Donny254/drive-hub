import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube, Pin, Phone, Mail, MapPin, type LucideIcon } from "lucide-react";
import BrandLogo from "@/components/branding/BrandLogo";
import { apiFetch } from "@/lib/api";

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.59 4.24 1.75v4.02c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.23-1.38.04-2.76-.34-3.93-1.08-1.94-1.24-3.31-3.5-3.1-5.84.13-2.36 1.59-4.57 3.71-5.64 1.2-.64 2.6-.91 3.95-.73.02 1.48-.04 2.96-.04 4.44-.99-.32-2.17-.23-3.02.39-.62.45-1.07 1.16-1.19 1.92-.1.58.05 1.2.35 1.7.63 1.12 2.04 1.7 3.29 1.36.84-.24 1.55-.86 1.9-1.66.11-.27.18-.55.2-.84.04-3.32.02-6.64.03-9.96 0-1.98-.01-3.97.01-5.95Z" />
  </svg>
);

type Settings = {
  companyName: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  address: string | null;
  socialFacebook: string | null;
  socialInstagram: string | null;
  socialPinterest: string | null;
  socialTwitter: string | null;
  socialTikTok: string | null;
  socialYoutube: string | null;
};

type SocialPlatform = {
  name: string;
  icon: LucideIcon | ((props: React.SVGProps<SVGSVGElement>) => JSX.Element);
  href: string | null;
};

const Footer = () => {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    apiFetch("/api/settings/public", { signal: controller.signal })
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((data) => setSettings(data))
      .catch(() => setSettings(null))
      .finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);

  const socialPlatforms: SocialPlatform[] = [
    { name: "Facebook", icon: Facebook, href: settings?.socialFacebook || null },
    { name: "Instagram", icon: Instagram, href: settings?.socialInstagram || null },
    { name: "Pinterest", icon: Pin, href: settings?.socialPinterest || null },
    { name: "X", icon: Twitter, href: settings?.socialTwitter || null },
    { name: "TikTok", icon: TikTokIcon, href: settings?.socialTikTok || null },
    { name: "YouTube", icon: Youtube, href: settings?.socialYoutube || null },
  ];

  return (
    <footer
      id="contact"
      className="border-t border-border bg-[radial-gradient(circle_at_top_left,rgba(15,211,179,0.1),transparent_24%),linear-gradient(180deg,hsl(var(--secondary)),hsl(var(--background)))]"
    >
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 xl:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <BrandLogo
              className="items-start"
              imageClassName="h-32 max-w-[164px] sm:h-36 sm:max-w-[184px]"
            />
            <p className="mt-4 text-muted-foreground text-sm">
              Kenya's premier destination for Crazy Builds ,Performance cars and Luxury SUVs. Buy, sell, rent, and experience automotive excellence across East Africa.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {socialPlatforms.some((platform) => platform.href)
                ? "Follow our official channels"
                : "Official social channels coming online"}
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              {socialPlatforms.map((platform) => {
                const Icon = platform.icon;
                return platform.href ? (
                  <a
                    key={platform.name}
                    href={platform.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-primary"
                    aria-label={platform.name}
                  >
                    <Icon size={18} />
                  </a>
                ) : (
                  <span
                    key={platform.name}
                    className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground/60"
                    title={`${platform.name} link not configured yet`}
                    aria-label={`${platform.name} link not configured yet`}
                  >
                    <Icon size={18} />
                  </span>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div className="min-w-0">
            <h4 className="font-display text-base mb-4">QUICK LINKS</h4>
            <ul className="space-y-3">
              <li><Link to="/market" className="text-muted-foreground hover:text-primary text-sm transition-colors">Car Market</Link></li>
              <li><Link to="/services" className="text-muted-foreground hover:text-primary text-sm transition-colors">Our Services</Link></li>
              <li><Link to="/events" className="text-muted-foreground hover:text-primary text-sm transition-colors">Events & Blogs</Link></li>
              <li><Link to="/store" className="text-muted-foreground hover:text-primary text-sm transition-colors">Merch Store</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div className="min-w-0">
            <h4 className="font-display text-base mb-4">SERVICES</h4>
            <ul className="space-y-3">
              <li><span className="text-muted-foreground text-sm">Performance Tuning</span></li>
              <li><span className="text-muted-foreground text-sm">Detailing & Wrap</span></li>
              <li><span className="text-muted-foreground text-sm">Maintenance & Upgrades</span></li>
              <li><span className="text-muted-foreground text-sm">Pre-Purchase Inspections</span></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="min-w-0">
            <h4 className="font-display text-base mb-4">CONTACT US</h4>
            <ul className="space-y-4 text-muted-foreground text-sm">
              <li className="flex items-center gap-3">
                <MapPin size={16} className="text-primary flex-shrink-0" />
                <span className="break-words">{settings?.address || "Nairobi, Kenya"}</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={16} className="text-primary flex-shrink-0" />
                <a href={`mailto:${settings?.supportEmail || "wheelsnationke0@gmail.com"}`} className="break-all hover:text-primary transition-colors">
                  {settings?.supportEmail || "wheelsnationke0@gmail.com"}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-primary flex-shrink-0" />
                <a href={`tel:${settings?.supportPhone || "++254 701 730 057"}`} className="break-words hover:text-primary transition-colors">
                  {settings?.supportPhone || "+254 701 730 057"}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p className="break-words">© {new Date().getFullYear()} {settings?.companyName || "WheelsnationKe"}. All rights reserved. | Serving Kenya & East Africa</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
