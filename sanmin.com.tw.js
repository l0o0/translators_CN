{
	"translatorID": "8daefa97-6b0b-473e-a6aa-e76e866cdce8",
	"label": "sanmin.com.tw",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.sanmin\\.com\\.tw",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-03-11 00:18:29"
}

/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2025 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	if (url.includes('/product/')) {
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll(':where(h3, .Title) > a[href*="/product/"]');
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
	if (detectWeb(doc, url) === 'multiple') {
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
	const newItem = new Z.Item('book');
	newItem.title = text(doc, '.ProductInfo > h1')
		.replace(/（簡體書）$/, '')
		.replace(/\(([^(]+)\)/gu, (match, m1) => {
			return /\p{Unified_Ideograph}/u.test(m1)
				? `（${m1}）`
				: match;
		});
	newItem.abstractNote = text(doc, '#Intro1+.SectionBody');
	const data = getLabeledData(
		doc.querySelectorAll('.ProductInfo ul > li:has(.Bold)'),
		row => text(row, 'h3 > .Bold').slice(0, -1),
		(row) => {
			try {
				const rowCopy = row.cloneNode(true);
				rowCopy.querySelector('.Bold').remove();
				return rowCopy;
			}
			catch (error) {
				return null;
			}
		},
		doc.createElement('div')
	);
	newItem.series = data('系列名');
	newItem.edition = data('版次');
	newItem.publisher = data('出版社');
	newItem.date = ZU.strToISO(data('出版日'));
	newItem.numPages = tryMatch(data('裝訂／頁數'), /(\d+)頁/, 1);
	newItem.language = 'zh-TW';
	newItem.ISBN = data('ISBN13');
	newItem.url = url;
	newItem.libraryCatalog = '三民網路書店';
	const creatorsExt = [];
	data('作者', true).querySelectorAll('a').forEach((nameElm) => {
		let creatorType = 'author';
		const fullName = nameElm.innerText.trim();
		const role = tryMatch(fullName, /-(\p{Unified_Ideograph}+)$/u, 1);
		// https://www.sanmin.com.tw/product/index/013869577
		// https://www.sanmin.com.tw/product/index/013850229
		if (role && !/著作繪/.test(role)) {
			// https://www.sanmin.com.tw/product/index/013727202
			if (/[編彙纂]/.test(role)) {
				creatorType = 'editor';
			}
			else if (/譯/.test(role)) {
				creatorType = 'translator';
			}
			else if (/[增補訂校標審批評]/.test(role)) {
				creatorType = 'contributor';
			}
		}
		const country = tryMatch(fullName, /^\((\p{Unified_Ideograph}+)\)/u, 1);
		const original = tryMatch(fullName, /\(([^)]+?)\)$/, 1);
		const name = fullName
			.slice(0, -(role.length + 1))
			.slice(
				country ? country.length + 2 : 0,
				original ? -(original.length + 2) : fullName.length
			);
		const creator = /\p{Unified_Ideograph}/u.test(name)
			? {
				firstName: '',
				lastName: name
					.replace(/([A-Z])\.\s*/gu, '$1. ')
					.replace(/[•・]/, '·'),
				creatorType,
				fieldMode: 1
			}
			: ZU.cleanAuthor(name, creatorType);
		newItem.creators.push(ZU.deepCopy(creator));
		creator.country = country;
		creator.original = original;
		creatorsExt.push(creator);
	});
	if (creatorsExt.some(creator => creator.country || creator.original)) {
		newItem.setExtra('creatorExtra', JSON.stringify(creatorsExt));
	}
	newItem.complete();
}

function getLabeledData(rows, labelGetter, dataGetter, defaultElm) {
	const labeledElm = {};
	for (const row of rows) {
		const label = labelGetter(row, rows);
		const elm = dataGetter(row, rows);
		if (label && elm) {
			labeledElm[label] = elm;
		}
	}
	const data = (labels, element = false) => {
		if (Array.isArray(labels)) {
			for (const label of labels) {
				const result = data(label, element);
				if (
					(element && /\S/.test(result.textContent)) ||
					(!element && /\S/.test(result))) {
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

function tryMatch(string, pattern, index = 0) {
	const match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.sanmin.com.tw/product/index/012922310",
		"items": [
			{
				"itemType": "book",
				"title": "計算機組成與設計",
				"creators": [
					{
						"firstName": "",
						"lastName": "戴維‧A. 帕特森",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "約翰‧L. 亨尼斯",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-02-02",
				"ISBN": "9787111742661",
				"abstractNote": "本書採用開源的RISC-V指令系統體系結構，講解硬件技術、指令、算術運算、流水線、存儲層次、I/O以及並行處理器等。第2版將RV64切換為RV32以降低學習難度，新增關於領域定制體系結構(DSA)的討論以反映新的技術趨勢。此外，每一章都增加了“性能提升”和“自學”章節，並更新了大量練習題。",
				"extra": "creatorExtra: [{\"firstName\":\"\",\"lastName\":\"戴維‧A. 帕特森\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"美\",\"original\":\"David A. Patterson\"},{\"firstName\":\"\",\"lastName\":\"約翰‧L. 亨尼斯\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"美\",\"original\":\"John L. Hennessy\"}]",
				"language": "zh-TW",
				"libraryCatalog": "三民網路書店",
				"numPages": "732",
				"publisher": "機械工業出版社",
				"series": "經典原版書庫",
				"url": "https://www.sanmin.com.tw/product/index/012922310",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.sanmin.com.tw/product/index/010591721",
		"items": [
			{
				"itemType": "book",
				"title": "台灣文學英譯叢刊（No. 49）：台灣新時代女性小說專輯",
				"creators": [
					{
						"firstName": "Kuo-ch'ing",
						"lastName": "T",
						"creatorType": "author"
					}
				],
				"date": "2022-07-13",
				"ISBN": "9789863506089",
				"abstractNote": "For this special issue on “New Generation Women's Fiction from Taiwan,” we have specially invited Professor Lee Kuei Yun of the Graduate Institute of Taiwan Literature at Taiwan's Tsing Hua University to be guest editor and take responsibility for the selections. Because of space limitations it has been possible only to select twelve short stories by eleven woman writers. These writers were all born in the 1970s or later and their works were published in the year 2000 or later. Thus, they represent a period of social change in twenty-first century Taiwan and the spirit of the new generation. The introduction that we asked Professor Lee to provide is entitled “Trauma, esire, Contemporary Women's Voices.” Aside from giving a brief account of the eleven writers and their works, Professor Lee sketches “a number of writerly qualities that become perceptible… [that] represent the internal trauma, female consciousness, physical lust, cat-uman metaphors, and everyday life, etc.” In her introduction, what she particularly stresses is that the sexual desire depicted in these works exposes the internal wounds derived from private individual experience hidden away in the deepest levels of the female consciousness that are exposed for direct observation, and “… [from this] we can tease out a clear semblance of a feminine texture that reverberates with the unique sound of contemporary women's voices.” This then is one of the most important qualities of the new generation of aiwanese women's fiction. In the final analysis, trauma and writing about desire are two major themes of Taiwanese women's literature. 《台灣新世代女性小説》這一專輯，我們特地請台灣清華大學台灣文學研究所李癸雲教授擔任客座編輯，負責選稿。因受篇幅的限制，只選11位女性小説家的短篇小説12篇，作者都是1970年以後出生、其作品發表於2000年以後，反映出二十一世紀台灣社會的變動現象和新世代的精神樣貌。同時我們請李教授撰寫一篇導輪，題爲〈創傷．情慾．時代女聲〉，除了簡述11位作家及其作品之外，還勾勒出其中「隱隱浮現某些書寫特徵，關於內在創傷、女性意識、身體情慾、人與貓的互喻、日常生活等」。本輯導論〈創傷．情慾．時代女聲〉中所特別强調的是，這些作品所書寫的情慾、流露出女性意識底層所隱含的個人私密經驗的内在創傷，而正視創傷，「藉此梳理出形貌清晰的女性肌理，迴盪出『時代女聲』的特殊音色」，成爲新世代台灣女性小説的一大特徵。                            More",
				"edition": "初",
				"extra": "creatorExtra: [{\"firstName\":\"Kuo-ch'ing\",\"lastName\":\"T\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"杜國清\"},{\"firstName\":\"\",\"lastName\":\"\",\"creatorType\":\"editor\",\"country\":\"\",\"original\":\"\"}]",
				"language": "zh-TW",
				"libraryCatalog": "三民網路書店",
				"numPages": "254",
				"publisher": "臺大出版中心",
				"series": "台灣文學英譯叢刊",
				"url": "https://www.sanmin.com.tw/product/index/010591721",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.sanmin.com.tw/product/index/011775041",
		"items": [
			{
				"itemType": "book",
				"title": "水滸傳（上/下）（二版）（精）（限量刷金版）",
				"creators": [
					{
						"firstName": "",
						"lastName": "施耐庵",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "羅貫中",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "金聖嘆",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "繆天華",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2023-05-31",
				"ISBN": "9789571476261",
				"abstractNote": "各路英雄齊聚梁山，一百零八顆忠肝義膽，無畏強權、行俠仗義！ 梁山泊一百零八條好漢嘯聚的故事，自南宋以來即流傳於世，後經文人綴集成長篇小說《水滸傳》。書中最大的特色，在描寫事件、人物深刻佳妙，栩栩如生，且情節鋪陳布局極為緊湊，引人入勝。小說中花和尚大鬧桃花村、林教頭風雪山神廟、景陽岡武松打虎等等精采故事，人們早已耳熟能詳。讀《水滸傳》，看草澤英雄行俠仗義，為世人發不平之鳴，是何等大快人心！本書採用通行最廣的七十回本，頁端及頁末分別附有金聖嘆批語和詞語方言注釋，陪您一路痛快地造訪水滸英雄！",
				"edition": "二",
				"language": "zh-TW",
				"libraryCatalog": "三民網路書店",
				"numPages": "912",
				"publisher": "三民書局",
				"url": "https://www.sanmin.com.tw/product/index/011775041",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.sanmin.com.tw/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.sanmin.com.tw/search/index/?ct=K&qu=%E6%84%9B%E9%BA%97%E7%B5%B2&ls=SD",
		"items": "multiple"
	}
]
/** END TEST CASES **/
