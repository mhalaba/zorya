#!/usr/bin/env python3
"""Build the Terra Incognita cartographic mark and rasterize PWA icons."""

from __future__ import annotations

import math
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"

PERGAMIN = "#E8D8C8"
ATRAMENT = "#564033"
RDZA = "#AF593C"
NIGHT = "#070B12"


def fmt(n: float) -> str:
    s = f"{n:.2f}".rstrip("0").rstrip(".")
    return s


def tangent_from_point(px: float, py: float, cx: float, cy: float, r: float) -> tuple[float, float]:
    """Outer tangent point on the circle as seen from (px, py)."""
    a0 = math.atan2(py - cy, px - cx)
    d = math.hypot(px - cx, py - cy)
    delta = math.acos(max(-1, min(1, r / d)))
    p1 = (cx + r * math.cos(a0 + delta), cy + r * math.sin(a0 + delta))
    p2 = (cx + r * math.cos(a0 - delta), cy + r * math.sin(a0 - delta))
    if cx < 50:
        return p1 if p1[0] < p2[0] else p2
    return p1 if p1[0] > p2[0] else p2


def radial_tick(deg_from_north: float, r0: float, r1: float) -> str:
    a = math.radians(deg_from_north)
    x0 = 50 + r0 * math.sin(a)
    y0 = 50 - r0 * math.cos(a)
    x1 = 50 + r1 * math.sin(a)
    y1 = 50 - r1 * math.cos(a)
    return f"M{fmt(x0)} {fmt(y0)} L{fmt(x1)} {fmt(y1)}"


def eye_hole(cx: float, cy: float, r: float) -> str:
    return (
        f"M{fmt(cx - r)} {fmt(cy)} "
        f"a{fmt(r)} {fmt(r)} 0 1 1 {fmt(2 * r)} 0 "
        f"a{fmt(r)} {fmt(r)} 0 1 1 {fmt(-2 * r)} 0"
    )


def bird_path() -> str:
    # Two overlapping cranium circles on the horizontal line, then a south spike.
    r = 6.85
    ly, ry = 45.65, 54.35
    cy = 50 + r
    tip = (50.0, 87.4)
    lt = tangent_from_point(tip[0], tip[1], ly, cy, r)
    rt = tangent_from_point(tip[0], tip[1], ry, cy, r)
    dx = 50 - ly
    valley = (50.0, cy - math.sqrt(max(0, r * r - dx * dx)))
    left_top = (ly, 50.0)
    right_top = (ry, 50.0)

    def arc(r_, p_to, sweep: int) -> str:
        return f"A{fmt(r_)} {fmt(r_)} 0 0 {sweep} {fmt(p_to[0])} {fmt(p_to[1])}"

    parts = [
        f"M{fmt(tip[0])} {fmt(tip[1])}",
        f"L{fmt(lt[0])} {fmt(lt[1])}",
        arc(r, left_top, 0),
        arc(r, valley, 1),
        arc(r, right_top, 1),
        arc(r, rt, 0),
        "Z",
        eye_hole(46.35, 53.25, 1.08),
        eye_hole(53.65, 53.25, 1.08),
    ]
    return "\n    ".join(parts)


def mark_svg(line: str, needle: str, bird_fill: str, stroke_w: float = 1.45) -> str:
    ticks = "\n    ".join(
        [
            "M50 14 V8.4",
            radial_tick(38, 36.15, 40.6),
            radial_tick(142, 36.15, 40.6),
        ]
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <g stroke="{line}" stroke-width="{stroke_w}" stroke-linecap="square" fill="none">
    <circle cx="50" cy="50" r="36"/>
    <path d="M11.5 50 H88.5"/>
    <path d="{ticks}"/>
  </g>
  <path fill="{needle}" d="M50 13.05 L53.05 47.35 L50 44.7 L46.95 47.35 Z"/>
  <path fill="{bird_fill}" fill-rule="evenodd" d="
    {bird_path()}
  "/>
</svg>
'''


def svg_to_png(svg: str, size: int) -> Image.Image:
    raw = cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=size, output_height=size)
    return Image.open(BytesIO(raw)).convert("RGBA")


def composite_icon(size: int, mark_ratio: float = 0.70) -> Image.Image:
    bg = Image.new("RGBA", (size, size), (7, 11, 18, 255))
    mark_px = int(size * mark_ratio)
    mark = svg_to_png(mark_svg(PERGAMIN, RDZA, PERGAMIN, stroke_w=1.7), mark_px)
    x = (size - mark_px) // 2
    bg.alpha_composite(mark, (x, x))
    return bg.convert("RGB")


def favicon_svg() -> str:
    inner = mark_svg(PERGAMIN, RDZA, PERGAMIN, stroke_w=1.9)
    # drop xml wrapper of inner: take contents
    body = inner.split(">", 1)[1].rsplit("</svg>", 1)[0]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="{NIGHT}"/>
  <g transform="translate(2.8 2.8) scale(0.264)">
    {body}
  </g>
</svg>
'''


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)

    reverse = mark_svg(PERGAMIN, RDZA, PERGAMIN)
    master = mark_svg(ATRAMENT, RDZA, ATRAMENT, stroke_w=1.25)
    (PUBLIC / "brand-mark.svg").write_text(reverse, encoding="utf-8")
    (PUBLIC / "favicon.svg").write_text(favicon_svg(), encoding="utf-8")

    preview = svg_to_png(reverse, 640)
    dark = Image.new("RGBA", (640, 640), (7, 11, 18, 255))
    dark.alpha_composite(preview)
    dark.convert("RGB").save("/tmp/mark-preview.png", "PNG")

    parch = Image.new("RGBA", (640, 640), (232, 216, 200, 255))
    parch.alpha_composite(svg_to_png(master, 640))
    parch.convert("RGB").save("/tmp/mark-parchment-preview.png", "PNG")

    composite_icon(192).save(ICONS / "icon-192.png", "PNG", optimize=True)
    composite_icon(512).save(ICONS / "icon-512.png", "PNG", optimize=True)
    composite_icon(180, 0.72).save(ICONS / "apple-touch-icon.png", "PNG", optimize=True)
    print("wrote public/favicon.svg public/brand-mark.svg public/icons/*.png")


if __name__ == "__main__":
    main()
