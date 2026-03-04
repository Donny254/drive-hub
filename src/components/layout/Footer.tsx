import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube, Phone, Mail, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer id="contact" className="bg-secondary border-t border-border">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <span className="font-display text-3xl text-primary tracking-wider">WheelsnationKe</span>
            <p className="mt-4 text-muted-foreground text-sm">
              Kenya's premier destination for performance cars and luxury SUVs. Buy, sell, rent, and experience automotive excellence across East Africa.
            </p>
            <div className="flex gap-4 mt-6">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook size={20} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram size={20} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter size={20} />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Youtube size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display text-lg tracking-wider mb-4">QUICK LINKS</h4>
            <ul className="space-y-3">
              <li><Link to="/market" className="text-muted-foreground hover:text-primary text-sm transition-colors">Car Market</Link></li>
              <li><Link to="/services" className="text-muted-foreground hover:text-primary text-sm transition-colors">Our Services</Link></li>
              <li><Link to="/events" className="text-muted-foreground hover:text-primary text-sm transition-colors">Events & Blogs</Link></li>
              <li><Link to="/store" className="text-muted-foreground hover:text-primary text-sm transition-colors">Merch Store</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display text-lg tracking-wider mb-4">SERVICES</h4>
            <ul className="space-y-3">
              <li><span className="text-muted-foreground text-sm">Performance Tuning</span></li>
              <li><span className="text-muted-foreground text-sm">Detailing & Wrap</span></li>
              <li><span className="text-muted-foreground text-sm">Maintenance</span></li>
              <li><span className="text-muted-foreground text-sm">Pre-Purchase Inspections</span></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-lg tracking-wider mb-4">CONTACT US</h4>
            <ul className="space-y-4 text-muted-foreground text-sm">
              <li className="flex items-center gap-3">
                <MapPin size={16} className="text-primary flex-shrink-0" />
                <span>Westlands, Nairobi, Kenya</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={16} className="text-primary flex-shrink-0" />
                <a href="mailto:info@wheelsnationke.co.ke" className="hover:text-primary transition-colors">
                  info@wheelsnationke.co.ke
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-primary flex-shrink-0" />
                <a href="tel:+254700123456" className="hover:text-primary transition-colors">
                  +254 700 123 456
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 text-center text-muted-foreground text-sm">
          <p>© 2024 WheelsnationKe. All rights reserved. | Serving Kenya & East Africa</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
