{
	"translatorID": "e034d9be-c420-42cf-8311-23bca5735a32",
	"label": "Baidu Scholar",
	"creator": "l0o0<linxzh1989@gmail.com>",
	"target": "^https?://(www\\.|a\\.)?xueshu\\.baidu\\.com/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-01 16:01:54"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2017 Philipp Zumstein

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

function detectWeb(doc, _url) {
	let paperType = tryMatch(
		ZU.xpathText(doc, '//script[contains(text(), "paperType")]'),
		/paperType:\s?'(.+)'/,
		1
	);
	// 即搜索结果的a[data-click*="filter_type"]
	let paperTypes = [
		'journalArticle',
		'thesis',
		'conferencePaper',
		'book',
		'patent',
		'standard',
		'report'
	];
	if (paperType && paperType <= paperTypes.length) {
		return paperTypes[paperType - 1];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('h3 > a[href*="show?paperid="], h3 > a[href*="cmd=paper_forward"]');
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
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	try {
		await scrapeSearch(text(doc, '[data-click*="doi"]'));
	}
	catch (error1) {
		Z.debug(error1);
		try {
			// throw Error('debug');
			await scrapeWeb(doc);
		}
		catch (error2) {
			Z.debug(error2);
			let itemType = detectWeb(doc, url);
			if (!['standard', 'report'].includes(itemType)) {
				await scrapeRIS(doc, url);
			}
			else {
				await scrapeDoc(doc, url, itemType);
			}
		}
	}
}

async function scrapeSearch(doi) {
	if (!doi) throw new ReferenceError('no identifier available');
	Z.debug(`DOI: ${doi}`);
	let translate = Z.loadTranslator('search');
	// DOI Content Negotiation
	translate.setTranslator('b28d0d42-8549-4c6d-83fc-8382874a5cb9');
	translate.setHandler('error', () => {});
	translate.setHandler('itemDone', (_obj, item) => {
		item.complete();
	});
	translate.setSearch({ DOI: doi });
	await translate.translate();
}

const translatorMap = {
	'kns.cnki.net': '5c95b67b-41c5-4f55-b71a-48d5d7183063',
	// Embedded Metadata
	'www.cqvip.com': '951c027d-74ac-47d4-a107-9c3069ab7b48',
	'sciencedirect.com': 'b6d0a7a-d076-48ae-b2f0-b6de28b194e',
	'onlinelibrary.wiley.com': 'fe728bc9-595a-4f03-98fc-766f1d8d0936',
	'inspirehep.net': '17b1a93f-b342-4b54-ad50-08ecc26e0ac3',
	'iopscience.iop.org': '9346ddef-126b-47ec-afef-8809ed1972ab',
	'scitation.aip.org': '48d3b115-7e09-4134-ad5d-0beda6296761',
	'www.zhangqiaokeyan.com': '2d4f004f-a340-4917-9804-d4da2bd0aec2',
	'doc.taixueshu.com': '6dc5757f-12ad-4c72-bb50-8f7d93095601',
	'doc.paperpass.com': '6dc5757f-12ad-4c72-bb50-8f7d93095601'
};

async function scrapeWeb(doc) {
	let sources = doc.querySelectorAll('.allversion_content > span > a');
	Z.debug(Array.from(sources).map(element => element.href));
	let translatorID = '';
	let url = '';
	for (let host in translatorMap) {
		for (let element of sources) {
			url = element.href;
			if (url.includes('www.cnki.com.cn')) {
				url = `https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=${tryMatch(url, /\/([A-Z]{4})[^/]+.htm/, 1)}&filename=${tryMatch(url, /-(.+).htm/, 1)}`;
			}
			if (url.includes(host)) {
				translatorID = translatorMap[host];
				break;
			}
		}
		if (translatorID) break;
	}
	Z.debug(url);
	Z.debug(translatorID);
	if (!url || !translatorID) throw Error('no other translator available');
	let translator = Zotero.loadTranslator('web');
	translator.setTranslator(translatorID);
	translator.setDocument(await requestDocument(url));
	translator.setHandler('itemDone', (_obj, item) => {
		item.complete();
	});
	translator.setHandler('error', () => { });
	await translator.translate();
}

async function scrapeRIS(doc, url) {
	let id = tryMatch(url, /paperid=\w+/i);
	let risUrl = `https://xueshu.baidu.com/u/citation?type=ris&${id}`;
	let risText = await requestText(risUrl);
	Z.debug(risText);
	let translator = Zotero.loadTranslator('import');
	// RIS
	translator.setTranslator('32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7');
	translator.setString(risText);
	translator.setHandler('itemDone', (_obj, item) => {
		let labels = new Labels(doc, '.c_content > [class$="_wr"]');
		let extra = new Extra();
		switch (item.itemType) {
			case 'thesis':
				item.thesisType = `${text(doc, '[data-click*="degree_name"]')}学位论文`;
				break;
			case 'conferencePaper':
				item.conferenceName = item.publicationTitle;
				delete item.publicationTitle;
				item.place = text(doc, '[data-click*="meeting_place"]');
				break;
			case 'patent':
				item.applicationNumber = text(doc, '[data-click*="appid"]');
				item.patentNumber = text(doc, '[data-click*="pubid"]');
				item.place = item.country = patentCountry(item.patentNumber || item.applicationNumber);
				item.assignee = labels.get('申请\\(专利权\\)人');
				item.filingDate = ZU.strToISO(text(doc, '[data-click*="apptime"]'));
				break;
		}
		fixItem(item, extra, doc);
		item.extra = extra.toString();
		item.complete();
	});
	translator.setHandler('error', () => { });
	await translator.translate();
}

async function scrapeDoc(doc, url, itemType) {
	let labels = new Labels(doc, '.c_content > [class$="_wr"]');
	let newItem = new Z.Item(itemType);
	newItem.title = text(doc, '.main-info h3');
	let extra = new Extra();
	let creators = Array.from(doc.querySelectorAll('.author_text > span, .author_wr [class^="kw_main"] > span'));
	creators.forEach((element) => {
		newItem.creators.push(ZU.cleanAuthor(element.innerText, 'author'));
	});
	switch (newItem.itemType) {
		case 'standard':
			newItem.number = labels.get('标准号').replace('-', '—');
			newItem.date = labels.get('发布日期');
			extra.set('CCS number', labels.get('CCS'));
			extra.set('ICS number', labels.get('ICS'));
			break;
		case 'report':
			newItem.date = ZU.strToISO(text(doc, '.year_wr [class^="kw_main"]'));
			newItem.institution = text(doc, '.publisher_wr [class^="kw_main"]');
			break;
	}
	fixItem(newItem, extra, doc, url);
	newItem.extra = extra.toString();
	newItem.complete();
}

function fixItem(item, extra, doc) {
	item.abstractNote = item.abstractNote || text(doc, 'p.abstract');
	let doi = text(doc, '[data-click*="doi"]');
	if (ZU.fieldIsValidForType('DOI', item.itemType)) {
		item.DOI = doi;
	}
	else {
		extra.set('DOI', doi, true);
	}
	item.url = `https://xueshu.baidu.com/usercenter/paper/show?paperid=${attr(doc, '.paper_collect', 'data-paperid')}`;
	extra.set('citation', text(doc, '.ref-wr-num'), true);
	extra.set('view', text(doc, '.label-r > p:last-child'));
	extra.set('like', text(doc, '.like-amount-num'));
	item.creators.forEach((creator) => {
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
	});
	let tags = doc.querySelectorAll('div.kw_wr a');
	item.tags = tags.length == 1
		? item.tags = tags[0].innerText.split("；")
		: Array.from(tags).map(element => element.innerText);
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

function patentCountry(idNumber) {
	return {
		AD: '安道尔', AE: '阿拉伯联合酋长国', AF: '阿富汗', AG: '安提瓜和巴布达', AI: '安圭拉', AL: '阿尔巴尼亚', AM: '亚美尼亚', AN: '菏属安的列斯群岛', AO: '安哥拉', AR: '阿根廷', AT: '奥地利', AU: '澳大利亚', AW: '阿鲁巴', AZ: '阿塞拜疆', BB: '巴巴多斯', BD: '孟加拉国', BE: '比利时', BF: '布莱基纳法索', BG: '保加利亚', BH: '巴林', BI: '布隆迪', BJ: '贝宁', BM: '百慕大', BN: '文莱', BO: '玻利维亚', BR: '巴西', BS: '巴哈马', BT: '不丹', BU: '缅甸', BW: '博茨瓦纳', BY: '白俄罗斯', BZ: '伯利兹', CA: '加拿大', CF: '中非共和国', CG: '刚果', CH: '瑞士', CI: '科特迪瓦', CL: '智利', CM: '喀麦隆', CN: '中国', CO: '哥伦比亚', CR: '哥斯达黎加', CS: '捷克斯洛伐克', CU: '古巴', CV: '怫得角', CY: '塞浦路斯',
		DE: '联邦德国', DJ: '吉布提', DK: '丹麦', DM: '多米尼加岛', DO: '多米尼加共和国', DZ: '阿尔及利亚', EC: '厄瓜多尔', EE: '爱沙尼亚', EG: '埃及', EP: '欧洲专利局', ES: '西班牙', ET: '埃塞俄比亚', FI: '芬兰', FJ: '斐济', FK: '马尔维纳斯群岛', FR: '法国',
		GA: '加蓬', GB: '英国', GD: '格林那达', GE: '格鲁吉亚', GH: '加纳', GI: '直布罗陀', GM: '冈比亚', GN: '几内亚', GQ: '赤道几内亚', GR: '希腊', GT: '危地马拉', GW: '几内亚比绍', GY: '圭亚那', HK: '香港', HN: '洪都拉斯', HR: '克罗地亚', HT: '海地', HU: '匈牙利', HV: '上沃尔特', ID: '印度尼西亚', IE: '爱尔兰', IL: '以色列', IN: '印度', IQ: '伊拉克', IR: '伊朗', IS: '冰岛', IT: '意大利',
		JE: '泽西岛', JM: '牙买加', JO: '约旦', JP: '日本', KE: '肯尼亚', KG: '吉尔吉斯', KH: '柬埔寨', KI: '吉尔伯特群岛', KM: '科摩罗', KN: '圣克里斯托夫岛', KP: '朝鲜', KR: '韩国', KW: '科威特', KY: '开曼群岛', KZ: '哈萨克', LA: '老挝', LB: '黎巴嫩', LC: '圣卢西亚岛', LI: '列支敦士登', LK: '斯里兰卡', LR: '利比里亚', LS: '莱索托', LT: '立陶宛', LU: '卢森堡', LV: '拉脱维亚', LY: '利比亚',
		MA: '摩洛哥', MC: '摩纳哥', MD: '莫尔多瓦', MG: '马达加斯加', ML: '马里', MN: '蒙古', MO: '澳门', MR: '毛里塔尼亚', MS: '蒙特塞拉特岛', MT: '马耳他', MU: '毛里求斯', MV: '马尔代夫', MW: '马拉维', MX: '墨西哥', MY: '马来西亚', MZ: '莫桑比克', NA: '纳米比亚', NE: '尼日尔', NG: '尼日利亚', NH: '新赫布里底', NI: '尼加拉瓜', NL: '荷兰', NO: '挪威', NP: '尼泊尔', NR: '瑙鲁', NZ: '新西兰', OA: '非洲知识产权组织', OM: '阿曼',
		PA: '巴拿马', PC: 'PCT', PE: '秘鲁', PG: '巴布亚新几内亚', PH: '菲律宾', PK: '巴基斯坦', PL: '波兰', PT: '葡萄牙', PY: '巴拉圭', QA: '卡塔尔', RO: '罗马尼亚', RU: '俄罗斯联邦', RW: '卢旺达',
		SA: '沙特阿拉伯', SB: '所罗门群岛', SC: '塞舌尔', SD: '苏丹', SE: '瑞典', SG: '新加坡', SH: '圣赫勒拿岛', SI: '斯洛文尼亚', SL: '塞拉利昂', SM: '圣马利诺', SN: '塞内加尔', SO: '索马里', SR: '苏里南', ST: '圣多美和普林西比岛', SU: '苏联', SV: '萨尔瓦多', SY: '叙利亚', SZ: '斯威士兰', TD: '乍得', TG: '多哥', TH: '泰国', TJ: '塔吉克', TM: '土库曼', TN: '突尼斯', TO: '汤加', TR: '土耳其', TT: '特立尼达和多巴哥', TV: '图瓦卢', TZ: '坦桑尼亚', UA: '乌克兰', UG: '乌干达', US: '美国', UY: '乌拉圭', UZ: '乌兹别克',
		VA: '梵蒂冈', VC: '圣文森特岛和格林纳达', VE: '委内瑞拉', VG: '维尔京群岛', VN: '越南', VU: '瓦努阿图', WO: '世界知识产权组织', WS: '萨摩亚', YD: '民主也门', YE: '也门', YU: '南斯拉夫', ZA: '南非', ZM: '赞比亚', ZR: '扎伊尔', ZW: '津巴布韦'
	}[idNumber.substring(0, 2).toUpperCase()] || '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=b3ab239032d44d951d8eee26d7bc44bf",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Zotero: information management software 2.0",
				"creators": [
					{
						"lastName": "Fernandez",
						"firstName": "Peter",
						"creatorType": "author"
					}
				],
				"date": "2011",
				"DOI": "info:doi/10.1108/07419051111154758",
				"abstractNote": "Purpose – The purpose of this paper is to highlight how the open-source bibliographic management program Zotero harnesses Web 2.0 features to make library resources more accessible to casual users without sacrificing advanced features. This reduces the barriers understanding library resources and provides additional functionality when organizing information resources. Design/methodology/approach – The paper reviews select aspects of the program to illustrate how it can be used by patrons and information professionals, and why information professionals should be aware of it. Findings – Zotero has some limitations, but succeeds in meeting the information management needs of a wide variety of users, particularly users who use online resources. Originality/value – This paper is of interest to information professionals seeking free software that can make managing bibliographic information easier for themselves and their patrons.",
				"extra": "citation: 19\nview: 845\nlike: 0",
				"issue": "4",
				"libraryCatalog": "Baidu Scholar",
				"pages": "5-7",
				"publicationTitle": "Library Hi Tech News",
				"shortTitle": "Zotero",
				"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=b3ab239032d44d951d8eee26d7bc44bf",
				"volume": "28",
				"attachments": [],
				"tags": [
					{
						"tag": "Citation management"
					},
					{
						"tag": "Internet"
					},
					{
						"tag": "Library services"
					},
					{
						"tag": "Open source"
					},
					{
						"tag": "Reference management"
					},
					{
						"tag": "Technology"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=3f9bd602ac5e8d658307fd3708fed410",
		"items": [
			{
				"itemType": "thesis",
				"title": "美国的欧洲犹太难民政策研究(1933-1945)",
				"creators": [
					{
						"lastName": "娄伟光",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "1933-1945年是希特勒在德国建立纳粹极权统治,反犹主义逐步升级至顶峰的时期.纳粹政府的反犹,迫犹政策造成了严重的欧洲犹太难民问题.做为犹太难民躲避纳粹迫害的主要目的地和二战期间世界\"民主的堡垒\",美国的欧洲犹太难民政策对欧洲犹太难民的影响是举足轻重的.本文将对1933-1945年美国的欧洲犹太难民政策进行综合研究,并提出一些自己的浅见. 第一章主要阐述1933-1945年的纳粹反犹政策和欧洲犹太难民问题这一历史背景.欧洲犹太难民问题的发展和纳粹反犹政策的升级密不可分,随着纳粹反犹政策的一步步升级,欧洲犹太难民的数量变得越来越多,国际社会对难民问题的应对也变得越来越无力. 第二章主要研究1933-1945年美国的欧洲犹太难民政策.1933-1945年美国对欧洲犹太难民的政策完全是在美国既有的移民限额体系内实施的,同时,美国的欧洲犹太难民政策在不同时期又呈现出不同的特点.1933-1937年是美国消极接纳犹太难民的时期,这一时期美国的做法是不主动接收难民,不主动承担责任.1938-1941年美国多次主动寻求解决难民问题的办法,并多次主动召开了解决难民问题的国际会议,但这一时期美国的难民政策从整体看仍是消极的,不作为的.1941-1945年是纳粹大屠杀时期,这一时期美国的欧洲犹太难民政策主要涉及到对犹太人的援救,但在1944年之前,美国少有援救行动,直到1944年成立战时难民委员会后才做了一些积极的援救行动. 第三章分析美国的欧洲犹太难民政策的成因.美国的犹太难民政策的成因是较为复杂的,在受到美国国内的孤立主义思潮和美国国内的反犹主义的制约的同时,还受到美德关系的制约以及罗斯福个人因素的影响. 第四章研究美国的欧洲犹太难民政策产生的影响.美国较为消极的政策首先对欧洲犹太难民产生了直接影响,使众多本可以逃离纳粹魔掌的犹太难民没有得到生存的机会.其次,美国接收的欧洲犹太难民和众多的知识难民对美国社会产生了巨大影响,他们在诸多领域为美国做出了巨大贡献. 本文得出的结论主要有:1933—1945年期间美国的欧洲犹太难民政策是较为消极和不作为的,这一特性是由美国政府面临的国家利益与国内外现实因素决定的.客观来说,欧洲犹太难民的困境并不能完全由美国来承担责任,当时的整个文明世界也都对犹太难民缺乏足够有力的援助与安置.美国接收的犹太\"知识难民\"在战后为美国经济,社会及文化的繁荣创造了有利条件.从某种程度上看,这也是美国战时欧洲犹太难民政策为美国社会带来的一个长久的积极影响.",
				"extra": "DOI: CNKI:CDMD:2.1013.256934\ncitation: 5\nview: 186\nlike: 0",
				"libraryCatalog": "Baidu Scholar",
				"thesisType": "硕士学位论文",
				"university": "郑州大学",
				"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=3f9bd602ac5e8d658307fd3708fed410",
				"attachments": [],
				"tags": [
					{
						"tag": "德国"
					},
					{
					
						"tag": "犹太难民政策"
					},
					{
						"tag": "纳粹"
					},
					{
						"tag": "罗斯福"
					},
					{
						"tag": "美国"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=99d353b9677f0d0287e051e400aea729&site=xueshu_se",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "中国物理学会2012年秋季学术会议导带弯曲对有限深GaN/Ga1-xAlxN球形量子点中杂质态的影响及其压力效应",
				"creators": [
					{
						"lastName": "曹艳娟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "闫祖威",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "以三角势近似界面导带弯曲,采用变分理论研究了有限高势垒GaN/Ga1-xAlxN球形量子点[1]中杂质态的结合能[2].并考虑电子的有效质量[3],材料的介电常数以及禁带宽度随流体静压力的变化,数值计算了杂质态结合能随量子点尺寸,电子的面密度,铝组分和压力的变化关系.结果表明,随着电子面密度的增加,杂质态结合能降低,当电子面密度较大时,随着量子点尺寸的增大,结合能趋于一个相同且较小的值.",
				"conferenceName": "中国物理学会2012年秋季学术会议",
				"extra": "citation: 1\nview: 89\nlike: 0",
				"libraryCatalog": "Baidu Scholar",
				"place": "广州",
				"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=99d353b9677f0d0287e051e400aea729",
				"attachments": [],
				"tags": [
					{
						"tag": "流体静压力"
					},
					{
						"tag": "电子面密度"
					},
					{
						"tag": "结合能"
					},
					{
						"tag": "量子点"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=9151406471e5456fb7183e0ecd035527",
		"items": [
			{
				"itemType": "book",
				"title": "图解大国陆权",
				"creators": [
					{
						"lastName": "哈尔福德・麦金德",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2014",
				"abstractNote": "本书是一本系统介绍英国\"陆权论\"提出者哈尔福德麦金德的陆权思想的书籍,满足了读者了解陆权和地缘政治的需求,文中有陆战分析和历史解读,还配以图片,有助于读者理解麦金德的理论.通过分析各大帝国在\"心脏地带\"的纷乱争斗历史中,麦金德发现有一点是非常明确的,即无论英国与俄国竞争,还是与德国对方,政策的出发点都是一致的,那就是要避免\"心脏地带\"落入陆地强权之手.此后,他提出了著名的麦氏三段论:谁统治了东欧,谁就能控制大陆\"心脏地带\";谁控制大陆\"心脏地带\",谁就能控制\"世界岛(欧亚大陆)\";谁控制了\"世界岛\",谁就能控制整个世界!",
				"extra": "view: 105\nlike: 0",
				"libraryCatalog": "Baidu Scholar",
				"publisher": "图解大国陆权",
				"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=9151406471e5456fb7183e0ecd035527",
				"attachments": [],
				"tags": [
					{
						"tag": "政治地理学"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=b11b0a933ef004fff0f56bf0e864b69e",
		"items": [
			{
				"itemType": "patent",
				"title": "微波加热路面综合养护车",
				"creators": [
					{
						"lastName": "肖铁和",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "胡健",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"abstractNote": "本实用新型是一种采用微波加热的原理对沥青破损路面进行现场加热再生修补的特种民用汽车.包括有车头(20),车底盘(21),车轮(22)及其驱动装置,其中车底盘(21)内装设有动力电流装置(2),微波加热装置(5),高压电源(6),运动驱动装置(12),电气控制装置(13),综合养护设备(16)及沥青混凝土加热装置A.本实用新型由于采用微波加热路面的结构,因此,其不仅可节约路面加热时间,提高工作效率,且路面修补质量好;此外,本实用新型可使路面加热与路面修补综合进行,修复路面一气呵成,本实用新型满足了高等级公路养护工程的\"快速进入,快速作业,快速撤离\"的现代化工作要求,是养护路面特种专用车的新发展.其经济效益及社会效益都较显著.",
				"applicationNumber": "CN 200420095088",
				"assignee": "佛山市美的日用家电集团有限公司",
				"country": "中国",
				"extra": "citation: 146\nview: 365\nlike: 0",
				"filingDate": "2004-11-12",
				"patentNumber": "CN 2777030 Y",
				"place": "中国",
				"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=b11b0a933ef004fff0f56bf0e864b69e",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=160v0040de7d06c0640g0g20ta759296",
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献 参考文献著录规则",
				"creators": [],
				"date": "2015-05-15",
				"abstractNote": "本标准规定了各个学科,各种类型信息资源的参考文献的著录项目,著录顺序,著录用符号,著录用文字,各个著录项目的著录方法以及参考文献在正文中的标注法.本标准适用于著者和编辑著录参考文献,而不是供图书馆员,文献目录编制者以及索引编辑者使用的文献著录规则.",
				"extra": "CCS number: A 综合-A10/19 经济、文化-A14 图书馆、档案、文献与情报工作\nICS number: 01 综合、术语学、标准化、文献-01.140 信息学、出版-01.140.20 信息学\nview: 873\nlike: 0",
				"libraryCatalog": "Baidu Scholar",
				"number": "GB/T 7714—2015",
				"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=160v0040de7d06c0640g0g20ta759296",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=1b0d02509s6u0c80b77u0440h0651943",
		"items": [
			{
				"itemType": "report",
				"title": "四川省南充市仪陇县地质灾害详细调查成果报告",
				"creators": [
					{
						"firstName": "",
						"lastName": "雷耕",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2017-04-19",
				"abstractNote": "受\"5.12\"汶川特大地震,\"4.20\"芦山强烈地震,\"11.12\"康定地震及频发极端天气,不合理人类工程活动等影响,四川省境内山区地质环境条件变得更加脆弱,诱发新增了大量崩塌,滑坡,泥石流,不稳定斜坡等次生地质灾害,原有地质灾害隐患点绝大部分出现变形加剧,险情加重趋势,严重危害人民群众生命财产安全,制约着社会经济可持续发展.在此背景下,我单位通过收集资料,野外踏勘和积极参加投标活动,有幸中标\"四川省2016年地质灾害详细调查第11标段(南充市仪陇县)\",成为该项目承建单位.本次详查在充分收集已有资料的基础上,以遥感解译,地面调查,测绘和工程勘查为主要手段,开展仪陇县滑坡,崩塌,泥石流等地质灾害详细调查,基本查明县境内地质灾害及其隐患发育特征,分布规律以及形成的地质环境条件,并对其危害程度进行评价,划分地质灾害易发区和危险区,建立健全群测群防网络,建立地质灾害信息系统,为减灾防灾和制定区域防灾规划提供基础地质依据.本次详查完成了全县1:50000调查测绘面积1791km2,其中重点调查区面积363.3km2,一般调查区面积1427.7km2;调查了各类地质灾害点769处,地质环境点136处;完成全县1:50000遥感解译面积1791km2,完成重点场镇及典型小流域1:10000遥感解译73.7km2,解译地质灾害和环境点131处;完成金城镇,大寅镇,永乐镇,立山镇4处重点地段1:10000调查测绘面积39.7km2;完成肖水河典型小流域综合调查测绘,面积34km2;完成了金城镇瑞泉路危岩,赵家湾堆积场滑坡,三河镇兰田滑坡3处典型点勘查及小流域勘查;完成典型斜坡,岩土体结构实测剖面19条18.452km;完成钻探31孔410.4m,浅井30口102.2m;完成全县已实施治理工程及排危除险复核29处,完成地质灾害宣传培训13场次,汛期指导(3人),四川省地质环境地质灾害基础数据库数据录入等工作,全部或超额完成了投标及设计书所有工作量.",
				"extra": "view: 139\nlike: 0",
				"institution": "四川省地质矿产勘查开发局四0五地质队",
				"libraryCatalog": "Baidu Scholar",
				"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=1b0d02509s6u0c80b77u0440h0651943",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/s?wd=zotero&rsv_bp=0&tn=SE_baiduxueshu_c1gjeupa&rsv_spt=3&ie=utf-8&f=8&rsv_sug2=0&sc_f_para=sc_tasktype%3D%7BfirstSimpleSearch%7D",
		"items": "multiple"
	}
]
/** END TEST CASES **/
