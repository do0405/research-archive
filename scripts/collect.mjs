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
    rows.push({ title: clean(parts.join(' — ')), source: '미래에셋증권', region: '한국', category: '리서치', publishedAt: date[1], url: `https://securities.miraeasset.com/bbs/board/message/view.do?categoryId=1521&messageId=${title[1]}`, teaser: clean(parts[1]).slice(0, 320), author: '', ticker: '', topic: '' });
  }
  return rows;
}

const meta = (html, name) => { for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) if (new RegExp(`(?:name|property)=["']${name}["']`, 'i').test(tag)) return clean(tag.match(/content=["']([^"']*)["']/i)?.[1]); return ''; };
export function parseArticle(html, url, source, now) {
  const title = meta(html, 'og:title') || clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
  const dateText = meta(html, 'article:published_time') || meta(html, 'publishDate') || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] || html.match(/<time[^>]*datetime="([^"]+)"/)?.[1];
  const date = dateText ? new Date(/^[A-Za-z]+\s+\d{1,2},?\s+\d{4}$/.test(dateText) ? `${dateText} UTC` : dateText) : null;
  if (!title || !date || Number.isNaN(date.getTime())) return null;
  const publishedAt = date.toISOString().slice(0, 10);
  if (!recent(publishedAt, now)) return null;
  return { title: title.slice(0, 240), source, region: '미국', category: '리서치', publishedAt, url: canonical(url), teaser: (meta(html, 'description') || meta(html, 'og:description')).slice(0, 320), author: source, ticker: '', topic: '' };
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
async function collectArticles(indexUrl, source, pattern, now) {
  const html = await fetchText(indexUrl);
  const urls = [...new Set((html.match(pattern) ?? []).map(path => canonical(new URL(path, indexUrl).toString())))].slice(0, 20);
  if (!urls.length) throw new Error('공식 목록에 기사 링크 없음');
  const outcomes = await Promise.allSettled(urls.map(async url => parseArticle(await fetchText(url), url, source, now)));
  return outcomes.filter(item => item.status === 'fulfilled' && item.value).map(item => item.value);
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
    ['Goldman Sachs', async () => collectArticles('https://www.goldmansachs.com/what-we-do/research', 'Goldman Sachs', /\/insights\/articles\/[a-z0-9-]+/gi, now)],
    ['J.P. Morgan', async () => collectArticles('https://www.jpmorgan.com/insights/research', 'J.P. Morgan', /\/insights\/(?:global-research|research)\/[a-z0-9\/-]+/gi, now)],
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

