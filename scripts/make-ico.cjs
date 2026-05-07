// Generate build/icon.ico from build/icon.png (multi-resolution).
const fs = require('node:fs');
const path = require('node:path');
const pngToIco = require('png-to-ico').default;

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'build', 'icon.png');
const dest = path.join(root, 'build', 'icon.ico');

if (!fs.existsSync(src)) {
  console.error(`Source PNG not found: ${src}`);
  process.exit(1);
}

pngToIco(src)
  .then((buf) => {
    fs.writeFileSync(dest, buf);
    console.log(`Wrote ${dest} (${buf.length} bytes)`);
  })
  .catch((err) => {
    console.error('Failed to generate icon.ico:', err);
    process.exit(1);
  });
