{
	"translatorID": "dd9efb0b-ca1d-4634-b480-9aabc84213c0",
	"label": "CQVIP Qikan",
	"creator": "Xingzhong Lin, jiaojiaodubai",
	"target": "^https?://(lib|qikan|cstj)\\.cqvip\\.com",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-08-17 03:23:36"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Xingzhong Lin, jiaojiaodubai

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
	if (url.includes('/Qikan/Article/Detail')) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('a[href*="/Qikan/Article/Detail?"]');
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
	const newItem = new Z.Item('journalArticle');
	const extra = new Extra();
	const id = tryMatch(url, /id=([\da-zA-z]+)/, 1);
	Z.debug(`id: ${id}`);
	try {
		// throw new Error('debug');
		// 以下POST请求需要校验本地cookies,Scaffold不支持,需在浏览器调试
		const exportPage = await requestDocument(
			'/Qikan/Search/Export?from=Qikan_Article_ExportTilte',
			{
				method: 'POST',
				body: `ids=${id}&strType=title_info&type=endnote`
			}
		);
		const xmlText = attr(exportPage, 'input#xmlContent', 'value');
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(xmlText, "application/xml");
		newItem.title = text(xmlDoc, 'Titles > Title > Text');
		newItem.abstractNote = text(xmlDoc, 'Abstracts > Abstract > Text');
		newItem.publicationTitle = text(xmlDoc, 'Periodical > Name');
		newItem.volume = text(xmlDoc, 'Volum');
		newItem.issue = text(xmlDoc, 'Issue');
		newItem.pages = text(xmlDoc, 'Page');
		newItem.date = ZU.strToISO(text(xmlDoc, 'PublishDate'));
		newItem.ISSN = text(xmlDoc, 'Periodical > ISSN');
		newItem.language = text(xmlDoc, 'Language') === 'chi' ? 'zh-CN' : 'en-US';
		xmlDoc.querySelectorAll('Creator > Name').forEach(element => newItem.creators.push(cleanAuthor(element.textContent)));
		xmlDoc.querySelectorAll('Keyword').forEach(element => newItem.tags.push(element.textContent));
		extra.set('CLC', text(xmlDoc, 'CLC > Code'));
	}
	catch (error) {
		Z.debug(error);
		newItem.title = text(doc, '.article-title > h1').replace(/\s*认领$/, '');
		newItem.abstractNote = (text(doc, '.abstract:nth-of-type(3)') || text(doc, '.abstract:nth-of-type(2)'))
			.replace(/\s*收起$/, '')
			.replace(/&quot；/g, '"');
		newItem.publicationTitle = attr(doc, '.journal > span.from > a', 'title');
		const pubInfo = ZU.trimInternal(text(doc, '.journal > .from > .vol'));
		Z.debug(pubInfo);
		newItem.date = tryMatch(pubInfo, /^(\d+)年/, 1);
		newItem.issue = tryMatch(pubInfo, /第0*(\d+)期/, 1);
		newItem.pages = tryMatch(pubInfo, /期([\d+,~-]*),/, 1).replace(/\+/g, ', ').replace(/~/g, '-');
		doc.querySelectorAll('.author > span:nth-child(2) > span > a').forEach((element) => {
			newItem.creators.push(cleanAuthor(element.innerText));
		});
		doc.querySelectorAll('.subject > span > a').forEach((element) => {
			newItem.tags.push(ZU.trimInternal(element.innerText));
		});
		extra.set('CLC', attr(doc, '.class > span:nth-child(2)', 'title'));
	}
	newItem.url = `https://lib.cqvip.com/Qikan/Article/Detail?id=${id}`;
	extra.set('original-title', ZU.capitalizeTitle(text(doc, '.article-title > em')), true);
	text(doc, '.author > em').replace(/\(.+?\)$/, '')
		.split(/;\s?/)
		.forEach(str => extra.push('original-author', ZU.capitalizeName(str), true));
	extra.set('original-container-title', text(doc, '.journal > em'), true);
	extra.set('WeiPuCite', text(doc, '.yzwx > a > span'));
	// .app-reg for institution
	// .user-more for personal
	const isLogin = !!doc.querySelector('.app-reg > a,.user-more > a');
	Z.debug(`isLogin: ${isLogin}`);
	const key = tryMatch(attr(doc, '.article-source > a[onclick^="showdown"]', 'onclick'), /'(.+?)'/g, 1);
	Z.debug(`key: ${key}`);
	if (isLogin && key) {
		const pdfLink = await getPDF(id, key);
		if (pdfLink) {
			newItem.attachments = [{
				title: 'Full Text PDF',
				mimeType: 'application/pdf',
				url: pdfLink
			}];
		}
	}
	newItem.extra = extra.toString();
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
		let target = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		if (target) {
			target.val = val;
		}
		else {
			this.push(key, val, csl);
		}
	}

	get(key) {
		let result = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
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
	const creator = ZU.cleanAuthor(name, 'author');
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.fieldMode = 1;
	}
	return creator;
}

async function getPDF(id, key) {
	const postUrl = '/Qikan/Article/ArticleDown';
	const postData = `id=${id}&info=${key}&ts=${(new Date).getTime()}`;
	const respond = await requestJSON(postUrl, {
		method: 'POST',
		body: postData
	});
	return respond.url;
}

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
		"url": "https://lib.cqvip.com/Qikan/Article/Detail?id=7109808542",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "数字时代背景下在线诉讼的发展路径与风险挑战                        \n                        \n                        认领\n                            被引量：2",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘峥",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "在线诉讼是互联网时代的必然产物,它可能存在发展快或慢的问题,但它的到来不可避免且无法抗拒,其存在的必要性与合理性也是母庸置疑的。现行民事诉讼法已对在线诉讼的效力予以确认。应当明确,基于诉讼活动的特质和规律,目前,在线诉讼只是线下诉讼的有益补充,并非取而代之。本文从《人民法院在线诉讼规则》出发,论述了在线诉讼的时代背景和发展历程,阐明在线诉讼的程序规范性、权利保障性、方式便捷性、模式融合性。同时,在线诉讼将对未来司法制度的完善发展产生巨大推动作用,在理论更新、规则指引、制度完善、技术迭代、安全保障、人才培养等方面均需作出必要的配套跟进。",
				"extra": "original-title: Navigating Online Litigation in the Digital Age:Paths and Challenges\noriginal-author: Liu Zheng\noriginal-container-title: DIGITAL LAW\nWeiPuCite: 2",
				"issue": "2",
				"libraryCatalog": "CQVIP Qikan",
				"pages": "122-135",
				"publicationTitle": "数字法治",
				"url": "https://lib.cqvip.com/Qikan/Article/Detail?id=7109808542",
				"attachments": [],
				"tags": [
					{
						"tag": "在线诉讼"
					},
					{
						"tag": "基本特征"
					},
					{
						"tag": "融合发展"
					},
					{
						"tag": "风险挑战"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://qikan.cqvip.com/Qikan/Article/Detail?id=7109164886",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "不同反应条件对三元前躯体性质的影响",
				"creators": [
					{
						"firstName": "",
						"lastName": "龚元林",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "廖折军",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "蒋海荣",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨云广",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "随着车载动力电池的使用要求不断提高,对镍钴锰系三元前躯体的生产要求也越来越高,三元前躯体的品质直接决定了三元正极材料的性能发挥,所以制备高性能的三元前躯体,合成工艺尤为关键,在实际生产中按一定的Ni、Co、Mn物质的量的比进行配液,采用共沉淀法来准备三元前躯体,在车间连续式合成生产中,对反应釜氨值、反应温度进行适当调整,通过X射线衍射(XRD)、扫描电子显微镜(SEM)、比表面积孔径分析仪(BET)等对样品的结构、颗粒形貌进行了表征,从而探究不同反应条件对三元前躯体产品物理性质的影响。",
				"extra": "original-title: Effects of Different Reaction Conditions on The Properties of Ternary Presoma\noriginal-author: Gong Yuanlin\noriginal-author: Liao Zhejun\noriginal-author: Jiang Hairong\noriginal-author: Yang Yunguang\noriginal-container-title: Guangdong Chemical Industry\nWeiPuCite: 0",
				"issue": "3",
				"libraryCatalog": "CQVIP Qikan",
				"pages": "130-134",
				"publicationTitle": "广东化工",
				"url": "https://lib.cqvip.com/Qikan/Article/Detail?id=7109164886",
				"attachments": [],
				"tags": [
					{
						"tag": "三元前躯体"
					},
					{
						"tag": "共沉淀法"
					},
					{
						"tag": "反应温度"
					},
					{
						"tag": "氨值"
					},
					{
						"tag": "电池"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://cstj.cqvip.com/Qikan/Article/Detail?id=7111313804&from=Qikan_Search_Index",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Z世代清华大学“特奖”人研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "周溪亭",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴玥",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "魏海龙",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张宁",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024",
				"abstractNote": "特等奖学金作为清华大学本科生的最高荣誉,其获得者无疑是学校育人成果的典型代表。随着时代的发展,“特奖”人的特征也悄然发生了改变。文章基于茨格勒的资优行动模型,通过对3名Z世代获奖者的深度访谈,系统、动态地理解“特奖”人的大学成长过程。研究发现,“特奖”人在性格品质上表现为日常生活中的高自我要求,以及困境应对时的积极心态与强心理韧性;在行为表现上,用“实干善思”超越“听话出活”;在价值取向上,表现为共同利益取向和强烈的社会责任感。正是性格品质、行为表现与价值取向三方面的不断互动,以及个体与外部环境的相互作用,最终造就了“特奖”人的主观行动空间,具体表现为多元发展观、能力增长观和美美与共的取向。研究提出的解释框架有助于揭示高潜力拔尖创新人才的大学成长与发展过程。",
				"extra": "original-title: A Study on the\"Special Scholarship\"Recipients of Generation Z at Tsinghua University\noriginal-author: Zhou Xiting\noriginal-author: Wu Yue\noriginal-author: Wei Hailong\noriginal-author: Zhang Ning\noriginal-container-title: Education and Teaching Research\nWeiPuCite: 0",
				"issue": "2",
				"libraryCatalog": "CQVIP Qikan",
				"pages": "99-112",
				"publicationTitle": "教育与教学研究",
				"url": "https://lib.cqvip.com/Qikan/Article/Detail?id=7111313804",
				"attachments": [],
				"tags": [
					{
						"tag": "Z世代"
					},
					{
						"tag": "价值观"
					},
					{
						"tag": "清华大学"
					},
					{
						"tag": "特等奖学金"
					},
					{
						"tag": "高潜力拔尖创新人才"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://lib.cqvip.com/Qikan/Search/Index?from=Qikan_Article_Detail",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://cstj.cqvip.com/Qikan/Search/Index?from=Qikan_Article_Detail",
		"items": "multiple"
	}
]
/** END TEST CASES **/
