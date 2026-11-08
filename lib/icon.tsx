import { ImageResponse } from "next/og";

export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a, #1e3a8a)",
        }}
      >
        <div
          style={{
            width: size * 0.56,
            height: size * 0.4,
            borderRadius: size * 0.05,
            border: `${size * 0.035}px solid #38bdf8`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: `${size * 0.09}px solid transparent`,
              borderBottom: `${size * 0.09}px solid transparent`,
              borderLeft: `${size * 0.14}px solid #f8fafc`,
              marginLeft: size * 0.03,
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
