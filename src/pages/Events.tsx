import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import carEvent from "@/assets/car-event.jpg";

const events = [
  {
    id: 1,
    title: "Midnight Car Meet",
    date: "Feb 15, 2024",
    location: "Downtown Plaza",
    type: "event",
    image: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600",
    description: "Join us for our monthly midnight car meet featuring supercars, JDM legends, and classic muscle.",
  },
  {
    id: 2,
    title: "Track Day Experience",
    date: "Feb 22, 2024",
    location: "Velocity Raceway",
    type: "event",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600",
    description: "Experience the thrill of the track with professional instruction and open lapping sessions.",
  },
  {
    id: 3,
    title: "Spring Rally 2024",
    date: "Mar 10, 2024",
    location: "Mountain Pass Route",
    type: "event",
    image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600",
    description: "Our annual spring rally through scenic mountain roads. All skill levels welcome.",
  },
];

const blogs = [
  {
    id: 1,
    title: "The Rise of Electric Supercars",
    category: "Industry",
    date: "Jan 28, 2024",
    image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=600",
    excerpt: "How electric powertrains are redefining what we expect from high-performance vehicles.",
  },
  {
    id: 2,
    title: "JDM Legends: The Golden Era",
    category: "Culture",
    date: "Jan 25, 2024",
    image: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600",
    excerpt: "A deep dive into the Japanese cars that shaped a generation of enthusiasts.",
  },
  {
    id: 3,
    title: "Detailing Tips from the Pros",
    category: "Tips",
    date: "Jan 20, 2024",
    image: "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?w=600",
    excerpt: "Professional detailers share their secrets for that showroom finish at home.",
  },
  {
    id: 4,
    title: "Building Your First Track Car",
    category: "Guide",
    date: "Jan 15, 2024",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600",
    excerpt: "A comprehensive guide to building a track-ready car on a budget.",
  },
];

const Events = () => {
  const [activeSection, setActiveSection] = useState<"events" | "blogs">("events");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${carEvent})` }}
          >
            <div className="absolute inset-0 bg-background/85" />
          </div>
          <div className="container relative z-10 mx-auto px-4 text-center">
            <h1 className="font-display text-5xl md:text-6xl tracking-wider animate-fade-in">
              EVENTS & <span className="text-primary">CULTURE</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Stay connected with the car community. Events, meets, and stories that fuel our passion.
            </p>

            {/* Toggle */}
            <div className="flex justify-center gap-4 mt-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <Button
                variant={activeSection === "events" ? "hero" : "secondary"}
                size="lg"
                onClick={() => setActiveSection("events")}
              >
                Upcoming Events
              </Button>
              <Button
                variant={activeSection === "blogs" ? "hero" : "secondary"}
                size="lg"
                onClick={() => setActiveSection("blogs")}
              >
                Blog & Stories
              </Button>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            {activeSection === "events" ? (
              <div className="space-y-8">
                {events.map((event, index) => (
                  <div
                    key={event.id}
                    className="group flex flex-col md:flex-row bg-card rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-all duration-500 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="md:w-1/3 h-64 md:h-auto overflow-hidden">
                      <img
                        src={event.image}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div className="flex-1 p-8 flex flex-col justify-center">
                      <Badge className="w-fit mb-4 bg-primary/10 text-primary border-primary/20">
                        Upcoming Event
                      </Badge>
                      <h3 className="font-display text-3xl tracking-wider">{event.title}</h3>
                      <p className="text-muted-foreground mt-3">{event.description}</p>
                      <div className="flex flex-wrap gap-6 mt-6">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar size={18} />
                          <span>{event.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin size={18} />
                          <span>{event.location}</span>
                        </div>
                      </div>
                      <Button variant="hero" size="lg" className="w-fit mt-8">
                        Register Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {blogs.map((blog, index) => (
                  <div
                    key={blog.id}
                    className="group bg-card rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-all duration-500 animate-fade-in cursor-pointer"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="h-56 overflow-hidden">
                      <img
                        src={blog.image}
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-4 mb-3">
                        <Badge variant="outline" className="text-xs">
                          {blog.category}
                        </Badge>
                        <span className="text-muted-foreground text-sm">{blog.date}</span>
                      </div>
                      <h3 className="font-display text-2xl tracking-wider">{blog.title}</h3>
                      <p className="text-muted-foreground mt-3 text-sm">{blog.excerpt}</p>
                      <div className="flex items-center gap-2 mt-6 text-primary group-hover:gap-4 transition-all">
                        <span className="text-sm font-medium">Read More</span>
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Events;
