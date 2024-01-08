{
	"translatorID": "05189607-49fe-43f6-8c68-9ffe931fd590",
	"label": "people.cn",
	"creator": "jiaojiaoduabi",
	"target": "^http://.*\\.people(\\.com\\.)?cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-08 07:34:41"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	if (/\/n.\/\d{4}\/\d{4}/.test(url)) {
		if (doc.querySelector('#paper_num')) {
			return 'newspaperArticle';
		}
		else {
			return 'webpage';
		}
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = Array.from(doc.querySelectorAll('a[href*="/n"]')).filter(element => /\/n.\/\d{4}\/\d{4}/.test(element.href));
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.textContent);
		if (!href || !title || title == '报刊导航') continue;
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
		for (let url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	var newItem = new Z.Item(detectWeb(doc, url));
	newItem.title = text(doc, '.rm_txt .pre') + text(doc, '.rm_txt h1') + text(doc, '.rm_txt .sub')
		|| text(doc, '.text_c h3#jtitle') + text(doc, '.text_c > h1') + text(doc, '.text_c h2#ftitle');
	newItem.shortTitle = text(doc, '.rm_txt h1') || text(doc, '.text_c > h1');
	newItem.abstractNote = attr(doc, 'meta[name="description"]', 'content');
	switch (newItem.itemType) {
		case 'newspaperArticle': {
			let pubInfo = text(doc, '#paper_num');
			newItem.publicationTitle = tryMatch(pubInfo, /《(.+)》/, 1).trim();
			if (newItem.publicationTitle === '人民日报') {
				newItem.ISSN = '1672-8386';
			}
			newItem.date = ZU.strToISO(tryMatch(pubInfo, /\d+年\d+月\d+日/));
			newItem.pages = tryMatch(pubInfo, /0*([1-9]\d*)版/, 1);
			break;
		}
		case 'webpage':
			newItem.websiteTitle = '人民网';
			newItem.date = ZU.strToISO(tryMatch(text(doc, '.channel'), /\d+年\d+月\d+日/));
			break;
	}
	newItem.language = 'zh-CN';
	newItem.url = url;
	newItem.libraryCatalog = '人民网';
	// "【.+】"见于http://world.people.com.cn/n1/2024/0102/c1002-40151100.html
	// ".sou1"见于http://theory.people.com.cn/
	let authors = [
		text(doc, '.author, .sou1').replace(/【.+】/, ''),
		tryMatch(text(doc, '.rm_txt_con > p[style*="indent"]', 0), /日[电讯]\s[(（［【[](.+?)[)）］】\]]/, 1),
	].join(' ');
	let editors = text(doc, '.edit');
	newItem.creators = [...processName(authors, 'author'), ...processName(editors, 'editor')];
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

function processName(creators, creatorType) {
	creators = creators
		.trim()
		.replace(/^[(（［【[]|[)）］】\]]$/g, '')
		.replace(/([^\u4e00-\u9fa5][\u4e00-\u9fa5])\s+([\u4e00-\u9fa5](?:[^\u4e00-\u9fa5]|$))/g, '$1$2')
		.split(/\s+|、|：/)
		.filter(creator => !/编|(?:记者)/.test(creator));
	creators = creators.map((creator) => {
		creator = ZU.cleanAuthor(creator, creatorType);
		creator.fieldMode = 1;
		return creator;
	});
	return creators;
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	if (match && match[index]) {
		return match[index];
	}
	return '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://gx.people.com.cn/n2/2024/0106/c179464-40705322.html",
		"items": [
			{
				"itemType": "webpage",
				"title": "一南一北的“双向奔赴”：广西“桂品”回礼东北老铁",
				"creators": [
					{
						"firstName": "",
						"lastName": "冯肖慧",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "何宁",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "雷琦竣",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "朱晓玲",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "许荩文",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2024-01-06",
				"abstractNote": "人民网南宁1月6日电（冯肖慧、何宁、雷琦竣）连日来，“广西‘小砂糖橘’勇闯哈尔滨”的故事不断上演，为感谢东北老铁对“砂糖橘”的喜爱，广西开始咔咔回礼啦！“广西老表”和“东北老铁”上演了一南一北的“双向",
				"language": "zh-CN",
				"url": "http://gx.people.com.cn/n2/2024/0106/c179464-40705322.html",
				"websiteTitle": "人民网",
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
		"url": "http://politics.people.com.cn/n1/2024/0108/c1001-40154267.html",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "为强国建设、民族复兴提供坚强保证——写在二十届中央纪委三次全会召开之际",
				"creators": [
					{
						"firstName": "",
						"lastName": "赵成",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "赵欣悦",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "胡永秋",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2024-01-08",
				"ISSN": "1672-8386",
				"abstractNote": "党的二十大擘画了全面建设社会主义现代化国家、以中国式现代化全面推进中华民族伟大复兴的宏伟蓝图，吹响了奋进新征程的时代号角。　　“中国式现代化是中国共产党领导的社会主义现代化，只有时刻保持解决大党独",
				"language": "zh-CN",
				"libraryCatalog": "人民网",
				"publicationTitle": "人民日报",
				"shortTitle": "为强国建设、民族复兴提供坚强保证",
				"url": "http://politics.people.com.cn/n1/2024/0108/c1001-40154267.html",
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
		"url": "http://www.people.com.cn/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://cpc.people.com.cn/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://theory.people.com.cn/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://finance.people.com.cn/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://opinion.people.com.cn/GB/223228/index.html",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://hlj.people.com.cn/",
		"items": "multiple"
	}
]
/** END TEST CASES **/
