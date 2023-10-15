{
	"translatorID": "4c4b0a6c-a5e9-42ed-a742-f10f3e2ef711",
	"label": "CCPINFO",
	"creator": "jiaojiaodubai23",
	"target": "https?://book.cppinfo.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-15 10:54:01"
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

function trimAuthor(rawText) {
	const SURFFIXPATTEN = ["[编原]?著", "主?编", "等"];
	for (const surffix of SURFFIXPATTEN) {
		rawText = rawText.replace(new RegExp(`(.+?)(,? ?${surffix})\$`),"$1");
	}
	return rawText;
}

function str2Arr(string) {
	return string.split(/[;；,，]/g);
}

function matchCreator(creator) {
	// split names, Chinese name split depends on Zotero Connector preference translators.zhnamesplit
	var zhnamesplit = Z.getHiddenPref('zhnamesplit');
	creator = creator.replace(/\([\u4e00-\u9fa5]+\)/, '');
	if (creator.indexOf('·') !== -1){
		creator = {
		"lastName": creator,
		"creatorType": "autor",
		};
	}
	else {
		if ((zhnamesplit === undefined) ? true : zhnamesplit) {
			// zhnamesplit is true, split firstname and lastname.
			// Chinese name. first character is last name, the rest are first name
			creator = creator.replace(/\s/g, '');
				creator = {
				"firstName": creator.substr(1),
				"lastName": creator.charAt(0),
				"creatorType": "autor"
				};
		}
		else {
			creator = {
				"lastName": creator,
				"creatorType": "autor",
			};
		}
	}
	return creator;
}

async function scrape(doc, url = doc.location.href) {
	// Z.debug(doc);
	var newItem = new Zotero.Item('book');
	var keys = ZU.xpath(doc, '//div[@class="book_con fr clearfix"]/div/span[1]').map((element) => (element).innerText.replace('：', ''));
	// Z.debug(keys);
	var values = ZU.xpath(doc, '//div[@class="book_con fr clearfix"]/div/span[2]').map((element) => (element).innerText);
	var metaAll = new Map();
	// Z.debug(values);
	for (let i = 0; i < keys.length; i++) {
		metaAll.set(keys[i], values[i]);
	}
	newItem.title = metaAll.get('书名');
	newItem.abstractNote = ZU.xpath(doc, '//div[@class="field_1"]/p')[0].innerText;
	// newItem.series = meta_all.get('系列');
	// newItem.seriesNumber = meta_all.get('系列编号');
	// newItem.volume = meta_all.get('卷次');
	// newItem.numberOfVolumes = meta_all.get('卷数',
	// newItem.edition = meta_all.get('版本');
	// newItem.place = meta_all.get('地点');
	newItem.publisher = metaAll.get('出版社');
	newItem.date = (function(){
		var  dateStr = metaAll.get('出版时间');
		if (dateStr.match(/[^\d]$/)) dateStr = dateStr.slice(0, -1);
		dateStr = dateStr.replace(/[年月日]/g, '-');
		return dateStr;
	})();
	// // newItem.numPages = meta_all.get('页数');
	newItem.ISBN = metaAll.get('ISBN');
	// newItem.shortTitle = meta_all.get('短标题');
	newItem.url = url;
	// newItem.accessDate = meta_all.get('访问时间');
	// newItem.archive = meta_all.get('档案');
	// newItem.archiveLocation = meta_all.get('档位置');
	newItem.libraryCatalog = metaAll.get('中图分类');
	// newItem.callNumber = meta_all.get('书号');
	// newItem.rights = meta_all.get('版权');
	// newItem.extra = meta_all.get('其他');
	newItem.creators = str2Arr(trimAuthor(metaAll.get('著者'))).map(
		(creator) => (matchCreator(creator))
	);
	ZU.xpath(doc, '//div[@class="book_label"]/div[@class="label_in"]/span').map(
		(element) => (element).innerText).forEach(
			(element) => newItem.tags.push({"tag": element})
		);
	/* 请求语言字段 */
	let searchLang = await requestText(
		'https://book.cppinfo.cn/So/Search/LangSearch',
		{
			method: 'POST',
			body: `key=${newItem.ISBN}&offset=1&hasEbook=false`
		}
	)
	// Z.debug(searchLang);
	let langFlag = searchLang.split('\r\n')[1].match(/([a-z]+)(?=(&))/)[0];
	Z.debug(langFlag);
	newItem.language = {
		chi: "zh-CN",
		eng: "en-US",
		ger: "de-DE",
		fre: "fr-FR",
		jpn: "jp-JP"
	}[langFlag];
	newItem.complete();
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
						"lastName": "马克·福利",
						"creatorType": "autor"
					}
				],
				"date": "2022-07",
				"ISBN": "9787562866350",
				"abstractNote": "《朗文新编英语语法》由我社从培生教育出版公司引进，可供中学生、大学生以及英语学习者自学使用。本书由诊断测试、语法讲解和练习答案三部分组成。学习者可利用图书前面的诊断测试，在单元学习前，了解自己的薄弱项，从而进行有针对性的学习。语法知识点讲解部分共分为36个单元，包含一般语法书中的所有内容，语法解释详细，内容条理清晰。每个单元还配套丰富的练习题，学习者可通过练习巩固所学的语法点。本书所有例句均选自语料库，表达地道，是中高水平学习者巩固语法的不二之选。",
				"language": "zh-CN",
				"libraryCatalog": "H314",
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
						"firstName": "家玲",
						"lastName": "徐",
						"creatorType": "autor"
					},
					{
						"firstName": "英",
						"lastName": "林",
						"creatorType": "autor"
					}
				],
				"date": "2023-10",
				"ISBN": "9787214275707",
				"abstractNote": "本书全面、系统地梳理了330-610年拜占庭王朝历史以及帝国的崛起。上编为皇帝列传，介绍了君士坦丁王朝、瓦伦提尼安诸帝、塞奥多西王朝、利奥王朝、查士丁尼王朝历史。下编为拜占庭帝国的崛起，从世界地理观、宗教、种族与身份认同、自然灾害等方面加以论述，聚焦拜占庭帝国历史的第一黄金时代，对查士丁尼时代的司法改革、宗教思想和政策、制度、经济生活等方面进行系统论述，展现拜占庭帝国的崛起图景。本书是具有唯物史观特色的、有可靠依据的独立意见和系列研究成果，形成了我国学者对拜占庭历史发展和文化演化的话语体系。",
				"language": "zh-CN",
				"libraryCatalog": "K134",
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
				"title": "新时代中国之治如何跳出治乱兴衰的历...",
				"creators": [
					{
						"firstName": "君如",
						"lastName": "李",
						"creatorType": "autor"
					}
				],
				"date": "2022-11",
				"ISBN": "9787119132037",
				"abstractNote": "Since the 18th National Congress of the Communist Party of China in 2012， the drive to develop socialism with Chinese characteristics has entered a new era. The past decade has seen the country forging ahead and embracing historic changes， with remarkable achievements made by the Party and the state. So how did China make these achievements? What are the secrets to the CPC's governance of China? What is the key to the success of China's governance in the new era? This book covers such important topics as \"how to break the cycle of rise and fall\"， \"whole-process people's democracy\"， \"self-reform and social revolution\"， \"cyber governance\"， and \"Chinese-style modernization\"， reveals the secrets to the success of China's governance in the new era， and shares China's wisdom and solutions with the world.",
				"language": "en-US",
				"libraryCatalog": "D616",
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
	}
]
/** END TEST CASES **/
