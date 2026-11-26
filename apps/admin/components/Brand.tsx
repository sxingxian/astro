export function Brand({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <svg width={size - 2} height={size - 2} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z" fill="none" stroke="#D8B46A" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span className="serif font-semibold" style={{ fontSize: size }}>Astro</span>
    </span>
  );
}
