{
	"translatorID": "dea63303-f461-4ee0-94dd-9e314cd52b6b",
	"label": "Wanfang Med",
	"creator": "jiaojiaodubai",
	"target": "^https?://.*med\\.wanfangdata\\.com\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-02-03 10:06:09"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai23 <jiaojiaodubai23@gmail.com>

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


class ID {
	constructor(node, url) {
		this.filename = tryMatch(url, /id=\w+[_/]([\w.% /-]+)/, 1) || attr(node, '.btn-export', 'data-id');
		this.dbname = tryMatch(url, /id=(\w+)[_/][\w.% /-]+/, 1);
		const dbType = {
			PeriodicalPaper: 'journalArticle',
			DegreePaper: 'thesis',
			ConferencePaper: 'conferencePaper',
			Patent: 'patent',
			Cstad: 'report',
			Law: 'statute',
			// eslint-disable-next-line
			Standard_YY: 'standard'
		};
		this.itemType = dbType[this.dbname];
		this.url = url;
	}
}

function detectWeb(doc, url) {
	let dynamic = doc.querySelector('#paper-content-wrap');
	if (dynamic) {
		Z.monitorDOMChanges(dynamic, { childList: true });
	}
	if (getSearchResults(doc, true)) return 'multiple';
	let ids = new ID(doc, url);
	Z.debug(ids);
	return ids.itemType;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('#resultsList > .item .item-title > a');
	for (let row of rows) {
		let title = ZU.trimInternal(row.textContent);
		let href = row.href;
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	Z.debug(items);
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
	Z.debug('--------------- WanFang Med 2024-02-03 13:45:58 ---------------');
	let ids = new ID(doc, url);
	let labels = new Labels(doc, '.details .table > .table-tr');
	var newItem = new Zotero.Item(ids.itemType);
	newItem.title = text(doc, '.headline > h2');
	// Display full abstract
	let clickMore = doc.querySelector('btn-more');
	if (clickMore && clickMore.textContent.includes('收起')) {
		await clickMore.click();
	}
	newItem.abstractNote = text(doc, '.abstracts').replace(/^摘要：\s*/, '').replace(/\s*更多$/, '');
	let breadcrumbs = doc.querySelector('.breadcrumbs');
	let publicationTitle = (breadcrumbs && breadcrumbs.children.length > 3)
		? breadcrumbs.children[breadcrumbs.children.length - 3].textContent
		: '';
	newItem.url = url;
	labels.getWith('作者', true).querySelectorAll('span > a').forEach((creator) => {
		newItem.creators.push(ZU.cleanAuthor(creator.innerText, 'author'));
	});
	labels.getWith('关键词', true).querySelectorAll('a').forEach((tag) => {
		newItem.tags.push(tag.innerText);
	});
	let pdfLink = doc.querySelector('a.lnk-download');
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	extra.add('original-title', text(doc, '.headline > h3'), true);
	extra.add('citation', tryMatch(text(doc, '.statistics .ico-link'), /\d+/));
	switch (newItem.itemType) {
		case 'journalArticle': {
			let pubInfo = labels.getWith('期刊');
			newItem.publicationTitle = publicationTitle;
			newItem.volume = tryMatch(pubInfo, /0*(\d+)卷/, 1);
			newItem.issue = tryMatch(pubInfo, /[A-Z]?0*\d+期/i, 1).replace(/([A-Z]?)0*(\d+)/, '$1$2');
			newItem.pages = tryMatch(pubInfo, /([\d+,~-]+)页/, 1).replace('+', ',').replace('~', '-');
			newItem.date = tryMatch(pubInfo, /(\d+)年/, 1);
			newItem.DOI = labels.getWith('DOI');
			break;
		}
		case 'thesis':
			newItem.university = text(doc, '.breadcrumbs > a[href*="%e6%8e%88%e4%ba%88%e5%8d%95%e4%bd%8d%3d"]');
			newItem.thesisType = `${tryMatch(text(doc, 'a[href*="%e4%b8%93%e4%b8%9a%3d"]'), /（(.*)）/, 1)}学位论文`;
			newItem.date = tryMatch(labels.getWith('学位信息'), /(\d+)年/, 1);
			labels.getWith('导师', true).querySelectorAll('a').forEach((creator) => {
				newItem.creators.push(ZU.cleanAuthor(creator.innerText, 'contributor'));
			});
			break;
		case 'conferencePaper': {
			newItem.date = tryMatch(labels.getWith('会议名称'), /(\d+)年/, 1);
			newItem.conferenceName = publicationTitle;
			newItem.proceedingsTitle = labels.getWith('母体文献');
			newItem.place = text(labels.getWith('会议名称', true), 'a+em');
			break;
		}
		case 'patent': {
			labels.getWith('发明/设计人', true).querySelectorAll('span > a').forEach((creator) => {
				newItem.creators.push(ZU.cleanAuthor(creator.innerText, 'inventor'));
			});
			labels.getWith('代理人', true).querySelectorAll('span').forEach((creator) => {
				newItem.creators.push(ZU.cleanAuthor(creator.innerText, 'attorneyAgent'));
			});
			extra.add('Genre', labels.getWith('专利类型'), true);
			newItem.assignee = labels.getWith('申请/专利权人');
			newItem.patentNumber = labels.getWith('公开/公告号');
			newItem.applicationNumber = labels.getWith('申请/专利号');
			newItem.place = patentCountry(newItem.patentNumber || newItem.applicationNumber);
			newItem.country = newItem.place;
			newItem.filingDate = labels.getWith('申请日期');
			newItem.issueDate = labels.getWith('公开/公告日');
			newItem.legalStatus = labels.getWith('法律状态');
			newItem.rights = labels.getWith('主权项');
			break;
		}
		case 'standard':
			labels.getWith('发布单位', true).querySelectorAll('em').forEach((creator) => {
				newItem.creators.push(ZU.cleanAuthor(creator.innerText, 'author'));
			});
			newItem.number = labels.getWith('标准编号');
			newItem.date = labels.getWith('发布日期');
			newItem.status = labels.getWith('状态');
			extra.add('applyDate', labels.getWith('实施日期'));
			break;
		case 'statute':
			newItem.nameOfAct = newItem.title;
			delete newItem.title;
			labels.getWith(' 颁布部门', true).querySelectorAll('span').forEach((creator) => {
				newItem.creators.push(ZU.cleanAuthor(creator.innerText, 'author'));
			});
			newItem.codeNumber = labels.getWith('发文文号');
			newItem.dateEnacted = labels.getWith('颁布日期');
			break;
		default:
			break;
	}
	newItem.creators.forEach((creator) => {
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
	});
	newItem.extra = extra.toString();
	newItem.complete();
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

class Labels {
	constructor(doc, selector) {
		this.innerData = [];
		Array.from(doc.querySelectorAll(selector))
			.filter(element => element.firstElementChild)
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				let key = elementCopy.removeChild(elementCopy.firstElementChild).innerText.replace(/\s/g, '');
				this.innerData.push([key, elementCopy]);
			});
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

const extra = {
	clsFields: [],
	elseFields: [],
	add: function (key, value, cls = false) {
		if (value && cls) {
			this.clsFields.push([key, value]);
		}
		else if (value) {
			this.elseFields.push([key, value]);
		}
	},
	toString: function (original) {
		return original
			? [
				...this.clsFields.map(entry => `${entry[0]}: ${entry[1]}`),
				original.replace(/^\n|\n$/g, ''),
				...this.elseFields.map(entry => `${entry[0]}: ${entry[1]}`)
			].join('\n')
			: [...this.clsFields, ...this.elseFields]
				.map(entry => `${entry[0]}: ${entry[1]}`)
				.join('\n');
	}
};

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
		"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=PeriodicalPaper_zglcylxzz202306005&dbid=WF_QK",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "美沙拉嗪肠溶片联合保留灌肠对溃疡性结肠炎患者的临床研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "李建升",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "姜川",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "郭林",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "祝颂",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"DOI": "10.13699/j.cnki.1001-6821.2023.06.005",
				"abstractNote": "目的 探讨美沙拉嗪肠溶片联合保留灌肠治疗溃疡性结肠炎(UC)患者的疗效.方法 采用随机数字表法将UC患者分为对照组和试验组.用美沙拉嗪肠溶片给予对照组患者口服治疗,每次1.0 g,每天4次.试验组在对照组的基础上给予美沙拉嗪肠溶液保留灌肠,睡前把灌肠管插入距离患者肛门10～15 cm处,灌入美沙拉嗪灌肠液,每次4 g,每天一次.2组治疗时间均为1个月.比较2组治疗1个月后的临床疗效,治疗前、治疗1个月后的肠黏膜变化、炎症反应、细胞间黏附分子-1(ICAM-1)、血管细胞黏附分子(VCAM-1)、血小板计数(PLT)及血小板体积(MPV),治疗期间的药物不良反应.结果 试验过程中共脱落6例,最终试验组和对照组分别纳入40例,治疗1个月后,试验组及对照组的总有效率分别为92.50％和75.00％;溃疡的患者占比分别为7.50％和25.00％;充血水肿的患者占比分别为22.50％和45.00％;血清白细胞介素1(IL-1)含量分别为(14.65±5.87)和(12.54±4.23)pg·L-1;血清白细胞介素4(IL-4)含量分别为(32.65±4.76)和(29.65±4.54)pg·mL-1;血清C反应蛋白(CRP)含量分别为(5.32±0.43)和(6.54±0.54)mg·L-1;血清肿瘤坏死因子-α(TNF-α)含量分别为(0.12±0.04)和(0.23±0.05)μg·L-1;血清γ干扰素(IFN-γ)含量分别为(174.32±13.27)和(203.21±14.32)μg·L-1;血清ICAM-1含量分别为(44.76±3.29)和(54.32±4.38)ng·mL-1;血清VCAM-1含量分别为(45.32±3.29)和(60.54±3.76)ng·mL-1;外周血PLT数量分别为(170.25±34.64)和(211.54±37.45)×109 cell·L-1;MPV分别为(13.51±4.56)和(11.65±3.21)fL,组间比较,差异均有统计学意义(均P>0.05).试验组和对照组治疗期间的药物不良反应发生率比较,差异无统计学差异(12.50％vs.20.00％,P>0.05).结论 美沙拉嗪肠溶片联合保留灌肠能够有效促进UC患者肠黏膜的修复,减轻患者炎症反应,缓解病情,提高临床疗效,安全性良好.",
				"extra": "original-title: Clinical trial of mesalazine enteric coated tablets combined with retention enema of patients with ulcerative colitis\ncitation: 4",
				"libraryCatalog": "Wanfang Med",
				"pages": "781-785",
				"publicationTitle": "中国临床药理学杂志",
				"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=PeriodicalPaper_zglcylxzz202306005&dbid=WF_QK",
				"volume": "39",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "保留灌肠"
					},
					{
						"tag": "溃疡性结肠炎"
					},
					{
						"tag": "炎症反应"
					},
					{
						"tag": "美沙拉嗪"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=DegreePaper_D03087737&dbid=WF_XW",
		"items": [
			{
				"itemType": "thesis",
				"title": "C-反应蛋白在溃疡性结肠炎中的作用研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "许桃桃",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吉尚戎",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王铭裕",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "目的：C-反应蛋白（CRP）是一种典型的急性期蛋白，在组织发生损伤、感染时其在血液中浓度迅速升高，是炎症反应的非特异性标志物。同时，CRP在固有免疫和后天免疫中起到关键的调节作用，直接参与了很多慢性或急性炎症相关疾病的调控。溃疡性结肠炎（UC）是一种炎症性肠病，发病率在世界范围内逐年升高，持续时间长并反复发作，严重影响患者正常生活。有报道发现， CRP 表达水平的高低与很多药物对 UC 治疗效果的好坏具有显著相关性，但是CRP是否直接参与调控 UC的进展缺乏有力报道。本研究旨在揭示 CRP在 UC小鼠模型中的作用，对今后UC的研究与治疗提供理论指导。<br>　　方法：采用葡聚糖硫酸钠（DSS）诱导C57BL/6J WT野生型与CRP完全敲除型小鼠构建UC小鼠模型，通过小鼠表型（体重、结肠长度与脾脏重量）及系列生理生化指标（疾病活动指数、结肠组织病理学、炎症因子表达、肠道黏液层屏障变化）等，评估CRP对UC小鼠的影响，以及通过外加CRP后测定WT野生型 UC 小鼠表型变化等指标加以确认。从整体、组织和分子三个水平研究CRP对UC小鼠的影响，进一步推断CRP是否直接参与UC进程及可能机制。<br>　　结果：（1）通过表型和组织病理学评价，发现小鼠口服 2%的DSS水溶液一周左右可以诱导UC的发生，成功构建UC小鼠模型（p均lt;0.001）；（2）与WT野生型UC小鼠相比，敲除CRP对UC小鼠表型（体重、结肠长度与脾脏重量）、DAI 评分、炎症因子表达、黏液层相关蛋白分泌及黏液层厚度均无显著性影响（p均gt;0.05），在HE染色分析结肠组织炎症程度的4次实验中仅有1次结果表明敲除CRP可以促进UC小鼠结肠损伤(plt;0.05)，同样在PAS染色中也仅有1次结果表明敲除CRP后UC小鼠的杯状细胞数量显著减少(plt;0.01)；（3）敲除CRP对UC小鼠没有显著影响，可能是小鼠体内CRP处于较低的表达水平，并且急性期仅有 2倍提高，而人急性肠炎中 CRP会高调 100-500倍，可能预示人体内 CRP对 UC的介导依赖于较高的作用浓度，因此我们在野生型小鼠中外加高浓度CRP，使小鼠血浆CRP达到人急性期水平。在WT野生型UC小鼠中外加CRP后发现高浓度CRP对小鼠的表型（体重、结肠长度与脾脏重量）亦无显著性影响（p 均gt;0.05）;（4）考虑到 CRP 的作用可能会被菌群效果所掩盖，因此尝试了抗生素处理，以排除肠道菌群的干扰，结果表明即便无肠道菌群干 扰，WT野生型与 CRP完全敲除型 UC小鼠的表型（体重、结肠长度与脾脏重量）也无显著性差异（p均gt;0.05）；（5）5%高浓度DSS诱导的CRP完全敲除型与WT野生型小鼠的生存率无显著性差异。<br>　　结论：虽然血液中 CRP 水平与 UC 的治愈显著相关，但我们的实验表明CRP 似乎并非是 UC 疾病的直接介导者，更可能是急性肠炎导致炎症因子表达升高，从而促使肝脏分泌更多CRP。我们的结果表明CRP可能仅是UC疾病下游的伴随产物，不具有明显的促炎作用或抑炎作用。但从进化的角度，任何事物的产生都不应该是多余的，考虑到小鼠与人体的巨大差异，对于人体中 CRP的准确功能还需今后的进一步研究。",
				"extra": "citation: 0",
				"libraryCatalog": "Wanfang Med",
				"thesisType": "硕士学位论文",
				"university": "兰州大学",
				"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=DegreePaper_D03087737&dbid=WF_XW",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "C-反应蛋白"
					},
					{
						"tag": "溃疡性结肠炎"
					},
					{
						"tag": "炎症因子"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=ConferencePaper_10629766&dbid=WF_HY",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "益脾祛湿理肠汤治疗溃疡性结肠炎疗效及对患者肠黏膜屏障功能的改善探讨",
				"creators": [
					{
						"firstName": "",
						"lastName": "惠修燕",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "目的:探讨益脾祛湿理肠汤治疗溃疡性结肠炎疗效及对患者肠黏膜屏障功能的改善效果.    方法:从时间2017年02月至2021年02月之间我院收治的溃疡性结肠炎患者中随机抽取100例进行调查,按照双色球法将其分为两个不同小组,参比组50例应用单独西医药物进行治疗,试验组50例在西医药物基础上增加益脾祛湿理肠汤进行治疗,比较两组患者治疗后的中医症状积分、肠黏膜屏蔽功能、临床疗效、药物副作用发生率.    结果:在对溃疡性结肠炎患者进行治疗后,试验组患者的中医症状积分低于参比组(P＜0.05);试验组患者的肠黏膜屏蔽功能好于参比组(P＜0.05);试脸组患者的临床疗效高于参比组(P＜0.05);试验组患者的药物副作用发生率与参比组相比无明显差异性(P＞0.05).    结论:在对溃疡性结肠炎患者进行治疗时,应用益脾祛湿理肠汤治疗能够降低患者中医症状积分,改善肠黏膜屏蔽功能,提高临床疗效,推荐使用.",
				"conferenceName": "健康医学论坛暨《国医经方年鉴》线上交流会",
				"extra": "citation: 0",
				"libraryCatalog": "Wanfang Med",
				"place": "线上",
				"proceedingsTitle": "健康医学论坛暨《国医经方年鉴》线上交流会论文集",
				"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=ConferencePaper_10629766&dbid=WF_HY",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "临床疗效"
					},
					{
						"tag": "溃疡性结肠炎"
					},
					{
						"tag": "益脾祛湿理肠汤"
					},
					{
						"tag": "肠黏膜屏障功能"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=Patent_CN202310400741.8&dbid=WF_ZL",
		"items": [
			{
				"itemType": "patent",
				"title": "一种肢体检测放射影像装置",
				"creators": [
					{
						"firstName": "",
						"lastName": "叶鹏",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "林秀秀",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					}
				],
				"issueDate": "2023-06-27",
				"abstractNote": "本发明公开了一种肢体检测放射影像装置，涉及医疗检查技术领域，包括底板，所述底板的一端顶侧固定有摆动座，所述摆动座上转动装配有第一升降液压缸，所述第一升降液压缸的顶端转动装配在支撑板的一端底侧，所述支撑板的顶侧为弧形面，为了实现单一对肢体进行扫描时，在第二活塞杆的配合下，实现束缚板的摆动，能够配合实现对托板上的肢体进行限位，避免肢体在检测时活动，保证监测效果，提高扫描的准确性，随着束缚板的下压，绷直的束缚带与肢体接触，在束缚板的下压配合下，能够提高对肢体的束缚能力，避免肢体与束缚板和托板之间的空隙太大，提高束缚效果，能够移动实现对患者肢体的扫描，提高扫描效果。",
				"applicationNumber": "CN202310400741.8",
				"assignee": "临清市人民医院",
				"country": "中国",
				"extra": "Genre: 发明专利\ncitation: 0",
				"filingDate": "2023-04-14",
				"legalStatus": "在审",
				"patentNumber": "CN116327231A",
				"place": "中国",
				"rights": "1.一种肢体检测放射影像装置，其特征在于，包括底板(1)，所述底板(1)的一端顶侧固定有摆动座(2)，所述摆动座(2)上转动装配有第一升降液压缸(3)，所述第一升降液压缸(3)的顶端转动装配在支撑板(5)的一端底侧，所述支撑板(5)的顶侧为弧形面，所述支撑板(5)外侧套设有放射筒(8)，所述底板(1)的另一端顶侧固定有第二升降液压缸(4)，所述第二升降液压缸(4)顶端转动装配在支撑板(5)的另一端底侧，所述支撑板(5)上装配有托举组件(7)，所述托举组件(7)包括活动杆(74)，所述支撑板(5)的内部开设有杆孔，所述杆孔内竖直穿插有活动杆(74)，所述活动杆(74)的顶端固定有托板(72)，所述托板(72)与支撑板(5)之间固接有第一弹簧(73)，所述第一弹簧(73)套设在活动杆(74)的顶端，所述支撑板(5)的一侧固定有固定箱(71)，所述固定箱(71)的顶侧设置有安装座(711)，所述安装座(711)上配合装配有束缚板(712)。 2.根据权利要求1所述的一种肢体检测放射影像装置,其特征在于，所述固定箱(71)内开设有气腔(719)，所述气腔(719)内设置有第一活塞(720)，所述第一活塞(720)的底侧固定有第一活塞杆(77)，所述第一活塞杆(77)的底端固定有限位柱(78)。 3.根据权利要求2所述的一种肢体检测放射影像装置,其特征在于，所述固定箱(71)的底侧安装有固定座(76)，所述固定座(76)内部通过销轴配合装配有联动杆(75)，所述联动杆(75)的一端通过销轴配合与活动杆(74)的底端转动连接。 4.根据权利要求3所述的一种肢体检测放射影像装置,其特征在于，所述联动杆(75)的另一端内部开设有滑孔(79)，所述限位柱(78)穿插在滑孔(79)内。 5.根据权利要求4所述的一种肢体检测放射影像装置,其特征在于，所述束缚板(712)的底部内外两侧分别固定有线环和收卷筒(714)，所述收卷筒(714)内部通过发条配合装配有可旋转的线轴，所述束缚板(712)的顶部开设有安装孔，所述安装孔内通过轮轴配合装配有导向轮(713)，其中收卷筒(714)内部的线轴上缠绕有束缚带，所述束缚带的一端绑定在线环上，且束缚带外切环绕通过导向轮(713)。 6.根据权利要求5所述的一种肢体检测放射影像装置,其特征在于，所述束缚板(712)的外侧转动安装有第二活塞杆(716)，所述第二活塞杆(716)上固定有第二活塞(717)，所述固定箱(71)的顶侧转动安装有伸缩缸(715)，所述第二活塞(717)设置在伸缩缸(715)内，所述第二活塞(717)与伸缩缸(715)的缸底之间固接有第二弹簧(718)。 7.根据权利要求6所述的一种肢体检测放射影像装置,其特征在于，所述气腔(719)上连接有泄压管(710)，所述泄压管(710)上装配有泄压阀，所述气腔(719)与伸缩缸(715)的底部通过气管连接。 8.根据权利要求1所述的一种肢体检测放射影像装置,其特征在于，所述支撑板(5)的一侧开设有导向槽(6)，所述导向槽(6)内滑动卡设有滑板(9)，所述滑板(9)上安装有活动马达(10)，所述活动马达(10)的输出端安装有主动齿轮(11)，所述支撑板(5)的侧边固定有齿板(12)，所述主动齿轮(11)与齿板(12)相互啮合，所述滑板(9)上固定有放射筒(8)。",
				"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=Patent_CN202310400741.8&dbid=WF_ZL",
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
		"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=Standard_YY/T%200457.4-2003&dbid=WF_BZ",
		"items": [
			{
				"itemType": "standard",
				"title": "医用电气设备 光电X射线影像增强器特性 第4部分：影像失真的测定",
				"creators": [
					{
						"firstName": "",
						"lastName": "国家食品药品监督管理局",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2003-06-20",
				"abstractNote": "YY/T 0457的本部分适用于作为医用诊断X射线设备部件的光电X射线影像增强器。    本部分描述了测定X射线影像增强器影像失真的方法。",
				"extra": "original-title: Medical electrical equipment-Characteristics of electro-optical X-ray image intensifiers-Part 4:Determination of the image distortion\ncitation: 0\napplyDate: 2004-01-01",
				"libraryCatalog": "Wanfang Med",
				"number": "YY/T 0457.4-2003",
				"status": "现行",
				"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=Standard_YY/T%200457.4-2003&dbid=WF_BZ",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "X射线增强器"
					},
					{
						"tag": "光电增强器"
					},
					{
						"tag": "医用设备"
					},
					{
						"tag": "增强器"
					},
					{
						"tag": "失真测定"
					},
					{
						"tag": "影像增强器"
					},
					{
						"tag": "影像失真"
					},
					{
						"tag": "特性"
					},
					{
						"tag": "电气设备"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://med.wanfangdata.com.cn/Paper/Search?q=%E5%BD%B1%E5%83%8F&%E8%B5%84%E6%BA%90%E7%B1%BB%E5%9E%8B_fl=(%E4%B8%AD%E6%96%87%E6%9C%9F%E5%88%8A%20OR%20%E5%A4%96%E6%96%87%E6%9C%9F%E5%88%8A%20OR%20%E5%AD%A6%E4%BD%8D%E8%AE%BA%E6%96%87%20OR%20%E4%BC%9A%E8%AE%AE%E8%AE%BA%E6%96%87)&SearchMode=Default",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=Law_D462310887&dbid=WF_FG",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "上海市卫生健康委员会关于印发上海市数字医学影像服务质控标准的通知",
				"creators": [],
				"dateEnacted": "2023-01-29",
				"codeNumber": "沪卫医[2023]第7号",
				"extra": "citation: 0",
				"url": "https://med.wanfangdata.com.cn/Paper/Detail?id=Law_D462310887&dbid=WF_FG",
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
	}
]
/** END TEST CASES **/
