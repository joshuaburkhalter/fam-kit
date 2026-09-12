import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

// Clean, Simple Residential House Logo for Homebase:
// A friendly, modern house silhouette with a chimney and an arched doorway.
// Clean, unmistakable residential home, zero church/religious resemblance.
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Dark Gradient -->
    <linearGradient id="hbBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#090d16" />
    </linearGradient>

    <!-- Vibrant Emerald-to-Teal Gradient -->
    <linearGradient id="houseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="60%" stop-color="#14b8a6" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>

    <!-- Soft Glow Filter -->
    <filter id="hbGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#10b981" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Squircle Base -->
  <rect width="512" height="512" rx="120" fill="url(#hbBg)" />
  <rect x="16" y="16" width="480" height="480" rx="104" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4" />

  <!-- Simple, Modern House Silhouette -->
  <g id="simple-house" filter="url(#hbGlow)" transform="translate(0, 10)">
    <!-- Cute Chimney on right roof slope -->
    <rect x="330" y="130" width="44" height="75" rx="10" fill="url(#houseGrad)" />

    <!-- Main House Body with Pitched Roof -->
    <!-- Peak at (256, 110), eaves at (96, 235) and (416, 235), base at (136, 400) to (376, 400) -->
    <path
      d="M 244 118
         C 251 112, 261 112, 268 118
         L 412 230
         C 421 237, 418 250, 407 250
         L 374 250
         L 374 386
         C 374 398, 364 408, 352 408
         L 160 408
         C 148 408, 138 398, 138 386
         L 138 250
         L 105 250
         C 94 250, 91 237, 100 230
         Z"
      fill="url(#houseGrad)"
    />

    <!-- Cozy Welcoming Cut-Out Doorway -->
    <path
      d="M 218 408
         L 218 300
         C 218 276, 294 276, 294 300
         L 294 408
         Z"
      fill="#090d16"
    />

    <!-- Optional subtle warm doorknob dot -->
    <circle cx="280" cy="346" r="4.5" fill="#14b8a6" />
  </g>
</svg>`;

const outputSvgPath = path.resolve('public/icons/icon.svg');
fs.writeFileSync(outputSvgPath, svgContent);
console.log('Saved simple house SVG to:', outputSvgPath);

// Render to PNG 512 & 192
const resvg512 = new Resvg(svgContent, { fitTo: { mode: 'width', value: 512 } });
fs.writeFileSync(path.resolve('public/icons/icon-512.png'), resvg512.render().asPng());
console.log('Saved 512x512 PNG');

const resvg192 = new Resvg(svgContent, { fitTo: { mode: 'width', value: 192 } });
fs.writeFileSync(path.resolve('public/icons/icon-192.png'), resvg192.render().asPng());
console.log('Saved 192x192 PNG');
