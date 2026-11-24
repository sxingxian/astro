/** Deterministic SVG starfield: the no-JS / no-WebGL / LCP layer behind the hero. */
function stars(count: number, seed: number) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: count }, () => ({
    x: Math.round(rnd() * 1440),
    y: Math.round(rnd() * 900),
    r: +(rnd() * 1.3 + 0.3).toFixed(2),
    o: +(rnd() * 0.6 + 0.12).toFixed(2)
  }));
}

const STARS = stars(180, 23);

export function StaticSky() {
  return (
    <svg aria-hidden="true" data-static-sky viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      {STARS.map((star, i) => (
        <circle key={i} cx={star.x} cy={star.y} r={star.r} fill="#EDE6D6" opacity={star.o} />
      ))}
    </svg>
  );
}
