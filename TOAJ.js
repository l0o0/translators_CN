{
	"translatorID": "262ecedb-bb92-4845-a281-cc79af979fbe",
	"label": "TOAJ",
	"creator": "jiaojiaodubai",
	"target": "^https://toaj\\.stpi\\.niar\\.org\\.tw",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-10-25 08:20:00"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero. If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/


function detectWeb(doc, url) {
	if (url.includes('/article/')) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('.title > a[href*="/article/"], .card > a[href*="/article/"]');
	for (const row of rows) {
		const href = row.href;
		const title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const newItem = new Z.Item('journalArticle');
	const data = getLabeledData(
		doc.querySelectorAll('.article-field__outer > div'),
		row => text(row, '.brown-label'),
		row => row.querySelector('.brown-label+*'),
		doc.createElement('div')
	);
	const zhTitle = text(doc, '.main-title').replace(/(\p{Unified_Ideograph})\s+(\p{Unified_Ideograph})/gu, '$1$2');
	const enTitle = ZU.capitalizeTitle(text(doc, '.sub-title'));
	if (zhTitle) {
		newItem.title = zhTitle;
		newItem.setExtra('original-title', enTitle);
	}
	else {
		newItem.title = enTitle;
	}
	newItem.abstractNote = data('中文摘要');
	try {
		const pubDoc = await requestDocument(attr(doc, '[x-data="content"] a[href*="/index/journal/"]', 'href'));
		newItem.publicationTitle = text(pubDoc, '.article__banner__text > div');
		newItem.setExtra('original-container-title', text(pubDoc, '.article__banner__text > div', 1));
	}
	catch (error) {
		Z.debug(error);
	}
	// The citation line (volume/issue/date/pages) used to be the second
	// element with class font-Space_Grotesk. Its position, its text format
	// and even its existence may change between site revisions, so scan all
	// candidates and degrade gracefully instead of throwing.
	const groups = getVolumeInfo(doc);
	if (groups) {
		newItem.volume = groups.volume;
		newItem.issue = groups.issue;
		newItem.pages = groups.pages;
		newItem.date = ZU.strToISO(`${groups.year}-${groups.month}`);
	}
	// DOI, shown next to the citation line when the article has one.
	// The site stores DOIs inconsistently across journals (bare DOI,
	// "doi.org/DOI", or a full URL) and blindly prefixes them with
	// https://doi.org/, so strip every leading doi.org/ prefix.
	const doi = attr(doc, 'a[href*="doi.org/"]', 'href');
	if (doi) {
		newItem.DOI = doi.replace(/^(?:(?:https?:\/\/)?doi\.org\/)+/, '');
	}
	newItem.language = zhTitle ? 'zh-TW' : 'en-US';
	newItem.url = url;
	newItem.libraryCatalog = '臺灣學術期刊開放取用平台';
	const creatorsExt = [];
	data('作者', true).querySelectorAll('div.gap-1').forEach((elm) => {
		const name = text(elm, 'div:first-child').replace(/\s*\*\s*$/, '');
		if (/\p{Unified_Ideograph}/u.test(name)) {
			const zhName = tryMatch(name, /^\p{Unified_Ideograph}+/u);
			const creator = {
				firstName: '',
				lastName: zhName,
				creatorType: 'author',
				fieldMode: 1
			};
			newItem.creators.push(creator);
			const original = ZU.cleanAuthor(name.substring(zhName.length), 'author');
			if (original) {
				newItem.extra = (newItem.extra || '').trim() + `\noriginal-author: ${original.lastName} || ${original.firstName}`;
				creatorsExt.push({
					...creator,
					original
				});
			}
		}
		else {
			newItem.creators.push(ZU.cleanAuthor(name, 'author'));
		}
	});
	if (creatorsExt.some(creator => creator.original)) {
		newItem.setExtra('creatorsExt', JSON.stringify(creatorsExt));
	}
	// PDF downloads on most journals are gated behind a CAPTCHA
	// (/file/article/verify-download/), which leaves the download button's
	// href as javascript:void(0); attach the PDF only when a journal does
	// expose a direct URL, otherwise fall back to a snapshot.
	const pdfLink = doc.querySelector('a.btn-download-pdf, a.text-decoration-underline');
	const pdfURL = pdfLink && /^https?:/.test(pdfLink.href) ? pdfLink.href : '';
	if (pdfURL) {
		newItem.attachments.push({
			url: pdfURL,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	else {
		newItem.attachments.push({
			title: 'Snapshot',
			document: doc
		});
	}
	newItem.tags = `${data('中文關鍵字')}；${data('英文關鍵字')}`
		.split(/[;；、,]\s*/)
		.map(tag => tag.trim())
		.filter(tag => tag);
	newItem.complete();
}

function getVolumeInfo(doc) {
	// The citation line lives in an element styled with font-Space_Grotesk;
	// its position varies (there is also one inside the "back to volume"
	// button), so scan every candidate and keep the first full match.
	// Volume/issue formats observed on the site:
	//   32卷3期 / 68卷3期 / 東吳歷史學報第45期 / 54(1) / 第32卷第3期 (legacy)
	const candidates = doc.querySelectorAll('.font-Space_Grotesk');
	for (const candidate of candidates) {
		const line = candidate.textContent.replace(/\s/g, '');
		// a year/month pair followed by a slash (or the end of the line)
		// marks the full citation line, as opposed to the back-button one
		const dateMatch = line.match(/\/(?<year>\d{4})\/(?<month>\d{1,2})(?=\/|$)/);
		if (!dateMatch) {
			continue;
		}
		// the segment before the date carries the volume/issue info
		const head = line.match(/^(.*?)\/\d{4}\//)[1];
		// volume markers vary by journal: 卷, 本 (e.g. 史語所集刊), 冊;
		// counts may be Arabic (32) or Chinese numerals (九十七)
		const volMatch = head.match(/(\d+|[一二三四五六七八九十百千零]+)[卷本冊]/);
		// issue markers vary: 期, 分, 號, 輯
		const issueMatch = head.match(/(?:第)?(\d+|[一二三四五六七八九十百千零]+)[期分號輯]/);
		const bothMatch = head.match(/(\d+)\((\d+)\)/);
		const parenMatch = head.match(/\((\d+)\)/);
		const pagesMatch = line.match(/pp\.?(?<pages>\d+(?:[-\u2013\u2014]\d+)?)/i);
		return {
			volume: volMatch ? String(parseCount(volMatch[1])) : (bothMatch ? String(parseCount(bothMatch[1])) : ''),
			issue: issueMatch ? String(parseCount(issueMatch[1])) : (bothMatch ? String(parseCount(bothMatch[2])) : (parenMatch ? String(parseCount(parenMatch[1])) : '')),
			year: dateMatch.groups.year,
			month: dateMatch.groups.month,
			pages: pagesMatch ? pagesMatch.groups.pages : ''
		};
	}
	return null;
}

// Counts are occasionally written in Chinese numerals, e.g. the citation
// line 第九十七本第三分 (volume 97, issue 3)
function parseCount(str) {
	if (/^\d+$/.test(str)) {
		return parseInt(str);
	}
	const digits = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
	const units = { 十: 10, 百: 100, 千: 1000 };
	let total = 0;
	let num = 0;
	for (const ch of str) {
		if (ch in digits) {
			num = digits[ch];
		}
		else if (ch in units) {
			// a bare 十 has an implicit leading 一 (十五 = 15)
			total += (num || 1) * units[ch];
			num = 0;
		}
	}
	return total + num;
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function getLabeledData(rows, labelGetter, dataGetter, defaultElm) {
	const labeledElm = {};
	for (const row of rows) {
		labeledElm[labelGetter(row, rows)] = dataGetter(row, rows);
	}
	const data = (labels, element = false) => {
		if (Array.isArray(labels)) {
			for (const label of labels) {
				const result = data(label, element);
				if (
					(element && /\S/.test(result.textContent))
					|| (!element && /\S/.test(result))) {
					return result;
				}
			}
			return element ? defaultElm : '';
		}
		const targetElm = labeledElm[labels];
		return targetElm
			? element ? targetElm : ZU.trimInternal(targetElm.textContent)
			: element ? defaultElm : '';
	};
	return data;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f98986bd4601898723c12f004e",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "評趙剛《清代開放海禁：1684-1757年中國的海洋政策》",
				"creators": [
					{
						"firstName": "",
						"lastName": "何漢威",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2014-09",
				"extra": "original-title: Review: Gang Zhao, The Qing Opening to the Ocean: Chinese Maritime Policies, 1684-1757\noriginal-container-title: Chinese Studies\noriginal-author: Ho || Ho Hon-wai\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"何漢威\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Ho Hon-wai\",\"lastName\":\"Ho\",\"creatorType\":\"author\"}}]",
				"issue": "3",
				"language": "zh-TW",
				"libraryCatalog": "臺灣學術期刊開放取用平台",
				"pages": "319-326",
				"publicationTitle": "漢學研究",
				"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f98986bd4601898723c12f004e",
				"volume": "32",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f99fb8bee501a1297597232359",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "利用新型模擬基準探討團隊表現",
				"creators": [
					{
						"firstName": "Laiton",
						"lastName": "Hedley",
						"creatorType": "author"
					},
					{
						"firstName": "Luke",
						"lastName": "Russell",
						"creatorType": "author"
					},
					{
						"firstName": "Murray S.",
						"lastName": "Bennett",
						"creatorType": "author"
					},
					{
						"firstName": "Ami",
						"lastName": "Eidels",
						"creatorType": "author"
					}
				],
				"date": "2026-09",
				"abstractNote": "構型處理或整體處理是指認知系統整合多個訊息來源時，其處理效率優於單一訊息來源時的處理。此一概念已被廣泛應用於個體層次的知覺與決策研究，近年也逐漸延伸至團隊研究，因而引出一項重要問題:團隊表現是否只是各成員獨立表現的總和，或團隊合作本身會產生額外的處理效益或成本?系統多因子技術可透過容量係數檢驗此類問題。容量係數以無限容量獨立平行模型為理論基準，該模型假設各成員彼此獨立、平行運作，且不受處理容量限制。然而，將此模型應用於團隊時，可能忽略環境限制與訊息來源彼此相依等因素;即使成員彼此獨立，這些因素仍可能影響團隊表現。本研究比較真人雙人團隊與一項新建立的模擬基準，即模擬獨立個體。我們建立兩種模擬雙人組，一種由兩個強化學習個體組成，另一種由一個強化學習個體與一個理想觀察者組成。兩種模型皆用來模擬雙人遊戲時的表現，並假設兩人彼此獨立。研究透過雙人遊戲作業，在不同負荷程度下分別操弄合作與分工情境。結果顯示，儘管模擬雙人組中的兩名個體彼此獨立，其表現仍持續低於無限容量獨立平行模型的理論基準，呈現有限容量。此結果顯示，即使不存在協調不良等團隊內部問題，外在刺激的相依性仍可能造成表現受限。進一步比較顯示，真人團隊雖同樣低於理論基準，其容量係數仍高於模擬雙人組，顯示即使在受限環境中，人際互動仍可能減少部分表現損失。本研究指出，在共享行動空間中，無限容量獨立平行模型可能高估團隊容量，並將環境限制造成的表現受限誤歸因於團隊協作效率不佳。模擬獨立個體因此提供一項成員獨立性已知的比較基準，有助於解釋團隊情境中的處理容量表現。本研究也顯示，將個體層次模型應用於團隊研究時，必須同時考量環境限制，並透過模擬方法驗證團隊效率的理論基準。",
				"DOI": "10.6129/CJP.202609_68(3).0002",
				"extra": "original-title: Benchmarking the Benchmark: A Novel Simulation Benchmark for Team Performance\noriginal-container-title: Chinese Journal of Psychology",
				"issue": "3",
				"language": "zh-TW",
				"libraryCatalog": "臺灣學術期刊開放取用平台",
				"pages": "133-150",
				"publicationTitle": "中華心理學刊",
				"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f99fb8bee501a1297597232359",
				"volume": "68",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "團隊合作"
					},
					{
						"tag": "工作負荷容量"
					},
					{
						"tag": "容量係數"
					},
					{
						"tag": "團體表現"
					},
					{
						"tag": "協作"
					},
					{
						"tag": "模擬"
					},
					{
						"tag": "teaming"
					},
					{
						"tag": "workload capacity"
					},
					{
						"tag": "Capacity Coefficient"
					},
					{
						"tag": "Group Performance"
					},
					{
						"tag": "Collaboration"
					},
					{
						"tag": "Simulation"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f99e45d979019f1ba931422bce",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "流產的兵變：中國共產黨與陝軍（1927-1934）",
				"creators": [
					{
						"firstName": "",
						"lastName": "陳耀煌",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2025-12",
				"abstractNote": "抗戰前中共的陝西黨與軍隊息息相關，不少黨員曾接受過軍事相關的訓練，還有很多黨員在陝西的地方軍隊裡工作。這些黨員許多是自發地進入陝軍，並不必然是被黨派遣進入部隊者。當中共派人到部隊裡要求這些黨員發動兵變時，部隊裡的黨員並不是完全順從，因為他們並不認為已經具備兵變的條件。即使兵變最後發動了，外來幹部與部隊的黨員間也是意見紛歧。兼之缺乏長遠計畫，兵變後的隊伍毫無目的地東奔西跑，以致最後失敗。本文擬透過對1935年中共中央抵達陝北前，中共在陝軍中的活動及其發動的幾起兵變進行分析，探究當時中共在白軍中的活動及其所發動兵變的若干特色。",
				"extra": "original-title: The Abortive Mutiny: The Chinese Communist Party and Shaanxi's Local Army (1927-1934)\noriginal-container-title: Soochow Journal of History\noriginal-author: Chen || Yao-Huang\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"陳耀煌\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Yao-Huang\",\"lastName\":\"Chen\",\"creatorType\":\"author\"}}]",
				"issue": "45",
				"language": "zh-TW",
				"libraryCatalog": "臺灣學術期刊開放取用平台",
				"pages": "67-109",
				"publicationTitle": "東吳歷史學報",
				"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f99e45d979019f1ba931422bce",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "中共"
					},
					{
						"tag": "陝西"
					},
					{
						"tag": "陝軍"
					},
					{
						"tag": "兵變"
					},
					{
						"tag": "楊虎城"
					},
					{
						"tag": "The Chinese Communist Party"
					},
					{
						"tag": "Shaanxi"
					},
					{
						"tag": "Shaanxi's local army"
					},
					{
						"tag": "mutiny"
					},
					{
						"tag": "Yang Hucheng"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f987544c340187593d5ce801b6",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "駱為祥",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "趙孟珂",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "靳永愛",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"tags": [
					{
						"tag": "戀愛"
					},
					{
						"tag": "青少年"
					},
					{
						"tag": "認知能力"
					},
					{
						"tag": "非認知能力"
					},
					{
						"tag": "傾向值加權"
					},
					{
						"tag": "romantic involvement"
					},
					{
						"tag": "adolescent"
					},
					{
						"tag": "cognitive skills"
					},
					{
						"tag": "non-cognitive skills"
					},
					{
						"tag": "propensity score weighting"
					}
				],
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"extra": "original-title: Effects of Romantic Involvement on Adolescents’ Cognitive and Noncognitive Skills: Evidence from China Education Panel Survey\noriginal-container-title: Bulletin of Educational Psychology\noriginal-author: Luo || Weixiang\noriginal-author: Zhao || Mengke\noriginal-author: Jin || Yongai\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"駱為祥\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Weixiang\",\"lastName\":\"Luo\",\"creatorType\":\"author\"}},{\"firstName\":\"\",\"lastName\":\"趙孟珂\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Mengke\",\"lastName\":\"Zhao\",\"creatorType\":\"author\"}},{\"firstName\":\"\",\"lastName\":\"靳永愛\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Yongai\",\"lastName\":\"Jin\",\"creatorType\":\"author\"}}]",
				"title": "談戀愛對青少年認知能力與非認知能力的影響：來自中國教育追蹤調查的證據",
				"abstractNote": "在西方國家，戀愛關係被看成青少年成長的一部分；在中國，青少年的戀愛關係被稱為早戀，通 常被認為是不合適宜的。談戀愛真的對中國青少年成長不利嗎？基於中國教育追蹤調查（2013— 2014 學年、2014—2015 學年）資料，使用傾向值加權的方法，本研究系統評估了談戀愛對中學生 的認知能力與非認知能力的影響。認知能力以認知能力測試得分、語數外成績班內標準分、班級 名次來測量；非認知能力以自我效能、抑鬱程度、對未來的信心、教育期望、學習態度來測量。 研究發現，相對於未談過戀愛的中學生，談過戀愛的中學生在認知能力和非認知能力方面的表現 顯著更差。在談戀愛影響認知能力的機制中，學業投入時間是一個重要的中介變項（mediator）， 談戀愛會透過減少學業投入時間來降低認知能力方面的表現。研究進一步發現，談戀愛的負面影 響在女學生當中表現得更為明顯。戀愛捲入程度愈深，其給青少年帶來的負面影響愈大。",
				"publicationTitle": "教育心理學報",
				"volume": "54",
				"issue": "1",
				"pages": "179-204",
				"date": "2022-09",
				"DOI": "10.6251/BEP.202209_54(1).0008",
				"language": "zh-TW",
				"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f987544c340187593d5ce801b6",
				"libraryCatalog": "臺灣學術期刊開放取用平台",
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f9961ac13801961e97fa1601ae",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "李宗諭",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "邱皓政",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "蘇宜芬",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"tags": [
					{
						"tag": "學用落差"
					},
					{
						"tag": "青年職涯"
					},
					{
						"tag": "交叉延宕"
					},
					{
						"tag": "縱貫研究"
					},
					{
						"tag": "educational tracking"
					},
					{
						"tag": "job-education match"
					},
					{
						"tag": "job satisfaction"
					},
					{
						"tag": "happiness"
					},
					{
						"tag": "youth"
					}
				],
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"extra": "original-title: Longitudinal Relationships among Educational Tracking, Job-Education Match, Job Satisfaction, and Happiness of Taiwan Youth\noriginal-container-title: Bulletin of Educational Psychology\noriginal-author: Li || Tsung-Yu\noriginal-author: Chiou || Haw-Jeng\noriginal-author: Su || Yi-Fen\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"李宗諭\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Tsung-Yu\",\"lastName\":\"Li\",\"creatorType\":\"author\"}},{\"firstName\":\"\",\"lastName\":\"邱皓政\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Haw-Jeng\",\"lastName\":\"Chiou\",\"creatorType\":\"author\"}},{\"firstName\":\"\",\"lastName\":\"蘇宜芬\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Yi-Fen\",\"lastName\":\"Su\",\"creatorType\":\"author\"}}]",
				"title": "青年教育分流、學用相符、工作滿意及快樂感之縱向關係",
				"abstractNote": "本研究以縱貫方法，探討青年在 25 歲、30 歲、33 歲三個時間點的生涯發展過程中，學用相符、 工作滿意及快樂感的關聯，並將高中職階段的教育分流（普通類、技職類）及相關預測變項納入 模型。分析資料來自臺灣教育長期追蹤資料庫（TEPS）及其後續調查資料庫（TEPS-B）的 SH 樣 本，共 1,637 人，以隨機截距交叉滯後模型（RI-CLPM）為分析方法。結果顯示，臺灣青年的學 用相符、工作滿意度及快樂感三者成正相關。在滯後效果方面，三波次間的學用相符及快樂感有 自回歸效果，工作滿意度則僅在後二波有自回歸效果；而除了 30 歲的快樂感能正向預測 33 歲的 工作滿意度，其餘交叉滯後效果皆未顯著。在預測變項方面，學歷對三個主要變項皆有正向預測 力；高三時後悔所選組科別對後來生涯的工作滿意度及快樂感有負向預測力。整體而言，教育分 流的調節作並不明顯，僅 25 歲到 30 歲間的少數路徑有差異；在二種教育分流各別樣本模型中， 發現高三時後悔所選科別對技職分流者的工作滿意度及快樂感有負向預測力，而生涯嘗試對普通 分流者的學用相符有正向預測力。最後，提供未來研究與實務建議。",
				"publicationTitle": "教育心理學報",
				"volume": "56",
				"issue": "3",
				"pages": "599-630",
				"date": "2025-03",
				"DOI": "10.6251/BEP.202503_56(3).0005",
				"language": "zh-TW",
				"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f9961ac13801961e97fa1601ae",
				"libraryCatalog": "臺灣學術期刊開放取用平台",
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f99fb8bee501a12e125df42382",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "吳修安",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"tags": [
					{
						"tag": "唐宋時期"
					},
					{
						"tag": "江西"
					},
					{
						"tag": "水路交通"
					},
					{
						"tag": "鄱陽湖"
					},
					{
						"tag": "贛江"
					},
					{
						"tag": "Tang and Song dynasties"
					},
					{
						"tag": "Jiangxi"
					},
					{
						"tag": "waterway transportation"
					},
					{
						"tag": "Poyang Lake"
					},
					{
						"tag": "Gan River"
					}
				],
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"extra": "original-title: Waterway Transportation in Jiangxi during the Tang and Song Dynasties: Poyang Lake and Its Waterway Network\noriginal-container-title: Bulletin of the Institute of History and Philology\noriginal-author: Wu || Xiu-an\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"吳修安\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Xiu-an\",\"lastName\":\"Wu\",\"creatorType\":\"author\"}}]",
				"title": "唐宋時期江西地區水路交通——以鄱陽湖為中心",
				"abstractNote": "本論文在重新探討鄱陽湖形成與演變的基礎上，對唐宋時期江西地區的水路交通進行考察。唐宋時期江西地區的水路交通主要受到內外兩個因素的影響，內部因素是鄱陽湖的形成與擴張，改變了鄡陽平原的水文環境，新形成的湖泊與入湖三角洲水系，成為水路交通發展的地理基礎。外部因素則是全國交通區位的轉變，政治中心逐漸東南移，由長安、開封，最終移至臨安，江西的交通優勢漸增。唐中後期，洪饒間的河湖水文已初步構成水路網，其中，擔石湖─贛江主泓道與信江鄔子港汊道─擔石湖─贛江趙圍汊道成為兩條南北水路交通線的組成部分。北宋時，鄱陽湖─贛江吳城山汊道取而代之，但湖水消退後，贛江主泓道仍肩負主要航運功能。南宋遷都臨安，信江鄔子港汊道─鄱陽湖─贛江趙圍汊道重要性大增，為東西水路交通的主要路線之一。最終形成以南康軍、隆興府與餘干縣為頂點的三角形水路交通網，北通長江，西南走贛江，東南接信江，串連全國水陸路交通。鄱陽湖隨季節消長的特性很大程度影響該地水域的航行，春末秋初湖水泛漲時，波濤洶湧的湖水甚至會危及航行安全，船隻則會避開湍急的河道；秋末春初湖水消退時，分流汊道水位大幅降低，甚至不通船舶。而贛江上游和中下游的航行條件則有所不同。",
				"publicationTitle": "中央研究院歷史語言研究所集刊",
				"volume": "97",
				"issue": "3",
				"pages": "385-453",
				"date": "2026-09",
				"language": "zh-TW",
				"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f99fb8bee501a12e125df42382",
				"libraryCatalog": "臺灣學術期刊開放取用平台",
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/search?queryText=%E4%B8%80%E5%80%8B%E4%B8%AD%E5%9C%8B",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/4b1141f98986bd46018986c597940023",
		"items": "multiple"
	}
]
/** END TEST CASES **/
