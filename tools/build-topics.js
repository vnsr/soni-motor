/* Builds the static question pages for search engines: quiz/topics/index.html, one page per topic,
   and sitemap.xml. Run after changing quiz/bank.js or the topic names in quiz/index.html:
     node tools/build-topics.js
   CI checks that the committed pages match (node tools/build-topics.js --check). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://vnsr.github.io/soni-motor/';
const QUIZ = SITE + 'quiz/';

function loadBank() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'quiz', 'bank.js'), 'utf8'), sandbox);
  return { bank: sandbox.window.BANK, signs: sandbox.window.SIGNS };
}
/* topic names come from the practice app itself, so they stay the same in both places */
function topicNames() {
  const html = fs.readFileSync(path.join(ROOT, 'quiz', 'index.html'), 'utf8');
  const found = [...html.matchAll(/topic: (\{[^}]*\})/g)].map(m => vm.runInNewContext('(' + m[1] + ')'));
  if (found.length !== 2) throw new Error('Expected the en and gu topic names in quiz/index.html');
  return { en: found[0], gu: found[1] };
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `:root{--bg:#EEF1F4;--surface:#FFF;--fg:#15191F;--muted:#59616D;--line:#D3D9E0;--accent:#C41E2A;--ok:#1B7A47}
@media (prefers-color-scheme:dark){:root{--bg:#0F1216;--surface:#181C22;--fg:#EBEEF2;--muted:#9EA6B2;--line:#2E353F;--accent:#FF6B74;--ok:#5ACB8A;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.55 'Hind Vadodara','Noto Sans Gujarati',system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:20px 16px 40px}a{color:var(--accent)}h1{font-size:26px;line-height:1.25;margin:0 0 6px}h2{font-size:20px;margin:28px 0 10px}
.sub{color:var(--muted);margin:0 0 16px}.cta{display:block;background:var(--accent);color:#fff;text-align:center;text-decoration:none;font-weight:700;border-radius:12px;padding:14px;margin:16px 0}
article{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:0 0 12px;display:flex;gap:14px}
article svg{width:84px;height:84px;flex:none}article h3{font-size:17px;margin:0 0 4px}article p{margin:2px 0}.a{color:var(--ok);font-weight:600}.why{color:var(--muted);font-size:15px}
.en{border-top:1px solid var(--line);margin-top:8px;padding-top:8px}ul.t{padding-left:20px}ul.t li{margin:6px 0}.note{color:var(--muted);font-size:14px}`;

function page({ title, desc, canonical, body, lang }) {
  return `<!DOCTYPE html>
<html lang="${lang || 'gu'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}icon-512.png">
<link rel="icon" href="../../icon-192.png">
<style>${CSS}</style>
</head>
<body><main>
${body}
<p class="note">Questions written by Soni Motor Training School, Karelibaug, Vadodara, from the rules of the road. The real RTO test uses its own questions. · આ પ્રશ્નો સ્કૂલે ટ્રાફિક નિયમોમાંથી તૈયાર કર્યા છે; સાચી RTO ટેસ્ટમાં RTOના પોતાના પ્રશ્નો હોય છે.</p>
</main></body>
</html>
`;
}

function build() {
  const { bank, signs } = loadBank(), names = topicNames(), topics = Object.keys(names.en), out = {};
  topics.forEach(k => {
    const qs = bank.filter(q => q.t === k);
    const body = `<p><a href="./">← બધા વિષય · All topics</a></p>
<h1>${esc(names.gu[k])} · ${esc(names.en[k])}</h1>
<p class="sub">લર્નિંગ લાઇસન્સ પ્રેક્ટિસના ${qs.length} પ્રશ્નો, જવાબ અને સમજૂતી સાથે · ${qs.length} learner's licence practice questions with answers and explanations.</p>
<a class="cta" href="../?src=topic-${k}">મફત ટેસ્ટ આપો · Take a free practice test</a>
${qs.map(q => `<article>${q.s && signs[q.s] ? signs[q.s] : ''}<div>
<h3>${esc(q.gu[0])}</h3><p class="a">${esc(q.gu[1])}</p><p class="why">${esc(q.gu[4])}</p>
<div class="en" lang="en"><h3>${esc(q.en[0])}</h3><p class="a">${esc(q.en[1])}</p><p class="why">${esc(q.en[4])}</p></div>
</div></article>`).join('\n')}
<a class="cta" href="../?src=topic-${k}">આ વિષયની પ્રેક્ટિસ કરો · Practise this topic</a>`;
    out[`quiz/topics/${k}.html`] = page({
      title: `${names.en[k]}: learner's licence questions in Gujarati and English · ${names.gu[k]}`,
      desc: `${qs.length} learner's licence (LL) practice questions on ${names.en[k].toLowerCase()}, with answers and explanations in Gujarati and English. Free practice test from Soni Motor Training School, Vadodara.`,
      canonical: `${QUIZ}topics/${k}.html`, body });
  });
  out['quiz/topics/index.html'] = page({
    title: "Learner's licence questions by topic, Gujarati and English · લર્નિંગ લાઇસન્સના પ્રશ્નો",
    desc: `${bank.length} learner's licence practice questions with answers, in Gujarati and English, by topic: road signs, signals, right of way, parking, documents and more.`,
    canonical: `${QUIZ}topics/`,
    body: `<h1>લર્નિંગ લાઇસન્સના પ્રશ્નો · Learner's licence questions</h1>
<p class="sub">${bank.length} પ્રશ્નો જવાબ સાથે, વિષય પ્રમાણે · ${bank.length} questions with answers, by topic.</p>
<a class="cta" href="../?src=topics">મફત ટેસ્ટ આપો · Take a free practice test</a>
<ul class="t">${topics.map(k => `<li><a href="${k}.html">${esc(names.gu[k])} · ${esc(names.en[k])}</a> (${bank.filter(q => q.t === k).length})</li>`).join('')}</ul>` });
  const urls = [SITE, QUIZ, QUIZ + 'topics/', ...topics.map(k => `${QUIZ}topics/${k}.html`)];
  out['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  return out;
}

const files = build(), check = process.argv.includes('--check');
let stale = [];
Object.entries(files).forEach(([rel, content]) => {
  const file = path.join(ROOT, rel);
  if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) stale.push(rel); return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
});
if (check && stale.length) { console.error('Out of date, run node tools/build-topics.js:\n  ' + stale.join('\n  ')); process.exit(1); }
console.log(check ? 'Topic pages up to date.' : 'Wrote ' + Object.keys(files).length + ' files.');
