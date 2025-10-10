{
	"translatorID": "6cb129d7-5c8d-4a3a-8ded-7c21650a44e4",
	"label": "Zhizhen",
	"creator": "jiaojiaodubai",
	"target": "^https://(www|ss)\\.zhizhen\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-10-10 05:34:03"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai

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

const typeMap = {
	期刊: 'journalArticle',
	图书: 'book',
	报纸: 'newspaperArticle',
	学位论文: 'thesis',
	会议论文: 'conferencePaper',
	标准: 'standard',
	专利: 'patent',
	科技成果: 'report',
	法律法规: 'statute',
	案例: 'case',
	报告: 'report'
};

function detectWeb(doc, url) {
	if (url.includes('/detail_')) {
		return typeMap[text(doc, '.card_name > h3 > :first-child').slice(1, -1)];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('.searchLIst .card_name > h3 > a, .qkDeatilMain td > a[href*="/detail_"]');
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
		const items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const data = getLabeledData(
		doc.querySelectorAll('.savelist_con > .card_line'),
		(row) => ZU.trimInternal(text(row, 'dt > span')),
		(row) => row.querySelector('dd'),
		doc.createElement('div')
	);
	const extra = new Extra();
	const newItem = new Z.Item(detectWeb(doc, url));
	newItem.title = text(doc, '.card_name > h3').replace(/^\[.+?\]/, '');
	newItem.abstractNote = text(doc, '#detailAllAbstractId > dd').replace(/收起$/, '');
	let countries = [];
	let creatorsZh = [];
	let creatorsEn = [];
	switch (newItem.itemType) {
		case 'journalArticle':
			newItem.publicationTitle = data('期刊名').replace(/\((\W+)\)$/, '（$1）');
			extra.set('original-container-title', ZU.capitalizeTitle(data('英文期刊名')), true);
			newItem.volume = data('卷号').replace(/(?:第|Vol\.)(.+?)卷?$/, '$1');
			newItem.issue = data('期号').replace(/(?:第|No\.)(.+?)期?$/, '$1');
			// https://www.zhizhen.com/detail_38502727e7500f26adbb62c85e93dcf440908530063747a41921b0a3ea255101fc1cf1fbb4666ae684170ac2ce35bb93a0bba90fa339b227513108c1aa078282ab270c9f25fd7eba8a87a94da8848658?&apistrclassfy=0_14_2
			newItem.pages = data('页码').replace(/^P/, '').replace(/，/g, ', ');
			newItem.date = data('年份');
			newItem.DOI = data('doi');
			newItem.ISSN = data('ISSN');
			creatorsZh = Array.from(data('作者', true).querySelectorAll('a')).map((elm) => {
				const elmCopy = elm.cloneNode(true);
				const sup = elmCopy.querySelector('sup');
				if (sup) {
					elmCopy.removeChild(sup);
				}
				return { name: elmCopy.textContent.trim() };
			});
			creatorsEn = data('英文作者').replace(/\([^)]+\)/g, '').split(/[,，]\s*/);
			break;
		case 'book': {
			const pubInfo = data('出版社');
			newItem.place = tryMatch(pubInfo, /^([^：])：/, 1);
			newItem.publisher = tryMatch(pubInfo, /：(.+)$/, 1);
			newItem.date = ZU.strToISO(data('出版日期'));
			newItem.numPages = tryMatch(data('页码'), /\d+/);
			newItem.ISBN = data('ISBN');
			data('作者').split('；').forEach((group) => {
				let creatorType = 'author';
				if (/翻?译$/.test(group)) {
					creatorType = 'translator';
				}
				else if (/编.?$/.test(group)) {
					creatorType = 'editor';
				}
				group.replace(/ .*?[编著译]+?.*?$/g, '').split('，').forEach((fullName) => {
					countries.push(tryMatch(fullName, /^（(.+?)）/, 1));
					fullName = fullName.replace(/^（.+?）/, '');
					creatorsEn.push(tryMatch(fullName, /（(.+?)）$/, 1).replace(/\.\s*/g, '. '));
					creatorsZh.push({ name: fullName.replace(/（.+?）$/, ''), type: creatorType });
				});
			});
			break;
		}
		case 'newspaperArticle':
			newItem.publicationTitle = data('报纸名称');
			newItem.date = ZU.strToISO(data('出版日期'));
			newItem.pages = tryMatch(data('版次'), /0*(\d+)/, 1);
			creatorsZh = Array.from(data('作者', true).querySelectorAll('a')).map(elm => ({ name: elm.textContent.trim().replace(/^\S* /, '') }));
			break;
		case 'thesis': {
			const dgree = data('学位名称');
			newItem.thesisType = `${dgree}${/[\u4e00-\u9fff]/.test(dgree) ? '学位论文' : ' thesis'}`;
			newItem.university = data('学位授予单位');
			newItem.date = data('学位年度');
			creatorsZh.push({ name: data('作者'), type: 'author' });
			data('导师姓名', true).querySelectorAll('a').forEach((elm) => {
				creatorsZh.push({
					name: elm.textContent.trim(),
					type: 'contributor'
				});
			});
			break;
		}
		case 'conferencePaper':
			newItem.date = data('召开年');
			newItem.proceedingTitle = data('会议录');
			newItem.conferenceName = data('会议名称');
			newItem.publisher = data('出版社');
			creatorsZh = Array.from(data('作者', true).querySelectorAll('a')).map(elm => ({ name: elm.textContent.trim() }));
			break;
		case 'standard':
			extra.set('original-title', ZU.capitalizeTitle(data('英文题名')), true);
			newItem.type = data('标准类型');
			newItem.number = data('标准号').replace(/-(\d+)$/, '—$1');
			newItem.date = data('发布日期');
			newItem.status = data('标准状态');
			extra.set('applyDate', data('实施日期'));
			break;
		case 'patent':
			newItem.assingnee = data('申请人');
			newItem.patentNumber = data('公开号');
			newItem.applicationNumber = data('申请号');
			newItem.place = newItem.country = patentCountry(newItem.patentNumber || newItem.applicationNumber);
			newItem.filingDate = ZU.strToISO(data('申请日期'));
			newItem.issueDate = ZU.strToISO(data('公开日期'));
			extra.set('genre', data('专利类型'), true);
			creatorsZh = Array.from(data('发明人', true).querySelectorAll('a')).map(elm => ({ name: elm.textContent.trim(), type: 'inventor' }));
			break;
		case 'report':
			newItem.reportNumber = data('项目年度编号');
			newItem.data = ZU.strToISO(data(['公布年份', '日期']));
			creatorsZh = Array.from(data(['完成人', '作者'], true).querySelectorAll('a')).map(elm => ({ name: elm.textContent.trim() }));
			break;
		case 'statute':
			newItem.publicLawNumber = data('文号');
			newItem.dateEnacted = data('颁布日期');
			if (!data('效力范围').includes('法律')) {
				extra.set('type', 'regulation', true);
			}
			extra.set('applyDate', data('实施日期'));
			creatorsZh = data('颁布单位').split('；').map(str => ({ name: str }));
			break;
		case 'case':
			newItem.abstractNote = data('判决结果');
			newItem.court = data('审理法院');
			newItem.dateDecided = data('日期');
			newItem.docketNumber = data('文号').replace(/^\((\d+)\)/, '（$1）');
			extra.set('genre', `${data('案由').split('>')[0]}判决书`, true);
			break;
		case '':
			break;
	}
	// Z.debug(countries);
	// Z.debug(creatorsZh);
	newItem.url = url;
	newItem.libraryCatalog = '超星发现';
	data('关键词', true).querySelectorAll('a').forEach(elm => newItem.tags.push(elm.textContent.trim()));
	const creators = [];
	for (let i = 0; i < creatorsZh.length; i++) {
		const nameZh = creatorsZh[i];
		const country = countries[i];
		const nameEn = creatorsEn[i];
		const creator = cleanAuthor(nameZh.name, nameZh.type);
		newItem.creators.push(JSON.parse(JSON.stringify(creator)));
		if (country) {
			creator.country = country;
		}
		if (nameEn) {
			const capitalized = ZU.capitalizeName(nameEn);
			creator.original = capitalized;
			const formatName = ZU.cleanAuthor(capitalized, 'author');
			extra.push('original-author', `${formatName.firstName} || ${formatName.lastName}`, true);
		}
		creators.push(creator);
	}
	if (creators.some(creator => creator.country || creator.original)) {
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	newItem.extra = extra.toString();
	newItem.complete();
}

function getLabeledData(rows, labelGetter, dataGetter, defaultElm) {
	const labeledElm = {};
	for (const row of rows) {
		labeledElm[labelGetter(row, rows)] = dataGetter(row, rows);
	}
	const data = (labels, element = false) => {
		if (Array.isArray(labels)) {
			for (const label of labels) {
				const result = data(label, element);
				if (
					(element && /\S/.test(result.textContent)) ||
					(!element && /\S/.test(result))) {
					return result;
				}
			}
			return element ? defaultElm : '';
		}
		const targetElm = labeledElm[labels];
		return targetElm
			? element ? targetElm : ZU.trimInternal(targetElm.textContent)
			: element ? defaultElm : '';
	};
	return data;
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

function cleanAuthor(name, creatorType = 'author') {
	const creator = ZU.cleanAuthor(name, creatorType);
	if (/\p{Unified_Ideograph}/u.test(creator.lastName)) {
		creator.lastName = creator.lastName.replace(/\.\s*/g, '. ');
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
		"url": "https://www.zhizhen.com/detail_38502727e7500f2622a5e0594fdee51c9404f38f8aa94bd61921b0a3ea255101fc1cf1fbb4666ae6a7b495300dd3558a72a7208fcaee8491d223c3fb551e5b34823016c3f293ca11707988de70c8abf5?&apistrclassfy=0_6_10,0_16_20",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "互联网药品可信交易环境中主体资质审核备案模式",
				"creators": [
					{
						"firstName": "",
						"lastName": "于潇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘义",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "柴跃廷",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙宏波",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2012",
				"ISSN": "1000-0054",
				"abstractNote": "经济全球化和新一轮产业升级为电子商务服务产业发展带来了新的机遇和挑战。无法全程、及时、有效监管电子商务市场的主体及其相关行为是电子商务发展过程中面临的主要问题。尤其对于互联网药品市场,电子商务主体资质的审核备案是营造电子商务可信交易环境的一项重要工作。该文通过系统网络结构分析的方法描述了公共审核备案服务模式和分立审核备案模式的基本原理;建立了两种模式下的总体交易费用模型,分析了公共模式比分立模式节约总体交易费用的充要条件,以及推广该公共模式的必要条件。研究发现:市场规模越大、集成成本越小,公共模式越容易推广。应用案例分析验证了模型,证实了公共审核备案服务模式节约了总体交易费用的结论。",
				"extra": "original-container-title: Journal of Tsinghua University(Science and Technology)\noriginal-author: Yu || Xiao\noriginal-author: Liu || Yi\noriginal-author: Chai || Yueting\noriginal-author: Sun || Hongbo\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"于潇\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Yu Xiao\"},{\"firstName\":\"\",\"lastName\":\"刘义\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Liu Yi\"},{\"firstName\":\"\",\"lastName\":\"柴跃廷\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Chai Yueting\"},{\"firstName\":\"\",\"lastName\":\"孙宏波\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Sun Hongbo\"}]",
				"issue": "11",
				"libraryCatalog": "超星发现",
				"pages": "1518-1523",
				"publicationTitle": "清华大学学报（自然科学版）",
				"url": "https://www.zhizhen.com/detail_38502727e7500f2622a5e0594fdee51c9404f38f8aa94bd61921b0a3ea255101fc1cf1fbb4666ae6a7b495300dd3558a72a7208fcaee8491d223c3fb551e5b34823016c3f293ca11707988de70c8abf5?&apistrclassfy=0_6_10,0_16_20",
				"volume": "52",
				"attachments": [],
				"tags": [
					{
						"tag": "互联网药品交易"
					},
					{
						"tag": "交易主体"
					},
					{
						"tag": "可信交易环境"
					},
					{
						"tag": "电子商务"
					},
					{
						"tag": "资质审核备案"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f2685813c708ce0786a0a5f4caf2dc451221921b0a3ea25510134114c969f2eae5c55b7335ecf9fc8fc4f4222011bb1b78ff07c4958a9f82935fdd611d4c2ae8548edb346ddf669cf76?&apistrclassfy=0_12_1",
		"items": [
			{
				"itemType": "book",
				"title": "科学革命的结构",
				"creators": [
					{
						"firstName": "",
						"lastName": "库恩",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李宝恒",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "1980-10",
				"extra": "original-author: T. S. || Kuhn\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"库恩\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"美\",\"original\":\"T. S. Kuhn\"},{\"firstName\":\"\",\"lastName\":\"李宝恒\",\"creatorType\":\"translator\",\"fieldMode\":1}]",
				"libraryCatalog": "超星发现",
				"numPages": "156",
				"publisher": "上海科学技术出版社",
				"url": "https://www.zhizhen.com/detail_38502727e7500f2685813c708ce0786a0a5f4caf2dc451221921b0a3ea25510134114c969f2eae5c55b7335ecf9fc8fc4f4222011bb1b78ff07c4958a9f82935fdd611d4c2ae8548edb346ddf669cf76?&apistrclassfy=0_12_1",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f266f0c4d9c8270f3775db811774bbd1e861921b0a3ea2551019f4aaf8720bfc891f7bbffac78b7a9cbb4f6dda64b2c799b4eae1b21b09629fa07a971e53705573d75cf6e4118390a11?",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "无人机“飞出”沙漠治理新途径",
				"creators": [
					{
						"firstName": "",
						"lastName": "马正礼",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张鹏龙",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-05-17",
				"libraryCatalog": "超星发现",
				"pages": "2",
				"publicationTitle": "石嘴山日报",
				"url": "https://www.zhizhen.com/detail_38502727e7500f266f0c4d9c8270f3775db811774bbd1e861921b0a3ea2551019f4aaf8720bfc891f7bbffac78b7a9cbb4f6dda64b2c799b4eae1b21b09629fa07a971e53705573d75cf6e4118390a11?",
				"attachments": [],
				"tags": [
					{
						"tag": "修复治理"
					},
					{
						"tag": "无人机"
					},
					{
						"tag": "沙漠治理"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f26ddf1613f0369d8b7110c0cd85ec9f12b1921b0a3ea255101928fa69a765a3d2dceee6e34ba312a2cdd9c2cec996f1f79826f5ea548abf2651b6074286a7daae1260cc1898b337490?&apistrclassfy=0_18_13,0_18_20",
		"items": [
			{
				"itemType": "thesis",
				"title": "生物质材料热解失重动力学及其分析方法研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘乃安",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "范维澄",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2000",
				"abstractNote": "生物质的燃烧是火灾安全科学领域的重要研究课题.而热解失重过程,则为引发生物质的着火以及维持随后的火蔓延过程提供必要的挥发性燃料.该文以生物质材料的热解反应失重动力学过程为研究对象,通过对其行为和规律的研究,旨在建立具有一定普遍性和精确性的适用于模拟生?",
				"libraryCatalog": "超星发现",
				"thesisType": "博士学位论文",
				"university": "中国科学技术大学",
				"url": "https://www.zhizhen.com/detail_38502727e7500f26ddf1613f0369d8b7110c0cd85ec9f12b1921b0a3ea255101928fa69a765a3d2dceee6e34ba312a2cdd9c2cec996f1f79826f5ea548abf2651b6074286a7daae1260cc1898b337490?&apistrclassfy=0_18_13,0_18_20",
				"attachments": [],
				"tags": [
					{
						"tag": "模型"
					},
					{
						"tag": "火灾预防"
					},
					{
						"tag": "热解失重动力学"
					},
					{
						"tag": "生物质"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f26d7bd454dc75b9b09a14463de97dadb7b1921b0a3ea255101973b12c9c3642f458184496afcf62f8c7bf8000f66e4660f98d1938686dbf09c2496f7087625a2551c6403172819b275?&apistrclassfy=0_15_13,0_21_12",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "中国农业转基因生物研发进展与安全管理",
				"creators": [
					{
						"firstName": "",
						"lastName": "汪学军",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2002",
				"abstractNote": "1996年，农业部颁布了《农业生物基因工程安全管理实施办法》(简称《实施办法》)。设立了农业生物基因工程安全管理办公室和农业生物基因工程安全委员会。随着转基因生物研发进程的加快，科研成果不断涌现，国外转基因农产品向中国大量出口，在新的形势下，原有的《实施办法》已不能适应当前管理和中国加入WTO的需要。2001年5月23日，国务院颁布了《农业转基因生物安全管理条例》(以下简称《条例》)，旨在维护全球生物多样性、保护生态环境和人类健康。2002年1月5日，农业部发布了与《条例》配套的三个管理办法，  即《农业转基因生物安全评价管理办法》、《农业转基因生物进口安全管理办法》和《农业转基因生物标识管理办法》，自2002年3月20日起施行：《条例》规定中国对农业转基因生物实行安全评价制度，标识管理制度，生产和经营许可制度和进口安全审批制度。《条例》及其配套规章的发布和实施，标志着中国对农业转基因生物的研究，试验、生产，加工。经营和进出口活动开始实施全面管理",
				"conferenceName": "中国国家生物安全框架实施国际合作项目研讨会",
				"libraryCatalog": "超星发现",
				"publisher": "国家环境保护总局生物安全管理办公室",
				"url": "https://www.zhizhen.com/detail_38502727e7500f26d7bd454dc75b9b09a14463de97dadb7b1921b0a3ea255101973b12c9c3642f458184496afcf62f8c7bf8000f66e4660f98d1938686dbf09c2496f7087625a2551c6403172819b275?&apistrclassfy=0_15_13,0_21_12",
				"attachments": [],
				"tags": [
					{
						"tag": "农业生物基因工程"
					},
					{
						"tag": "出口"
					},
					{
						"tag": "安全管理条例"
					},
					{
						"tag": "标识"
					},
					{
						"tag": "进口"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f262bcf39d661e0e5f9e9312b72361b930b1921b0a3ea2551016bd6091b92ceac0019990cfdf821ccb2a2c7f9a86ae9e15898f3d0c2d0b8107ac94019f5c2120b2e8b47ee5a88048045?",
		"items": [
			{
				"itemType": "patent",
				"title": "轨道火车及高速轨道火车紧急安全制动辅助装置",
				"creators": [
					{
						"firstName": "",
						"lastName": "张凯军",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "赵永杰",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈朝岗",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2013-03-27",
				"abstractNote": "本实用新型涉及一种轨道火车及高速轨道火车紧急安全制动辅助装置。现有的轨道火车及高速轨道火车在制动过程中轮毂和钢轨是点接触而引起附着力较小易产生滑移不能有效减速和缩短制动距离的问题。本实用新型在现有轨道火车及高速轨道火车的转向架同侧相邻两个轮毂桥架中间安装一个制动时可自由上下伸缩并能与钢轨相接触能增大摩擦力矩的制动辅助装置。该装置由摩擦片、摩擦片座、导向移动柱、基座、回位弹簧、联动杆、制动气室推柱及制动气室组成。该装置在制动过程中能增大火车的转向架与钢轨之间附着力及摩擦力，使高速行驶的轨道火车及高速轨道火车在紧急情况下迅速减速缩短制动距离并安全停车的制动辅助装置。",
				"applicationNumber": "201220158825.2",
				"country": "中国",
				"extra": "genre: 实用新型专利",
				"filingDate": "2012-04-05",
				"patentNumber": "CN202827616U",
				"place": "中国",
				"url": "https://www.zhizhen.com/detail_38502727e7500f262bcf39d661e0e5f9e9312b72361b930b1921b0a3ea2551016bd6091b92ceac0019990cfdf821ccb2a2c7f9a86ae9e15898f3d0c2d0b8107ac94019f5c2120b2e8b47ee5a88048045?",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f2635d96c1c71e2757b90731975909509971921b0a3ea25510121c9e6c74ce2dd696688f5273a0b3ee64d66844df0f2e19fce866d538d25bb42767dc4cbdf0db59daeedeffa38f577af?",
		"items": [
			{
				"itemType": "report",
				"title": "量子密码理论及其在量子计算中的应用",
				"creators": [
					{
						"firstName": "",
						"lastName": "李琴",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李绿周",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "量子计算的迅速发展为大幅提升现有算力带来了憧憬。但是它也对现今为数据安全保驾护航的经典密码算法(比如RSA)造成严重安全威胁，使得寻找可以抵抗量子计算机攻击的密码算法迫在眉睫。由于量子密码理论基于量子力学基本原理，不再依赖于某些未被证明的数学困难问题假设，从而有可能实现无条件安全，在未来特别是供大众使用的量子计算机诞生之时支撑信息安全保护。该项目在暂未具备物理实验条件的前提下从数学和计算机的角度对量子密码理论及其在量子计算中的应用进行了深入的研究，其核心成果以及创新性主要体现在如下三个方面。1.量子密码基本理论体系的完善。对量子密码理论特别是其中的量子签名、量子秘密共享和量子认证等内容进行了优化和完善，通过用两体Bell态取代三体GHZ态提出了效率更高并且更容易物理实现的量子签名方案；发现了量子签名方案中接收方可以任意否认接受过签名方的签名等安全漏洞并提出了相应的防范措施；构造了多层复合模型避免了量子秘密共享中可信第三方的存在，从而更加符合实际情况；将量子认证应用到盲量子计算当中解决了双向身份认证问题。2.半量子密码思想的应用。针对现实中并非所有通信方都具备同等量子资源或量子能力的情况，率先将半量子化的思想应用到量子秘密共享中提出了首个半量子秘密共享方案，使得类似经典的参与方也能与具备较强量子能力的参与方一起完成秘密共享任务，从而扩大量子秘密共享的应用范围。随后又给出进一步降低对参与方要求的改进方案，其中类似经典方不需量子测量，而量子参与方无需量子内存。3.盲量子计算中公开难题的解决。盲量子计算作为量子密码思想在量子计算中的典型应用，不仅需要只具备有限量子能力的用户将复杂的量子计算问题委托给远程量子服务器来完成，而且需要保证用户的隐私数据不被服务器所知。通过巧妙地引入纠缠交换的方法解决了双服务器盲量子计算中的公开难题，使得服务器之间即使允许通信也能消除用户的量子能力，并依然可以保证用户的数据不被泄露。此外首次将量子认证思想引入到盲量子计算中避免了原本存在的中间人攻击和拒绝服务攻击。该项目有力地促进了量子密码理论体系的完善及其在量子计算中的应用。它在多项国家自然科学基金(包括重点项目、面上项目、联合项目、青年项目和国际合作交流项目)和湖南省自然科学基金面上项目的资助下完成，所得成果在Physics Review A、Physical Letters A、Journal of Physics A-Mathematical and Theoretical等知名SCI期刊上发表，其中8篇代表作及论文被Reports on Progress in Physics，Nature Communications和Physical Review Letters等高水平SCI期刊论文正面他引340次。",
				"libraryCatalog": "超星发现",
				"reportNumber": "2200010192",
				"url": "https://www.zhizhen.com/detail_38502727e7500f2635d96c1c71e2757b90731975909509971921b0a3ea25510121c9e6c74ce2dd696688f5273a0b3ee64d66844df0f2e19fce866d538d25bb42767dc4cbdf0db59daeedeffa38f577af?",
				"attachments": [],
				"tags": [
					{
						"tag": "量子力学"
					},
					{
						"tag": "量子密码理论"
					},
					{
						"tag": "量子计算"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f261c929f8a7bac71e4c3ef626c401b13591921b0a3ea25510109fa07b2134bcf6ff40bb0027960b82a3e5ae6ac3db3d3725402253e62807d492c29fc312a2055f90dd5764e67f035af",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "北京市人民政府办公厅关于转发北京市企业投资项目核准暂行实施办法的通知",
				"creators": [
					{
						"firstName": "",
						"lastName": "北京市人民政府办公厅",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2005-07-12",
				"extra": "type: regulation\napplyDate: 2005-07-12",
				"publicLawNumber": "京政办发[2005]37号",
				"url": "https://www.zhizhen.com/detail_38502727e7500f261c929f8a7bac71e4c3ef626c401b13591921b0a3ea25510109fa07b2134bcf6ff40bb0027960b82a3e5ae6ac3db3d3725402253e62807d492c29fc312a2055f90dd5764e67f035af",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f26232117ef2cf73151c6b11ed57cc5a7571921b0a3ea2551012a3efa3e0d968ac37c73b6d4432b13d5619fd31f9a0842c23098ee998544bc703d535ff7376cb3b2afb19a65e7a2e542?",
		"items": [
			{
				"itemType": "case",
				"caseName": "陈某等开设赌场案",
				"creators": [],
				"dateDecided": "2018-01-19",
				"abstractNote": "【判定罪名】 开设赌场罪★ 【刑罚】 被告人陈某犯开设赌场罪，判处有期徒刑三年，缓刑三年六个月，并处罚金人民币五万元；已退出的违法所得计人民币一万五千七百元予以没收，上缴国库。被告人朱某某1犯开设赌场罪，判处有期徒刑一年，缓刑一年六个月，并处罚金人民币一万元；已退出的违法所得计三千七百元予以没收，上缴国库。",
				"court": "浙江省台州市椒江区人民法院",
				"docketNumber": "（2018）浙1002刑初60号",
				"extra": "genre: 刑事判决书",
				"url": "https://www.zhizhen.com/detail_38502727e7500f26232117ef2cf73151c6b11ed57cc5a7571921b0a3ea2551012a3efa3e0d968ac37c73b6d4432b13d5619fd31f9a0842c23098ee998544bc703d535ff7376cb3b2afb19a65e7a2e542?",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f26a7c24ddba66b4d000276ac7ccd9cd3451921b0a3ea255101f38865853bf86257f91912d7ace45400c6ae406a3cee08903325a6c8deb907ee8b1ea140e98dc18ff16a179db7aa4bc9?",
		"items": [
			{
				"itemType": "report",
				"title": "第48次中国互联网络发展状况统计报告",
				"creators": [
					{
						"firstName": "",
						"lastName": "中国互联网络信息中心",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "中国互联网络信息中心（CNNIC）（8月27日）在京发布第48次《中国互联网络发展状况统计报告》（以下简称《报告》）。《报告》显示，截至2021年6月，我国网民规模达10.11亿，较2020年12月增长2175万，互联网普及率达71.6%。十亿用户接入互联网，形成了全球最为庞大、生机勃勃的数字社会。",
				"libraryCatalog": "超星发现",
				"url": "https://www.zhizhen.com/detail_38502727e7500f26a7c24ddba66b4d000276ac7ccd9cd3451921b0a3ea255101f38865853bf86257f91912d7ace45400c6ae406a3cee08903325a6c8deb907ee8b1ea140e98dc18ff16a179db7aa4bc9?",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f26acc7fe0795e76dde4887a1ecfdef8d691921b0a3ea255101fc1cf1fbb4666ae6c45d1447174616c9c2997e2576d817bc8afa8bcd72f81f9b838a9f3e66465c613312ed0331cb07be?&apistrclassfy=0_16_9",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Bone targeted nano-drug and nano-delivery",
				"creators": [
					{
						"firstName": "Yilun",
						"lastName": "Wu",
						"creatorType": "author"
					},
					{
						"firstName": "Bing",
						"lastName": "Sun",
						"creatorType": "author"
					},
					{
						"firstName": "Ying",
						"lastName": "Tang",
						"creatorType": "author"
					},
					{
						"firstName": "Aining",
						"lastName": "Shen",
						"creatorType": "author"
					},
					{
						"firstName": "Yanlin",
						"lastName": "Lin",
						"creatorType": "author"
					},
					{
						"firstName": "Xiaohui",
						"lastName": "Zhao",
						"creatorType": "author"
					},
					{
						"firstName": "Jingui",
						"lastName": "Li",
						"creatorType": "author"
					},
					{
						"firstName": "Michael",
						"lastName": "J.Monteiro",
						"creatorType": "author"
					},
					{
						"firstName": "Wenyi",
						"lastName": "Gu",
						"creatorType": "author"
					}
				],
				"date": "2024",
				"ISSN": "2095-4700",
				"abstractNote": "There are currently no targeted delivery systems to satisfactorily treat bone-related disorders. Many clinical drugs consisting of small organic molecules have a short circulation half-life and do not effectively reach the diseased tissue site. This coupled with repeatedly high dose usage that leads to severe side effects.",
				"issue": "3",
				"libraryCatalog": "超星发现",
				"pages": "517-538",
				"publicationTitle": "Bone Research",
				"url": "https://www.zhizhen.com/detail_38502727e7500f26acc7fe0795e76dde4887a1ecfdef8d691921b0a3ea255101fc1cf1fbb4666ae6c45d1447174616c9c2997e2576d817bc8afa8bcd72f81f9b838a9f3e66465c613312ed0331cb07be?&apistrclassfy=0_16_9",
				"volume": "12",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/detail_38502727e7500f26f52a07794e835589b6d78d47fb1fe2771921b0a3ea255101776267a8a8f75e5e85b247c7787416915854c0d32b6809198699899e0eb947108617d0d2efc40e2f556f18d769fe7396?",
		"items": [
			{
				"itemType": "thesis",
				"title": "Deformation and damage of copper and nano copper based joints.",
				"creators": [
					{
						"firstName": "Kokash, Maan",
						"lastName": "Zaid",
						"creatorType": "author"
					}
				],
				"date": "2015",
				"libraryCatalog": "超星发现",
				"thesisType": "M.S. thesis",
				"university": "State University of New York at Binghamton",
				"url": "https://www.zhizhen.com/detail_38502727e7500f26f52a07794e835589b6d78d47fb1fe2771921b0a3ea255101776267a8a8f75e5e85b247c7787416915854c0d32b6809198699899e0eb947108617d0d2efc40e2f556f18d769fe7396?",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/s?sw=nano",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.zhizhen.com/nav/mag/infos?mags=6b5c39b3dd84352b52fd8d450fc38fa4",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://ss.zhizhen.com/detail_38502727e7500f267044c544c33fa18c37959df4ca791e7d1921b0a3ea255101c944b624736f9e85555228c913e55e3d2d38e0b740b9f3ce63d991ac6224c4f393d8a3d2827d8435f48220d48126f9d7?&apistrclassfy=1_4_6,1_10_10,1_3_10,1_3_8",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Translating Indigenous Affect in the Comedia",
				"creators": [
					{
						"firstName": "Ben",
						"lastName": "Post",
						"creatorType": "author"
					}
				],
				"date": "2025",
				"DOI": "10.2307/27384054",
				"ISSN": "0145-8973",
				"issue": "1",
				"libraryCatalog": "超星发现",
				"pages": "9-30",
				"publicationTitle": "Chasqui",
				"url": "https://ss.zhizhen.com/detail_38502727e7500f267044c544c33fa18c37959df4ca791e7d1921b0a3ea255101c944b624736f9e85555228c913e55e3d2d38e0b740b9f3ce63d991ac6224c4f393d8a3d2827d8435f48220d48126f9d7?&apistrclassfy=1_4_6,1_10_10,1_3_10,1_3_8",
				"volume": "54",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
