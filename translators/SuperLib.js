{
	"translatorID": "44c46760-3a27-4145-a623-9e42b733fbe8",
	"label": "SuperLib",
	"creator": "Xingzhong Lin",
	"target": "https?://.*?\\.ucdrs\\.superlib\\.net",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2020-06-01 09:57:13"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Xingzhong Lin
	
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
	if (url.includes('/JourDetail')) {
		return "journalArticle";
	} else if (url.includes('/bookDetail')) {
		return "book";
	} else if (url.includes('/NPDetail')) {
		return "newspaperArticle";
	} else if (url.includes('/thesisDetail')) {
		return "thesis";
	} else if (url.includes('/CPDetail')) {
		return "conferencePaper";
	} else if (url.includes('/patentDetail')) {
		return "patent";
	} else if (getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	// TODO: adjust the CSS selector
	var rows = doc.querySelectorAll('[name=formid] > div.book1');
	for (let row of rows) {
		// TODO: check and maybe adjust
		let href = row.querySelector('a').href;
		// TODO: check and maybe adjust
		let title = ZU.trimInternal(row.querySelector('a').textContent);
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
	}
	else {
		scrape(doc, url);
	}
}

function scrape(doc, url) {
    var hashField = {
        作者: 'author',
        刊名: 'journal',
        出版日期: 'date',
        日期: 'date',
        期号: 'volume',
        关键词: 'tags',
        摘要: 'abstractNote',
        丛书名: 'series',
        形态项: 'numPages',
        出版项: 'publisher',
        中图法分类号: '',
        主题词: 'tags',
        学位授予单位: 'university',
        学位名称: 'thesisType',
        导师姓名: 'contributor',
        学位年度: 'date',
        会议名称: 'conferenceName',
        申请号: 'patentNumber',
        申请日期: 'date',
        发明人: 'inventor',
        地址: 'place',
        申请人: 'attorneyAgent'
    };

    var fakeItem = {};
    var content = doc.querySelectorAll('.content > ul#m_top > li');
    for (let i = 0; i < content.length; i++) {
        var lineContent = content[i].textContent.split('】');
        if (lineContent.length === 2) {
            var field = lineContent[0].slice(1,).replace(/\s/g, '');
            var value = lineContent[1].replace(/^\s*/g, '');
			Z.debug(field + ' ' + value);
            if (field in hashField && ('attorneyAgent', 'inventor', 'contributor', 'author').indexOf(hashField[field]) >= 0) {
                fakeItem.creators = [];
                if (value.length === 2){
                    value = value.replace(';', '');
                }
                var names = value.split(';');
                Z.debug(names);
                for (let i = 0; i < names.length; i++){
                    fakeItem.creators.push(formatName(names[i], hashField[field]));
                }
            } else if (field in hashField) {
                fakeItem[hashField[field]] = value;
            }
        }
    }
    if ('tags' in fakeItem) {
    	var tags = fakeItem.tags.split(/；|;/);
    	fakeItem.tags = [];
    	for (let i = 0; i < tags.length; i++) {
    		fakeItem.tags.push({"tag":tags[i]});
    	}
    }
    Z.debug(fakeItem);
}

function formatName(name, creatorType) {
    var lastSpace = name.lastIndexOf(' ');
    if (name.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
        // western name. split on last space
        firstName = name.substr(0, lastSpace);
        lastName = name.substr(lastSpace + 1);
    }
    else {
        // Chinese name. first character is last name, the rest are first name
        firstName = name.substr(1);
        lastName = name.charAt(0);
    }
    return {firstName: firstName,
            lastName: lastName,
            creatorType: creatorType};
}
