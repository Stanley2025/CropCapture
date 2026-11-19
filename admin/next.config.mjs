import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure Turbopack development directory (.next/dev) has required-server-files.json
// to prevent ENOENT errors during compilation
try {
  const distDir = path.join(__dirname, '.next');
  const devDir = path.join(distDir, 'dev');
  const rootRequired = path.join(distDir, 'required-server-files.json');
  const devRequired = path.join(devDir, 'required-server-files.json');

  if (fs.existsSync(rootRequired)) {
    if (!fs.existsSync(devDir)) {
      fs.mkdirSync(devDir, { recursive: true });
    }
    fs.copyFileSync(rootRequired, devRequired);
  } else {
    if (!fs.existsSync(devDir)) {
      fs.mkdirSync(devDir, { recursive: true });
    }
    if (!fs.existsSync(devRequired)) {
      fs.writeFileSync(
        devRequired,
        JSON.stringify({
          version: 1,
          config: {},
          appDir: __dirname,
          relativeAppDir: '',
          files: [],
          ignore: [],
        }),
        'utf8'
      );
    }
  }
} catch (e) {
  // Ignore filesystem race conditions
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
