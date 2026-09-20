import type { Map as MLMap } from "maplibre-gl";

function drawIcon(draw: (ctx: CanvasRenderingContext2D, s: number) => void, size = 64) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  draw(ctx, size);
  return c;
}

function add(map: MLMap, name: string, canvas: HTMLCanvasElement) {
  if (map.hasImage(name)) map.removeImage(name);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  map.addImage(name, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: 2 });
}

export function registerMapIcons(map: MLMap) {
  add(
    map,
    "obj-shahed",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.fillStyle = "#E8EEF7";
      g.beginPath();
      g.moveTo(0, -14);
      g.lineTo(5, 2);
      g.lineTo(0, 12);
      g.lineTo(-5, 2);
      g.closePath();
      g.fill();
      g.strokeStyle = "#E0A100";
      g.lineWidth = 2;
      g.stroke();
    })
  );
  add(
    map,
    "obj-drone",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.strokeStyle = "#E8EEF7";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 5, 0, Math.PI * 2);
      g.stroke();
      for (const [x, y] of [
        [-11, -11],
        [11, -11],
        [-11, 11],
        [11, 11],
      ]) {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(x, y);
        g.stroke();
        g.beginPath();
        g.arc(x, y, 3.2, 0, Math.PI * 2);
        g.stroke();
      }
    })
  );
  add(
    map,
    "obj-cruise",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.fillStyle = "#E8EEF7";
      g.beginPath();
      g.moveTo(14, 0);
      g.lineTo(-8, -6);
      g.lineTo(-4, 0);
      g.lineTo(-8, 6);
      g.closePath();
      g.fill();
      g.fillRect(-12, -1.5, 8, 3);
    })
  );
  add(
    map,
    "obj-ballistic",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.fillStyle = "#D7263D";
      g.beginPath();
      g.moveTo(0, -16);
      g.lineTo(5, 10);
      g.lineTo(0, 6);
      g.lineTo(-5, 10);
      g.closePath();
      g.fill();
    })
  );
  add(
    map,
    "obj-aircraft",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.fillStyle = "#E8EEF7";
      plane(g);
    })
  );
  add(
    map,
    "obj-helicopter",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.strokeStyle = "#E8EEF7";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-12, -8);
      g.lineTo(12, -8);
      g.moveTo(0, -8);
      g.lineTo(0, 4);
      g.stroke();
      g.fillStyle = "#E8EEF7";
      g.fillRect(-6, 0, 12, 6);
    })
  );
  add(
    map,
    "obj-unknown",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.strokeStyle = "#9AA8B8";
      g.lineWidth = 2.2;
      g.beginPath();
      g.arc(0, 0, 10, 0, Math.PI * 2);
      g.stroke();
      g.font = "700 16px IBM Plex Sans, sans-serif";
      g.fillStyle = "#9AA8B8";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("?", 0, 1);
    })
  );
  add(
    map,
    "obj-mig31k",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.fillStyle = "#E8EEF7";
      plane(g);
      g.fillStyle = "#D7263D";
      g.beginPath();
      g.arc(8, 0, 3, 0, Math.PI * 2);
      g.fill();
    })
  );
  add(
    map,
    "adsb-civ",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.fillStyle = "#8FA0B3";
      plane(g);
    })
  );
  add(
    map,
    "adsb-mil",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.fillStyle = "#5B8CFF";
      plane(g);
    })
  );
  add(
    map,
    "cam-pin",
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.fillStyle = "#9AA8B8";
      g.beginPath();
      g.moveTo(0, 12);
      g.lineTo(8, 2);
      g.arc(0, -2, 8, 0.25, Math.PI - 0.25);
      g.closePath();
      g.fill();
      g.fillStyle = "#070B12";
      g.beginPath();
      g.arc(0, -2, 3.2, 0, Math.PI * 2);
      g.fill();
    }, 48)
  );
}

function plane(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(0, -12);
  g.lineTo(4, -2);
  g.lineTo(14, 2);
  g.lineTo(4, 2);
  g.lineTo(2, 10);
  g.lineTo(0, 7);
  g.lineTo(-2, 10);
  g.lineTo(-4, 2);
  g.lineTo(-14, 2);
  g.lineTo(-4, -2);
  g.closePath();
  g.fill();
}

export function iconForType(type: string) {
  if (type === "shahed") return "obj-shahed";
  if (type === "drone") return "obj-drone";
  if (type === "cruise") return "obj-cruise";
  if (type === "ballistic") return "obj-ballistic";
  if (type === "aircraft") return "obj-aircraft";
  if (type === "helicopter") return "obj-helicopter";
  if (type === "mig31k") return "obj-mig31k";
  return "obj-unknown";
}
