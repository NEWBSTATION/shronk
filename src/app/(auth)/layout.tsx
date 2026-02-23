import { AuthUserBadge, AuthBackToLanding } from "@/components/auth-user-badge";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 sm:px-6">
      {/* Dot grid background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />

      {/* Soft radial glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.03] blur-[120px]" />

      {/* Back to landing */}
      <div className="absolute left-3 top-3 sm:left-5 sm:top-5 z-10">
        <AuthBackToLanding />
      </div>

      {/* User menu */}
      <div className="absolute right-3 top-3 sm:right-5 sm:top-5 z-10">
        <AuthUserBadge />
      </div>

      <div className="relative z-10 w-full flex justify-center">{children}</div>
    </div>
  );
}
