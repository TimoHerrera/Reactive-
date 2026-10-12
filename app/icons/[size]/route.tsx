import { ImageResponse } from "next/og";

// Íconos PWA generados en build con la «R» (placeholder hasta tener el SVG oficial).
const SIZES: Record<string, { px: number; pad: number }> = {
  "192": { px: 192, pad: 0.2 },
  "512": { px: 512, pad: 0.2 },
  maskable: { px: 512, pad: 0.3 },
  apple: { px: 180, pad: 0.2 },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const cfg = SIZES[size] ?? SIZES["192"]!;
  const inner = Math.round(cfg.px * (1 - cfg.pad * 2));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
        }}
      >
        <svg width={inner} height={Math.round(inner * 1.1)} viewBox="0 0 100 110">
          <path
            fill="#FFFFFF"
            fillRule="evenodd"
            d="M0 0H62C84 0 96 13 96 33C96 48 88 58 75 62L100 110H69L48 67H29V110H0Z M29 23V45H59C67 45 70 40 70 34C70 28 67 23 59 23Z"
          />
          <polygon points="-4,88 104,56 104,65 -4,97" fill="#0A0A0A" />
        </svg>
      </div>
    ),
    { width: cfg.px, height: cfg.px },
  );
}
