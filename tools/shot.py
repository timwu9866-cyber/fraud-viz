import sys
from playwright.sync_api import sync_playwright
url=sys.argv[1]; ts=sys.argv[2]; pre=sys.argv[3]
theme=sys.argv[4] if len(sys.argv)>4 else 'dark'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist","--no-sandbox"])
    pg=b.new_page(viewport={'width':1920,'height':1080},device_scale_factor=1)
    errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.on("console",lambda m:errs.append(m.text) if m.type=="error" else None)
    pg.goto(url); pg.wait_for_timeout(1500)
    if theme=='light':
        pg.evaluate("window.SEC_THEME && window.SEC_THEME.apply('light',true)"); pg.wait_for_timeout(500)
    for t in ts.split(','):
        pg.evaluate(f"window.FRAUD.seek({t})"); pg.wait_for_timeout(350)
        pg.screenshot(path=f"{pre}_{theme}_{t}.png")
    print("JSERR",errs)
    print("STAGEERR", pg.evaluate("window.FRAUD.stage ? window.FRAUD.stage.errors : 'no stage'"))
    b.close()
