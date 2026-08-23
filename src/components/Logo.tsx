interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function Logo({ size = 40, className = '', showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/brand-icon.png"
        alt="Lumnia Logo"
        width={size}
        height={size}
        className="shrink-0 rounded-lg"
      />
      {showText && (
        <>
          <img src="/brand-logo-black.svg" alt="Lumnia" className="h-6 w-auto dark:hidden" />
          <img src="/brand-logo-white.svg" alt="Lumnia" className="hidden h-6 w-auto dark:block" />
        </>
      )}
    </div>
  );
}

export const LOGO_SVG_DATA_URI = `/brand-icon.png`;
