{
	"translatorID": "dd9efb0b-ca1d-4634-b480-9aabc84213c0",
	"label": "维普",
	"creator": "Xingzhong Lin",
	"target": "^https?://qikan\\.cqvip\\.com",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2019-12-13 09:03:39"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Xingzhong Lin, https://github.com/Zotero-CN/translators_CN
	
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

function getIDFromUrl(url) {
	if (!url) return false;
	
	var ID = url.match(/[?&]id=([^&#]*)/i);
	if (!ID || !ID[1]) return false;
	return ID[1];
}


function detectWeb(doc, url) {
  	if (url.includes('/Qikan/Article/Detail')) {
  	  	var ID = getIDFromUrl(url);
		return "journalArticle";
  	} else
  	if (getSearchResults(doc, true)) {
		return "multiple";
  	}
  	return false;
}


function getSearchResults(doc, itemInfos) {
  	var items = {};
  	var searchList = ZU.xpath(doc, "//div[@class='simple-list']//dl");
  	for (let list of searchList) {
		var paper = ZU.xpath(list, "./dt/a")[0];
		var title = ZU.trimInternal(paper.textContent);
		var href = paper.href;
		var ID = paper.getAttribute('articleid');
		var dd = ZU.xpath(list, "./dd")[2]
		if (!href || !title) continue;
		items[href] = title + " " + dd.innerText;
		itemInfos[href] = ID;
  	}
  	return items;
}


function doWeb(doc, url) {
	var login = false;
	var a = ZU.xpath(doc, "//li[@class='app-reg']");
	if (a.length) { 
		login = true
	};
  	if (detectWeb(doc, url) == "multiple") {
		var itemInfos = {};
		var items = getSearchResults(doc, itemInfos);
		Zotero.selectItems(items, function (selectedItems) {
	  		if (!selectedItems) return true;
	  		var ids = [];
	  		var urls = [];
	  		for (var url in selectedItems) {
				ids.push(itemInfos[url]);
				urls.push(url);
	  		}
	  		Z.debug(ids);
	  		scrape(ids, urls);
		});
	} else  {
		  var ID = getIDFromUrl(url);
		  var filestr = false;
		  if (login) {
			  filestr = ZU.xpath(doc, "//div[@class='article-source']/a")[1].getAttribute('onclick')
			  filestr = filestr.split(/[,']/)[4];
		  }
		scrape([ID], [url], filestr);
  	}
}


function scrape(ids, urls, filestr=false) {
  getRefByID(ids, function(xml) {
	var journals = xml.getElementsByTagName("PeriodicalPaper");
	if (!journals.length) return;
  	for (var i=0, n=journals.length; i<n; i++) {
	  convertJournal(journals[i], urls[i], ids[i], filestr);
	}
  })
}


function getRefByID(ids, next) {
	if (!ids.length) return;
	var postUrl = "/Qikan/Search/Export?from=Qikan_Search_Index";
	var ids = "&ids=" + encodeURIComponent(ids.join(','));
	var postData = ids + "&strType=title_info";
	ZU.doPost(postUrl, postData, 
		function(text) {
			// Z.debug(text);
			var parser = new DOMParser();
			var refHtml = parser.parseFromString(text, 'text/html');
			var refXml = refHtml.getElementById('xmlContent').value;
			var refXml = parser.parseFromString(refXml, 'text/xml');
			// Z.debug(1);
			next(refXml);
		}
	)
}


function convertJournal(journal, url, fileid, filestr) {
  	var newItem = new Zotero.Item("journalArticle");
	newItem.abstractNote = journal.getElementsByTagName('Abstract')[0].childNodes[1].textContent;
	newItem.title = journal.getElementsByTagName('Title')[0].childNodes[3].textContent;
	let language = journal.getElementsByTagName('Title')[0].childNodes[1].textContent;
	if (language === 'chi') {
		newItem.language = 'zh-CN';
	} else {
		newItem.language = language;
	}
	var volume = journal.getElementsByTagName('Volum')[0].childNodes[0].nodeValue;
	if (volume != "0") {
		newItem.volume = volume;
  	}
  	var issn = journal.getElementsByTagName('ISSN')[0];
  	if (issn.childlNodes) {
		newItem.ISSN = issn.childNodes[0].nodeValue;
  	}
	newItem.issue = journal.getElementsByTagName('Issue')[0].childNodes[0].nodeValue;
	
	newItem.pages = journal.getElementsByTagName('Page')[0].childNodes[0].nodeValue;
	newItem.date = journal.getElementsByTagName('PublishDate')[0].childNodes[0].nodeValue.slice(0, 4);
	newItem.libraryCatalog = 'WeiPu';
	newItem.creators = [];
	var names = journal.getElementsByTagName('Name');
	for (var i = 0, n = names.length; i < n-1; i++) {
	  	var name = names[i].childNodes[0].nodeValue;
	  	var creator = {};
	  	if (name.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
			// western name. split on last space
			creator.firstName = name.substr(0,lastSpace);
			creator.lastName = name.substr(lastSpace + 1);
	  	} else {
			// Chinese name. first character is last name, the rest are first name
			creator.firstName = name.substr(1);
			creator.lastName = name.charAt(0);
	  }
	  newItem.creators.push(creator);
	}
	newItem.publicationTitle = names[names.length-1].childNodes[0].nodeValue;
	newItem.tags = [];
	var tags = journal.getElementsByTagName('Keyword');
	for (var i=0, n=tags.length; i < n; i++) {
	  	newItem.tags[i] = tags[i].childNodes[0].nodeValue;
	}
	newItem.url = url;
	if (filestr) {
		var pdfUrl = getPDF(fileid, filestr);
		if (pdfUrl) {
			newItem.attachments = [{
				title: "Full Text PDF",
				mimeType: "application/pdf",
				url: pdfurl
			}];
		}
	}
	newItem.complete();
}


function getPDF(fileid, filestr) {
	var postUrl = "/Qikan/Article/ArticleDown";
	var postData = {
		id: fileid,
		info: filestr,
		ts: (new Date).getTime()
	}
	var fileurl = "";
	ZU.doPost(postUrl, postData, 
		function (text) {fileurl = text.split(/"/)[3]}
	)
	return fileurl
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://qikan.cqvip.com/Qikan/Article/Detail?id=HS723722017007008&from=Qikan_Search_Index",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "不确定因素下一类物流车最优路径模型的建立与求解",
				"creators": [
					{
						"firstName": "若男",
						"lastName": "沈"
					},
					{
						"firstName": "有慧",
						"lastName": "苏"
					}
				],
				"date": "2017",
				"abstractNote": "本文以徐州市圆通快递文化宫营业部到中国矿业大学南湖校区为研究对象,建立了不确定因素下最优路径模型,利用正态分布的可加性,得出各条路径的总行驶时间正态分布表达式,并进行标准化,解出行驶时间的表达式。当到达终点的概率确定时,最优路径为行驶时间最少的路径。在此基础上设计了基于深度优先搜索的最优路径算法,运用MATLAB编程,得出7条不同的路径,求出最短行驶时间和最优路径。",
				"issue": "7",
				"language": "zh-CN",
				"libraryCatalog": "WeiPu",
				"pages": "861-870",
				"publicationTitle": "应用数学进展",
				"url": "http://qikan.cqvip.com/Qikan/Article/Detail?id=HS723722017007008&from=Qikan_Search_Index",
				"volume": "6",
				"attachments": [],
				"tags": [
					{
						"tag": "卷积公式"
					},
					{
						"tag": "最优路径模型"
					},
					{
						"tag": "正态分布可加性"
					},
					{
						"tag": "深度优先搜索算法"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
