{
	"translatorID": "441ffe59-2049-41b1-8ead-7a3a53f7d0bd",
	"label": "Soopat",
	"creator": "Xingzhong Lin, jiaojiaodubai",
	"target": "^https?://(www|plus)\\.soopat\\.com",
	"minVersion": "1.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-12-24 09:40:26"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Xingzhong Lin, https://github.com/Zotero-CN/translators_CN 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>
	
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
	// “世界专利搜索”的URL有/Patent/，应加以区分
	if (/\/patent\//i.test(url) && doc.querySelector('.detailtitle')) {
		return 'patent';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	// h2 > a[href*="/Patent/"]：搜索式、两栏式、只搜外观
	// .booktable li:first-child > a[href*="/Patent/"]：多图式
	// #PageContent > table td > a[href*="/Patent/"]：表格式
	// 同时支持“中国专利搜索”、“世界专利搜索”、“专利分类查询”、“专利引用检索”、“专利族检索”
	const rows = doc.querySelectorAll('h2 > a[href*="/Patent/"],.booktable li:first-child > a[href*="/Patent/"],#PageContent > table td > a[href*="/Patent/"]');
	for (const row of rows) {
		const href = row.href;
		let title = ZU.trimInternal(row.textContent);
		if (row.parentElement && row.parentElement.parentElement && row.parentElement.parentElement.tagName == 'UL') {
			title = ZU.trimInternal(row.parentElement.parentElement.textContent);
		}
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	// 详情页需要运行JS，无法在Scaffold中调试多条目页面
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
	const newItem = new Z.Item('patent');
	const labels = new Labels(doc, '.datainfo > tbody > tr > td,#PatentContentTable > tbody > tr');
	const extra = new Extra();
	newItem.title = cleanTitle(doc.querySelector('.detailtitle > h1'));
	extra.set('original-title', cleanTitle(doc.querySelector('.detailtitle > h1+h1')), true);
	newItem.abstractNote = labels.get(['摘要', 'Abstract']);
	newItem.assignee = ZU.capitalizeName(labels.get('申请人'));
	newItem.patentNumber = attr(doc, '#qrpatent', 'pn') || labels.get('公开号');
	const filingInfo = text(doc, '.detailtitle > :last-child');
	newItem.applicationNumber = tryMatch(filingInfo, /申请号：([\d.]+)/, 1);
	newItem.place = newItem.country = patentCountry(newItem.patentNumber || newItem.applicationNumber);
	newItem.filingDate = strToISO(tryMatch(filingInfo, /申请日：([\d-]+)/, 1));
	newItem.issueDate = strToISO(labels.get('公开日'));
	newItem.legalStatus = text(doc, '.stateico');
	newItem.url = tryMatch(url, /^.+\/Patent\/[^?#/]+/i);
	labels.get('发明\\(设计\\)人', true).querySelectorAll('a').forEach(elm => newItem.creators.push(cleanAuthor(elm.textContent)));
	labels.get('代理人', true).querySelectorAll('a').forEach(elm => newItem.creators.push(cleanAuthor(elm.textContent, 'attorneyAgent')));
	labels.get('Inventor').split(/;\s?/).forEach((name) => {
		const creatorEn = cleanAuthor(ZU.capitalizeName(name.replace(/\[.+?\]$/, '')));
		extra.push('original-author', `${creatorEn.firstName} || ${creatorEn.lastName}`, true);
	});
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	const remoteLink = doc.querySelector('.mix > a[href*="/DownloadRemote?"]');
	Z.debug(`direct download link: ${!!remoteLink}`);
	if (remoteLink) {
		Z.debug(`direct download link: ${remoteLink.href}`);
		newItem.attachments.push({
			url: remoteLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	else if (doc.querySelector('.mix > a[href="#this"]')) {
		const path = tryMatch(attr(doc, '.mix > a[href="#this"]', 'onclick'), /'(.+)'/, 1);
		const choosePage = await requestDocument(path);
		choosePage.querySelectorAll('tr > td:nth-child(2)').forEach((elm) => {
			const title = ZU.trimInternal(elm.textContent).replace(/：$/, '');
			const nextTd = elm.nextElementSibling;
			if (title && nextTd) {
				const pdfLink = nextTd.querySelector('a');
				if (pdfLink) {
					Z.debug(`PDF url: ${pdfLink}`);
					newItem.attachments.push({
						url: pdfLink.href,
						title: title,
						mimeType: 'application/pdf'
					});
				}
			}
		});
	}
	newItem.extra = extra.toString();
	newItem.complete();
}


function cleanTitle(titleElm) {
	titleElm = titleElm.cloneNode(true);
	while (titleElm.querySelector(':not(sup):not(sub):not(i):not(b)')) {
		titleElm.removeChild(titleElm.querySelector(':not(sup):not(sub):not(i):not(b)'));
	}
	return ZU.capitalizeTitle(ZU.trimInternal(titleElm.innerHTML)).replace(/^\[[A-Z]{2}\](.+) - [A-Z]{2}\w+$/, '$1');
}

function strToISO(date) {
	return /\d{8}/.test(date)
		? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`
		: ZU.strToISO(date);
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
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

function cleanAuthor(creator, creatorType = 'inventor') {
	creator = ZU.cleanAuthor(creator, creatorType);
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	return creator;
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		const nodes = doc.querySelectorAll(selector);
		for (const node of nodes) {
			// avoid nesting
			// avoid empty
			if (node.querySelector(selector) || !/\S/.test(node.textContent)) continue;
			const elmCopy = node.cloneNode(true);
			// avoid empty text
			while (![1, 3, 4].includes(elmCopy.firstChild.nodeType) || !/\S/.test(elmCopy.firstChild.textContent)) {
				elmCopy.removeChild(elmCopy.firstChild);
				if (!elmCopy.firstChild) break;
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
		}
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.soopat.com/patent/201711256672?lx=",
		"items": [
			{
				"itemType": "patent",
				"title": "一种提高类PSE鸡胸肉肌原纤维蛋白凝胶品质的糖基化方法",
				"creators": [
					{
						"firstName": "",
						"lastName": "徐幸莲",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "卞光亮",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "韩敏义",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王虎虎",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "许玉娟",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "周光宏",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "邵士昌",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李德溅",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "徐冬涛",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					}
				],
				"issueDate": "2018-03-23",
				"abstractNote": "本发明公开了一种提高类PSE鸡胸肉肌原纤维蛋白凝胶品质的糖基化方法，该方法的步骤如下：(1)原材料处理；(2)肌原纤维蛋白的提取；(3)糖基化处理；(4)除糖处理；(5)凝胶制备获得蛋白凝胶。本发明使用的非酶湿法糖基化法对类PSE鸡胸肉进行处理，处理条件温和、均匀、无害；糖基化技术能够通过共价结合的形式对PSE鸡肉的肌原纤维蛋白进行改性，改变蛋白质的结构和加工特性，通过提高鸡胸肉肌原纤维蛋白凝胶的保水性和凝胶硬度，提高其凝胶品质和经济效益。",
				"applicationNumber": "201711256672.9",
				"assignee": "南京农业大学",
				"country": "中国",
				"extra": "original-title: Glycosylation method for improving PSE chicken breast myofibrillar protein gel quality\noriginal-author: Xu || Xinglian\noriginal-author: Bian || Guangliang\noriginal-author: Han || Minyi\noriginal-author: Wang || Huhu\noriginal-author: Xu || Yujuan\noriginal-author: Zhou || Guanghong\noriginal-author: Shao || Shichang",
				"filingDate": "2017-12-04",
				"legalStatus": "有权",
				"patentNumber": "CN107821989A",
				"place": "中国",
				"url": "https://www.soopat.com/patent/201711256672",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "申请公开",
						"mimeType": "application/pdf"
					},
					{
						"title": "授权文本",
						"mimeType": "application/pdf"
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
		"url": "https://www.soopat.com/Patent/201510870162?lx=FMSQ",
		"items": [
			{
				"itemType": "patent",
				"title": "捕猎器",
				"creators": [
					{
						"firstName": "",
						"lastName": "李丹",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2018-08-10",
				"abstractNote": "一种捕猎器，包括驱赶通道和储物仓，驱赶通道与储物仓之间设置有隔离门，隔离门以平动或转动的方式设置在驱赶通道和储物仓之间，隔离门的平动或转动均位于驱赶通道和储物仓的分割面所在的平面或曲面内。该捕猎器能够使得隔离门可靠关闭，避免猎物返回到驱赶通道中。",
				"applicationNumber": "201510870162.5",
				"assignee": "深圳市丹明科技有限公司",
				"country": "中国",
				"extra": "original-author:  ||",
				"filingDate": "2015-12-01",
				"legalStatus": "无权-未缴年费",
				"patentNumber": "CN105325396B",
				"place": "中国",
				"url": "https://www.soopat.com/Patent/201510870162",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "申请公开",
						"mimeType": "application/pdf"
					},
					{
						"title": "授权文本",
						"mimeType": "application/pdf"
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
		"url": "https://www.soopat.com/Home/Result?SearchWord=%E4%B8%89%E5%85%83&Country=CN&FMZL=Y&SYXX=Y&WGZL=Y&FMSQ=Y",
		"items": "multiple"
	}
]
/** END TEST CASES **/
