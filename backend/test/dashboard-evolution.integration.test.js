import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPool, closePool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { dashboardService } from '../src/services/dashboard.service.js';
import { dashboardListQuery } from '../src/validators/dashboard.validator.js';
import { eventViewsService } from '../src/services/event-views.service.js';

test('panel: filtros SQL, ventas, visitas consentidas y ámbito PROMOTER', {skip:!env.DATABASE_URL}, async()=>{
 const db=getPool(), venue=randomUUID(), promoter=randomUUID(), other=randomUUID(), a=randomUUID(), b=randomUUID();
 const slug='panel-'+a;
 try{
  await db.query("INSERT INTO venues(id,name,slug,type,province,municipality,address) VALUES($1,'Panel',$2,'CLUB','Valencia','Valencia','Prueba')",[venue,slug]);
  await db.query('INSERT INTO promoters(id,name,slug) VALUES($1,$2,$2)',[promoter,slug]);
  for(const [id,title,date] of [[a,'Alfa','2027-03-01T12:00:00Z'],[b,'Zeta','2027-04-01T12:00:00Z']])
   await db.query("INSERT INTO events(id,venue_id,promoter_id,title,slug,event_type,starts_at,ends_at,status) VALUES($1,$2,$3,$4,$5,'CLUB',$6,$6::timestamptz+interval '2 hours','PUBLISHED')",[id,venue,promoter,title,'panel-'+id,date]);
  const admin={role:'ADMIN'},actor={role:'PROMOTER',promoterId:promoter};
  const q=extra=>dashboardListQuery.parse({venueId:venue,municipality:'Valencia',...extra});
  assert.deepEqual((await dashboardService.listEvents(admin,q({sort:'titleDesc'}))).rows.map(e=>e.id),[b,a]);
  assert.equal((await dashboardService.listEvents(actor,q({dateTo:'2027-03-31T23:00:00Z'}))).total,1);
  assert.equal((await dashboardService.listEvents({role:'PROMOTER',promoterId:other},q({}))).total,0);
  assert.equal(dashboardListQuery.safeParse({sort:'e.id;DROP TABLE events'}).success,false);
  assert.equal(await eventViewsService.record(slug,{ip:'fixture-a',agent:'Mozilla/5.0'}),true);
  assert.equal(await eventViewsService.record(slug,{ip:'fixture-a',agent:'Mozilla/5.0'}),false);
  assert.equal(await eventViewsService.record(slug,{ip:'fixture-b',agent:'Crawler bot'}),false);
  assert.equal(await eventViewsService.record(slug,{ip:'fixture-c',agent:'Mozilla/5.0',purpose:'prefetch'}),false);
  assert.equal((await eventViewsService.ranking(actor,7))[0].views,1);
  assert.deepEqual(await eventViewsService.ranking({role:'PROMOTER',promoterId:other},30),[]);
  assert.equal((await dashboardService.listEvents(admin,q({sort:'views'}))).rows[0].id,a);
 }finally{
  await db.query('DELETE FROM events WHERE id=ANY($1::uuid[])',[[a,b]]);
  await db.query('DELETE FROM promoters WHERE id=$1',[promoter]);await db.query('DELETE FROM venues WHERE id=$1',[venue]);await closePool();
 }
});
