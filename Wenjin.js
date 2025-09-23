{
	"translatorID": "f306107f-dabb-41ac-8fa2-f7f858feb11f",
	"label": "Wenjin",
	"creator": "Xingzhong Lin, jiaojiaodubai",
	"target": "https?://find\\.nlc\\.cn/search",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-09-23 02:30:37"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Xingzhong Lin, https://github.com/Zotero-CN/translators_CN
	
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
	if (url.includes('/search/showDocDetails')) {
		return detectType(doc);
	}
	else if (url.includes('search/doSearch?query') && getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function detectType(doc) {
	const typeMap = {
		专著: 'book',
		善本: 'book',
		普通古籍: 'book',
		特藏古籍: 'book',
		学位论文: 'thesis',
		期刊论文: 'journalArticle',
		期刊: 'journalArticle',
		报纸: 'newspaperArticle',
		计算机文件: 'book',
		报告: 'report'
	};
	return typeMap[text(doc, '.book_item:nth-child(2) span.book_val')];
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('div.article_item div.book_name > a');
	for (const row of rows) {
		const title = ZU.trimInternal(row.textContent);
		const href = row.href;
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const newItem = new Z.Item(detectType(doc));
	newItem.title = text(doc, '.book_name');
	const data = getLabeledData(
		doc.querySelectorAll('.book_item'),
		row => innerText(row, ':where(.book_type, .book_val):first-child').replace(/\s*：\s*$/, ''),
		row => row.querySelector(':where(.book_type, .book_val)+*'),
		doc.createElement('div')
	);
	newItem.abstractNote = text(doc, 'div.zy_pp_val') || data('引文');
	switch (newItem.itemType) {
		case 'book': {
			// http://find.nlc.cn/search/showDocDetails?docId=-5158343139126139955&dataSource=ucs01&query=%E5%B9%BF%E9%9F%B5
			newItem.series = data('丛编题名');
			// http://find.nlc.cn/search/showDocDetails?docId=-9108259640625243569&dataSource=ucs01&query=%E6%A2%A6%E6%BA%AA%E7%AC%94%E8%B0%88
			newItem.numberOfVolumes = tryMatch(data('载体形态'), /(\d+)册/, 1);
			// http://find.nlc.cn/search/showDocDetails?docId=-5158343139126139955&dataSource=ucs01&query=%E5%B9%BF%E9%9F%B5
			newItem.edition = data('版本说明 ');
			newItem.place = data('出版、发行地');
			newItem.publisher = data('出版、发行者');
			newItem.date = ZU.strToISO(data('出版发行时间'));
			// http://find.nlc.cn/search/showDocDetails?docId=-3372694795849761390&dataSource=mgwx&query=%E5%B9%BF%E9%9F%B5
			newItem.numPages = tryMatch(data('载体形态'), /(\d+)页$/, 1);
			newItem.ISBN = ZU.cleanISBN(data('标识号'));
			if (['善本', '普通古籍', '特藏古籍'].includes(text(doc, '.book_val'))) {
				newItem.setExtra('type', 'classic');
			}
			const creatorsExt = [];
			data('所有责任者', true).innerText.trim().split(/\s{2}|，/).forEach((name) => {
				let creatorType = 'author';
				const role = tryMatch(name, /\[?([主副参]?编|编?[撰著]|演奏|翻?译)\]?$/);
				if (!/著/.test(name) && role) {
					if (/译$/.test(role)) {
						creatorType = 'translator';
					}
					else if (role.includes('编')) {
						creatorType = 'editor';
					}
				}
				name = name.slice(0, role ? -role.length : name.length);
				// http://find.nlc.cn/search/showDocDetails?docId=-9108259640625243569&dataSource=ucs01&query=%E6%A2%A6%E6%BA%AA%E7%AC%94%E8%B0%88
				// http://find.nlc.cn/search/showDocDetails?docId=-4203196484494800823&dataSource=ucs01&query=%E6%B0%B4%E5%90%88%E7%89%A9
				// http://find.nlc.cn/search/showDocDetails?docId=-4300747930403378569&dataSource=ucs01&query=%E6%9C%97%E6%96%87
				const country = tryMatch(name, /^(\(.+?\)|\[.+?\]|（.+?）)/).slice(1, -1);
				name = name.slice(country ? country.length + 2 : 0);
				const original = tryMatch(name, /\(.+?\)$/).slice(1, -1);
				name = name.slice(0, original ? -(original.length + 2) : name.length);
				const creator = cleanAuthor(name, creatorType);
				newItem.creators.push(ZU.deepCopy(creator));
				if (original) {
					const enCreator = ZU.cleanAuthor(original, creatorType);
					const enCreatorStr = `${enCreator.lastName} || ${enCreator.firstName}`;
					creator.original = enCreatorStr;
					addExtra(newItem, 'original-author', enCreatorStr);
				}
				creatorsExt.push({
					...creator,
					country
				});
			});
			if (creatorsExt.some(creator => creator.country || creator.original)) {
				newItem.setExtra('creatorsExt', JSON.stringify(creatorsExt));
			}
			let medium = '';
			// http://find.nlc.cn/search/showDocDetails?docId=5443092259449818292&dataSource=ucs01&query=%E7%BA%A2%E6%98%9F
			// http://find.nlc.cn/search/showDocDetails?docId=7092562696966199047&dataSource=ucs01&query=%E7%90%86%E6%9F%A5%E5%BE%B7
			// http://find.nlc.cn/search/showDocDetails?docId=-9193368633718699152&dataSource=ucs01&query=%E8%8B%B1%E8%AF%AD
			if (['CD', 'DVD', 'VCD', '光盘'].some(word => data('载体形态').includes(word))) {
				medium = 'CD';
			}
			// http://find.nlc.cn/search/showDocDetails?docId=-3935743997161595407&dataSource=ucs01&query=%E8%8B%B1%E8%AF%AD
			else if (data('载体形态').includes('录音带')) {
				medium = 'MT';
			}
			medium && newItem.setExtra('medium', medium);
			break;
		}
		case 'journalArticle':
			newItem.publicationTitle = data('刊名', true).innerText.trim().split(/\s{2}/)[0];
			newItem.issue = tryMatch(data('期'), /\d+/).replace(/^0*/, '');
			newItem.pages = data('页');
			newItem.date = data(['出版发行时间', '年']);
			newItem.ISSN = tryMatch(data('标识号'), /:(.+?)(\s|$)/, 1);
			newItem.setExtra('original-title', tryMatch(data('文章题名'), /英文篇名 : (.+)(?:\s{2}|$)/, 1));
			newItem.setExtra('fund', data('基金'));
			data('作者', true).innerText.trim()
				.split(/\s{2}/).forEach((name) => {
					newItem.creators.push(cleanAuthor(name, 'author'));
				});
			break;
		case 'thesis': {
			newItem.thesisType = data('来源数据库').includes('博士')
				? '博士学位论文'
				: '硕士学位论文';
			newItem.university = data('论文授予机构');
			newItem.date = ZU.strToISO(data(['出版发行时间', '论文授予时间']));
			newItem.numPages = tryMatch(data('载体形态'), /(\d+)页$/, 1).replace(/\b0*/g, '');
			data('所有责任者', true).innerText.trim()
				.split(/\s{2}|，/).forEach((name) => {
					const creatorType = /指导$/.test(name)
						? 'contributor'
						: 'author';
					name = name.replace(/等?(著|指导)?$/, '');
					newItem.creators.push(cleanAuthor(name, creatorType));
				});
			const major = data('论文专业 ');
			major && newItem.setExtra('major', major);
			break;
		}
		case 'newspaperArticle':
			// http://find.nlc.cn/search/showDocDetails?docId=-382233026126726134&dataSource=fzbzcnml&query=%E6%96%B0%E5%8F%91%E5%B1%95%E7%90%86%E5%BF%B5
			// http://find.nlc.cn/search/showDocDetails?docId=-4758410971070022650&dataSource=ccnd&query=%E6%96%B0%E5%8F%91%E5%B1%95%E7%90%86%E5%BF%B5
			// http://find.nlc.cn/search/showDocDetails?docId=-3912556877249539014&dataSource=rdfyzlqwsjk&query=%E6%9D%A8%E8%A5%BF%E5%85%89
			newItem.publicationTitle = data(['报纸中文名', '期刊名称']);
			newItem.date = data(['日期', '出版发行扇门']);
			newItem.pages = (tryMatch(data('来源'), /(\d+)版/, 1) || data('版号')).replace(/^0*/, '');
			data(['所有责任者', '作者']).split(/\s/)
				.filter(creator => !creator.includes('记者'))
				.forEach((name) => {
					newItem.creators.push(cleanAuthor(name, 'author'));
				});
			break;
	}
	newItem.url = url;
	if (data('语种').includes('Chinese')) {
		newItem.language = 'zh-CN';
	}
	// ---见于图书
	// ;见于期刊
	(data('关键词', true) || data('中文关键词', true)).innerText.trim().split(/(?:---)|;|\s{2}/).forEach(tag => newItem.tags.push(tag));
	newItem.complete();
}

function getLabeledData(rows, labelGetter, dataGetter, defaultElm) {
	const labeledElm = {};
	for (const row of rows) {
		labeledElm[labelGetter(row, rows)] = dataGetter(row, rows);
	}
	const data = (labels, element = false) => {
		if (Array.isArray(labels)) {
			for (const label of labels) {
				const result = data(label, element);
				if (
					(element && /\S/.test(result.textContent))
					|| (!element && /\S/.test(result))) {
					return result;
				}
			}
			return element ? defaultElm : '';
		}
		const targetElm = labeledElm[labels];
		return targetElm
			? element ? targetElm : ZU.trimInternal(targetElm.textContent)
			: element ? defaultElm : '';
	};
	return data;
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

function cleanAuthor(name, creatorType = 'author') {
	return /\p{Unified_Ideograph}/u.test(name)
		? {
			firstName: '',
			lastName: name.replace(/\.\s*/g, '. '),
			creatorType,
			fieldMode: 1
		}
		: ZU.cleanAuthor(name, creatorType);
}

function addExtra(item, field, value) {
	if (!item.extra) {
		item.extra = '';
	}
	if (value) {
		item.extra += `${field}: ${value}`;
	}
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://find.nlc.cn/search/showDocDetails?docId=-8373230212045865087&dataSource=cjfd&query=wgcna",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "基于 WGCNA 算法的基因共表达网络构建理论及其 R 软件实现",
				"creators": [
					{
						"firstName": "",
						"lastName": "宋长新",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "雷萍",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王婷",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2013-02-28",
				"ISSN": "1674-568X",
				"abstractNote": "WGCNA(weighted geneco-expression network analysis) 算法是一种构建基因共表达网络的典型系统生物学算法，该算法基于高通量的基因信使 RNA(mRNA) 表达芯片数据，被广泛应用于国际生物医学领域。本文旨在介绍 WGCNA 的基本数理原理，并依托 R 软件包 WGNCA 以实例的方式介绍其应用。WGCNA 算法首先假定基因网络服从无尺度分布，并定义基因共表达相关矩阵、基因网络形成的邻接函数，然后计算不同节点的相异系数，并据此构建分层聚类树 (hierarchical clusteringtree),该聚类树的不同分支代表不同的基因模块 (module),模块内基因共表达程度高，而分数不同模块的基因共表达程度低。最后，探索模块与特定表型或疾病的关联关系，最终达到鉴定疾病治疗的靶点基因、基因网络的目的。",
				"extra": "original-title: Gene Co-expression Network Analysis Based on WGCNA Algorithm-Theory and Implementation in R Software\nfund: 青海省 135 高层次人才培养基金资助",
				"issue": "1",
				"libraryCatalog": "Wenjin",
				"pages": "143-149",
				"publicationTitle": "基因组学与应用生物学",
				"url": "http://find.nlc.cn/search/showDocDetails?docId=-8373230212045865087&dataSource=cjfd&query=wgcna",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://find.nlc.cn/search/showDocDetails?docId=6149274367424485698&dataSource=ucs01&query=%E7%BA%A2%E6%98%9F%E7%85%A7%E8%80%80%E4%B8%AD%E5%9B%BD",
		"items": [
			{
				"itemType": "book",
				"title": "红星照耀中国",
				"creators": [
					{
						"lastName": "埃德加·斯诺",
						"fieldMode": 1,
						"creatorType": "author"
					},
					{
						"lastName": "董乐山",
						"fieldMode": 1,
						"creatorType": "translator"
					}
				],
				"date": "2012",
				"ISBN": "9787506361347",
				"abstractNote": "本书分为十二篇，内容包括：探寻红色中国、去红都的道路、在保安、一个共产党员的由来等。",
				"extra": "original-author: Snow || Edgar\ncreatorsExt: [{\"lastName\":\"埃德加·斯诺\",\"fieldMode\":1,\"creatorType\":\"author\",\"original\":\"Snow || Edgar\",\"country\":\"美\"},{\"lastName\":\"董乐山\",\"fieldMode\":1,\"creatorType\":\"translator\",\"country\":\"\"}]",
				"language": "zh-CN",
				"libraryCatalog": "Wenjin",
				"numPages": "338",
				"place": "北京",
				"publisher": "作家出版社",
				"url": "http://find.nlc.cn/search/showDocDetails?docId=6149274367424485698&dataSource=ucs01&query=%E7%BA%A2%E6%98%9F%E7%85%A7%E8%80%80%E4%B8%AD%E5%9B%BD",
				"attachments": [],
				"tags": [
					{
						"tag": "中国工农红军"
					},
					{
						"tag": "史料"
					},
					{
						"tag": "史料"
					},
					{
						"tag": "陕北革命根据地"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://find.nlc.cn/search/showDocDetails?docId=7225006674714026291&dataSource=ucs01,bslw&query=%E4%BF%A1%E7%94%A8",
		"items": [
			{
				"itemType": "thesis",
				"title": "基于信用衍生工具的银行业信贷资产管理",
				"creators": [
					{
						"firstName": "",
						"lastName": "尹灼",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王国刚",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2004",
				"language": "zh-CN",
				"libraryCatalog": "Wenjin",
				"numPages": "289",
				"thesisType": "博士学位论文",
				"university": "中国社会科学院",
				"url": "http://find.nlc.cn/search/showDocDetails?docId=7225006674714026291&dataSource=ucs01,bslw&query=%E4%BF%A1%E7%94%A8",
				"attachments": [],
				"tags": [
					{
						"tag": "信用"
					},
					{
						"tag": "信贷"
					},
					{
						"tag": "资金管理"
					},
					{
						"tag": "银行"
					},
					{
						"tag": "风险管理"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://find.nlc.cn/search/showDocDetails?docId=-4758410971070022650&dataSource=ccnd&query=%E6%96%B0%E5%8F%91%E5%B1%95%E7%90%86%E5%BF%B5",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "新理念新技术促进新发展",
				"creators": [
					{
						"firstName": "",
						"lastName": "平伟明",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2006-12-26",
				"libraryCatalog": "Wenjin",
				"pages": "4",
				"publicationTitle": "贵州政协报",
				"url": "http://find.nlc.cn/search/showDocDetails?docId=-4758410971070022650&dataSource=ccnd&query=%E6%96%B0%E5%8F%91%E5%B1%95%E7%90%86%E5%BF%B5",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://find.nlc.cn/search/showDocDetails?docId=7092562696966199047&dataSource=ucs01&query=%E7%90%86%E6%9F%A5%E5%BE%B7",
		"items": [
			{
				"itemType": "book",
				"title": "钢琴金曲 - 理查德·克莱德曼",
				"creators": [
					{
						"firstName": "",
						"lastName": "理查德·克莱德曼",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2008",
				"ISBN": "9787884737703",
				"extra": "creatorsExt: [{\"firstName\":\"\",\"lastName\":\"理查德·克莱德曼\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"法\"}]\nmedium: CD",
				"libraryCatalog": "Wenjin",
				"place": "武汉",
				"publisher": "扬子江音像出版社",
				"url": "http://find.nlc.cn/search/showDocDetails?docId=7092562696966199047&dataSource=ucs01&query=%E7%90%86%E6%9F%A5%E5%BE%B7",
				"attachments": [],
				"tags": [
					{
						"tag": "外国"
					},
					{
						"tag": "钢琴曲"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://find.nlc.cn/search/doSearch?query=%E6%95%85%E4%BA%8B&secQuery=&actualQuery=%E6%95%85%E4%BA%8B&searchType=2&docType=%E5%85%A8%E9%83%A8&isGroup=isGroup&targetFieldLog=%E5%85%A8%E9%83%A8%E5%AD%97%E6%AE%B5&orderBy=RELATIVE",
		"items": "multiple"
	}
]
/** END TEST CASES **/
