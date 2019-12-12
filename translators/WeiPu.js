{
	"translatorID": "dd9efb0b-ca1d-4634-b480-9aabc84213c0",
	"label": "WeiPu",
	"creator": "Xingzhong Lin",
	"target": "^https?://qikan\\.cqvip\\.com",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2019-12-12 09:11:39"
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
  if (url.includes('/Qikan/')) {
  	var ID = getIDFromUrl(url);
	return "journalArticle";
  } else
  if (getSearchResults(doc, true)) {
	return "multiple";
  }
  return false;
}


function getSearchResults(doc, checkOnly) {
  var items = {};
  var found = false;
  // TODO: adjust the CSS selector
  var rows = doc.querySelectorAll('h2>a.title[href*="/article/"]');
  for (let row of rows) {
	// TODO: check and maybe adjust
	let href = row.href;
	// TODO: check and maybe adjust
	let title = ZU.trimInternal(row.textContent);
	if (!href || !title) continue;
	if (checkOnly) return true;
	found = true;
	items[href] = title;
  }
  return found ? items : false;
}


function doWeb(doc, url) {
  if (detectWeb(doc, url) == "multiple") {
	Zotero.selectItems(getSearchResults(doc, false), function (items) {
	  if (items) ZU.processDocuments(Object.keys(items), scrape);
	});
  } else
  {
  	var ID = getIDFromUrl(url);
	scrape([ID], url);
  }
}


function scrape(ids, url) {
  getRefByID(ids, function(xml) {
	var journals = xml.getElementsByTagName("PeriodicalPaper");
	if (journals.length) {
	  convertJournal(journals);
	}
  })
}


function getRefByID(ids, next) {
	if (!ids.length) return;
	var postUrl = "http://qikan.cqvip.com/Qikan/Search/Export?from=Qikan_Search_Index";
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


function convertJournal(journals) {
  if (!journals.length) return;
  for (journal of journals) {
	var newItem = new Zotero.Item("journalArticle");
	newItem.abstractNote = journal.getElementsByTagName('Abstract')[0].childNodes[1].textContent;
	newItem.title = journal.getElementsByTagName('Title')[0].childNodes[3].textContent;
	newItem.language = journal.getElementsByTagName('Title')[0].childNodes[1].textContent;
	var volume = journal.getElementsByTagName('Volum')[0].childNodes[0].nodeValue;
	if (volume != "0") {
	  newItem.volume = volume;
  }
  var issn = journal.getElementsByTagName('ISSN')[0].childNodes[0].nodeValue;
  if (issn) {
    newItem.ISSN = issn;
  }
	newItem.issue = journal.getElementsByTagName('Issue')[0].childNodes[0].nodeValue;
	newItem.pages = journal.getElementsByTagName('Page')[0].childNodes[0].nodeValue;
	newItem.date = journal.getElementsByTagName('PublishDate')[0].childNodes[0].nodeValue;
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
	newItem.complete();
  }
}
