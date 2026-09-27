/* eslint-disable @next/next/no-img-element -- crests are remote SVG/PNGs from football-data */

export function Crest({ src, name, size = 28 }: { src?: string | null; name: string; size?: number }) {
  if (!src) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-surface-muted text-[10px] font-semibold text-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {name.slice(0, 3).toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}
