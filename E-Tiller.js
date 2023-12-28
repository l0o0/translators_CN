{
	"translatorID": "d611008a-850d-4860-b607-54e1ecbcc592",
	"label": "E-Tiller",
	"creator": "jiaojiaodubai23",
	"target": "^https?://.*(/ch/)?.*(.aspx)?",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-16 19:56:45"
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

const paths = [
	'reader/view_abstract.aspx?file_no=',
	'/article/abstract/'
];

function detectWeb(doc, url) {
	Z.debug('---------- E-Tiller ----------');
	let insite = Array.from(doc.querySelectorAll(`div[class*="foot"], div[id*="foot"]`))
		.some(foot => (/北京勤云科技/.test(foot.textContent)));
	Z.debug(`incite: ${insite}`);
	if (!insite) return false;
	for (let path of paths) {
		if (url.includes(path) && doc.querySelector('meta[name="citation_title"]')) {
			Z.debug(`match path: ${path}`);
			return 'journalArticle';
		}
		else if (doc.querySelector('meta[name]') && getSearchResults(doc, true)) {
			Z.debug(`match path: ${path}`);
			return 'multiple';
		}
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = Array.from(doc.querySelectorAll(paths.map(path => `a[href*="${path}"]`).join(',')))
		.filter(element => !(/^[[【〔]?\s*摘要/.test(ZU.trimInternal(element.textContent))));
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
		Z.debug('selected items:');
		Z.debug(items);
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
	let translator = Zotero.loadTranslator('web');
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);
	translator.setHandler('itemDone', (_obj, item) => {
		item.extra = '';
		if (item.title.includes('（网络首发、推荐阅读）')) {
			item.extra += addExtra('available-date', item.date);
			delete item.date;
			item.extra += addExtra('Status', 'advance online publication');
			item.title = item.title.replace(/（网络首发、推荐阅读）$/, '');
		}
		item.language = {
			cn: 'zh-CN',
			en: 'en-US'
		}[item.language];
		item.extra += addExtra('original-title', attr(doc, 'meta[name="citation_title"]', 'content', 1));
		let creators = doc.querySelector('meta[name="citation_author"]')
			? Array.from(doc.querySelectorAll('meta[name="citation_author"]')).map(element => element.content)
			: attr(doc, 'meta[name="citation_authors"]', 'content', 0).split(/[,;，；]/);
		if (creators.length) {
			Z.debug(creators);
			item.creators = creators
				.map(creator => creator.replace(/(<.+>)?[\d,\s]+(<.+>)?$/, ''))
				.filter(creator => creator)
				.map(creator => ZU.cleanAuthor(creator, 'author'));
		}
		item.creators.forEach((creator) => {
			if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
				creator.lastName = creator.firstName + creator.lastName;
				creator.firstName = '';
				creator.fieldMode = 1;
			}
		});
		let enCreators = attr(doc, 'meta[name="citation_authors"]', 'content', 1).split(/[,;，；]/);
		let creatorsExt = JSON.parse(JSON.stringify(item.creators));
		for (let i = 0; i < item.creators.length; i++) {
			creatorsExt[i].original = enCreators[i];
		}
		if (item.tags.length == 1) {
			item.tags = item.tags[0].split(/[;；]\s*/).map(tag => ({ tag: tag }));
		}
		item.extra += addExtra('creatorsExt', JSON.stringify(creatorsExt));
		let pdfLink = doc.querySelector('a[href*="create_pdf"]');
		if (pdfLink && !item.attachments.some(attachment => attachment.mimeType == 'application/pdf')) {
			item.attachments.push({
				url: pdfLink.href,
				title: 'Full Text PDF',
				mimeType: 'application/pdf'
			});
		}
		item.complete();
	});

	let em = await translator.getTranslatorObject();
	em.itemType = 'journalArticle';
	await em.doWeb(doc, url);
}

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://zgnjzz.ijournals.cn/zgnjzz/article/abstract/202311001",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "结肠镜检查时机对急性下消化道出血患者预后影响的Meta分析",
				"creators": [
					{
						"firstName": "",
						"lastName": "柏李一",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "姜维",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "程芮",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "闵力",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张澍田",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-11-30",
				"DOI": "10.12235/E20220711",
				"ISSN": "1007-1989",
				"abstractNote": "目的 系统评价结肠镜检查时机对急性下消化道出血（LGIB）患者预后的影响。方法 计算机检索PubMed、Medline、Embase、The Cochrane Library、维普、中国知网和万方数据自建库到2022年9月，结肠镜检查时机对急性LGIB患者预后影响的相关临床研究。由两名研究者独立筛选文献，提取信息，并进行偏倚风险评价后，采用RevMan 5.4软件对急诊结肠镜组和常规结肠镜组的再出血率、内镜下止血成功率、出血来源定位率和总体死亡率等多方面进行Meta分析。结果 共纳入12篇回顾性研究和4篇随机对照试验（RCT），包括400 180例患者。回顾性研究的Meta分析结果显示，急诊结肠镜在以下４个方面优于常规结肠镜：内镜下止血成功率（OR＾ = 1.64，95%CI：1.07～2.52，P = 0.020）、住院天数（MD = -1.67，95%CI：-2.92～-0.42，P = 0.009）、外科手术率（OR＾ = 0.52，95%CI：0.42～0.64，P = 0.000）和输血率（OR＾ = 0.83，95%CI：0.78～0.88，P = 0.000）；两组患者再出血率、总体死亡率、介入治疗率和出血来源定位率比较，差异均无统计学意义（P > 0.05）。RCT的Meta分析结果显示，急诊结肠镜内镜下止血成功率（OR＾ = 1.74，95%CI：1.04～2.93，P = 0.040）和出血来源定位率（OR＾ = 2.31，95%CI：1.28～4.17，P = 0.006）明显高于常规结肠镜，两组间其他结局指标比较，差异均无统计学意义（P > 0.05）。结论 与常规结肠镜相比，急诊结肠镜并不能降低再出血率和总体死亡率，但能够提高内镜下止血成功率，并在一定程度上缩短了住院天数，降低了外科手术率和输血率，在临床中需根据实际情况进行时机选择。",
				"extra": "original-title: Effect of colonoscopy timing on clinical outcomes of patients with acute lower gastrointestinal bleeding: a Meta-analysis\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"柏李一\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Bai Liyi\"},{\"firstName\":\"\",\"lastName\":\"姜维\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Jiang Wei\"},{\"firstName\":\"\",\"lastName\":\"程芮\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Cheng Rui\"},{\"firstName\":\"\",\"lastName\":\"闵力\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Min Li\"},{\"firstName\":\"\",\"lastName\":\"张澍田\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Zhang Shutian\"}]",
				"issue": "11",
				"journalAbbreviation": "中国内镜杂志",
				"language": "zh-CN",
				"libraryCatalog": "zgnjzz.ijournals.cn",
				"pages": "1-12",
				"publicationTitle": "中国内镜杂志",
				"url": "http://www.zgnjzz.com//zgnjzz/article/abstract/202311001",
				"volume": "29",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "Meta分析"
					},
					{
						"tag": "再出血"
					},
					{
						"tag": "常规结肠镜"
					},
					{
						"tag": "急性下消化道出血"
					},
					{
						"tag": "急诊结肠镜"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.yaoxueyanjiu.com/ch/reader/view_abstract.aspx?file_no=202311005&flag=1",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "多指标综合评价结合层次分析法优化黄芩微波酒制工艺",
				"creators": [
					{
						"firstName": "",
						"lastName": "李利华",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王巍",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张一美",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "赵梦辉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "鞠成国",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "20231211",
				"DOI": "10.13506/j.cnki.jpr.2023.11.005",
				"extra": "creatorsExt: [{\"firstName\":\"\",\"lastName\":\"李利华\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"王巍\",\"creatorType\":\"author\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"张一美\",\"creatorType\":\"author\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"赵梦辉\",\"creatorType\":\"author\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"鞠成国\",\"creatorType\":\"author\",\"fieldMode\":1}]",
				"issue": "11",
				"language": "zh-CN",
				"libraryCatalog": "www.yaoxueyanjiu.com",
				"pages": "875-880",
				"publicationTitle": "药学研究",
				"url": "http://www.yaoxueyanjiu.com/ch/reader/view_abstract.aspx?file_no=202311005&flag=1",
				"volume": "42",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "层次分析法"
					},
					{
						"tag": "微波炮制工艺"
					},
					{
						"tag": "正交设计"
					},
					{
						"tag": "酒黄芩"
					},
					{
						"tag": "黄芩"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.stae.com.cn/jsygc/home",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.jishujingji.cn/technology_economics/home?id=2009081390342001&name=%E9%A6%96%E9%A1%B5",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.stae.com.cn/jsygc/home",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.qxkj.net.cn/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://wkdxb.wust.edu.cn/wkd_zr/ch/index.aspx",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://wltb.ijournal.cn/ch/index.aspx",
		"items": "multiple"
	}
]
/** END TEST CASES **/
