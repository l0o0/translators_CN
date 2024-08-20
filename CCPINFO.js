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
	"lastUpdated": "2024-03-08 09:49:44"
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
	var isbns = [], isbn;
	for (var i = 0, n = items.length; i < n; i++) {
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
	for (let isbn of filterQuery(items)) {
		await processISBN(isbn);
	}
}

async function processISBN(isbn) {
	Z.debug(`prosessing ISBN: ${isbn}`);
	let search = await requestText(
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
	let href = 'https://book.cppinfo.cn' + tryMatch(search, /"p-text"><a href="(.+?)" onclick/, 1);
	Z.debug(`get search resualt: ${href}`);
	await scrape(await requestDocument(href));
}


function detectWeb(doc, url) {
	if (new URL(url).searchParams.get('id')) {
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('#tbinfo > span > div > div.p-text > a');
	for (let row of rows) {
		// Z.debug(row);
		let href = row.href;
		// Z.debug(href);
		let title = ZU.trimInternal(row.title);
		// Z.debug(title);
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
	// Z.debug(doc);
	var newItem = new Zotero.Item('book');
	newItem.extra = '';
	let labels = new Labels(doc, '.book_intro .fl.clearfix, .book_intro .fr.clearfix');
	Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	newItem.title = text(doc, '.book_intro > h2 > span');
	newItem.abstractNote = text(doc, 'div.field_1 > p');
	newItem.publisher = labels.get('出版社');
	newItem.date = labels.get('出版时间').replace(/\D$/, '').replace(/(\d)\D(\d)/g, '$1-$2');
	newItem.ISBN = labels.get('ISBN');
	if (newItem.ISBN) {
		try {
			let searchLang = await requestText(
				'https://book.cppinfo.cn/So/Search/LangSearch',
				{
					method: 'POST',
					body: `key=${newItem.ISBN}&offset=1&hasEbook=false`
				}
			);
			// Z.debug(searchLang);
			let langFlag = searchLang.split('\r\n')[1].match(/([a-z]+)(?=(&))/)[0];
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
	newItem.extra += addExtra('CLC', labels.get('中图分类'));
	newItem.extra += addExtra('price', labels.get('定价'));
	let authors = labels.get('著者').replace(/[等主编原著]*$/, '').split(/[;；,，]/g)
		.filter(string => string != '暂无')
		.map((creator) => {
			// 方括号：https://book.cppinfo.cn/Encyclopedias/home/index?id=4483977
			// 西文括号：https://book.cppinfo.cn/Encyclopedias/home/index?id=4616652
			// 中文括号：https://book.cppinfo.cn/Encyclopedias/home/index?id=4557869
			let country = tryMatch(creator, /^[[(（](.+?)[\])）]/, 1);
			creator = creator.replace(/^[[(（].+?[\])）]/, '');
			creator = ZU.cleanAuthor(creator, 'author');
			creator.country = country;
			return creator;
		});
	let translators = labels.get('译者').replace(/[翻译]*$/, '').split(/[;；,，]/g)
		.filter(string => string != '暂无')
		.map((translator) => {
			return ZU.cleanAuthor(translator, 'translator');
		});
	// https://book.cppinfo.cn/Encyclopedias/home/index?id=4286780
	let contributors = labels.get('编辑').replace(/[编校注]*$/, '').split(/[;；,，]/g)
		.filter(string => string != '暂无')
		.map((translator) => {
			return ZU.cleanAuthor(translator, 'contributor');
		});
	let creators = [...authors, ...translators, ...contributors];
	if (creators.some(creator => creator.country)) {
		newItem.extra += addExtra('creatorsExt', JSON.stringify(creators));
	}
	creators.forEach((creator) => {
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
		delete creator.country;
		newItem.creators.push(creator);
	});
	Z.debug(creators);
	let tags = doc.querySelectorAll('div.book_label > div.label_in > span');
	tags.forEach(tag => newItem.tags.push(tag.innerText));
	newItem.complete();
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

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
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
				"extra": "CLC: H314\nprice: ￥ 80.00\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"马克·福利\",\"creatorType\":\"author\",\"country\":\"英\"},{\"firstName\":\"\",\"lastName\":\"\",\"creatorType\":\"translator\"}]",
				"language": "zh-CN",
				"libraryCatalog": "CCPINFO",
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
				"language": "zh-CN",
				"libraryCatalog": "CCPINFO",
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
				"libraryCatalog": "CCPINFO",
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
