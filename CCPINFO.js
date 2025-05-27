{
	"translatorID": "4c4b0a6c-a5e9-42ed-a742-f10f3e2ef711",
	"label": "CCPINFO",
	"creator": "jiaojiaodubai",
	"target": "^https?://book\\.cppinfo\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 12,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-05-27 07:40:48"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai23@gmail.com.

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

function detectSearch(items) {
	return (filterQuery(items).length > 0);
}

// return an array of ISBNs from the query (items or text)
function filterQuery(items) {
	if (!items) return [];

	if (typeof items == 'string' || !items.length) items = [items];

	// filter out invalid queries
	let isbns = [], isbn;
	for (let i = 0, n = items.length; i < n; i++) {
		if (items[i].ISBN && (isbn = ZU.cleanISBN(items[i].ISBN))) {
			isbns.push(isbn);
		}
		else if (typeof items[i] == 'string' && (isbn = ZU.cleanISBN(items[i]))) {
			isbns.push(isbn);
		}
	}
	isbns = isbns.filter(isbn => isbn.startsWith('9787'));
	return isbns;
}

async function doSearch(items) {
	Z.debug('get items:');
	Z.debug(items);
	for (const isbn of filterQuery(items)) {
		await processISBN(isbn);
	}
}

async function processISBN(isbn) {
	Z.debug(`prosessing ISBN: ${isbn}`);
	const search = await requestText(
		'https://book.cppinfo.cn/So/Search/Index',
		{
			method: 'POST',
			body: 'key=&author=&keyword='
				+ `&isbn=${isbn}`
				+ '&sm=&publishedClassification=&offset=1&sort=&order=&ids=&minprice=&maxprice=&languages=&cip=&hasEbook=false&pubyear=&authorsure=&publishersure=&cipsearch=',
			headers: {
				Referer: `https://book.cppinfo.cn/So/Home/QHSearch?isbn=${isbn}`
			}
		}
	);
	const href = 'https://book.cppinfo.cn' + tryMatch(search, /"p-text"><a href="(.+?)" onclick/, 1);
	Z.debug(`get search resualt: ${href}`);
	await scrape(await requestDocument(href));
}


function detectWeb(doc, url) {
	if (/id=[^&]+/.test(url)) {
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('#tbinfo > span > div > div.p-text > a');
	for (const row of rows) {
		const href = row.href;
		const title = ZU.trimInternal(row.title);
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
		for (const url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const newItem = new Zotero.Item('book');
	const data = getLabeledData(
		doc.querySelectorAll('.book_intro .book_con > :where(.fr, .fl)'),
		(row) => text(row, '.fl:first-child').replace(/：$/, ''),
		(row) => row.querySelector('.val_txt'),
		doc.createElement('div')
	);
	newItem.title = text(doc, '.book_intro > h2 > span');
	newItem.abstractNote = text(doc, 'div.field_1 > p');
	newItem.publisher = data('出版社');
	newItem.date = data('出版时间').replace(/\D$/, '').replace(/(\d)\D(\d)/g, '$1-$2');
	newItem.ISBN = data('ISBN');
	if (newItem.ISBN) {
		try {
			const searchLang = await requestText(
				'https://book.cppinfo.cn/So/Search/LangSearch',
				{
					method: 'POST',
					body: `key=${newItem.ISBN}&offset=1&hasEbook=false`
				}
			);
			const langFlag = searchLang.split('\r\n')[1].match(/([a-z]+)(?=(&))/)[0];
			Z.debug(langFlag);
			newItem.language = {
				chi: 'zh-CN',
				eng: 'en-US',
				ger: 'de-DE',
				fre: 'fr-FR',
				jpn: 'jp-JP'
			}[langFlag];
		}
		catch (error) {
			Z.debug('reqtest failed');
		}
	}
	newItem.url = url;
	newItem.libraryCatalog = '国家出版发行信息公共服务平台';
	newItem.setExtra('CLC', data('中图分类'));
	newItem.setExtra('price', data('定价'));
	function splitCreators(label, rolePattern, creatorType) {
		return data(label).replace(rolePattern, '').split(/[;、]/)
			.filter(string => string != '暂无')
			.map((name) => {
				// 方括号：https://book.cppinfo.cn/Encyclopedias/home/index?id=4483977
				// 西文括号：https://book.cppinfo.cn/Encyclopedias/home/index?id=4616652
				// 中文括号：https://book.cppinfo.cn/Encyclopedias/home/index?id=4557869
				const country = tryMatch(name, /^[[(（](.+?)[\])）]/, 1);
				const creator = ZU.cleanAuthor(name.replace(/^[[(（].+?[\])）]/, ''), creatorType);
				if (/\p{Unified_Ideograph}/u.test(creator.lastName)) {
					creator.fieldMode = 1;
				}
				newItem.creators.push(JSON.parse(JSON.stringify(creator)));
				creator.country = country;
				return creator;
			});
	}
	const creatorsExt = [
		...splitCreators('著者', /[等主编原著]*$/, 'author'),
		...splitCreators('编辑', /[等主总]*编$/, 'editor'),
		...splitCreators('译者', /[等翻译]*$/, 'translator')
	];
	if (creatorsExt.some(creator => creator.country)) {
		newItem.setExtra('creatorsExt', JSON.stringify(creatorsExt));
	}
	doc.querySelectorAll('div.book_label > div.label_in > span').forEach(elm => newItem.tags.push(elm.innerText));
	newItem.complete();
}

/* Util */
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
					(element && /\S/.test(result.textContent)) ||
					(!element && /\S/.test(result))) {
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
	return (match && match[index])
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://book.cppinfo.cn/Encyclopedias/home/index?id=4417147",
		"items": [
			{
				"itemType": "book",
				"title": "朗文新编英语语法",
				"creators": [
					{
						"firstName": "",
						"lastName": "马克·福利",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-07",
				"ISBN": "9787562866350",
				"abstractNote": "《朗文新编英语语法》由我社从培生教育出版公司引进，可供中学生、大学生以及英语学习者自学使用。本书由诊断测试、语法讲解和练习答案三部分组成。学习者可利用图书前面的诊断测试，在单元学习前，了解自己的薄弱项，从而进行有针对性的学习。语法知识点讲解部分共分为36个单元，包含一般语法书中的所有内容，语法解释详细，内容条理清晰。每个单元还配套丰富的练习题，学习者可通过练习巩固所学的语法点。本书所有例句均选自语料库，表达地道，是中高水平学习者巩固语法的不二之选。",
				"extra": "CLC: H314\nprice: ￥ 80.00\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"马克·福利\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"英\"},{\"firstName\":\"\",\"lastName\":\"\",\"creatorType\":\"editor\",\"country\":\"\"},{\"firstName\":\"\",\"lastName\":\"\",\"creatorType\":\"translator\",\"country\":\"\"}]",
				"libraryCatalog": "国家出版发行信息公共服务平台",
				"publisher": "郑州大学出版社有限公司",
				"url": "https://book.cppinfo.cn/Encyclopedias/home/index?id=4417147",
				"attachments": [],
				"tags": [
					{
						"tag": "单元"
					},
					{
						"tag": "学习者"
					},
					{
						"tag": "本书"
					},
					{
						"tag": "测试"
					},
					{
						"tag": "练习"
					},
					{
						"tag": "讲解"
					},
					{
						"tag": "语料库"
					},
					{
						"tag": "语法"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.cppinfo.cn/Encyclopedias/home/index?id=4567148",
		"items": [
			{
				"itemType": "book",
				"title": "拜占庭帝国大通史（330—610）",
				"creators": [
					{
						"firstName": "",
						"lastName": "徐家玲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "林英",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-10",
				"ISBN": "9787214275707",
				"abstractNote": "本书全面、系统地梳理了330-610年拜占庭王朝历史以及帝国的崛起。上编为皇帝列传，介绍了君士坦丁王朝、瓦伦提尼安诸帝、塞奥多西王朝、利奥王朝、查士丁尼王朝历史。下编为拜占庭帝国的崛起，从世界地理观、宗教、种族与身份认同、自然灾害等方面加以论述，聚焦拜占庭帝国历史的第一黄金时代，对查士丁尼时代的司法改革、宗教思想和政策、制度、经济生活等方面进行系统论述，展现拜占庭帝国的崛起图景。本书是具有唯物史观特色的、有可靠依据的独立意见和系列研究成果，形成了我国学者对拜占庭历史发展和文化演化的话语体系。",
				"extra": "CLC: K134\nprice: ￥ 248.00",
				"libraryCatalog": "国家出版发行信息公共服务平台",
				"publisher": "江苏人民出版社",
				"url": "https://book.cppinfo.cn/Encyclopedias/home/index?id=4567148",
				"attachments": [],
				"tags": [
					{
						"tag": "历史"
					},
					{
						"tag": "宗教"
					},
					{
						"tag": "崛起"
					},
					{
						"tag": "帝国"
					},
					{
						"tag": "本书"
					},
					{
						"tag": "王朝"
					},
					{
						"tag": "论述"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.cppinfo.cn/Encyclopedias/home/index?id=4479822",
		"items": [
			{
				"itemType": "book",
				"title": "新时代中国之治 如何跳出治乱兴衰的历史周期率(英文)",
				"creators": [
					{
						"firstName": "",
						"lastName": "李君如",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-11",
				"ISBN": "9787119132037",
				"abstractNote": "Since the 18th National Congress of the Communist Party of China in 2012， the drive to develop socialism with Chinese characteristics has entered a new era. The past decade has seen the country forging ahead and embracing historic changes， with remarkable achievements made by the Party and the state.\n  So how did China make these achievements? What are the secrets to the CPC's governance of China? What is the key to the success of China's governance in the new era?\n  This book covers such important topics as \"how to break the cycle of rise and fall\"， \"whole-process people's democracy\"， \"self-reform and social revolution\"， \"cyber governance\"， and \"Chinese-style modernization\"， reveals the secrets to the success of China's governance in the new era， and shares China's wisdom and solutions with the world.",
				"extra": "CLC: D616\nprice: ￥ 118.00",
				"language": "en-US",
				"libraryCatalog": "国家出版发行信息公共服务平台",
				"publisher": "外文出版社",
				"url": "https://book.cppinfo.cn/Encyclopedias/home/index?id=4479822",
				"attachments": [],
				"tags": [
					{
						"tag": "Chinese"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.cppinfo.cn/so/home/qhsearch?q=%E4%B8%89%E4%BD%93",
		"items": "multiple"
	},
	{
		"type": "search",
		"input": {
			"ISBN": "9787572609268"
		},
		"items": [
			{
				"itemType": "book",
				"title": "我在北京送快递",
				"creators": [
					{
						"firstName": "",
						"lastName": "胡安焉",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-04",
				"ISBN": "9787572609268",
				"abstractNote": "进入社会工作至今的十年间，胡安焉走南闯北，辗转于广东、广西、云南、上海、北京等地，做过快递员、夜班拣货工人、便利店店员、保安、自行车店销售、服装店销售、加油站加油工……他将工作的点滴和生活的甘苦化作真诚的自述，记录了一个平凡人在工作中的辛劳、私心、温情、正气。在物流公司夜间拣货的一年，给他留下了深刻的生理印记：“这份工作还会令人脾气变坏，因为长期熬夜以及过度劳累，人的情绪控制力会明显下降……我已经感到脑子不好使了，主要是反应变得迟钝，记忆力开始衰退。”",
				"extra": "CLC: I25\nprice: ￥ 56.00",
				"language": "zh-CN",
				"libraryCatalog": "CCPINFO",
				"publisher": "湖南文艺出版社",
				"url": "https://book.cppinfo.cn/Encyclopedias/home/index?id=4498142",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
