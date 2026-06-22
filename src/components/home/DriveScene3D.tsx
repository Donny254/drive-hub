import heroDashboard from "@/assets/hero-dashboard.jpg";

export default function DriveScene3D() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center blur-[2px] brightness-[0.58] contrast-[0.9]"
        style={{ backgroundImage: `url(${heroDashboard})` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.06),transparent_18%),linear-gradient(to_right,rgba(4,8,12,0.88),rgba(4,8,12,0.2),transparent_55%),linear-gradient(to_bottom,rgba(4,8,12,0.92),rgba(4,8,12,0.22),rgba(4,8,12,0.78))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,8,12,0.96),rgba(4,8,12,0.12),rgba(4,8,12,0.5))]" />

    </div>
  );
}
