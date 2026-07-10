{
	"translatorID": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
	"label": "China National Library - Modern Newspaper Database",
	"creator": "Zotero User",
	"target": "^https?://bz-nlcpress-com-s-[0-9]+\\.ycfw\\.library\\.hb\\.cn:[0-9]+/library/publish/default/(PaperSearch|ChengpinHistoryDetail_pic|paperLayoutView_pic|PaperAll)\\.jsp\\?.*",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-07-10 19:45:00"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Zotero User

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
	if (url.includes("PaperSearch.jsp") && getSearchResults(doc, true)) {
		return "multiple";
	}
	if ((url.includes("ChengpinHistoryDetail_pic.jsp") || url.includes("paperLayoutView_pic.jsp") || url.includes("PaperAll.jsp")) && doc.querySelector('.newsList02, .art-topic, .newsTitle')) {
		return "newspaperArticle";
	}
	return false;
}


function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.newsList02');
	for (var i = 0; i < rows.length; i++) {
		var titleLink = rows[i].querySelector('.newsTitle .art-topic');
		if (!titleLink) continue;
		var title = titleLink.textContent.trim();
		var docID = rows[i].getAttribute('docid');
		if (!title || !docID) continue;
		if (checkOnly) return true;
		found = true;
		items[docID] = title;
	}
	return found ? items : false;
}


function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			if (!items) return;
			for (var docID in items) {
				scrapeItemFromSearchResult(doc, docID, url);
			}
		});
	}
	else {
		scrape(doc, url);
	}
}


function scrapeItemFromSearchResult(doc, docID, url) {
	var row = doc.querySelector('.newsList02[docid="' + docID + '"]');
	if (!row) return;

	var item = new Zotero.Item("newspaperArticle");

	// 标题
	var titleEl = row.querySelector('.newsTitle .art-topic');
	if (titleEl) {
		item.title = titleEl.textContent.trim();
	}

	// 链接
	var links = row.querySelectorAll('li.newsStyle.right a');
	var baseURL = url.match(/^(https?:\/\/[^\/]+\/library\/publish\/default\/)/);
	baseURL = baseURL ? baseURL[1] : "";

	// 报纸名
	if (links.length > 0) {
		item.publicationTitle = links[0].textContent.trim();
	}

	// 日期
	if (links.length > 1) {
		item.date = links[1].textContent.trim();
	}

	// 版次
	if (links.length > 2) {
		item.pages = links[2].textContent.trim();
	}

	// 文章 URL：使用详情页链接（整报浏览或日期链接）
	if (links.length > 1) {
		item.url = links[1].href;
	}
	else {
		item.url = url;
	}

	item.language = "zh-CN";
	item.libraryCatalog = "中国历史文献总库·近代报纸数据库";

	// PDF 附件
	var downloadLink = null;
	var allLinks = row.querySelectorAll('a');
	for (var i = 0; i < allLinks.length; i++) {
		var onclickAttr = allLinks[i].getAttribute('onclick');
		if (onclickAttr && onclickAttr.indexOf('downloadPaper') !== -1) {
			downloadLink = allLinks[i];
			break;
		}
	}
	if (downloadLink && baseURL) {
		var onclickAttr = downloadLink.getAttribute('onclick');
		if (onclickAttr) {
			var match = onclickAttr.match(/downloadPaper\('([^']+)'\)/);
			if (match) {
				var pdfURL = baseURL + match[1];
				item.attachments.push({
					title: "Full Text PDF",
					url: pdfURL,
					mimeType: "application/pdf"
				});
			}
		}
	}

	item.attachments.push({
		title: "Newspaper Database Record",
		url: item.url,
		mimeType: "text/html",
		snapshot: false
	});

	item.complete();
}


function scrape(doc, url) {
	// 详情页抓取逻辑（如果直接从详情页访问）
	var item = new Zotero.Item("newspaperArticle");

	var titleEl = doc.querySelector('.art-topic') || doc.querySelector('.newsTitle');
	if (titleEl) {
		item.title = titleEl.textContent.trim();
	}

	// 尝试从 URL 参数获取信息
	var urlParams = new URLSearchParams(url.split('?')[1]);
	if (urlParams.get('paperName')) {
		item.publicationTitle = decodeURIComponent(urlParams.get('paperName'));
	}
	if (urlParams.get('pubDate')) {
		item.date = urlParams.get('pubDate');
	}

	item.url = url;
	item.language = "zh-CN";
	item.libraryCatalog = "中国历史文献总库·近代报纸数据库";

	item.attachments.push({
		title: "Newspaper Database Record",
		url: url,
		mimeType: "text/html",
		snapshot: false
	});

	item.complete();
}


/** BEGIN TEST CASES **/
var testCases = [
];
/** END TEST CASES **/
