import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#060a10",
          borderRadius: 6,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10.5" fill="none" stroke="#1a2530" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="7" fill="none" stroke="#1a2530" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3.5" fill="none" stroke="#1a2530" strokeWidth="1.5" />
          <path d="M12 12 L12 1.5 A10.5 10.5 0 0 1 21 7.5 Z" fill="#2ee6a6" opacity="0.9" />
          <circle cx="12" cy="12" r="1.6" fill="#2ee6a6" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
