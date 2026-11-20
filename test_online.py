# Simula uma partida do modo online: anfitrião + 2 convidados (Playwright, BroadcastChannel local)
import asyncio, random, time, os
from playwright.async_api import async_playwright
BASE='http://localhost:8765/index.html'
errors=[]
async def bot(page, stop):
    while not stop['done']:
        try:
            await page.wait_for_timeout(150)
            root = '#opanel '
            for sel in ['.iceblk','.pskip:not([disabled])','.pbig.roll','.popt:not([disabled])','.ppl:not([disabled])','.pqo:not([disabled])','.splat']:
                els = [e for e in await page.query_selector_all(root+sel) if await e.is_enabled()]
                if els:
                    if sel == '.pbig.roll':
                        items = await page.query_selector_all(root+'.pitem')
                        e = random.choice(items) if items and random.random()<0.5 else els[0]
                        await e.click(timeout=2000)
                    else: await random.choice(els).click(timeout=2000)
                    break
            if await page.query_selector(root+'.keypad') and not await page.query_selector(root+'.iceblk'):
                ok = await page.query_selector(root+'.key.ok')
                if ok and await ok.is_enabled():
                    for d in str(random.randint(1,3000)): await page.click(f'{root}.key[data-k="{d}"]', timeout=2000)
                    await page.click(root+'.key.ok', timeout=2000)
        except Exception: pass
async def main():
    os.makedirs('shots', exist_ok=True)
    async with async_playwright() as p:
        kw = {'executable_path':'/usr/bin/google-chrome'} if os.path.exists('/usr/bin/google-chrome') else {}
        b = await p.chromium.launch(**kw); ctx = await b.new_context(viewport={'width':1600,'height':900})
        def hook(pg,label):
            pg.on('pageerror', lambda e: errors.append(f'{label} PAGEERR {e}'))
            pg.on('console', lambda m: errors.append(f'{label} {m.type}: {m.text}') if m.type=='error' and 'Failed to load' not in m.text and 'ERR_' not in m.text else None)
        host = await ctx.new_page(); hook(host,'HOST')
        await host.goto(BASE+'?online&host&local&fast&p=h')
        await host.wait_for_selector('#opanel #nm'); await host.fill('#opanel #nm','Gabriel'); await host.click('#opanel #go')
        await host.wait_for_selector('.roomcode'); code=(await host.inner_text('.roomcode')).strip()
        cl=[]
        for i,nm in enumerate(['Ana','Bruno']):
            c = await ctx.new_page(); hook(c,nm)
            await c.goto(BASE+f'?online&sala={code}&local&fast&p={i}')
            await c.wait_for_selector('#opanel #nm'); await c.fill('#opanel #nm',nm); await c.click('#opanel #go'); cl.append(c)
        await host.wait_for_timeout(2000)
        await host.click('#startbtn')
        stop={'done':False}; tasks=[asyncio.create_task(bot(x,stop)) for x in [host]+cl]
        t0=time.time(); shots=set()
        while time.time()-t0<700:
            await host.wait_for_timeout(500)
            if await host.query_selector('#again'): await host.wait_for_timeout(1500); await cl[0].screenshot(path='shots/on_final.png'); break
            for key,sel in [('board','#dicebox:not(.hidden)'),('quiz','.quiz.ask'),('wheel','.wheelbox'),('atk','.atkcard'),('clock','.clockq'),('potato','.potato')]:
                if key not in shots and await cl[0].query_selector(sel):
                    shots.add(key); await cl[0].screenshot(path=f'shots/on_{key}.png')
        stop['done']=True
        print('elapsed',round(time.time()-t0),'final',bool(await host.query_selector('#again')),'client final',bool(await cl[0].query_selector('.final')))
        print('shots',shots)
        await b.close()
    print('\n'.join(errors[:40]) or 'no errors')
asyncio.run(main())
