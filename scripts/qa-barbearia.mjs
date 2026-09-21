/** Contrato no navegador sem JS + capturas da âncora hero e composição inteira. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { subirServidor, CHROMIUM, SAIDA } from './qa-servidor.mjs';

const ids = (process.env.QA_BARBEARIA_TEMAS ?? 'norte,meia-noite,creme,vinho').split(',');
const saida = path.join(SAIDA, 'barbearia');
await fs.mkdir(saida, { recursive: true });
const app = await subirServidor({ build: !process.argv.includes('--sem-build') });
const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const esperado = ['hero','agendamentoRapido','filosofia','servicos','equipe','ritual','depoimentos','agendamento','contato'];
const relatorio = [];
try {
  for (const js of (process.argv.includes("--sem-js") ? [false] : [false, true])) {
    const ctx = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 1100, height: 800 } });
    await ctx.addCookies([app.cookie]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const id of ids) {
      for (const width of [390, 1100]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`${app.base}/interno/demo-qa?skin=barbearia-editorial&preset=${id}&avulsa=1&nome=Barbearia%20Contrato%20Real&efeito=nenhum&intro=0`, {waitUntil:'networkidle'});
        const hero = page.locator('[data-d-secao="hero"]');
        assert.equal(await page.locator('h1').count(), 1);
        const nome = (await hero.locator('h1').innerText()).replace(/\s+/g,' ').replace(/\|/g,'').trim();
        assert.equal(nome.toUpperCase(), 'BARBEARIA CONTRATO REAL');
        assert.equal(await page.locator('[data-demo-slot="endereco"]').count(),0);
        const secoes = await page.locator('[data-d-secao]').evaluateAll(es => es.map(e => e.getAttribute('data-d-secao')));
        assert.deepEqual([...secoes].sort(), [...esperado].sort());
        const medida = await hero.locator('h1').evaluate(el => {
          let e=el, opacity=1;
          while(e){opacity*=Number(getComputedStyle(e).opacity);e=e.parentElement;}
          const b=el.getBoundingClientRect();
          return {opacity,width:b.width,height:b.height, overflow:document.documentElement.scrollWidth > innerWidth};
        });
        assert.ok(medida.opacity > .99 && medida.width > 0 && medida.height > 0);
        assert.equal(medida.overflow,false);
        if(js) {
          await page.waitForTimeout(5000);
          for(const sec of await page.locator('[data-d-secao]').all()) { await sec.scrollIntoViewIfNeeded(); await page.waitForTimeout(250); }
          await page.waitForTimeout(7000);
          await page.evaluate(() => window.scrollTo(0,0));
          await page.waitForTimeout(500);
        }
        const prefix=`${id}-${width}-${js?'js':'sem-js'}`;
        // Mesmo recorte de identidade: chrome fixo fora da âncora fica fora do print.
        await page.locator('.be header').evaluate(el => { el.style.display='none'; });
        await hero.screenshot({path:path.join(saida,`${prefix}-hero.png`)});
        if(js) await page.screenshot({path:path.join(saida,`${prefix}-pagina.png`),fullPage:true});
        if(js && id === 'vinho' && width === 1100) {
          await page.locator('[data-d-secao="ritual"]').screenshot({path:path.join(saida,'vinho-ritual.png')});
        }
        relatorio.push({id,viewportWidth:width,js,nome,secoes,...medida});
      }
    }
    assert.deepEqual(errors,[]);
    await ctx.close();
  }
  await fs.writeFile(path.join(saida,'contrato.json'),JSON.stringify(relatorio,null,2));
  console.log(JSON.stringify(relatorio,null,2));
} finally { await browser.close(); app.encerrar(); }
