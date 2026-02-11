import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-6">
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
      <Link
        href="/"
        className="absolute left-5 top-5 z-10 flex items-center gap-1.5 text-sm text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
