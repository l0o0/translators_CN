{
	"translatorID": "dbc3b499-88b6-4661-88c0-c27ac57ccd59",
	"label": "People's Daily Database",
	"creator": "pixiandouban",
	"target": "^https?://data.people.com.cn/rmrb",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-06-20 08:08:20"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2023 pixiandouban

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
	let box = doc.querySelector('#colorbox');
	if (box) {
		Z.monitorDOMChanges(box, { childList: true, subtree: true });
	}
	let lists = doc.querySelector('.title_list, .daodu_warp');
	if (doc.querySelector('.rmrb_detail_pop')) {
		return 'newspaperArticle';
	}
	else if (url.includes('qs') || lists) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.title_list a, .daodu_warp a, .sreach_li a.open_detail_link');
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.textContent);
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
		for (let url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	var newItem = new Zotero.Item('newspaperArticle');
	newItem.title = text(doc, 'div.title');
	newItem.publicationTitle = '人民日报';
	let subTitle = text(doc, 'div.subtitle');
	if (subTitle) {
		newItem.shortTitle = newItem.title;
		newItem.title += subTitle;
	}
	newItem.date = text(doc, 'div.sha_left span:nth-child(1)');
	newItem.pages = text(doc, 'div.sha_left span:nth-child(2)');
	newItem.language = 'zh-CN';
	newItem.ISSN = '1672-8386';
	newItem.url = url;
	text(doc, 'div.author').replace(/^【?本报记者 ?|】$/g, '').split(/[，、\s;]+/)
.forEach((creator) => {
	creator = ZU.cleanAuthor(creator, 'author');
	creator.fieldMode = 1;
	newItem.creators.push(creator);
});
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
		"url": "http://data.people.com.cn/rmrb/20231231/1?code=2",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://data.people.com.cn/rmrb/20231231/1/32924b7882d94d80ad59562d52280fbb",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "高高举起构建人类命运共同体光辉旗帜——二论贯彻落实中央外事工作会议精神",
				"creators": [
					{
						"firstName": "",
						"lastName": "本报评论员",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-12-31",
				"ISSN": "1672-8386",
				"language": "zh-CN",
				"libraryCatalog": "People's Daily",
				"pages": "1",
				"publicationTitle": "人民日报",
				"shortTitle": "高高举起构建人类命运共同体光辉旗帜",
				"url": "http://data.people.com.cn/rmrb/20231231/1/32924b7882d94d80ad59562d52280fbb",
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
		"url": "http://data.people.com.cn/rmrb/20240620/1/24c0fd81008447179e4e53127ac959d2",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "学党史  明党纪党纪学习教育开展以来，中国共产党历史展览馆充分发挥党史展览的教育功能——",
				"creators": [
					{
						"firstName": "",
						"lastName": "李林蔚",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-06-20",
				"ISSN": "1672-8386",
				"language": "zh-CN",
				"libraryCatalog": "People's Daily Database",
				"pages": "1",
				"publicationTitle": "人民日报",
				"shortTitle": "学党史  明党纪",
				"url": "http://data.people.com.cn/rmrb/20240620/1/24c0fd81008447179e4e53127ac959d2",
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
	}
]
/** END TEST CASES **/
