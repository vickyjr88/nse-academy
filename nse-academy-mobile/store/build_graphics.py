#!/usr/bin/env python3
"""Builds the Play Store listing graphics from the raw app captures (store/screens/raw) with headless Chrome.

  python3 store/build_graphics.py        ->  store/graphics/phone-*.png (1080x1920), feature-graphic.png (1024x500)
"""
import os, subprocess, pathlib, shutil, tempfile

HERE = pathlib.Path(__file__).resolve().parent
FONTS = HERE.parent / "assets" / "fonts"
RAW = HERE / "screens" / "raw"
OUT = HERE / "graphics"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

SLIDES = [
    # raw file, headline, sub, dark?
    ("01-home", "Your daily NSE briefing", "A market tip, the busiest stocks and a quick quiz, every day.", False),
    ("02-learn", "Courses made for Kenya", "From opening a CDS account to building a portfolio.", False),
    ("04-lesson", "Lessons in plain English", "Short chapters you can finish on a commute. Progress is saved.", False),
    ("05-stocks", "Every listed company, one list", "See who is up or down, filter by sector, search by name.", False),
    ("06-stock", "Prices, charts, key metrics", "Delayed NSE prices with charts from one week to one year.", False),
    ("07-glossary", "Jargon, decoded", "A searchable glossary of the terms investors actually use.", False),
    ("08-home-dark", "Easy on the eyes", "Light or dark, whichever suits the hour.", True),
]

FONT_CSS = """
@font-face{font-family:JK;font-weight:700;src:url('FONTS/PlusJakartaSans-700.ttf')}
@font-face{font-family:JK;font-weight:800;src:url('FONTS/PlusJakartaSans-800.ttf')}
@font-face{font-family:JK;font-weight:600;src:url('FONTS/PlusJakartaSans-600.ttf')}
@font-face{font-family:IN;font-weight:400;src:url('FONTS/Inter-400.ttf')}
@font-face{font-family:IN;font-weight:600;src:url('FONTS/Inter-600.ttf')}
""".replace("FONTS", FONTS.as_uri())

MARK = '<svg viewBox="0 0 1024 1024" width="{s}" height="{s}"><rect width="1024" height="1024" rx="230" fill="#fff" fill-opacity=".14"/><polyline points="312,712 312,312 712,712 712,312" fill="none" stroke="#fff" stroke-width="104" stroke-linecap="round" stroke-linejoin="round"/><circle cx="712" cy="312" r="40" fill="#FBBF24"/></svg>'

def status_bar(dark):
    col = "#F1F5F9" if dark else "#0F172A"
    return f'''<div class="sb" style="color:{col}"><span>9:41</span><span class="ic">
<svg width="34" height="22" viewBox="0 0 34 22" fill="{col}"><rect x="0" y="14" width="5" height="8" rx="1"/><rect x="8" y="10" width="5" height="12" rx="1"/><rect x="16" y="5" width="5" height="17" rx="1"/><rect x="24" y="0" width="5" height="22" rx="1" opacity=".35"/></svg>
<svg width="44" height="22" viewBox="0 0 44 22" fill="none" stroke="{col}" stroke-width="2"><rect x="1" y="2" width="36" height="18" rx="5"/><rect x="4" y="5" width="25" height="12" rx="2.5" fill="{col}" stroke="none"/><rect x="39" y="8" width="4" height="6" rx="1.5" fill="{col}" stroke="none"/></svg></span></div>'''

def slide_html(raw, head, sub, dark):
    bg = "linear-gradient(165deg,#052E22 0%,#064E3B 55%,#047857 130%)" if dark else "linear-gradient(165deg,#047857 0%,#065F46 60%,#064E3B 100%)"
    return f'''<!doctype html><meta charset=utf-8><style>{FONT_CSS}
*{{box-sizing:border-box;margin:0}}
html,body{{width:1080px;height:1920px;overflow:hidden;background:#064E3B}}
body{{background:{bg};font-family:IN,sans-serif;color:#fff;position:relative}}
.brand{{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:16px;font:700 30px JK;letter-spacing:.2px;opacity:.95}}
.txt{{position:absolute;left:72px;right:72px;top:176px}}
h1{{font:800 84px/1.04 JK;letter-spacing:-1.5px;text-wrap:balance}}
p{{margin-top:26px;max-width:860px;font:400 36px/1.35 IN;opacity:.86}}
.glow{{position:absolute;left:-200px;right:-200px;top:760px;height:900px;background:radial-gradient(closest-side,rgba(251,191,36,.20),transparent);}}
.phone{{position:absolute;left:150px;top:560px;width:780px;height:1420px;border-radius:78px;background:#0B1220;padding:20px;box-shadow:0 40px 90px rgba(0,0,0,.45),inset 0 0 0 2px rgba(255,255,255,.12)}}
.scr{{position:relative;width:740px;height:1316px;border-radius:60px;overflow:hidden;background:#fff}}
.scr img{{width:740px;height:1316px;display:block}}
.sb{{position:absolute;left:0;right:0;top:0;height:56px;padding:12px 44px 0 54px;display:flex;justify-content:space-between;align-items:center;font:600 24px IN}}
.sb .ic{{display:flex;gap:14px;align-items:center}}
.cam{{position:absolute;left:50%;top:14px;width:20px;height:20px;margin-left:-10px;border-radius:50%;background:#0B1220}}
</style>
<div class=glow></div>
<div class=brand>{MARK.format(s=52)}<span>NSE Academy</span></div>
<div class=txt><h1>{head}</h1><p>{sub}</p></div>
<div class=phone><div class=scr><img src="{(RAW/(raw+'.png')).as_uri()}">{status_bar(dark)}<div class=cam></div></div></div>'''

def feature_html():
    a = (RAW/"01-home.png").as_uri(); b = (RAW/"05-stocks.png").as_uri(); c = (RAW/"06-stock.png").as_uri()
    def ph(img, left, top, w, rot, z):
        h = int(w*1920/1080); pad = 6
        return f'<div style="position:absolute;left:{left}px;top:{top}px;width:{w}px;height:{h}px;border-radius:30px;background:#0B1220;padding:{pad}px;transform:rotate({rot}deg);z-index:{z};box-shadow:0 18px 40px rgba(0,0,0,.45)"><div style="width:100%;height:100%;border-radius:25px;overflow:hidden"><img src="{img}" style="width:100%;height:100%;display:block"></div></div>'
    return f'''<!doctype html><meta charset=utf-8><style>{FONT_CSS}
*{{box-sizing:border-box;margin:0}}
html,body{{width:1024px;height:500px;overflow:hidden}}
body{{background:linear-gradient(120deg,#064E3B 0%,#047857 70%,#059669 120%);font-family:IN,sans-serif;color:#fff;position:relative}}
.brand{{position:absolute;left:56px;top:46px;display:flex;align-items:center;gap:12px;font:700 24px JK}}
.txt{{position:absolute;left:56px;top:118px;width:500px}}
h1{{font:800 52px/1.04 JK;letter-spacing:-1px}}
p{{margin-top:18px;font:400 21px/1.38 IN;opacity:.88}}
.chip{{position:absolute;left:56px;top:402px;padding:9px 18px;border-radius:99px;background:rgba(255,255,255,.14);font:600 17px IN;letter-spacing:.2px}}
.glow{{position:absolute;left:520px;top:-80px;width:700px;height:700px;background:radial-gradient(closest-side,rgba(251,191,36,.22),transparent)}}
</style><div class=glow></div>
<div class=brand>{MARK.format(s=38)}<span>NSE Academy</span></div>
<div class=txt><h1>Learn the NSE. Invest with confidence.</h1>
<p>Courses, stock prices and charts, and a glossary of investing terms.</p></div>
<div class=chip>Made for Kenyan investors</div>
{ph(b, 560, 70, 190, 7, 1)}{ph(a, 700, 40, 210, -3, 3)}{ph(c, 850, 78, 190, 8, 2)}'''

def render(html, out, w, h, tmp):
    f = tmp / (out.stem + ".html"); f.write_text(html)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--window-size={w},{h}", f"--screenshot={out}", "--virtual-time-budget=4000", f.as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # drop the alpha channel: Play rejects screenshots and the feature graphic with transparency
    subprocess.run(["magick", str(out), "-background", "#064E3B", "-alpha", "remove", "-alpha", "off", "-strip", str(out)], check=True)

def main():
    OUT.mkdir(exist_ok=True)
    tmp = pathlib.Path(tempfile.mkdtemp())
    for i, (raw, head, sub, dark) in enumerate(SLIDES, 1):
        render(slide_html(raw, head, sub, dark), OUT / f"phone-{i}.png", 1080, 1920, tmp)
    render(feature_html(), OUT / "feature-graphic.png", 1024, 500, tmp)
    shutil.rmtree(tmp)

main()
