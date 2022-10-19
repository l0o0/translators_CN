{
	"translatorID": "33ed4133-f48b-45e4-8f00-9b8c22342c0b",
	"label": "国图-中国标准在线服务网",
	"creator": "018<lyb018@gmail.com>",
	"target": "https?://vpn2\\.nlc\\.cn/prx",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2020-12-28 03:38:46"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 018<lyb018@gmail.com>

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

// eslint-disable-next-line
function attr(docOrElem,selector,attr,index){var elem=index?docOrElem.querySelectorAll(selector).item(index):docOrElem.querySelector(selector);return elem?elem.getAttribute(attr):null;}function text(docOrElem,selector,index){var elem=index?docOrElem.querySelectorAll(selector).item(index):docOrElem.querySelector(selector);return elem?elem.textContent:null;}function trim(content){return content.replace(/^[\xA0\s]+/gm, '').replace(/[\xA0\s]+$/gm, '').replace(/\n+/g, '\n').replace(/:\n+/g, ': ').replace(/]\n/g, ']').replace(/】\n/g, '】').replace(/\n\/\n/g, '/')}

// https://aurimasv.github.io/z2csl/typeMap.xml#map-statute

function detectWeb(doc, url) {
	return 'statute';
}

function doWeb(doc, url) {
	scrape(doc, url);
}



function scrape(doc, url) {
	if (!url || url.length <= 0) {
		return;
	}

	var _doc = doc;
	var code = doc.querySelector('#content > div.detail_title > table > tbody span.th_title').textContent;
	var spcUrl = 'https://www.spc.org.cn/online/' + code.replace('/', '%252F').replace(' ', '%2520') + '/?';
	ZU.processDocuments(spcUrl, (doc, url) => {
		var callback = (item) => {
			var a = _doc.querySelector('#content > div.detail_title > table > tbody > tr:nth-child(6) > td > a:nth-child(2)');
			if (a) {
				item.attachments.push({
					url: a.href,
					title: item.code,
					mimeType: 'application/pdf'
				});
			}
		};
		scrapeSpc(doc, url, callback);
	});
}

function scrapeSpc(doc, url, callback) {
	if (!url || url.length <= 0) {
		return;
	}
	
	var itemType = detectWeb(doc, url);
	var item = new Zotero.Item(itemType);
	item.url = url;

	var ps = doc.querySelectorAll('#content > div.detailedinfo-main ul > li p');
	for (var p of ps) {
		var tdTitle = p.textContent.replace('：', '').trim();
		if (!p.nextElementSibling) {
			continue;
		}

		var tdContent= p.nextElementSibling.textContent.trim();

		switch (tdTitle) {
			case '标准号':
				item.code = tdContent;
				break;
			case '标准名称':
				item.title = tdContent;
				break;
			case '英文名称':
				item.shortTitle = tdContent;
				break;
			case '出版语种':
				item.language = tdContent;
				break;
			case '标准状态':
				item.extra = tdContent;
				break;
			case '代替标准':
			case '替代以下标准':
				item.history = tdContent;
				break;
			case '实施日期':
				if (tdContent.length > 0) {
					item.dateEnacted = tdContent;
				}
				break;
			case '发布日期':
				if (!item.dateEnacted || item.dateEnacted.length === 0) {
					item.dateEnacted = tdContent;
				}
				break;
			case '标准ICS号':
				item.publicLawNumber = tdContent;
				break;
			case '中标分类号':
				item.codeNumber = tdContent;
				break;
			case '页数':
				item.pages = tdContent.replace(' 页', '');
				break;
			case '起草人':
				for(var c of tdContent.split('、')) {
					item.creators.push({
						lastName: c,
						creatorType: 'author',
						fieldMode: 1
					});
				}
				break;
			case '发布部门':
				item.rights = tdContent;
				break;
			default:
				break;
		}

		//if (tdContent && tdContent.length > 0) {
		//	abstractNote += tdTitle + '：' + tdContent + '\n';
		//}
	}
	item.abstractNote = doc.querySelector('#content > div.detailedinfo-top > div.stand-detail-description').textContent.replace(/标准简介|文前页下载| |\n|\t|/g, '')
		.replace('读者对象：', '\n读者对象：')
		.replace('适用范围：暂无', '');

	if (callback) {
		callback(item);
	}

	item.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/
