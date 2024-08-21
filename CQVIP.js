{
	"translatorID": "17364f55-b899-4553-977c-c1b062e80d28",
	"label": "CQVIP",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.cqvip\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-08-17 03:05:34"
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

const typeMap = {
	journal: 'journalArticle',
	degree: 'thesis',
	conference: 'conferencePaper',
	report: 'report',
	patent: 'patent',
	standard: 'standard'
};

function detectWeb(doc, url) {
	const mainWidget = doc.querySelector('.search .main, .periodical-detail .main');
	if (mainWidget) {
		Z.monitorDOMChanges(mainWidget, { childList: true, subtree: true });
	}
	for (const key in typeMap) {
		if (url.includes(`/doc/${key}/`)) {
			return typeMap[key];
		}
	}
	if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	// .periodical-detail .cell > a[href*="/doc/"] for journal home page
	const rows = doc.querySelectorAll('.searchTitle a.title, .periodical-detail .cell > a[href*="/doc/"]');
	for (let row of rows) {
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
	const labels = new Labels(doc, '.horizontalData-f, .mainContainerDataList-item');
	const doi = labels.get('DOI');
	if (doi) {
		try {
			await scrapeSearch(doi);
			return;
		}
		catch (error) {
			Z.debug(error);
		}
	}
	const ids = url.match(/\/doc\/[a-z]+\/(\d+)/)[1];
	Z.debug(`ids: ${ids}`);
	const refURL = `https://wwwv3.cqvip.com/website/literature/base/ref/download?ids=${ids}&types=1&style=RefMan`;
	let refText = await requestText(refURL);
	Z.debug(refText);
	refText = refText
		.replace(/^{?([A-Z](\d|[A-Z]{1,4}))}?: /gm, '$1 ')
		.replace(/^(A[1-6]|K1) .+/gm, (match, tag) => match.replace(/;/g, `\n${tag} `))
		.replace(/^(IS|VO|SP) .+/gm, match => match.replace(/\b0*(\d*)/g, '$1'))
		.replace(/^OP .+/m, match => match.replace(/\+/g, ', '));
	let translator = Zotero.loadTranslator('import');
	// RefWorks Tagged
	translator.setTranslator('1a3506da-a303-4b0a-a1cd-f216e6138d86');
	translator.setString(refText);
	translator.setHandler('itemDone', (_obj, item) => {
		item.itemType = detectWeb(doc, url);
		const extra = new Extra();
		extra.set('citation', text(doc, '.horizontalData-content'));
		extra.set('download', text(doc, '.horizontalData-content', 2));
		extra.set('CLC', labels.get('中图分类号'));
		item.language = /[\u4e00-\u9fff]/.test(item.title)
			? 'zh-CN'
			: 'en-US';
		item.notes = [];
		switch (item.itemType) {
			case 'journalArticle':
				delete item.callNumber;
				break;
			case 'thesis':
				item.thesisType = `${item.edition}学位论文`;
				delete item.edition;
				labels.get('导师', true).querySelectorAll('.info-line > span').forEach((element) => {
					item.creators.push(ZU.cleanAuthor(element.textContent, 'contributor'));
				});
				break;
			case 'conferencePaper':
				item.conferenceName = labels.get('会议名称');
				item.place = labels.get('会议地点');
				extra.set('organizer', item.publisher, true);
				delete item.publisher;
				break;
			case 'report':
				item.reportType = tryMatch(refText, /^DB (.+)/m, 1);
				// item.url = url;
				break;
			case 'patent':
				extra.set('Genre', item.applicationNumber, true);
				item.patentNumber = tryMatch(refText, /^ID (.+)/m, 1);
				item.applicationNumber = tryMatch(refText, /^NO (.+)/m, 1);
				item.place = item.country = patentCountry(item.patentNumber || item.applicationNumber);
				item.assignee = item.issuingAuthority;
				delete item.issuingAuthority;
				item.filingDate = labels.get('申请日');
				item.issueDate = labels.get('公开\\(公告\\)日');
				item.legalStatus = text(doc, '.legalstatus .el-table__row:first-child > td:nth-child(2)');
				extra.set('IPC', labels.get('IPC分类号'));
				item.rights = labels.get('主权项');
				break;
			case 'standard':
				item.title = item.title
					.replace(/([\u4e00-\u9fff]) ([\u4e00-\u9fff])/, '$1　$2')
					.replace(/([\u4e00-\u9fff]): ?([\u4e00-\u9fff])/, '$1：$2');
				item.number = tryMatch(refText, /^ID (.+)/m, 1);
				delete item.publisher;
				extra.set('CSC', labels.get('中国标准分类号'));
				extra.set('ICS', labels.get('国际标准分类号'));
				break;
		}
		item.creators.forEach((creator) => {
			if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
				creator.firstName = '';
				creator.fieldMode = 1;
			}
		});

		/* if (pdfLink) {
			item.attachments.push({
				url: pdfLink.href,
				title: 'Full Text PDF',
				mimeType: 'application/pdf'
			});
		} */
		item.extra = extra.toString();
		item.complete();
	});
	await translator.translate();
}

async function scrapeSearch(doi) {
	if (!doi) throw new ReferenceError('no identifier available');
	let translator = Zotero.loadTranslator('search');
	translator.setSearch({ DOI: doi });
	translator.setHandler('translators', (_, translators) => {
		translator.setTranslator(translators);
	});
	translator.setHandler('itemDone', (_, item) => {
		item.complete();
	});
	translator.setHandler('error', () => { });
	await translator.getTranslators();
	await translator.translate();
}

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
		"url": "https://www.cqvip.com/doc/journal/954991692",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "“北斗一号”监控管理网设计与实现",
				"creators": [
					{
						"lastName": "武丽丽",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "华一新",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "张亚军",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "刘英敏",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2008",
				"ISSN": "1009-2307",
				"abstractNote": "本文分析了北斗用户终端在实际应用中存在的问题,指出指挥型用户终端的监控能力有限、成本相对较高是影响其推广应用的关键。针对该问题,利用现有资源,设计并搭建了监控管理网,在该网络中创造性地设计了虚拟指挥机系统,起到了指挥型用户终端的作用,弥补了北斗用户终端的不足。文章具体阐述了虚拟指挥机系统的工作原理,介绍了其数据模型,并描述了整个监控管理网的网络功能和体系结构设计,该网络已在很多部门得到应用。",
				"extra": "citation: 1\nCLC: P208 [测绘数据库与信息系统]",
				"issue": "5",
				"language": "zh-CN",
				"libraryCatalog": "CQVIP",
				"pages": "8-9, 7",
				"publicationTitle": "测绘科学",
				"url": "https://wwwv3.cqvip.com/doc/journal/954991692",
				"volume": "33",
				"attachments": [],
				"tags": [
					{
						"tag": "北斗用户终端"
					},
					{
						"tag": "指挥机"
					},
					{
						"tag": "用户机"
					},
					{
						"tag": "监控"
					},
					{
						"tag": "虚拟指挥机"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cqvip.com/doc/degree/1868317894",
		"items": [
			{
				"itemType": "thesis",
				"title": "人类活动影响下海河流域典型区水循环变化分析",
				"creators": [
					{
						"lastName": "马欢",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨大文",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2011",
				"abstractNote": "海河流域人口密集，水资源供需关系紧张。近年来，在人工取水、下垫面变化和农业灌溉等人类活动影响下，流域水循环发生了显著变化。人类活动对海河流域山区和平原灌区水循环的影响方式和机制有所不同，论文分别选取流域内的典型山区与平原灌区，探讨了人类活动影响下山区径流、平原区地下水位及水质的变化特征。 论文以密云水库上游流域为研究对象，分析人类活动影响下海河流域典型山区的水循环变化特征。分析表明在1956005年期间，流域年径流明显减少，降雨和平均气温分别呈显著下降和升高趋势，人工取水量明显增加，人类活动和气候变化是引起径流减少的主要原因。论文将研究期划分为1956983和1984005年两个时段，以两时段内年平均径流的变化来评价流域径流的减少量，并采用数据分析与水文模型相结合的综合分析方法，定量评价了人工取用水、气候变化以及下垫面变化对径流减少的贡献。结果表明，人类活动对径流减少的贡献略小于气候变化的贡献。 论文以位山引黄灌区为研究对象，探讨人类活动影响下海河流域典型平原灌区的水循环变化特征。对1974007年位山灌区地下水位变化的分析表明，灌区地下水位总体保持在较高水平，但一干渠末端附近的地下水位出现较明显的下降。灌区地下水位在空间分布上沿干渠上游至下游逐渐下降，灌区内地下水位高于灌区外，表明引黄灌溉是维持位山灌区现状地下水位的主要原因。在位山灌区典型田间的水循环综合观测数据基础上，结合田间水循环模型，分析了农田水分运移规律及水量平衡特征。在黄河水资源供需矛盾日益突出的背景下，位山灌区未来引黄水量可能有所减少，论文以1984007年的气象和引黄流量数据为基础，采用田间水循环模型分析了不同灌溉水平下，灌区地下水位及蒸散发的变化特征。 对于位山灌区，人类活动对水环境也有明显影响。灌溉导致地下水位抬升，带来土壤盐渍化风险;灌溉和施肥影响农田的氮素平衡，硝态氮淋溶可能造成地下水污染。论文在2010年51月期间，对灌区典型农田的土壤水与地下水进行了分层连续采样，检测了样本的盐分与氮素含量，检测数据显示：土壤水与地下水中，盐分浓度在120cm附近出现峰值，硝态氮浓度总体随埋深的增加而降低;铵态氮含量很低，表明土壤的硝化能力很强。论文采用田间盐分运移模型，探讨了灌排不平衡时的盐渍化风险;建立了对饱和－非饱和带耦合模拟的农田氮素迁移转化模型，探讨了农田氮素平衡特征，并对根层硝态氮的淋溶损失进行了评估。",
				"extra": "CLC: P339[水文循环与水文气象]",
				"language": "zh-CN",
				"libraryCatalog": "CQVIP",
				"thesisType": "博士学位论文",
				"university": "清华大学",
				"url": "https://wwwv3.cqvip.com/doc/degree/1868317894",
				"attachments": [],
				"tags": [
					{
						"tag": "Hydrus-1D"
					},
					{
						"tag": "人类活动"
					},
					{
						"tag": "分布式水文模型"
					},
					{
						"tag": "海河流域"
					},
					{
						"tag": "田间观测"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cqvip.com/doc/conference/537148377",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "面向数字素养的高校图书馆数字服务体系研究",
				"creators": [
					{
						"lastName": "贾东琴",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "柯平",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2011-10-26",
				"abstractNote": "数字素养作为数字环境中的一种基本素养，它已成为人们适应全球信息化、数字化社会所需的基本能力。图书馆可通过构建面向数字素养的数字服务体系，以服务为手段，使学生在自然便利的氛围中形成良好的数字素养来逐步提升学生的数字素养水平。面向数字素养的数字服务体系要以坚实的课程教学为基础，创建优越的数字服务环境为后盾，多样化的数字服务方式为手段，形成的一种高效的数字素养服务机制。",
				"conferenceName": "中国图书馆学会2011年年会",
				"extra": "organizer: 中国图书馆学会\nCLC: G252",
				"language": "zh-CN",
				"libraryCatalog": "CQVIP",
				"pages": "45-53",
				"place": "中国贵州省",
				"proceedingsTitle": "中国图书馆学会2011年年会论文集",
				"url": "https://wwwv3.cqvip.com/doc/conference/537148377",
				"attachments": [],
				"tags": [
					{
						"tag": "数字化建设"
					},
					{
						"tag": "数字素养"
					},
					{
						"tag": "读者服务"
					},
					{
						"tag": "高校图书馆"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cqvip.com/doc/patent/1992472003",
		"items": [
			{
				"itemType": "patent",
				"title": "轨道火车及高速轨道火车紧急安全制动辅助装置",
				"creators": [
					{
						"lastName": "张凯军",
						"firstName": "",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "张凯军",
						"firstName": "",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "张凯军",
						"firstName": "",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"abstractNote": "本实用新型涉及一种轨道火车及高速轨道火车紧急安全制动辅助装置。现有的轨道火车及高速轨道火车在制动过程中轮毂和钢轨是点接触而引起附着力较小易产生滑移不能有效减速和缩短制动距离的问题。本实用新型在现有轨道火车及高速轨道火车的转向架同侧相邻两个轮毂桥架中间安装一个制动时可自由上下伸缩并能与钢轨相接触能增大摩擦力矩的制动辅助装置。该装置由摩擦片、摩擦片座、导向移动柱、基座、回位弹簧、联动杆、制动气室推柱及制动气室组成。该装置在制动过程中能增大火车的转向架与钢轨之间附着力及摩擦力，使高速行驶的轨道火车及高速轨道火车在紧急情况下迅速减速缩短制动距离并安全停车的制动辅助装置。",
				"applicationNumber": "CN201220158825.2",
				"assignee": "张凯军",
				"country": "中国",
				"extra": "Genre: 实用新型",
				"language": "zh-CN",
				"patentNumber": "CN202827616U",
				"place": "中国",
				"url": "https://wwwv3.cqvip.com/doc/patent/1992472003",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cqvip.com/doc/standard/2419214972",
		"items": [
			{
				"itemType": "standard",
				"title": "广播电视音像资料编目规范　第2部分：音频资料",
				"creators": [],
				"date": "2016-02-24",
				"abstractNote": "本部分规定了广播电视节目音频资料编目的著录项目(元数据)及其使用规则和数据表达方式。    本部分适用于广播电视音频资料的编目。",
				"language": "zh-CN",
				"libraryCatalog": "CQVIP",
				"number": "GY/T 202.2-2016",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cqvip.com/doc/journal/2800794117",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Next-Generation Sequencing: From Understanding Biology to Personalized Medicine",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "Karen",
						"lastName": "Frese"
					},
					{
						"creatorType": "author",
						"firstName": "Hugo",
						"lastName": "Katus"
					},
					{
						"creatorType": "author",
						"firstName": "Benjamin",
						"lastName": "Meder"
					}
				],
				"date": "2013-03-01",
				"DOI": "10.3390/biology2010378",
				"ISSN": "2079-7737",
				"abstractNote": "Within just a few years, the new methods for high-throughput next-generation sequencing have generated completely novel insights into the heritability and pathophysiology of human disease. In this review, we wish to highlight the benefits of the current state-of-the-art sequencing technologies for genetic and epigenetic research. We illustrate how these technologies help to constantly improve our understanding of genetic mechanisms in biological systems and summarize the progress made so far. This can be exemplified by the case of heritable heart muscle diseases, so-called cardiomyopathies. Here, next-generation sequencing is able to identify novel disease genes, and first clinical applications demonstrate the successful translation of this technology into personalized patient care.",
				"issue": "1",
				"journalAbbreviation": "Biology",
				"language": "en",
				"libraryCatalog": "DOI.org (Crossref)",
				"pages": "378-398",
				"publicationTitle": "Biology",
				"rights": "https://creativecommons.org/licenses/by/3.0/",
				"shortTitle": "Next-Generation Sequencing",
				"url": "https://www.mdpi.com/2079-7737/2/1/378",
				"volume": "2",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cqvip.com/doc/degree/3334769152",
		"items": [
			{
				"itemType": "thesis",
				"title": "Cooperative Adsorbents for Carbon Dioxide Separations",
				"creators": [
					{
						"lastName": "Siegelman",
						"firstName": "Rebecca L.",
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "Long",
						"creatorType": "contributor"
					}
				],
				"date": "2019",
				"abstractNote": "Carbon dioxide separations are likely to play an important role in mitigating greenhouse gas emissions and preventing further increases in global temperature. To perform these separations efficiently at scale, new materials are needed with greater efficiencies in the capture and release of CO2 from the emissions of fossil fuel-fired power plants and industrial process streams. In recent years, metal–organic frameworks, constructed from inorganic ions or clusters connected by organic bridging units, have shown particular promise in improving the efficiency of CO2 separations. Specifically, a new class of metal–organic frameworks of the form M2(dobpdc)(diamine)2 (M = Mg, Mn, Fe, Co, Zn; dobpdc4− = 4,4′-dioxidobiphenyl-3,3′-dicarboxylate) have been found to capture CO2 through a cooperative mechanism involving the switch-like, reversible polymerization of CO2 in ammonium carbamate chains along the pore axis. Chapter 1 introduces the concept of carbon capture and sequestration, beginning with an overview of common adsorbent classes employed for CO2 capture applications. Opportunities and challenges are subsequently discussed for CO2 removal from individual potential target streams, including the flue emissions of power plants, industrial process streams, and air. Specific reports are selected to highlight recent advances in overcoming stream-specific challenges, such as stability to common adsorbent poisons. The chapter concludes with a discussion of key needs from the materials research community to accelerate greater adoption of carbon capture technologies. Chapter 2 describes the development of alkylethylenediamine-appended variants of Mg2(dobpdc) for carbon capture applications. Small modifications to the diamine structure are shown to shift the threshold pressure for cooperative CO2 adsorption by over 4 orders of magnitude at a given temperature. The observed trends are rationalized on the basis of crystal structures of the isostructural zinc frameworks obtained by in situ single-crystal X-ray diffraction experiments. The structure–activity relationships derived from these results are subsequently shown to enable the optimization of adsorbent design to match the conditions of a given CO2 separation process, thereby minimizing the energetic cost of CO2 capture. Chapter 3 leverages the results of Chapter 2 in the design of a diamine-appended framework for cooperative CO2 capture from the flue emissions of natural gas combined cycle power plants. Due to growing adoption of natural gas as a fuel source, the emissions of gas-fired plants are contributing a growing portion of global CO2 emissions, but CO2 capture from these power plants is hindered by the low CO2 concentration and high oxygen and water content of the flue stream. In this chapter, functionalization of Mg2(dobpdc) with the cyclic diamine 2-(aminomethyl)piperidine (2-ampd) is shown to produce an adsorbent that is capable of >90% CO2 capture from a humid natural gas flue emission stream, as confirmed by breakthrough measurements. Multicomponent adsorption experiments, infrared spectroscopy, magic angle spinning solid-state NMR spectroscopy, and van der Waals-corrected density functional theory studies suggest that water enhances CO2 capture in 2-ampd–Mg2(dobpdc) through hydrogen-bonding interactions with the carbamate groups of the ammonium carbamate chains formed upon CO2 adsorption, thereby increasing the thermodynamic driving force for CO2 binding. The exceptional thermal, oxidative, and cycling stability of this material are subsequently demonstrated, indicating that 2-ampd–Mg2(dobpdc) is a promising adsorbent for this important separation. Chapter 4 describes the development of a diamine-appended framework for CO2 removal from crude natural gas. Due to its low CO2 emission intensity compared to coal, natural gas is favored as a cleaner-burning fuel. However, for many natural gas reserves, CO2 contamination must be removed at the wellhead to meet pipeline specifications. In this chapter, the framework ee-2–Mg2(dobpdc) (ee-2 = N,N-diethylethylenediamine) is demonstrated as a next-generation CO2 capture material for high-pressure natural gas purification. This material can be readily regenerated with a minimal change in temperature or pressure and maintains its CO2 capacity in the presence of water. Moreover, consistent with the results in Chapter 3, breakthrough experiments reveal that water enhances the CO2 capture performance of ee-2–Mg2(dobpdc) by reducing or eliminating “slip” of CO2 prior to full breakthrough. As in Chapter 3, spectroscopic characterization and multicomponent isobars suggest that the enhanced performance under humid conditions arises from preferential stabilization of the CO2-inserted phase in the presence of water. The favorable performance of ee-2–Mg2(dobpdc) is further demonstrated through comparison with a benchmark material for this separation, zeolite 13X, as well as through extended pressure cycling experiments. Finally, Chapter 5 builds upon the previous chapters in this work to advance a diamine-appended framework toward commercialization in upgrading crude biogas to biomethane, a renewable natural gas equivalent. Using the principles outlined in previous chapters, the material dmpn–Mg2(dobpdc) (dmpn = 2,2-dimethyl-1,3-diaminopropane) is identified as a promising candidate for this separation, and its performance in capturing CO2 from CO2/CH4 mixtures is first demonstrated at the laboratory scale. Through a collaboration with Mosaic Materials, a start-up company working to commercialize cooperative adsorbents for CO2 separations, the performance of dmpn–Mg2(dobpdc) is then demonstrated in breakthrough experiments with composite pellets at the 30–50 g scale. Importantly, these experiments enable simultaneous monitoring of heat and mass transfer in the adsorbent bed, resulting in data suitable to inform the development of a process model. Finally, in partnership with the Davis Wastewater Treatment Plant, slipstream tests are conducted with a crude biogas stream containing water, oxygen, H2S, and siloxanes. These early results suggest that dmpn–Mg2(dobpdc) is relatively robust to H2S and can withstand short-term exposure to crude biogas feeds, representative of a process failure in upstream pretreatment units. These results represent a promising step toward the commercialization of cooperative adsorbents for CO2 separations.",
				"language": "en-US",
				"libraryCatalog": "CQVIP",
				"thesisType": "博士学位论文",
				"university": "University of California, Berkeley",
				"url": "https://wwwv3.cqvip.com/doc/degree/3334769152",
				"attachments": [],
				"tags": [
					{
						"tag": "Ammonium carbamate chains"
					},
					{
						"tag": "Carbon dioxide separations"
					},
					{
						"tag": "Greenhouse gas emissions"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cqvip.com/search?k=%E7%8E%B0%E4%BB%A3%E6%B1%89%E8%AF%AD",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.cqvip.com/advancesearch",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.cqvip.com/journal/1022577/column",
		"items": "multiple"
	}
]
/** END TEST CASES **/
