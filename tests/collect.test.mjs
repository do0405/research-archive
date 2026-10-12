import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeReports, parseAqr, parseArticle, parseHana, parseIbk, parseKoreaInvestment, parseMirae, parseSamsung, parseYuanta } from '../scripts/collect.mjs';

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

test('Samsung public listing yields a direct PDF and identifies Korean quant research', () => {
  const html = '<tr><td class="l"><a href="/common.do?cmd=down&amp;fileName=3010/quant.pdf" title="(김동영) 퀀트 모델 추천 종목 PDF 원문보기(새창열림)">퀀트 모델</a></td><td>김동영</td><td>2026-10-12</td></tr>';
  const rows = parseSamsung(html, new Date('2026-10-13T00:00:00Z'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category, '퀀트 리서치');
  assert.equal(rows[0].url, 'https://www.samsungpop.com/common.do?cmd=down&fileName=3010%2Fquant.pdf');
});

test('Korea Investment public home listing uses an accessible detail URL', () => {
  const html = `<li><a class="view_con" href="javascript:void(0)" onclick="goDetail('/main/research/research/StrategyDetail.jsp?jkGubun=6&id=160091');return false"><p class="head">투자전략</p><strong class="body_tit">증시 전망</strong><p class="body_sub">공개된 소개</p></a><span class="info">리서치본부<em>2026.10.12</em></span></li>`;
  const rows = parseKoreaInvestment(html, new Date('2026-10-13T00:00:00Z'));
  assert.equal(rows.length, 1);
  assert.match(rows[0].url, /StrategyDetail\.jsp\?id=160091&jkGubun=6/);
  assert.equal(rows[0].teaser, '공개된 소개');
});

test('IBK public list points to its report detail and recognizes quant titles', () => {
  const html = '<tr class="tr_m"><td class="td_type_num">7817</td><td class="td_type_sub"><a href="#" onclick="enterpriseAnalysisView(\'12217\');">계량분석 퀀트 전략</a></td><td class="td_type_wrt">리서치본부</td><td class="td_type_day">2026-10-12</td></tr>';
  const rows = parseIbk(html, new Date('2026-10-13T00:00:00Z'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category, '퀀트 리서치');
  assert.match(rows[0].url, /enterpriseAnalysis_view\.do\?popup=null&seq=12217/);
});

test('Yuanta public strategy list links to its accessible detail and marks quant reports', () => {
  const html = '<tr class="js-moveRS"><td>2026/09/28</td><td class="txtL"><a href="#" cmd-type="view" data-seq="207591" class="ellipsis w">Quant Playbook 10월호<p class="w275 block ellipsis">Part 1. Quant Portfolio- </p></a></td></tr>';
  const rows = parseYuanta(html, new Date('2026-10-13T00:00:00Z'), 'RB30A');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category, '퀀트 리서치');
  assert.equal(rows[0].teaser, 'Part 1. Quant Portfolio-');
  assert.match(rows[0].url, /rs_view\.cmd\?cd006=&cd007=RB30&cd008=RB30A&SEQ=207591/);
  const company = '<tr class="js-moveRS"><td>2026/10/12</td><td><a href="#" class="js-jongname" data-jongcode="(079550)">LIG디펜스앤에어로스페이스</a></td><td class="txtL"><a href="#" cmd-type="view" data-seq="207764" class="ellipsis">3Q Pre: 예고된 실적 부진, 시선은 수주로<!--<p>2026/10/12</p>--></a></td></tr>';
  const companyRow = parseYuanta(company, new Date('2026-10-13T00:00:00Z'), 'RE01')[0];
  assert.equal(companyRow.title, 'LIG디펜스앤에어로스페이스: 3Q Pre: 예고된 실적 부진, 시선은 수주로');
  assert.equal(companyRow.teaser, '');
});

test('Morgan Stanley and Man Group publication dates are read from their public pages', () => {
  const morgan = '<meta property="og:title" content="Market Outlook"/><meta name="content_publishedAt" content="2026-09-29T04:00:00Z"/><meta name="description" content="Public introduction"/>';
  assert.equal(parseArticle(morgan, 'https://www.morganstanley.com/insights/articles/outlook', 'Morgan Stanley', new Date('2026-10-13T00:00:00Z'))?.publishedAt, '2026-09-29');
  const man = '<meta property="og:title" content="Factor Outlook"/><div id="article-date-text"><p>15 September 2026</p></div>';
  assert.equal(parseArticle(man, 'https://www.man.com/insights/factor-outlook', 'Man Group', new Date('2026-10-13T00:00:00Z'), '퀀트')?.publishedAt, '2026-09-15');
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

