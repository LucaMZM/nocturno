import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Isolated migrated + seeded DB only. Independent headless browser, never a personal profile.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const baseURL = process.env.AUTH_UI_ORIGIN ?? 'http://127.0.0.1:4319';
const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});
const context = await browser.newContext({baseURL,viewport:{width:1280,height:900}});
const page = await context.newPage(), errors=[], requests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().startsWith(baseURL+'/api/')) requests.push(r.headers().authorization)});
const avatar=await readFile(new URL('../public/yomogan/avatar.png',import.meta.url));
await context.route('https://nocturno-avatar.test/avatar.png',r=>r.fulfill({body:avatar,contentType:'image/png'}));
await context.route('https://nocturno-avatar.test/missing.png',r=>r.fulfill({status:404}));
async function login(email,password,destination){
 await page.goto('/auth/login');
 await page.locator('input[formcontrolname="email"]').fill(email);
 await page.locator('input[formcontrolname="password"]').fill(password);
 await page.getByRole('button',{name:/^Entrar/}).click();
 await page.waitForURL(u=>u.pathname===destination);
}
async function logout(){
 await page.getByRole('button',{name:'Salir',exact:true}).click();await page.waitForURL(u=>u.pathname==='/');
 assert.equal((await context.cookies(baseURL+'/api/auth/refresh')).filter(c=>c.name.startsWith('nocturno_')).length,0);
}
async function responsive(label){for(const width of [390,768,1280]){
 await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),label+' overflow '+width);
}}
try{
 await page.goto('/dashboard/users');await page.waitForURL(u=>u.pathname==='/error/401');
 const notice=page.getByRole('button',{name:'Solo esta visita',exact:true});if(await notice.isVisible())await notice.click();
 await login('user@nocturno.test','UserDemo!2026','/account');
 for(const name of ['nocturno_access','nocturno_refresh']){
  const cookie=(await context.cookies(baseURL+'/api/auth/refresh')).find(c=>c.name===name);assert.ok(cookie);assert.equal(cookie.httpOnly,true);assert.equal(cookie.sameSite,'Lax');
 }
 assert.ok(!(await page.evaluate(()=>document.cookie)).includes('nocturno_access'));
 assert.equal(await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].some(v=>/^eyJ/.test(v))),false);
 await page.goto('/account');await page.locator('input[formcontrolname="displayName"]').waitFor();
 await page.locator('input[formcontrolname="displayName"]').fill('Perfil Cookie E2E');
 await page.locator('input[formcontrolname="avatarUrl"]').fill('https://nocturno-avatar.test/avatar.png');
 await page.getByRole('button',{name:/Guardar perfil/}).click();await page.getByText('Perfil guardado.',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('app-header app-avatar img')?.naturalWidth>0);
 assert.equal(await page.locator('app-header app-avatar img').getAttribute('src'),'https://nocturno-avatar.test/avatar.png');
 assert.ok((await page.locator('app-header').innerText()).includes('Perfil Cookie E2E'));
 await page.reload();await page.locator('app-header app-avatar img').waitFor();
 assert.equal(await page.locator('input[formcontrolname="avatarUrl"]').inputValue(),'https://nocturno-avatar.test/avatar.png');
 const refresh=(await context.cookies(baseURL+'/api/auth/refresh')).find(c=>c.name==='nocturno_refresh');
 await context.clearCookies();await context.addCookies([refresh]);await page.goto('/account');
 await page.locator('app-header app-avatar img').waitFor();assert.ok((await context.cookies(baseURL+'/api/profile/me')).some(c=>c.name==='nocturno_access'));
 await page.locator('input[formcontrolname="avatarUrl"]').fill('https://nocturno-avatar.test/missing.png');
 await page.getByRole('button',{name:/Guardar perfil/}).click();await page.locator('app-header app-avatar span').waitFor();
 await responsive('Profile');
 await page.goto('/dashboard/users');await page.waitForURL(u=>u.pathname==='/error/403');await logout();
 await login('admin@nocturno.test','AdminDemo!2026','/dashboard');await page.goto('/dashboard/users');
 await page.getByRole('heading',{name:/Usuarios/}).waitFor();
 await page.locator('input[name="search"]').fill('user@nocturno.test');await page.locator('select[name="active"]').selectOption('true');
 await page.getByRole('button',{name:'Filtrar',exact:true}).click();await page.getByRole('cell',{name:'user@nocturno.test',exact:true}).waitFor();
 page.on('dialog',d=>d.accept());await page.getByRole('row').filter({has:page.getByRole('cell',{name:'user@nocturno.test',exact:true})}).getByRole('button',{name:'Desactivar',exact:true}).click();
 await page.getByText('No hay usuarios con estos filtros.',{exact:true}).waitFor();
 await page.locator('select[name="active"]').selectOption('false');await page.getByRole('button',{name:'Filtrar',exact:true}).click();
 await page.getByRole('button',{name:'Activar',exact:true}).click();await page.getByText('No hay usuarios con estos filtros.',{exact:true}).waitFor();
 await responsive('Users');await page.reload();await page.getByRole('heading',{name:/Usuarios/}).waitFor();await logout();
 await login('promoter@nocturno.test','PromoterDemo!2026','/dashboard');await page.reload();await page.getByRole('navigation',{name:'Panel de gestión'}).waitFor();
 await page.goto('/dashboard/users');await page.waitForURL(u=>u.pathname==='/error/403');await logout();
 assert.ok(requests.length>0&&requests.every(r=>!r));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({cookiesHttpOnly:true,noBearer:true,f5:true,avatarReactive:true,avatarFallback:true,refresh:true,logout:true,roles:['USER','PROMOTER','ADMIN'],usersActiveFilter:true,responsive:[390,768,1280],pageErrors:0}));
}finally{await context.close();await browser.close()}
