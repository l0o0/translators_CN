{
	"translatorID": "6dc5757f-12ad-4c72-bb50-8f7d93095601",
	"label": "doc.taixueshu",
	"creator": "jiaojiaodubai",
	"target": "^https?://doc\\.taixueshu\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-03-07 10:46:40"
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


function detectWeb(doc, url) {
	if (/\/journal\/\d+/.test(url)) {
		return 'journalArticle';
	}
	else if (url.includes('/patent/')) {
		return 'patent';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.search-content-h1 > a, a.content_list_title');
	for (let row of rows) {
		// TODO: check and maybe adjust
		let href = row.href;
		// TODO: check and maybe adjust
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
	let translator = Zotero.loadTranslator('web');
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);
	translator.setHandler('itemDone', (_obj, patchItem) => {
		patchItem.itemType = detectWeb(doc, url);
		item = patchItem;
	});
	await translator.translate();
	switch (item.itemType) {
		case 'journalArticle': {
			let extra = new Extra();
			item.volume = item.volume.replace(/\b0*/, '');
			item.issue = item.issue.replace(/\b0*/, '');
			item.pages = attr(doc, '.quoteBtn', 'data-page');
			item.DOI = ZU.cleanDOI(text(doc, '#basicInfor tr:last-child'));
			extra.set('citation', text(doc, '[data-type="4"] .source-num').slice(1, -1));
			try {
				let pubDoc = await requestDocument(attr(doc, 'a.periodical_name', 'href'));
				let labels = new CellLabels(pubDoc, '.modern_industry_list > div > div');
				Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
				item.ISSN = labels.getWith('ISSN');
				extra.set('original-title', text(pubDoc, '.tit_eng'), true);
				extra.set('IF', text(pubDoc, '.ppif-span > span:last-child'));
				extra.set('publicationTag', Array.from(pubDoc.querySelectorAll('.new-tag-box a')).map(element => ZU.trimInternal(element.textContent)).join(', '));
			}
			catch (error) {
				Z.debug(error);
			}
			item.extra = extra.toString();
			break;
		}
		case 'patent': {
			let labels = new CellLabels(doc, 'table.patent-table > tbody > tr > td');
			Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
			item.patentNumber = labels.getWith('公布号');
			item.applicationNumber = labels.getWith('申请\\(专利\\)号');
			item.place = item.country = patentCountry(item.patentNumber || item.applicationNumber);
			item.assignee = Array.from(doc.querySelectorAll('.common-infor-company a')).map(element => ZU.trimInternal(element.textContent)).join(', ');
			item.filingDate = labels.getWith('申请日');
			item.issueDate = labels.getWith('公告日');
			doc.querySelectorAll('.common-infor-author a').forEach((element) => {
				item.creators.push(ZU.cleanAuthor(ZU.trimInternal(element.textContent), 'inventor'));
			});
			item.legalStatus = text(doc, 'div#legalStatus table> tbody > tr:first-child > td:nth-child(2)');
			item.extra = `Grenre: ${labels.getWith('专利类型')}专利`;
			break;
		}
	}
	item.url = attr(doc, 'link[rel="canonical"]', 'href');
	item.libraryCatalog = '钛学术文献服务平台';
	item.creators.forEach((creator) => {
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
	});
	item.complete();
}

class CellLabels {
	constructor(doc, selector) {
		this.innerData = [];
		let cells = Array.from(doc.querySelectorAll(selector)).filter(element => !element.querySelector(selector));
		let i = 0;
		while (cells[i + 1]) {
			this.innerData.push([cells[i].textContent.replace(/\s*/g, ''), cells[i + 1]]);
			i += 2;
		}
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.getWith(aLabel, element));
			result = element
				? result.find(element => element.childNodes.length)
				: result.find(element => element);
			return result
				? result
				: element
					? document.createElement('div')
					: '';
		}
		let pattern = new RegExp(label);
		let keyValPair = this.innerData.find(element => pattern.test(element[0]));
		if (element) return keyValPair ? keyValPair[1] : document.createElement('div');
		return keyValPair
			? ZU.trimInternal(keyValPair[1].innerText)
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
			: undefined;
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
		"url": "https://doc.taixueshu.com/journal/20000079zhhlzz.html#origin=2",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "护士工作压力源及工作疲溃感的调查研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘彦君",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李小妹",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2000",
				"ISSN": "0254-1769",
				"abstractNote": "“护士工作压力源及工作疲溃感的调查研究”出自《中华护理杂志》期刊2000年第11期文献，主题关键词涉及有护士、工作压力源、工作疲溃感等。钛学术提供该文献下载服务。",
				"extra": "original-title: Chinese Journal of Nursing\ncitation: 1948\nIF: 7.2411\npublicationTag: CSCD, JST, CSTPCD",
				"issue": "11",
				"language": "zh-CN",
				"libraryCatalog": "钛学术文献服务平台",
				"pages": "645-649",
				"publicationTitle": "中华护理杂志",
				"url": "https://doc.taixueshu.com/journal/20000079zhhlzz.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "工作压力源"
					},
					{
						"tag": "工作疲溃感"
					},
					{
						"tag": "护士"
					},
					{
						"tag": "护士工作压力源及工作疲溃感的调查研究"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://doc.taixueshu.com/patent/CN203729369U.html",
		"items": [
			{
				"itemType": "patent",
				"title": "发动机隔板及发动机",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘鹏",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陶红春",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王浩",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2014-07-23",
				"abstractNote": "“发动机隔板及发动机”专利由刘鹏、 陶红春、 王浩共同发明。本实用新型提供一种发动机隔板及发动机，属于发动机领域。钛学术提供该文献下载服务。",
				"applicationNumber": "CN201420070547.4",
				"assignee": "中国北车集团沈阳机车车辆有限责任公司, 中车沈阳机车车辆有限公司",
				"country": "中国",
				"extra": "Grenre: 实用型专利",
				"filingDate": "2014-02-18",
				"language": "zh-CN",
				"legalStatus": "暂无",
				"patentNumber": "CN203729369U",
				"place": "中国",
				"url": "https://doc.taixueshu.com/patent/CN203729369U.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "发动机隔板及发动机"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://doc.taixueshu.com/search?sourceType=PAT&keywordType=1&keyword=%E5%8F%91%E5%8A%A8%E6%9C%BA&resultSearch=0",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://doc.taixueshu.com/adv-search/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://doc.taixueshu.com/journal/hgxb_ti/",
		"items": "multiple"
	}
]
/** END TEST CASES **/
