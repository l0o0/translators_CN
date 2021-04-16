{
	"translatorID": "5b731187-04a7-4256-83b4-3f042fa3eaa4",
	"label": "Ncpssd",
	"creator": "018<lyb018@gmail.com>",
	"target": "^https?://([^/]+\\.)?ncpssd\\.org/Literature/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2020-08-08 23:03:26"
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
function opt(val) {
	if (val && val.length > 0) {
		return val;
	}
	else {
		return '';
	}
}

function detectWeb(doc, url) {
	var dType = detectType(doc, url);
	if (dType) {
		return dType;
	} else if (getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('#ul_articlelist li');
	// Z.debug(rows.length);
	for (let row of rows) {
		let a = row.querySelector('.julei-list a');
		if (!a) {
			continue;
		}

		if (checkOnly) return true;
		
		var id = a.getAttribute("data-id");
		var type = a.getAttribute("data-name");
		var barcodenum = a.getAttribute("data-barcodenum");
		
		let url = getUrl(id, type, barcodenum);

		// Z.debug(url);
		let title = ZU.trimInternal(a.textContent);
		let downloads = row.querySelector('.number strong').textContent;
		let views = row.querySelector('.number strong+strong').textContent;
		
		found = true;
		items[url] = '[' + downloads + '/' + views + '] ' + title;
	}
	return found ? items : false;
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			// Z.debug(items);
			for (var url in items) {
				// Z.debug('url:' + url);
				scrape(doc, url);
			}
		});
	}
	else {
		scrape(doc, url);
	}
}

function scrapeAndParse(method, data, callback) {
	// Z.debug({ url })
	var baseUrl = 'http://www.ncpssd.org';
	var risRequest = baseUrl + '/ajax/articleinfoHandler.ashx?method=' + method;

	Zotero.Utilities.HTTP.doPost(risRequest, data, function (json) {
		if (callback && json) {
			callback(JSON.parse(json));
		}
	});
}

function getUrl(id, type, barcodenum) {
	var typename = "";
	var barcodenum1 = barcodenum;
	if (type == "journalArticle") {
		typename = "5Lit5paH5pyf5YiK5paH56ug";
	}
	if (type == "eJournalArticle") {
		typename = "5aSW5paH5pyf5YiK5paH56ug";
	}
	if (type == "Ancient") {
		typename = "5Y+k57GN";
	}
	if (type == "Book") {
		barcodenum1 = id;
		typename = "5aSW5paH5Zu+5Lmm";
	}
	if (type == "LocalRecords") {
		typename = "5pa55b+X";
	}
	if (type == "Conference") {
		typename = "5Lya6K6u6K665paH";
	}
	if (type == "Degree") {
		typename = "5a2m5L2N6K665paH";
	}
	
	/* eslint-disable no-undef */
	return 'http://www.ncpssd.org/Literature/articleinfo.aspx?id=' + btoa(id) + "&type=" + btoa(type) + "&typename=" + typename + "&datatype=" + btoa(type) + "&nav=0&barcodenum=" + (barcodenum1 ? btoa(barcodenum1) : '');
}

function getPdfUrl(pdfurl, type) {
	var pdftype = 0;
	if (type == "journalArticle") {
		pdftype = 1;
	}
	if (type == "eJournalArticle") {
		pdftype = 2;
	}
	if (type == "Ancient") {
		pdftype = 3;
	}
	if (type == "Book") {
		pdftype = 4;
	}
	
	return pdfurl + '&type=' + pdftype;
}

// 中文期刊文章
function scrapeJournalArticle(url) {
	var info = getFromURL(url);
	// Z.debug(info);
	if (info) {
		scrapeAndParse('getjournalarticletable', '{\'lngid\':\'' + info.id + '\'}', function (ret) {
			var json = ret[0];
			// Z.debug(json);
			// https://aurimasv.github.io/z2csl/typeMap.xml#map-journalArticle
			var type = 'journalArticle';
			var item = new Zotero.Item(type);
		
			item.url = url;
		
			item.title = json.title_c;
			
			item.date = (json.years ? (json.years + '年') : '');
			item.volume = opt(json.vol);
			item.issue = opt(json.num);
			item.pages = json.pagecount + (json.beginpage > 0 ? ('(' + json.beginpage + (json.endpage ? ('-' + json.endpage + '页)') : ')')) : '');

			switch (json.language) {
				case 1:
					item.language = '中文';
					item.publicationTitle = '《' + json.media_c + '》' + (json.media_e && json.media_e.length > 0 ? ('(' + json.media_e + ')') : '');
					item.abstractNote = json.remark_c;
		
					// Z.debug(item);
					// 标签
					var keywordcs = json.keyword_c;
					if (keywordcs && keywordcs.length > 0) {
						for (var kc of keywordcs.split(';')) {
							item.tags.push(kc);
						}
					}
					keywordes = json.keyword_e;
					if (keywordes && keywordes.length > 0) {
						for (var ke of keywordes.split(';')) {
							item.tags.push(ke);
						}
					}
				
					// 作者
					var creators1 = json.showwriter;
					for (var c1 of creators1.split(';')) {
						item.creators.push({
							lastName: c1.replace(/\[.*]/g, ''),
							creatorType: 'author',
							fieldMode: 1
						});
					}
		
					if (json.pdfurl) {
						item.attachments.push({
							title: 'Full Text PDF',
							mimeType: 'application/pdf',
							url: getPdfUrl(json.pdfurl, type)
						});
					}
					break;
				case 2:
					item.language = '外文';
					item.publicationTitle = '《' + json.media_e + '》';
					item.abstractNote = json.remark_c;
		
					// Z.debug(item);
					// 标签
					var keywordes = json.keyword_e;
					if (keywordes && keywordes.length > 0) {
						for (var k of keywordes.split(';')) {
							item.tags.push(k);
						}
					}
				
					// 作者
					var creators2 = json.showwriter;
					for (var c2 of creators2.split(',')) {
						item.creators.push({
							lastName: c2.replace(/\[.*]/g, ''),
							creatorType: 'author',
							fieldMode: 1
						});
					}
					break;
				default:
					break;
			}
			var showorgan = json.showorgan;
			if (showorgan && showorgan.length > 0) {
				for (var s of showorgan.split(';')) {
					if (!s || s.trim().length <= 0) continue;
					item.creators.push({
						lastName: s,
						creatorType: 'author',
						fieldMode: 1
					});
				}
			}
			
			item.complete();
		});
	}
}

// 外文期刊文章
function scrapeEJournalArticle(url) {
	scrapeJournalArticle(url);
}

// 古籍
function scrapeAncientBook(url) {
	var info = getFromURL(url);
	// Z.debug(info);
	// Z.debug(info.barcodenum);
	if (info && info.barcodenum) {
		scrapeAndParse('getancientbooktable', '{\'barcodenum\':' + info.barcodenum + '}', function (ret) {
			var json = ret[0];
			// Z.debug(json);
			// https://aurimasv.github.io/z2csl/typeMap.xml#map-book
			var type = 'book';
			var item = new Zotero.Item(type);
		
			item.url = url;
		
			item.title = json.title_c;
			item.ISBN = opt(json.isbn);
			item.publisher = opt(json.press);
			item.date = opt(json.pubdatenote);
			item.volume = opt(json.vol);
			item.issue = opt(json.num);

			item.language = '中文';
			item.publicationTitle = json.media_c ? ('《' + json.media_c + '》') : '';
			item.abstractNote = json.remark_c;

			// Z.debug(item);
			// 标签
			var keywordcs = json.keyword_c;
			if (keywordcs && keywordcs.length > 0) {
				for (var kc of keywordcs.split(';')) {
					item.tags.push(kc);
				}
			}
		
			// 作者
			var creators = json.showwriter;
			for (var c of creators.split(';')) {
				item.creators.push({
					lastName: c.replace(/\[.*]/g, ''),
					creatorType: 'author',
					fieldMode: 1
				});
			}

			var showorgan = json.showorgan;
			if (showorgan && showorgan.length > 0) {
				for (var s of showorgan.split(';')) {
					if (!s || s.trim().length <= 0) continue;
					item.creators.push({
						lastName: s,
						creatorType: 'author',
						fieldMode: 1
					});
				}
			}
		
			if (json.pdfurl) {
				item.attachments.push({
					title: 'Full Text PDF',
					mimeType: 'application/pdf',
					url: getPdfUrl(json.pdfurl, type)
				});
			}
			
			item.complete();
		});
	}
}

function scrape(doc, url) {
	var info = getFromURL(url);
	if (info) {
		var type = info.type;
		switch (type) {
			case 'journalArticle':
				scrapeJournalArticle(url);
				break;
			case 'eJournalArticle':
				scrapeEJournalArticle(url);
				break;
			case 'Ancient':
				scrapeAncientBook(url);
				break;
		
			default:
				break;
		}
	}
}

function detectType(doc, url) {
	var TYPE = {
		journalArticle: "journalArticle",
		eJournalArticle: "journalArticle",
		Ancient: "book",
		// Book: "book",
		// Conference: "thesis",
		// Degree: "thesis",
		// LocalRecords: "thesis"
	};
	var info = getFromURL(url);
	// Z.debug(info);
	if (info) {
		return TYPE[info.type];
	}

	return undefined;
}

function getFromURL(url) {
	if (!url) return false;
	
	var type = url.match(/[?&]type=([^&#]*)/i);
	var id = url.match(/[?&]id=([^&#]*)/i);
	var typename = url.match(/[?&]typename=([^&#]*)/i);
	var barcodenum = url.match(/[?&]barcodenum=([^&#]*)/i);
	if (!type || !type[1] || !id || !id[1] || !typename || !typename[1]) return false;
	
	/* eslint-disable no-undef */
	return {
		type: atob(type[1]),
		id: atob(id[1]),
		typename: atob(typename[1]),
		barcodenum: (barcodenum && barcodenum[1] ? atob(barcodenum[1]) : '')
	};
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.ncpssd.org/Literature/articleinfo.aspx?id=NzAwMTg3ODc4Mw==&type=am91cm5hbEFydGljbGU=&datatype=am91cm5hbEFydGljbGU=&typename=5Lit5paH5pyf5YiK5paH56ug&nav=0&barcodenum=",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "关键词法在大学英语词汇学习中应用效果的实证研究——以接受性和产出性测试为例",
				"creators": [
					{
						"lastName": "朱珺",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "杨继林",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "徐方雯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "[1]上饶师范学院外国语学院,江西上饶334001",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "[2]上饶师范学院教务处,江西上饶334001",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "需要学习者在母语与目的语之间找到发音相同或相近的词汇,在两个词汇之间构建语音连接,并以心理意象的形式记忆,利用言语和表象的双重编码过程促进记忆。这种词汇信息处理方式与常见的语义语境法不同,两种词汇学习方法值得进一步比较,为大学英语词汇教学提供启示。采用关键词法和语义语境法进行组间对比研究,可以发现在接受性和产出性两项测验中,前者的成绩皆明显优于后者,说明采取关键词法更能促进英语词汇的短时记忆、长时记忆和理解。",
				"libraryCatalog": "ncpssd",
				"pages": "112-118",
				"publicationTitle": "《上饶师范学院学报》(上饶师范学院学报)",
				"url": "http://www.ncpssd.org/Literature/articleinfo.aspx?id=NzAwMTg3ODc4Mw==&type=am91cm5hbEFydGljbGU=&datatype=am91cm5hbEFydGljbGU=&typename=5Lit5paH5pyf5YiK5paH56ug&nav=0&barcodenum=",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "关键词法"
					},
					{
						"tag": "短时记忆"
					},
					{
						"tag": "语义语境法"
					},
					{
						"tag": "长时记忆"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.ncpssd.org/Literature/articlelist.aspx?search=KElLVEU9IumVv+aXtuiusOW/hiIgT1IgSUtTVD0i6ZW/5pe26K6w5b+GIiBPUiBJS0VUPSLplb/ml7borrDlv4YiIE9SIElLU0U9IumVv+aXtuiusOW/hiIp&searchname=6aKY5ZCNL+WFs+mUruivjT0i6ZW/5pe26K6w5b+GIg==&nav=0",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.ncpssd.org/Literature/articleinfo.aspx?id=Q0FTUzQyODE2Mjc2&type=ZUpvdXJuYWxBcnRpY2xl&typename=5aSW5paH5pyf5YiK5paH56ug&nav=1&langType=2",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Patriot",
				"creators": [
					{
						"lastName": "Ross, Rick",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"issue": "2531958",
				"language": "外文",
				"libraryCatalog": "ncpssd",
				"pages": "null",
				"publicationTitle": "《》(Wings of Gold)",
				"url": "http://www.ncpssd.org/Literature/articleinfo.aspx?id=Q0FTUzQyODE2Mjc2&type=ZUpvdXJuYWxBcnRpY2xl&typename=5aSW5paH5pyf5YiK5paH56ug&nav=1&langType=2",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
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
