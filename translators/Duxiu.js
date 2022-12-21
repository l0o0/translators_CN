{
	"translatorID": "c198059a-3e3a-4ee5-adc0-c3011351365c",
	"label": "Duxiu",
	"creator": "Bo An",
	"target": "(search|bookDetail|\\/base)",
	"minVersion": "6.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2022-12-21 09:06:52"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Bo An
	Copyright © 2022 YFdyh000

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

async function doWeb(doc, url) {
	var pagetype = detectWeb(doc, url);
	if (pagetype == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			if (!items) {
				return true;
			}
			var articles = [];
			for (var i in items) {
				articles.push(i);
			}
			ZU.processDocuments(articles, scrapeAndParse);
		});
	}
	else if (pagetype == "bookSection" || pagetype == "journalArticle") {
		await scrapeBookSection(doc, url);
	}
	else {
		scrapeAndParse(doc, url);
	};
}

async function scrapeBookSection(doc, url) {
	var scriptStrs = doc.querySelectorAll('script');
	var metaStr;
	var bookUrl;
	const DXbookRegex = /escape\('(https?:\/\/book\.duxiu\.com\/bookDetail.jsp\?.+)'\)+/  // 不适合参考联盟阅读界面
	const bookRegex = /dxid=(\d+)&SSID=(\d+)&PageNo="\+page\+"&A=(.+?)&/ // 适合读秀和参考联盟等。缺少d而无法使用
	const elseRegex = /var pageType = \d+;/ // 期刊等
	for (let i = scriptStrs.length - 1; i > 0; i--) {
		metaStr = scriptStrs[i].text;
		if (metaStr.length == 0) continue;

		bookUrl = getI(metaStr.match(DXbookRegex));
		if(bookUrl) {break;}
		if (!bookUrl && bookRegex.test(metaStr)) {
			//let key = bookRegex.exec(metaStr);
			//bookUrl = `http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=${key[1]}&d=...`;
			break;
		}
		if (elseRegex.test(metaStr)) break;
	}

	var pdfUrl = ZU.xpathText(doc, '//a[@id="saveAs"]/@href')
		|| ZU.xpathText(doc, '//li/a[text()="PDF"]/@href')
		|| ZU.xpathText(doc, '//li/a[text()="保存"]/@href');
	//Z.debug(pdfUrl);

	//Z.debug(bookUrl);
	if (!bookUrl) {
		if (doc.querySelector('#OriginInfo') && !ZU.xpathText(doc, '//div[@id="bookinfo"]/@content')) {
			getBookMetaFromPageOriginInfo(doc, url, pdfUrl, metaStr);
		} else {
			getBookMetaFromPage(doc, url, pdfUrl, metaStr);
		}
		return;
	}

	//Z.debug(bookUrl);
	var bookDoc = await requestDocument(bookUrl);
	/*if (bookDoc.URL.includes("/login.jsp?")) // 未登录，包括环境不支持（Scaffold，cookie异常）
	{
		// 传入测试样本供开发测试。
		//bookDoc = await requestDocument('https://bl.ocks.org/yfdyh000/raw/3d01e626fbc750c8e4719efa220d5752/?raw=true'); // <dl>信息较多的样本
		bookDoc = await requestDocument('https://jsbin.com/pekuvikayo'); // 信息较少的《中华民国现代名人录 中英文版》的<dl>
		//page="";
	}*/

	//Z.debug(bookDoc);
	scrapeAndParse(bookDoc, bookUrl, function(newItem) {
		//Z.debug(newItem);
		//Z.debug(doc.title);
		newItem.bookTitle = newItem.title;
		newItem.title = doc.title;

		//Z.debug(metaStr);
		let ssid = getI(metaStr.match(/var ssid = '(\d+)';/));
		if (typeof newItem.SSID == 'undefined' && ssid) {
			newItem.SSID = ssid;
		}
		//Z.debug(newItem.SSID);
		newItem.pages = getI(metaStr.match(/var page = (\d+);/));
		//Z.debug(newItem.pages);

		let pagesStr = getI(pdfUrl.match(/&PageRanges=(.+?)&/));
		newItem.attachments = getAttachments(pdfUrl, pagesStr)

		newItem.complete();
	}, doc);
}

function getI(array, index = 1, def = "") { // getItemFromArray
	if (Array.isArray(array)) {
		return index < array.length ? array[index] : def;
	} else {
		return def;
	}
}

// 部分页面bookinfo为空，提供#OriginInfo
function getBookMetaFromPageOriginInfo(doc, url, pdfUrl, metaStr) {
	var itemType = "journalArticle";
	var newItem = new Zotero.Item(itemType);
	newItem.url = url;
	newItem.abstractNote = "";

	var title = doc.title; // 可能为期刊名，没有在此页面中提供章节名
	title = ZU.trim(title);
	title = title.replace(/ +/g, " "); // https://developer.mozilla.org/docs/Web/CSS/white-space
	newItem.title = title;

	var meta = doc.querySelector('#OriginInfo').innerHTML;
	var metaText = doc.querySelector('#OriginInfo').innerText.replace(/ /g, "");
	metaText = metaText.replace(/(.+?):(.+)/g, "$1: $2"); // 补回冒号后空格，并小心书名有冒号
	//var metaText = ZU.trimInternal(doc.querySelector('#OriginInfo').innerText); // 无换行版
	newItem.extra = metaText;

	//Z.debug(meta);
	let jTitle = getI(meta.match(/<b>题名:<\/b>(.+?)\s*<\/li>/)).replace(/ +/g, " ");
	newItem.journalAbbreviation = jTitle;
	let year = getI(meta.match(/<b>年代:<\/b>(.+?)年?\s*<\/li>/));
	newItem.date = year;
	let issue = getI(meta.match(/<b>刊号:<\/b>第(\d+)期?\s*<\/li>/));
	newItem.issue = issue;

	//Z.debug(metaStr);
	newItem.SSID = getI(metaStr.match(/ssid: '(\d+)',/));
	//Z.debug(newItem.SSID);

	newItem.pages = getI(metaStr.match(/var page = (\d+);/));
	//Z.debug(newItem.pages);

	let pagesStr = getI(pdfUrl.match(/&PageRanges=(.+?)&/));
	newItem.attachments = getAttachments(pdfUrl, pagesStr)

	//newItem.libraryCatalog = "SuperLib";

	newItem.complete();
}

// 用于没有d=参数的阅读页面，无法取得书籍页面URL
function getBookMetaFromPage(doc, url, pdfUrl, metaStr) {
	var itemType = "book"; // bookSection备选。有页号但无章节名。
	var newItem = new Zotero.Item(itemType);
	newItem.url = url;
	newItem.abstractNote = "";

	var title = doc.title;
	title = ZU.trim(title);
	title = title.replace(/ +/g, " "); // https://developer.mozilla.org/docs/Web/CSS/white-space
	newItem.title = title;

	newItem.extra = doc.querySelector('#bookinfo').innerText.replace(/ +/g, " ");

	newItem.SSID = getI(metaStr.match(/origin\.jsp\?dxid=\d+&SSID=(\d+)&PageNo=/));
	//Z.debug(newItem.SSID);

	newItem.pages = getI(metaStr.match(/var page = (\d+);/));
	//Z.debug(newItem.pages);

	let pagesStr = getI(pdfUrl.match(/&PageRanges=(.+?)&/));
	newItem.attachments = getAttachments(pdfUrl, pagesStr)

	//newItem.libraryCatalog = "SuperLib";

	newItem.complete();
}

function getAttachments(pdfurl, pagesStr) {
	var attachments = [];
	attachments.push({
		title: `Full Text PDF (p. ${pagesStr})`,
		mimeType: "application/pdf",
		url: pdfurl
	});
	return attachments;
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
	if (/^https?:\/\/book\.duxiu\.com\/search\?/.test(url)) {
		return "multiple";
	}
	else if (/^https?:\/\/book\.duxiu\.com\/bookDetail/.test(url)) {
		return "book";
	}
	else if (/^https?:\/\/.+\.cn\/n\/dsrqw\/book\/base/.test(url)) { // 读秀
		return "bookSection";
	}
	else if (/^https?:\/\/.+\.cn\/n\/drspath\/book\/base/.test(url)) { // 全国图书馆参考咨询联盟
		return "bookSection";
	}
	else if (/^https?:\/\/.+\.cn\/n\/.+\/qikan\/base/.test(url)) { // 读秀
		return "journalArticle";
	}
	/*else if (text(doc,'#textocr')==='文字摘录') { // 读秀系。各类书刊。
		return "bookSection";
	}*/
}

// https://github.com/zuphilip/translators/wiki/Common-code-blocks-for-translators
// attr()/text() v2
// eslint-disable-next-line
function attr(docOrElem,selector,attr,index){var elem=index?docOrElem.querySelectorAll(selector).item(index):docOrElem.querySelector(selector);return elem?elem.getAttribute(attr):null;}function text(docOrElem,selector,index){var elem=index?docOrElem.querySelectorAll(selector).item(index):docOrElem.querySelector(selector);return elem?elem.textContent:null;}

function decodeHtmlEntity(html, odoc) {
	let doc = odoc.implementation.createHTMLDocument();
	let txt = doc.createElement("textarea");
	txt.innerHTML = html;
	return txt.value;
}

function scrapeAndParse(doc, url, callback, rootDoc = doc) {
	var isSection = typeof callback == "function";
	let pageEl = ZU.xpath(doc,'//dl');
	let page;
	// 必须提供根文档，否则无法正常implementation.createHTMLDocument，可能出现 [Exception... "Unexpected error"  nsresult: "0x8000ffff (NS_ERROR_UNEXPECTED)"
	page=decodeHtmlEntity(pageEl[0].innerHTML, rootDoc);
	//Z.debug(isSection);
	var pattern;
	//Z.debug(typeof(page));
	// 类型 item Type & URL
	var itemType = isSection ? "bookSection" : "book";
	var newItem = new Zotero.Item(itemType);
	newItem.url = url;
	newItem.abstractNote = "";
	// extra field to store extra data from Duxiu such as format, price, and/or identifiers.
	newItem.extra = "";
	
	// 标题 title.
	//pattern = /bookname="([\s\S]*?)"/;
	//Z.debug(page);
	let title = getI(page.match(/<dt>([\s\S]*?)<\/dt>/));
	if (title) {
		title = ZU.trim(title);
		title = title.replace(/ +/g, " "); // https://developer.mozilla.org/docs/Web/CSS/white-space
		newItem.title = title;
	}

	// 外文题名 foreign title.
	let foreignTitle = trimTags(getI(page.match(/<dd>[\s\S]*外文题名[\s\S]*?：[\s\S]*?([\s\S]*?)<\/dd>/)));
	newItem.foreignTitle = ZU.trim(foreignTitle);
	page = page.replace(/\n/g, "");

	// 作者名 author name.
	let authorNames = trimTags(getI(page.match(/<dd>[\s\S]*?作[\s]*者[\s\S]*?：([\s\S]*?)<\/dd>/)));
	if (authorNames) {
		// prevent English name from being split.
		authorNames = authorNames.replace(/([a-z])，([A-Z])/g, "$1" + " " + "$2");

		authorNames = authorNames.replace(/；/g, "，");
		authorNames = ZU.trim(authorNames);

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
			
			var assignedName = ZU.trim(authorNames[i]).replace(titleMask, "");
			
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
	let place  = getI(page.match(/<dd>[\s\S]*出版发行[\s\S]*?<\/span>([\s\S]*?)：[\s\S]*?<\/dd>/));
	if (place) {
		if (place.includes(",")) {
			// if publication place not provided, replace publisher with trimed info. from place field.
			newItem.publisher = ZU.trim(place.substring(0, place.indexOf(",")));
			place = "";
		}
		else if (ZU.trim(place).match(/^\d/)) {
			place = "";
		}
		else if (place.includes("<dd>")) { // 误匹配其他栏位的冒号
			place = "";
		}
		else {
			newItem.place = ZU.trim(place);
		}
	}
	
	// 出版社 publisher.
	let publisher = getI(page.match(/<dd>[\s\S]*出版发行[\s\S]*?：([\s\S]*?),[\s\S]*?<\/dd>/));
	if (publisher.includes("<dd>")) { // 误匹配其他栏位的冒号
		publisher = ZU.trim(getI(page.match(/<dd>[\s\S]*出版发行[\s\S]*?<\/span>([\s\S]*?)<\/dd>/))); // 栏位的全文
		newItem.publisher = publisher;
	}
	else if (publisher) {
		if (place) {
			newItem.publisher = ZU.trim(publisher);
		}
	}
	
	// 出版时间 publication date.
	let date = getI(page.match(/<dd>[\s\S]*出版发行[\s\S]*?,([\s\S]*?)<\/dd>/));
	if (!date) {
		date = getI(page.match(/<dd>[\s\S]*出版发行[\s\S]*?([\s\S]*?)<\/dd>/));
	}
	if (date) {
	// preserve Chinese characters used for the publication date of old books.
		date = date.replace(/[^.\d民国清光绪宣统一二三四五六七八九年-]/g, "");
		newItem.date = ZU.trim(date);
	}
	
	// ISBN
	let isbn = getI(page.match(/<dd>[\s\S]*?ISBN号[\D]*(.*[\d])/));
	if (isbn) {
		newItem.ISBN = ZU.trim(isbn);
		if (newItem.ISBN.length < 13) {
			newItem.extra = "出版号: " + newItem.ISBN + "\n" + newItem.extra;
		}

		// Zotero does not allow non-standard but correct ISBN such as one that starts with 7
		else if (newItem.ISBN.length == 13 && newItem.ISBN.startsWith("7")) {
			newItem.ISBN = "978-" + newItem.ISBN;
		}
	}

	// 页数 number of pages.
	let numPages = getI(page.match(/页[\s]*数\D*([\s\S]*?)<\/dd>/));
	newItem.numPages = ZU.trim(numPages);
	
	// 丛书 book series.
	let series = trimTags(getI(page.match(/<dd>[\s\S]*丛书名[\s\S]*?>([\s\S]*?)<\/dd>/)));
	newItem.series = ZU.trim(series);
	// 原书定价 retail price.
	let price = ZU.trim(getI(page.match(/原书定价\D*([\s\S]*?)<\/dd>/)));
	if (price) {
		newItem.price = price;
		newItem.extra += "原书定价: " + newItem.price + "\n";
	}
	
	// 开本 edition format.
	let format = ZU.trim(trimTags(getI(page.match(/<dd>[\s\S]*开本[\s\S]*?>([\s\S]*?)<\/dd>/))));
	if (format) {
		newItem.format = format;
		newItem.extra += "开本: " + newItem.format + "\n";
	}
	// 主题词 subject terms.
	let subjectTerms = trimTags(getI(page.match(/<dd>[\s\S]*主题词[\s\S]*?>([\s\S]*?)<\/dd>/)));
	if (subjectTerms) {
		newItem.subjectTerms = ZU.trim(subjectTerms);
	}

	// 中图法分类号 CLC classification number.
	let callNumber = ZU.trim(trimTags(getI(page.match(/<dd>[\s\S]*中图法分类号[\s\S]*?>([\s\S]*?)<\/dd>/))));
	newItem.callNumber = callNumber;
	
	// 参考文献格式 reference format.
	let refFormat = ZU.trim(trimTags(getI(page.match(/<dd>[\s\S]*参考文献格式[\s\S]*?>([\s\S]*?)<\/dd>/))));
	if (refFormat) {
		newItem.refFormat = refFormat;
		newItem.extra = "参考格式: " + newItem.refFormat + "\n" + newItem.extra;
	}
	
	// 内容提要 abstract.
	let abstractNote = trimTags(getI(page.match(/<dd>[\s\S]*内容提要[\s\S]*?>([\s\S]*?)<\/dd>/)));
	newItem.abstractNote = ZU.trim(abstractNote).replace(/&mdash;/g, "-") + "\n\n";
	
	// use subject terms to populate abstract
	if (newItem.subjectTerms) {
		newItem.abstractNote = newItem.abstractNote + "主题词: " + newItem.subjectTerms;
	}
		
	// start the abstract with the foreign language title if available.
	if (newItem.foreignTitle) {
		newItem.abstractNote = "外文题名: " + newItem.foreignTitle + "\n\n" + newItem.abstractNote;
	}

	// SSID
	let SSID = ZU.trim(trimTags(getI(page.match(/<input name = "ssid" id = "forumssid" {2}value = "([\s\S]*?)"/))));
	newItem.SSID = SSID;

	// dxid
	var dxid = attr(doc, "#dxid", "value");
	//Z.debug(dxid)
	if (dxid){
		newItem.DXID = dxid;
	}

	if (isSection) {callback(newItem);}
	else {newItem.complete();}
}

// the list from which to pick the best role for a given creator. Do not add variants of strings that end with 著,译，编
var rolelist = ["总主编", "总编辑", "总编", "编著", "编译", "编", "整理", "执笔", "译", "著", "撰", "纂", "集解", "辑", "编辑", "集注","绘"];

function trimTags(text) {
	return text ? text.replace(/(<.*?>)|\t|\r|(隐藏更多)|&nbsp;|/g, "") : "";
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





// The "dsrqw" book's meta info depend on https://bl.ocks.org/yfdyh000/raw/3d01e626fbc750c8e4719efa220d5752/?raw=true') in Scaffold IDE, due to Cookies bug.


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://book.duxiu.com/bookDetail.jsp?dxNumber=000030156491&d=E232D717765DD7E60641F94C0D55032C",
		"items": [
			{
				"itemType": "book",
				"title": "海德格尔文集 尼采 下",
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
				"abstractNote": "外文题名: Martin Heidegger Nietzsche\n\n本书分上、下两册，是作者1936至1940年间在弗莱堡大学做的讲座，又附加了若干篇论文，意在审视作者从1930年以来直至“关于人道主义的书信”（发表于1947年）所走过的思想道路。\n\n主题词: 尼采，F.W.（1844-1900）-哲学思想-研究",
				"callNumber": "B516.47    ( 哲学、宗教->欧洲哲学->欧洲各国哲学->德国哲学 )",
				"extra": "参考格式: （德）海德格尔著；孙周兴，王庆节主编；孙周兴译.海德格尔文集  尼采  下[M].北京：商务印书馆,2015.11.\n原书定价: 268.00（全2卷）",
				"libraryCatalog": "Duxiu",
				"numPages": "1235",
				"place": "北京",
				"publisher": "商务印书馆",
				"url": "https://book.duxiu.com/bookDetail.jsp?dxNumber=000030156491&d=E232D717765DD7E60641F94C0D55032C",
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
	},
	{
		"type": "web",
		"url": "http://www.wenhuakxjyty.cn/n/drspath/book/base/13502290/87401ecb66e14a3a9c2cf00623ceb30a/6021f445cd1dd132d0c07cc8f82fc24a.shtml?bt=2022-11-28&dm=-211...&et=2022-12-18&fid=789...&username=...",
		"items": [
			{
				"itemType": "book",
				"title": "缅怀毛泽东 下 第2版",
				"creators": [],
				"extra": "《缅怀毛泽东》编辑组编著,缅怀毛泽东 下 第2版,中央文献出版社,2013.01,",
				"libraryCatalog": "Duxiu",
				"url": "http://www.wenhuakxjyty.cn/n/drspath/book/base/13502290/87401ecb66e14a3a9c2cf00623ceb30a/6021f445cd1dd132d0c07cc8f82fc24a.shtml?bt=2022-11-28&dm=-211...&et=2022-12-18&fid=789...&username=...",
				"attachments": [
					{
						"title": "Full Text PDF (p. 45-70)",
						"mimeType": "application/pdf"
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
		"url": "http://www.jingjilei.cn/n/dsrqw/book/base/14544172/43ac4eaae1c749728b7accd62e9f4430/a6634cc09372a18024397266f7ad293a.shtml?dm=-845...&dxid=000030410675&tp=dsrquanwen&uf=1&userid=...&bt=qw&firstdrs=...",
		"items": [
			{
				"itemType": "bookSection",
				"title": "哈哈哈哈哈哈哈哈",
				"creators": [
					{
						"lastName": "彭懿",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "李海燕",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018.01",
				"ISBN": "9787558306426",
				"abstractNote": "要是有，你听说一只猫被一只小老鼠打得落花流水，你一定不会相信吧而《可口可乐鼠》这部长篇童话故事里说的小老鼠可口可乐却做到了。它敢于与瘸腿猫斗智斗勇，几次死里逃生，很终成为了鼠界的英雄。\n\n主题词: 童话-中国-当代",
				"bookTitle": "中国书香童年名家文库 彭懿奇思妙想童话系列 可口可乐鼠",
				"callNumber": "I287.7    ( 文学->中国文学->儿童文学->当代作品（1949年~） )",
				"extra": "参考格式: 彭懿著；李海燕绘.中国书香童年名家文库  彭懿奇思妙想童话系列  可口可乐鼠[M].广州：新世纪出版社,2018.01.\n原书定价: 28.80",
				"libraryCatalog": "Duxiu",
				"pages": "96",
				"place": "广州",
				"publisher": "新世纪出版社",
				"series": "中国书香童年名家文库  彭懿奇思妙想童话系列",
				"url": "https://book.duxiu.com/bookDetail.jsp?dxNumber=000030410675&d=042B3273F79BAE7067EAB7A9C4599906",
				"attachments": [
					{
						"title": "Full Text PDF (p. 95-97)",
						"mimeType": "application/pdf"
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
		"url": "http://www.zhengzhifl.cn/n/p2jpathqk/qikan/base/22116525/37b1e2f9d2304e62aefe60d6ae459f18/71e073b8157d339518676b37df7fed1b.shtml?...",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "中国建筑装饰装修",
				"creators": [],
				"date": "2008",
				"extra": "题名: 中国建筑装饰装修\n年代: 2008年\n刊号: 第7期",
				"issue": "7",
				"journalAbbreviation": "中国建筑装饰装修",
				"libraryCatalog": "Duxiu",
				"pages": "128",
				"url": "http://www.zhengzhifl.cn/n/p2jpathqk/qikan/base/22116525/37b1e2f9d2304e62aefe60d6ae459f18/71e073b8157d339518676b37df7fed1b.shtml?...",
				"attachments": [
					{
						"title": "Full Text PDF (p. 128-205)",
						"mimeType": "application/pdf"
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
		"url": "https://book.duxiu.com/bookDetail.jsp?dxNumber=000007798830&d=84337FB71A1ED5917061A4BB4C3610AF",
		"items": [
			{
				"itemType": "book",
				"title": "中国包装年鉴 2010-2011",
				"creators": [],
				"callNumber": "F426.89-54    ( 经济->工业经济->中国工业经济->工业部门经济 )",
				"extra": "参考格式: 中国包装年鉴  2010-2011[M].中国包装联合会,",
				"libraryCatalog": "Duxiu",
				"numPages": "366",
				"publisher": "中国包装联合会",
				"url": "https://book.duxiu.com/bookDetail.jsp?dxNumber=000007798830&d=84337FB71A1ED5917061A4BB4C3610AF",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
