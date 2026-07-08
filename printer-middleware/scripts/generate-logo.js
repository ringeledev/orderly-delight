// Genera printer-middleware/logo.png: un logo simple en vectores (texto + líneas),
// sin foto de fondo, optimizado para imprimirse nítido en impresoras térmicas.
const sharp = require("sharp");
const path = require("path");

const WIDTH = 384;
const HEIGHT = 190;

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="white"/>

  <!-- Línea decorativa superior -->
  <line x1="30" y1="18" x2="${WIDTH - 30}" y2="18" stroke="black" stroke-width="3"/>
  <line x1="30" y1="24" x2="${WIDTH - 30}" y2="24" stroke="black" stroke-width="1"/>

  <!-- Acentos triangulares (estilo "picante" simple, sin foto) -->
  <polygon points="${WIDTH / 2 - 14},34 ${WIDTH / 2},48 ${WIDTH / 2 + 14},34" fill="black"/>

  <!-- Texto principal -->
  <text x="50%" y="92" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-weight="bold"
        font-size="46" letter-spacing="4" fill="black">SAZÓN</text>
  <text x="50%" y="142" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-weight="bold"
        font-size="46" letter-spacing="6" fill="black">LATINO</text>

  <!-- Línea decorativa inferior -->
  <line x1="30" y1="160" x2="${WIDTH - 30}" y2="160" stroke="black" stroke-width="1"/>
  <line x1="30" y1="166" x2="${WIDTH - 30}" y2="166" stroke="black" stroke-width="3"/>

  <text x="50%" y="184" text-anchor="middle"
        font-family="Georgia, serif" font-size="14" letter-spacing="3" fill="black">COCINA LATINOAMERICANA</text>
</svg>
`;

const outPath = path.join(__dirname, "..", "logo.png");

sharp(Buffer.from(svg))
  .resize(WIDTH, HEIGHT)
  .flatten({ background: "#ffffff" })
  .png()
  .toFile(outPath)
  .then(() => console.log("Logo generado en:", outPath))
  .catch((err) => {
    console.error("Error generando logo:", err);
    process.exit(1);
  });
