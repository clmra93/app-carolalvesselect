import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, 'assets', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG template for Carol Alves PWA icon
const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5c1838"/>
      <stop offset="50%" stop-color="#461029"/>
      <stop offset="100%" stop-color="#2c0819"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fcedc0"/>
      <stop offset="50%" stop-color="#e5b869"/>
      <stop offset="100%" stop-color="#c4933f"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background Card / Circle -->
  <rect width="512" height="512" rx="110" fill="url(#bgGrad)"/>

  <!-- Decorative Inner Border -->
  <rect x="24" y="24" width="464" height="464" rx="90" fill="none" stroke="url(#goldGrad)" stroke-width="3" stroke-opacity="0.4"/>

  <!-- Centered Content -->
  <g filter="url(#shadow)">
    <!-- Diamond/Sparkle Icon -->
    <path d="M256 110 L285 170 L345 199 L285 228 L256 288 L227 228 L167 199 L227 170 Z" fill="url(#goldGrad)" />
    <path d="M360 110 L372 135 L397 147 L372 159 L360 184 L348 159 L323 147 L348 135 Z" fill="url(#goldGrad)" opacity="0.8"/>
    <path d="M150 280 L160 300 L180 310 L160 320 L150 340 L140 320 L120 310 L140 300 Z" fill="url(#goldGrad)" opacity="0.8"/>

    <!-- Monogram Text C A -->
    <text x="256" y="380" font-family="'Georgia', 'serif', 'Times New Roman'" font-weight="bold" font-size="78" fill="url(#goldGrad)" text-anchor="middle" letter-spacing="4">
      CAROL ALVES
    </text>
    
    <!-- Subtitle / Tagline -->
    <text x="256" y="420" font-family="'Arial', sans-serif" font-weight="500" font-size="22" fill="#fce4ec" text-anchor="middle" letter-spacing="6" opacity="0.9">
      CATÁLOGO &amp; LOJA
    </text>
  </g>
</svg>`;

const svgPath = path.join(iconsDir, 'icon.svg');
fs.writeFileSync(svgPath, svgContent);
console.log('Created icon.svg');

async function generatePngs() {
  const svgBuffer = Buffer.from(svgContent);

  // 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192.png'));
  console.log('Created icon-192.png');

  // 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512.png'));
  console.log('Created icon-512.png');

  // 180x180 (Apple Touch Icon)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // 32x32 (Favicon)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(iconsDir, 'favicon-32.png'));
  console.log('Created favicon-32.png');
}

generatePngs().then(() => {
  console.log('All icons generated successfully!');
}).catch((err) => {
  console.error('Error generating icons:', err);
});
