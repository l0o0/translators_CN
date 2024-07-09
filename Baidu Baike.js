{
	"translatorID": "867474da-38d5-48eb-90cf-64e90aeb04d3",
	"label": "Baidu Baike",
	"creator": "pixiandouban",
	"target": "^https?://baike\\.baidu\\.(com|hk)",
	"minVersion": "2.1.9",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-07-09 14:32:38"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2021 pixiandouban

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
	if (url.includes('/item/')) {
		return 'encyclopediaArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('a[class^="title_"][href*="/item/"]');
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
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url of Object.keys(items)) {
			scrape(await requestDocument(url));
		}
	}
	else {
		scrape(doc, url);
	}
}

function scrape(doc, _url) {
	const newItem = new Zotero.Item('encyclopediaArticle');
	newItem.title = text(doc, 'h1[class*="title"]');
	newItem.abstractNote = attr(doc, 'meta[name="description"]', 'content');
	newItem.encyclopediaTitle = '百度百科';
	newItem.date = attr(doc, 'meta[itemprop="dateUpdate"]', 'content');
	newItem.url = attr(doc, 'link[rel="canonical"]', 'href');
	newItem.libraryCatalog = '百度百科';
	newItem.language = 'zh-CN';
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://baike.baidu.com/item/%E6%9D%8E%E9%B8%BF%E7%AB%A0/28575",
		"items": [
			{
				"itemType": "encyclopediaArticle",
				"title": "李鸿章",
				"creators": [],
				"date": "2023-11-17 09:52:47",
				"abstractNote": "李鸿章（1823年2月15日－1901年11月7日），本名章铜，字渐甫、子黻，号少荃（一作少泉），晚年自号仪叟，别号省心，安徽省庐州府合肥县磨店乡（今属合肥市）人，中国清朝晚期政治家、外交家、军事将领。世人多称“李中堂”，又称“李二先生”“李傅相”“李文忠”。李鸿章为道光二十七年（1847年）进士，早年随业师曾国藩镇压太平天国运动与捻军起义，并受命组建淮军，因战功擢升至直隶总督，兼北洋通商大臣，累加至文华殿大学士，封一等肃毅伯。期间参与清廷在外交、军事、经济等方面的重大事务，先后创办江南制造局、轮船招商局、上海机器织布局和上海广方言馆等洋务机构，又组建了北洋水师。甲午战争中，因诸种失误，使北洋水师覆没，战后作为特使与日本签订《马关条约》。光绪二十五年（1899年），被启用为两广总督，翌年八国联军侵华战争爆发后，参与“东南互保”，并奉命北上谈判。光绪二十七年（1901年），李鸿章与庆亲王奕劻",
				"encyclopediaTitle": "百度百科",
				"language": "zh-CN",
				"libraryCatalog": "百度百科",
				"url": "https://baike.baidu.com/item/%E6%9D%8E%E9%B8%BF%E7%AB%A0/28575",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://baike.baidu.com/item/%E5%A4%A9%E6%B0%94/24449?fromModule=search-result_lemma",
		"items": [
			{
				"itemType": "encyclopediaArticle",
				"title": "天气",
				"creators": [],
				"date": "2024-01-05 08:30:32",
				"abstractNote": "天气（weather）是指某一个地区距离地表较近的大气层在短时间内的具体状态。而天气现象则是指发生在大气中的各种自然现象，即某瞬时内大气中各种气象要素（如气温、气压、湿度、风、云、雾、雨、闪、雪、霜、雷、雹、霾等）空间分布的综合表现。天气过程就是一定地区的天气现象随时间的变化过程。各种天气系统都具有一定的空间尺度和时间尺度，而且各种尺度系统间相互交织、相互作用。许多天气系统的组合，构成大范围的天气形势，构成半球甚至全球的大气环流。天气系统总是处在不断新生、发展和消亡过程中，在不同发展阶段有着其相对应的天气现象分布。",
				"encyclopediaTitle": "百度百科",
				"language": "zh-CN",
				"libraryCatalog": "百度百科",
				"url": "https://baike.baidu.com/item/%E5%A4%A9%E6%B0%94/24449",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://baike.baidu.com/search?word=%E5%A4%A9%E6%B0%94&pn=0&rn=0&enc=utf8",
		"items": "multiple"
	}
]
/** END TEST CASES **/
