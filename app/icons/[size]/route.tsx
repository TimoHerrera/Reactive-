import { ImageResponse } from "next/og";
import { R_PATH, R_VIEWBOX } from "@/lib/brand";

// Íconos PWA (pantalla de inicio, Apple) generados en build con la «R» oficial.
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
  const width = Math.round(cfg.px * (1 - cfg.pad * 2));
  const height = Math.round((width * R_VIEWBOX.height) / R_VIEWBOX.width);
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
        <svg width={width} height={height} viewBox={`0 0 ${R_VIEWBOX.width} ${R_VIEWBOX.height}`}>
          <path fill="#FFFFFF" d={R_PATH} />
        </svg>
      </div>
    ),
    { width: cfg.px, height: cfg.px },
  );
}
