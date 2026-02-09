// Generate a simple placeholder tileset PNG using Canvas
import fs from 'fs';
import { createCanvas } from 'canvas';

const tileSize = 32;
const cols = 4;
const rows = 2;
const width = tileSize * cols;  // 128
const height = tileSize * rows; // 64

const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Define tile colors
const tiles = [
  { r: 0, g: 0, b: 0, a: 0 },       // 0: Transparent
  { r: 34, g: 102, b: 34, a: 255 }, // 1: Dark green (ground)
  { r: 85, g: 85, b: 85, a: 255 },  // 2: Gray (wall)
  { r: 51, g: 119, b: 51, a: 255 }, // 3: Light green
  { r: 68, g: 68, b: 68, a: 255 },  // 4: Dark gray
  { r: 102, g: 102, b: 102, a: 255 }, // 5: Light gray
  { r: 17, g: 85, b: 17, a: 255 },  // 6: Very dark green
  { r: 119, g: 119, b: 119, a: 255 } // 7: Very light gray
];

// Draw tiles
for (let i = 0; i < tiles.length; i++) {
  const x = (i % cols) * tileSize;
  const y = Math.floor(i / cols) * tileSize;
  const tile = tiles[i];

  if (tile.a > 0) {
    ctx.fillStyle = `rgba(${tile.r}, ${tile.g}, ${tile.b}, ${tile.a / 255})`;
    ctx.fillRect(x, y, tileSize, tileSize);

    // Add a subtle border to make tiles visible
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, tileSize, tileSize);
  }
}

// Save to file
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('/Users/jonasbrandvik/Projects/banger-game/client/public/tilesets/placeholder.png', buffer);
console.log('Placeholder tileset generated successfully!');
