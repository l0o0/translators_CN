{
	"translatorID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	"label": "Aozora Bunko",
	"creator": "Zotero User",
	"target": "^https?://www\\.aozora\\.gr\\.jp/cards/\\d+/files/\\d+_\\d+\\.html",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-07-12 13:00:00"
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
	return 'book';
}

function doWeb(doc, url) {
	scrape(doc, url);
}

function scrape(doc, url) {
	var item = new Zotero.Item('book');

	// Title and author from h1.title and h2.author
	var titleEl = doc.querySelector('h1.title, .title');
	var authorEl = doc.querySelector('h2.author, .author');

	item.title = titleEl ? ZU.trimInternal(titleEl.textContent) : doc.title;
	item.url = url;
	item.libraryCatalog = '青空文庫';
	item.language = 'ja';

	var authorName = '';
	if (authorEl) {
		authorName = ZU.trimInternal(authorEl.textContent);
		item.creators.push({
			lastName: authorName,
			creatorType: 'author',
			fieldMode: 1
		});
	}

	// Extract bibliographic information
	var bibInfo = doc.querySelector('.bibliographical_information, .bibliographic_information');
	var extraParts = [];
	if (bibInfo) {
		var bibText = ZU.trimInternal(bibInfo.textContent);

		// 底本 (source text)
		var sourceMatch = bibText.match(/底本[：:]\s*「(.+?)」\s*(.+?)[\n\r]/);
		if (sourceMatch) {
			item.publisher = sourceMatch[2].trim();
			extraParts.push('底本: 『' + sourceMatch[1] + '』 ' + sourceMatch[2].trim());
		}

		// 初出 (first publication)
		var firstPubMatch = bibText.match(/初出[：:]\s*「(.+?)」[\n\r]/);
		if (firstPubMatch) {
			extraParts.push('初出: 『' + firstPubMatch[1] + '』');
		}

		// Date from 初出 or 底本
		var dateMatch = bibText.match(/(\d{4})[（(平成大正昭和明]/);
		if (dateMatch) {
			item.date = dateMatch[1];
		}

		// 入力 (inputter) and 校正 (proofreader)
		var inputMatch = bibText.match(/入力[：:]\s*(.+?)[\n\r]/);
		if (inputMatch) extraParts.push('入力: ' + inputMatch[1].trim());

		var proofMatch = bibText.match(/校正[：:]\s*(.+?)[\n\r]/);
		if (proofMatch) extraParts.push('校正: ' + proofMatch[1].trim());
	}

	if (extraParts.length > 0) {
		item.extra = extraParts.join('\n');
	}

	// Extract full text from .main_text
	var mainText = doc.querySelector('.main_text');
	if (mainText) {
		var plainText = extractPlainText(mainText);
		var markdownText = convertToMarkdown(mainText, item.title, authorName);

		// Save full text as TXT note
		if (plainText) {
			item.notes.push({
				note: '<h1>' + escapeHTML(item.title) + '.txt</h1><pre>'
					+ escapeHTML(plainText) + '</pre>'
			});
		}

		// Save full text as Markdown note
		if (markdownText) {
			item.notes.push({
				note: '<h1>' + escapeHTML(item.title) + '.md</h1><pre>'
					+ escapeHTML(markdownText) + '</pre>'
			});
		}
	}

	item.complete();
}

function escapeHTML(str) {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function extractPlainText(el) {
	// Clone to avoid modifying original
	var clone = el.cloneNode(true);

	// Convert ruby to "漢字(かんじ)" format
	var rubies = clone.querySelectorAll('ruby');
	for (var i = 0; i < rubies.length; i++) {
		var rb = rubies[i].querySelector('rb');
		var rt = rubies[i].querySelector('rt');
		var base = rb ? rb.textContent : '';
		var reading = rt ? rt.textContent : '';
		var replacement = reading ? base + '(' + reading + ')' : base;
		rubies[i].textContent = replacement;
	}

	// Remove rp tags (already handled by ruby conversion)
	var rps = clone.querySelectorAll('rp');
	for (var j = 0; j < rps.length; j++) {
		rps[j].textContent = '';
	}

	// Get text, clean up excessive whitespace
	var text = clone.textContent;
	// Remove leading/trailing whitespace
	text = text.replace(/^[\s\u3000]+/, '').replace(/[\s\u3000]+$/, '');
	// Normalize line breaks
	text = text.replace(/\n{3,}/g, '\n\n');
	return text;
}

function convertToMarkdown(el, title, author) {
	var clone = el.cloneNode(true);

	// Convert ruby to "漢字(かんじ)" format
	var rubies = clone.querySelectorAll('ruby');
	for (var i = 0; i < rubies.length; i++) {
		var rb = rubies[i].querySelector('rb');
		var rt = rubies[i].querySelector('rt');
		var base = rb ? rb.textContent : '';
		var reading = rt ? rt.textContent : '';
		var replacement = reading ? base + '(' + reading + ')' : base;
		rubies[i].textContent = replacement;
	}

	// Remove rp tags
	var rps = clone.querySelectorAll('rp');
	for (var j = 0; j < rps.length; j++) {
		rps[j].textContent = '';
	}

	// Convert <br> to newlines
	var brs = clone.querySelectorAll('br');
	for (var k = 0; k < brs.length; k++) {
		brs[k].textContent = '\n';
	}

	// Convert <strong> to **text**
	var strongs = clone.querySelectorAll('strong');
	for (var m = 0; m < strongs.length; m++) {
		strongs[m].textContent = '**' + strongs[m].textContent + '**';
	}

	// Convert <p> to paragraphs
	var ps = clone.querySelectorAll('p');
	for (var n = 0; n < ps.length; n++) {
		ps[n].textContent = '\n\n' + ps[n].textContent + '\n\n';
	}

	// Get text
	var text = clone.textContent;
	// Clean up
	text = text.replace(/^[\s\u3000]+/, '').replace(/[\s\u3000]+$/, '');
	text = text.replace(/\n{3,}/g, '\n\n');

	// Build Markdown with header
	var md = '# ' + title + '\n\n';
	if (author) {
		md += '**' + author + '**\n\n';
	}
	md += '---\n\n';
	md += text;

	return md;
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.aozora.gr.jp/cards/000879/files/4872_21839.html",
		"items": [
			{
				"itemType": "book",
				"title": "愛読書の印象",
				"creators": [],
				"language": "ja",
				"libraryCatalog": "青空文庫",
				"url": "https://www.aozora.gr.jp/cards/000879/files/4872_21839.html",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
