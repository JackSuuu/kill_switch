"""
KILL_SWITCH icon generator — v2
Clean, bold Pip-Boy power symbol with tight glow, no scan-line clutter.
"""

import math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BG        = (13,  15,  11,  255)
GREEN     = (127, 255,  95,  255)
GREEN_A   = (127, 255,  95)
DIM       = ( 42,  80,  32,  255)
DIM2      = ( 22,  45,  18,  255)

def make_icon(size: int) -> Image.Image:
    S  = size * 4          # super-sample
    cx = cy = S // 2

    img  = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ── Background: rounded square ────────────────────────────────
    pad = int(S * 0.04)
    r   = int(S * 0.20)
    x0, y0, x1, y1 = pad, pad, S-pad, S-pad

    def rrect(d, fill):
        d.rectangle([x0+r, y0, x1-r, y1], fill=fill)
        d.rectangle([x0, y0+r, x1, y1-r], fill=fill)
        for ex, ey in [(x0,y0),(x1-2*r,y0),(x0,y1-2*r),(x1-2*r,y1-2*r)]:
            d.ellipse([ex, ey, ex+2*r, ey+2*r], fill=fill)

    rrect(draw, BG)

    # ── Subtle inner border glow ──────────────────────────────────
    bpad = pad + S//60
    br   = r - S//60
    bx0,by0,bx1,by1 = bpad,bpad,S-bpad,S-bpad
    def rrect_stroke(d, fill, width):
        for i in range(width):
            off = i
            d.rectangle([bx0+br+off, by0+off, bx1-br-off, by0+off+1], fill=fill)
            d.rectangle([bx0+br+off, by1-off, bx1-br-off, by1-off+1], fill=fill)
            d.rectangle([bx0+off, by0+br+off, bx0+off+1, by1-br-off], fill=fill)
            d.rectangle([bx1-off, by0+br+off, bx1-off+1, by1-br-off], fill=fill)
    rrect_stroke(draw, (*GREEN_A, 35), S//30)

    # ── Outer tick ring ───────────────────────────────────────────
    R_tick = int(S * 0.40)
    n_major, n_minor = 12, 48
    for i in range(n_minor):
        angle = math.radians(i * (360/n_minor) - 90)
        major = (i % 4 == 0)
        t_len = S*0.055 if major else S*0.025
        lw    = max(2, S//100) if major else max(1, S//180)
        alpha = 200 if major else 80
        x1t = cx + (R_tick) * math.cos(angle)
        y1t = cy + (R_tick) * math.sin(angle)
        x2t = cx + (R_tick - t_len) * math.cos(angle)
        y2t = cy + (R_tick - t_len) * math.sin(angle)
        draw.line([(x1t,y1t),(x2t,y2t)], fill=(*GREEN_A, alpha), width=lw)

    # ── Dim ring behind arc ───────────────────────────────────────
    R_arc = int(S * 0.315)
    arc_w = max(S//28, 6)
    draw.ellipse([cx-R_arc, cy-R_arc, cx+R_arc, cy+R_arc],
                 outline=DIM2, width=arc_w)

    # ── Main power arc (270°, gap at top) ─────────────────────────
    gap   = 56          # degrees gap at the top
    start = -90 + gap//2
    end   = 270 - gap//2
    draw.arc([cx-R_arc, cy-R_arc, cx+R_arc, cy+R_arc],
             start=start, end=end, fill=GREEN, width=arc_w)

    # ── Power stem (vertical bar through gap) ─────────────────────
    stem_w    = max(S//22, 8)
    stem_top  = cy - R_arc - arc_w//2 + S//60
    stem_bot  = cy - int(S * 0.035)
    # slightly rounded cap at top using an ellipse
    cap_r = stem_w // 2
    draw.ellipse([cx-cap_r, stem_top-cap_r, cx+cap_r, stem_top+cap_r], fill=GREEN)
    draw.line([(cx, stem_top), (cx, stem_bot)], fill=GREEN, width=stem_w)

    # ── Centre dot ────────────────────────────────────────────────
    dot_r = max(S//40, 5)
    draw.ellipse([cx-dot_r, cy-dot_r, cx+dot_r, cy+dot_r], fill=GREEN)

    # ── "KS" label ────────────────────────────────────────────────
    if size >= 48:
        font_size = max(8, S // 11)
        font = None
        for fp in [
            "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
            "/System/Library/Fonts/Monaco.ttf",
            "/System/Library/Fonts/Menlo.ttc",
        ]:
            try:
                font = ImageFont.truetype(fp, font_size)
                break
            except Exception:
                pass
        if font is None:
            font = ImageFont.load_default()

        text = "KS"
        bb   = draw.textbbox((0,0), text, font=font)
        tw, th = bb[2]-bb[0], bb[3]-bb[1]
        tx = cx - tw//2 - bb[0]
        ty = cy + int(R_arc * 0.52) - bb[1]
        # draw label with dim background strip
        strip_pad = S//40
        draw.rectangle([tx-strip_pad, ty-strip_pad//2,
                         tx+tw+strip_pad, ty+th+strip_pad//2],
                        fill=(*BG[:3], 180))
        draw.text((tx, ty), text, fill=(*GREEN_A, 230), font=font)

    # ── Down-sample 4× with LANCZOS ──────────────────────────────
    out = img.resize((size, size), Image.LANCZOS)

    # ── Multi-layer glow bloom ────────────────────────────────────
    def make_glow_layer(blur_r, alpha_mult):
        g = Image.new("RGBA", (size, size), (0,0,0,0))
        gd = ImageDraw.Draw(g)
        s2 = size
        c2 = size // 2
        ra = int(size * 0.315)
        aw = max(2, size//28)
        gap2 = 56
        gd.arc([c2-ra, c2-ra, c2+ra, c2+ra],
               start=-90+gap2//2, end=270-gap2//2,
               fill=(*GREEN_A, int(160*alpha_mult)), width=aw)
        sw = max(1, size//22)
        st = c2 - ra - aw//2
        sb = c2 - size//35
        gd.line([(c2, st),(c2, sb)], fill=(*GREEN_A, int(160*alpha_mult)), width=sw)
        dr = max(1, size//40)
        gd.ellipse([c2-dr,c2-dr,c2+dr,c2+dr], fill=(*GREEN_A, int(200*alpha_mult)))
        g = g.filter(ImageFilter.GaussianBlur(radius=blur_r))
        return g

    # Stack: wide soft glow + tight hard glow
    out = Image.alpha_composite(out, make_glow_layer(max(1, size//12), 0.6))
    out = Image.alpha_composite(out, make_glow_layer(max(1, size//30), 0.4))

    return out


# ── Output ────────────────────────────────────────────────────────────────
OUT = os.path.join(os.path.dirname(__file__), "src-tauri", "icons")
os.makedirs(OUT, exist_ok=True)

for fname, sz in [("32x32.png",32),("128x128.png",128),("128x128@2x.png",256)]:
    make_icon(sz).save(os.path.join(OUT, fname), "PNG")
    print(f"  ✓  {fname}")

make_icon(1024).save(os.path.join(OUT, "_master_1024.png"), "PNG")
print("  ✓  _master_1024.png")
print("\nDone.")
