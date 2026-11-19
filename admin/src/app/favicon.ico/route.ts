import { NextResponse } from 'next/server';

export async function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36" fill="none" stroke="#15803D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <rect width="36" height="36" rx="8" fill="#0E2417" stroke="none"/>
  <path d="M6 13V8a2 2 0 0 1 2-2h5" stroke="#A3E635"/>
  <path d="M30 13V8a2 2 0 0 0-2-2h-5" stroke="#A3E635"/>
  <path d="M6 23v5a2 2 0 0 0 2 2h5" stroke="#A3E635"/>
  <path d="M30 23v5a2 2 0 0 1-2 2h-5" stroke="#A3E635"/>
  <path d="M18 26V15" stroke="#A3E635" stroke-width="2.5"/>
  <path d="M18 16c-3.2-3.2-6.5-1.5-6.5 2.5 3 1.5 6 0 6.5-2.5z" fill="#A3E635" stroke="#A3E635" stroke-width="1.5"/>
  <path d="M18 19c3.2-3.2 6.5-1.5 6.5 2.5-3 1.5-6 0-6.5-2.5z" fill="#A3E635" stroke="#A3E635" stroke-width="1.5"/>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
