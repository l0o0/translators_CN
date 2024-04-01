{
	"translatorID": "2d4f004f-a340-4917-9804-d4da2bd0aec2",
	"label": "zhangqiaokeyan",
	"creator": "jiaojiaodubai",
	"target": "^https?://www\\.zhangqiaokeyan\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-01 16:50:06"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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

var typeMap = {
	外文期刊: {
		itemType: 'journalArticle',
		language: 'en-US'
	},
	外文会议: {
		itemType: 'conferencePaper',
		language: 'en-US'
	},
	外文学位: {
		itemType: 'thesis',
		language: 'en-US'
	},
	外国专利: {
		itemType: 'patent',
		language: 'en-US'
	},
	外文图书: {
		itemType: 'book',
		language: 'en-US'
	},
	// 外文OA文献: {
	// 	itemType: 'journalArticle',
	// 	language: 'en-US'
	// },
	美国政府科技报告: {
		itemType: 'report',
		language: 'en-US'
	},
	外军国防科技报告: {
		itemType: 'report',
		language: 'en-US'
	},
	中文期刊: {
		itemType: 'journalArticle',
		language: 'zh-CN'
	},
	中文会议: {
		itemType: 'conferencePaper',
		language: 'zh-CN'
	},
	中文学位: {
		itemType: 'thesis',
		language: 'zh-CN'
	},
	中国专利: {
		itemType: 'patent',
		language: 'zh-CN'
	},
	中文图书: {
		itemType: 'book',
		language: 'zh-CN'
	}
};

function detectWeb(doc, _url) {
	// 面包屑
	let typeKey = text(doc, '.weizhi > a:nth-child(2), .new_location > a:nth-last-child(2)');
	if (typeMap[typeKey]) {
		return typeMap[typeKey].itemType;
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('#doclist .tit > a, #collectlist > li > span > a:only-child');
	for (let row of rows) {
		let href = tryMatch(row.href, /\/[^']+html/);
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
	let item = {};
	let extra = new Extra();
	let labels = new LabelsX(doc, '.record > ul > li, .record ul > li > p, .record ul > li > div > p, .booksintroduce > ul > li');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));

	let translator = Zotero.loadTranslator('web');
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);
	translator.setHandler('itemDone', (_obj, patchItem) => {
		item = patchItem;
	});
	await translator.translate();

	item.itemType = detectWeb(doc, url);
	item.title = ZU.capitalizeTitle(item.title);
	item.abstractNote = text(doc, '#abstract');
	switch (item.itemType) {
		case 'conferencePaper': {
			let pubInfo = labels.getWith('来源');
			item.pages = tryMatch(pubInfo, /\|([\d+-]+)\|0, 1/);
			item.creators = Array.from(doc.querySelectorAll('.author > p > a')).map((element) => {
				return ZU.cleanAuthor(ZU.capitalizeName(ZU.trimInternal(element.textContent).replace(/[,;，；]\s?$/, '')), 'author');
			});
			break;
		}
		case 'thesis': {
			let degree = labels.getWith('学位');
			if (['硕士', '博士'].includes(degree)) {
				item.thesisType = degree + '学位论文';
			}
			else if (degree == '修士') {
				item.thesisType = degree + '修士号论文';
			}
			else if (degree.startsWith('M.')) {
				item.thesisType = "Master's thesis";
			}
			// D.A., Ph.D., D.P.A., Ed.D. …
			else if (degree.includes('D.')) {
				item.thesisType = 'Doctoral dissertation';
			}
			item.university = labels.getWith('授予单位').replace(/[,;，；]\s?$/, '');
			item.date = ZU.strToISO(labels.getWith('年度'));
			item.numPages = labels.getWith('总页数');
			extra.set('major', labels.getWith('学科'));
			item.creators.push(ZU.cleanAuthor(text(doc, '.author > p > a').replace(/[,;，；]\s?$/, ''), 'author'));
			labels.getWith('导师姓名').split(/[,;，；]\s?/)
				.filter(string => string)
				.forEach((string) => {
					item.creators.push(ZU.cleanAuthor(string, 'contributor'));
				});
			break;
		}
		case 'patent': {
			item.assignee = labels.getWith('专利权人').replace(/[,;，；]\s?$/, '');
			item.patentNumber = labels.getWith('公告号');
			item.applicationNumber = labels.getWith('专利号');
			item.place = item.country = patentCountry(item.patentNumber || item.applicationNumber);
			item.filingDate = ZU.strToISO(labels.getWith('申请日'));
			item.issueDate = ZU.strToISO(labels.getWith('公告日'));
			labels.getWith('发明设计人', true).querySelectorAll('a').forEach((element) => {
				item.creators.push(ZU.cleanAuthor(ZU.trimInternal(element.textContent).replace(/[,;，；]\s?$/, ''), 'inventor'));
			});
			extra.set('Genre', labels.getWith('专利类型'), true);
			break;
		}
		case 'book': {
			item.title = text(doc, '.contit > h1');
			let publisher = labels.getWith('出版社');
			item.place = tryMatch(publisher, /^([\u4e00-\u9fff]+)/, 1) || tryMatch(publisher, /^([\w,\s]+): /, 1);
			item.publisher = publisher.replace(/^[\u4e00-\u9fff]+ |^[\w,\s]+:\s?/, '');
			item.date = ZU.strToISO(text(doc, '.bookstop .time'));
			item.numPages = labels.getWith('页数');
			item.ISBN = ZU.cleanISBN(labels.getWith('ISBN'));
			labels.getWith('作者', true).querySelectorAll('span').forEach((element) => {
				let string = ZU.trimInternal(element.textContent);
				let country = tryMatch(string, /^\((.?)\)/, 1);
				string = string.replace(/^\((.?)\)/, '');
				let original = tryMatch(string, /[\u4e00-\u9fff]\s([\w ]+)$/, 1);
				string = string.replace(/([\u4e00-\u9fff])\s[\w ]+$/, '$1');
				let creator = ZU.cleanAuthor(string, 'author');
				creator.country = country;
				creator.original = original;
				item.creators.push(creator);
			});
			break;
		}
		case 'report':
			item.reportType = '科技报告';
			item.date = ZU.strToISO(labels.getWith('年度'));
			item.pages = labels.getWith('页码');
			item.creators = Array.from(doc.querySelectorAll('.author > p > a')).map((element) => {
				return ZU.cleanAuthor(ZU.capitalizeName(ZU.trimInternal(element.textContent).replace(/[,;，；]\s?$/, '')), 'author');
			});
			break;
	}
	item.language = {
		chi: 'zh-CN',
		eng: 'en-US',
		日语: 'jp-JP',
		中文: 'zh-CN',
		英语: 'en-US'
	}[labels.getWith(['正文语种', '语言'])] || typeMap[text(doc, '.weizhi > a:nth-child(2), .new_location > a:nth-last-child(2)')].language;
	item.libraryCatalog = '掌桥科研';
	extra.set('CLC', labels.getWith('中图分类'));
	if (['journalArticle', 'conferencePaper'].includes(item.itemType)) {
		await addPubDetail(item, extra, attr(doc, '.weizhi > a:nth-last-child(2)', 'href'));
	}
	item.creators.forEach((creator) => {
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.lastName = creator.firstName + creator.lastName;
			creator.firstName = '';
			creator.fieldMode = 1;
		}
	});
	if (item.creators.some(creator => creator.original || creator.country)) {
		extra.set('creatorsExt', JSON.stringify(item.creators));
	}
	item.creators.forEach((creator) => {
		delete creator.original;
		delete creator.country;
	});
	item.tags = Array.from(doc.querySelectorAll('.antistop a')).map((element) => {
		return ZU.trimInternal(element.textContent).replace(/[,;，；]\s?$/, '');
	});
	item.extra = extra.toString(item.extra);
	item.complete();
}

async function addPubDetail(item, extra, url) {
	try {
		let pubDoc = await requestDocument(url);
		let labels = new LabelsX(pubDoc, '[class*="introduce"] > ul > li> div, .teach_info > ul > li, .teach_info > p');
		Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
		switch (item.itemType) {
			case 'journalArticle': {
				item.ISSN = labels.getWith('ISSN');
				extra.set('original-title', text(pubDoc, '.introduce_titmore'), true);
				extra.set('publicationTag', Array.from(pubDoc.querySelectorAll('.introduce_head, .scbiaoshi > span')).map(element => ZU.trimInternal(element.textContent)).join(', '));
				extra.set('CIF', labels.getWith('CNKI综合因子'));
				break;
			}
			case 'conferencePaper': {
				item.date = ZU.strToISO(labels.getWith('出版时间'));
				item.proceedingsTitle = labels.getWith('会议文集');
				item.conferenceName = text(pubDoc, 'h1.tit');
				item.place = labels.getWith('召开地');
				extra.set('organizer', labels.getWith('主办单位'), true);
				break;
			}
		}
	}
	catch (error) {
		Z.debug(error);
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

class LabelsX {
	constructor(doc, selector) {
		this.innerData = [];
		this.emptyElement = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elementCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elementCopy.removeChild(elementCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elementCopy.childNodes.length > 1) {
					let key = elementCopy.removeChild(elementCopy.firstChild).textContent.replace(/\s/g, '');
					this.innerData.push([key, elementCopy]);
				}
				else {
					let text = ZU.trimInternal(elementCopy.textContent);
					let key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elementCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.innerData.push([key, elementCopy]);
				}
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let results = label
				.map(aLabel => this.getWith(aLabel, element));
			let keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElement
					: '';
		}
		let pattern = new RegExp(label, 'i');
		let keyVal = this.innerData.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElement
				: '';
	}
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

/**
 * Return the country name according to the patent number or patent application number.
 */
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
		"url": "https://www.zhangqiaokeyan.com/academic-journal-cn_chinese-mental-health-journal_thesis/02012102722088.html",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "大学生日间嗜睡与睡眠拖延和睡眠质量的关系",
				"creators": [
					{
						"firstName": "",
						"lastName": "黄佳豪",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "朱莹莹",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李少谦",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "目的:探讨大学生日间嗜睡与睡眠拖延的关系,以及睡眠质量的中介作用和性别的调节作用。方法:选取某两所本科院校在校大学生2823人(男808人,女2015人),采用Epworth嗜睡量表(ESS,得分≥11分提示存在日间嗜睡)、匹兹堡睡眠质量指数量表(PSQI)、睡眠拖延量表(BPS)测查。采用PROCESS宏程序中的模型4检验睡眠质量的中介作用,采用模型14检验性别的调节作用。结果:1214人(占43.0%)存在日间嗜睡状况。ESS得分与BPS得分正向关联(β=0.16);PSQI总分在BPS得分与ESS得分间起部分中介作用,中介效应占总效应的39.9%;性别在PSQI总分与ESS得分间起调节作用(β=-0.13)。结论:大学生的日间嗜睡与睡眠拖延、睡眠质量相关,性别可以调节睡眠质量与日间嗜睡的关系。",
				"extra": "CLC: 睡眠和催眠;",
				"issue": "12",
				"language": "zh-CN",
				"libraryCatalog": "掌桥科研",
				"pages": "1065-1070",
				"publicationTitle": "中国心理卫生杂志",
				"url": "https://www.zhangqiaokeyan.com/academic-journal-cn_chinese-mental-health-journal_thesis/02012102722088.html",
				"volume": "37",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "大学生"
					},
					{
						"tag": "性别"
					},
					{
						"tag": "日间嗜睡"
					},
					{
						"tag": "睡眠拖延"
					},
					{
						"tag": "睡眠质量"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/academic-journal-foreign_internet-computing-ieee_thesis/0204144188.html",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "I Know Where You've Been: Geo-Inference Attacks via the Browser Cache",
				"creators": [
					{
						"firstName": "Jia",
						"lastName": "Yaoqi",
						"creatorType": "author"
					},
					{
						"firstName": "Dong",
						"lastName": "Xinshu",
						"creatorType": "author"
					},
					{
						"firstName": "Liang",
						"lastName": "Zhenkai",
						"creatorType": "author"
					},
					{
						"firstName": "Saxena",
						"lastName": "Prateek",
						"creatorType": "author"
					}
				],
				"date": "2015",
				"abstractNote": "To provide more relevant content and better responsiveness, many websites customize their services according to users' geolocations. However, if geo-oriented websites leave location-sensitive content in the browser cache, other sites can sniff that content via side channels. The authors' case studies demonstrate the reliability and power of geo-inference attacks, which can measure the timing of browser cache queries and track a victim's country, city, and neighborhood. Existing defenses cannot effectively prevent such attacks, and additional support is required for a better defense deployment.",
				"issue": "1",
				"language": "en-US",
				"libraryCatalog": "掌桥科研",
				"pages": "44-53",
				"publicationTitle": "Internet Computing, IEEE",
				"shortTitle": "I Know Where You've Been",
				"url": "https://www.zhangqiaokeyan.com/academic-journal-foreign_internet-computing-ieee_thesis/0204144188.html",
				"volume": "19",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "Browsers"
					},
					{
						"tag": "Cache memory"
					},
					{
						"tag": "Content management"
					},
					{
						"tag": "Geography"
					},
					{
						"tag": "Google"
					},
					{
						"tag": "Internet"
					},
					{
						"tag": "Mobile radio management"
					},
					{
						"tag": "Privacy"
					},
					{
						"tag": "Web browsers"
					},
					{
						"tag": "Web technologies"
					},
					{
						"tag": "security and privacy protection"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/academic-conference-cn_meeting-20570_thesis/02022143881.html",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "拆除小农经济樊篱实现奶业产加销一体化",
				"creators": [
					{
						"firstName": "",
						"lastName": "孟宪政",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "沈启云",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李学荣",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孟海波",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2007-06",
				"abstractNote": "通过对小农经济特性的剖析,指出商品小农阶段,特别是在有着数千年小农经济历史的中国,要实现奶业产加销一体化,使千家万户的奶农走向市场,首先必须砸碎束缚在我们身上的小农意识枷锁,进而下决心拆除奶农之间、乳品企业之间、营销部门之间的篱笆,进而拆除奶业产加销之间的樊篱；最后通过股份制使三者统一到奶业合作社的轨道上来,走\"奶业合作社+公司+奶农\"的道路,最终实现奶业产业化。",
				"conferenceName": "中国奶业协会2007年会",
				"extra": "organizer: 中国奶业协会\nCLC: 畜牧业、饲养业;乳品加工工业;",
				"libraryCatalog": "掌桥科研",
				"place": "南京",
				"proceedingsTitle": "中国奶业协会2007年会",
				"url": "https://www.zhangqiaokeyan.com/academic-conference-cn_meeting-20570_thesis/02022143881.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "奶业产业化"
					},
					{
						"tag": "奶业产销一体化"
					},
					{
						"tag": "奶业现代化"
					},
					{
						"tag": "小农经济"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/academic-conference-foreign_10th-annual-joint-conference-digital-libraries-2010_thesis/020511310215.html",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "A User-Centered Design of a Personal Digital Library for Music Exploration",
				"creators": [
					{
						"firstName": "David",
						"lastName": "Bainbridge",
						"creatorType": "author"
					},
					{
						"firstName": "Brook J.",
						"lastName": "Novak",
						"creatorType": "author"
					},
					{
						"firstName": "Sally Jo",
						"lastName": "Cunningham",
						"creatorType": "author"
					}
				],
				"abstractNote": "We describe the evaluation of a personal digital library environment designed to help musicians capture, enrich and store their ideas using a spatial hypermedia paradigm. The target user group is musicians who primarily use audio and text for composition and arrangement, rather than with formal music notation. Using the principle of user-centered design, the software implementation was guided by a diary study involving nine musicians which suggested five requirements for the software to support: capturing, overdubbing, developing, storing, and organizing. Moreover, the underlying spatial data-model was exploited to give raw audio compositions a hierarchical structure, and-to aid musicians in retrieving previous ideas-a search facility is available to support both query by humming and text-based queries. A user evaluation of the completed design with eleven subjects indicated that musicians, in general, would find the hypermedia environment useful for capturing and managing their moments of musical creativity and exploration. More specifically they would make use of the query by humming facility and the hierarchical track organization, but not the overdubbing facility as implemented.",
				"conferenceName": "10th annual joint conference on digital libraries 2010",
				"extra": "CLC: 电子图书馆、数字图书馆;",
				"language": "en-US",
				"libraryCatalog": "掌桥科研",
				"proceedingsTitle": "-",
				"url": "https://www.zhangqiaokeyan.com/academic-conference-foreign_10th-annual-joint-conference-digital-libraries-2010_thesis/020511310215.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "music composition"
					},
					{
						"tag": "personal digital music library"
					},
					{
						"tag": "spatial hypermedia"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/academic-degree-domestic_mphd_thesis/02031271925.html",
		"items": [
			{
				"itemType": "thesis",
				"title": "农村电商、农民创业与农民收入增长研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "张秀",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "闫星宇",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2018",
				"extra": "major: 产业经济学\nCLC: 中国农业经济;",
				"language": "zh-CN",
				"libraryCatalog": "掌桥科研",
				"thesisType": "硕士学位论文",
				"university": "南京财经大学",
				"url": "https://www.zhangqiaokeyan.com/academic-degree-domestic_mphd_thesis/02031271925.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "农村"
					},
					{
						"tag": "农民创业"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/academic-degree-domestic_mphd_thesis/020316460411.html",
		"items": [
			{
				"itemType": "thesis",
				"title": "关系理性视域下马克思恩格斯生态思想研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "宋玉兰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李桂花",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2020",
				"extra": "major: 马克思主义基本原理\nCLC: 企业经济;",
				"language": "zh-CN",
				"libraryCatalog": "掌桥科研",
				"thesisType": "博士学位论文",
				"university": "吉林大学",
				"url": "https://www.zhangqiaokeyan.com/academic-degree-domestic_mphd_thesis/020316460411.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/academic-degree-foreign_mphd_thesis/0206149254.html",
		"items": [
			{
				"itemType": "thesis",
				"title": "Using decision and risk analysis to assist in policy making about terrorism.",
				"creators": [
					{
						"firstName": "Rosoff, Heather",
						"lastName": "Beth",
						"creatorType": "author"
					}
				],
				"date": "2009",
				"abstractNote": "Risk has been characterized as a function of a potential threat, vulnerability to the threat, and the consequences were the threat to be carried out. In the context of terrorism, threats are the individuals who might wage an attack against a specific target; vulnerabilities are the people and targets whose safety is contingent upon the effectiveness of security policies; and consequences are the possible negative outcomes from an attack. The intent of this paper is to use different risk and decision analysis techniques to assist in the policy making relative to assessing these three different components that define terrorism risk.;First, a methodology is described for representing terrorist leader preferences for alternative attack strategies against the U.S. A multi-attribute utility model embedded within a Risk simulation model was developed to characterize terrorist motivations and values. Ultimately, relative likelihood of a terrorist attack is determined as a function of the terrorists' attack utility. While the model's outputs are mostly illustrative of the methodology used, the policy implications of the approach are considered.;Next, the threat of attacks on the ports of Los Angeles and Long Beach is analyzed.  Terrorists are assumed to be using a radiological dispersal device (RDD, also known as a \"dirty bomb\") to shut down port operations and cause substantial economic and psychological impacts. The analysis is an exploratory investigation of a combination of several risk analysis tools, including scenario generation and pruning, project risk analysis, direct consequence modeling, and indirect economic impact assessment. The implications for countering a dirty bomb, including the protection of the radiological sources and intercepting an ongoing dirty bomb attack, are discussed.;Lastly, a compilation of three studies were conducted to assess how individuals perceive the risks of terrorism. The psychometric paradigm is employed to evaluate the influence of various predictor variables, both cognitive and emotional, on this calculation. Results describing the findings' policy implications on preparedness and response efforts, such as what efforts are needed to keep people educated about terrorism and how that information should be directed, are included.",
				"extra": "major: Political Science Public Administration.\nCLC: 政治理论;",
				"language": "en-US",
				"libraryCatalog": "掌桥科研",
				"numPages": "191",
				"thesisType": "Doctoral dissertation",
				"university": "University of Southern California.",
				"url": "https://www.zhangqiaokeyan.com/academic-degree-foreign_mphd_thesis/0206149254.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/academic-degree-foreign_mphd_thesis/0206172122.html",
		"items": [
			{
				"itemType": "thesis",
				"title": "Design of an optical phantom for calibration of small animal fluorescence imagers.",
				"creators": [
					{
						"firstName": "Ghadiyaram, Ravi Krishna",
						"lastName": "Chaitanya",
						"creatorType": "author"
					}
				],
				"date": "2009",
				"abstractNote": "Small animal imaging is similar to fluorescence microscopy, which is an interesting and advancing technology in the clinical field to understand the cell structures, behavior, and functions inside a body. These studies have a limitation of the standard calibration techniques of the optical devices. Tissue phantoms are used to calibrate optical devices. These phantoms allow one to relate optical measurements of real tissue to established quantitative standards. Researchers working in this field have calibrated the phantom actively or passively. Previously there were no standard calibration techniques for small animal fluorescence imagers that were being proposed.;In this work, results are proposed in developing a tissue phantom which combines both active and passive components in a single phantom that are used to calibrate the imager, camera and the system as a whole for an optical device. Various plastics are selected based on their color resemblance to tissues. Studies of absorption, reflection and fluorescence properties of these plastics are estimated using the spectrometer assembly. LED's are equipped at the back of the phantom with a variable amount of voltage passing through them to calibrate the camera and system as a whole.",
				"extra": "major: Engineering Biomedical.;Engineering Chemical.\nCLC: 药物化学;",
				"language": "en-US",
				"libraryCatalog": "掌桥科研",
				"numPages": "82",
				"thesisType": "Master's thesis",
				"university": "University of South Alabama.",
				"url": "https://www.zhangqiaokeyan.com/academic-degree-foreign_mphd_thesis/0206172122.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/patent-detail/06120112145532.html",
		"items": [
			{
				"itemType": "patent",
				"title": "治疗脑内出血的组合物和方法",
				"creators": [
					{
						"firstName": "",
						"lastName": "S·阿金",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "J·弗鲁比斯",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "M·E·卡尔",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "S·赫特",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "R·贾舒亚",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "D·D·彼德曼",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2021-01-01",
				"abstractNote": "本公开提供了通过施用FXa变体治疗或预防对象脑内出血(ICH)的组合物和方法。",
				"applicationNumber": "CN202011260045.4",
				"assignee": "辉瑞公司",
				"country": "中国",
				"extra": "Genre: 发明专利",
				"filingDate": "2015-01-15",
				"patentNumber": "CN112156176A",
				"place": "中国",
				"url": "https://www.zhangqiaokeyan.com/patent-detail/06120112145532.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/patent-detail/06130400000018.html",
		"items": [
			{
				"itemType": "patent",
				"title": "Rotor for a brushless DC motor",
				"creators": [
					{
						"firstName": "Arthur-Richard",
						"lastName": "Matyas",
						"creatorType": "inventor"
					},
					{
						"firstName": "Eugen",
						"lastName": "Kombowski",
						"creatorType": "inventor"
					},
					{
						"firstName": "Jie",
						"lastName": "Zhou",
						"creatorType": "inventor"
					}
				],
				"issueDate": "2020-05-14",
				"abstractNote": "Rotor (1) für einen bürstenlosen Gleichstrommotor (2), zumindest aufweisend:- eine Mehrzahl von Rotorsegmente (3) zur Realisierung eines Magnetkreises, wobei die Rotorsegmente (3) ringförmig um eine Drehachse (4) des Rotors (1) angeordnet sind;- eine Mehrzahl von Rotormagnete (5), die zwischen den Rotorsegmenten (3) angeordnet sind; und- einen Rotorträger (6), der aus einem Blech (7) geformt ist und an einer Umfangsfläche (8) eine Mehrzahl von Haltelaschen (9) aufweist, mit denen die Rotorsegmente (3) an dem Rotorträger (6) befestigt sind.",
				"applicationNumber": "DE102018128369",
				"assignee": "Schaeffler Technologies AG & Co. KG",
				"country": "联邦德国",
				"filingDate": "2018-11-13",
				"patentNumber": "DE102018128369A1",
				"place": "联邦德国",
				"url": "https://www.zhangqiaokeyan.com/patent-detail/06130400000018.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/book-cn/081501284188.html",
		"items": [
			{
				"itemType": "book",
				"title": "医疗废水：特征、管理、处理与环境风险",
				"creators": [
					{
						"firstName": "",
						"lastName": "维里察",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"ISBN": "9787122419781",
				"abstractNote": "本书由3大部分12章构成，第一部分（1~5章）全面分析了医疗废水的全球监管概况、常规/微量污染物的浓度范围及废水的生态毒性和环境风险评估；三类常见药物（抗生素、细胞抑制剂和X射线造影剂）出现和潜在的环境影响；通过直接测量和预测模型评估医院流出物浓度和负荷的准确性及不确定性。第二部分（6~9章）主要论述了医疗废水的管理和处理，包括对医院流出物和城市废水对集水区药物负荷的贡献的评估，对不同国家采用的处理方法的分析，以及亚洲、非洲和澳洲的医疗废水处理现状。第三部分（10~12章）系统分析了已投入使用的医疗废水处理工程和旨在改善实验室/中试研究的目标污染物去除的前瞻技术；总结了关于医疗废水的产生、管理和处理的意见，并提出未来的研究前景。本书对水处理行业研究人员、工程设计人员以及各级医院和医疗机构的管理人员有较大的参考价值。",
				"extra": "creatorsExt: [{\"firstName\":\"\",\"lastName\":\"维里察\",\"creatorType\":\"author\",\"country\":\"意\",\"original\":\"Verlicchi Paola\",\"fieldMode\":1}]",
				"language": "zh-CN",
				"libraryCatalog": "掌桥科研",
				"numPages": "205",
				"place": "北京",
				"publisher": "化学工业出版社",
				"url": "https://www.zhangqiaokeyan.com/book-cn/081501284188.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/book-foreign/081603328217.html",
		"items": [
			{
				"itemType": "book",
				"title": "Bead embroidery jewelry projects : design and construction, ideas and inspiration",
				"creators": [
					{
						"firstName": "Eakin Jamie",
						"lastName": "Cloud",
						"creatorType": "author"
					}
				],
				"date": "2013",
				"ISBN": "9781454708155",
				"libraryCatalog": "掌桥科研",
				"numPages": "-",
				"place": "Asheville",
				"publisher": "Lark Jewelry and Beading",
				"shortTitle": "Bead embroidery jewelry projects",
				"url": "https://www.zhangqiaokeyan.com/book-foreign/081603328217.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/search.html?doctypes=4_5_6_1-0_4-0_1_2_3_7_9&sertext=%E5%B0%8F%E9%BA%A6&option=",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/ntis-science-report_ad_thesis/020713.html",
		"items": [
			{
				"itemType": "report",
				"title": "Scheduling Mission-Critical Flows in Congested and Contested Airborne Network Environments.",
				"creators": [
					{
						"firstName": "Mastronarde",
						"lastName": "N",
						"creatorType": "author"
					}
				],
				"date": "2018",
				"language": "en-US",
				"libraryCatalog": "掌桥科研",
				"pages": "1-109",
				"reportType": "科技报告",
				"url": "https://www.zhangqiaokeyan.com/ntis-science-report_ad_thesis/020713.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/national-defense-report_PAPER_thesis/ENOSCRIP_000006065.html",
		"items": [
			{
				"itemType": "report",
				"title": "Demographic, Bio-Psychological and Socio-Economic Factors Associated with Recidivism at a Central Prison in Zimbabwe",
				"creators": [
					{
						"firstName": "Virgininia",
						"lastName": "Dube-Mawerewere",
						"creatorType": "author"
					},
					{
						"firstName": "Gabriel Machinda",
						"lastName": "Chiborise",
						"creatorType": "author"
					}
				],
				"date": "2017",
				"abstractNote": "The purpose of this study was to determine factors associated with recidivism at a Central Prison in Zimbabwe. A descriptive quantitative cross sectional survey was done. Purposive sampling was used to draw respondents for the study. Data were collected from 30 inmates who had been re-imprisoned. A structured interview was used to collect data. The results revealed that a confluence of complex demographic, biological, economic, social and psychological factors was responsible for occurrence of recidivating or habitual relapse into crime. A recommendation calling for the Zimbabwe Prisons and Correctional Services to introspect, redefine its operations and refocus its mandate while collaborating with other organizations to intensify rehabilitation and re-integration programmes in prisons was projected.",
				"language": "en-US",
				"libraryCatalog": "掌桥科研",
				"reportType": "科技报告",
				"url": "https://www.zhangqiaokeyan.com/national-defense-report_PAPER_thesis/ENOSCRIP_000006065.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "Bio-Psychological"
					},
					{
						"tag": "Central Prison"
					},
					{
						"tag": "Correctional Service"
					},
					{
						"tag": "Factors"
					},
					{
						"tag": "Factors"
					},
					{
						"tag": "Recidivism"
					},
					{
						"tag": "Socio-Economic"
					},
					{
						"tag": "Zimbabwe Prison &"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/journal-foreign-928/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.zhangqiaokeyan.com/conference-foreign-226/",
		"items": "multiple"
	}
]
/** END TEST CASES **/
