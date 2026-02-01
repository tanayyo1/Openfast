import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const bg = "#F8F2EA";
const fg = "#2E261E";
const accent = "#E3552B";

export const MainVideo: React.FC<{
  headline: string;
  subhead: string;
}> = ({ headline, subhead }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = interpolate(frame, [0, fps * 0.6], [16, 0], {
    extrapolateRight: "clamp",
  });
  const alpha = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const pulse = interpolate(
    frame,
    [0, fps * 1.2, fps * 2.4, fps * 3.6, fps * 5],
    [0.18, 0.28, 0.2, 0.26, 0.18],
    {
      extrapolateRight: "clamp",
    },
  );

  const outro = interpolate(
    frame,
    [durationInFrames - fps * 0.6, durationInFrames],
    [0, 10],
    { extrapolateLeft: "clamp" },
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: bg,
        color: fg,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 88,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -180,
          background:
            "radial-gradient(circle at 20% 20%, rgba(227,85,43,0.26), transparent 45%), radial-gradient(circle at 80% 10%, rgba(66,169,150,0.18), transparent 45%), radial-gradient(circle at 80% 80%, rgba(255,200,140,0.24), transparent 50%)",
          opacity: pulse,
          transform: `translateY(${-outro}px)`,
        }}
      />
      <div style={{ position: "relative", width: "100%" }}>
        <div
          style={{
            maxWidth: 820,
            margin: "0 auto",
            opacity: alpha,
            transform: `translateY(${enter}px)`,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 999,
              background: "rgba(46,38,30,0.06)",
              border: "1px solid rgba(46,38,30,0.10)",
              fontSize: 18,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: accent,
                boxShadow: "0 0 0 6px rgba(227,85,43,0.18)",
              }}
            />
            ReditFast
          </div>
          <h1
            style={{
              marginTop: 26,
              fontSize: 78,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              fontWeight: 800,
            }}
          >
            {headline}
          </h1>
          <p
            style={{
              marginTop: 18,
              fontSize: 28,
              lineHeight: 1.25,
              color: "rgba(46,38,30,0.78)",
              maxWidth: 720,
            }}
          >
            {subhead}
          </p>
        </div>
      </div>
    </div>
  );
};
