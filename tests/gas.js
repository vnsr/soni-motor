/* A small in-memory stand-in for the Google services Code.gs uses, so the Sheet API can be tested with
   plain Node (node --test). Only what Code.gs calls is here. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function ist(d) { return new Date(d.getTime() + 5.5 * 3600e3); }

class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = this.sh.rows[this.r - 1 + i] || [];
      out.push(Array.from({ length: this.nc }, (_, j) => row[this.c - 1 + j] === undefined ? '' : row[this.c - 1 + j]));
    }
    return out;
  }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.sh.set(this.r, this.c, x); return this; }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
}

class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  set(r, c, x) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = x; }
  getName() { return this.name; }
  getLastRow() { let n = this.rows.length; while (n && this.rows[n - 1].every(x => x === '' || x == null)) n--; return n; }
  getLastColumn() { return Math.max(0, ...this.rows.map(r => { let n = r.length; while (n && (r[n - 1] === '' || r[n - 1] == null)) n--; return n; })); }
  getMaxRows() { return Math.max(1000, this.rows.length); }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  appendRow(v) { this.rows.length = this.getLastRow(); this.rows.push(v.slice()); }
  deleteRow(r) { this.rows.splice(r - 1, 1); }
  setFrozenRows() { }
}

class Spreadsheet {
  constructor() { this.sheets = []; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
  getName() { return 'Test sheet'; }
  getId() { return 'sheet-id'; }
  setSpreadsheetTimeZone() { }
}

/** Loads Code.gs into a fresh sandbox. Returns the sandbox (all top-level functions) plus the fakes. */
function load(opts = {}) {
  const ss = new Spreadsheet();
  const cache = new Map(), props = new Map(), mails = [], logs = [];
  let now = opts.now ? new Date(opts.now) : new Date();
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(now.getTime()); } static now() { return now.getTime(); } }
  const sandbox = {
    Date: FakeDate, Math, JSON, String, Number, Object, Array, isFinite, Error, RegExp,
    SpreadsheetApp: { getActive: () => ss, flush() { } },
    CacheService: { getScriptCache: () => ({ get: k => cache.has(k) ? cache.get(k) : null, put: (k, v) => cache.set(k, String(v)), remove: k => cache.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => props.has(k) ? props.get(k) : null, setProperty: (k, v) => props.set(k, String(v)), deleteProperty: k => props.delete(k),
      getProperties: () => Object.fromEntries(props) }) },
    LockService: { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) },
    Utilities: {
      formatDate(d, tz, fmt) {
        const x = ist(d).toISOString();
        if (fmt === 'yyyy-MM-dd') return x.slice(0, 10);
        if (fmt === 'yyMMdd') return x.slice(2, 4) + x.slice(5, 7) + x.slice(8, 10);
        throw new Error('format ' + fmt);
      },
      getUuid: () => crypto.randomUUID()
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ text: s, setMimeType() { return this; } }) },
    Logger: { log: m => logs.push(String(m)) },
    MailApp: { sendEmail: m => mails.push(m) },
    ScriptApp: { getProjectTriggers: () => [] }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8') +
    '\n;globalThis.__api = { doGet, doPost, setup, checkSetup, dailyDigest, weeklyReport, loadDb_, readSettings_, digest_, rows_, upgradeShortPins, forgetPhones, VERSION };', sandbox);
  const g = sandbox.__api;
  const post = body => JSON.parse(g.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  const tab = name => g.rows_(ss, name);
  const setTime = iso => { now = new RealDate(iso); };
  return { g, ss, cache, props, mails, logs, post, tab, setTime };
}

/** A set-up sheet with two staff members (fixed PINs), one package and the owner's email. */
function ready(opts) {
  const env = load(opts);
  env.g.setup();
  const staff = env.ss.getSheetByName('Staff');
  staff.rows = [['Name', 'PIN', 'Active'], ['Ravi', '482913', 'Yes'], ['Office', '775031', 'Yes']];
  const pk = env.ss.getSheetByName('Packages');
  pk.rows = [pk.rows[0], ['P1', 'Swift', 'Manual', 15, 30, 5000, 'Yes'], ['P2', 'Baleno', 'Automatic', 12, 30, 6000, 'Yes']];
  const set = env.ss.getSheetByName('Settings');
  set.rows.forEach(r => { if (r[0] === 'OwnerEmail') r[1] = 'owner@example.com'; if (r[0] === 'SchoolPhone') r[1] = '9876543210'; });
  env.logs.length = 0;
  return env;
}

module.exports = { load, ready };
