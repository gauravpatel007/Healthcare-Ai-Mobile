const fs = require('fs');
const path = require('path');

// Verify cardiogram.png exists
const srcPath = path.resolve(__dirname, 'dist', 'cardiogram.png');
const publicPath = path.resolve(__dirname, 'public', 'cardiogram.png');

console.log('Checking source icon:', srcPath);
if (!fs.existsSync(srcPath)) {
  console.error('Source file not found!');
  process.exit(1);
}

// Copy to public as well
fs.copyFileSync(srcPath, publicPath);
console.log('Copied to public/cardiogram.png');
