import React from 'react';
import {
  LOGO_PATHS,
  LOGO_TONES,
  LOGO_WIDTH,
  LOGO_HEIGHT,
  LOGO_ICON_WIDTH,
} from '@/lib/brandLogo';

interface LogoProps {
  className?: string;
  /** "full" is the sprout with the FarmTori wordmark; "icon" is the sprout alone. */
  variant?: 'full' | 'icon';
  /** true when the logo sits on a dark background (white "Farm", lime "Tori"). */
  light?: boolean;
  /** Height in pixels; the width follows the logo's proportions. */
  height?: number;
  /** Optional line under the logo, e.g. "Admin console". */
  subtitle?: string;
}

/** The official FarmTori logo, drawn as vector paths so it is sharp at every size. */
export function FarmToriLogo({
  className = 'flex flex-col items-start gap-1',
  variant = 'full',
  light = false,
  height = 32,
  subtitle,
}: LogoProps) {
  const c = LOGO_TONES[light ? 'dark' : 'light'];
  const viewWidth = variant === 'icon' ? LOGO_ICON_WIDTH : LOGO_WIDTH;
  const width = Math.round((height * viewWidth) / LOGO_HEIGHT);

  return (
    <div className={className}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${viewWidth} ${LOGO_HEIGHT}`}
        role="img"
        aria-label="FarmTori"
        className="shrink-0"
      >
        <path d={LOGO_PATHS.stem} fill={c.stem} fillRule="evenodd" />
        <path d={LOGO_PATHS.leafL} fill={c.leafL} fillRule="evenodd" />
        <path d={LOGO_PATHS.leafR} fill={c.leafR} fillRule="evenodd" />
        {variant === 'full' && (
          <>
            <path d={LOGO_PATHS.farm} fill={c.farm} fillRule="evenodd" />
            <path d={LOGO_PATHS.tori} fill={c.tori} fillRule="evenodd" />
          </>
        )}
      </svg>
      {subtitle && (
        <span className={`text-[11px] font-medium leading-tight ${light ? 'text-[#8EA898]' : 'text-[#15803D]'}`}>
          {subtitle}
        </span>
      )}
    </div>
  );
}
