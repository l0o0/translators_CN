{
	"translatorID": "9282aac1-9c13-4591-9c92-4da3a65ff4e5",
	"label": "ChinaXiv",
	"creator": "jiaojiaodubai",
	"target": "^https?://.*chinaxiv\\.((org)|(las\\.ac\\.cn))",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-06-20 16:34:51"
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
		return 'preprint';
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

async function scrape(doc, url = doc.location.href) {
	try {
		let bibUrl = doc.querySelector('div.side div.bd ul:first-of-type li:nth-child(2) a').href;
		Z.debug(bibUrl);
		let bibText = await request(
			bibUrl,
			{ responseType: 'arraybuffer' }
		);
		Z.debug(bibText);
		bibText = GBKtoUTF8(bibText.body);
		let translator = Zotero.loadTranslator('impor');
		translator.setTranslator('9cb70025-a888-4a29-a210-93ec52da40d4');
		translator.setString(bibText);
		translator.setHandler('itemDone', (_obj, item) => {
			item.extra = '';
			item.itemType = 'preprint';
			item.creators = getValuesFromBib(bibText, 'author').map(creator => ZU.cleanAuthor(creator, 'author'));
			let tags = getValuesFromBib(bibText, 'keywords');
			tags.forEach((tag) => {
				item.tags.push(tag);
			});
			item = Object.assign(item, fixItem(item, doc, url));
			item.complete();
		});
		await translator.translate();
	}
	catch (error) {
		Z.debug('request failed');
		var newItem = new Z.Item('preprint');
		newItem.extra = '';
		let labels = new Labels(doc, '.bd li, .bd > p');
		newItem.title = text(doc, 'div.hd > h1');
		newItem.abstractNote = labels.get('摘要:');
		let creators = Array.from(labels.get('^作者', true).querySelectorAll('a'));
		creators.forEach((creator) => {
			newItem.creators.push(ZU.cleanAuthor(ZU.trimInternal(creator.textContent), 'author'));
		});
		let tags = Array.from(doc.querySelectorAll('span.spankwd'));
		tags.forEach((tag) => {
			newItem.tags.push(tag.textContent);
		});
		newItem.date = labels.get('提交时间');
		newItem.DOI = attr(doc, '.bd li > a[href*="dx.doi.org"]', 'href');
		newItem = Object.assign(newItem, fixItem(newItem, doc, url));
		newItem.complete();
	}
}

function GBKtoUTF8(gbkArrayBuffer) {
	const gbkUint8Array = new Uint8Array(gbkArrayBuffer);
	const gbkDecoder = new TextDecoder('gbk');
	const gbkString = gbkDecoder.decode(gbkUint8Array);
	return gbkString;
}

function fixItem(item, doc, url) {
	let labels = new Labels(doc, '.bd li, .bd > p');
	item.repository = 'ChinaXiv';
	item.archiveID = `ChinaXiv: ${url.match(/\/abs\/[\d.]+/)[0].substring(5)}`;
	item.url = url;
	item.extra += addExtra('original-title', text(doc, 'div.hd > p'));
	item.extra += addExtra('original-abstract', labels.get('Abstract'));
	item.extra += addExtra('CSTR', text(doc, '.bd li > a[href*="www.cstr.cn"]').slice(5));
	item.creators.forEach((creator) => {
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
	});
	let pdfLink = doc.querySelector('.side > .bd a[href*="filetype=pdf"]');
	item.attachments.push({
		url: pdfLink.href,
		title: 'Full Text PDF',
		mimeType: 'application/pdf'
	});
	item.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	return item;
}

/* Util */
class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				const elmCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elmCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elmCopy.removeChild(elmCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elmCopy.childNodes.length > 1) {
					const key = elmCopy.removeChild(elmCopy.firstChild).textContent.replace(/\s/g, '');
					this.data.push([key, elmCopy]);
				}
				else {
					const text = ZU.trimInternal(elmCopy.textContent);
					const key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elmCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.data.push([key, elmCopy]);
				}
			});
	}

	get(label, element = false) {
		if (Array.isArray(label)) {
			const results = label
				.map(aLabel => this.get(aLabel, element));
			const keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElm
					: '';
		}
		const pattern = new RegExp(label, 'i');
		const keyVal = this.data.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElm
				: '';
	}
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

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
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
		"items": [
			{
				"itemType": "preprint",
				"title": "A Conversation with ChatGPT:  Dialogue of Civilizations  in the Age of AI",
				"creators": [
					{
						"firstName": "Chen",
						"lastName": "Yu",
						"creatorType": "author"
					}
				],
				"date": "2023-10-30",
				"DOI": "http://dx.doi.org/10.12074/202310.03455V1",
				"abstractNote": "Purpose/significance ChatGPT is a chatbot program developed by OpenAI in the United States. Conversations with ChatGPT can shed light on Dialogue of Civilizations in the age of AI. Method/process Currently, GPT-3.5 offers users 30 free query credits per day. By creating an outline for the conversation, Chen Yu engaged in a dialog with ChatGPT on various issues of Dialogue of Civilizations. Result/conclusion Today, the Standard of Civilization has long been abandoned, and the Clash of Civilizations has been widely criticized. In the era of AI, the AI technology represented by ChatGPT can help promote the Dialogue of Civilizations, help realize real-time communication between people of different cultural backgrounds, enhance the understanding and appreciation of different civilizations, and identify and alleviate prejudices in the dialogue of civilizations. At the same time, the AI technology represented by ChatGPT can also help promote Dialogue within Civilizations and play a positive role in resolving civil conflicts, promoting the integration of immigrants, protecting the voices of vulnerable groups, giving full play to the unique value of women, and building an age-friendly society. However, AI technologies must be developed and used with caution and with due regard to ethical considerations, in particular to prevent AI algorithms from perpetuating prejudices and reinforcing existing inequalities.",
				"archiveID": "ChinaXiv: 202310.03455",
				"extra": "CSTR: 32003.36.ChinaXiv.202310.03455.V1",
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
		"url": "https://chinaxiv.org/abs/202312.00136",
		"items": [
			{
				"itemType": "preprint",
				"title": "强流质子同步加速器涂抹注入方法研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "黄明阳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "许守彦",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王生",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-12-14",
				"abstractNote": "空间电荷效应是强流质子加速器的核心问题之一，在注入和初始加速阶段其影响最大。采用相空间涂抹方法并优化其涂抹过程，可以有效地缓解空间电荷效应对束流注入和加速效率及发射度增长的影响。横向相空间涂抹方法可分为相关涂抹和反相关涂抹。在本文中，首先，我们对强流质子同步加速器的横向相空间涂抹方法进行深入研究，包括不同的涂抹方法和实现方式。其次，基于中国散裂中子源（CSNS）注入系统，对束流注入过程和反相关涂抹设计方案进行详细研究，深入探索实际垂直涂抹范围变小的原因和凸轨磁铁边缘聚焦效应对涂抹效果和束流动力学的影响。同时，简单介绍了在反相关涂抹机械结构基础上实现相关涂抹的方法及其对实现CSNS设计指标起到的关键作用。最后，根据未来加速器对不同涂抹注入方法在线切换的需求，我们提出了一种同时实现相关和反相关涂抹的新注入方案，并对其进行详细地论证、模拟和优化。",
				"archiveID": "ChinaXiv: 202312.00136",
				"extra": "original-title: Study on the painting injection methods for the high intensity proton synchrotron\noriginal-abstract: The space charge effect is the core problem of high intensity proton accelerator, especially at injection and initial acceleration stages. Using the phase space painting with optimized process, will effectively eliminate the influence of space charge effect on injection and acceleration efficiency, and emittance increase. Transverse phase space painting methods can be divided into correlated painting and anti-correlated painting. In this paper, firstly, the transverse phase space paintings for the high intensity proton synchrotron are discussed in detail, including different painting methods and different implementation methods. Secondly, based on the injection system of the China Spallation Neutron Source, the beam injection process and anti-correlated painting design scheme are studied in detail. The reasons for the reduction of the actual vertical painting range and the influence of edge focusing effects of the bump magnets on the painting and beam dynamics are deeply explored. In addition, the method to perform the correlated painting based on the mechanical structure of the anti-correlated painting scheme and its key role in realizing the CSNS design goal are briefly introduced. Finally, according to the requirement of switching between different painting methods online in future accelerators, a new injection scheme that can realize correlated and anti-correlated painting simultaneously has been proposed. The new painting injection scheme has been demonstrated, simulated and optimized in detail.\nCSTR: 32003.36.ChinaXiv.202312.00136.V1",
				"libraryCatalog": "ChinaXiv",
				"url": "https://chinaxiv.org/abs/202312.00136",
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
						"tag": "注入"
					},
					{
						"tag": "涂抹"
					},
					{
						"tag": "空间电荷效应"
					},
					{
						"tag": "质子同步加速器"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://phonomuse.chinaxiv.org/server/phoindex.htm",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://nucl-ph.chinaxiv.org/server/nuclearphyindex.htm",
		"items": "multiple"
	}
]
/** END TEST CASES **/
