{
	"translatorID": "3b4e0da7-d9b2-41e8-b4d3-38701241b872",
	"label": "RHHZ",
	"creator": "jiaojiaodubai23",
	"target": "",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-14 20:47:46"
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
	let insite = doc.querySelector('div[class*="foot"] p > a[href*="www.rhhz.net"]');
	let itemID = doc.querySelector('meta[name="citation_id"]');
	if (insite && itemID) {
		return 'journalArticle';
	}
	else if (insite && getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('div.article-list-title a:first-of-type');
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

async function scrape(doc, url = doc.location.href) {
	let translator = Zotero.loadTranslator('web');
	var pdfURL = '';
	let pdfButton = doc.querySelector('div.pdfView');
	let socallURL = doc.querySelector('head > meta[name="citation_pdf_url"]').content;
	if (socallURL.endsWith('.pdf')) {
		pdfURL = socallURL;
	}
	else if (pdfButton) {
		pdfURL = pdfButton.parentElement.href;
	} else {
		let id = doc.querySelector('head > meta[name="citation_id"]').content;
		let host = (new URL(url)).host;
		pdfURL = `${url.split('//')[0]}//${host}/article/exportPdf?id=${id}`
	}
	Z.debug(pdfURL);
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);
	translator.setHandler('itemDone', (_obj, item) => {
		var zhnamesplit = Z.getHiddenPref('zhnamesplit');
		for (var i = 0, n = item.creators.length; i < n; i++) {
			var creator = item.creators[i];
			if (creator.lastName.search(/[A-Za-z]/) !== -1) {
				// western name. split on last space
				creator.firstName = creator.lastName.substr(0, lastSpace);
				creator.lastName = creator.lastName.substr(lastSpace + 1);
			}
			else if (zhnamesplit === undefined ? true : zhnamesplit) {
				// zhnamesplit is true, split firstname and lastname.
				// Chinese name. first character is last name, the rest are first name
				creator.firstName = creator.lastName.substr(1);
				creator.lastName = creator.lastName.charAt(0);
			}
			item.creators[i] = creator
		}
		item.attachments = [
			{
				url: pdfURL,
				title: "Full Text PDF",
				mimeType: "application/pdf"
			}
		];
		item.attachments.push({
			url: url,
			document: doc,
			title: 'Snapshot',
			mimeType: 'text/html'
		})
		item.complete();
	});
	let em = await translator.getTranslatorObject();
	em.itemType = 'journalArticle';
	await em.doWeb(doc, url);
}
/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/
