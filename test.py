import asyncio, random, time, sys
from playwright.async_api import async_playwright
BASE='http://localhost:8765/index.html'
errors=[]
async def bot(page, name, stop):
    while not stop['done']:
        try:
            await page.wait_for_timeout(120)
            for sel in ['.pbig.roll','.pitem','.popt:not([disabled])','.ppl','.pqo:not([disabled])','.splat']:
                els = await page.query_selector_all(sel)
                els = [e for e in els if await e.is_enabled()]
                if els:
                    if sel in ('.pbig.roll','.pitem'):
                        # sometimes use item
                        items = await page.query_selector_all('.pitem')
                        e = random.choice(items) if items and random.random()<0.5 else await page.query_selector('.pbig.roll')
                        if e and await e.is_enabled(): await e.click()
                    else:
                        await random.choice(els).click()
                    break
            if await page.query_selector('.keypad'):
                ok = await page.query_selector('.key.ok')
                if ok and await ok.is_enabled():
                    for d in str(random.randint(1,3000)):
                        await page.click(f'.key[data-k="{d}"]')
                    await page.click('.key.ok')
        except Exception as ex:
            pass
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context()
        tv = await ctx.new_page(); await tv.set_viewport_size({'width':1920,'height':1080})
        def hook(pg,label):
            pg.on('pageerror', lambda e: errors.append(f'{label} PAGEERR {e}'))
            pg.on('console', lambda m: errors.append(f'{label} {m.type}: {m.text}') if m.type=='error' and 'Failed to load' not in m.text and 'ERR_' not in m.text else None)
        hook(tv,'TV')
        await tv.goto(BASE+'?tv&local&fast')
        await tv.wait_for_selector('.roomcode')
        code = (await tv.inner_text('.roomcode')).strip()
        phones=[]
        for i,nm in enumerate(['Gabriel','Ana','Bruno']):
            ph = await ctx.new_page(); await ph.set_viewport_size({'width':390,'height':844}); hook(ph,nm)
            await ph.goto(BASE+f'?sala={code}&local&fast&p={i}')
            await ph.fill('#nm', nm); await ph.click('#go')
            phones.append(ph)
        await tv.wait_for_timeout(1500)
        await tv.screenshot(path='shots/tv_lobby.png')
        await phones[0].screenshot(path='shots/ph_lobby.png')
        await tv.click('#startbtn')
        stop={'done':False}
        tasks=[asyncio.create_task(bot(ph,'x',stop)) for ph in phones]
        t0=time.time(); shots=set()
        while time.time()-t0 < 600:
            await tv.wait_for_timeout(400)
            if await tv.query_selector('#again'):
                await tv.wait_for_timeout(1500); await tv.screenshot(path='shots/tv_final.png'); await phones[0].screenshot(path='shots/ph_final.png'); break
            for key,sel in [('board','#dicebox:not(.hidden)'),('quiz','.quiz.ask'),('reveal','.quiz.reveal'),('results','.results'),('wheel','.wheelbox'),('vs','.vs'),('shop','.shopbox'),('num','.numrows')]:
                if key not in shots and await tv.query_selector(sel):
                    shots.add(key); await tv.screenshot(path=f'shots/tv_{key}.png')
                    for i,ph in enumerate(phones[:1]): await ph.screenshot(path=f'shots/ph_{key}.png')
        stop['done']=True
        turn = await tv.inner_text('#turninfo')
        print('elapsed',round(time.time()-t0),'turninfo',turn,'final', bool(await tv.query_selector('#again')))
        print('shots',shots)
        await b.close()
    print('\n'.join(errors[:40]) or 'no errors')
asyncio.run(main())
