import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// Simple BYD CRM icon as SVG
const createIconSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#1a1a2e" rx="${size * 0.125}"/>
  <text x="${size / 2}" y="${size * 0.52}" font-family="Arial, sans-serif" font-size="${size * 0.25}" font-weight="bold" fill="#ffffff" text-anchor="middle">BYD</text>
  <text x="${size / 2}" y="${size * 0.72}" font-family="Arial, sans-serif" font-size="${size * 0.1}" fill="#888888" text-anchor="middle">CRM</text>
</svg>
`

async function generateIcons() {
  console.log('Generating PWA icons...')

  // Generate 180x180 apple-touch-icon
  await sharp(Buffer.from(createIconSvg(180)))
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'))
  console.log('Created apple-touch-icon.png (180x180)')

  // Generate 192x192 icon
  await sharp(Buffer.from(createIconSvg(192)))
    .png()
    .toFile(join(publicDir, 'pwa-192x192.png'))
  console.log('Created pwa-192x192.png')

  // Generate 512x512 icon
  await sharp(Buffer.from(createIconSvg(512)))
    .png()
    .toFile(join(publicDir, 'pwa-512x512.png'))
  console.log('Created pwa-512x512.png')

  console.log('Done!')
}

generateIcons().catch(console.error)
