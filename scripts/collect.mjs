import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const reportsPath = new URL('../data/reports.json', import.meta.url);
const statusPath = new URL('../data/status.json', import.meta.url);
const cutoff = now => new Date(now.getTime() - 366 * 86400_000).toISOString().slice(0, 10);
const recent = (date, now) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= cutoff(now) && date <= now.toISOString().slice(0, 10);
const clean = value => String(value ?? '').replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const canonical = value => { const url = new URL(value); if (url.protocol !== 'https:') throw new Error('HTTPS link required'); url.hash = ''; url.searchParams.sort(); return url.toString(); };

export function parseAqr(html, now = new Date()) {
  const rows = [];
  for (const block of html.split(/<div class="search-list-v2__item[^\"]*"/).slice(1, 51)) {
    const title = block.match(/<a class="cta--black h2" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const date = block.match(/<p class="article__date[^\"]*">\s*([^<]+)<\/p>/);
    if (!title || !date) continue;
    const parsed = new Date(clean(date[1]));
    if (Number.isNaN(parsed.getTime())) continue;
    const publishedAt = parsed.toISOString().slice(0, 10);
    if (!recent(publishedAt, now)) continue;
    const teaser = block.match(/<p class="article__summary[^\"]*">([\s\S]*?)<\/p>/);
    const topic = block.match(/<p class="eyebrow article__eyebrow">([\s\S]*?)<\/p>/);
    rows.push({ title: clean(title[2]), source: 'AQR', region: '퀀트', category: '퀀트 리서치', publishedAt, url: canonical(new URL(title[1], 'https://www.aqr.com').toString()), teaser: clean(teaser?.[1]).slice(0, 320), author: 'AQR', ticker: '', topic: clean(topic?.[1]) });
  }
  return rows;
}

export function parseHana(html, now = new Date()) {
  const rows = [];
  for (const raw of html.split('<div class="con">').slice(1, 81)) {
    const block = raw.split('<div class="cb">')[0];
    const title = block.match(/<a[^>]*class="more_btn title"[^>]*>([\s\S]*?)<\/a>/);
    const date = block.match(/<span class="txtbasic">(\d{4})\.(\d{2})\.(\d{2})<\/span>/);
    const link = block.match(/<a href="([^"]+)"[^>]*class="j_fileLink"/);
    if (!title || !date || !link) continue;
    const publishedAt = `${date[1]}-${date[2]}-${date[3]}`;
    if (!recent(publishedAt, now)) continue;
    const intro = block.match(/<li class="mb7 j_bbsContn[^\"]*">([\s\S]*?)<\/li>/);
    const author = block.match(/<span class="none m-name">([\s\S]*?)<\/span>/);
    rows.push({ title: clean(title[1]), source: '하나증권', region: '한국', category: '자산배분', publishedAt, url: canonical(new URL(link[1], 'https://www.hanaw.com').toString()), teaser: clean(intro?.[1]?.trim().split(/\r?\n/)[0]).slice(0, 320), author: clean(author?.[1]), ticker: '', topic: '글로벌 자산전략' });
  }
  return rows;
}

export function parseMirae(html, now = new Date()) {
  const rows = [];
  for (const block of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const date = block.match(/<td[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/td>/);
    const title = block.match(/<div class="subject"><a href="javascript:view\('([0-9]+)','[0-9]+'\)"[^>]*>([\s\S]*?)<\/a>/);
    if (!date || !title || !recent(date[1], now)) continue;
    const parts = title[2].split(/<br\s*\/?\s*>/i);
    const name = clean(parts.join(' — '));
    rows.push({ title: name, source: '미래에셋증권', region: '한국', category: /퀀트|팩터|factor/i.test(name) ? '퀀트 리서치' : '리서치', publishedAt: date[1], url: `https://securities.miraeasset.com/bbs/board/message/view.do?categoryId=1521&messageId=${title[1]}`, teaser: clean(parts[1]).slice(0, 320), author: '', ticker: '', topic: '' });
  }
  return rows;
}

export function parseSamsung(html, now = new Date()) {
  const rows = [];
  for (const block of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const link = block.match(/<a\s+href="([^"]+\.pdf)"[^>]*title="([^"]+)"/i);
    const date = block.match(/<td>\s*(\d{4}-\d{2}-\d{2})\s*<\/td>/i);
    if (!link || !date || !recent(date[1], now)) continue;
    const title = clean(link[2].replace(/\s*PDF 원문보기.*$/, ''));
    const cells = [...block.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    rows.push({ title, source: '삼성증권', region: '한국', category: /퀀트|팩터|factor/i.test(title) ? '퀀트 리서치' : '리서치', publishedAt: date[1], url: canonical(new URL(link[1].replaceAll('&amp;', '&'), 'https://www.samsungpop.com').toString()), teaser: '', author: clean(cells[1]?.[1]), ticker: '', topic: '' });
  }
  return rows;
}

export function parseKoreaInvestment(html, now = new Date()) {
  const rows = [];
  for (const block of html.match(/<li>\s*<a\s+class="view_con"[\s\S]*?<\/li>/gi) ?? []) {
    const path = block.match(/goDetail\('([^']*StrategyDetail\.jsp\?[^']+)'\)/);
    const title = block.match(/<strong class="body_tit">([\s\S]*?)<\/strong>/);
    const date = block.match(/<em>(\d{4})\.(\d{2})\.(\d{2})<\/em>/);
    if (!path || !title || !date) continue;
    const publishedAt = `${date[1]}-${date[2]}-${date[3]}`;
    if (!recent(publishedAt, now)) continue;
    const head = clean(block.match(/<p class="head">([\s\S]*?)<\/p>/)?.[1]);
    const name = clean(title[1]);
    rows.push({ title: name, source: '한국투자증권', region: '한국', category: /퀀트|팩터|factor/i.test(`${head} ${name}`) ? '퀀트 리서치' : head || '리서치', publishedAt, url: canonical(new URL(path[1], 'https://securities.koreainvestment.com').toString()), teaser: clean(block.match(/<p class="body_sub">([\s\S]*?)<\/p>/)?.[1]).slice(0, 320), author: clean(block.match(/<span class="info">([^<]+)/)?.[1]), ticker: '', topic: head });
  }
  return rows;
}

export function parseIbk(html, now = new Date()) {
  const rows = [];
  for (const block of html.match(/<tr\s+class="tr_[^"]+">[\s\S]*?<\/tr>/gi) ?? []) {
    const id = block.match(/enterpriseAnalysisView\('([0-9]+)'\)/);
    const title = block.match(/<a\s+href="#"\s+onclick="enterpriseAnalysisView\('[0-9]+'\);">([\s\S]*?)<\/a>/i);
    const date = block.match(/<td class="td_type_day">(\d{4}-\d{2}-\d{2})<\/td>/i);
    if (!id || !title || !date || !recent(date[1], now)) continue;
    const name = clean(title[1]);
    rows.push({ title: name, source: 'IBK투자증권', region: '한국', category: /퀀트|계량|팩터|factor/i.test(name) ? '퀀트 리서치' : '리서치', publishedAt: date[1], url: canonical(`https://www.ibks.com/investment/research/enterpriseAnalysis_view.do?seq=${id[1]}&popup=null`), teaser: '', author: clean(block.match(/<td class="td_type_wrt">([\s\S]*?)<\/td>/i)?.[1]), ticker: '', topic: '' });
  }
  return rows;
}

export function parseYuanta(html, now = new Date(), section = 'RB30A') {
  const rows = [];
  for (const block of html.match(/<tr\s+class="js-moveRS">[\s\S]*?<\/tr>/gi) ?? []) {
    const date = block.match(/<td>\s*(\d{4})\/(\d{2})\/(\d{2})\s*<\/td>/i);
    const detail = block.match(/<a\s+href="#"\s+cmd-type="view"\s+data-seq="(\d+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!date || !detail) continue;
    const publishedAt = `${date[1]}-${date[2]}-${date[3]}`;
    if (!recent(publishedAt, now)) continue;
    const title = clean(detail[2].split(/<p\b/i)[0]);
    const teaser = clean(detail[2].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]).slice(0, 320);
    if (!title) continue;
    const group = section.startsWith('RB') ? 'RB30' : section;
    const subgroup = section.startsWith('RB') ? section : '';
    rows.push({ title, source: '유안타증권', region: '한국', category: /quant|퀀트|qwer|스크리닝|팩터|factor|계량/i.test(`${title} ${teaser}`) ? '퀀트 리서치' : '리서치', publishedAt, url: `https://account.myasset.com/myasset/research/rs_list/rs_view.cmd?cd006=&cd007=${group}&cd008=${subgroup}&SEQ=${detail[1]}`, teaser, author: '', ticker: '', topic: '투자전략' });
  }
  return rows;
}

const meta = (html, name) => { for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) if (new RegExp(`(?:name|property)=["']${name}["']`, 'i').test(tag)) return clean(tag.match(/content=["']([^"']*)["']/i)?.[1]); return ''; };
export function parseArticle(html, url, source, now, region = '미국') {
  const title = meta(html, 'og:title') || clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
  const dateText = meta(html, 'article:published_time') || meta(html, 'publishDate') || meta(html, 'publishedAt') || meta(html, 'content_publishedAt') || meta(html, 'displayDate') || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] || html.match(/<time[^>]*datetime="([^"]+)"/)?.[1] || clean(html.match(/id="article-date-text"[\s\S]{0,900}?<p>([^<]+)<\/p>/i)?.[1]);
  const date = dateText ? new Date(/^(?:[A-Za-z]+\s+\d{1,2},?|\d{1,2}\s+[A-Za-z]+)\s+\d{4}$/.test(dateText) ? `${dateText} UTC` : dateText) : null;
  if (!title || !date || Number.isNaN(date.getTime())) return null;
  const publishedAt = date.toISOString().slice(0, 10);
  if (!recent(publishedAt, now)) return null;
  return { title: title.slice(0, 240), source, region, category: /quant|factor|systematic|퀀트/i.test(title) ? '퀀트 리서치' : '리서치', publishedAt, url: canonical(url), teaser: (meta(html, 'description') || meta(html, 'og:description')).slice(0, 320), author: source, ticker: '', topic: '' };
}

export function mergeReports(existing, incoming) {
  const byUrl = new Map();
  for (const row of [...existing, ...incoming]) {
    if (!row || !row.title || !/^\d{4}-\d{2}-\d{2}$/.test(row.publishedAt ?? '')) continue;
    let url; try { url = canonical(row.url); } catch { continue; }
    const old = byUrl.get(url);
    byUrl.set(url, { ...old, ...row, id: old?.id || row.id || `gh-${createHash('sha256').update(url).digest('hex').slice(0, 24)}`, url });
  }
  return [...byUrl.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title));
}

async function fetchText(url, encoding = 'utf-8') {
  const response = await fetch(url, { headers: { 'User-Agent': 'ResearchArchive/1.0 (public metadata index)' }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new TextDecoder(encoding).decode(await response.arrayBuffer());
}
async function collectArticles(indexUrl, source, pattern, now, { region = '미국', limit = 30, urlFilter = () => true } = {}) {
  const html = await fetchText(indexUrl);
  const urls = [...new Set((html.match(pattern) ?? []).map(path => canonical(new URL(path, indexUrl).toString())))].filter(urlFilter).slice(0, limit);
  if (!urls.length) throw new Error('공식 목록에 기사 링크 없음');
  const outcomes = await Promise.allSettled(urls.map(async url => parseArticle(await fetchText(url), url, source, now, region)));
  return outcomes.filter(item => item.status === 'fulfilled' && item.value).map(item => item.value);
}

async function collectSitemap(sitemapUrl, source, urlPattern, now, limit = 45) {
  const xml = await fetchText(sitemapUrl);
  const matches = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:[\s\S]*?<lastmod>([^<]+)<\/lastmod>)?[\s\S]*?<\/url>/g)];
  const urls = matches.map(match => ({ url: match[1].replaceAll('&amp;', '&'), modified: match[2] ?? '' }))
    .filter(item => urlPattern.test(item.url) && (!item.modified || item.modified.slice(0, 10) >= cutoff(now)))
    .sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, limit);
  if (!urls.length) throw new Error('공식 사이트맵에 최근 기사 없음');
  const outcomes = await Promise.allSettled(urls.map(async item => parseArticle(await fetchText(item.url), item.url, source, now, '퀀트')));
  return outcomes.filter(item => item.status === 'fulfilled' && item.value).map(item => item.value);
}

async function collectSamsung(now) {
  const endpoint = 'https://www.samsungpop.com/sscommon/jsp/search/research/research_pop.jsp';
  const results = [];
  for (let page = 0; page < 12; page++) {
    const html = await fetchText(`${endpoint}?GUBUN=all&startCount=${page * 7}`);
    const rows = parseSamsung(html, now);
    if (!rows.length) break;
    results.push(...rows);
  }
  return results;
}

async function collectIbk(now) {
  const rows = [];
  for (let page = 1; page <= 6; page++) {
    const html = await fetchText(`https://www.ibks.com/investment/research/enterpriseAnalysis_list.do?current_page=${page}`, 'euc-kr');
    const batch = parseIbk(html, now);
    if (!batch.length) break;
    rows.push(...batch);
  }
  return rows;
}

async function collectYuanta(now) {
  const rows = [];
  for (const section of ['RB30A', 'RB30B', 'RB30C', 'RE01', 'RE02']) {
    const group = section.startsWith('RB') ? 'RB30' : section;
    const subgroup = section.startsWith('RB') ? section : '';
    const html = await fetchText(`https://account.myasset.com/myasset/research/rs_list/rs_list.cmd?cd006=&cd007=${group}&cd008=${subgroup}`);
    rows.push(...parseYuanta(html, now, section));
  }
  return rows;
}

export async function collectAll(now = new Date()) {
  let existing = [];
  try { existing = JSON.parse(await readFile(reportsPath, 'utf8')); } catch { /* First run. */ }
  let merged = existing;
  const checks = [];
  const sources = [
    ['AQR', async () => parseAqr(await fetchText('https://www.aqr.com/insights/research'), now)],
    ['하나증권', async () => parseHana(await fetchText('https://www.hanaw.com/main/research/research/list.cmd?cid=1&pid=1'), now)],
    ['미래에셋증권', async () => parseMirae(await fetchText('https://securities.miraeasset.com/bbs/board/message/list.do?categoryId=1521', 'euc-kr'), now)],
    ['삼성증권', async () => collectSamsung(now)],
    ['한국투자증권', async () => parseKoreaInvestment(await fetchText('https://securities.koreainvestment.com/main/research/Main.jsp'), now)],
    ['IBK투자증권', async () => collectIbk(now)],
    ['유안타증권', async () => collectYuanta(now)],
    ['Goldman Sachs', async () => collectArticles('https://www.goldmansachs.com/what-we-do/research', 'Goldman Sachs', /\/insights\/articles\/[a-z0-9-]+/gi, now)],
    ['J.P. Morgan', async () => collectArticles('https://www.jpmorgan.com/insights/research', 'J.P. Morgan', /\/insights\/(?:global-research|research)\/[a-z0-9\/-]+/gi, now)],
    ['Morgan Stanley', async () => collectArticles('https://www.morganstanley.com/what-we-do/research/', 'Morgan Stanley', /\/insights\/articles\/[a-z0-9-]+/gi, now)],
    ['Charles Schwab', async () => collectArticles('https://www.schwab.com/learn', 'Charles Schwab', /\/learn\/story\/[a-z0-9-]+/gi, now, { urlFilter: url => /market|stock|sector|economic|earnings|outlook|investment|research|fed|bond|portfolio/i.test(url) })],
    ['Fidelity', async () => collectArticles('https://www.fidelity.com/learning-center/trading-investing/finding-stocks-and-sector-ideas', 'Fidelity', /https:\/\/www\.fidelity\.com\/learning-center\/(?:trading-investing|investment-products)\/[a-z0-9\/-]+/gi, now, { limit: 45 })],
    ['Robeco', async () => collectArticles('https://www.robeco.com/en-int/insights', 'Robeco', /\/en-int\/insights\/20\d{2}\/\d{2}\/[a-z0-9-]+/gi, now, { region: '퀀트', urlFilter: url => !/podcast|episode|webinar/i.test(url) })],
    ['Man Group', async () => collectSitemap('https://www.man.com/sitemap.xml', 'Man Group', /^https:\/\/www\.man\.com\/insights\/(?!views-from-the-floor)[a-z0-9-]+$/, now)],
    ['Dimensional', async () => collectSitemap('https://www.dimensional.com/us-en/sitemap.xml', 'Dimensional', /^https:\/\/www\.dimensional\.com\/us-en\/insights\/[a-z0-9-]+$/, now)],
    ['Two Sigma', async () => collectArticles('https://www.twosigma.com/type/insights/', 'Two Sigma', /https:\/\/www\.twosigma\.com\/articles\/[a-z0-9-]+\//gi, now, { region: '퀀트', limit: 55, urlFilter: url => /investment|market|factor|portfolio|data|research|risk|return|model|trading|machine-learning/i.test(url) })],
  ];
  for (const [source, collect] of sources) {
    try { const rows = await collect(); if (!rows.length) throw new Error('최근 1년 공개 자료 없음'); const oldCount = merged.length; merged = mergeReports(merged, rows); checks.push({ source, status: 'ok', found: rows.length, added: merged.length - oldCount }); }
    catch (error) { checks.push({ source, status: 'error', detail: error instanceof Error ? error.message.slice(0, 180) : '수집 실패' }); }
  }
  await writeFile(reportsPath, `${JSON.stringify(merged, null, 2)}\n`);
  await writeFile(statusPath, `${JSON.stringify({ lastCheckedAt: now.toISOString(), total: merged.length, checks }, null, 2)}\n`);
  console.log(JSON.stringify({ total: merged.length, checks }));
  return { total: merged.length, checks };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check-status')) { const status = JSON.parse(await readFile(statusPath, 'utf8')); if (!status.checks.some(row => row.status === 'ok')) { console.error('No source refreshed successfully'); process.exitCode = 1; } }
  else await collectAll();
}

