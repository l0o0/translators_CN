{
	"translatorID": "9282aac1-9c13-4591-9c92-4da3a65ff4e5",
	"label": "ChinaXiv",
	"creator": "jiaojiaodubai23",
	"target": "^http://www\\.chinaxiv\\.org",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-21 10:12:07"
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
	if (creator.search(/[A-Za-z]/) !== -1) {
		creator = ZU.cleanAuthor(creator, 'author');
	}
	else {
		creator = creator.replace(/\s/, '');
		creator = {
			lastName: creator,
			creatorType: 'author',
			fieldMode: true
		}
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
			item.archiveID = url.match(/\/abs\/[\d\.]+/)[0].substring(5);
			// Z.debug(item);
			item.title = doc.querySelector('div.hd > h1').innerText;
			item['titleTranslation'] = doc.querySelector('div.hd > p').innerText;
			item.creators = ZU.xpath(doc, '//div[@class="flex_item content"]/div[@class="bd"][1]//li[1]/a').map((element) => 
				matchCreator((element.textContent)));
			item.tags = ZU.xpath(doc, '//span[@class="spankwd"]').map((element) => ({'tag': element.textContent}));
			item.abstractNote = doc.querySelector('div.bd > p:nth-child(1) > b').nextSibling.textContent;
			item['abstractTranslation'] = doc.querySelector('div.bd > p:nth-child(2) > b').nextSibling.textContent;
			item.url = url;
			let journalNameLable = Array.prototype.find.call(doc.querySelectorAll(
				'div.bd > ul > li >b'), 
				(node) => (node.innerText == '期刊：'));
			if (journalNameLable) {
				item.publicationTitle = journalNameLable.nextElementSibling.innerText;
			}
			else {
				item.publicationTitle = '中国科学院科技论文预发布平台';
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
		"url": "http://www.chinaxiv.org/abs/202303.00566v1",
		"detectedItemType": "journalArticle",
		"items": [
			{
				"itemType": "preprint",
				"title": "B微合金化对HK40合金铸造疏松的影响",
				"creators": [
					{
						"lastName": "丁贤飞",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "刘东方",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "郑运荣",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "冯强",
						"creatorType": "author",
						"fieldMode": true
					}
				],
				"abstractNote": "利用SEM, OM和XRD等手段分析了HK40 合金铸件铸造疏松形成原因, 并研究了添加微量B对HK40 合金的凝固组织及疏松形成的影响. 结果表明: HK40 合金铸件主要存在A和B 2 种铸造疏松缺陷. A类疏松主要由于枝晶的快速生长并架桥联接导致架桥枝晶之间区域的补缩不足引起; B类疏松产生原因是相邻枝晶间区域生长的枝晶状M7C3型碳化物堵塞枝晶间补缩通道. B微合金化能降低HK40 合金铸件较强的柱状晶生长趋势, 细化枝晶, 能抑制HK40 合金A类铸造疏松缺陷的产生. 同时, B微合金化增加了HK40 合金枝晶间共晶相的体积分数, 使枝晶间呈枝晶状M7C3型碳化物转变为层片状的M23C6型碳化物析出, 避免碳化物堵塞相邻枝晶间的补缩通道, 因而也减小了B类铸造疏松缺陷的形成倾向.",
				"archiveID": "202303.00566",
				"libraryCatalog": "ChinaXiv",
				"url": "http://www.chinaxiv.org/abs/202303.00566v1",
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
						"tag": " B微合金化"
					},
					{
						"tag": " 硼化物"
					},
					{
						"tag": " 碳化物"
					},
					{
						"tag": " 铸造疏松"
					},
					{
						"tag": "HK40 合金"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.chinaxiv.org/abs/202308.00082",
		"detectedItemType": "journalArticle",
		"items": [
			{
				"itemType": "preprint",
				"title": "Gentle代数的矩阵模型及其整体维数",
				"creators": [
					{
						"lastName": "张梦蝶",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "刘雨喆",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "章超",
						"creatorType": "author",
						"fieldMode": true
					}
				],
				"abstractNote": "该文利用gentle代数的矩阵模型刻画了gentle代数上的单模和投射模, 给出了单模的投射分解的矩阵表示. 由此指出gentle代数的整体维数可以由它的矩阵模型所诱导的一类特殊子矩阵序列进行刻画. 该文进一步指出这一类特殊子矩阵序列对应gentle代数的箭图上的极大非平凡forbidden路, 从而得到gentle代数的整体维数等于它的箭图上的极大非平凡forbidden path的长度.",
				"archiveID": "202308.00082",
				"libraryCatalog": "ChinaXiv",
				"url": "http://www.chinaxiv.org/abs/202308.00082",
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
						"tag": "同调维数"
					},
					{
						"tag": "投射分解"
					},
					{
						"tag": "投射模"
					},
					{
						"tag": "矩阵表示"
					},
					{
						"tag": "箭图表示"
					}
				],
				"notes": [
					{
						"note": "<p>��2���޸����ݣ������˶���3.3�еļǺ�˵�����޸��˶���3.3���ݵ���������֤�������ύ��chinaXivʱδ�Ǽǵ�������Ϣ��</p>"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.chinaxiv.org/home.htm",
		"items": "multiple"
	}
]
/** END TEST CASES **/
