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
	"lastUpdated": "2023-11-02 16:45:20"
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

async function scrape(doc, url = doc.location.href) {
	let m = doc.querySelector('div.side div.bd ul:first-of-type li:nth-child(2) a');
	if (m) {
		let bibUrl = m.href;
		let bibText = await requestText(bibUrl);
		let translator = Zotero.loadTranslator("import");
		// 编码有问题
		// Z.debug(bibText);
		// const encoder = new TextEncoder();
		// Z.debug(encoder.encode(bibText));
		translator.setTranslator('9cb70025-a888-4a29-a210-93ec52da40d4');
		translator.setString(bibText);
		translator.setHandler('itemDone', (_obj, item) => {
			item.itemType = 'preprint';
			item.repository = 'ChinaXiv';
			item.archiveID = url.match(/\/abs\/[\d.]+/)[0].substring(5);
			// Z.debug(item);
			item.title = doc.querySelector('div.hd > h1').innerText;
			item.creators = ZU.xpath(doc, '//div[@class="flex_item content"]/div[@class="bd"][1]//li[1]/a')
				.map(element => matchCreator((element.textContent)));
			item.tags = ZU.xpath(doc, '//span[@class="spankwd"]').map(element => ({ tag: element.textContent }));
			item.abstractNote = doc.querySelector('div.bd > p:nth-child(1) > b').nextSibling.textContent;
			item.url = url;
			item.extra = '';
			let journalNameLable = Array.prototype.find.call(doc.querySelectorAll(
				'div.bd > ul > li >b'),
			node => (node.innerText == '期刊：'));
			if (journalNameLable) {
				item.extra += `\npublicationTitle: ${journalNameLable.nextElementSibling.innerText}`;
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
			item.complete();
		});
		await translator.translate();
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
				"creators": [],
				"DOI": "10.12074/202310.03413V1",
				"abstractNote": "Purpose/significance ChatGPT is a chatbot program developed by OpenAI in the United States. Conversations with ChatGPT can shed light on Dialogue of Civilizations in the age of AI. Method/process Currently, GPT-3.5 offers users 30 free query credits per day. By creating an outline for the conversation, Chen Yu engaged in a dialog with ChatGPT on various issues of Dialogue of Civilizations. Result/conclusion Today, the Standard of Civilization has long been abandoned, and the Clash of Civilizations has been widely criticized. In the era of AI, the AI technology represented by ChatGPT can help promote the Dialogue of Civilizations, help realize real-time communication between people of different cultural backgrounds, enhance the understanding and appreciation of different civilizations, and identify and alleviate prejudices in the dialogue of civilizations. At the same time, the AI technology represented by ChatGPT can also help promote Dialogue within Civilizations and play a positive role in resolving civil conflicts, promoting the integration of immigrants, protecting the voices of vulnerable groups, giving full play to the unique value of women, and building an age-friendly society. However, AI technologies must be developed and used with caution and with due regard to ethical considerations, in particular to prevent AI algorithms from perpetuating prejudices and reinforcing existing inequalities.",
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
				"creators": [],
				"abstractNote": "记忆存储在神经细胞间突触连接的强度变化之中，而神经递质在调节神经元突触可塑性方面具有极为重要的作用。表达特定类型神经递质的神经元可以形成特定的神经递质系统，主要有胆碱能、多巴胺能、去甲肾上腺素能、5-羟色胺能和谷氨酸能系统等。多种类型记忆的去稳定(destabilization)过程的研究揭示，乙酰胆碱在包含新异性信息的记忆提取所引发记忆去稳定过程中发挥了重要作用；而高强度恐惧记忆之所以会抵抗记忆去稳定和再巩固，是因为在这类恐惧记忆编码过程中，去甲肾上腺素-蓝斑系统的激活导致的。其他的重要神经递质包括多巴胺、谷氨酸、-氨基丁酸和血清素等，也都在记忆的不同阶段对记忆可塑性产生影响。神经递质在恐惧记忆去稳定和再巩固中发挥了重要作用，但这种作用通常都不是独立产生的，而是交互作用、相互调节的，包括多巴胺-胆碱能交互、5-羟色胺-谷氨酸交互等。分子层面的神经递质的研究可以给恐惧记忆再巩固干预的研究提供很好的思路启示，未来应基于记忆去稳定的分子机制和神经递质的作用，继续探索恐惧记忆去稳定的关键因素和方法，以更好地改进基于记忆再巩固干预的对于创伤后应激障碍的临床治疗。",
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
