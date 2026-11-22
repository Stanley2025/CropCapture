'use client';

import React from 'react';

interface StatusToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}

/**
 * Modern iOS/neumorphic toggle switch matching the FarmTori design specification.
 * - Active (ON): Vibrant green track with right-aligned circular white knob.
 * - Disabled (OFF): Vibrant red track with left-aligned circular white knob.
 */
export function StatusToggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  ariaLabel = 'Toggle farmer status',
}: StatusToggleProps) {
  const dimensions = {
    sm: {
      track: 'h-6 w-11 p-0.5',
      thumb: 'h-5 w-5',
      activeTranslate: 'translate-x-5',
      inactiveTranslate: 'translate-x-0',
    },
    md: {
      track: 'h-8 w-16 p-1',
      thumb: 'h-6 w-6',
      activeTranslate: 'translate-x-8',
      inactiveTranslate: 'translate-x-0',
    },
    lg: {
      track: 'h-10 w-20 p-1.5',
      thumb: 'h-7 w-7',
      activeTranslate: 'translate-x-10',
      inactiveTranslate: 'translate-x-0',
    },
  }[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      disabled={disabled}
      className={`relative inline-flex ${dimensions.track} shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        checked
          ? 'bg-[#10B981] focus:ring-[#10B981]' // Vibrant green track from design
          : 'bg-[#EF4444] focus:ring-[#EF4444]' // Vibrant red track from design
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-95'}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block ${dimensions.thumb} transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
          checked ? dimensions.activeTranslate : dimensions.inactiveTranslate
        }`}
      />
    </button>
  );
}
