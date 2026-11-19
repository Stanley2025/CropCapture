import React from 'react';

interface LogoProps {
  className?: string;
  iconClassName?: string;
  showText?: boolean;
  light?: boolean;
}

export function CropCaptureLogo({
  className = 'flex items-center gap-3',
  iconClassName = 'h-9 w-9 text-[#15803D]',
  showText = true,
  light = false,
}: LogoProps) {
  return (
    <div className={className}>
      <div className="flex shrink-0 items-center justify-center">
        <svg
          className={iconClassName}
          viewBox="0 0 36 36"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Four Viewfinder corners */}
          <path d="M6 13V8a2 2 0 0 1 2-2h5" />
          <path d="M30 13V8a2 2 0 0 0-2-2h-5" />
          <path d="M6 23v5a2 2 0 0 0 2 2h5" />
          <path d="M30 23v5a2 2 0 0 1-2 2h-5" />
          {/* Sprout Plant in Center */}
          <path d="M18 26V15" strokeWidth="2.5" />
          <path
            d="M18 16c-3.2-3.2-6.5-1.5-6.5 2.5 3 1.5 6 0 6.5-2.5z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M18 19c3.2-3.2 6.5-1.5 6.5 2.5-3 1.5-6 0-6.5-2.5z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span
            className={`text-lg font-extrabold tracking-tight ${
              light ? 'text-white' : 'text-[#0E2417]'
            }`}
          >
            CropCapture
          </span>
          <span
            className={`text-[10px] font-semibold tracking-wider ${
              light ? 'text-[#86EFAC]/80' : 'text-[#15803D]'
            }`}
          >
            NATIONAL AGRICULTURAL PLATFORM
          </span>
        </div>
      )}
    </div>
  );
}
