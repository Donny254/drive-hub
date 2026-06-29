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

    </div>
  );
}
