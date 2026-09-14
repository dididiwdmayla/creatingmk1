import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {randomBytes,createHmac} from 'node:crypto';
import {mkdirSync,openSync,writeFileSync,copyFileSync} from 'node:fs';
const pasta='qa/prompt-26';mkdirSync(pasta,{recursive:true});
const secret=randomBytes(24).toString('hex'),payload='qa.admin.0';
const token=payload+'.'+createHmac('sha256','radar-session:'+secret).update(payload).digest('hex');
const log=openSync(pasta+'/servidor.log','w');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3126'],{stdio:['ignore',log,log],env:{...process.env,APP_PASSWORD:secret}});
const base='http://127.0.0.1:3126';let browser;
const erros=[],checks=[],dados={};
const check=(ok,txt)=>{checks.push({ok,txt});console.log((ok?'ok ':'FALHA ')+txt);if(!ok)erros.push(txt)};
async function pronto(page){await page.waitForSelector('#conteudo:not([inert])',{timeout:45000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('[data-cardapio] img')].map(i=>i.decode().catch(()=>{})))})}
async function ui(page){return page.evaluate(()=>{
  const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[inert]')};
  const alvos=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,summary')].filter(vis).filter(e=>!e.matches('[data-toque]')).map(e=>{const r=e.getBoundingClientRect();return {nome:e.id||e.getAttribute('aria-label')||e.textContent.slice(0,45),w:r.width,h:r.height}}).filter(r=>r.w<43.9||r.h<43.9);
  const s=getComputedStyle(document.documentElement),cor=v=>{const e=document.createElement('i');e.style.color=v;document.body.append(e);const c=getComputedStyle(e).color;e.remove();return c};
  const quente=cor(s.getPropertyValue('--latao')),frio=cor(s.getPropertyValue('--letreiro'));
  const limite=document.querySelector('#barra-pedido')?.getBoundingClientRect().top??innerHeight;
  const cards=[...document.querySelectorAll('[data-item-cardapio]')].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,w:r.width,h:r.height}});
  const nomes=[...document.querySelectorAll('[data-item-cardapio] h3')].map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {nome:e.textContent,linhas:r.height/parseFloat(s.lineHeight),font:s.fontSize,w:r.width,h:r.height,inteiro:s.textOverflow!=='ellipsis'&&s.webkitLineClamp==='none'&&e.scrollWidth<=r.width+1&&e.scrollHeight<=r.height+1}});
  return {overflow:document.documentElement.scrollWidth>innerWidth,alvos,limite,cards,completos:cards.filter(r=>r.top>=0&&r.bottom<=limite+.5).length,nomes,
    precos:[...document.querySelectorAll('[data-preco]')].filter(vis).every(e=>getComputedStyle(e).color===quente),medidas:[...document.querySelectorAll('[data-medida]')].filter(vis).every(e=>getComputedStyle(e).color===frio),
    fontes:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replaceAll('"','')).sort(),
    arquivosFonte:performance.getEntriesByType('resource').filter(r=>/woff/.test(r.name)).map(r=>new URL(r.name).pathname)
  };
})}
try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/login')).ok)break}catch{}await new Promise(r=>setTimeout(r,300));}
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??process.env.QA_CHROMIUM??'/opt/pw-browsers/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
  const temas=['meia-noite','diner','pratico','cantina'],metas=[3,6,4,4];
  for(const [i,tema] of temas.entries()){
    const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await ctx.addCookies([{name:'radar_session',value:token,url:base}]);const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const caminho=`/interno/lancheria/lancheria-${tema}`;const response=await page.goto(base+caminho);await pronto(page);
    check((await response.text()).includes(`data-tema="${tema}"`),`${tema}: identidade já vem no HTML do servidor`);
    check(response.ok()&&await page.locator('[data-lancheria-app]').getAttribute('data-tema')===tema,`${tema}: skin escolhida no servidor sem ?tema=`);
    dados[tema]=await ui(page);check(dados[tema].completos>=metas[i],`${tema}: ${dados[tema].completos} itens completos na entrada`);
    check(!dados[tema].overflow&&!dados[tema].alvos.length,`${tema}/390: largura e alvos ${JSON.stringify(dados[tema].alvos)}`);
    check(dados[tema].precos&&dados[tema].medidas,`${tema}: papéis quente/frio`);
    await page.screenshot({path:`${pasta}/${tema}-entrada.jpg`,type:'jpeg',quality:85});
    await page.evaluate(()=>document.querySelector('[data-cardapio]').scrollIntoView({block:'start'}));
    await page.screenshot({path:`${pasta}/${tema}-cardapio.jpg`,type:'jpeg',quality:85});
    copyFileSync(`${pasta}/${tema}-cardapio.jpg`,`public/demos/lancheria2/${tema}.jpg`);
    if(tema==='diner'){await page.locator('.diner-recheio summary').first().click();check(await page.locator('.diner-recheio[open]').count()===1,'Diner: foto abre composição');await page.locator('.diner-recheio summary').first().click()}
    await page.locator('[data-cardapio] [data-add]').first().click();await page.waitForSelector('[data-item-cardapio] [data-modificar]');
    await page.locator('[data-item-cardapio] [data-modificar]').first().click();await page.waitForSelector('#rx-painel[data-escala]');await page.waitForFunction(()=>!document.documentElement.dataset.transicao);await page.evaluate(()=>document.fonts.ready);
    dados[tema].rx=await ui(page);
    if(tema==='cantina')check(await page.locator('#rx-preco-valor').evaluate(el=>getComputedStyle(el).fontVariantNumeric.includes('oldstyle-nums')),'Cantina: algarismos antiquários também no raio-x');check(!dados[tema].rx.overflow&&!dados[tema].rx.alvos.length&&dados[tema].rx.precos&&dados[tema].rx.medidas,`${tema}: raio-x sem overflow, 44px, semântica`);
    check(await page.locator('#rx-pilha [data-foto-camada]').count()===10,`${tema}: mesmas dez camadas`);
    await page.screenshot({path:`${pasta}/${tema}-raio-x.jpg`,type:'jpeg',quality:85});
    if(tema==='pratico')check(JSON.stringify(dados[tema].rx.fontes)==='["Inter"]','Prático baixa somente Inter: '+dados[tema].rx.fontes.join(', '));
    if(tema==='cantina')check(dados[tema].rx.fontes.every(f=>['Lora','Playfair Display'].includes(f)),'Cantina sem monoespaçada: '+dados[tema].rx.fontes.join(', '));
    await page.locator('#rx-ver-composicao').click();await page.locator('[data-slug="tomate"] [data-mover-cima]').click();
    check(await page.locator('[data-aviso-ordem]').isVisible(),`${tema}: aviso na primeira reordenação`);
    await page.locator('[data-aviso-ordem]').click();await page.locator('[data-slug="tomate"] [data-mover-baixo]').click();check(await page.locator('[data-aviso-ordem]').count()===0,`${tema}: aviso não repete`);
    await page.setViewportSize({width:320,height:740});await page.goto(base+caminho);await pronto(page);dados[tema].estreito=await ui(page);
    check(!dados[tema].estreito.overflow&&!dados[tema].estreito.alvos.length,`${tema}/320: sem overflow e alvos 44px`);
    await page.goto(base+caminho+'?tema='+(tema==='cantina'?'diner':'cantina'));await pronto(page);check(await page.locator('[data-lancheria-app]').getAttribute('data-tema')===tema,`${tema}: query não altera identidade publicada`);
    check(!errors.length,`${tema}: nenhum erro de página ${errors.join(';')}`);await ctx.close();
  }
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});await ctx.addCookies([{name:'radar_session',value:token,url:base}]);const page=await ctx.newPage();
  await page.goto(base+'/interno/lancheria/lancheria-diner/cliente');await pronto(page);dados.cliente=await ui(page);
  check(dados.cliente.nomes.every(n=>n.inteiro),'Diner/cliente: seis nomes longos inteiros, sem reticências');
  check((await page.locator('[data-item-cardapio] [data-preco]').first().innerText())==='R$ 41,00','Cliente: preço próprio no cardápio');
  check(await page.locator('body').innerText().then(t=>t.includes('Sanduicheria da Praça')&&!t.includes('98457')),'Cliente: nome e contato do Radar');
  await page.screenshot({path:`${pasta}/diner-cliente-390.jpg`,type:'jpeg',quality:85});
  await page.setViewportSize({width:320,height:740});dados.cliente320=await ui(page);check(!dados.cliente320.overflow&&dados.cliente320.nomes.every(n=>n.inteiro),'Diner/cliente em 320: nomes inteiros, sem overflow');
  await page.screenshot({path:`${pasta}/diner-cliente-320.jpg`,type:'jpeg',quality:85});
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-cardapio] [data-add]').first().click();await page.waitForSelector('[data-item-cardapio] [data-modificar]');
  await page.locator('[data-item-cardapio] [data-modificar]').first().click();await page.waitForSelector('#rx-painel[data-escala]');await page.waitForFunction(()=>!document.documentElement.dataset.transicao);
  check(await page.locator('#rx-preco-valor').innerText()==='R$ 41,00','Cliente: preço próprio também no raio-x após transição real');
  await page.locator('#rx-ver-composicao').click();await page.locator('[data-slug="tomate"] [data-mover-cima]').click();
  await page.waitForSelector('[data-aviso-ordem]',{state:'detached',timeout:9500});check(true,'Aviso some sozinho, com movimento normal');
  await page.goto(base+'/interno/lancheria/lancheria-diner/cliente');await pronto(page);
  await page.locator('[data-cardapio] [data-add]').first().click();await page.waitForSelector('[data-item-cardapio] [data-modificar]');await page.locator('[data-item-cardapio] [data-modificar]').first().click();await page.waitForSelector('#rx-painel[data-escala]');await page.waitForFunction(()=>!document.documentElement.dataset.transicao);
  await page.locator('#rx-ver-composicao').click();await page.locator('[data-slug="tomate"] [data-mover-cima]').click();check(await page.locator('[data-aviso-ordem]').count()===0,'Recarregar mantém aviso consumido na mesma sessão');
  await ctx.close();
}finally{await browser?.close();server.kill();writeFileSync(pasta+'/resultados.json',JSON.stringify({checks,dados,erros},null,2)+'\n')}
if(erros.length)process.exitCode=1;
