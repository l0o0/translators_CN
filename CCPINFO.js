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
	"lastUpdated": "2023-09-29 04:12:32"
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
	if (new URL(url).searchParams.get("id")) {
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

function gen_creators(raw_txt) {
	const surffix_patten = ["[编|原]?著", "主?编", "等"];
	for (const surffix of surffix_patten) {
		raw_txt = raw_txt.replace(new RegExp(`(.+?)(,? ?${surffix})\$`),"$1");
	}
	creators = raw_txt.split(";");
	// split names, Chinese name split depends on Zotero Connector preference translators.zhnamesplit
	var zhnamesplit = Z.getHiddenPref('zhnamesplit');
	for (var i = 0; i < creators.length; i++) {
			creators[i] = creators[i].replace(/\([\u4e00-\u9fa5]+\)/, "");
		if (zhnamesplit === undefined || zhnamesplit) {
			// zhnamesplit is true, split firstname and lastname.
			// Chinese name. first character is last name, the rest are first name
			if (creators[i].toString().indexOf("·") !== -1){
				creators[i] = {
				"lastName": creators[i],
				"creatorType": "autor",
				};
			}
			else {
				creators[i] = {
				"firstName": creators[i].substr(1),
				"lastName": creators[i].charAt(0),
				"creatorType": "autor"
				};
			}
		}
		else {
			creators[i] = {
				"lastName": creators[i],
				"creatorType": "autor",
			};
		}
	}
	return creators;
}

async function scrape(doc, url = doc.location.href) {
	// Z.debug(doc);
	var newItem = new Zotero.Item("book");
	var keys = ZU.xpath(doc, "//div[@class='book_con fr clearfix']/div/span[1]").map((element) => (element).innerText.replace("：", ""));
	// Z.debug(keys);
	var values = ZU.xpath(doc, "//div[@class='book_con fr clearfix']/div/span[2]").map((element) => (element).innerText);
	var meta_all = new Map();
	// Z.debug(values);
	for (let i = 0; i < keys.length; i++) {
		meta_all.set(keys[i], values[i]);
	}
	newItem.title = meta_all.get("书名");
	newItem.abstractNote = ZU.xpath(doc, "//div[@class='field_1']/p")[0].innerText;
	// newItem.series = meta_all.get("系列");
	// newItem.seriesNumber = meta_all.get("系列编号");
	// newItem.volume = meta_all.get("卷次");
	// newItem.numberOfVolumes = meta_all.get("卷数",
	// newItem.edition = meta_all.get("版本");
	// newItem.place = meta_all.get("地点");
	newItem.publisher = meta_all.get("出版社");
	newItem.date = meta_all.get("出版时间");
	// // newItem.numPages = meta_all.get("页数");
	newItem.ISBN = meta_all.get("ISBN");
	// newItem.shortTitle = meta_all.get("短标题");
	newItem.url = url;
	// newItem.accessDate = meta_all.get("访问时间");
	// newItem.archive = meta_all.get("档案");
	// newItem.archiveLocation = meta_all.get("档位置");
	newItem.libraryCatalog = meta_all.get("中图分类");
	// newItem.callNumber = meta_all.get("书号");
	// newItem.rights = meta_all.get("版权");
	// newItem.extra = meta_all.get("其他");
	newItem.creators = gen_creators(ZU.trimInternal(meta_all.get("著者")));
	ZU.xpath(doc, "//div[@class='book_label']/div[@class='label_in']/span").map(
		(element) => (element).innerText).forEach(
			(element) => newItem.tags.push({"tag": element})
		);
	/* 请求语言字段 */
	ZU.doPost(
		url="https://book.cppinfo.cn/So/Search/LangSearch",
		postdata=`key=${newItem.ISBN}&offset=1&hasEbook=false`,
		// var text = '<a href="/so/home/qhsearch?languages=eng&amp;q=9787119132037">英语<i>(1)</i></a>'
		callback=function(text) {
			// Z.debug(text);
			var lang_flag = text.match(new RegExp("([a-z]+)(?=(&))"))[0];
			// Z.debug(lang_flag);
			var lang_map = {
				chi: "zh-CN",
				eng: "en-US",
				ger: "de-DE",
				fre: "fr-FR",
				jpn: "jp-JP"
			};
			newItem.language = lang_map[lang_flag];
			newItem.complete();
			// Z.debug(`lang: ${newItem.language}`);
		}
	);
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
				"ISBN": "9787562866350",
				"libraryCatalog": "H314",
				"publisher": "郑州大学出版社有限公司",
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
				"date": "2023年10月",
				"ISBN": "9787214275707",
				"libraryCatalog": "K134",
				"publisher": "江苏人民出版社",
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
				"date": "2022年11月",
				"ISBN": "9787119132037",
				"abstractNote": "Since the 18th National Congress of the Communist Party of China in 2012， the drive to develop socialism with Chinese characteristics has entered a new era. The past decade has seen the country forging ahead and embracing historic changes， with remarkable achievements made by the Party and the state. So how did China make these achievements? What are the secrets to the CPC's governance of China? What is the key to the success of China's governance in the new era? This book covers such important topics as \"how to break the cycle of rise and fall\"， \"whole-process people's democracy\"， \"self-reform and social revolution\"， \"cyber governance\"， and \"Chinese-style modernization\"， reveals the secrets to the success of China's governance in the new era， and shares China's wisdom and solutions with the world.",
				"language": "en_US",
				"libraryCatalog": "D616",
				"publisher": "外文出版社",
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
