{
	"translatorID": "9282aac1-9c13-4591-9c92-4da3a65ff4e5",
	"label": "ChinaXiv",
	"creator": "jiaojiaodubai23",
	"target": "^https?://(www\\.)?chinaxiv\\.((org)|(las.ac.cn))",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-11-09 15:02:48"
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
	var rows = doc.querySelectorAll('a[href*="/abs/"]');
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

function matchCreator(creator) {
	// Z.debug(creators);
	if (/[A-Za-z]/.test(creator)) {
		creator = ZU.cleanAuthor(creator, 'author');
	}
	else {
		creator = creator.replace(/\s/g, '');
		creator = {
			lastName: creator,
			creatorType: 'author',
			fieldMode: 1
		};
	}
	return creator;
}

function GBKtoUTF8(gbkArrayBuffer) {
	const gbkUint8Array = new Uint8Array(gbkArrayBuffer);
	const gbkDecoder = new TextDecoder('gbk');
	const gbkString = gbkDecoder.decode(gbkUint8Array);
	return gbkString;
}

function patchField(doc, url) {
	var item = {
		attachments: []
	};
	item.repository = 'ChinaXiv';
	item.archiveID = url.match(/\/abs\/[\d.]+/)[0].substring(5);
	item.url = url;
	item.extra = '';
	let journalNameLabel = Array.prototype.find.call(doc.querySelectorAll(
		'div.bd > ul > li >b'),
	node => (node.innerText == '期刊：'));
	if (journalNameLabel) {
		item.extra += `\npublicationTitle: ${journalNameLabel.nextElementSibling.innerText}`;
	}
	else {
		item.extra += '\npublicationTitle: 中国科学院科技论文预发布平台';
	}
	try {
		item.extra += `\ntitleTranslation: ${doc.querySelector('div.hd > p').innerText}`;
		item.extra += `\nabstractTranslation: ${ZU.trim(doc.querySelector('div.bd > p:nth-child(2) > b').nextSibling.textContent)}`;
	}
	catch (error) {
		Z.debug("There's no translation.");
	}
	let pdfURL = doc.querySelector('div.side div.bd ul:first-of-type li:nth-child(1) a').href;
	item.attachments.push({
		url: pdfURL,
		title: "Full Text PDF",
		mimeType: "application/pdf"
	});
	item.attachments.push({
		title: "Snapshot",
		document: doc
	});
	return item;
}

function getValuesFromBib(bibText, label) {
	try {
		let values = bibText
			.match(new RegExp(`${label}={(.*)}`))[1]
			.split(/[;；]\s?/)
			.filter(item => item);
		return values;
	}
	catch (error) {
		return [];
	}
}

async function scrape(doc, url = doc.location.href) {
	try {
		let bibUrl = doc.querySelector('div.side div.bd ul:first-of-type li:nth-child(2) a').href;
		let bibText = await request(
			bibUrl,
			{ responseType: 'arraybuffer' }
		);
		bibText = GBKtoUTF8(bibText.body);
		let translator = Zotero.loadTranslator("import");
		translator.setTranslator('9cb70025-a888-4a29-a210-93ec52da40d4');
		translator.setString(bibText);
		translator.setHandler('itemDone', (_obj, item) => {
			item.itemType = 'preprint';
			item.creators = getValuesFromBib(bibText, 'author').map(item => matchCreator(item));
			item.tags = getValuesFromBib(bibText, 'keywords').map(item => ({ tag: item }));
			Object.assign(item, patchField(doc, url));
			item.complete();
		});
		await translator.translate();
	}
	catch (error) {
		var newItem = new Z.Item('preprint');
		newItem.title = text(doc, 'div.hd > h1');
		newItem.abstractNote = doc.querySelector('.bd > p:first-child > b').nextSibling.textContent;
		newItem.creators = Array.from(doc.querySelectorAll('div.bd li > a[href*="field=author"]')).map(
			item => matchCreator(item.textContent)
		);
		newItem.tags = Array.from(doc.querySelectorAll('span.spankwd')).map(
			item => ({ tag: item.textContent })
		);
		newItem.date = Array.from(doc.querySelectorAll('.bd li > b')).find(
			item => (item.textContent == '提交时间：')
		).nextSibling.textContent;
		let DOI = doc.querySelector('.bd li > a[href*="dx.doi.org"]');
		newItem.DOI = DOI ? DOI.href : '';
		Object.assign(newItem, patchField(doc, url));
		newItem.complete();
	}
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.chinaxiv.org/home.htm",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://chinaxiv.org/abs/202310.03455",
		"detectedItemType": "journalArticle",
		"items": [
			{
				"itemType": "preprint",
				"title": "A Conversation with ChatGPT: Dialogue of Civilizations in the Age of AI",
				"creators": [
					{
						"firstName": "",
						"lastName": "Yu",
						"creatorType": "author"
					}
				],
				"DOI": "10.12074/202310.03413V1",
				"archiveID": "202310.03455",
				"extra": "publicationTitle: 中国科学院科技论文预发布平台",
				"libraryCatalog": "ChinaXiv",
				"shortTitle": "A Conversation with ChatGPT",
				"url": "https://chinaxiv.org/abs/202310.03455",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "AI"
					},
					{
						"tag": "ChatGPT"
					},
					{
						"tag": "Clash of Civilizations"
					},
					{
						"tag": "Dialogue of Civilizations"
					},
					{
						"tag": "Standard of Civilization"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://chinaxiv.las.ac.cn/abs/202311.00029",
		"detectedItemType": "journalArticle",
		"items": [
			{
				"itemType": "preprint",
				"title": "神经递质在恐惧记忆去稳定和再巩固中的作用",
				"creators": [
					{
						"lastName": "李俊娇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陈伟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "李常红",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "刘爱玲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "郑希付",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"archiveID": "202311.00029",
				"extra": "publicationTitle: 中国科学院科技论文预发布平台\ntitleTranslation: The role of neurotransmitters in fear memory destabilization and reconsolidation\nabstractTranslation: Memory is stored in the strength changes of synaptic connections between neurons, and neurotransmitters play a crucial role in regulating synaptic plasticity. Neurons expressing specific types of neurotransmitters can form distinct neurotransmitter systems, including the dopaminergic, noradrenergic, serotonergic, and glutamatergic systems. Studies on the destabilization processes of various types of memories have revealed the important role of acetylcholine in memory destabilization triggered by the retrieval of novel associative information. The resistance of high-intensity fear memories to destabilization and reconsolidation is attributed to the activation of the noradrenergic-locus coeruleus system during the encoding process of such fear memories. Other important neurotransmitters, such as dopamine, glutamate, gamma-aminobutyric acid (GABA), and serotonin, also exert influences on memory plasticity at different stages of memory formation. Neurotransmitters play significant roles in fear memory destabilization and reconsolidation, but these effects are typically not independent; rather, they involve interactions and mutual regulation, such as dopamine-cholinergic interactions and serotonin-glutamate interactions. Furthermore, this summary elaborates on the roles of the aforementioned neurotransmitters in memory reconsolidation and their interactions. The study of neurotransmitters at the molecular level can provide valuable insights for the investigation of interventions targeting fear memory reconsolidation. In the future, research should continue to explore the key factors and methods underlying fear memory destabilization based on the molecular mechanisms of memory destabilization and the role of neurotransmitters, to improve the clinical treatment of PTSD based on the reconsolidation intervene.",
				"libraryCatalog": "ChinaXiv",
				"url": "https://chinaxiv.las.ac.cn/abs/202311.00029",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "再巩固"
					},
					{
						"tag": "去稳定"
					},
					{
						"tag": "条件性恐惧记忆"
					},
					{
						"tag": "神经递质"
					},
					{
						"tag": "突触可塑性"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
