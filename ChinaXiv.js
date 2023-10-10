{
	"translatorID": "9282aac1-9c13-4591-9c92-4da3a65ff4e5",
	"label": "ChinaXiv",
	"creator": "jiaojiaodubai23",
	"target": "http://www.chinaxiv.org",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-10 19:04:14"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai23@gmail.com

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
	if (url.includes('/abs/')) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('div.list h3 > a');
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

function match_creators(doc, path) {
	var creators = ZU.xpath(
		doc, 
		'//div[@class="flex_item content"]/div[@class="bd"][1]//li[1]/a'
		).map((element) => (element.textContent));
	// Z.debug(creators);
	var zhnamesplit = Z.getHiddenPref('zhnamesplit');
	for (var i = 0, n = creators.length; i < n; i++) {
		var creator = creators[i];
		if (creator.search(/[A-Za-z]/) !== -1) {
			// western name. split on last space
			creator = {
				firstName: creator.split(' ')[1],
				lastName: creator.split(' ')[0],
				creatorType: 'author'
			}
		}
		else {
			if (zhnamesplit) {
				// zhnamesplit is true, split firstname and lastname.
				// Chinese name. first character is last name, the rest are first name
				creator = {
					firstName: creator.substr(1),
					lastName: creator.charAt(0),
					creatorType: 'author'
				}
			}
			else {
				creator = {
					lastName: creator,
					creatorType: 'author'
				}
			}
		}
		creators[i] = creator;
	}
	// Z.debug(creators);
	return creators;
}

async function scrape(doc, url = doc.location.href) {
	// var item = new Z.Item('journalArticle');
	let m = doc.querySelector('div.side div.bd ul:first-of-type li:nth-child(2) a');
	if (m) {
		let bibUrl = m.href;
		let bibText = await requestText(bibUrl);
		let translator = Zotero.loadTranslator("import");
		translator.setTranslator('9cb70025-a888-4a29-a210-93ec52da40d4');
		translator.setString(bibText);
		translator.setHandler('itemDone', (_obj, item) => {
			item.title = ZU.xpath(doc, '//h1')[0].innerText;
			item.creators = match_creators(doc);
			item.tags = ZU.xpath(
				doc,
				'//span[@class="spankwd"]').map((element) => ({'tag': element.textContent}));
			item.abstractNote = ZU.xpath(doc, '//div[@class="bd"]/p/b')[0].nextSibling.textContent;
			item.url = url;
			item.attachments.push({
				title: 'Snapshot',
				document: doc
			});
			item.complete();
		});
		await translator.translate();
	}
}

/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/
