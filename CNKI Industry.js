{
	"translatorID": "5f98fbee-3a34-4aed-8814-4b27b2c58784",
	"label": "CNKI Industry",
	"creator": "jiaojiaodubai",
	"target": "^https?://inds\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 150,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-01 08:11:26"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai

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

/*
exapmle:
https://xczx.cnki.net/#/index
https://zkyy.cnki.net/
https://cdc.cnki.net/
https://asst.cnki.net/

 */

const typeMap = {
	期刊: 'journalArticle',
	硕士: 'thesis',
	博士: 'thesis',
	国内会议: 'conferencePaper',
	外文期刊: 'journalArticle'
};

function detectWeb(doc, _url) {
	let resultPanel = doc.querySelector('#divSearchResult');
	if (resultPanel) {
		Z.monitorDOMChanges(resultPanel, { subtree: true, childList: true });
	}
	let typeKey = text(doc, '#catalog_Ptitle');
	if (typeKey in typeMap) {
		return typeMap[typeKey];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.s-single h1> a');
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
			let doc = await requestDocument(url);
			if (detectWeb(doc, url)) {
				await scrape(doc);
			}
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	for (let button of doc.querySelectorAll('[id*="DivSummaryMore"]')) {
		let observer = new MutationObserver(() => {
			observer.disconnect();
		});

		observer.observe(doc.querySelector('[class*="summary"], #main'), { subtree: true, childList: true });
		if (button && button.textContent.includes('更多')) {
			await button.click();
		}
	}
	const labels = new LabelsX(doc, '[class*="summary"] > p, .summaryRight, .break > .pdfN, [class*="summary"] li.pdfN, .itembox .item');

	/* 因为两种抓取方式都需要补充extra,所以提前add */
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	if (doc.querySelector('.shoufa')) {
		extra.add('Status', 'advance online publication', true);
		extra.add('available-date', ZU.strToISO(text(doc, '.head-tag')));
	}
	extra.add('foundation', labels.getWith('基金'));
	extra.add('CLC', labels.getWith('分类号'));
	extra.add('CNKICite', labels.getWith('被引频次'));
	extra.add('download', labels.getWith('下载'));
	extra.add('organizer', labels.getWith('主办单位'));
	let typeKey = text(doc, '#catalog_Ptitle');
	try {
		// throw new Error('debug');
		let id = attr(doc, '#SnapshotSearchButton', 'onclick')
			.match(/'.+?'/g)
			.map(string => string.slice(1, -1));
		Z.debug(id);
		let postBody = 'orderBy=0|desc&breifFields=&saveType=TXT&type=ENDNOTE'
			+ `&platform=${id[3].substring(0, 4)}`
			+ `&fileNames=${id[2]}!${id[1]}`
			+ `&dbCode=${id[3]}`;
		Z.debug(postBody);
		let referText = await requestText('https://inds.cnki.net/kus/viewSave/save/', {
			method: 'POST',
			headers: {
				Referer: url
			},
			body: postBody
		});
		Z.debug(referText);
		let translator = Zotero.loadTranslator('import');
		// CNKI Refer
		translator.setTranslator('7b6b135a-ed39-4d90-8e38-65516671c5bc');
		translator.setString(referText);
		translator.setHandler('itemDone', (_obj, item) => {
			switch (item.itemType) {
				case 'thesis': {
					let pubInfo = labels.getWith('作者基本信息');
					item.thesisType = `${typeKey}学位论文`;
					item.university = labels.getWith('网络出版投稿人') || pubInfo.split(/，\s?/)[0];
					break;
				}
				case 'conferencePaper':
					item.date = labels.getWith('会议时间');
					item.proceedingsTitle = labels.getWith('会议录名称');
					item.conferenceName = labels.getWith('会议名称');
					item.place = labels.getWith('会议地点');
					break;
			}
			procesAttachment(item, doc);
			item.extra = extra.toString(item.extra);
			item.complete();
		});
		await translator.translate();
	}
	catch (error) {
		var newItem = new Z.Item(typeMap[typeKey]);
		newItem.title = text(doc, '#chTitle, #main h3');
		newItem.abstractNote = labels.getWith(['摘要', 'Abstract']).replace(/\s*更多还原$/, '');
		labels.getWith(['作者', 'Author'], true).querySelectorAll('a').forEach((creator) => {
			creator = ZU.cleanAuthor(ZU.capitalizeName(ZU.trimInternal(creator.textContent).replace(/[;；]/g, '')), 'author');
			if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
				creator.lastName = creator.firstName + creator.lastName;
				creator.firstName = '';
				creator.fieldMode = 1;
			}
			newItem.creators.push(creator);
		});
		labels.getWith(['关键词', 'Key Words'], true).querySelectorAll('a').forEach(tag => newItem.tags.push(ZU.trimInternal(tag.innerText)));
		switch (newItem.itemType) {
			case 'journalArticle': {
				let pubInfo = attr(doc, '#hidtitle', 'value');
				newItem.publicationTitle = tryMatch(pubInfo, /-(.+?)-/, 1) || labels.getWith('Journal');
				// volume is unavailable
				newItem.issue = tryMatch(pubInfo, /0*([1-9]\d*)期/, 1);
				newItem.date = tryMatch(pubInfo, /(\d{4})年/, 1);
				break;
			}
			case 'thesis': {
				let pubInfo = labels.getWith('作者基本信息');
				newItem.thesisType = `${typeKey}学位论文`;
				newItem.university = labels.getWith('网络出版投稿人') || pubInfo.split(/，\s?/)[0];
				newItem.date = tryMatch(pubInfo, /\d{4}/) || ZU.strToISO(labels.getWith('Year'));
				newItem.ISSN = labels.getWith('ISSN');
				labels.getWith('导师', true).querySelectorAll('a').forEach((creator) => {
					creator = ZU.cleanAuthor(ZU.trimInternal(creator.textContent), 'contributor');
					if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
						creator.lastName = creator.firstName + creator.lastName;
						creator.firstName = '';
						creator.fieldMode = 1;
					}
					newItem.creators.push(creator);
				});
				break;
			}
			case 'conferencePaper':
				newItem.date = labels.getWith('会议时间');
				newItem.proceedingsTitle = labels.getWith('会议录名称');
				newItem.conferenceName = labels.getWith('会议名称');
				newItem.place = labels.getWith('会议地点');
				break;
		}
		newItem.DOI = labels.getWith('DOI');
		newItem.url = url;
		procesAttachment(newItem, doc);
		newItem.extra = extra.toString();
		newItem.complete();
	}
}
class LabelsX {
	constructor(doc, selector) {
		this.innerData = [];
		this.emptyElement = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elementCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elementCopy.removeChild(elementCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elementCopy.childNodes.length > 1) {
					let key = elementCopy.removeChild(elementCopy.firstChild).textContent.replace(/\s/g, '');
					this.innerData.push([key, elementCopy]);
				}
				else {
					let text = ZU.trimInternal(elementCopy.textContent);
					let key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elementCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.innerData.push([key, elementCopy]);
				}
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let results = label
				.map(aLabel => this.getWith(aLabel, element));
			let keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElement
					: '';
		}
		let pattern = new RegExp(label, 'i');
		let keyVal = this.innerData.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElement
				: '';
	}
}

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
	toString: function (original) {
		return original
			? [
				...this.clsFields.map(entry => `${entry[0]}: ${entry[1]}`),
				original.replace(/^\n|\n$/g, ''),
				...this.elseFields.map(entry => `${entry[0]}: ${entry[1]}`)
			].join('\n')
			: [...this.clsFields, ...this.elseFields]
				.map(entry => `${entry[0]}: ${entry[1]}`)
				.join('\n');
	}
};

function procesAttachment(item, doc) {
	let cajLink = doc.querySelector('.cajDNew > a');
	let pdfLink = doc.querySelector('.pdfD> a');
	if (pdfLink) {
		item.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	else if (cajLink) {
		item.attachments.push({
			url: pdfLink.href,
			title: 'Full Text CAJ',
			mimeType: 'application/caj'
		});
	}
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://inds.cnki.net/kcms/detail?v=Wtx%2bKl9vHGtB%2b5wfiGJn9V6WboxQr5XBDVwy6acE9FCWk6S48xj92QK0%2b3dZ%2bwDOOHCxDAoNw5qiNw/VKemK6YDsGO1sxG5BUuxfhSeE1dI=",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "中国省际食用菌产业集聚及空间差异化研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "田丹梅",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘起林",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "高康",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王艺民",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"ISSN": "1001-0009",
				"abstractNote": "基于2012—2021年我国25个省（市、自治区）食用菌相关统计数据，采用改良区位熵值法探究各地区食用菌产业集聚度及集聚变动趋势，并通过探索性空间数据分析法进一步对集聚度进行了空间差异化分析，以期为培育壮大食用菌产业并使之成为未来农业发展新增长点提供参考依据。结果表明：1）基于时序视角下，食用菌产业集聚变动趋势差异较大，东北地区的食用菌产业集聚水平始终最高，而河南、福建、黑龙江、吉林和江西是我国食用菌产业优势区域；基于空间视角下，食用菌产业集群呈现从东部地区开始向西南地区和西北地区扩展的转移态势。2）食用菌产业集聚整体上呈下降趋势，食用菌产业集聚空间自相关和集聚特征处于不断弱化的过程，集聚热点区域的总体格局保持稳定，总体呈现“东热”的空间格局，吉林、福建一直处于相对稳定的热点区域。我国省际食用菌产业集聚变动趋势差异较大，空间差异化显著，应培育壮大食用菌产业，加强结构性改革，积极创建优势特色食用菌产业集群，以促进食用菌产业高质量发展。",
				"extra": "Status: advance online publication\navailable-date: 2024-01-23\nfoundation: 贵州教育厅青年科技人才成长资助项目（黔教合KY字[2022]019号）;北京市产业经济与政策创新团队资助项目（BAIC11-2023）\nCLC: F326.13\ndownload: 38",
				"libraryCatalog": "CNKI Industry",
				"pages": "1-11",
				"publicationTitle": "北方园艺",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "探索性空间数据分析法"
					},
					{
						"tag": "改良区位熵值法"
					},
					{
						"tag": "空间差异化"
					},
					{
						"tag": "集聚度"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://inds.cnki.net/kcms/detail?v=Wtx%2bKl9vHGtB%2b5wfiGJn9aqOsBTvRMjRdw1tpZguBkp09/w9KSm64WimB3lWyD2ecFN/YTZ4XAiFW7KgHbv7tg==",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "中国药用真菌名录及部分名称的修订",
				"creators": [
					{
						"firstName": "",
						"lastName": "戴玉成",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨祝良",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2008",
				"ISSN": "1672-6472",
				"abstractNote": "近年来,我国对药用真菌的研究和利用越来越重视,相关报道逐年增加。针对有些种类鉴定有误、拉丁学名使用没有严格遵守最新国际植物命名法规、命名人缩写不规范等问题,作者系统考证了我国药用真菌的名称,共收录473种,对每种名称按新近的研究成果和最新命名法规(维也纳法规)进行了订正,对过去的错误报道或不存在的名称进行了修正,将曾报道的、但应作为其他种的同物异名者列在其正名之后,所有名称定名人的缩写全部按国际植物命名法规的要求加以规范化。每种名称之后还列举了该种的主要药用功能或价值,并引证了主要参考文献。",
				"extra": "foundation: 国家高技术研究发展计划(No.2007AA021506);国家自然科学基金(No.30771730)\nCLC: S567.3\nCNKICite: 874\ndownload: 4287",
				"issue": "6",
				"libraryCatalog": "CNKI Industry",
				"pages": "801-824",
				"publicationTitle": "菌物学报",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "命名法规"
					},
					{
						"tag": "拉丁名称"
					},
					{
						"tag": "药用真菌"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://inds.cnki.net/kcms/detail?v=Wtx%2bKl9vHGtB%2b5wfiGJn9Q2H2%2bOzL5TW%2bnCtJWoDH8u8jiNx4O2AQr8Y4cY8/BZnbEwA53Lr%2bA7aBI9Z%2baJfWA==",
		"items": [
			{
				"itemType": "thesis",
				"title": "秸秆资源评价与利用研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "毕于运",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "徐斌",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2010",
				"abstractNote": "中国是世界秸秆大国。秸秆资源的开发利用,既涉及到农业生产系统中的物质高效转化和能量高效循环,成为循环农业和低碳经济的重要实现途径,又涉及到整个农业生态系统中的土壤肥力、环境安全以及可再生资源高效利用等可持续发展问题,还涉及到农民生活系统中的家居温暖和环境清洁,逐步成为农业和农村社会经济可持续发展的必然要求。\n秸秆资源数量估算主要有三种方法:一是草谷比法;二是副产品比重法;三是收获指数法。本文以大量的农作物种植试验研究文献为主要依据,利用其提供的农作物各部分生物量、收获指数(经济系数)、谷草比等基础数据,结合现实的草谷比实测结果,对我国各类农作物的草谷比进行了仔细的考证,从而建立了更为系统、更为精确的草谷比体系。继而以新建草谷比体系为依据,结合历年农作物生产统计数据,对1952年以来我国历年各类农作物秸秆产量和2008年分省(市、自治区)各类农作物秸秆产量进行了全面系统的估算,并汇总出了1952-2008年全国农作物秸秆总产量和2008年全国各省(市、自治区)秸秆总产量。计算结果表明:(1)2008年全国秸秆产量达到84219.41万t,与1952年(21690.62万t)相比净增2.88倍;(2)中国是世界第一秸秆大国;(3)秸秆是我国陆地植被中年生长量最高的生物质资源,分别相当于全国林地生物质年生长量的1.36倍、牧草地年总产草量的2.56倍和园地生物质年生长量的7.75倍;(4)水稻、小麦、玉米三大粮食作物秸秆产量合计占全国秸秆总产量的2/3左右;(5)全国近一半的秸秆资源分布于全国百分之十几的土地上。\n在农产品收获过程中,许多农作物需要留茬收割;在农作物生长过程中,尤其是在收获过程中,多数农作物都会有一定量的枝叶脱离其植株而残留在田中;在秸秆运输过程中也会有部分损失,因此并不是所有的秸秆都能够被收集起来。本文通过对各类农作物株高、收割留茬高度、叶部生物量比重、枝叶脱落率、收贮运损失率的调查和资料收集,制定了我国各类农作物秸秆的可收集利用系数,并据此估算了我国各类农作物的可收集利用量。计算结果表明:2008年我国秸秆的可收集利用总量为65102.19万t,平均可收集系数为0.77。\n秸秆主要有五个方面的用途:一是用作燃料;二是用作饲料;三是用作肥料;四是用作工业原料;五是用作食用菌基料,简称“五料”。本文依据秸秆的形态、质地、密度、物体结构、物质组分、养分含量、热值等",
				"extra": "CLC: S38\nCNKICite: 744\ndownload: 20197",
				"libraryCatalog": "CNKI Industry",
				"numPages": "243",
				"thesisType": "博士学位论文",
				"university": "中国农业科学院",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "中国"
					},
					{
						"tag": "利用"
					},
					{
						"tag": "可收集利用量"
					},
					{
						"tag": "秸秆资源"
					},
					{
						"tag": "草谷比"
					},
					{
						"tag": "评价"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://inds.cnki.net/kcms/detail?v=Wtx%2bKl9vHGtB%2b5wfiGJn9SKtZq3UVw%2brZjdsY5d/8sdFFt5UF8FzImctE5int8GHUyAiPlK1Xs2u013ID67wAnjo6WplGkmERbeoCQQGIdY=",
		"items": [
			{
				"itemType": "thesis",
				"title": "阿司匹林肠溶缓释片的研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "毕铁琳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "付秀娟",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2015",
				"abstractNote": "目的：阿司匹林（Aspirin）是一种应用历史悠久的非甾体抗炎药，近几年来更是成为血栓栓塞性疾病治疗的首选药物。当人体血液中血小板被活化时，细胞内钙离子浓度升高，促使细胞膜磷脂释放出花生四烯酸，花生四烯酸在环氧化酶作用下分别转化成血栓素A2和前列环素，而阿司匹林通过使环氧化酶乙酰化失活来减少血栓素A2的生成，进而抑制血小板聚集，达到减少血管堵塞的发生率，有效地预防血栓形成的目的，常用于冠状动脉血管栓塞导致的心肌梗塞（AMI）及心绞痛；脑血管栓塞导致的脑血栓中风；肺动脉栓塞导致的肺梗塞、肺源性心脏病；肢体动脉栓塞导致的肢端疼痛或坏死，肢体静脉栓塞导致的局部水肿和疼痛等。但长期大量服用阿司匹林易造成胃肠道不良反应，如胃溃疡，胃肠穿孔甚至胃出血。现需要改变其剂型进而减少其不良反应的发生，延长药物半衰期，缓慢释药，使其血药浓度在较长时间内不会出现大的波动，改善药效，更好的提高生物利用度。本文对阿司匹林肠溶缓释片的制备工艺及质量标准进行了考察。方法：本文通过释放度检测试验对阿司匹林肠溶缓释片的处方进行了初步筛选，并运用均匀设计法对处方进行了优化；将处方量扩大100倍进行中试实验，验证了处方的可行性及合理性。对阿司匹林肠溶缓释片的质量标准进行考察，采用紫外-可见分光光度计法对其释放度进行测定，并采用高效液相色谱法进行了方法学考察。最后，对阿司匹林肠溶缓释片进行了稳定性考察，包括高温、高湿条件下的影响因素考察，为期六个月的加速实验以及十二个月的长期实验，考察其外观、释放度及含量的变化。结果：筛选出的最佳处方为：阿司匹林25g，淀粉9g，十二烷基硫酸钠0.75g，微晶纤维素2g，羟丙基甲基纤维素(K15M)5.25g，滑石粉1g，3%聚乙烯吡咯烷酮醇溶液适量。经过中试实验结果考察，该处方符合国家标准。阿司匹林肠溶缓释片质量标准的考察结果，确认该制备工艺可行、重现性良好。稳定性考察实验结果良好，各项指标均未见明显变化，表明该工艺制备的阿司匹林肠溶缓释片的质量稳定。结论：该论文对处方辅料配比及制备工艺进行优化，得到体外释放度较好的阿司匹林肠溶缓释片，从而在减少胃肠道不良反应的同时提高其生物利用度，同时减少服药次数，使药物缓慢释放，达到一个稳态的血药浓度，提高阿司匹林肠溶缓释片的临床应用效果，提高了患者的依从性。",
				"extra": "CLC: R943\nCNKICite: 9\ndownload: 3399",
				"libraryCatalog": "CNKI Industry",
				"numPages": "41",
				"thesisType": "硕士学位论文",
				"university": "吉林大学",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "处方筛选"
					},
					{
						"tag": "肠溶缓释片"
					},
					{
						"tag": "质量标准"
					},
					{
						"tag": "释放度"
					},
					{
						"tag": "阿司匹林"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://inds.cnki.net/kcms/detail?v=/NbqRMhLIXCxzE8XTXq4RMxYIKDOhpfBOu1mK9Puo8BWuTomgAsiYEAIaeq6SEJP7a40jOExmE/PfV3MVRBlFEZ3eb7ao27syAccY3xy5Bs=",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "基于灰色预测的我国基层医疗卫生机构发展趋势分析",
				"creators": [
					{
						"firstName": "",
						"lastName": "孙杨",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙海涛",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨帆",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "郎颖",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-06-03",
				"abstractNote": "我国基层医疗卫生机构健康服务水平不断优化,但服务能力和人员配置等方面仍存在不足,而且目前缺乏对基层卫生机构未来发展趋势的研究。分析我国基层医疗机构发展现状,对其未来发展趋势进行预测,以期为今后卫生政策的制定提供参考依据。基于我国2012—2022年的统计年鉴资料,选择机构数、床位数、万元以上设备数、乡村医生和卫生员数、卫生技术人员数和诊疗人次作为测量指标,构建GM(1,1)灰色预测模型对我国2022—2025年基层医疗卫生机构的发展趋势进行预测。除诊疗人次外其他指标所构建的GM(1,1)预测模型精度均>95%,预测值与实际值之间的平均相对误差均小于6%,模型精度较高;发展系数精度检验结果显示模型具有中长期预测的能力,模型选择合理。我国2022—2025年基层医疗卫生机构的乡村医生和卫生人员数呈逐渐减少趋势,但机构数、床位数、万元以上设备数、卫生技术人员数和诊疗人次持续增长。我国基层医疗卫生机构设施建设逐年向好,但基层卫生技术人员短缺和乡村医生断档现象仍将持续,其服务能力、效率尚需提升。国家和地方政府卫生投入应进一步向基层倾斜,制定吸引和保持人才的政策,提高基层医疗卫生服务能力和效率。",
				"conferenceName": "首届全国全科医疗质量论坛",
				"extra": "CLC: R197\norganizer: 全科医疗质量控制联盟",
				"libraryCatalog": "CNKI Industry",
				"pages": "1, 1",
				"place": "中国上海",
				"proceedingsTitle": "首届全国全科医疗质量论坛论文摘要集",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "乡村医生"
					},
					{
						"tag": "人员配置"
					},
					{
						"tag": "发展趋势"
					},
					{
						"tag": "基层医疗卫生机构"
					},
					{
						"tag": "灰色预测"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://inds.cnki.net/kcms/detail?v=nbJUGfh75xq6UFfci6hGq0esDmD2PSyIbgAMsQQ/TuaRp4WgwSy5kQ0jJydTRF8roZqVTffbItmN3p8aaNGwVNsQ3gBFjY75X2%2bAdvTzIqUUxeHopYsWCR/f35LlFsu6M0xYmG1ZjB2cclIe/qdrWw==",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "First Solar Power Sail Demonstration by IKAROS",
				"creators": [
					{
						"firstName": "Mori",
						"lastName": "Osamu",
						"creatorType": "author"
					},
					{
						"firstName": "Sawada",
						"lastName": "Hirotaka",
						"creatorType": "author"
					},
					{
						"firstName": "Funase",
						"lastName": "Ryu",
						"creatorType": "author"
					},
					{
						"firstName": "Morimoto",
						"lastName": "Mutsuko",
						"creatorType": "author"
					},
					{
						"firstName": "Endo",
						"lastName": "Tatsuya",
						"creatorType": "author"
					},
					{
						"firstName": "Yamamoto",
						"lastName": "Takayuki",
						"creatorType": "author"
					},
					{
						"firstName": "Tsuda",
						"lastName": "Yuichi",
						"creatorType": "author"
					},
					{
						"firstName": "Kawakatsu",
						"lastName": "Yasuhiro",
						"creatorType": "author"
					},
					{
						"firstName": "Kawaguchi",
						"lastName": "Jun’ichiro",
						"creatorType": "author"
					},
					{
						"firstName": "Miyazaki",
						"lastName": "Yasuyuki",
						"creatorType": "author"
					},
					{
						"firstName": "Shirasawa",
						"lastName": "Yoji",
						"creatorType": "author"
					},
					{
						"firstName": "Demonstration Team And Solar Sail W.",
						"lastName": "Ikaros",
						"creatorType": "author"
					}
				],
				"DOI": "10.2322/TASTJ.8.TO_4_25",
				"abstractNote": "The Japan Aerospace Exploration Agency (JAXA) will make the world's first solar power sail craft demonstration of photon propulsion and thin film solar power generation during its interplanetary cruise by IKAROS (Interplanetary Kite-craft Accelerated by Radiation Of the Sun). The spacecraft deploys and spans a membrane of 20 meters in diameter taking the advantage of the spin centrifugal force. The spacecraft weighs approximately 310kg, launched together with the agency's Venus Climate Orbiter, AKATSUKI in May 2010. This will be the first actual solar sail flying an interplanetary voyage. 更多还原 AbstractFilter('ChDivSummary_YWZY','ChDivSummaryMore_YWZY','ChDivSummaryReset_YWZY');",
				"libraryCatalog": "CNKI Industry",
				"publicationTitle": "TRANSACTIONS OF THE JAPAN SOCIETY FOR AERONAUTICAL AND SPACE SCIENCES, AEROSPACE TECHNOLOGY JAPAN",
				"url": "https://inds.cnki.net/kcms/detail?v=nbJUGfh75xq6UFfci6hGq0esDmD2PSyIbgAMsQQ/TuaRp4WgwSy5kQ0jJydTRF8roZqVTffbItmN3p8aaNGwVNsQ3gBFjY75X2%2bAdvTzIqUUxeHopYsWCR/f35LlFsu6M0xYmG1ZjB2cclIe/qdrWw==",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://inds.cnki.net/kns/search/index?dbCode=XCXTZK&kw=%E8%8D%89%E8%8F%87&korder=2",
		"items": "multiple"
	}
]
/** END TEST CASES **/
