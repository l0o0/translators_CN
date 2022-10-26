{
	"translatorID": "f306107f-dabb-41ac-8fa2-f7f858feb11f",
	"label": "国家图书馆-文津搜索",
	"creator": "Xingzhong Lin",
	"target": "https?://find.nlc.cn/search",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2020-08-29 14:11:42"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Xingzhong Lin, https://github.com/Zotero-CN/translators_CN
	
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

function processURL(urls) {
	//Z.debug(urls);
	var url = urls.pop();
	//Z.debug(url);
	//ZU.doGet(url, function(text) {
	ZU.processDocuments(url,function(doc){
		//Z.debug(text);
		//var parser = new DOMParser();
		//var doc = parser.parseFromString(text, "text/html");
		//Z.debug(doc);
		scrape_multiple(doc, url);
		if (urls.length) {
			processURL(urls);
		}
	})
}

function detectWeb(doc, url) {
	if (url.includes('/search/showDocDetails')) {
		
		return detectType(doc);
	}
	else if (url.includes("search/doSearch?query")) {
		return 'multiple';
	}
	return false;
}

function detectType(doc) {
	var itemType = {
		普通古籍: "book",
		善本: "book",
		学位论文: "thesis",
		特藏古籍: "book",
		期刊论文:"journalArticle",
		期刊: "journalArticle",
		报纸: "newspaperArticle",
		专著: "book",
		报告: "report"
	};
	var type = ZU.xpath(doc, "//span[@class='book_val']");
	if (type.length) {
		Z.debug(type[0].textContent);
		return itemType[type[0].textContent];
	} else {
		return false;
	}
}


function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = ZU.xpath(doc, "//div[@class='article_item']");
	Z.debug(rows.length);
	if (checkOnly) {
		return rows.length ? 'multiple' : false;
	}
	for (let i=0; i < rows.length; i++) {
		//Z.debug(rows[i])
		let title = ZU.xpath(rows[i], ".//div[@class='book_name']/a")[0];
		//Z.debug(title.textContent);
		let click = title.getAttribute('onclick').split("'");
		//Z.debug(click);
		let href = "http://find.nlc.cn/search/showDocDetails?docId=" 
			+ click[3] 
			+ "&dataSource="
			+ click[5]
			+ "&query="
			+ encodeURI(click[7]);
		Z.debug(href);
		title = ZU.trimInternal(title.textContent);
		if (!href || !title) continue;
		found = true;
		items[href] = (i+1) + " " + title;
		//Z.debug(items[href]);
	}
	return found ? items : false;
}

function doWeb(doc, url) {
	
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			if (items) {
					//Z.debug(items);
					//items的keys是网址
					//items的value是title
					//Object.keys返回items对象可枚举属性的字符串数组,传入对象，返回属性名即网址
					processURL(Object.keys(items));
				}
		});
	}
	else {
		scrape(doc, url);
	}
}

function scrape(doc, url) {
	
	var type = detectType(doc);
	var newItem = new Zotero.Item(type);
	var detailA = ZU.xpath(doc, "//div[@class='book_wr']")[0].innerText;
	Z.debug(detailA);
	//Z.debug(detailA.replace(/\s*/g,""));
	var detailB = ZU.xpath(doc, "//div[@id='detail-info']")[0].innerText;
	Z.debug(detailB);
	var details = (detailA + "\n" + detailB).split("\n");
	Z.debug(details);
	var title = ZU.trimInternal(details[0]);
	
	//Z.debug(title);
	newItem.title = title;
	var date = details.filter((ele) => ele.startsWith("出版发行时间：") || ele.startsWith("论文授予时间"));
	
	if (date.length) {
		newItem.date = ZU.trimInternal(date[0].split("：")[1]);
	
	}
	var tags = details.filter((ele) => ele.startsWith("关键词"));
	if (tags.length) {
		
		newItem.tags = ZU.trimInternal(tags[0]).split("： ")[1].split(/[ -;]/);
	}
	var tagsEN = details.filter((ele) => ele.startsWith("英文关键词"));
	if (tagsEN.length) {
		newItem.tags = ZU.trimInternal(tagsEN[0]).split("： ")[1].split(/;/);
	}
	var place = details.filter((ele) => ele.startsWith("出版、发行地"));
	if (place.length) {
		newItem.place = place[0].split("： ")[1];
	}
	var pages = details.filter((ele) => ele.startsWith("载体形态") || ele.startsWith("页 ："));
	
	if (pages.length) {
		if(type==="book" || type === "thesis")//book和thesis的tiem中页数的关键词是numPages,其他类型是pages
			newItem.numPages = pages[0].split("： ")[1].replace("页", "");
			
		else 
		{
			newItem.pages = pages[0].split("： ")[1].replace("页", "");
		}
	}
	var publisher = details.filter((ele) => ele.startsWith("出版、发行者"));
	if (publisher.length) {
		newItem.publisher = publisher[0].split("： ")[1];
	}
	var authors = details.filter((ele) => ele.startsWith("所有责任者") || ele.startsWith("作者："));
	Z.debug(authors);
	if (authors.length) {
		if (authors[0].search(/[A-Za-z]/) !== -1) {
			authors = authors[authors.length-1].split("： ")[1].split(/[;|，]/)
		} else {
			authors = authors[authors.length-1].split("： ")[1].split(/[\s，;]+/)  // Special comma
			//Z.debug(authors);
		}
		newItem.creators = handleName(authors);
		//Z.debug(authors);
	}
	
	var language= details.filter((ele) => ele.startsWith("语种"));
	Z.debug(language);
	if(language.length){
		newItem.language=language[0].split("：")[1];
	}
	
	var note=ZU.xpath(doc, "//div[@class='zy_pp_val']");
	//Z.debug(note);
	if(note.length){
		//Z.debug("test");
		if(note[0].innerText.length){
			newItem.abstractNote=ZU.trimInternal(note[0].innerText);
		}
	}

	var university = details.filter((ele) => ele.startsWith("论文授予机构"));
	if (university.length) {
		newItem.university = university[0].split("： ")[1];
	}
	var abstract = details.filter((ele) => ele.startsWith("引文"));
	if (abstract.length) {
		newItem.abstractNote = abstract[0].split("：")[1];
	}
	var issue = details.filter((ele) => ele.startsWith("期"));
	if (issue.length) {
		newItem.issue = issue[0].split("：")[1];
	}
	var publication = details.filter((ele) => ele.startsWith("来源："));
	if (publication.length) {
		var tmp = publication[0].split("： ")[1].split(/,/);
		newItem.publication = tmp[0];
		tmp.length > 2 ? newItem.journalAbbreviation = tmp[1] : false;
	}
	var ISSN = details.filter((ele) => ele.startsWith("标识号"));
	if (ISSN.length) {
		newItem.ISBN = ISSN[0].split("： ")[1];
	}
	newItem.url = url;
	newItem.complete();
}

function scrape_multiple(doc,url){
	
	//因multiple情况下使用doGet返回的doc与single情况下不同，故单独处理
	var type = detectType(doc);
	var newItem = new Zotero.Item(type);
	var detailA = ZU.xpath(doc, "//div[@class='book_wr']")[0].innerText;
	//Z.debug(detailA);
	//Z.debug(detailA.replace(/\ +/g,""));
	var detailB = ZU.xpath(doc, "//div[@id='detail-info']")[0].innerText;
	//Z.debug(detailB);
	var details = (detailA + "\n" + detailB).split("\n");
	//Z.debug(details.filter((ele) => !ele.match(/^[ ]*$/)));
	details=details.filter((ele) => !ele.match(/^[ ]*$/));
	details=details.filter((ele) => !ele.match(/^[ \t]*$/));
	details=details.filter((ele) => !ele.match(/^[ ：]*$/));
	
	Z.debug(details);
	var title = ZU.trimInternal(details[0]);
	//Z.debug(title);
	newItem.title = title;
	//var date = details.filter((ele) => ele.startsWith("出版发行时间：") || ele.startsWith("论文授予时间"));
	var date=details[details.indexOf("出版发行时间："||"论文授予时间")+1];
	//Z.debug(date);
	if (date.length) {
		//newItem.date = ZU.trimInternal(date[0].split("：")[1]);
		newItem.date=ZU.trimInternal(date);
	}
	var tags=details.filter((ele) => ele.endsWith("关键词"))[0];
	if (tags.length) {
		tags = details[details.indexOf(tags)+1];
		newItem.tags = ZU.trimInternal(tags).split(/[ -|;]/);
	}
	
	var tagsEN = details.filter((ele) => ele.startsWith("英文关键词"));
	if (tagsEN.length) {
		newItem.tags = ZU.trimInternal(tagsEN[0]).split("： ")[1].split(/;/);
	}
	var place = details.filter((ele) => ele.endsWith("出版、发行地"));
	if (place.length) {
		place=details[details.indexOf(place[0])+1];
		newItem.place = ZU.trimInternal(place);
	}
	//var pages = details.filter((ele) => ele.startsWith("载体形态") || ele.startsWith("页 ："));
	var pages=details.filter((ele) => ele.endsWith("载体形态") || ele.endsWith("页 ："));
	Z.debug(pages);
	if (pages.length) {
		pages=details[details.indexOf(pages[0])+1];
		newItem.pages = pages.replace("页", "");
	}
	
	var publisher = details.filter((ele) => ele.startsWith("出版、发行者"));
	if (publisher.length) {
		publisher=details[details.indexOf(publisher[0])+1];
		newItem.publisher = ZU.trimInternal(publisher);
	}
	
	var authors = details.filter((ele) => ele.endsWith("所有责任者") || ele.startsWith("作者："));
	//Z.debug(authors);
	authors=details[details.indexOf(authors[0])+1];
	//Z.debug(authors);
	if (authors.length) {
		if (authors.search(/[A-Za-z]/) !== -1) {
			authors = authors.split(/;/)
		} else {
			authors = authors.split(/[\s，;]+/)  // Special comma
			//Z.debug(authors);
		}
		newItem.creators = handleName(authors);
		//Z.debug(authors);
	}
	
	var language= details.filter((ele) => ele.endsWith("语种"));
	if(language.length){
		language=details[details.indexOf(language[0])+1];
		newItem.language=ZU.trimInternal(language);
	}
	
	var note=ZU.xpath(doc, "//div[@class='zy_pp_val']");
	
	//Z.debug(note);
	if(note.length){
		if(note[0].innerText.length){
			newItem.abstractNote=ZU.trimInternal(note[0].innerText);
		}
	}
	
	var university = details.filter((ele) => ele.startsWith("论文授予机构"));
	if (university.length) {
		university=details[details.indexOf(university[0])+1];
		newItem.university =  ZU.trimInternal(university);
	}
	var abstract = details.filter((ele) => ele.startsWith("引文"));
	if (abstract.length) {
		newItem.abstractNote = abstract[0].split("：")[1];
	}
	var issue = details.filter((ele) => ele.startsWith("期"));
	if (issue.length) {
		newItem.issue = issue[0].split("：")[1];
	}
	var publication = details.filter((ele) => ele.startsWith("来源："));
	if (publication.length) {
		var tmp = publication[0].split("： ")[1].split(/,/);
		newItem.publication = tmp[0];
		tmp.length > 2 ? newItem.journalAbbreviation = tmp[1] : false;
	}
	var ISBN = details.filter((ele) => ele.endsWith("标识号"));
	//Z.debug(ISBN);
	ISBN=details[details.indexOf(ISBN[0])+1];
	if (ISBN.length) {
		//Z.debug(ISBN);
		Z.debug(ISBN.split(':')[1]);
		newItem.ISBN =  (ISBN.split(':')[1]);
	}
	newItem.url = url;
	newItem.complete();
}


function handleName(authors) {
	// 有英文
	var creators = [];
	for (let author of authors) {
		var creator = {};
		var lastSpace = author.lastIndexOf(' ');
		if (author.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
			// English
			creator.firstName = author.slice(0, lastSpace);
			creator.lastName = author.slice(lastSpace+1);
			
		} else {
			// Chinese
			if (authors.indexOf(author) > -1) {
				
				//if (author.endsWith("等") || author.endsWith("著")) {
				//	author = author.slice(0, author.length -1);
				//作者姓名可能以"等"、"等编"、"编著"、"主编"、"著"这几种形式结尾
				if (author.indexOf("等") !==-1) {
					author=author.slice(0,author.indexOf("等"));
					//Z.debug(author);
					// 去除等或著后与其他姓名重名，跳过
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}
				else if(author.indexOf("主") !==-1){
					author=author.slice(0,author.indexOf("主"));
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}
				else if(author.indexOf("编") !==-1){
					author=author.slice(0,author.indexOf("编"));
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}
				else if(author.indexOf("著") !==-1){
					author=author.slice(0,author.indexOf("著"));
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}
			
				
				
			}
			//Z.debug(author);
			creator.firstName = author.slice(1);
			creator.lastName = author.charAt(0);
			if (author.endsWith("指导")) {
				creator.creatorType = "contributor";
			}
		}
		creators.push(creator);
	}
	return creators;
}
// TEST URL
// http://find.nlc.cn/search/showDocDetails?docId=7225006674714026291&dataSource=ucs01,bslw&query=%E4%BF%A1%E7%94%A8
// http://find.nlc.cn/search/showDocDetails?docId=-8373230212045865087&dataSource=cjfd&query=wgcna
// http://find.nlc.cn/search/showDocDetails?docId=6614677564794870987&dataSource=wpqk&query=wgcna
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://find.nlc.cn/search/showDocDetails?docId=-4203196484494800823&dataSource=ucs01&query=%E6%B0%B4%E5%90%88%E7%89%A9",
		"items": [
			{
				"itemType": "book",
				"title": "天然气水合物气藏开发",
				"creators": [
					{
						"fistName": "平",
						"lastName": "郭"
					},
					{
						"fistName": "士鑫",
						"lastName": "刘"
					},
					{
						"fistName": "建芬",
						"lastName": "杜"
					}
				],
				"date": "2006",
				"libraryCatalog": "Wenjin",
				"place": "北京",
				"publisher": "石油工业出版社",
				"url": "http://find.nlc.cn/search/showDocDetails?docId=-4203196484494800823&dataSource=ucs01&query=%E6%B0%B4%E5%90%88%E7%89%A9",
				"attachments": [],
				"tags": [
					{
						"tag": "天然气水合物"
					},
					{
						"tag": "气田开发"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
