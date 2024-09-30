{
	"translatorID": "d611008a-850d-4860-b607-54e1ecbcc592",
	"label": "E-Tiller",
	"creator": "jiaojiaodubai",
	"target": "",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 200,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-09-30 10:33:44"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	const haveMeta = !!doc.querySelector('meta[name="citation_title"]');
	function detect(path, selctor) {
		return url.includes(path) && doc.querySelector(selctor);
	}
	if (haveMeta && (
		detect('/article/abstract/', '.article_abstract_main .p1 > a#ExportUrl')
		|| detect('/reader/view_abstract.aspx?', 'table#QueryUI table table table span#FileTitle')
	)) {
		return 'journalArticle';
	}
	else if (detect('/reader/view_abstract.aspx?', 'table.front_table span#ReferenceText')) {
		return 'journalArticle';
	}
	if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = Array.from(doc.querySelectorAll('a[href*="article/abstract/"],a[href*="reader/view_abstract.aspx?"]'))
		.filter(element => !(/^[[【〔]?\s*摘要/.test(ZU.trimInternal(element.textContent))));
	for (const row of rows) {
		const href = row.href;
		const title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Zotero.selectItems(getSearchResults(doc, false));
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
	if (doc.querySelector('meta[name="citation_title"]')) {
		await scrapeMeta(doc, url);
	}
	else {
		await scrapeText(doc, url);
	}
}

async function scrapeMeta(doc, url = doc.location.href) {
	const translator = Zotero.loadTranslator('web');
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);
	translator.setHandler('itemDone', (_obj, item) => {
		const extra = new Extra();
		if (item.title.includes('（网络首发、推荐阅读）')) {
			extra.set('Status', 'advance online publication', true);
			item.title = item.title.replace(/（网络首发、推荐阅读）$/, '');
		}
		item.abstractNote = trimAbstract(item.abstractNote);
		item.pages = cleanPages(item.pages);
		if (/^\d{8}$/.test(item.date)) {
			item.date = `${item.date.substring(0, 4)}-${item.date.substring(4, 6)}-${item.date.substring(6, 8)}`;
		}
		item.language = {
			cn: 'zh-CN',
			en: 'en-US'
		}[item.language];
		extra.set('original-title', ZU.capitalizeTitle(attr(doc, 'meta[name="citation_title"]', 'content', 1) || text(doc, '#EnTitleValue')), true);
		const creators = doc.querySelector('meta[name="citation_author"]')
			? Array.from(doc.querySelectorAll('meta[name="citation_author"]')).map(element => element.content)
			: attr(doc, 'meta[name="citation_authors"]', 'content', 0).split(/[,;，；]/);
		item.creators = creators
			.map(creator => creator.replace(/(<.+>)?[\d,\s]+(<.+>)?$/, ''))
			.filter(creator => creator)
			.map(creator => cleanAuthor(creator));
		const enCreators = attr(doc, 'meta[name="citation_authors"]', 'content', 1).split(/[,;，；]/);
		if (enCreators.length) {
			const creatorsExt = JSON.parse(JSON.stringify(item.creators));
			for (let i = 0; i < item.creators.length; i++) {
				creatorsExt[i].original = ZU.capitalizeName(enCreators[i]);
			}
			extra.set('creatorsExt', JSON.stringify(creatorsExt));
		}
		item.extra = extra.toString();
		if (item.tags.length == 1) {
			item.tags = item.tags[0].split(/[,;，；、]\s*/).map(tag => ({ tag: tag }));
		}
		const pdfLink = doc.querySelector('a[href*="create_pdf"],h1 > a[href*="/pdf/"]');
		if (pdfLink && !item.attachments.some(attachment => attachment.mimeType == 'application/pdf')) {
			item.attachments.push({
				url: pdfLink.href,
				title: 'Full Text PDF',
				mimeType: 'application/pdf'
			});
		}
		item.complete();
	});

	const em = await translator.getTranslatorObject();
	em.itemType = 'journalArticle';
	await em.doWeb(doc, url);
}

async function scrapeText(doc, url = doc.location.href) {
	const newItem = new Z.Item('journalArticle');
	const extra = new Extra();
	newItem.title = doc.querySelector('#FileTitle').innerHTML;
	extra.set('original-title', ZU.capitalizeTitle(text(doc, '#EnTitle')), true);
	const abstractElm = doc.querySelectorAll('td.unnamed3');
	if (abstractElm.length == 2) {
		newItem.abstractNote = trimAbstract(abstractElm.item(0).textContent);
	}
	else if (abstractElm.length == 4) {
		newItem.abstractNote = trimAbstract(abstractElm.item(1).textContent);
	}
	const referenceText = text(doc, '#ReferenceText');
	Z.debug(referenceText);
	const pubInfo = tryMatch(referenceText, /\.\s?([^.]+)\.?$/, 1).split(/[,，]\s?/);
	Z.debug(pubInfo);
	newItem.publicationTitle = pubInfo[0];
	newItem.volume = tryMatch(pubInfo[2], /0*(\d+)[(（]/, 1);
	newItem.issue = tryMatch(pubInfo[2], /\(([a-z\d]+)\)/i, 1).replace(/0*(\d+)/, '$1');
	newItem.pages = cleanPages(tryMatch(pubInfo[2], /:\s?(.+)$/, 1));
	newItem.date = pubInfo[1];
	newItem.language = 'zh-CN';
	newItem.DOI = ZU.cleanDOI(text(doc, '#DOI'));
	newItem.url = url;
	const urlElm = doc.querySelector('a#URL');
	urlElm && (newItem.url = urlElm.href);
	extra.set('view', text(doc, '#ClickNum'));
	extra.set('download', '#PDFClickNum');
	newItem.extra = extra.toString();
	let creators = doc.querySelector('#Author td > a[href*="field=author"]')
		? Array.from(doc.querySelectorAll('#Author td > a[href*="field=author"]')).map(elm => ZU.trimInternal(elm.textContent))
		: tryMatch(pubInfo, /^([^.]+)\./, 1);
	if (creators.length == 1) {
		creators = creators[0].split(/[,;；，、]/);
	}
	newItem.creators = creators.map(name => cleanAuthor(name));
	const pdfLink = doc.querySelector('a[href*="create_pdf"]');
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	let tags = Array.from(doc.querySelectorAll('#KeyWord > a')).map(elm => elm.textContent);
	if (tags.length == 1) {
		tags = tags[0].split(/[,;，；、]\s*/);
	}
	newItem.tags = tags;
	newItem.complete();
}

class Extra {
	constructor() {
		this.fields = [];
	}

	push(key, val, csl = false) {
		this.fields.push({ key: key, val: val, csl: csl });
	}

	set(key, val, csl = false) {
		const target = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		if (target) {
			target.val = val;
		}
		else {
			this.push(key, val, csl);
		}
	}

	get(key) {
		const result = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		return result
			? result.val
			: '';
	}

	toString(history = '') {
		this.fields = this.fields.filter(obj => obj.val);
		return [
			this.fields.filter(obj => obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n'),
			history,
			this.fields.filter(obj => !obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n')
		].filter(obj => obj).join('\n');
	}
}

function cleanAuthor(name) {
	// https://zkxb.hnust.edu.cn/ch/reader/view_abstract.aspx?file_no=202303007&flag=1
	const creator = ZU.cleanAuthor(name.replace(/[(（]?[\d,*]*[）)]?$/, ''), 'author');
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	return creator;
}

function cleanPages(page) {
	if (!page) return '';
	return page.replace(/~/g, '-')
		.replace(/[+，]/g, ', ')
		.replace(/0*(\d+)/, '$1');
}

function trimAbstract(abstract) {
	if (!abstract) return '';
	return abstract.replace(/。;.*$/, '。');
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
				"date": "2023-12-11",
				"DOI": "10.13506/j.cnki.jpr.2023.11.005",
				"abstractNote": "目的 采用正交设计综合加权评分和层次分析法相结合的方法，优化黄芩微波酒制工艺。方法 采用单因素试验优选加酒量、闷润时间、微波功率、微波时间，然后以微波酒制工艺中的加酒量、闷润时间、微波功率、微波时间为考察因素，采用层次分析法确定各指标权重系数，以黄芩苷、汉黄芩苷、黄芩素、汉黄芩素含量进行综合加权评分为评价指标，优化黄芩微波酒制工艺。结果 取生黄芩饮片适量，加入10%辅料酒，置密闭容器内闷润60 min，在300 W功率下微波5 min，经三次验证实验，各指标成分的平均含量分别为15.65%，5.94%，3.00%，0.33%，平均评分98.24分，RSD为0.99%（n=3）。结论 优化所得微波炮制酒工艺稳定，重复性良好，可应用于微波酒黄芩的炮制。",
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
		"url": "http://hkfdj.ijournals.cn/hkfdj/ch/reader/view_abstract.aspx?file_no=20160403&flag=1",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "基于模型的系统工程概述",
				"creators": [
					{
						"firstName": "",
						"lastName": "朱静",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨晖",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "高亚辉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "姚太克",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2016",
				"abstractNote": "由于航空领域涉及的系统日益高度复杂，为更好推进基于模型的系统工程（Model Based System Engineering ,MBSE）研发体系，通过从当前遇到的问题、推行基于模型的系统工程的必要性、优势、未来的挑战等方面进行了较为详细地阐述。基于模型的系统工程研发体系具有知识表示的无二义、系统设计的一体化、沟通交流的高效率等优势，是未来发展的大趋势。",
				"extra": "original-title: Summary of Model Based System Engineering\nview: 9490\ndownload: #PDFClickNum",
				"issue": "4",
				"language": "zh-CN",
				"libraryCatalog": "E-Tiller",
				"pages": "12-16",
				"publicationTitle": "航空发动机",
				"url": "http://hkfdj.ijournals.cn/hkfdj/ch/reader/view_abstract.aspx?file_no=20160403&flag=1",
				"volume": "42",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "模型"
					},
					{
						"tag": "研发体系"
					},
					{
						"tag": "系统工程"
					},
					{
						"tag": "航空发动机"
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
