"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          fontFamily:
            "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
          color: "#fafafa",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480, padding: "0 24px" }}>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1,
              marginBottom: 16,
              filter: "grayscale(0.3)",
            }}
          >
            &#x1f4a5;
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}
          >
            Something broke
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#737373",
              margin: "0 0 24px",
              lineHeight: 1.6,
            }}
          >
            An unexpected error crashed the app.
            {error.digest && (
              <span style={{ display: "block", marginTop: 8 }}>
                <code
                  style={{
                    fontSize: 12,
                    background: "#1a1a1a",
                    padding: "2px 8px",
                    borderRadius: 4,
                    color: "#a3a3a3",
                  }}
                >
                  {error.digest}
                </code>
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#fafafa",
              color: "#0a0a0a",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
