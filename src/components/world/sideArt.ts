import { CanvasTexture, SRGBColorSpace } from "three";

/** One metre of panel is this many canvas pixels. */
const PX = 277;
/** The painted side panel: from the back (z = -2.35) to the windscreen (z = 1.35), y = 0.6 to 1.26. */
export const ART = { back: -2.35, front: 1.35, bottom: 0.6, top: 1.26 };
const W = Math.round((ART.front - ART.back) * PX);
const H = Math.round((ART.top - ART.bottom) * PX);

/**
 * The paint job on the jeepney's stainless sides: colour stripes, swirls and the name, like the hand-painted
 * art on a real jeepney. Drawn once on a canvas (no image file). The canvas holds two rows: the right side
 * (front at the left of the row) and the left side (front at the right), so the name sits behind the front
 * door on both sides and still reads the right way round. The rear wheel arch is left clear, so the stainless shows through around it.
 */
export function makeSideArt(rearAxle: number, archRadius: number, wheelY: number) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H * 2;
  const ctx = canvas.getContext("2d")!;
  const family = getComputedStyle(document.body).getPropertyValue("--font-fredoka").trim() || "sans-serif";

  const paintRow = (row: number) => {
    const flip = row === 1;
    ctx.save();
    ctx.translate(0, row * H);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.clearRect(0, 0, W, H);
    // u runs along the row (front to back, or back to front on the left side); v from the top (0) down.
    const u = (z: number) => (flip ? z - ART.back : ART.front - z) * PX;
    const v = (y: number) => (ART.top - y) * PX;
    const stripe = (color: string, y: number, h: number) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, v(y), W, h * PX);
    };
    stripe("#c41e30", 1.24, 0.09);
    stripe("#ffc93c", 1.15, 0.045);
    stripe("#1d4e89", 1.105, 0.035);
    // Swirls sweeping back from behind the door, in the three stripe colours.
    ctx.lineCap = "round";
    [["#1d4e89", 12, 0], ["#ffc93c", 7, 10], ["#c41e30", 5, 20]].forEach(([color, width, off]) => {
      ctx.strokeStyle = color as string;
      ctx.lineWidth = width as number;
      ctx.beginPath();
      const o = off as number;
      ctx.moveTo(u(0.55), v(0.75) - o * 0.4);
      ctx.bezierCurveTo(u(0.2), v(0.6) - o, u(-0.3), v(0.66) - o, u(-0.62), v(0.74) - o * 0.5);
      ctx.bezierCurveTo(u(-0.72), v(0.8), u(-0.62), v(0.9), u(-0.52), v(0.86) - o * 0.3);
      ctx.stroke();
    });
    // The name, in the page's display font: red with a yellow rim, as painted signwriting.
    ctx.font = `700 ${Math.round(0.24 * PX)}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#ffc93c";
    ctx.strokeText("Biyahe", u(-0.08), v(0.9));
    ctx.fillStyle = "#c41e30";
    ctx.fillText("Biyahe", u(-0.08), v(0.9));
    // Clear the rear wheel arch.
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(u(rearAxle), v(wheelY), archRadius * PX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const paint = () => {
    paintRow(0);
    paintRow(1);
    texture.needsUpdate = true;
  };
  paint();
  // Repaint once Fredoka has loaded, in case the first paint fell back to another font.
  document.fonts?.load(`700 66px ${family}`).then(paint, () => {});
  return texture;
}
