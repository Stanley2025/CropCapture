import { NextResponse } from 'next/server';

export async function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="8" fill="#15803D"/>
  <path d="M16 6C16 6 12 11 12 16C12 19.5 14.5 22 16 26C17.5 22 20 19.5 20 16C20 11 16 6 16 6Z" fill="#DCFCE7"/>
  <path d="M16 11C16 11 10 13 8 18C10 19 13 18 16 15" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  <path d="M16 14C16 14 22 15 24 19C22 20.5 19 20 16 17" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" fill="none"/>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
