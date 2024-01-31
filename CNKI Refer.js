{
	"translatorID": "7b6b135a-ed39-4d90-8e38-65516671c5bc",
	"label": "CNKI Refer",
	"creator": "jiaojiaodubai",
	"target": "txt",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 99,
	"inRepository": true,
	"translatorType": 1,
	"lastUpdated": "2024-01-31 09:51:42"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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

function detectImport() {
	var line;
	let title = false;
	let cnki = false;
	while ((line = Zotero.read()) !== false) {
		line = line.replace(/^\s+/, '');
		if (/^%T ./.test(line)) {
			title = true;
		}
		else if (/^%W CNKI/.test(line)) {
			cnki = true;
		}
		if (title && cnki) {
			return true;
		}
	}
	return false;
}

async function doImport() {
	var record = '';
	var line;
	var translator = Zotero.loadTranslator("import");
	// Refer/BibIX
	translator.setTranslator('881f60f2-0802-411a-9228-ce5f47b64c7d');
	translator.setHandler('itemDone', (_obj, item) => {
		// Record the yearbook as journal article.
		if (item.type == '年鉴') {
			item.itemType = 'journalArticle';
		}
		switch (item.itemType) {
			case 'newspaperArticle':
			case 'journalArticle':
				delete item.callNumber;
				item.ISSN = tryMatch(record, /^%@ (.*)/m, 1);
				delete item.ISBN;
				break;
			case 'statute':
				item.itemType = 'standard';
				item.number = item.volume;
				delete item.volume;
				delete item.publisher;
				break;
			case 'thesis':
				item.numPages = item.pages;
				delete item.pages;
				item.university = item.publisher;
				delete item.publisher;
				if (item.type) {
					item.thesisType = `${item.type}学位论文`;
					delete item.type;
				}
				item.creators.forEach((creator) => {
					if (creator.creatorType == 'translator') {
						creator.creatorType = 'contributor';
					}
				});
				break;
			case 'conferencePaper':
				item.conferenceName = item.publicationTitle;
				delete item.publicationTitle;
				break;
			case 'patent':
				item.issueDate = item.date;
				delete item.date;
				extra.add('Genre', item.type, true);
				delete item.type;
				break;
		}
		delete item.archiveLocation;
		item.extra = extra.toString();
		item.creators.forEach((creator) => {
			if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
				creator.lastName = creator.firstName + creator.lastName;
				creator.firstName = '';
				creator.fieldMode = 1;
			}
		});
		item.complete();
	});
	while ((line = Zotero.read()) !== false) {
		line = line.replace(/^\s+/, '');
		record += '\n' + line;
		if (line == '%W CNKI') {
			record = record
				// breakline
				.replace(/<br>\s*|\r/g, '\n')
				// If a non-empty line does not contain a tag, it is considered a continuation of the previous line.
				.replace(/\n([^%].+?\n)/g, '$1')
				// Sometimes, authors, contributors, or keywords have their tags, but do not wrap before the tags.
				.replace(/^(.+)(%[KAYI]) /gm, '$1\n$2 ')
				// Sometimes, authors, contributors, or keywords may be mistakenly placed in the same tag.
				.replace(/^%([KAYI]) .*/gm, (match) => {
					return match.replace(/[;，；]\s?/g, `\n%${match[1]} `);
				})
				.replace(/^%R /m, '%U ')
				// Custom tag "9" corresponds to the degree of the graduation thesis,
				//and tag "~" corresponds standard type (national standard or industry standard).
				.replace(/^%[9~] /m, '%R ')
				.replace(/^%V 0*/m, '%V ')
				.replace(/^%N 0*/m, '%N ')
				.replace(/^%P (.+)/, match => '%P ' + match.replace(/~/g, '-').replace(/\+/g, ', '))
				// \t in abstract
				.replace(/\t/g, '')
				.replace(/(\n\s*)+/g, '\n');
			Z.debug(record);
			translator.setString(record);
			await translator.translate();
			record = '';
		}
	}
}

const extra = {
	clsFields: [],
	elseFields: [],
	add: function (key, value, cls = false) {
		if (value && cls) {
			this.clsFields.push([key, value]);
		}
		else if (value) {
			this.elseFields.push([key, value]);
		}
	},
	toString: function () {
		return [...this.clsFields, ...this.elseFields]
			.map(entry => `${entry[0]}: ${entry[1]}`)
			.join('\n');
	}
};

/**
 * Attempts to get the part of the pattern described from the character,
 * and returns an empty string if not match.
 * @param {String} string
 * @param {RegExp} pattern
 * @param {Number} index
 * @returns
 */
function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "import",
		"input": "%0 Journal Article\r\n%A 谭民\r\n%A 王硕\r\n%+ 中国科学院自动化研究所复杂系统管理与控制国家重点实验室;\r\n%T 机器人技术研究进展\r\n%J 自动化学报\r\n%D 2013\r\n%N 07\r\n%K 工业机器人; 移动机器人; 医疗机器人; 康复机器人; 仿生机器人\r\n%X 机器人技术的研究已从传统的工业领域扩展到医疗服务、教育娱乐、勘探勘测、生物工程、救灾救援等新领域,并快速发展.本文简要介绍了工业机器人、移动机器人、医疗与康复机器人和仿生机器人研究中的部分主要进展,并通过分析和梳理,归纳了机器人技术发展中的一些重要问题,探讨机器人技术的发展趋势.\r\n%P 963-972\r\n%@ 0254-4156\r\n%W CNKI",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "机器人技术研究进展",
				"creators": [
					{
						"firstName": "",
						"lastName": "谭民",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王硕",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2013",
				"ISSN": "0254-4156",
				"abstractNote": "机器人技术的研究已从传统的工业领域扩展到医疗服务、教育娱乐、勘探勘测、生物工程、救灾救援等新领域,并快速发展.本文简要介绍了工业机器人、移动机器人、医疗与康复机器人和仿生机器人研究中的部分主要进展,并通过分析和梳理,归纳了机器人技术发展中的一些重要问题,探讨机器人技术的发展趋势.",
				"issue": "7",
				"pages": "963-972",
				"publicationTitle": "自动化学报",
				"attachments": [],
				"tags": [
					{
						"tag": "仿生机器人"
					},
					{
						"tag": "医疗机器人"
					},
					{
						"tag": "工业机器人"
					},
					{
						"tag": "康复机器人"
					},
					{
						"tag": "移动机器人"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
