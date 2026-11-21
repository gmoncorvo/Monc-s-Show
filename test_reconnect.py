# Testa a reconexão: no meio da partida um jogador fecha a aba e volta de três jeitos:
#  1) mesmo navegador (crachá salvo)  2) aparelho "limpo" -> "Quem é você?"  3) aba restaurada pelo link com &id=
import asyncio, random, time, os
from playwright.async_api import async_playwright
from test import bot   # reaproveita o robô do test.py
BASE='http://localhost:8765/index.html'
errors=[]; results={}
async def wait_name(page, name, secs=40):
    t0=time.time()
    while time.time()-t0<secs:
        bar = await page.query_selector('#pbar b')
        if bar and (await bar.inner_text()).strip()==name: return True
        await page.wait_for_timeout(300)
    return False
async def main():
    async with async_playwright() as p:
        kw = {'executable_path':'/usr/bin/google-chrome'} if os.path.exists('/usr/bin/google-chrome') else {}
        b = await p.chromium.launch(**kw); ctx = await b.new_context()
        def hook(pg,label): pg.on('pageerror', lambda e: errors.append(f'{label} PAGEERR {e}'))
        tv = await ctx.new_page(); await tv.set_viewport_size({'width':1920,'height':1080}); hook(tv,'TV')
        await tv.goto(BASE+'?tv&local&fast'); await tv.wait_for_selector('.roomcode')
        code=(await tv.inner_text('.roomcode')).strip()
        phones=[]
        for i,nm in enumerate(['Gabriel','Ana','Bruno']):
            ph = await ctx.new_page(); await ph.set_viewport_size({'width':390,'height':844}); hook(ph,nm)
            await ph.goto(BASE+f'?sala={code}&local&fast&p={i}'); await ph.fill('#nm', nm); await ph.click('#go'); phones.append(ph)
        await tv.wait_for_timeout(1500); await tv.click('#startbtn')
        stop={'done':False}; tasks=[asyncio.create_task(bot(ph,'x',stop)) for ph in phones]
        await tv.wait_for_timeout(15000)
        # 1) fecha a aba e reabre no mesmo navegador
        url0 = phones[0].url
        tasks[0].cancel(); await phones[0].close()
        await tv.wait_for_timeout(20000)
        results['tv_offline_card'] = bool(await tv.query_selector('#rejoin:not(.hidden)'))
        await tv.screenshot(path='shots/rc_tv_offline.png')
        ph = await ctx.new_page(); await ph.set_viewport_size({'width':390,'height':844}); hook(ph,'G2')
        await ph.goto(BASE+f'?sala={code}&local&fast&p=0')
        results['1_mesmo_navegador'] = await wait_name(ph,'Gabriel'); phones[0]=ph; tasks[0]=asyncio.create_task(bot(ph,'x',stop))
        results['url_tem_id'] = '&id=' in ph.url or '?id=' in ph.url
        idurl = ph.url
        # 2) Ana cai e volta por um aparelho limpo (outro armazenamento)
        tasks[1].cancel(); await phones[1].close()
        await tv.wait_for_timeout(2000)
        fresh = await ctx.new_page(); await fresh.set_viewport_size({'width':390,'height':844}); hook(fresh,'A2')
        await fresh.goto(BASE+f'?sala={code}&local&fast&p=77')
        btn=None; t0=time.time()
        while time.time()-t0<40 and not btn:
            btn = await fresh.query_selector('.ppl.claim'); await fresh.wait_for_timeout(400)
        await fresh.screenshot(path='shots/rc_claim.png')
        names = [ (await x.inner_text()) for x in await fresh.query_selector_all('.ppl.claim') ]
        results['claim_lista_so_offline'] = any('Ana' in n for n in names) and not any('Bruno' in n for n in names)
        if btn:
            for x in await fresh.query_selector_all('.ppl.claim'):
                if 'Ana' in await x.inner_text(): await x.click(); break
        results['2_aparelho_limpo'] = await wait_name(fresh,'Ana'); tasks[1]=asyncio.create_task(bot(fresh,'x',stop))
        # 3) aba restaurada pelo link com o crachá (aparelho limpo + &id=)
        tasks[0].cancel(); await phones[0].close()
        u = idurl.replace('&p=0','&p=88')
        ph3 = await ctx.new_page(); await ph3.set_viewport_size({'width':390,'height':844}); hook(ph3,'G3')
        await ph3.goto(u)
        results['3_link_com_id'] = await wait_name(ph3,'Gabriel'); tasks[0]=asyncio.create_task(bot(ph3,'x',stop))
        # 4) jogador novo não entra
        nw = await ctx.new_page(); await nw.goto(BASE+f'?sala={code}&local&fast&p=99'); await nw.wait_for_timeout(4000)
        results['4_novo_nao_entra'] = not await nw.query_selector('#pbar b')
        await nw.close()
        # a partida continua até o fim
        t0=time.time()
        while time.time()-t0<600 and not await tv.query_selector('#again'): await tv.wait_for_timeout(1000)
        results['partida_terminou'] = bool(await tv.query_selector('#again'))
        stop['done']=True
        await b.close()
    for k,v in results.items(): print(('OK  ' if v else 'FALHOU ')+k)
    print('\n'.join(errors[:20]) or 'no errors')
asyncio.run(main())
