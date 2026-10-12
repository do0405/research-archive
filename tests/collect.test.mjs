import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeReports, parseAqr, parseArticle, parseHana, parseMirae } from '../scripts/collect.mjs';

test('AQR listing yields a dated original article link and public introduction', () => {
  const html = '<div class="search-list-v2__item "><a class="cta--black h2" href="/Insights/Research/White-Papers/Test-Study">Test Study</a><p class="article__date">October 7, 2026</p><p class="article__summary">A public &amp; short introduction.</p><p class="eyebrow article__eyebrow">Factors</p></div>';
  const rows = parseAqr(html, new Date('2026-10-13T00:00:00Z'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].url, 'https://www.aqr.com/Insights/Research/White-Papers/Test-Study');
  assert.equal(rows[0].teaser, 'A public & short introduction.');
});

test('Hana listing keeps direct official PDF URL and source-provided introduction', () => {
  const html = '<div class="con"><h3><a href="#" class="more_btn title" id="1261_1289011">AI 투자와 금리</a></h3><span class="none m-name">이영주</span><span class="txtbasic">2026.10.07</span><li class="mb7 j_bbsContn txt contn m-rc-con">공개 소개 첫 줄\n둘째 줄</li><a href="/main/research/research/download.cmd?bbsSeq=1289011&attachFileSeq=1&bbsId=&dbType=&bbsCd=1261" class="j_fileLink">PDF</a></div><div class="cb"></div>';
  const rows = parseHana(html, new Date('2026-10-13T00:00:00Z'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].url, 'https://www.hanaw.com/main/research/research/download.cmd?attachFileSeq=1&bbsCd=1261&bbsId=&bbsSeq=1289011&dbType=');
  assert.equal(rows[0].teaser, '공개 소개 첫 줄');
});

test('Mirae listing uses a view page, avoiding the PDF download notice', () => {
  const html = '<tr><td>2026-10-12</td><td class="left"><div class="subject"><a href="javascript:view(\'2343289\',\'2584\')"><b>시장 전망</b><br/>원화와 금리</a></div></td><td>김석환</td></tr>';
  const rows = parseMirae(html, new Date('2026-10-13T00:00:00Z'));
  assert.equal(rows.length, 1);
  assert.match(rows[0].url, /messageId=2343289/);
  assert.equal(rows[0].teaser, '원화와 금리');
});

test('J.P. Morgan publication date is read from its public metadata', () => {
  const html = '<meta content="2026 Market Outlook" property="og:title"/><meta name="publishDate" content="July 1, 2026"/><meta name="description" content="A public introduction."/>';
  const row = parseArticle(html, 'https://www.jpmorgan.com/insights/global-research/outlook/mid-year-outlook', 'J.P. Morgan', new Date('2026-10-13T00:00:00Z'));
  assert.equal(row.publishedAt, '2026-07-01');
  assert.equal(row.teaser, 'A public introduction.');
});

test('archive merge preserves old reports and IDs, deduplicates URL, and adds stable IDs', () => {
  const old = { id: 'saved-id', title: 'old title', source: 'AQR', region: '퀀트', category: '리서치', publishedAt: '2025-01-01', url: 'https://www.aqr.com/old', teaser: '', author: '', ticker: '', topic: '' };
  const incoming = [ { ...old, title: 'updated title' }, { ...old, id: '', url: 'https://www.aqr.com/new', title: 'new title', publishedAt: '2026-10-12' } ];
  const once = mergeReports([old], incoming);
  const twice = mergeReports(once, incoming);
  assert.equal(once.length, 2);
  assert.equal(once.find(row => row.url.endsWith('/old')).id, 'saved-id');
  assert.equal(once.find(row => row.url.endsWith('/old')).title, 'updated title');
  assert.equal(once.find(row => row.url.endsWith('/new')).id, twice.find(row => row.url.endsWith('/new')).id);
});

