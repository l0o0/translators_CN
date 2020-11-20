{
	"translatorID": "5a325508-cb60-42c3-8b0f-d4e3c6441058",
	"label": "Weixin",
	"creator": "Fushan Wen",
	"target": "^https?://([^/]+\\.)?mp\\.weixin\\.qq\\.com",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2020-11-20 21:37:05"
}

/*
	***** BEGIN LICENSE BLOCK *****
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

function getMetaContent(doc, property) {
	return ZU.xpath(doc, "/html/head/meta[@property='" + property + "']")[0].content.trim();
}

function getArticleDate(doc) {
	var script_list = ZU.xpath(doc, "//script");
	for (var sc of script_list) {
		if (sc.innerText.includes("今天")) {
			Zotero.debug("Good date");
			return sc.innerText.match(/s=\"(.+)\"/)[1].trim();
		}
	}
	return "";
}

function getArticleCreator(doc) {
	var creatorName = getMetaContent(doc, "og:article:author");
	var accountName = ZU.xpath(doc, "//a[@id='js_name']")[0].innerText.trim();
	if (!creatorName.length) {
		return [{lastName: accountName, creatorType: "author", fieldMode: 1}];
	}
	return [{lastName: creatorName, creatorType: "author", fieldMode: 1}, {lastName: accountName, creatorType: "author", fieldMode: 1}];
}

function scrape(doc, url) {
	var item = new Zotero.Item("webpage");
	item.title = getMetaContent(doc, "og:title");
	item.websiteTitle = getMetaContent(doc, "og:site_name");
	item.url = getMetaContent(doc, "og:url");
	item.abstractNote = getMetaContent(doc, "og:description");
	item.creators = getArticleCreator(doc);
	item.date = getArticleDate(doc);
	item.accessDate = new Date().toISOString().slice(0, 10);
	item.extra = ZU.xpath(doc, "//div[@id='js_content']")[0].innerText.trim().replace(/[\r\n]+/g, "\n");
	item.complete();
}

function detectWeb(doc, url) {
	var title = getMetaContent(doc, "og:title");
	if (title.length) {
		return "webpage";
	}
	else {
		return false;
	}
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "webpage") {		
		scrape(doc, url);
	}
}
