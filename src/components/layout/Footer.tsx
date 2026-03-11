import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube, Phone, Mail, MapPin } from "lucide-react";
import BrandLogo from "@/components/branding/BrandLogo";
import { apiFetch } from "@/lib/api";

type Settings = {
  companyName: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  address: string | null;
  socialFacebook: string | null;
  socialInstagram: string | null;
  socialTwitter: string | null;
  socialYoutube: string | null;
};

const Footer = () => {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    apiFetch("/api/settings/public")
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((data) => setSettings(data))
      .catch(() => setSettings(null));
  }, []);

  const socialPlatforms = [
    { name: "Facebook", icon: Facebook, href: settings?.socialFacebook || null },
    { name: "Instagram", icon: Instagram, href: settings?.socialInstagram || null },
    { name: "X", icon: Twitter, href: settings?.socialTwitter || null },
    { name: "YouTube", icon: Youtube, href: settings?.socialYoutube || null },
  ];

  return (
    <footer
      id="contact"
      className="border-t border-border bg-[radial-gradient(circle_at_top_left,rgba(15,211,179,0.1),transparent_24%),linear-gradient(180deg,hsl(var(--secondary)),hsl(var(--background)))]"
    >
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 xl:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <BrandLogo
              className="items-start"
              imageClassName="h-14 max-w-[220px] border border-border bg-white/95 p-2 sm:h-16 sm:max-w-[260px]"
            />
            <p className="mt-4 text-muted-foreground text-sm">
              Kenya's premier destination for performance cars and luxury SUVs. Buy, sell, rent, and experience automotive excellence across East Africa.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {socialPlatforms.some((platform) => platform.href)
                ? "Follow our official channels"
                : "Official social channels coming online"}
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              {socialPlatforms.map((platform) => (
                platform.href ? (
                  <a
                    key={platform.name}
                    href={platform.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-primary"
                    aria-label={platform.name}
                  >
                    <platform.icon size={18} />
                  </a>
                ) : (
                  <span
                    key={platform.name}
                    className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground/60"
                    title={`${platform.name} link not configured yet`}
                    aria-label={`${platform.name} link not configured yet`}
                  >
                    <platform.icon size={18} />
                  </span>
                )
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="min-w-0">
            <h4 className="font-display text-lg tracking-wider mb-4">QUICK LINKS</h4>
            <ul className="space-y-3">
              <li><Link to="/market" className="text-muted-foreground hover:text-primary text-sm transition-colors">Car Market</Link></li>
              <li><Link to="/services" className="text-muted-foreground hover:text-primary text-sm transition-colors">Our Services</Link></li>
              <li><Link to="/events" className="text-muted-foreground hover:text-primary text-sm transition-colors">Events & Blogs</Link></li>
              <li><Link to="/store" className="text-muted-foreground hover:text-primary text-sm transition-colors">Merch Store</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div className="min-w-0">
            <h4 className="font-display text-lg tracking-wider mb-4">SERVICES</h4>
            <ul className="space-y-3">
              <li><span className="text-muted-foreground text-sm">Performance Tuning</span></li>
              <li><span className="text-muted-foreground text-sm">Detailing & Wrap</span></li>
              <li><span className="text-muted-foreground text-sm">Maintenance</span></li>
              <li><span className="text-muted-foreground text-sm">Pre-Purchase Inspections</span></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="min-w-0">
            <h4 className="font-display text-lg tracking-wider mb-4">CONTACT US</h4>
            <ul className="space-y-4 text-muted-foreground text-sm">
              <li className="flex items-center gap-3">
                <MapPin size={16} className="text-primary flex-shrink-0" />
                <span className="break-words">{settings?.address || "Westlands, Nairobi, Kenya"}</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={16} className="text-primary flex-shrink-0" />
                <a href={`mailto:${settings?.supportEmail || "info@wheelsnationke.co.ke"}`} className="break-all hover:text-primary transition-colors">
                  {settings?.supportEmail || "info@wheelsnationke.co.ke"}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-primary flex-shrink-0" />
                <a href={`tel:${settings?.supportPhone || "+254700123456"}`} className="break-words hover:text-primary transition-colors">
                  {settings?.supportPhone || "+254 700 123 456"}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p className="break-words">© {new Date().getFullYear()} {settings?.companyName || "WheelsnationKe"}. All rights reserved. | Serving Kenya & East Africa</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
