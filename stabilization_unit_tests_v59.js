/* Real unit tests for the stabilization layer (extracted from the stabilized file).
   These are REAL executions of the actual shipped code — not copies. */
const fs = require('fs');
const assert = require('assert');

const src = fs.readFileSync('app_stab59.js', 'utf8');
let pass = 0, fail = 0;
function T(name, fn){ try { fn(); console.log('  PASS  ' + name); pass++; } catch (e){ console.log('  FAIL  ' + name + '  ->  ' + e.message); fail++; } }

/* ---- browser stubs needed by the extracted code ---- */
const calls = { toast: [] };
global.document = {
  createElement: () => ({ click(){}, remove(){}, set href(v){ this._h = v; }, get href(){ return this._h; }, download: '' }),
  body: { appendChild(){} }
};
global.URL = { createObjectURL: (b) => { global.__lastBlob = b; return 'blob:x'; }, revokeObjectURL(){} };
global.Blob = Blob;
global.toast = (m) => calls.toast.push(m);
global.esc = function esc(v){ return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
global.curUser = () => ({ id: 'u1', fn: 'رضا', ln: 'مرادی' });
global.todayJStr = () => '1404/01/01';
global.nowTimeStr = () => '10:00';
global.hasRole = (u, r) => u && Array.isArray(u.roles) && u.roles.indexOf(r) !== -1;

/* ---- extract shipped code blocks ---- */
function slice(a, b){
  const i = src.indexOf(a);
  const j = src.indexOf(b, i);
  if (i === -1 || j === -1) throw new Error('marker not found: ' + (i === -1 ? a : b));
  return src.slice(i, j);
}
const imgHelpers = slice('/* ═══ v1 پایدارسازی: پاک‌سازی منابع تصویری', 'function debounce');
/* backtrack to the opening /* of the layer comment block */
let li = src.indexOf('v1 پایدارسازی — لایه قرارداد داده');
let cstart = src.lastIndexOf('/*', li);
let cend = src.indexOf('/* ---- کمک‌کننده‌های داده ----', li);
if (li === -1 || cstart === -1 || cend === -1) throw new Error('contract layer markers not found');
const contractLayer = src.slice(cstart, cend);
const exportCsvCode = slice('function exportCSV', 'function downloadJSON');

console.log('=== Node unit tests — stabilization layer (real code execution) ===');

/* ---- 1) safeImgSrc / safeCssUrl ---- */
eval(imgHelpers);
T('safeImgSrc accepts data:image', () => assert.strictEqual(safeImgSrc('data:image/png;base64,AAA'), 'data:image/png;base64,AAA'));
T('safeImgSrc blocks javascript: URL', () => assert.strictEqual(safeImgSrc('javascript:alert(1)'), ''));
T('safeImgSrc blocks plain HTML injection', () => assert.strictEqual(safeImgSrc('" onerror="alert(1)'), ''));
T('safeImgSrc escapes quotes inside data URL', () => assert.strictEqual(safeImgSrc('data:image/png;x"y'), 'data:image/png;x&quot;y'));
T('safeImgSrc empty/null safe', () => { assert.strictEqual(safeImgSrc(''), ''); assert.strictEqual(safeImgSrc(null), ''); });
T('safeCssUrl blocks non-data CSS url', () => assert.strictEqual(safeCssUrl('a") body{background:red}'), ''));
T('safeCssUrl keeps data URL functional (scheme/;/, intact)', () => assert.strictEqual(safeCssUrl('data:image/png;base64,AA/B+C'), 'data:image/png;base64,AA/B+C'));
T('safeCssUrl neutralizes string-breakers', () => assert.strictEqual(safeCssUrl('data:image/png;base64,AA"x\'y\\z w'), "data:image/png;base64,AA%22x'y%5Cz%20w"));

/* ---- 2) exportCSV formula neutralization (real function, real output) ---- */
eval(exportCsvCode);
(async () => {
  let csv = '';
  global.Blob = class { constructor(parts){ this._p = parts; } async text(){ return this._p[0]; } };
  try {
    const pr = exportCSV('t.csv', ['عنوان', 'مبلغ'], [['=SUM(A1:A2)', '1234', 'normal'], ['-cmd', '@x', '+macro']]);
    /* exportCSV is sync; blob captured via URL.createObjectURL stub */
    csv = await global.__lastBlob.text();
  } catch (e){ csv = 'ERR:' + e.message; }
  T('exportCSV neutralizes leading =', () => assert.ok(csv.includes("'=SUM(A1:A2)"), csv));
  T('exportCSV neutralizes leading -', () => assert.ok(csv.includes("'-cmd"), csv));
  T('exportCSV neutralizes leading @', () => assert.ok(csv.includes("'@x"), csv));
  T('exportCSV neutralizes leading +', () => assert.ok(csv.includes("'+macro"), csv));
  T('exportCSV keeps normal values untouched', () => assert.ok(csv.includes(',1234,'), csv));
  T('exportCSV UTF-8 BOM present', () => assert.ok(csv.charCodeAt(0) === 0xFEFF, 'BOM'));
  runExecTests();
})().catch(e => { console.log('  FAIL  exportCSV harness: ' + e.message); fail++; runExecTests(); });

/* ---- 3) contract layer: exec path rules, scopes, sanitize ---- */
function runExecTests(){
  eval(contractLayer + '; globalThis.__execPaths = Object.keys(EXEC_PATHS);');
  const EXEC_PATHS_KEYS = globalThis.__execPaths;
  const mkApproved = () => ({ id: 'R-0001', ahp: { status: 'approved', approvalNo: 'AP-1404-0001' }, exec: { path: '', refId: '', refNo: '', note: '', byId: '', by: '', date: '', time: '' } });
  T('EXEC_PATHS has exactly two paths', () => assert.deepStrictEqual(EXEC_PATHS_KEYS.slice().sort(), ['contract', 'procurement']));
  T('execPathSet rejects invalid path', () => { const r = execPathSet(mkApproved(), 'project', 'X'); assert.strictEqual(r.ok, false); });
  T('execPathSet rejects unapproved micro', () => { const m = { id: 'R-9', ahp: { status: 'pending' }, exec: { path: '' } }; const r = execPathSet(m, 'procurement', 'X'); assert.strictEqual(r.ok, false); });
  T('execPathSet accepts valid first connection', () => { const m = mkApproved(); const r = execPathSet(m, 'procurement', 'PO-100'); assert.ok(r.ok && m.exec.path === 'procurement' && m.exec.refId === 'PO-100'); });
  T('execPathSet blocks switching to the other path', () => { const m = mkApproved(); execPathSet(m, 'procurement', 'PO-100'); const r = execPathSet(m, 'contract', 'CT-1'); assert.strictEqual(r.ok, false); });
  T('execPathSet blocks duplicate connection on same path', () => { const m = mkApproved(); execPathSet(m, 'procurement', 'PO-100'); const r = execPathSet(m, 'procurement', 'PO-200'); assert.strictEqual(r.ok, false); });
  T('execPathSet allows completing same path before refId set', () => { const m = mkApproved(); m.exec.path = 'contract'; const r = execPathSet(m, 'contract', 'CT-77'); assert.ok(r.ok && m.exec.refId === 'CT-77'); });
  T('execPathSet stamps auditor (who/when)', () => { const m = mkApproved(); execPathSet(m, 'procurement', 'PO-1'); assert.strictEqual(m.exec.byId, 'u1'); assert.ok(m.exec.date && m.exec.time); });
  T('microIsApproved logic', () => { assert.ok(microIsApproved({ ahp: { approvalNo: 'X' } })); assert.ok(!microIsApproved({ ahp: {} })); assert.ok(!microIsApproved(null)); });
  T('programReadyForFunding requires approved + approvedNo', () => { assert.ok(programReadyForFunding({ status: 'approved', approvedNo: 'APR-1' })); assert.ok(!programReadyForFunding({ status: 'approved' })); assert.ok(!programReadyForFunding({ status: 'pending_budget', approvedNo: 'X' })); });
  T('programUid returns uid only when present', () => { assert.strictEqual(programUid({ uid: 'PG-1' }), 'PG-1'); assert.strictEqual(programUid({}), ''); });

  const adminU = { roles: ['admin'] };
  const capOnly = { roles: ['budget'], budScopes: ['capital'] };
  const legacyBudget = { roles: ['budget'] };
  T('budScopesOf admin sees both', () => assert.deepStrictEqual(budScopesOf(adminU), ['capital', 'current']));
  T('budScopesOf restricted budget user', () => assert.deepStrictEqual(budScopesOf(capOnly), ['capital']));
  T('budScopesOf legacy user defaults to both (backward compat)', () => assert.deepStrictEqual(budScopesOf(legacyBudget), ['capital', 'current']));
  T('budScopeAllows respects restriction', () => { assert.ok(budScopeAllows(capOnly, 'capital')); assert.ok(!budScopeAllows(capOnly, 'current')); });
  T('headKindOf defaults to capital', () => { assert.strictEqual(headKindOf({ kind: 'current' }), 'current'); assert.strictEqual(headKindOf({}), 'capital'); assert.strictEqual(headKindOf(undefined), 'capital'); });
  global.db = { base: { budgetHeads: [{ id: 'h1', kind: 'capital' }, { id: 'h2', kind: 'current' }, { id: 'h3' }] } };
  T('budHeadsInScope filters correctly', () => { assert.deepStrictEqual(budHeadsInScope(capOnly).map(h => h.id), ['h1', 'h3']); assert.deepStrictEqual(budHeadsInScope(adminU).map(h => h.id), ['h1', 'h2', 'h3']); });
  T('headKindChip renders kind label', () => { assert.ok(headKindChip({ kind: 'current' }).indexOf('جاری') !== -1); assert.ok(headKindChip({}).indexOf('سرمایه') !== -1); });

  T('sanitizeRestoredDB strips malicious image fields', () => {
    const o = {
      users: [{ id: 'u1', username: 'a', avatar: 'javascript:alert(1)', sigMain: 'data:image/png;base64,AAA' }, { id: 'u2', username: 'b' }],
      programs: [{ code: 'BP-1404-0001', committerSig: { img: '<script>x</script>' } }, { bad: true }],
      base: null, settings: { logo: '<img src=x onerror=alert(1)>', appearance: { hdrImg: 'data:image/png;base64,B' }, print: { logo: 'javascript:x' } },
      notifs: 'not-an-array'
    };
    sanitizeRestoredDB(o);
    assert.strictEqual(o.users[0].avatar, '');
    assert.strictEqual(o.users[0].sigMain, 'data:image/png;base64,AAA');
    assert.strictEqual(o.programs.length, 1);
    assert.strictEqual(o.programs[0].committerSig.img, '');
    assert.strictEqual(o.settings.logo, '');
    assert.strictEqual(o.settings.appearance.hdrImg, 'data:image/png;base64,B');
    assert.strictEqual(o.settings.print.logo, '');
    assert.deepStrictEqual(o.notifs, []);
  });
  T('sanitizeRestoredDB rejects non-object', () => { let threw = false; try { sanitizeRestoredDB(null); } catch (e){ threw = true; } assert.ok(threw); });

  console.log('\n=== RESULT: ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
}
