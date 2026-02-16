const fs = require("fs");

function makeSVG(size) {
  const p = size / 24;
  const rx = Math.round(size * 0.2);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      size +
      '" height="' +
      size +
      '" viewBox="0 0 ' +
      size +
      " " +
      size +
      '">',
    "  <defs>",
    '    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">',
    '      <stop offset="0%" style="stop-color:#8b5cf6"/>',
    '      <stop offset="100%" style="stop-color:#6d28d9"/>',
    "    </linearGradient>",
    "  </defs>",
    '  <rect width="' +
      size +
      '" height="' +
      size +
      '" rx="' +
      rx +
      '" fill="url(#g)"/>',
    '  <g transform="scale(' +
      p.toFixed(4) +
      ')" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    '    <path d="M20 3v4"/>',
    '    <path d="M22 5h-4"/>',
    "  </g>",
    "</svg>",
  ];
  return lines.join("\n");
}

for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(__dirname + "/icon-" + size + ".svg", makeSVG(size));
}
console.log("SVGs generated");
