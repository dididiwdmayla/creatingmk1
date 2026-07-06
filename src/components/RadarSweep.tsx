export function RadarSweep({ size = 96 }: { size?: number }) {
  return (
    <div
      aria-hidden
      className="radar-sweep"
      style={{ width: size, height: size }}
    />
  );
}
