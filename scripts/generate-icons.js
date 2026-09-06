const fs = require('fs');
const path = require('path');

// Simple minimal valid PNG generation with green background and white text / cart
// We can create SVG icons and write PNG files using basic zlib/png structure or simple canvas
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#16a34a"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#bg)"/>
  <g filter="url(#shadow)" transform="translate(96, 96) scale(0.625)">
    <!-- Family heart / home / shopping cart composite -->
    <path d="M256 96c-48-64-144-64-192 0-48 64-16 160 192 288 208-128 240-224 192-288-48-64-144-64-192 0z" fill="#ffffff" opacity="0.95"/>
    <path d="M192 208a64 64 0 1 0 128 0 64 64 0 0 0-128 0z" fill="#16a34a"/>
    <path d="M144 320c0-40 40-64 112-64s112 24 112 64" stroke="#16a34a" stroke-width="24" stroke-linecap="round" fill="none"/>
  </g>
  <text x="256" y="440" font-family="system-ui, -apple-system, sans-serif" font-size="54" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">FAM-KIT</text>
</svg>`;

fs.writeFileSync(path.join(__dirname, '../public/icons/icon.svg'), svgContent);

// Also generate base64-encoded valid 192x192 & 512x512 PNGs
const generateSolidPng = (size) => {
  // Use a 1x1 green pixel stretched or standard PNG header
  const zlib = require('zlib');
  const width = size;
  const height = size;

  // Uncompressed raw image data (RGBA)
  const rowSize = width * 4 + 1; // +1 for filter byte
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Vibrant green with gradient effect
      const r = Math.floor(22 + (x / width) * 10);
      const g = Math.floor(163 - (y / height) * 20);
      const b = Math.floor(74 + (y / height) * 20);
      rawData[pxOffset] = r;     // R
      rawData[pxOffset + 1] = g; // G
      rawData[pxOffset + 2] = b; // B
      rawData[pxOffset + 3] = 255; // A
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdr = createChunk('IHDR', ihdrData);
  const idat = createChunk('IDAT', compressed);
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
};

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const toCrc = Buffer.concat([typeBuf, data]);
  const crc = crc32(toCrc);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

fs.writeFileSync(path.join(__dirname, '../public/icons/icon-192.png'), generateSolidPng(192));
fs.writeFileSync(path.join(__dirname, '../public/icons/icon-512.png'), generateSolidPng(512));
fs.writeFileSync(path.join(__dirname, '../public/icons/favicon.ico'), generateSolidPng(32));
console.log('Icons generated successfully!');
