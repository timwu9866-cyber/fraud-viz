import sys
from playwright.sync_api import sync_playwright
url=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist","--no-sandbox"])
    pg=b.new_page(viewport={'width':1600,'height':900},color_scheme='dark')
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(1800)
    pg.evaluate("window.SEC_THEME&&window.SEC_THEME.apply('dark',true)"); pg.wait_for_timeout(500)
    pg.evaluate("window.FW.overview()"); pg.wait_for_timeout(1600); pg.screenshot(path="shots/wd_overview.png")
    pg.evaluate("window.FW.select(0,true)"); pg.wait_for_timeout(1700); pg.evaluate("window.FW.seek(0,9)"); pg.wait_for_timeout(600); pg.screenshot(path="shots/wd_s1t1.png")
    pg.evaluate("window.FW.select(19,true)"); pg.wait_for_timeout(1700); pg.evaluate("window.FW.seek(19,9)"); pg.wait_for_timeout(600); pg.screenshot(path="shots/wd_s7t1.png")
    print("JSERR",errs[:8]); print("STAGEERR",pg.evaluate("window.FW.stage.errors.slice(0,8)"))
    b.close()
