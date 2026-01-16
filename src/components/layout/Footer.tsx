import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-secondary border-t border-border">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <span className="font-display text-3xl text-primary tracking-wider">VELOCITY</span>
            <p className="mt-4 text-muted-foreground text-sm">
              Your ultimate destination for automotive excellence. Buy, sell, service, and celebrate car culture.
            </p>
            <div className="flex gap-4 mt-6">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
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
              <li><span className="text-muted-foreground text-sm">Inspections</span></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-lg tracking-wider mb-4">CONTACT</h4>
            <ul className="space-y-3 text-muted-foreground text-sm">
              <li>123 Velocity Lane</li>
              <li>Speed City, SC 12345</li>
              <li>contact@velocity.com</li>
              <li>+1 (555) 123-4567</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 text-center text-muted-foreground text-sm">
          <p>© 2024 Velocity. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
