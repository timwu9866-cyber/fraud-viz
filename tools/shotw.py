import sys
from playwright.sync_api import sync_playwright
url=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist","--no-sandbox"])
    pg=b.new_page(viewport={'width':1600,'height':900})
    errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.on("console",lambda m:errs.append(m.text) if m.type=="error" else None)
    pg.goto(url); pg.wait_for_timeout(2000)
    pg.screenshot(path="shots/w_overview.png")
    # play event 0 (s1t1), let camera fly, capture mid
    pg.evaluate("window.FW.select(0,true)"); pg.wait_for_timeout(1600)
    pg.evaluate("window.FW.seek(0,8)"); pg.wait_for_timeout(600); pg.screenshot(path="shots/w_s1t1.png")
    pg.evaluate("window.FW.select(13,true)"); pg.wait_for_timeout(1600)
    pg.evaluate("window.FW.seek(13,8)"); pg.wait_for_timeout(600); pg.screenshot(path="shots/w_s5t1.png")
    print("JSERR",errs[:10])
    print("STAGEERR", pg.evaluate("window.FW.stage? window.FW.stage.errors.slice(0,10):'no'"))
    b.close()
