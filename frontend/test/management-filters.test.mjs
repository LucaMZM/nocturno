import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
const file = new URL('../node_modules/.cache/management-filters.mjs', import.meta.url);
await mkdir(new URL('.', file), {recursive:true});
await build({entryPoints:['src/app/features/dashboard/utils/management-filters.ts'],bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(file)});
const {parseManagementFilters,managementChips,managementQuery,madridMidnight,monthDays}=await import(file.href);
after(()=>rm(file,{force:true}));
test('filtros de gestión restauran URL, excluyen defaults y respetan papelera',()=>{
 const filters=parseManagementFilters(new URLSearchParams('status=PUBLISHED&municipality=Valencia&page=2&view=calendar&month=2026-11'),true);
 assert.equal(filters.page,'2');assert.equal(managementChips(filters).length,2);
 const restored=parseManagementFilters(new URLSearchParams(filters),true);
 assert.deepEqual(restored,filters);
 assert.equal(parseManagementFilters(new URLSearchParams('deleted=only'),false).deleted,'exclude');
 assert.equal(parseManagementFilters(new URLSearchParams('sort=DROP+TABLE&page=-1'),true).sort,'recent');
});
test('calendario solicita rango íntegro de Madrid y respeta DST y filtros',()=>{
 assert.equal(madridMidnight('2026-03-29').toISOString(),'2026-03-28T23:00:00.000Z');
 assert.equal(madridMidnight('2026-03-30').toISOString(),'2026-03-29T22:00:00.000Z');
 const filters=parseManagementFilters(new URLSearchParams('view=calendar&month=2026-03&municipality=Valencia'),true);
 const query=managementQuery(filters);
 assert.equal(query.dateFrom,'2026-02-28T23:00:00.000Z');
 assert.equal(query.dateTo,'2026-03-31T21:59:59.999Z');
 assert.equal(query.limit,'100');assert.equal(query.municipality,'Valencia');
 assert.equal(monthDays('2028-02').length,29);
});
