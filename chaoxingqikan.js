{
	"translatorID": "f7c9342d-3672-4899-b315-3d09ac1b38a8",
	"label": "chaoxingqikan",
	"creator": "jiaojiaodubai23",
	"target": "https?://qikan.chaoxing.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-04 10:25:54"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 YOUR_NAME <- TODO

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
	if (url.includes('/detail_')) {
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
	// var rows = doc.querySelectorAll('#liebiaoDivId> table > tbody > tr');
	var rows = doc.querySelectorAll('#liebiaoDivId > table > tbody > tr > td:nth-child(2) >a:first-child');
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.title);
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

function get_pure_text(element) {
	// 执行深拷贝以免影响页面元素
	let element_copy = element.cloneNode(true);
	while (element_copy.firstElementChild) {
		element_copy.removeChild(element_copy.firstElementChild);
	}
	return element_copy.innerText;
}

function match_creators(doc, path) {
	var creators = ZU.xpath(doc, "//p[@class='F_name']")[0];
	// 移除脚注上标
	creators = get_pure_text(creators);
	creators = creators.split(/[，|,]/);
	creators = creators.map((creator) => ZU.trimInternal(creator));
	// Z.debug(creators);
	var zhnamesplit = Z.getHiddenPref('zhnamesplit');
	for (var i = 0, n = creators.length; i < n; i++) {
		var creator = creators[i];
		if (creator.search(/[A-Za-z]/) !== -1) {
			creator = creator.replace(/\(.*\)/g, "");
			// western name. split on last space
			creator = ZU.cleanAuthor(creator, "author");
		}
		else if ((zhnamesplit === undefined) ? true : zhnamesplit) {
			// zhnamesplit is true, split firstname and lastname.
			// Chinese name. first character is last name, the rest are first name
			creator = {
				"firstName": creator.substr(1),
				"lastName": creator.charAt(0),
				"creatorType": "author"
			}
		}
		creators[i] = creator;
	}
	return creators;
}

function match_source(element) {
	// Z.debug(element);
	let source = {};
	source["publicationTitle"] = ZU.xpath(element, "//a[@class='jourName']")[0].innerText.replace(/[《|》]/g, "");
	// Z.debug(source["publicationTitle"]);
	element = get_pure_text(element);
	source["date"] = element.match(/\d+(?=年)/)[0];
	// Z.debug(source["date"]);
	source["issue"] = element.match(/\d+(?=期)/)[0];
	// Z.debug(source["issue"]);
	source["pages"] = element.match(/[\d|-]+(?=页)/)[0];
	return source;
}

function match_attanchment(element) {
	var url = ZU.xpath(element, "//a[@class='pdfdown']")[0].href;
	// Z.debug(url);
	return url ? {
		"url": url,
		"title": "Full Text PDF",
		"mimeType": "application/pdf"
	} : "";
}

function match_doi(doc, path) {
	let value = ZU.xpath(doc, path)[0];
	return (value) ? get_pure_text(value) : "";
}
function match_related(doc, path) {
	var articals = ZU.xpath(doc, path);
	articals = articals.map((element) => ({
		"citation": element.innerText,
		"url": element.firstElementChild.href
	}));
	return articals;
}

async function scrape(doc, url = doc.location.href) {
	var newItem = new Z.Item("journalArticle");
	newItem.title = ZU.xpath(doc, "//h1[@class='F_titel']")[0].innerText;
	newItem.creators = match_creators(doc, "//p[@class='F_name']");
	// Z.debug(ZU.xpath(doc, "//a[@class='jourName']"));
	var data_counts = ZU.xpath(doc, "//div[@class='Fmian1']/table/tbody")[0].children.length;
	var data = {
		get_element: function (label) {
			return (this[label]) ? this[label] : "";
		},
		get_text: function (label) {
			return (this[label]) ? this[label].innerText : "";
		},
	};
	for (let i = 1; i <= data_counts; i++) {
		// 重要：如果不去掉多余的空格则无法通过lable索引此属性
		let label = ZU.xpath(doc, `//div[@class='Fmian1']/table/tbody/tr[${i}]/td[1]`)[0].innerText.replace(/\s/g, "");
		let value = ZU.xpath(doc, `//div[@class='Fmian1']/table/tbody/tr[${i}]/td[2]`)[0];
		data[label] = value;
	}
	newItem = Object.assign(newItem, match_source(data.get_element("【来源】")));
	newItem.url = url;
	newItem.libraryCatalog = data.get_text("【分类号】");
	newItem.archiveLocation = data.get_text("【分类导航】");
	newItem.abstractNote = data.get_text("【摘要】");
	newItem.tags = data.get_text("【关键词】").split(" ").map((tag) => ({ "tag": tag }));
	newItem.DOI = match_doi(doc, "//p[@data-meta-name='doi']")
	newItem.volume = ZU.xpath(doc, "//input[@class='GBTInputId']")[0].defaultValue.match(/\d+(?=卷\(\d+\))/)[0];
	newItem.seeAlso = match_related(doc, "//div[@id='relatedwritingscontainner']//li");
	var journal_url = ZU.xpath(doc, "//div[@class='sTopImg']/p[last()]/a")[0].href
	// Z.debug(journal_url);
	ZU.doGet(
		journal_url,
		function (doc) {
			// Z.debug(typeof (doc));
			let parser = new DOMParser();
			doc = parser.parseFromString(doc, "text/html");
			// Z.debug(typeof (doc));
			let journal_info = ZU.xpath(doc, "//div[@class='FbPcon']/p");
			// Z.debug(journal_info);
			let data = {};
			for (let i = 0; i < journal_info.length - 1; i++) {
				data[journal_info[i].firstElementChild.innerText] = get_pure_text(journal_info[i]);
			}
			const lang_map = {
				"中文": "zh-CN",
				"英文": "en-US"
			};
			newItem.language = lang_map[data["语言："]];
			newItem.ISSN = data["ISSN："];
		}
	)
	newItem.attachments.push(match_attanchment(data.get_element("【全文获取】")));
	newItem.attachments.push(
		{
			"url": url,
			"title": "Snapshot",
			"document": doc
		}
	)
	//
	// "series": "系列",
	// "seriesTitle": "系列标题",
	// "seriesText": "系列描述",
	// "journalAbbreviation": "刊名简称",
	// "language": "语言",
	// "ISSN": "ISSN",
	// "shortTitle": "短标题",
	// "accessDate": "访问时间",
	// "archive": "档案",
	// "callNumber": "索书号",
	// "rights": "版权",
	newItem.complete()
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://qikan.chaoxing.com/detail_38502727e7500f263a85bd7ab02fcce7f45d0936666427011921b0a3ea255101fc1cf1fbb4666ae6b3d8bb7c40980615f75d1dedbca8bf1556c8add879a320654132304f5496fb7010bc92a6ec065159",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "410 t/h燃煤电站高温除尘技术试验研究",
				"creators": [
					{
						"firstName": "桐",
						"lastName": "司",
						"creatorType": "author"
					},
					{
						"firstName": "春波",
						"lastName": "王",
						"creatorType": "author"
					},
					{
						"firstName": "亮",
						"lastName": "陈",
						"creatorType": "author"
					},
					{
						"firstName": "育杰",
						"lastName": "任",
						"creatorType": "author"
					},
					{
						"firstName": "福春",
						"lastName": "任",
						"creatorType": "author"
					}
				],
				"date": "2023",
				"DOI": "10.19805/j.cnki.jcspe.2023.07.003",
				"abstractNote": "针对燃煤电站SCR脱硝技术中高浓度飞灰造成的催化剂使用寿命缩短、大量氨逃逸及空气预热器堵灰的问题，将高温除尘器布置在SCR反应器之前。在410 t/h燃煤锅炉上对高温除尘技术进行了工程示范研究，分析了高温除尘器的除尘特性对下游脱硝单元和空气预热器性能的影响。结果表明：在70%和90%锅炉负荷下，高温除尘器出口烟尘平均质量浓度均小于8 mg/m~3;90%负荷下，烟气流经高温除尘器的压降仅为500 Pa左右，大幅低于传统布袋除尘器的烟气压降；与典型的超低排放烟气后处理技术相比，应用高温除尘器能实现在相同脱硝效率下显著降低SCR反应器的烟气压降，并能减少相应的气氨消耗量与氨逃逸量；与常规布置布袋除尘器的锅炉环保岛相比，高温除尘器+SCR脱硝单元+空气预热器的模块的烟气压降可降低约500 Pa。",
				"archiveLocation": "环境科学、安全科学->废物处理与综合利用->动力工业废物处理与综合利用->电力工业",
				"issue": "7",
				"libraryCatalog": "X773",
				"pages": "829-834",
				"publicationTitle": "动力工程学报",
				"url": "https://qikan.chaoxing.com/detail_38502727e7500f263a85bd7ab02fcce7f45d0936666427011921b0a3ea255101fc1cf1fbb4666ae6b3d8bb7c40980615f75d1dedbca8bf1556c8add879a320654132304f5496fb7010bc92a6ec065159",
				"volume": "43",
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
						"tag": "压降"
					},
					{
						"tag": "烟尘"
					},
					{
						"tag": "空气预热器"
					},
					{
						"tag": "能耗"
					},
					{
						"tag": "高温除尘"
					}
				],
				"notes": [],
				"seeAlso": [
					"https://qikan.chaoxing.com/mag/infos?mags=c5aa19d5a97868b367546ec183fb8453&yearInfo=2023&issueInfo=7"
				]
			}
		]
	},
	{
		"type": "web",
		"url": "https://qikan.chaoxing.com/searchjour?sw=%E9%87%8F%E5%AD%90%E5%8A%9B%E5%AD%A6&size=50&x=0_646",
		"items": "multiple"
	}
	
]
/** END TEST CASES **/
