import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * The jeepney's route sign: the stop name painted onto a small canvas that the 3D boards use as a
 * texture. No font file is fetched: it uses Fredoka, which next/font already serves for the page.
 * `show()` only repaints when the name changes, so calling it every frame is free.
 */
export function makeRouteSign() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 80;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4; // stays readable when seen at an angle
  // next/font gives the family a generated name; the page exposes it as a CSS variable.
  const family = getComputedStyle(document.body).getPropertyValue("--font-fredoka").trim() || "sans-serif";
  let text = "";

  const paint = () => {
    const { width: w, height: h } = canvas;
    ctx.fillStyle = "#ffc93c";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#1d2433";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    // Largest size that fits inside the border.
    let size = 66;
    do ctx.font = `600 ${size--}px ${family}`;
    while (ctx.measureText(text).width > w - 36 && size > 20);
    ctx.fillStyle = "#c41e30";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 3);
    texture.needsUpdate = true;
  };

  // Repaint once Fredoka has loaded, in case the first paint fell back to another font.
  document.fonts?.load(`600 66px ${family}`).then(paint, () => {});

  return {
    texture,
    show(next: string) {
      if (next === text) return;
      text = next;
      paint();
    },
  };
}
