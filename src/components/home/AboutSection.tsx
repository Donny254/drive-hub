import carInterior from "@/assets/car-interior.jpg";

const stats = [
  { value: "500+", label: "Cars Sold" },
  { value: "10K+", label: "Happy Clients" },
  { value: "50+", label: "Events Hosted" },
  { value: "15+", label: "Years Experience" },
];

const AboutSection = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Image */}
          <div className="relative animate-fade-in">
            <div className="relative rounded-lg overflow-hidden">
              <img
                src={carInterior}
                alt="Luxury car interior"
                className="w-full h-[400px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            </div>
            {/* Floating Stats Card */}
            <div className="absolute -bottom-8 -right-4 md:right-8 bg-card border border-border rounded-lg p-6 shadow-[0_10px_40px_hsl(0_0%_0%_/_0.5)] animate-float">
              <div className="text-center">
                <span className="font-display text-4xl text-primary">15+</span>
                <p className="text-sm text-muted-foreground mt-1">Years of Excellence</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <h2 className="font-display text-4xl md:text-5xl tracking-wider">
              BUILT FOR <span className="text-primary">CAR LOVERS</span>
            </h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Velocity was born from a deep passion for automotive culture. We're not just a platform — we're a community of enthusiasts who live and breathe cars. From finding your dream ride to keeping it in perfect condition, we're with you every mile.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Whether you're a weekend warrior, a track day regular, or simply appreciate fine engineering, Velocity is your home. Join thousands of fellow enthusiasts who trust us for their automotive needs.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center md:text-left">
                  <span className="font-display text-3xl text-primary">{stat.value}</span>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
