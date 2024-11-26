{
	"translatorID": "be4556e0-01aa-433e-8988-a428b51b19c3",
	"label": "CNKI TIKS",
	"creator": "jiaojiaodubai",
	"target": "^https?://(kjqy|kc)\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-14 03:02:44"
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

const typeMAp = {
	journalArticle: '刊名',
	patent: '专利',
	standard: '标准号',
	report: '成果完成人',
	conferencePaper: '会议',
	thesis: '学位',
	newspaperArticle: '报纸名称',
	bookSection: '年鉴',
	statute: '发文字号'
};

function detectWeb(doc, url) {
	const results = doc.querySelector('.search-result, .main-view');
	if (results) {
		Z.monitorDOMChanges(results, { subtree: true, childList: true });
	}
	if (/\/article?.*id=/i.test(url)) {
		return Object.keys(typeMAp).find(key => ZU.xpath(doc, `//span[@class="label"][contains(text(), "${typeMAp[key]}")]`).length);
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('[data-col-key="TI"] > span > a');
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
			await scrape(await requestDocument(url), url);
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	let newItem = new Z.Item(detectWeb(doc, url));
	const extra = new Extra();
	newItem.title = text(doc, '.article-content > h3');
	let info = await requestJSON('https://kc.cnki.net/api/articleabstract/info', {
		method: 'POST',
		headers: {
			Accept: 'application/json, text/plain, */*',
			'Content-Type': 'application/json;charset=UTF-8',
			'Ot-Hy-Flag': 0,
			'X-XSRF-TOKEN': tryMatch(doc.cookie, /XSRF-TOKEN=([\w-]+)/, 1),
			Referer: url
		},
		body: JSON.stringify({ id: tryMatch(url, /id=([^&#]+)/i, 1) })
	});
	Z.debug(info);
	info = info.data;
	function metadata(mainKey, list = false) {
		const result = info.metadata.find(obj => obj.key == mainKey);
		return result
			? list
				? result.list
				: result.value
			: list
				? []
				: '';
	}
	try {
		// throw new Error('debug');
		const doi = attr(doc, 'span.doi > a', 'href') || metadata('DOI');
		Z.debug(`DOI: ${doi}`);
		newItem = await scrapeSearch(doi);
	}
	catch (error) {
		Z.debug(`failed to use search translator.`);
		Z.debug(error);
		const citation = info.citationFormat
			? info.citationFormat[Object.keys(info.citationFormat).find(key => key.includes('GB/T'))]
			: '';
		Z.debug(citation);
		newItem.title = info.title;
		newItem.abstractNote = metadata('AB').replace(/(\s)+/g, '$1');
		switch (newItem.itemType) {
			case 'journalArticle':
				newItem.publicationTitle = metadata('LY');
				newItem.volume = tryMatch(citation, /\d{4},\s?0*(\d+)\(/, 1) || metadata('JU');
				newItem.issue = tryMatch(citation, /\(0*(\d+)\)/, 1);
				newItem.pages = metadata('PAGE');
				newItem.date = metadata('YE');
				info.authors.forEach((creator) => {
					newItem.creators.push(cleanAuthor(creator.value, 'author'));
				});
				break;
			case 'patent':
				extra.set('Genre', metadata('PTN'), true);
				newItem.assignee = metadata('SQR');
				newItem.patentNumber = metadata('GKH');
				newItem.applicationNumber = metadata('SQH');
				newItem.place = newItem.country = patentCountry(newItem.patentNumber || newItem.applicationNumber);
				newItem.filingDate = metadata('AD');
				newItem.issueDate = metadata('PD');
				metadata('AU', true).forEach((creator) => {
					newItem.creators.push(cleanAuthor(creator.value, 'inventor'));
				});
				newItem.rights = metadata('ZQX');
				break;
			case 'standard':
				newItem.number = metadata('BZH').replace(/(\d)-(\d)/, '$1—$2');
				newItem.date = metadata('RD');
				// 缺归口单位
				extra.set('applyDate', metadata('OD'));
				extra.set('CCS', metadata('SLC'));
				extra.set('ICS', metadata('CLZ'));
				newItem.numPages = metadata('OP');
				break;
			case 'report':
				newItem.reportType = '科技报告';
				newItem.institution = metadata('AF');
				newItem.date = metadata('YE') || metadata('RKNF');
				metadata('AU', true).forEach((creator) => {
					newItem.creators.push(cleanAuthor(creator.value));
				});
				extra.set('achievementType', metadata('LBMC'));
				break;
			case 'conferencePaper':
				newItem.date = metadata('PT');
				newItem.conferenceName = metadata('LY');
				newItem.place = metadata('AD');
				newItem.pages = metadata('PM');
				info.authors.forEach((creator) => {
					newItem.creators.push(cleanAuthor(creator.value, 'author'));
				});
				break;
			case 'thesis':
				newItem.thesisType = info.repository.resource == 'EKRCDFD'
					? '硕士学位论文'
					: '博士学位论文';
				newItem.university = metadata('LY');
				// 缺年份
				newItem.numPages = metadata('PAGEC');
				extra.set('major', metadata('SN'));
				info.authors.forEach((creator) => {
					newItem.creators.push(cleanAuthor(creator.value, 'author'));
				});
				metadata('TUS').split(/[;，；]\s?/).forEach((creator) => {
					newItem.creators.push(cleanAuthor(creator, 'contributor'));
				});
				break;
			case 'newspaperArticle':
				newItem.publicationTitle = metadata('LY');
				newItem.date = metadata('PT');
				newItem.pages = metadata('PV').replace(/0*(\d+)/, '$1');
				info.authors.forEach((creator) => {
					newItem.creators.push(cleanAuthor(creator.value, 'author'));
				});
				break;
			case 'bookSection':
				newItem.bookTitle = metadata('LY');
				newItem.date = metadata('YE');
				newItem.pages = metadata('PPM');
				info.authors.forEach((creator) => {
					newItem.creators.push(cleanAuthor(creator.value.replace(/\s?[总主参]编$/, ''), 'editor'));
				});
				break;
			case 'statute':
				if (newItem.title.startsWith('中华人民共和国')) {
					newItem.shortTitle = newItem.title.substring(7);
				}
				newItem.abstractNote = metadata('ZWKZ').replace(/(\s)+/g, '$1');
				newItem.publicLawNumber = metadata('FWZH');
				newItem.dateEnacted = metadata('PBT');
				extra.set('applyDate', metadata('OT'));
				if (!metadata('XLJB').includes('法律')) extra.set('Type', 'regulation', true);
				if (metadata('SXX') == '已失效') extra.set('Status', '已废止');
				info.aff.forEach((creator) => {
					newItem.creators.push(cleanAuthor(creator.value, 'author'));
				});
				break;
		}
		if (ZU.fieldIsValidForType('DOI', newItem.itemType)) {
			newItem.DOI = metadata('DOI');
		}
		else {
			extra.set('DOI', metadata('DOI'), true);
		}
	}
	extra.set('album', metadata('CLJ'));
	extra.set('CLC', metadata('CLC'));
	extra.set('download', metadata('DFR'));
	extra.set('CNKICite', tryMatch(text(doc, '.quote'), /\d+/));
	extra.set('filename', info.fileName);
	extra.set('dbname', info.repository.resource.slice(-4));
	extra.set('dbcode', info.repository.dataset.substring(4));
	const attachment = info.relations.reverse().find(obj => ['PDF', 'CAJ'].includes(obj.scope));
	newItem.attachments.push(attachment
		? {
			url: attachment.url,
			title: `Full Text ${attachment.scope}`,
			mimeType: `application/${attachment.scope.toLowerCase()}`
		}
		: {
			title: 'Snapshot',
			document: doc
		}
	);
	newItem.tags = metadata('KY', true).map(obj => obj.value);
	const toc = info.co;
	if (toc) newItem.notes.push('<h1>Table of Contents</h1>' + toc);
	newItem.extra = extra.toString(newItem.extra);
	newItem.complete();
}

async function scrapeSearch(doi) {
	let item = {};
	if (!doi) throw new ReferenceError('no identifier available');
	const translator = Zotero.loadTranslator('search');
	translator.setSearch({ DOI: doi });
	translator.setHandler('translators', (_, translators) => {
		translator.setTranslator(translators);
	});
	translator.setHandler('itemDone', (_, patchItem) => {
		item = patchItem;
	});
	translator.setHandler('error', () => { });
	await translator.getTranslators();
	await translator.translate();
	return item;
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

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function cleanAuthor(creator, creatorType = 'author') {
	creator = ZU.cleanAuthor(creator, creatorType);
	if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	return creator;
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
		"url": "https://kc.cnki.net/detail/article?id=+65CzYatVkPphjNI3d5Se3ZRZsD0epgTIFTgiN0KvS8TBpZBufJVc5nP8Gx0OnKo/2bYRuTrDL0PSLBa771nqEy2Yneose9abBCdZtTero7p21YEEzqcKCd1OHr2qZz0eAUTkFcZztUZNKEXCvGU+JACNavVFF/gOAJHy/F/e4OxtTwb9ksTG7IE3EB2bUwTHqGFof0rEVasRo0iMgXAihH7ZAfBsWEHbbo06SkBTS/Huq8B5UMvCwj9DJPJMeu8TX/pD9hILf6sHns1uCZ0+MkDgbawUN+uAeNOHFyS2Nw0g7kxPUquky0saJeCykXxsQPwQqPZax89VO0q5SlDtu/ETK6OSiVwtsHl3Dt5jHiIJ1WyzlOVaygqlayNTLkSye7LUHNCLKMZR1a6UxQVaw==",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "非金属阳离子水系二次电池研究进展",
				"creators": [
					{
						"firstName": "",
						"lastName": "詹世英",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "于东旭",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈楠",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杜菲",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021",
				"DOI": "10.19799/j.cnki.2095-4239.2021.0228",
				"abstractNote": "水系电池以其安全性高、环境友好、离子导电率高等优点,在规模储能领域展现出良好的应用前景。电荷载流子是二次电池关键的组成部分,决定着电池的机制和性能。相较于被广泛研究的金属离子作为载流子的二次电池,以非金属阳离子,如NH<sub>4</sub><sup>+</sup>、H<sup>+</sup>、H<sub>3</sub>O<sup>+</sup>,作为电荷传输载体的研究却相对较少。与金属离子作为载流子相比,非金属离子载流子通常具有更小的水合离子半径、更低的摩尔质量,因此往往展现出更高的扩散速率与较长的循环寿命,且其制造成本更为低廉。然而,开发适于储存非金属离子的电极材料仍面临诸多挑战。本文对近几年相关研究报道进行总结。首先,介绍并讨论了非金属离子与金属离子作为载流子之间的差异;随后,总结了基于质子、水合氢离子、铵根离子和其他非金属载流子水系电池的最新研究进展;重点分析了由非金属离子存储所诱发新的电池化学与反应机制。最后,综合分析,认为通过材料结构优化工程,并且扩大电解液的工作电压区间,是有效提升水系非金属离子电池性能的必要途径之一。",
				"extra": "album: 工程科技Ⅱ辑\nCLC: TM912\ndownload: 502\nCNKICite: 3\nfilename: cnkx202106031\ndbname: CJFD\ndbcode: CJFDLAST2021",
				"issue": "6",
				"libraryCatalog": "CNKI TIKS",
				"pages": "278-289",
				"publicationTitle": "储能科学与技术",
				"volume": "10",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "水系电池"
					},
					{
						"tag": "电极材料"
					},
					{
						"tag": "电池化学"
					},
					{
						"tag": "结构优化"
					},
					{
						"tag": "非金属载流子"
					}
				],
				"notes": [
					"<h1>Table of Contents</h1>1 质子水系电池<br/>2 水合氢离子水系电池<br/>3 铵根离子水系电池<br/>4 其他阳离子水系电池<br/>5 所面临的挑战及提升电池性能的方案<br/>&nbsp;&nbsp;5.1 不同非金属阳离子载流子的对比<br/>&nbsp;&nbsp;5.2 非金属阳离子水系电池发展的主要困境<br/>6 结论与展望"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kc.cnki.net/detail/article?id=PqMgm0hVeJ5JauEli4+7BBeKF5jC9KDmy6A3tGuMsNgXqS5jIBays+qruNPaD2zdRXM+yMPBLHGw9pwYiaCpVwn3Li6ScyEwRqdy1WQkSRTdSzjVG3WJ6E4w3z2XBDPKYWtTlYQbaNIh/hWSDQjgdeaygDOeSJKR3x0arJaD61N5WwO7wUuY7iTMwqysrrg6OtlDSn58sqLbqTf8/TQnl7Wn+lc/sUujJNWY46Kze/CtQlQubHTFKjo6aqLIfs4neLb1+PaCs6EqZ+Dlc5Smre2bnXlnOdeg4h8sEMzs0Y5pFbLxqeP2cdRUSkKP+34g5/ESfeIF22BQYCadwTy0Np5pcU+jQVkNIaDEqn1+Ucwc7HNmYqVxnICPKdR1W5kotS9u9yKZ+QodOX0qFFTyGlzkYSqkClXj+1iUKpiY0i9VdwK0u7+OVAwqFrFH66K4ra+aiBVuIG51NZ6zgWAOyuQf+KA5fjYmEF6KIjsn2aDY5OM30cbNZHmj8oLLxwT+BJONS4AjeB+qnFm9Etdwcg==",
		"items": [
			{
				"itemType": "patent",
				"title": "一种干湿球温度计",
				"creators": [
					{
						"firstName": "",
						"lastName": "戴聪",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "傅立新",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "汪迪文",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴加胜",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈善齐",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "彭博",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "采振东",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2024-02-27",
				"abstractNote": "本发明公布了一种干湿球温度计,它包括塔体,所述塔体的上方设置有风机,所述风机与电机电连接；所述风机的下方侧端依次设置有除水器和填料,所述填料的下端设置有集水箱,所述集水箱与循环管道连通,所述循环管道与水泵连通,所述循环管道的末端设置有喷嘴,所述喷嘴设置在百叶上；所述百叶的侧端设置有第一感温探头,所述循环管道上设置有第二感温探头。本发明提供一种干湿球温度计,设计巧妙,使用方便,保证读速的稳定性和准确性,可实时读取,并自动记录。",
				"applicationNumber": "CN201711410931.9",
				"assignee": "湖南元亨科技股份有限公司",
				"country": "中国",
				"extra": "Genre: 发明授权\nalbum: 工程科技Ⅰ辑\nCLC: G01N25/62;G01K11/02\nfilename: cn107966475b\ndbname: SCPD\ndbcode: SCPD202401",
				"filingDate": "2017-12-23",
				"patentNumber": "CN107966475B",
				"place": "中国",
				"rights": "1.一种干湿球温度计,它包括塔体(12),其特征在于,所述塔体(12)的上方设置有风机(2),所述风机(2)与电机(1)电连接；所述风机(2)的下方侧端依次设置有除水器(3)和填料(4),所述填料(4)的下端设置有集水箱(5),所述集水箱(5)与循环管道(7)连通,所述循环管道(7)与水泵(8)连通,所述循环管道(7)的末端设置有喷嘴(10),所述喷嘴(10)设置在百叶(9)上；所述百叶(9)的侧端设置有第一感温探头(11),所述循环管道(7)上设置有第二感温探头(6)；所述喷嘴(10)与填料(4)横向方向上间距设置；所述填料(4)与除水器(3)横向方向间距设置；所述填料(4)的与集水箱(5)纵向方向间距设置。",
				"attachments": [
					{
						"title": "Full Text PDF",
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
		"url": "https://kc.cnki.net/detail/article?id=FKzHkzrFWW7fZf0m+nwTGhjHtlM0YqbV5Wh3kP0w53EhLxphaRV4DX7+90nw9cpcC3KCtodP+AWCSfDU/eyFqQHh8YJRIo9KvWt9tl52Ijqp3E1zY48MTFfycSEOr4bGNNwP0x6r9MD6OaxSOQQK4lVy2ZyQ+B0iCZYVi6IWJ4splGVbgIpkp4FaJJm+3h3QbS56SbtKjG1UqNFpHThj2zEP+Y3f3YxfQrs2YvZ4+1P78bJ+n0YdHSf89R/erQypnrN29xD//JOdPh/FdSTKGJgUVvFmLw7dIYllM+5dbQ91dEl70wHHetePdIO+jiAWK6+kbhw1crpRFMVN6JAbxXnffg9DCsJ68XjUJalX5vrqzP1ggWIvzuviGd89Nzia",
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献　参考文献著录规则",
				"creators": [],
				"date": "2015-05-15",
				"extra": "applyDate: 2015-12-01\nCCS: A14\nICS: 01_140_20\nCNKICite: 235\nfilename: scsf00045714\ndbname: SCSF\ndbcode: SCSF",
				"libraryCatalog": "CNKI TIKS",
				"numPages": "28",
				"number": "GB/T 7714-2015",
				"attachments": [
					{
						"title": "Full Text PDF",
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
		"url": "https://kc.cnki.net/detail/article?id=w3Kl2NZJ/QpT4d/p9IN68mPs+zLtTVZcpGdfVQ2y2etFO9lGmIC0lpGguty4oTMjdwYi5xEz5goGqBhu1pS26mVW7uBOugvVbBQ1eRM6EJNgdj+ImM89GUTtQpnr03bX5JUce3pQIZK5uwdhYHQLwVBY8mXVGGa24p+s8RWc4MQ/GJa98AuTmZ6yNsPvpVM50cofZdahiEdYXGjELWgztb5EWS62GhZ8j3Sd79MGmboA0JSsA44Qb19ElhAjdhBe1bqgbtZGQRaQoAMz2kke48z6CyXAz3SiTU76eYOtrmXxJYpdhjRWOcZGOGpvf5m1fM+ukmOD1h5eT8LYyeALuKGzimTiewh0LkLptUu1fI956g7SpM461+a7tGhPkZFnE1cpkrOSlyrVn7u0iE0NrLALDg3zEvOL0oGQscprEVM=",
		"items": [
			{
				"itemType": "report",
				"title": "航天微小型相机技术",
				"creators": [
					{
						"firstName": "",
						"lastName": "王新全",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "汲玉卓",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "夏玮玮",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "于祥凤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "潘冬宁",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "安佰秀",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "戚君仪",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "齐敏珺",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "于翠荣",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "于淏",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015",
				"abstractNote": "由青岛市光电工程技术研究院自主研究开发的航天微小型相机技术成果属于新一代信息技术产业,航空航天技术领域,主要应用于科学研究和技术服务业。 航天微小型相机技术是采用光学成像相机拍摄航天器太阳帆板展开、天线调整、机械臂动作等的动态图像,同时还可对航天器表面状况进行长期可视化监测,获取的图像资料可供技术人员进行深入研究,为监视航天器健康状况、改进太阳帆板设计、天线设计等提供非常有价值的资料,对提高航天器的安全性和可靠性意义重大。 该成果产品已进行了初样产品设计、生产和鉴定级试验,并获得了上海微小卫星应用中心的认可。暂未申请相关专利。",
				"extra": "achievementType: 应用技术\nalbum: 工程科技Ⅱ辑\nfilename: snad000001698916\ndbname: SNAD\ndbcode: SNAD",
				"institution": "青岛市光电工程技术研究院",
				"libraryCatalog": "CNKI TIKS",
				"reportType": "科技报告",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "大视场"
					},
					{
						"tag": "微型"
					},
					{
						"tag": "相机"
					},
					{
						"tag": "航天"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kc.cnki.net/detail/article?id=5VFSkZAor0u2+yuRSQNBKHCfvyZ61xE3d3RK0E1aAKglOjrPe3R7rVqqG4tOwfje2F9nOH6nbkr/64VkvkeA5xLrvwXc6NZ8QT13Qf0oRBhS0ibW8/9r9RdsrOJldflfRJGP0g8wDuI8oG/DuYtLbi7g0Dlq35tOUeVpt+MAYg2CZgIZMCLrgpk0AT9LvDoazJD8Fc0wP91ItwxwiqQDf8/nlsGYD566ygI48NOm6gkIzDliLOvIWLR3IMjdE1IjuDXhAcskBM9YYpnW5yLT9EGMAUmyerSGRhqnxPSRKrxzRZfFuBtVuNz33lER5E82YhBZxnq39wt+ErEae4moNN9oHulACKwhC1t97Zz331ztSSKcT4vTMHqdhj6U3qAvbD2h7i0YaGDuABXuTMjilFt7Fd6ZBEaO+OeG6NNB5ew9+pVtwgsOgr9LbT18ZcXfZ0zrL9mryePWl1AHsTrymQ==",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Ultrafast photocarrier dynamics in InAs/GaAs self-assembled quantum dots investigated via optical pump-terahertz probe spectroscopy",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "Vince Paul",
						"lastName": "Juguilon"
					},
					{
						"creatorType": "author",
						"firstName": "Deborah Anne",
						"lastName": "Lumantas-Colades"
					},
					{
						"creatorType": "author",
						"firstName": "Karim",
						"lastName": "Omambac"
					},
					{
						"creatorType": "author",
						"firstName": "Neil Irvin",
						"lastName": "Cabello"
					},
					{
						"creatorType": "author",
						"firstName": "Inhee",
						"lastName": "Maeng"
					},
					{
						"creatorType": "author",
						"firstName": "Chul",
						"lastName": "Kang"
					},
					{
						"creatorType": "author",
						"firstName": "Armando",
						"lastName": "Somintac"
					},
					{
						"creatorType": "author",
						"firstName": "Arnel",
						"lastName": "Salvador"
					},
					{
						"creatorType": "author",
						"firstName": "Alexander De Los",
						"lastName": "Reyes"
					},
					{
						"creatorType": "author",
						"firstName": "Chul-Sik",
						"lastName": "Kee"
					},
					{
						"creatorType": "author",
						"firstName": "Elmer",
						"lastName": "Estacio"
					}
				],
				"date": "2024-04-05",
				"DOI": "10.1088/1361-6463/ad1853",
				"ISSN": "0022-3727, 1361-6463",
				"abstractNote": "Abstract\n            Optical pump-terahertz probe (OPTP) spectroscopy was performed to measure the lifetime of photogenerated carriers in the barrier and the wetting layer (WL) regions of an indium arsenide on gallium arsenide (InAs/GaAs) single-layer self-assembled quantum dot (QD) sample. A modified rate equation model of carrier dynamics was proposed where possible state-filling in both QD and WL is considered. Drude model fitting was also performed to extract the time-dependent plasma frequency and phenomenological scattering time from the terahertz transmission spectra. The results of the OPTP experiment show two prominent recombination processes that occur at different timescales after photoexcitation. These two processes were attributed to carrier recombination in the GaAs barrier and the quantum well-like states of the WL based on the fitted lifetimes. Calculations using the coupled differential rate equations were also able to replicate the experimental trend at low fluence. The lack of agreement between experimental data and numerical calculations at high optical fluence was mainly attributed to the possible saturation of the GaAs density of states. Lastly, the results of the parameter fitting for the plasma frequency and scattering time indicate a transition from the barrier to the WL recombination as the dominant carrier recombination mechanism within the time scale of the OPTP scan. This further lends credence to the proposed model for carrier dynamics in SAQD systems under state-filling conditions.",
				"extra": "titleTranslation: 利用激光抽运-太赫兹波探测光谱研究了InAs/GaAs量子点中的超快光生载流子动力学\nfilename: sipd6e4c7b87ce0fec481b5e77688a7472ad\ndbname: WWJD\ndbcode: GARJ2021_4",
				"issue": "14",
				"journalAbbreviation": "J. Phys. D: Appl. Phys.",
				"libraryCatalog": "DOI.org (Crossref)",
				"pages": "145107",
				"publicationTitle": "Journal of Physics D: Applied Physics",
				"url": "https://iopscience.iop.org/article/10.1088/1361-6463/ad1853",
				"volume": "57",
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
		"url": "https://kc.cnki.net/detail/article?id=Op1GCewLIWRYlLTfiX8Q5Fs3+avBJeCFT3isEy3NjY324uV0FDSnxwahWfRqJ0mdYPkeOzsf9BaQcMtgC43PjfFT3QLcedoOSSrjCz0v1QhfzkABqJ2L1t/7HAjC4T4BmyfjD05ZPv8FVuQUqP8+LgpyIQNRa7DrkUbedVlD4JATkm2rRvyUNnX7fzqazlVDSrz3ZhNUofxT3MTYHsiT656tMLwnrJe8F3vDDsUG2sIAk4EZIw2Os+688k0fK60PW73WY8BMOq1VtH4PBcNCzgCZkgCiiEFCJpPQ34PUtgiBWVOJDrD3wZMyyLMc8JWfkSoxD/dEtPzm8GdECoaHe9CjtyDW4rZ//oiyor+ZRlEiV5D5LJnaXHdVaB+LO43E7U8kIvEHapiCkr8egmBJW4Ff7ZP9MA6Dz5lB8xIWrTU=",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "黑龙江黑土地保护性耕作效益影响因素研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "张红平",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-01-26",
				"DOI": "10.26914/c.cnkihy.2024.000547",
				"abstractNote": "黑龙江省是我国重要的粮食生产基地,黑土地是其主要的农业资源。然而,长期的过度开垦、不合理的耕作方式和化肥施用等导致了黑土地的退化和流失,严重影响了粮食生产和生态安全。为了保护和恢复黑土地,实现可持续农业发展,保护性耕作作为一种有效的土壤管理措施,在黑龙江省得到了广泛的推广和应用。本文基于黑龙江省12个地级市的农户调查数据,运用多元回归模型,分析了保护性耕作对黑土地的效益影响,以及影响保护性耕作效益的主要因素。结果表明,保护性耕作能够显著提高黑土地的肥力、水分和有机质含量,降低土壤侵蚀和农业投入,增加粮食产量和收入。影响保护性耕作效益的主要因素包括农户的教育水平、经验、信息获取渠道、政策支持、技术培训、机械化水平等。本文为黑龙江省推进保护性耕作提供了理论依据和政策建议。",
				"conferenceName": "东北四省区2024年水利学术年会暨水利先进技术（产品）推介会",
				"extra": "album: 农业科技;经济与管理科学\nCLC: F323.211\ndownload: 46\nCNKICite: 0\nfilename: bwts202401001034\ndbname: CPFD\ndbcode: CPFDTEMP",
				"libraryCatalog": "CNKI TIKS",
				"pages": "249-257",
				"place": "中国黑龙江哈尔滨",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "保护性耕作"
					},
					{
						"tag": "多元回归模型"
					},
					{
						"tag": "黑土地"
					}
				],
				"notes": [
					"<h1>Table of Contents</h1>1 研究的背景及意义<br/>&nbsp;&nbsp;1.1 研究背景<br/>&nbsp;&nbsp;1.2 研究的意义<br/>2 国内外研究现状<br/>&nbsp;&nbsp;2.1 国外研究现状<br/>&nbsp;&nbsp;2.2 国内研究现状<br/>3 研究内容<br/>4 概念界定和理论基础<br/>&nbsp;&nbsp;4.1 保护性耕地技术<br/>&nbsp;&nbsp;4.2 理论基础<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.2.1 可持续发展理论<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.2.2 规模经济理论<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.2.3 农户行为理论<br/>5 保护性耕作的主要技术<br/>&nbsp;&nbsp;5.1 黑龙江省黑土地保护性耕作模式<br/>&nbsp;&nbsp;5.2“梨树模式”保护性耕作效益分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.2.1 经济效益<br/>6 问卷设计与数据来源<br/>&nbsp;&nbsp;6.1 构建模型<br/>&nbsp;&nbsp;6.2 理论分析与变量选取<br/>&nbsp;&nbsp;6.3 结果分析<br/>7 结论<br/>&nbsp;&nbsp;7.1 对策建议及研究不足"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kc.cnki.net/detail/article?id=9WYvzzV69PrybFdGzD1gibgTrPpyn5AEqWETuS8ZZSZwLdA0FP70tfmOX2wlLvDqZLXKMEfPMdkW3o31bIAFxioPM17+Swsn39NqKkrDoC8+Wh2WNNHaUn5y5g4u9V5f/aVaeGRmni8k4hDLYK6kOSJyVmVYaFPnlsjYkkGSVbnXUZFChS4FWdZxVen4vr17VER04ALsX++bFneRQeqQlNxbRluqjU5HR4UmHtlkuKTAWfQvpPe2otBKzNhYW0wW3E5g/6K55U1UAD3pMDlQOW46QxLZJ0UvKLpvMCcFvEzOIEVIRAfYqZHq5XvDBjQ8bVstYOkiPeJx9ZY2Jmw3CNddIGuJ8ETKR5v++QLRsesZN2yxh8gB3KN7xJvlpCEXh8SgNKwtUSGyy1DLcVNFIbq66Aqo2Nv5oHFcNb1b5qk=",
		"items": [
			{
				"itemType": "thesis",
				"title": "多元主体共治背景下社会资本的环境效应研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "郭金",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "钟若愚",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"abstractNote": "环境可持续发展描绘了人类与自然和谐相处的美好形象,是人类发展的共同目标。然而,我们目前仍然面临一些挑战,包括气候变化、臭氧层损耗、生态退化以及生物多样性减少等环境问题。进入新时代,人民群众对优美生态环境的需要已成为社会主要矛盾的重要方面,党的二十大再次强调必须牢固树立和践行绿色理念,站在人与自然和谐共生的高度谋划发展。长期以来,我国的环境治理主要仰赖政府力量,但常常存在政府机制和市场机制双重失效的情况,生态环境保护事业的主体能力不足、缺乏协作。而社会资本强调人际间的信任、合作和沟通的重要性,恰恰促成了社会治理机制的达成,是突破集体行动困境的重要利器。那么,在多元主体共治背景下社会资本能否有效改善环境,成为突破环境治理困境的新出路,在现有研究中并未得到应有的关注,亦是本文的主旨所在。本研究在多元主体共治的环境治理大背景下,立足社会资本的宏观和微观视角,致力于厘清社会资本的环境效应,探索突破环境治理困境的有效路径。基于已有研究和经济学、社会学交叉领域的相关理论,文章首先从区域、企业和公众三个层面构建了社会资本影响环境的分析框架,以及其中的作用机制。进一步地,利用2010-2020年30个省份的面板数据、2011-2021年沪深A股上市公司的面板数据以及CGSS2018年社会综合调查数据,在理论研究的基础上,通过多种计量经济模型考察了社会资本的环境效应与作用机制。主要内容与结论如下:(1)运用文献梳理和理论推演的方法对社会资本、区域环境效率、企业环境责任和公众环境参与的关系进行了理论研究。本文通过梳理文献在对核心概念进行界定的基础上,系统回顾了嵌入-社会网络与社会资本理论、理性行动理论和重复博弈理论。进一步地,依据上述理论构建了社会资本影响环境的分析框架,及其作用机制框架,以此为后续地研究开展提供坚实地理论指导和路径指引。(2)基于社会资本的宏观视角,利用logistic模型实证检验社会资本对区域环境效率的影响,技术开发阶段和成果转化阶段的中介效应以及区域政府治理质量差异的调节效应。结果表明,社会资本对区域环境效率具有显著影响,且其对技术进步的影响更大。其次,创新水平在社会资本与环境效率的关系中起中介作用,相较于成果转化阶段(16.01%),技术开发阶段(23.45%)发挥地中介影响更为明显,侧面说明我国在科技成果转移转化方面还有待加强,要增强源头创新能力,畅通创新资源流动,强化技术与市场的联动。此外,社会资本作为非正式制度与政府管制的正式制度互为补充,高政府治理质量的区域更能从社会资本的积累中受益,且缺乏政府管制时,非正式制度的补充作用难以有效发挥。(3)基于社会资本的微观视角,利用双向固定效应模型和工具变量法实证检验企业社会资本对企业环境责任的影响,并进一步分析了政府行为的作用。结果表明,企业社会资本对企业环境履责具有显著的正向引导作用,从企业社会资本的三个维度来看,拥有政治关联的企业的环境履责积极性更高,董事网络关系和社会联系越丰富占据信息优势的企业环境履责情况越好。其次,政府行为的作用分析表明,企业社会资本的提升将强化政府补助等相关正式制度对企业的引导作用,有助于企业获得更多的政府资源支持,进而推动企业绿色经营。此外,异质性分析发现,社会资本对企业环境责任的影响存在企业层面和区域层面的异质性。(4)基于社会资本的微观视角,根据微观调查数据的不同特点,利用有序logit模型和左归并Tobit模型实证检验社会资本对公众环境参与的影响,及经济收入水平与环境认知能力的调节作用。结果表明,社会资本对我国公众环境参与具有积极的正向影响,不同维度的社会资本对公众环境参与的影响程度不同,但均具有积极作用。其次,对环境问题以及如何解决这些问题的深入认知,使公众更具有主人翁意识和社会责任感,增加了个人采取环保行动的可能性。随着收入水平的提高,个人环境参与意愿提高,但用于环境保护的边际支付意愿下降;且没有社会资本时,经济收入状况的改善并不能促进公众的环境参与。此外,异质性分析发现,社会资本的公众环境参与效应在东部地区要优于中西部地区,高收入群体相较低收入群体对环境保护的需求更大,但自评家庭经济状况远高于平均水平时,并不利于公众环境参与,这表明控制收入差距,提高中产阶级比例有利于改善社会环境偏好。(5)综合以上分析及检验,结合我国实际情况,从加强社会网络建设、构筑社会信任、形成互惠规范、重视社会资本和政府治理质量之间的匹配衔接、坚持创新驱动、提升环境认知水平、缩小贫富差距几方面提出建议。本文在以下方面进行了创新性尝试:一是结合经济学、社会学交叉领域的相关理论,把社会资本纳入环境问题的研究框架,丰富了现有研究环境问题的视角,完善了环境治理体系的理论框架。二是从多元主体共同治理这一重要环境治理体系构建层面出发,结合对已有研究成果的梳理归纳和总结,构建了社会资本的环境效应分析框架,从可持续发展整体框架入手提出了包含区域、企业和居民个人的社会资本环境效应分析框架,丰富了关于非正式制度经济后果的研究。三是使用多源异构数据从社会资本的宏观和微观角度实证考察了社会资本的环境效应,针对环境治理主体的异质性,基于社会资本的不同分析层次测度社会资本指标,分别考察了社会资本对区域环境效率、企业环境责任和公众环境参与的影响及其作用机制,增强了社会资本分析的可行性,有助于后续实证分析的完整性、结果的稳健性以及研究的深化与扩展。",
				"extra": "DOI: 10.27283/d.cnki.gsxcc.2023.001649\nmajor: 人口、资源与环境经济学\nalbum: 工程科技Ⅰ辑;经济与管理科学\nCLC: X321;F832.51\ndownload: 393\nCNKICite: 0\nfilename: 1024309183.nh\ndbname: CDFD\ndbcode: CDFDTEMP",
				"libraryCatalog": "CNKI TIKS",
				"numPages": "160",
				"thesisType": "硕士学位论文",
				"university": "山西财经大学",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "多元主体共治"
					},
					{
						"tag": "环境效应"
					},
					{
						"tag": "社会资本"
					},
					{
						"tag": "非正式制度"
					}
				],
				"notes": [
					"<h1>Table of Contents</h1>摘要<br/>ABSTRACT<br/>第1章 导论<br/>&nbsp;&nbsp;1.1 研究背景及意义<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.1.1 研究背景<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.1.2 研究意义<br/>&nbsp;&nbsp;1.2 研究内容与研究方法<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.2.1 研究内容<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.2.2 研究方法<br/>&nbsp;&nbsp;1.3 研究思路及技术路线<br/>&nbsp;&nbsp;1.4 研究的创新之处<br/>第2章 文献综述<br/>&nbsp;&nbsp;2.1 社会资本相关研究<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.1.1 社会资本的起源与发展<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.1.2 社会资本的分析层次<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.1.3 社会资本的测度<br/>&nbsp;&nbsp;2.2 区域环境效率相关研究<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.2.1 区域环境效率的界定<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.2.2 区域环境效率的影响因素<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.2.3 区域环境效率的测度<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.2.4 社会资本与区域环境效率<br/>&nbsp;&nbsp;2.3 企业环境责任相关研究<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.3.1 企业环境责任的界定<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.3.2 企业环境责任的影响因素<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.3.3 社会资本与企业环境责任的相关研究<br/>&nbsp;&nbsp;2.4 公众环保行为相关研究<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.4.1 公众亲环境行为的界定<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.4.2 公众环保行为的影响因素<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.4.3 社会资本与公众环保行为<br/>&nbsp;&nbsp;2.5 文献述评<br/>第3章 社会资本对环境影响的理论分析<br/>&nbsp;&nbsp;3.1 相关概念界定<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.1.1 社会资本<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.1.2 多元主体共治<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.1.3 环境效应<br/>&nbsp;&nbsp;3.2 理论基础<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.2.1 嵌入、社会网络与社会资本理论<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.2.2 理性行动理论<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.2.3 重复博弈理论<br/>&nbsp;&nbsp;3.3 分析框架<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.3.1 宏观社会资本影响区域环境效率的机制分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.3.2 企业社会资本影响企业环境履责的机制分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.3.3 个体社会资本影响公众环境参与的机制分析<br/>&nbsp;&nbsp;3.4 本章小结<br/>第4章 区域社会资本对区域环境效率的影响分析<br/>&nbsp;&nbsp;4.1 研究设计<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.1.1 数据来源与样本选择<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.1.2 变量设定<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.1.3 模型构建<br/>&nbsp;&nbsp;4.2 核心变量的测度与时空特征<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.2.1 社会资本的测度<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.2.2 环境效率的测度<br/>&nbsp;&nbsp;4.3 社会资本对区域环境效率的基准回归分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.3.1 数据描述性统计<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.3.2 基准回归分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.3.3 社会资本的不同维度与区域环境效率<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.3.4 稳健性检验<br/>&nbsp;&nbsp;4.4 创新水平与政府治理质量的作用分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.4.1 创新水平的中介效应检验<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.4.2 政府治理质量的调节效应检验<br/>&nbsp;&nbsp;4.5 本章小结<br/>第5章 企业社会资本对企业环境履责的影响分析<br/>&nbsp;&nbsp;5.1 研究设计<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.1.1 数据来源与样本选择<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.1.2 变量设定<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.1.3 模型构建<br/>&nbsp;&nbsp;5.2 社会资本对企业环境责任的基准回归分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.2.1 数据描述性统计<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.2.2 基准回归分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.2.3 稳健性检验<br/>&nbsp;&nbsp;5.3 政府行为的作用分析<br/>&nbsp;&nbsp;5.4 异质性分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.4.1 按所有权性质划分国有企业与非国有企业<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.4.2 按行业污染程度划分重污染企业与其他企业<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.4.3 按区域市场化程度划分高低<br/>&nbsp;&nbsp;5.5 本章小结<br/>第6章 个体社会资本对公众环境参与的影响分析<br/>&nbsp;&nbsp;6.1 研究设计<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.1.1 数据来源与样本选择<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.1.2 变量设定<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.1.3 模型构建<br/>&nbsp;&nbsp;6.2 社会资本对公众环境参与的基准回归分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.2.1 数据描述性统计<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.2.2 基准回归分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.2.3 社会资本的不同维度与公众环境参与<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.2.4 稳健性检验<br/>&nbsp;&nbsp;6.3 经济地位和环境认知能力的作用分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.3.1 经济收入水平的调节效应检验<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.3.2 环境认知能力的调节效应检验<br/>&nbsp;&nbsp;6.4 异质性分析<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.4.1 按地理区域划分东中西部<br/>&nbsp;&nbsp;&nbsp;&nbsp;6.4.2 按自评家庭经济状况划分高低<br/>&nbsp;&nbsp;6.5 本章小结<br/>第7章 结论与政策建议<br/>&nbsp;&nbsp;7.1 主要研究结论<br/>&nbsp;&nbsp;7.2 主要政策启示<br/>&nbsp;&nbsp;&nbsp;&nbsp;7.2.1 加强社会网络建设,疏通人际流、信息流、商品流等社会联通渠道<br/>&nbsp;&nbsp;&nbsp;&nbsp;7.2.2 提升市场化水平,构筑社会信任<br/>&nbsp;&nbsp;&nbsp;&nbsp;7.2.3 依托社区功能,形成互惠规范<br/>&nbsp;&nbsp;&nbsp;&nbsp;7.2.4 重视社会资本和政府治理质量之间的匹配衔接<br/>&nbsp;&nbsp;&nbsp;&nbsp;7.2.5 发展绿色技术,坚持创新驱动战略<br/>&nbsp;&nbsp;&nbsp;&nbsp;7.2.6 重视绿色教育和生态文化建设,提升环境认知水平<br/>&nbsp;&nbsp;&nbsp;&nbsp;7.2.7 扩大中等收入群体规模,缩小贫富差距<br/>&nbsp;&nbsp;7.3 进一步研究的方向<br/>参考文献"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kc.cnki.net/detail/article?id=cS11hQr8Vus+4Le7JPsyKJi8D96XMZz4HcuXe8olGz+qzrr9rYnYZfFqX90N9Bw6YfL1UMjNDcxat7WHWidOoGRe1FBeFJXW6snj+xBa8VdkOHOa27GSw7OjKmtmM6oKyXUmNhC3btzgv/5NlajVA03AiVlHu7CwwlkdIy2BemIXfwpAUyFI0iCf7CXhDzv7WloRphAhjDU7RAVUyQCJCKAftcw4eyVy7vzLXA1mkM1Lb0kCUNt5zzb1SpEQLITLZSAm/P3xKKp1ME1Bv4eLkVWCXjzH747tHmuDAAsJUuoGXCnre/MoyvjxaZ9uF5Fn9rLY173n015Ga+cRN5j0F9ciAaoZVMDkutsle4NuUaXMjgJpgSuCyU4avmlvU2f9viDlkx/sCFkIHSlQVCkR0Qof5fcvLzbkUU8Hm8NdSog=",
		"items": [
			{
				"itemType": "thesis",
				"title": "基层廉政建设的问题与对策研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "关莹",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "田玉麒",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"abstractNote": "基层廉政建设是全面推进党风廉政建设工作的重要环节,基层党风政风是否清正廉洁,既影响着基层党组织的公信力,也影响着党的群众基础。因此,如何深入推进基层廉政建设成为学界关注的重点问题。本文以J市L街道为研究对象,调查研究了L街道廉政建设现状,重点分析了L街道廉政建设具体措施:一是加强廉政教育;二是建立健全制度;三是强化监督执纪;四是做实做细巡察整改工作;五是发挥基层监督“前哨”作用。研究发现,L街道虽取得了一定的成绩,但仍存在着廉政生态建设受外部因素的侵扰、廉政制度建设不完善、廉政文化建设成效不明显、廉政监督机制不健全的问题,阻碍了基层廉政建设的发展。上述问题之所以产生,是由于廉政生态建设内生动力不足、廉政制度建设基础薄弱、廉政文化作用发挥不充分、廉政监督责任落实不到位的原因导致。为此,本文依托腐败治理理论和权力制衡理论,在国内外学者研究的基础上,结合实际,提出了适合L街道廉政建设的对策建议:一要汇聚多元监督力量,构建健康廉政生态;二要完善廉政制度建设,夯实管理基础;三要创新工作思路,强化廉政文化建设;四要聚焦监督重点,强化责任落实。街道作为推进基层廉政建设的重要阵地,本文对以J市L街道为代表的基层党组织廉政建设现状进行研究,希望能够为基层廉政建设提供一些有益的思路和建议,从而为推进基层治理提供坚强保障。",
				"extra": "DOI: 10.27162/d.cnki.gjlin.2023.007863\nmajor: 公共管理硕士（专业学位）\nalbum: 社会科学Ⅰ辑\nCLC: D262.6;D630\ndownload: 51\nCNKICite: 0\nfilename: 1023929507.nh\ndbname: CMFD\ndbcode: CMFDTEMP",
				"libraryCatalog": "CNKI TIKS",
				"numPages": "50",
				"thesisType": "博士学位论文",
				"university": "吉林大学",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "基层廉政建设"
					},
					{
						"tag": "廉政制度建设"
					},
					{
						"tag": "廉政文化建设"
					},
					{
						"tag": "廉政生态建设"
					},
					{
						"tag": "廉政监督机制"
					}
				],
				"notes": [
					"<h1>Table of Contents</h1>中文摘要<br/>abstract<br/>绪论<br/>&nbsp;&nbsp;(一)研究背景<br/>&nbsp;&nbsp;(二)选题意义<br/>&nbsp;&nbsp;(三)国内外研究现状<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.国外研究现状<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.国内研究现状<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.研究现状评述<br/>&nbsp;&nbsp;(四)研究内容<br/>&nbsp;&nbsp;(五)研究方法<br/>&nbsp;&nbsp;(六)论文的创新点与不足<br/>一、基本概念与理论基础<br/>&nbsp;&nbsp;(一)基本概念<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.廉政<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.廉政建设<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.基层廉政建设<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.腐败<br/>&nbsp;&nbsp;(二)理论基础<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.腐败治理理论<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.权力制衡理论<br/>二、J市L街道廉政建设的实践举措<br/>&nbsp;&nbsp;(一)J市L街道简介<br/>&nbsp;&nbsp;(二)J市L街道廉政建设的具体措施<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.以廉政教育为先导,巩固宗旨意识<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.以建立健全制度为依托,抓好源头预防<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.以强化监督执纪为根本保障,持续正风肃纪反腐<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.做实做细巡察整改工作<br/>&nbsp;&nbsp;&nbsp;&nbsp;5.建立联动机制,充分发挥基层监督“前哨”作用<br/>三、J市L街道廉政建设存在的问题及成因<br/>&nbsp;&nbsp;(一)J市L街道廉政建设存在的问题<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.廉政生态建设受外部因素侵扰<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.廉政制度建设不完善<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.廉政文化建设成效不明显<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.廉政监督机制不健全<br/>&nbsp;&nbsp;(二)J市L街道廉政建设存在的问题成因<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.廉政生态建设内生动力不足<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.廉政制度建设基础薄弱<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.廉政文化作用发挥不充分<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.廉政监督责任落实不到位<br/>四、J市L街道推进廉政建设的对策建议<br/>&nbsp;&nbsp;(一)汇聚多元监督力量,构建健康廉政生态<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.夯实监督基础,提升内生动力<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.加强部门联动,形成监督合力<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.发动群众监督,织密监督网络<br/>&nbsp;&nbsp;(二)完善廉政制度建设,夯实管理基础<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.强化制度体系建设,提升工作质效<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.强化制度意识,提高制度执行力<br/>&nbsp;&nbsp;(三)创新工作思路,强化廉政文化建设<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.强化教育引导,提高思想认识<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.夯实文化阵地建设,打响社区文化品牌<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.汲取传统文化精髓,丰富廉政文化内涵<br/>&nbsp;&nbsp;(四)聚焦监督重点,强化责任落实<br/>&nbsp;&nbsp;&nbsp;&nbsp;1.找准定位,加强同级监督<br/>&nbsp;&nbsp;&nbsp;&nbsp;2.把好选拔任用关口,优化干部队伍<br/>&nbsp;&nbsp;&nbsp;&nbsp;3.培养调查研究能力,提高综合素质<br/>&nbsp;&nbsp;&nbsp;&nbsp;4.精准运用“四种形态”,提升监督问责成效<br/>结论<br/>参考文献"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kc.cnki.net/detail/article?id=Gdq2ZkEbySCS+jbPS+bIIC2fANueD5Ni3aplDcbimeEu7EOA4txEXGSFdlBErYaYXTrFKQdSPLQmrdZxdgPO/q765H6Ic9tzV2gTaHAEQa10/NxYYfWXJUichUdVUkQIS2Cg4USnynfjy4mZRNL8xHdkSWYEZxDIy1Nng13KaXXJCtheZCp623j8l8a1Q5ePv3Q2jBKtXnvBVstPRcxEMw5i3yJhjloiy7KQUKJER3+IpvdQ4IhN6duID+Ro0wgXm+5yoRHYZc2epmC+yE9uvkPg2tMh7I8YS4Kf//d59AITTMk6wOi6ZwV8bCFi8KYHADyQWlDzw0P2uGTtcpiL3iJjxrsaXRdahKn/m+EXHI3iZ4iVHbnYmjV77UhIYIhMwc+NPGeOXrEsvrXgA601XO1YHRJ4Eqwgo69KNi6x36g=",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "粤港澳大湾区国际科技创新中心：“合聚变”激发澎湃科创力量",
				"creators": [
					{
						"firstName": "",
						"lastName": "叶青",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "罗云鹏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "龙跃梅",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-03-07",
				"abstractNote": "“2019年2月，《粤港澳大湾区发展规划纲要》正式发布。4月，我和香港科技大学霍英东研究院（以下简称霍英东研究院）签了合同，决定来到广州南沙，在粤港澳大湾区工作。”霍英东研究院建筑物能源研究中心经理朱龙潜日前对记者说。\n从香港科技大学取得博士学位后，朱",
				"extra": "album: 经济与管理科学\ndownload: 13\nfilename: kjrb202403070081\ndbname: CCND\ndbcode: CCNDTEMP",
				"libraryCatalog": "CNKI TIKS",
				"pages": "8",
				"publicationTitle": "科技日报",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "科技创新中心"
					},
					{
						"tag": "粤港澳"
					},
					{
						"tag": "规划纲要"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kc.cnki.net/detail/article?id=/eXpHEjRa97GRlewO5DNtaTO9brQqdLLdAxnePgvkmnHWm0YymI1blt6bfqWsh8e3UAwBTzEzQpvejpQgoPmiqCv8fTMbTjAOjJYsjHr3SizI/xsM5evxHpLvD/0mGY6ewCfWZZPp9POmDX2aDuBOgwY4Ied+2PdQo9m9AKzz1EVpiT+Nj/WBxozWwmxYuptlT/DPAgAiv5TSuXQawbFcedyv/QEYqOP6mym4s3x8o17kOHE/mxUIPh7dx0oZyMo/fWzTm8g5Q0uvGd9RgmEkEOM41Cb1dNdcQ80+MFB5dzcXCIOKl9haAzUW4btXZEYyAKes2oFpN6oqG5lP+zdX1suWwX8YS1bejFwCW0R49iTloAcnIyVrK9ZzrrqgdeoFeN900W0n1a4rqOvNcc4gA==",
		"items": [
			{
				"itemType": "bookSection",
				"title": "6-2 煤炭生产、外调、使用平衡表",
				"creators": [
					{
						"firstName": "",
						"lastName": "王育民",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"bookTitle": "山西统计年鉴",
				"extra": "DOI: 10.42111/y.cnki.yuyty.2023.000115\nCLC: F426.21\ndownload: 6\nfilename: n2023110026000127\ndbname: CYFD\ndbcode: CYFD2023",
				"libraryCatalog": "CNKI TIKS",
				"pages": "156",
				"attachments": [
					{
						"title": "Full Text PDF",
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
		"url": "https://kc.cnki.net/detail/article?id=jtlinruh2VLDhc+I04vrNixixCRS7WU5nrX8JTgd5kPqgYAKsT9hjQEyTlAZnivW7L8AuhHPNUNV9tBof+7aDZ0Yt4jiyE4mSd25ml0ApXhQwEtbJ3oJvGUCQbCdMazKlzFcZB+F4F7jqz8ai9In0XQU0W62wqH8qrznSLzFO3MdHE0RQZg6VnEgWsxzhgc+UK5JbU4B2qLBo7hu+a+5iqgdZ4iUEQOPveDMoGnk9l8=",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中华人民共和国公司法",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国人民代表大会常务委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2023-12-29",
				"abstractNote": "第一章　总 则\n第一条 为了规范公司的组织和行为，保护公司、股东、职工和债权人的合法权益，完善中国特色现代企业制度，弘扬企业家精神，维护社会经济秩序，促进社会主义市场经济的发展，根据宪法，制定本法。\n第二条 本法所称公司，是指依照本法在中华人民共和国境内设",
				"extra": "applyDate: 2024-07-01\nfilename: la2023123000006\ndbname: CLKL\ndbcode: CLKLLAST",
				"publicLawNumber": "中华人民共和国主席令第十五号",
				"shortTitle": "公司法",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "公司"
					},
					{
						"tag": "公司法"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kc.cnki.net/detail/article?id=jGMZiBWlT9KcG4/pu/81g/VWi2hiBEdd4uPpPqo9Gl8M2QQaGFZioi2kR1zsO6KN25LNlU6snA0SKKJ+SzssmYR9ivBojL5z5AeUmFOwHvii7JxKCsrJsT85EG++5t4nzxJ0jSfcqQ3YYdWLiLuLf0jmF0PJxTN+o1H7+oMjYE9VGYgtgw8nWb7oSpzNWIqntBQtvhc33IJgCG9bCe7QGA==",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "河南省人民政府关于印发河南省基本公共服务体系“十二五”规划的通知",
				"creators": [
					{
						"firstName": "",
						"lastName": "河南省人民政府",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2012-12-28",
				"abstractNote": "各省辖市、省直管试点县（市）人民政府，省人民政府各部门: 现将《河南省基本公共服务体系“十二五”规划》印发给你们，请认真组织实施。 $R河南省人民政府 2012年12月28日$E 河南省基本公共服务体系“十二五”规划 序 言 基本公共服务，是指建立在一定社",
				"extra": "Type: regulation\napplyDate: 2012-12-28\nStatus: 已废止\nfilename: la201302250090\ndbname: CLKL\ndbcode: CLKL0817",
				"publicLawNumber": "豫政[2012]110号",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "公共服务"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
