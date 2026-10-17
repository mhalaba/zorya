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


/**
 * Ukraine threat icons (own engine / MAPA.UA), pointing up = north and rotated by heading on the map.
 * Silhouettes and palette follow mapa.ua: Shahed delta (amber), jet Shahed with swept wings and twin fins
 * (orange), S8000 "Бандероль" with straight wings (magenta), cruise missile (violet), ballistic (teal),
 * guided bomb / KAB (red). A dark halo keeps them readable over red alert fills. "-dead" = lost / shot down.
 */
export const UA_COLORS: Record<string, string> = {
  drone: "#FBBF24",
  jet: "#F97316",
  banderol: "#D946EF",
  cruise: "#A78BFA",
  ballistic: "#5EEAD4",
  bomb: "#EF4444",
};
const UA_DEAD = "#8A909C";
export const UA_SHAPES: Record<string, string[]> = {
  drone: ["M50 6 C54 6 56 12 56 20 L56 34 L90 70 L90 79 L56 74 L56 86 L44 86 L44 74 L10 79 L10 70 L44 34 L44 20 C44 12 46 6 50 6 Z"],
  jet: ["M50 4 L58 30 L92 78 L92 85 L57 77 L55 92 L45 92 L43 77 L8 85 L8 78 L42 30 Z", "M37 69 L32 94 L40 94 L44 74 Z", "M63 69 L68 94 L60 94 L56 74 Z"],
  banderol: [
    "M50 6 C45 6 42 14 42 24 L42 84 L58 84 L58 24 C58 14 55 6 50 6 Z",
    "M42 40 L8 44 L8 54 L42 58 Z",
    "M58 40 L92 44 L92 54 L58 58 Z",
    "M42 68 L25 70 L25 78 L42 81 Z",
    "M58 68 L75 70 L75 78 L58 81 Z",
  ],
  cruise: ["M50 3 C46 3 43 13 43 25 L43 64 L31 78 L31 91 L50 83 L69 91 L69 78 L57 64 L57 25 C57 13 54 3 50 3 Z", "M43 38 L26 50 L26 57 L43 52 Z", "M57 38 L74 50 L74 57 L57 52 Z"],
  ballistic: ["M50 2 C44 9 42 17 42 25 L42 74 L31 93 L50 86 L69 93 L58 74 L58 25 C58 17 56 9 50 2 Z"],
  bomb: ["M37 72 L37 24 C37 7 63 7 63 24 L63 72 Z", "M14 94 L50 76 L86 94 L64 72 L36 72 Z"],
};

function registerUaThreatIcons(map: MLMap) {
  const S = 96;
  for (const [type, paths] of Object.entries(UA_SHAPES)) {
    for (const dead of [false, true]) {
      add(
        map,
        `mua-${type}${dead ? "-dead" : ""}`,
        drawIcon((g, s) => {
          const k = (s - 8) / 100;
          g.translate(4, 4);
          g.scale(k, k);
          const ps = paths.map((d) => new Path2D(d));
          g.lineJoin = "round";
          g.strokeStyle = "rgba(7,11,18,0.92)";
          g.lineWidth = 9;
          for (const p of ps) g.stroke(p);
          g.fillStyle = dead ? UA_DEAD : UA_COLORS[type];
          for (const p of ps) g.fill(p);
          if (!dead) {
            g.strokeStyle = "rgba(255,255,255,0.35)";
            g.lineWidth = 1.5;
            for (const p of ps) g.stroke(p);
          }
        }, S)
      );
    }
  }
}

/** Local alerts: round badges (power = bolt, water = drop, gas = flame, exercise = crosshair). */
function registerLocalIcons(map: MLMap) {
  const badge = (fill: string, glyph: (g: CanvasRenderingContext2D) => void) =>
    drawIcon((g, s) => {
      g.translate(s / 2, s / 2);
      g.beginPath();
      g.arc(0, 0, 24, 0, Math.PI * 2);
      g.fillStyle = fill;
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = "#070B12";
      g.stroke();
      glyph(g);
    });
  add(
    map,
    "loc-power",
    badge("#F2C14E", (g) => {
      g.fillStyle = "#070B12";
      g.beginPath();
      g.moveTo(3, -16);
      g.lineTo(-9, 3);
      g.lineTo(-1, 3);
      g.lineTo(-4, 16);
      g.lineTo(9, -4);
      g.lineTo(1, -4);
      g.closePath();
      g.fill();
    })
  );
  add(
    map,
    "loc-water",
    badge("#4FA3E0", (g) => {
      g.fillStyle = "#FFFFFF";
      g.beginPath();
      g.moveTo(0, -15);
      g.bezierCurveTo(8, -4, 11, 2, 11, 6);
      g.arc(0, 6, 11, 0, Math.PI);
      g.bezierCurveTo(-11, 2, -8, -4, 0, -15);
      g.fill();
    })
  );
  add(
    map,
    "loc-gas",
    badge("#F0783A", (g) => {
      g.fillStyle = "#FFFFFF";
      g.beginPath();
      g.moveTo(0, -16);
      g.bezierCurveTo(10, -6, 12, 4, 7, 11);
      g.bezierCurveTo(4, 15, -4, 15, -7, 11);
      g.bezierCurveTo(-11, 5, -6, -2, -2, -6);
      g.bezierCurveTo(-2, 0, 1, 2, 3, 2);
      g.bezierCurveTo(3, -4, 2, -10, 0, -16);
      g.fill();
    })
  );
  add(
    map,
    "loc-exercise",
    badge("#B48CF0", (g) => {
      g.strokeStyle = "#FFFFFF";
      g.lineWidth = 3.5;
      g.beginPath();
      g.arc(0, 0, 10, 0, Math.PI * 2);
      g.moveTo(0, -17);
      g.lineTo(0, -5);
      g.moveTo(0, 5);
      g.lineTo(0, 17);
      g.moveTo(-17, 0);
      g.lineTo(-5, 0);
      g.moveTo(5, 0);
      g.lineTo(17, 0);
      g.stroke();
    })
  );
  add(
    map,
    "loc-meteo",
    badge("#7DD3FC", (g) => {
      // Cloud with a lightning bolt.
      g.fillStyle = "#070B12";
      g.beginPath();
      g.arc(-6, -2, 7, Math.PI * 0.5, Math.PI * 1.5);
      g.arc(1, -7, 8, Math.PI, Math.PI * 1.9);
      g.arc(8, -1, 6, Math.PI * 1.4, Math.PI * 0.5);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(1, 3);
      g.lineTo(-4, 12);
      g.lineTo(0, 12);
      g.lineTo(-2, 18);
      g.lineTo(5, 9);
      g.lineTo(1, 9);
      g.lineTo(4, 3);
      g.closePath();
      g.fill();
    })
  );
  add(
    map,
    "loc-hydro",
    badge("#2E7BD6", (g) => {
      // Waves.
      g.strokeStyle = "#FFFFFF";
      g.lineWidth = 3.5;
      g.lineCap = "round";
      for (const y of [-7, 1, 9]) {
        g.beginPath();
        g.moveTo(-14, y);
        g.bezierCurveTo(-9, y - 5, -5, y - 5, 0, y);
        g.bezierCurveTo(5, y + 5, 9, y + 5, 14, y);
        g.stroke();
      }
    })
  );
}

export function registerMapIcons(map: MLMap) {
  registerUaThreatIcons(map);
  registerLocalIcons(map);
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
