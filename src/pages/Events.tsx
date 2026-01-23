import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ArrowRight, Clock, Users, Flame, Star, Zap } from "lucide-react";
import carEvent from "@/assets/car-event.jpg";

const events = [
  {
    id: 1,
    title: "MIDNIGHT CAR MEET",
    date: "Feb 15, 2024",
    time: "11:00 PM",
    location: "Nairobi Downtown Plaza",
    attendees: 250,
    type: "featured",
    image: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200&q=80",
    description: "The ultimate midnight gathering featuring supercars, JDM legends, and classic muscle. Experience the raw energy of Kenya's finest automotive collection under the city lights.",
  },
  {
    id: 2,
    title: "TRACK DAY EXPERIENCE",
    date: "Feb 22, 2024",
    time: "8:00 AM",
    location: "Kasarani Raceway",
    attendees: 100,
    type: "event",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
    description: "Push your limits on the track with professional instruction. Open lapping sessions for all skill levels.",
  },
  {
    id: 3,
    title: "SPRING RALLY 2024",
    date: "Mar 10, 2024",
    time: "6:00 AM",
    location: "Mount Kenya Route",
    attendees: 75,
    type: "event",
    image: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200&q=80",
    description: "Epic mountain rally through Kenya's most scenic roads. All skill levels welcome to this legendary drive.",
  },
  {
    id: 4,
    title: "SUPERCAR SATURDAY",
    date: "Mar 25, 2024",
    time: "2:00 PM",
    location: "Karen Country Club",
    attendees: 500,
    type: "event",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80",
    description: "The biggest supercar showcase in East Africa. Lamborghinis, Ferraris, McLarens, and more.",
  },
];

const blogs = [
  {
    id: 1,
    title: "THE RISE OF ELECTRIC SUPERCARS",
    category: "Industry",
    date: "Jan 28, 2024",
    readTime: "5 min read",
    image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=1200&q=80",
    excerpt: "How electric powertrains are redefining what we expect from high-performance vehicles. The future is now.",
    featured: true,
  },
  {
    id: 2,
    title: "JDM LEGENDS: THE GOLDEN ERA",
    category: "Culture",
    date: "Jan 25, 2024",
    readTime: "8 min read",
    image: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1200&q=80",
    excerpt: "A deep dive into the Japanese cars that shaped a generation of enthusiasts and still dominate today.",
    featured: false,
  },
  {
    id: 3,
    title: "DETAILING SECRETS FROM THE PROS",
    category: "Tips",
    date: "Jan 20, 2024",
    readTime: "6 min read",
    image: "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?w=1200&q=80",
    excerpt: "Professional detailers share their secrets for that perfect showroom finish at home.",
    featured: false,
  },
  {
    id: 4,
    title: "BUILDING YOUR FIRST TRACK CAR",
    category: "Guide",
    date: "Jan 15, 2024",
    readTime: "12 min read",
    image: "https://images.unsplash.com/photo-1494976388531-d1058494ceb8?w=1200&q=80",
    excerpt: "A comprehensive guide to building a track-ready car on a budget. Start your racing journey today.",
    featured: false,
  },
];

const Events = () => {
  const [activeSection, setActiveSection] = useState<"events" | "blogs">("events");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        {/* Hero Section - Full Impact */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center scale-110 animate-slow-zoom"
            style={{ backgroundImage: `url(${carEvent})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-accent/20" />
          </div>
          
          {/* Animated Particles Effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-primary/40 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${3 + Math.random() * 4}s`,
                }}
              />
            ))}
          </div>

          <div className="container relative z-10 mx-auto px-4 text-center">
            {/* Glowing Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/40 backdrop-blur-sm mb-8 animate-fade-in">
              <Flame className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary uppercase tracking-widest">Live Car Culture</span>
            </div>

            <h1 className="font-display text-6xl md:text-8xl lg:text-9xl tracking-wider animate-fade-in font-bold">
              EVENTS &
            </h1>
            <h1 className="font-display text-6xl md:text-8xl lg:text-9xl tracking-wider animate-fade-in text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary font-bold" style={{ animationDelay: "0.1s" }}>
              CULTURE
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mt-8 max-w-3xl mx-auto animate-fade-in leading-relaxed" style={{ animationDelay: "0.2s" }}>
              Where passion meets the road. Join Kenya's most exclusive automotive events and discover stories that ignite your drive.
            </p>

            {/* Toggle Buttons - Premium Style */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <Button
                variant={activeSection === "events" ? "hero" : "outline"}
                size="lg"
                onClick={() => setActiveSection("events")}
                className={`px-10 py-6 text-lg font-semibold ${activeSection === "events" ? "shadow-xl shadow-primary/30" : ""}`}
              >
                <Calendar className="w-5 h-5 mr-2" />
                Upcoming Events
              </Button>
              <Button
                variant={activeSection === "blogs" ? "hero" : "outline"}
                size="lg"
                onClick={() => setActiveSection("blogs")}
                className={`px-10 py-6 text-lg font-semibold ${activeSection === "blogs" ? "shadow-xl shadow-primary/30" : ""}`}
              >
                <Star className="w-5 h-5 mr-2" />
                Stories & Blog
              </Button>
            </div>

            {/* Stats Bar */}
            <div className="flex flex-wrap justify-center gap-8 mt-16 animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <div className="text-center px-6">
                <p className="font-display text-4xl md:text-5xl text-primary font-bold">50+</p>
                <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Events Yearly</p>
              </div>
              <div className="w-px h-16 bg-border hidden md:block" />
              <div className="text-center px-6">
                <p className="font-display text-4xl md:text-5xl text-primary font-bold">10K+</p>
                <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Community Members</p>
              </div>
              <div className="w-px h-16 bg-border hidden md:block" />
              <div className="text-center px-6">
                <p className="font-display text-4xl md:text-5xl text-primary font-bold">500+</p>
                <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Cars Featured</p>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-primary/50 rounded-full flex justify-center pt-2">
              <div className="w-1.5 h-3 bg-primary rounded-full animate-pulse" />
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-20 bg-gradient-to-b from-background to-card/50">
          <div className="container mx-auto px-4">
            {activeSection === "events" ? (
              <div className="space-y-16">
                {/* Featured Event - Hero Card */}
                {events.filter(e => e.type === "featured").map((event) => (
                  <div
                    key={event.id}
                    className="group relative rounded-3xl overflow-hidden animate-fade-in"
                  >
                    <div className="absolute inset-0">
                      <img
                        src={event.image}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
                    </div>
                    
                    <div className="relative z-10 p-10 md:p-16 min-h-[500px] flex flex-col justify-center max-w-2xl">
                      <Badge className="w-fit mb-6 bg-accent/90 text-accent-foreground border-0 px-4 py-2 text-sm font-bold uppercase tracking-wider animate-pulse">
                        <Zap className="w-4 h-4 mr-2" />
                        Featured Event
                      </Badge>
                      
                      <h2 className="font-display text-5xl md:text-7xl tracking-wider font-bold leading-tight">
                        {event.title}
                      </h2>
                      
                      <p className="text-xl text-muted-foreground mt-6 leading-relaxed">
                        {event.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-6 mt-8">
                        <div className="flex items-center gap-3 bg-background/50 backdrop-blur-sm px-4 py-2 rounded-lg">
                          <Calendar className="w-5 h-5 text-primary" />
                          <span className="font-semibold">{event.date}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-background/50 backdrop-blur-sm px-4 py-2 rounded-lg">
                          <Clock className="w-5 h-5 text-primary" />
                          <span className="font-semibold">{event.time}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-background/50 backdrop-blur-sm px-4 py-2 rounded-lg">
                          <MapPin className="w-5 h-5 text-primary" />
                          <span className="font-semibold">{event.location}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-background/50 backdrop-blur-sm px-4 py-2 rounded-lg">
                          <Users className="w-5 h-5 text-primary" />
                          <span className="font-semibold">{event.attendees}+ attending</span>
                        </div>
                      </div>
                      
                      <Button variant="hero" size="lg" className="w-fit mt-10 px-10 py-6 text-lg shadow-xl shadow-primary/30 group">
                        Register Now
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Other Events Grid */}
                <div>
                  <h3 className="font-display text-3xl md:text-4xl tracking-wider mb-10 text-center">
                    MORE <span className="text-primary">UPCOMING</span> EVENTS
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {events.filter(e => e.type !== "featured").map((event, index) => (
                      <div
                        key={event.id}
                        className="group bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 animate-fade-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="relative h-64 overflow-hidden">
                          <img
                            src={event.image}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                          <Badge className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm text-foreground border-0">
                            {event.date}
                          </Badge>
                        </div>
                        
                        <div className="p-6">
                          <h3 className="font-display text-2xl tracking-wider font-bold group-hover:text-primary transition-colors">
                            {event.title}
                          </h3>
                          <p className="text-muted-foreground mt-3 line-clamp-2">{event.description}</p>
                          
                          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-primary" />
                              <span>{event.location}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-primary" />
                              <span>{event.attendees}+</span>
                            </div>
                          </div>
                          
                          <Button variant="outline" className="w-full mt-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                            Learn More
                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-16">
                {/* Featured Blog Post */}
                {blogs.filter(b => b.featured).map((blog) => (
                  <div
                    key={blog.id}
                    className="group relative rounded-3xl overflow-hidden cursor-pointer animate-fade-in"
                  >
                    <div className="absolute inset-0">
                      <img
                        src={blog.image}
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
                    </div>
                    
                    <div className="relative z-10 p-10 md:p-16 min-h-[450px] flex flex-col justify-end">
                      <div className="flex items-center gap-4 mb-6">
                        <Badge className="bg-primary text-primary-foreground border-0 px-4 py-1 text-sm font-bold uppercase">
                          {blog.category}
                        </Badge>
                        <span className="text-muted-foreground">{blog.date}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{blog.readTime}</span>
                      </div>
                      
                      <h2 className="font-display text-4xl md:text-6xl tracking-wider font-bold leading-tight max-w-4xl group-hover:text-primary transition-colors">
                        {blog.title}
                      </h2>
                      
                      <p className="text-xl text-muted-foreground mt-6 max-w-2xl leading-relaxed">
                        {blog.excerpt}
                      </p>
                      
                      <div className="flex items-center gap-3 mt-8 text-primary font-semibold group-hover:gap-5 transition-all">
                        <span className="text-lg">Read Full Story</span>
                        <ArrowRight className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Blog Grid */}
                <div>
                  <h3 className="font-display text-3xl md:text-4xl tracking-wider mb-10 text-center">
                    LATEST <span className="text-primary">STORIES</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {blogs.filter(b => !b.featured).map((blog, index) => (
                      <div
                        key={blog.id}
                        className="group bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="relative h-56 overflow-hidden">
                          <img
                            src={blog.image}
                            alt={blog.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                          <Badge className="absolute top-4 left-4 bg-primary/90 text-primary-foreground border-0 text-xs uppercase font-bold">
                            {blog.category}
                          </Badge>
                        </div>
                        
                        <div className="p-6">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                            <span>{blog.date}</span>
                            <span>•</span>
                            <span>{blog.readTime}</span>
                          </div>
                          
                          <h3 className="font-display text-xl tracking-wider font-bold group-hover:text-primary transition-colors line-clamp-2">
                            {blog.title}
                          </h3>
                          
                          <p className="text-muted-foreground mt-3 text-sm line-clamp-3">{blog.excerpt}</p>
                          
                          <div className="flex items-center gap-2 mt-6 text-primary font-medium group-hover:gap-4 transition-all">
                            <span>Read More</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10" />
          <div className="container relative z-10 mx-auto px-4 text-center">
            <h2 className="font-display text-4xl md:text-5xl tracking-wider font-bold">
              NEVER MISS AN <span className="text-primary">EVENT</span>
            </h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-xl mx-auto">
              Subscribe to get exclusive updates on upcoming events, early registration access, and car culture content.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-6 py-4 rounded-xl bg-card border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <Button variant="hero" size="lg" className="px-8 shadow-xl shadow-primary/30">
                Subscribe
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Events;
