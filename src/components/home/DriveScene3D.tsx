import heroDashboard from "@/assets/hero-dashboard.jpg";

export default function DriveScene3D() {
  return (
    <div className="hero-image-shell smoky-image-shell absolute inset-0 overflow-hidden">
      <div
        className="hero-image-visual smoky-image-visual absolute inset-0 scale-110 bg-cover bg-center blur-[2px]"
        style={{ backgroundImage: `url(${heroDashboard})` }}
      />
      <div className="hero-scene-depth absolute inset-0" />
      <div className="hero-scene-vignette absolute inset-0" />
      {/* Strong dark fade at the bottom — matches the AboutSection smoky look */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/25 to-transparent dark:from-background/92 dark:via-background/8" />

    </div>
  );
}
