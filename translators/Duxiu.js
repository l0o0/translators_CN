{
	"translatorID": "c198059a-3e3a-4ee5-adc0-c3011351365c",
	"label": "Duxiu",
	"creator": "Bo An",
	"target": "^https?://book\\.duxiu\\.com/(search|bookDetail)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2020-09-22 02:03:07"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Bo An

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

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			if (!items) {
				return true;
			}
			var articles = [];
			for (var i in items) {
				articles.push(i);
			}
			Zotero.Utilities.processDocuments(articles, scrapeAndParse);
		});
	}
	else {
		scrapeAndParse(doc, url);
	};
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('dt a');
	for (var i = 0; i < rows.length; i++) {
		var href = rows[i].href;
		var title = ZU.trimInternal(rows[i].textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

function detectWeb(doc, url) {
	var pattern = /book.duxiu.com\/search?/;
	if (pattern.test(url)) {
		return "multiple";
	}
	else {
		return "book";
	}
}

function scrapeAndParse(doc, url) {
	Zotero.Utilities.HTTP.doGet(url, function (page) {
		var pattern;
		//Z.debug(typeof(page));
		// 类型 item Type & URL
		var itemType = "book";
		var newItem = new Zotero.Item(itemType);
		newItem.url = url;
		newItem.abstractNote = "";
		// extra field to store extra data from Duxiu such as format, price, and/or identifiers.
		newItem.extra = "";
		
		// 标题 title.
		//pattern = /bookname="([\s\S]*?)"/;
		pattern=/<dt>([\s\S]*?)<\/dt>/;
		//Z.debug(page);
		if (pattern.test(page)) {
			Z.debug("test");
			var title = pattern.exec(page)[1];
			newItem.title = Zotero.Utilities.trim(title);
		}
		//newItem.title="test";
		
		// 外文题名 foreign title.
		pattern = /<dd>[\s\S]*外文题名[\s\S]*?：[\s\S]*?([\s\S]*?)<\/dd>/;
		if (pattern.test(page)) {
			var foreignTitle = trimTags(pattern.exec(page)[1]);
			
			newItem.foreignTitle = Zotero.Utilities.trim(foreignTitle);
		}
		page = page.replace(/\n/g, "");

		// 作者名 author name.
		pattern = /<dd>[\s\S]*?作[\s]*者[\s\S]*?：([\s\S]*?)<\/dd>/;
		if (pattern.test(page)) {
			var authorNames = trimTags(pattern.exec(page)[1]);

			// prevent English name from being split.
			authorNames = authorNames.replace(/([a-z])，([A-Z])/g, "$1" + " " + "$2");

			authorNames = authorNames.replace(/；/g, "，");
			authorNames = Zotero.Utilities.trim(authorNames);

			authorNames = authorNames.split("，");
			// Zotero.debug(authorNames);
			
			// list of role titles. used to remove the role title from the name of the creator.
			var titleMask = /本书主编$|本书副主编$|总主编$|总编辑$|总编$|编译$|编著$|主编$|副主编$|改编$|编$|著$|译$|选编$|摄影$|整理$|执笔$|合著$|撰$|编纂$|纂$|辑$|集注$|编辑$|原著$|主译$|绘$/;

			for (let i = 0; i < authorNames.length; i++) {
				var assignedRole = "";

				if (!determineRoles(authorNames[i])) {
					assignedRole = pickClosestRole(authorNames, i);
				}
				else {
					assignedRole = determineRoles(authorNames[i]);
				}
				
				var assignedName = Zotero.Utilities.trim(authorNames[i]).replace(titleMask, "");
				
				switch (assignedRole) {
					// Not all conditions listed since 编,译,著 catch most of their variations already.

					// series/chief editor
					case '总主编':
					case '总编辑':
					case '总编':
						newItem.creators.push({ lastName: assignedName,
							creatorType: "seriesEditor",
							fieldMode: 1 });
						break;
					
					// editor
					case '编':
					case '辑':
					case '选编':
					case '整理':
						newItem.creators.push({ lastName: assignedName,
							creatorType: "editor",
							fieldMode: 1 });
						break;
						
					// author
					case '著':
					case '执笔':
					case '撰':
					case '绘':
					case '纂':
					case '摄影':
					case '集解':
					case '集注':
						newItem.creators.push({ lastName: assignedName,
							creatorType: "author",
							fieldMode: 1 });
						break;

					// translator
					case '译':
						newItem.creators.push({ lastName: assignedName,
							creatorType: "translator",
							fieldMode: 1 });
						break;
					
					// multiple roles
					case '编著':
						newItem.creators.push({ lastName: assignedName,
							creatorType: "author",
							fieldMode: 1 });
						newItem.creators.push({ lastName: assignedName,
							creatorType: "editor",
							fieldMode: 1 });
						break;
					case '编译':
						newItem.creators.push({ lastName: assignedName,
							creatorType: "editor",
							fieldMode: 1 });
						newItem.creators.push({ lastName: assignedName,
							creatorType: "translator",
							fieldMode: 1 });
						break;

					// default as author
					default:
						newItem.creators.push({ lastName: assignedName,
							creatorType: "author",
							fieldMode: 1 });
				}
			}
		}
		
		// 出版地点 publication place.
		pattern = /<dd>[\s\S]*出版发行[\s\S]*?<\/span>([\s\S]*?)：[\s\S]*?<\/dd>/;
		if (pattern.test(page)) {
			var place = pattern.exec(page)[1];
			if (place.includes(",")) {
				// if publication place not provided, replace publisher with trimed info. from place field.
				newItem.publisher = Zotero.Utilities.trim(place.substring(0, place.indexOf(",")));
				place = "";
			}
			else if (Zotero.Utilities.trim(place).match(/^\d/)) {
				place = "";
			}
			else {
				newItem.place = Zotero.Utilities.trim(place);
			}
		}
		
		// 出版社 publisher.
		pattern = /<dd>[\s\S]*出版发行[\s\S]*?：([\s\S]*?),[\s\S]*?<\/dd>/;
		if (pattern.test(page)) {
			var publisher = pattern.exec(page)[1];
			if (place) {
				newItem.publisher = Zotero.Utilities.trim(publisher);
			}
		}
		
		// 出版时间 publication date.
		pattern = /<dd>[\s\S]*出版发行[\s\S]*?,([\s\S]*?)<\/dd>/;
		if (!pattern.test(page)) {
			pattern = /<dd>[\s\S]*出版发行[\s\S]*?([\s\S]*?)<\/dd>/;
		}
		if (pattern.test(page)) {
		// preserve Chinese characters used for the publication date of old books.
			var date = pattern.exec(page)[1].replace(/[^.\d民国清光绪宣统一二三四五六七八九年-]/g, "");
			newItem.date = Zotero.Utilities.trim(date);
		}
		
		// ISBN
		pattern = /<dd>[\s\S]*?ISBN号[\D]*(.*[\d])/;
		if (pattern.test(page)) {
			var isbn = pattern.exec(page)[1];
			newItem.ISBN = Zotero.Utilities.trim(isbn);
			if (newItem.ISBN.length < 13) {
				newItem.extra = "出版号: " + newItem.ISBN + "\n" + newItem.extra;
			}

			// Zotero does not allow non-standard but correct ISBN such as one that starts with 7
			else if (newItem.ISBN.length == 13 && newItem.ISBN.startsWith("7")) {
				newItem.ISBN = "978-" + newItem.ISBN;
			}
		}

		// 页数 number of pages.
		pattern = /页[\s]*数\D*([\s\S]*?)<\/dd>/;
		if (pattern.test(page)) {
			var numPages = pattern.exec(page)[1];
			newItem.numPages = Zotero.Utilities.trim(numPages);
		}
		
		// 丛书 book series.
		pattern = /<dd>[\s\S]*丛书名[\s\S]*?>([\s\S]*?)<\/dd>/;
		if (pattern.test(page)) {
			var series = trimTags(pattern.exec(page)[1]);
			newItem.series = Zotero.Utilities.trim(series);
		}
		// 原书定价 retail price.
		pattern = /原书定价\D*([\s\S]*?)<\/dd>/;
		if (pattern.test(page)) {
			var price = pattern.exec(page)[1];
			newItem.price = Zotero.Utilities.trim(price);
			newItem.extra += "原书定价: " + newItem.price + "\n";
		}
		
		// 开本 edition format.
		pattern = /<dd>[\s\S]*开本[\s\S]*?>([\s\S]*?)<\/dd>/;
		if (pattern.test(page)) {
			var format = trimTags(pattern.exec(page)[1]);
			newItem.format = Zotero.Utilities.trim(format);
			newItem.extra += "开本: " + newItem.format + "\n";
		}
		// 主题词 subject terms.
		pattern = /<dd>[\s\S]*主题词[\s\S]*?>([\s\S]*?)<\/dd>/;
		if (pattern.test(page)) {
			var subjectTerms = trimTags(pattern.exec(page)[1]);
			newItem.subjectTerms = Zotero.Utilities.trim(subjectTerms);
		}
	
		// 中图法分类号 CLC classification number.
		pattern = /<dd>[\s\S]*中图法分类号[\s\S]*?>([\s\S]*?)<\/dd>/;
		if (pattern.test(page)) {
			var callNumber = trimTags(pattern.exec(page)[1]);
			newItem.callNumber = Zotero.Utilities.trim(callNumber);
		}		
		
		// 参考文献格式 reference format.
		pattern = /<dd>[\s\S]*参考文献格式[\s\S]*?>([\s\S]*?)<\/dd>/;
		if (pattern.test(page)) {
			var refFormat = trimTags(pattern.exec(page)[1]);
			newItem.refFormat = Zotero.Utilities.trim(refFormat);
			
			newItem.extra = "参考格式: " + newItem.refFormat + "\n" + newItem.extra;
		}
		
		// 内容提要 abstract.
		pattern = /<dd>[\s\S]*内容提要[\s\S]*?>([\s\S]*?)<\/dd>/;
		if (pattern.test(page)) {
			var abstractNote = trimTags(pattern.exec(page)[1]);
			newItem.abstractNote = Zotero.Utilities.trim(abstractNote).replace(/&mdash;/g, "-") + "\n\n";
		}
		
		// use subject terms to populate abstract
		if (newItem.subjectTerms) {
			newItem.abstractNote = newItem.abstractNote + "主题词: " + newItem.subjectTerms;
		}
			
		// start the abstract with the foreign language title if available.
		if (newItem.foreignTitle) {
			newItem.abstractNote = "外文题名: " + newItem.foreignTitle + "\n\n" + newItem.abstractNote;
		}

		// SSID
		pattern = /<input name = "ssid" id = "forumssid" {2}value = "([\s\S]*?)"/;
		if (pattern.test(page)) {
			var SSID = trimTags(pattern.exec(page)[1]);
			newItem.SSID = Zotero.Utilities.trim(SSID);
			newItem.extra = newItem.extra + "SSID: " + newItem.SSID;
		}

		newItem.complete();
	});
}

// the list from which to pick the best role for a given creator. Do not add variants of strings that end with 著,译，编
var rolelist = ["总主编", "总编辑", "总编", "编著", "编译", "编", "整理", "执笔", "译", "著", "撰", "纂", "集解", "辑", "编辑", "集注","绘"];

function trimTags(text) {
	return text.replace(/(<.*?>)|\t|\r|(隐藏更多)|&nbsp;|/g, "");
}

// pick a role for a creator.
function determineRoles(name) {
	var role = "";
	for (var t = 0; t < rolelist.length; t++) {
		if (name.endsWith(rolelist[t]) && rolelist[t].length > role.length) {
			role = rolelist[t];
		}
	}
	return role;
}

// pick the closest role when the given creator has none.
function pickClosestRole(namelist, index) {
	var role = "";
	var i = index + 1;
	while (i < namelist.length && !role) {
		role = determineRoles(namelist[i]);
		i++;
	}
	return role;
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://book.duxiu.com/bookDetail.jsp?dxNumber=000030156491&d=6FE6151E7F61F282A69FD4026391966E&fenlei=020707020307&sw=%E6%B5%B7%E5%BE%B7%E6%A0%BC%E5%B0%94",
		"items": [
			{
				"itemType": "book",
				"title": "海德格尔文集  尼采  下",
				"creators": [
					{
						"lastName": "（德）海德格尔",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "孙周兴",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"lastName": "王庆节",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"lastName": "孙周兴",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "2015.11",
				"ISBN": "9787100094313",
				"abstractNote": "外文题名: Martin Heidegger Nietzsche\n\n尼采，F.W.（1844-1900）-哲学思想-研究\n\n本书分上、下两册，是作者1936至1940年间在弗莱堡大学做的讲座，又附加了若干篇论文，意在审视作者从1930年以来直至“关于人道主义的书信”（发表于1947年）所走过的思想道路。",
				"callNumber": "B516.47    ( 哲学、宗教->欧洲哲学->欧洲各国哲学->德国哲学 )",
				"extra": "（德）海德格尔著；孙周兴，王庆节主编；孙周兴译.海德格尔文集  尼采  下[M].北京：商务印书馆,2015.11.\n原书定价: 268.00（全2卷）\nSSID: 13943977",
				"libraryCatalog": "Duxiu",
				"numPages": "1235",
				"place": "北京",
				"publisher": "商务印书馆",
				"url": "https://book.duxiu.com/bookDetail.jsp?dxNumber=000030156491&d=6FE6151E7F61F282A69FD4026391966E&fenlei=020707020307&sw=%E6%B5%B7%E5%BE%B7%E6%A0%BC%E5%B0%94",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.duxiu.com/search?channel=search&gtag=&sw=%E5%9B%BD%E5%AD%A6&ecode=utf-8&Field=all&adminid=&btype=&seb=0&pid=0&year=&sectyear=&showc=0&fenleiID=&searchtype=&authid=0&exp=0&expertsw=&Sort=2",
		"items": "multiple"
	}
]
/** END TEST CASES **/
