interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function Logo({ size = 40, className = '', showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/logo.svg"
        alt="Lumnia Logo"
        width={size}
        height={size}
        className="shrink-0 rounded-lg"
      />
      {showText && (
        <span
          className="font-bold text-xl tracking-tight text-primary"
        >
          Lumnia
        </span>
      )}
    </div>
  );
}

/** Inline SVG as data URI for favicon/PWA icons */
export const LOGO_SVG_DATA_URI = `/logo.svg`;
