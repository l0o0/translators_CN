{
	"translatorID": "9e3b2f72-ef16-48c8-96d7-5c8898523097",
	"label": "CNKI RefWorks",
	"creator": "jiaojiaodubai",
	"target": "txt",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 99,
	"inRepository": true,
	"translatorType": 1,
	"lastUpdated": "2024-02-07 12:35:49"
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

function detectImport() {
	var fromCNKI = false;
	var haveType = false;
	var line;
	var i = 0;
	while ((line = Zotero.read()) !== false) {
		line = line.replace(/^\s+/, '');
		if (line != '') {
			if (/^RT\s+./.test(line)) {
				haveType = true;
			}
			else if (line == 'DS CNKI') {
				fromCNKI = true;
			}
			else if (i++ > 150) { //skip preamble
				return false;
			}
			if (fromCNKI && haveType) {
				return true;
			}
		}
	}
	return false;
}


async function doImport() {
	var record = '';
	var line;
	var translator = Zotero.loadTranslator('import');
	// RefWorks Tagged
	translator.setTranslator('1a3506da-a303-4b0a-a1cd-f216e6138d86');
	translator.setHandler('itemDone', (_obj, item) => {
		Z.debug(item.itemType);
		Z.debug(record);
		switch (item.itemType) {
			case 'conferencePaper':
				item.proceedingsTitle = item.publicationTitle;
				delete item.publicationTitle;
				extra.add('organizer', tryMatch(record, /^PB (.*)/m, 1));
				delete item.publisher;
				break;
			case 'newspaperArticle':
				delete item.publisher;
				delete item.callNumber;
				break;
			case 'patent':
				if (item.applicationNumber && !item.applicationNumber.includes('海外专利')) {
					extra.add('Genre', item.applicationNumber, true);
				}
				item.patentNumber = tryMatch(record, /^ID (.*)/m, 1);
				delete item.issuingAuthority;
				item.place = patentCountry(item.patentNumber);
				item.country = item.place;
				break;
			case 'statute':
				if (record.includes('年鉴')) {
					item.itemType = 'bookSection';
					item.title = item.nameOfAct;
					delete item.nameOfAct;
					break;
				}
				item.itemType = 'standard';
				item.title = item.nameOfAct;
				delete item.nameOfAct;
				item.creators = [];
				item.date = item.dateEnacted;
				delete item.dateEnacted;
				item.number = tryMatch(record, /^ID (.*)/m, 1);
				delete item.publisher;
				if (item.number.startsWith('GB')) {
					item.number = item.number.replace('-', '——');
					item.title = item.title.replace(/([\u4e00-\u9fff]) ([\u4e00-\u9fff])/, '$1　$2');
				}
				extra.add('applyDate', tryMatch(record, /^U4 (.*)/m, 1));
				break;
			case 'thesis': {
				delete item.issue;
				if (item.thesisType) {
					item.thesisType = `${item.thesisType}学位论文`;
				}
				let supervisors = record.match(/A3 .*/g);
				if (supervisors) {
					supervisors.map(string => string.substring(3)).forEach(supervisor => item.creators.push(ZU.cleanAuthor(supervisor, 'contributor')));
				}
				break;
			}
			case 'report':
				item.reportType = tryMatch(record, /^DB (.*)/m, 1);
				break;
		}
		if (!ZU.fieldIsValidForType('DOI', item.itemType)) {
			extra.add('DOI', item.DOI, true);
			delete item.DOI;
		}
		if (ZU.fieldIsValidForType('pages', item.itemType) && item.pages) {
			item.pages = item.pages
				.replace(/\d+/g, match => match.replace(/0*([1-9]\d*)/, '$1'))
				.replace(/~/g, '-').replace(/\+/g, ', ');
		}
		item.url = tryMatch(record, /^LK (.*)/m, 1);
		item.creators.forEach((creator) => {
			if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
				creator.firstName = creator.firstName || '';
				creator.lastName = creator.firstName + creator.lastName;
				creator.firstName = '';
				creator.fieldMode = 1;
			}
		});
		item.attachments = [];
		item.extra = extra.toString();
		item.complete();
		extra.clsFields = [];
		extra.elseFields = [];
	});
	while ((line = Zotero.read()) !== false) {
		line = line.replace(/^\s+/, '');

		if (/^URL/.test(line)) {
			line = line.replace(/^URL/, 'UL');
		}

		/* Sometimes tag is not capitalized, and there is no space between tag and the content */
		if (Object.keys(tags).some(tag => new RegExp(`^${tag}`, 'i'))) {
			line = line.substring(0, 2).toUpperCase() + ' ' + line.substring(2).trim();
		}
		if (line.startsWith('RT ')) {
			record = processRecord(record);
			Z.debug(record);
			translator.setString(record);
			await translator.translate();
			record = '';
		}
		record += '\n' + line;
	}
	if (record) {
		record = processRecord(record);
		Z.debug(record);
		translator.setString(record);
		await translator.translate();
	}
}

function processRecord(record) {
	return record
		.replace(/^RT\s+Conference Proceeding/gim, 'RT Conference Proceedings')
		.replace(/^RT\s+Dissertation\/Thesis/gim, 'RT Dissertation')
		.replace(/^RT\s+Standard/gim, 'RT Laws')
		.replace(/^RT Other Article/gim, 'RT Report')
		.replace(/^(A\d|K1) .*/gm, (fullMatch, tag) => {
			return fullMatch.replace(/,\s?([\u4e00-\u9fff])/g, `\n${tag} $1`).replace(/[;，；]\s?/g, `\n${tag} `);
		})
		.replace(/^(IS|VO) 0*/gm, '$1 ')
		// If a non-empty line does not contain a tag, it is considered a continuation of the previous line.
		.replace(new RegExp(`\n(?!(${Object.keys(tags).join('|')}) )`, 'g'), '$1')
		.replace(/(\n\s*)+/g, '\n');
}

const tags = {
	RT: 'Reference Type',
	// CNKI's record of this tag is not compliant, but the translator does not process this tag, so we do not fix it
	SR: 'Source Type (field is either Print(0) or  Electronic(1) )',
	ID: 'Reference Identifier',
	A1: 'Primary Authors',
	T1: 'Primary Title',
	JF: 'Periodical Full',
	JO: 'Periodical Abbrev',
	YR: 'Publication Year',
	FD: 'Publication Data, Free Form',
	VO: 'Volume',
	IS: 'Issue',
	SP: 'Start Page',
	OP: 'Other Pages',
	K1: 'Keyword',
	AB: 'Abstract',
	NO: 'Notes',
	A2: 'Secondary Authors',
	T2: 'Secondary Title',
	ED: 'Edition',
	PB: 'Publisher',
	PP: 'Place of Publication',
	A3: 'Tertiary Authors',
	A4: 'Quaternary Authors',
	A5: 'Quinary Authors',
	T3: 'Tertiary Title',
	SN: 'ISSN/ISBN',
	AV: 'Availability',
	AD: 'Author Address',
	AN: 'Accession Number',
	LA: 'Language',
	CL: 'Classification',
	SF: 'Subfile/Database',
	OT: 'Original Foreign Title',
	LK: 'Links',
	DO: 'Digital Object Identifier',
	CN: 'Call Number',
	DB: 'Database',
	DS: 'Data Source',
	IP: 'Identifying Phrase',
	RD: 'Retrieved Date',
	ST: 'Shortened Title',
	U1: 'User 1',
	U2: 'User 2',
	U3: 'User 3',
	U4: 'User 4',
	U5: 'User 5',
	U6: 'User 6',
	U7: 'User 7',
	U8: 'User 8',
	U9: 'User 9',
	U10: 'User 10',
	U11: 'User 11',
	U12: 'User 12',
	U13: 'User 13',
	U14: 'User 14',
	U15: 'User 15',
	UL: 'URL',
	SL: 'Sponsoring Library',
	LL: 'Sponsoring Library Location',
	CR: 'Cited References',
	WT: 'Website Title',
	A6: 'Website editors',
	WV: 'Website version',
	WP: 'Date of Electronic Publication',
	OL: 'Output Language (see codes for specific languages below)',
	PMID: 'PMID',
	PMCID: 'PMCID',
};

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
	toString: function () {
		return [...this.clsFields, ...this.elseFields]
			.map(entry => `${entry[0]}: ${entry[1]}`)
			.join('\n');
	}
};

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
		"type": "import",
		"input": "RT Journal Article\r\nSR 1\r\nA1 薛婉钰;刘娜;苑鑫;张婷婷;曹云娥;陈书霞\r\nAD 西北农林科技大学园艺学院陕西省蔬菜工程技术研究中心;宁夏大学农学院;\r\nT1 黄瓜胚性愈伤组织的诱导保存和再生\r\nJF 西北农林科技大学学报(自然科学版)\r\nYR 2024\r\nIS 07\r\nOP 1-7\r\nK1 黄瓜;遗传转化;胚性愈伤组织;离体保存\r\nAB 【目的】对黄瓜胚性愈伤组织的诱导保存和再生进行研究,为黄瓜高频率遗传转化奠定基础。【方法】以欧洲温室型黄瓜自交系14-1子叶节为外植体,在MS培养基上附加1.5 mg/L 2,4-D,进行25 d的胚性愈伤组织诱导培养后,取胚性愈伤组织在添加30,60,90,100,110,120,130,140和150 g/L蔗糖及1.5 mg/L 2,4-D的MS培养基进行继代培养,每30 d继代1次,观察胚性愈伤组织的褐变情况及胚性分化能力,并用电子天平在超净工作台中记录胚性愈伤组织质量的变化。继代培养60 d后,将保存的胚性愈伤组织和体细胞胚移至含1.5 mg/L 2,4-D的MS培养基上,待出现体细胞胚后移至MS培养基进行萌发,观察再生小植株的生长情况。【结果】将欧洲温室型黄瓜自交系14-1的子叶节,接种到附加1.5 mg/L 2,4-D的MS培养基上进行诱导培养后,子叶节一端的愈伤组织集中聚集于下胚轴处,之后有黄色胚性愈伤组织产生。在继代培养过程中,当培养基中添加的蔗糖为60～150 g/L时,胚性愈伤组织能保持胚性愈伤状态达60 d。之后将继代培养60 d后的胚性愈伤组织转接至附加1.5 mg/L 2,4-D的MS培养基上,在蔗糖质量浓度为60 g/L条件下保存的胚性愈伤组织可诱导出正常胚状体,且能形成健康小植株。【结论】由黄瓜子叶节诱导出的胚性愈伤组织可在MS+60 g/L蔗糖的培养基上保存达60 d,之后能正常萌发形成胚状体,进而形成正常小植株。\r\nSN 1671-9387\r\nDS CNKI\r\nLK https://link.cnki.net/doi/10.13207/j.cnki.jnwafu.2024.07.011\r\nDO 10.13207/j.cnki.jnwafu.2024.07.011\r\n",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "黄瓜胚性愈伤组织的诱导保存和再生",
				"creators": [
					{
						"lastName": "薛婉钰",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "刘娜",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "苑鑫",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "张婷婷",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "曹云娥",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陈书霞",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024",
				"DOI": "10.13207/j.cnki.jnwafu.2024.07.011",
				"ISSN": "1671-9387",
				"abstractNote": "【目的】对黄瓜胚性愈伤组织的诱导保存和再生进行研究,为黄瓜高频率遗传转化奠定基础。【方法】以欧洲温室型黄瓜自交系14-1子叶节为外植体,在MS培养基上附加1.5 mg/L 2,4-D,进行25 d的胚性愈伤组织诱导培养后,取胚性愈伤组织在添加30,60,90,100,110,120,130,140和150 g/L蔗糖及1.5 mg/L 2,4-D的MS培养基进行继代培养,每30 d继代1次,观察胚性愈伤组织的褐变情况及胚性分化能力,并用电子天平在超净工作台中记录胚性愈伤组织质量的变化。继代培养60 d后,将保存的胚性愈伤组织和体细胞胚移至含1.5 mg/L 2,4-D的MS培养基上,待出现体细胞胚后移至MS培养基进行萌发,观察再生小植株的生长情况。【结果】将欧洲温室型黄瓜自交系14-1的子叶节,接种到附加1.5 mg/L 2,4-D的MS培养基上进行诱导培养后,子叶节一端的愈伤组织集中聚集于下胚轴处,之后有黄色胚性愈伤组织产生。在继代培养过程中,当培养基中添加的蔗糖为60～150 g/L时,胚性愈伤组织能保持胚性愈伤状态达60 d。之后将继代培养60 d后的胚性愈伤组织转接至附加1.5 mg/L 2,4-D的MS培养基上,在蔗糖质量浓度为60 g/L条件下保存的胚性愈伤组织可诱导出正常胚状体,且能形成健康小植株。【结论】由黄瓜子叶节诱导出的胚性愈伤组织可在MS+60 g/L蔗糖的培养基上保存达60 d,之后能正常萌发形成胚状体,进而形成正常小植株。",
				"issue": "7",
				"pages": "1-7",
				"publicationTitle": "西北农林科技大学学报(自然科学版)",
				"url": "https://link.cnki.net/doi/10.13207/j.cnki.jnwafu.2024.07.011",
				"attachments": [],
				"tags": [
					{
						"tag": "离体保存"
					},
					{
						"tag": "胚性愈伤组织"
					},
					{
						"tag": "遗传转化"
					},
					{
						"tag": "黄瓜"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "RT Journal Article\r\nSR 1\r\nA1 辛宁;陈建康;陈艳;杨洁\r\nAD 福建医科大学省立临床医学院福建省立医院老年科福建省临床老年病研究所;\r\nT1 多芯片联合分析2型糖尿病发病相关基因及其与阿尔茨海默病的关系\r\nJF 中国医科大学学报\r\nYR 2020\r\nIS 12\r\nvo 49\r\nOP 1106-1111+1117\r\nK1 2型糖尿病;阿尔茨海默病;基因芯片;胰岛炎症反应;数据挖掘\r\nAB 目的利用生物信息学方法探索2型糖尿病发病的相关基因,并研究这些基因与阿尔茨海默病的关系。\r\n方法基因表达汇编(GEO)数据库下载GSE85192、GSE95849、GSE97760、GSE85426数据集,获得健康人和2型糖尿病患者外周血的差异基因,利用加权基因共表达网络(WGCNA)分析差异基因和临床性状的关系。使用DAVID数据库分析与2型糖尿病有关的差异基因的功能与相关通路,筛选关键蛋白。根据结果将Toll样受体4 (TLR4)作为关键基因,利用基因集富集分析(GSEA)分析GSE97760中与高表达TLR4基因相关的信号通路。通过GSE85426验证TLR4的表达量。结果富集分析显示,差异基因主要参与的生物学过程包括炎症反应、Toll样受体(TLR)信号通路、趋化因子产生的正向调节等。差异基因主要参与的信号通路有嘧啶代谢通路、TLR信号通路等。ILF2、TLR4、POLR2G、MMP9为2型糖尿病的关键基因。GSEA显示,TLR4上调可通过影响嘧啶代谢及TLR信号通路而导致2型糖尿病及阿尔茨海默病的发生。TLR4在阿尔茨海默病外周血中高表达。结论 ILF2、TLR4、POLR2G、MMP9为2型糖尿病发病的关键基因,TLR4基因上调与2型糖尿病、阿尔茨海默病发生有关。\r\nSN 0258-4646\r\nDS CNKI\r\nLK https://link.cnki.net/urlid/21.1227.R.20201202.1234.022",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "多芯片联合分析2型糖尿病发病相关基因及其与阿尔茨海默病的关系",
				"creators": [
					{
						"lastName": "辛宁",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陈建康",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陈艳",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "杨洁",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020",
				"ISSN": "0258-4646",
				"abstractNote": "目的利用生物信息学方法探索2型糖尿病发病的相关基因,并研究这些基因与阿尔茨海默病的关系。方法 基因表达汇编(GEO)数据库下载GSE85192、GSE95849、GSE97760、GSE85426数据集,获得健康人和2型糖尿病患者外周血的差异基因,利用加权基因共表达网络(WGCNA)分析差异基因和临床性状的关系。使用DAVID数据库分析与2型糖尿病有关的差异基因的功能与相关通路,筛选关键蛋白。根据结果将Toll样受体4 (TLR4)作为关键基因,利用基因集富集分析(GSEA)分析GSE97760中与高表达TLR4基因相关的信号通路。通过GSE85426验证TLR4的表达量。结果富集分析显示,差异基因主要参与的生物学过程包括炎症反应、Toll样受体(TLR)信号通路、趋化因子产生的正向调节等。差异基因主要参与的信号通路有嘧啶代谢通路、TLR信号通路等。ILF2、TLR4、POLR2G、MMP9为2型糖尿病的关键基因。GSEA显示,TLR4上调可通过影响嘧啶代谢及TLR信号通路而导致2型糖尿病及阿尔茨海默病的发生。TLR4在阿尔茨海默病外周血中高表达。结论 ILF2、TLR4、POLR2G、MMP9为2型糖尿病发病的关键基因,TLR4基因上调与2型糖尿病、阿尔茨海默病发生有关。",
				"issue": "12",
				"pages": "1106-1111, 1117",
				"publicationTitle": "中国医科大学学报",
				"url": "https://link.cnki.net/urlid/21.1227.R.20201202.1234.022",
				"volume": "49",
				"attachments": [],
				"tags": [
					{
						"tag": "2型糖尿病"
					},
					{
						"tag": "基因芯片"
					},
					{
						"tag": "数据挖掘"
					},
					{
						"tag": "胰岛炎症反应"
					},
					{
						"tag": "阿尔茨海默病"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "RT Journal Article\r\nSR 1\r\nA1 颜宏,石德成,尹尚军,赵伟\r\nAD 东北师范大学生命科学学院!长春130024,东北师范大学生命科学学院!长春130024,浙江农业技术师范专科学校!宁波315101,长春飞行学院!长春130022\r\nT1 外施Ca~(2+)、ABA及H_3PO_4对盐碱胁迫的缓解效应\r\nJF 应用生态学报\r\nYR 2000\r\nIS 06\r\nOP 889-892\r\nK1 羊草;盐胁迫;碱胁迫;胁迫缓解;Ca~(2+);脱落酸(ABA);脯氨酸(Pro)\r\nAB 分别对 30 0mmol·L-1NaCl和 10 0mmol·L-1Na2 CO3 盐碱胁迫下的羊草苗进行以不同方式施加Ca2 +、ABA和H3PO4 等缓解胁迫处理 .结果表明 ,外施Ca2 +、ABA和H3PO4 明显缓解了盐碱对羊草生长的抑制作用 .叶面喷施效果好于根部处理 ;施用Ca(NO3) 2 效果好于施用CaCl2 效果 ;混合施用CaCl2 和ABA的效果比单独施用ABA或CaCl2 的效果好 .\r\nSN 1001-9332\r\nDS CNKI\r\nLK https://link.cnki.net/doi/10.13287/j.1001-9332.2000.0212\r\nDO 10.13287/j.1001-9332.2000.0212",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "外施Ca~(2+)、ABA及H_3PO_4对盐碱胁迫的缓解效应",
				"creators": [
					{
						"lastName": "颜宏",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "石德成",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "尹尚军",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "赵伟",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2000",
				"DOI": "10.13287/j.1001-9332.2000.0212",
				"ISSN": "1001-9332",
				"abstractNote": "分别对 30 0mmol·L-1NaCl和 10 0mmol·L-1Na2 CO3 盐碱胁迫下的羊草苗进行以不同方式施加Ca2 +、ABA和H3PO4 等缓解胁迫处理 .结果表明 ,外施Ca2 +、ABA和H3PO4 明显缓解了盐碱对羊草生长的抑制作用 .叶面喷施效果好于根部处理 ;施用Ca(NO3) 2 效果好于施用CaCl2 效果 ;混合施用CaCl2 和ABA的效果比单独施用ABA或CaCl2 的效果好 .",
				"issue": "6",
				"pages": "889-892",
				"publicationTitle": "应用生态学报",
				"url": "https://link.cnki.net/doi/10.13287/j.1001-9332.2000.0212",
				"attachments": [],
				"tags": [
					{
						"tag": "Ca~(2+)"
					},
					{
						"tag": "盐胁迫"
					},
					{
						"tag": "碱胁迫"
					},
					{
						"tag": "羊草"
					},
					{
						"tag": "胁迫缓解"
					},
					{
						"tag": "脯氨酸(Pro)"
					},
					{
						"tag": "脱落酸(ABA)"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "RT Dissertation/Thesis\r\nSR 1\r\nA1林行众\r\nA3 黄三文;杨清\r\nPB 南京农业大学\r\nT1 黄瓜共表达基因模块的识别及其特点分析\r\nCL 硕士\r\nYR 2015\r\nIS 06\r\nK1 黄瓜;共表达;网络;转录组\r\nAB 黄瓜(Cucumis sativus L.)是我国最大的保护地栽培蔬菜作物\r\n,也是植物性别发育和维管束运输研究的重要模式植物。黄瓜基因组序列\r\n图谱已经构建完成,并且在此基础上又完成了全基因组SSR标记开发和涵盖330万个变异位点变异组图谱,成为黄瓜功能基因研究的重要平台和工具,相关转录组研究也有很多报道,不过共表达网络研究还是空白。本实验以温室型黄瓜9930为研究对象,选取10个不同组织,进行转录组测序,获得10份转录组原始数据。在对原始数据去除接头与低质量读段后,将高质量读段用Tophat2回贴到已经发表的栽培黄瓜基因组序列上。用Cufflinks对回贴后的数据计算FPKM值,获得10份组织的24274基因的表达量数据。计算结果中的回贴率比较理想,不过有些基因的表达量过低。为了防止表达量低的基因对结果的影响,将10份组织中表达量最大小于5的基因去除,得到16924个基因,进行下一步分析。共表达网络的构建过程是将上步获得的表达量数据,利用R语言中WGCNA(weighted gene co-expression network analysis)包构建共表达网络。结果得到的共表达网络包括1134个模块。这些模块中的基因表达模式类似,可以认为是共表达关系。不过结果中一些模块内基因间相关性同其他模块相比比较低,在分析过程中,将模块中基因相关性平均值低于0.9的模块都去除,最终得到839个模块,一共11,844个基因。共表达的基因因其表达模式类似而聚在一起,这些基因可能与10份组织存在特异性关联。为了计算模块与组织间的相关性,首先要对每个模块进行主成分分析(principle component analysis,PCA),获得特征基因(module eigengene,ME),特征基因可以表示这个模块所有基因共有的表达趋势。通过计算特征基因与组织间的相关性,从而挑选出组织特异性模块,这些模块一共有323个。利用topGO功能富集分析的结果表明这些特异性模块所富集的功能与组织相关。共表达基因在染色体上的物理位置经常是成簇分布的。按照基因间隔小于25kb为标准。分别对839个模块进行分析,结果发现在71个模块中共有220个cluster,这些cluster 一般有2～5个基因,cluster中的基因在功能上也表现出一定的联系。共表达基因可能受到相同的转录调控,这些基因在启动子前2kb可能会存在有相同的motif以供反式作用元件的结合起到调控作用。对839个模块中的基因,提取启动子前2kb的序列,上传到PLACE网站进行motif分析。显著性分析的结果表明一共有367个motif存在富集,其中6个motif已经证实在黄瓜属植物中发挥作用。最后结合已经发表的黄瓜苦味生物合成途径研究,找到了 3个模块,已经找到的11个基因中,有10个基因在这4个模块中。这些模块的功能富集也显示与苦味合成相关,同时这些参与合成的基因在染色体上也成簇分布。本论文所描述的方法结合了转录组测序与网络分析方法,发现了黄瓜中的共表达基因模块,为黄瓜基因的共表达分析提供了非常重要的研究基础和数据支持。\r\nLA 中文;\r\nDS CNKI\r\nLK https://kns.cnki.net/kcms2/article/abstract?v=-0THPtffOh067kQnOJah9lvtW1IcUZ4IVPw6j59nzjr0p0tmZJXjtMak4QvF1x-q-8HZYETHCFoTeU7Gwm1pyArvivX6x-EAWniJf6srkIPpMYoMF79WDeKYVS_Ooy3nehicUEg1_lQ8D6ku5b0Wfg==&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "thesis",
				"title": "黄瓜共表达基因模块的识别及其特点分析",
				"creators": [
					{
						"lastName": "林行众",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "黄三文",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨清",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2015",
				"abstractNote": "黄瓜(Cucumis sativus L.)是我国最大的保护地栽培蔬菜作物,也 是植物性别发育和维管束运输研究的重要模式植物。黄瓜基因组序列图谱 已经构建完成,并且在此基础上又完成了全基因组SSR标记开发和涵盖330万个变异位点变异组图谱,成为黄瓜功能基因研究的重要平台和工具,相关转录组研究也有很多报道,不过共表达网络研究还是空白。本实验以温室型黄瓜9930为研究对象,选取10个不同组织,进行转录组测序,获得10份转录组原始数据。在对原始数据去除接头与低质量读段后,将高质量读段用Tophat2回贴到已经发表的栽培黄瓜基因组序列上。用Cufflinks对回贴后的数据计算FPKM值,获得10份组织的24274基因的表达量数据。计算结果中的回贴率比较理想,不过有些基因的表达量过低。为了防止表达量低的基因对结果的影响,将10份组织中表达量最大小于5的基因去除,得到16924个基因,进行下一步分析。共表达网络的构建过程是将上步获得的表达量数据,利用R语言中WGCNA(weighted gene co-expression network analysis)包构建共表达网络。结果得到的共表达网络包括1134个模块。这些模块中的基因表达模式类似,可以认为是共表达关系。不过结果中一些模块内基因间相关性同其他模块相比比较低,在分析过程中,将模块中基因相关性平均值低于0.9的模块都去除,最终得到839个模块,一共11,844个基因。共表达的基因因其表达模式类似而聚在一起,这些基因可能与10份组织存在特异性关联。为了计算模块与组织间的相关性,首先要对每个模块进行主成分分析(principle component analysis,PCA),获得特征基因(module eigengene,ME),特征基因可以表示这个模块所有基因共有的表达趋势。通过计算特征基因与组织间的相关性,从而挑选出组织特异性模块,这些模块一共有323个。利用topGO功能富集分析的结果表明这些特异性模块所富集的功能与组织相关。共表达基因在染色体上的物理位置经常是成簇分布的。按照基因间隔小于25kb为标准。分别对839个模块进行分析,结果发现在71个模块中共有220个cluster,这些cluster 一般有2～5个基因,cluster中的基因在功能上也表现出一定的联系。共表达基因可能受到相同的转录调控,这些基因在启动子前2kb可能会存在有相同的motif以供反式作用元件的结合起到调控作用。对839个模块中的基因,提取启动子前2kb的序列,上传到PLACE网站进行motif分析。显著性分析的结果表明一共有367个motif存在富集,其中6个motif已经证实在黄瓜属植物中发挥作用。最后结合已经发表的黄瓜苦味生物合成途径研究,找到了 3个模块,已经找到的11个基因中,有10个基因在这4个模块中。这些模块的功能富集也显示与苦味合成相关,同时这些参与合成的基因在染色体上也成簇分布。本论文所描述的方法结合了转录组测序与网络分析方法,发现了黄瓜中的共表达基因模块,为黄瓜基因的共表达分析提供了非常重要的研究基础和数据支持。",
				"language": "中文;",
				"thesisType": "硕士学位论文",
				"university": "南京农业大学",
				"url": "https://kns.cnki.net/kcms2/article/abstract?v=-0THPtffOh067kQnOJah9lvtW1IcUZ4IVPw6j59nzjr0p0tmZJXjtMak4QvF1x-q-8HZYETHCFoTeU7Gwm1pyArvivX6x-EAWniJf6srkIPpMYoMF79WDeKYVS_Ooy3nehicUEg1_lQ8D6ku5b0Wfg==&uniplatform=NZKPT&language=CHS",
				"attachments": [],
				"tags": [
					{
						"tag": "共表达"
					},
					{
						"tag": "网络"
					},
					{
						"tag": "转录组"
					},
					{
						"tag": "黄瓜"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "RT Dissertation/Thesis\r\nSR 1\r\nA1虞锦洪\r\nA3 江平开\r\nPB 上海交通大学\r\nT1 高导热聚合物基复合材料的制备与性能研究\r\nCL 博士\r\nYR 2012\r\nIS 10\r\nK1 导热;介电;环氧树脂;聚偏氟乙烯;氧化铝;石墨烯;氮化硼;复合材料\r\nAB 随着微电子集成技术和组装技术的快速发展，电子元器件和逻辑电路的体积越来越小，而工作频率急剧增加，半导体的环境温度向高温方向变化，为保证电子元器件长时间可靠地正常工作，及时散热能力就成为其使用寿命长短的制约因素。高导热聚合物基复合材料在微电子、航空、航天、军事装备、电机电器等诸多制造业及高科技领域发挥着重要的作用。所以研制综合性能优异的高导热聚合物基复合材料成为了目前研究热点。本论文分别以氧化铝（Al_2O_3）、石墨烯和氮化硼（BN）纳米片为导热填料，以环氧树脂和聚偏氟乙烯（PVDF）为基体，制备了新型的高导热聚合物基复合材料。",
		"items": [
			{
				"itemType": "thesis",
				"title": "高导热聚合物基复合材料的制备与性能研究",
				"creators": [
					{
						"lastName": "虞锦洪",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "江平开",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2012",
				"abstractNote": "随着微电子集成技术和组装技术的快速发展，电子元器件和逻辑电路的体积越来越小，而工作频率急剧增加，半导体的环境温度向高温方向变化，为保证电子元器件长时间可靠地正常工作，及时散热能力就成为其使用寿命长短的制约因素。高导热聚合物基复合材料在微电子、航空、航天、军事装备、电机电器等诸多制造业及高科技领域发挥着重要的作用。所以研制综合性能优异的高导热聚合物基复合材料成为了目前研究热点。本论文分别以氧化铝（Al_2O_3）、石墨烯和氮化硼（BN）纳米片为导热填料，以环氧树脂和聚偏氟乙烯（PVDF）为基体，制备了新型的高导热聚合物基复合材料。",
				"thesisType": "博士学位论文",
				"university": "上海交通大学",
				"attachments": [],
				"tags": [
					{
						"tag": "介电"
					},
					{
						"tag": "复合材料"
					},
					{
						"tag": "导热"
					},
					{
						"tag": "氧化铝"
					},
					{
						"tag": "氮化硼"
					},
					{
						"tag": "环氧树脂"
					},
					{
						"tag": "石墨烯"
					},
					{
						"tag": "聚偏氟乙烯"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "RT Conference Proceeding\r\nSR 1\r\nA1朱延平\r\nAD 中国社会科学院考古研究所;\r\nT1 辽西区新石器时代考古学文化纵横\r\nJF 内蒙古东部区考古学文化研究文集\r\nPB 中国社会科学院考古研究所、内蒙古文物考古研究所、赤峰市文化局\r\nPP 中国内蒙古赤峰\r\nYR 1990\r\nOP 13-18\r\nAB 辽西区的范围从大兴安岭南缘到渤海北岸,西起燕山西段,东止辽河平原,基本上包括内蒙古的赤峰市(原昭乌达盟)、哲里木盟西半部,辽宁省西部和河北省的承德、唐山、廊坊及其邻近的北京、天津等地区。这一地区的古人类遗存自旧石器时代晚期起,就与同属东北的辽东区有着明显的不同,在后来的发展中,构成自具特色的一个考古学文化区,对我国东北部起过不可忽视的作用。以下就辽西地区新石器时代的考古学文化序列、编年、谱系及有关问题简要地谈一下自己的认识。\r\nDS CNKI\r\nLK https://kns.cnki.net/kcms2/article/abstract?v=-0THPtffOh3TBfxRkxXOA-9Y5LaVD74WITIEg8YFa6dRXWB5id0VkG-_H2873QgNiyGDHEylNHW23-Dmpzs-ZSYlPkAsbYYxLzGtqFZLZwFb4rx-QiIy47GRjPvtgJe4iAZsq28gVtRxlKy7SknWOQ==&amp;uniplatform=NZKPT&amp;language=CHS",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "辽西区新石器时代考古学文化纵横",
				"creators": [
					{
						"lastName": "朱延平",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1990",
				"abstractNote": "辽西区的范围从大兴安岭南缘到渤海北岸,西起燕山西段,东止辽河平原,基本上包括内蒙古的赤峰市(原昭乌达盟)、哲里木盟西半部,辽宁省西部和河北省的承德、唐山、廊坊及其邻近的北京、天津等地区。这一地区的古人类遗存自旧石器时代晚期起,就与同属东北的辽东区有着明显的不同,在后来的发展中,构成自具特色的一个考古学文化区,对我国东北部起过不可忽视的作用。以下就辽西地区新石器时代的考古学文化序列、编年、谱系及有关问题简要地谈一下自己的认识。",
				"extra": "organizer: 中国社会科学院考古研究所、内蒙古文物考古研究所、赤峰市文化局",
				"pages": "13-18",
				"proceedingsTitle": "内蒙古东部区考古学文化研究文集",
				"url": "https://kns.cnki.net/kcms2/article/abstract?v=-0THPtffOh3TBfxRkxXOA-9Y5LaVD74WITIEg8YFa6dRXWB5id0VkG-_H2873QgNiyGDHEylNHW23-Dmpzs-ZSYlPkAsbYYxLzGtqFZLZwFb4rx-QiIy47GRjPvtgJe4iAZsq28gVtRxlKy7SknWOQ==&amp;uniplatform=NZKPT&amp;language=CHS",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "RT Newspaper Article\r\nSR 1\r\nA1 刘霞\r\nT1 灭绝物种RNA首次分离测序\r\nJF 科技日报\r\nOP 004\r\nFD 2023-09-21\r\nPB 科技日报\r\nLA 中文;\r\nCN 11-0315\r\nDS CNKI\r\nLK https://link.cnki.net/doi/10.28502/n.cnki.nkjrb.2023.005521\r\nDO 10.28502/n.cnki.nkjrb.2023.005521",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "灭绝物种RNA首次分离测序",
				"creators": [
					{
						"lastName": "刘霞",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-09-21",
				"extra": "DOI: 10.28502/n.cnki.nkjrb.2023.005521",
				"language": "中文;",
				"pages": "4",
				"publicationTitle": "科技日报",
				"url": "https://link.cnki.net/doi/10.28502/n.cnki.nkjrb.2023.005521",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "RT Standard\r\nSR 1\r\nT1 大事记　大事记\r\nK1 大事记\r\nURL https://kns.cnki.net/kcms2/article/abstract?v=-0THPtffOh15KH8MDjCNQ5KQVP6t7fs-Ow8_CKlNv8lH6u0krLPNoJAhUAetl7Fj9P3Q-krbt0cW7jHD4ts-_YuTr9gf9VZHR4ngtU6Jb7LPtrn7LKkTDQxRlRQaAUSxEN2HSyfU4tONyO61Fw_-KQ==&amp;uniplatform=NZKPT&amp;language=CHS\r\nDB 年鉴\r\nDS CNKI",
		"items": [
			{
				"itemType": "bookSection",
				"title": "大事记　大事记",
				"creators": [],
				"attachments": [],
				"tags": [
					{
						"tag": "大事记"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "RT Standard\r\nSR 1\r\nC1 GB/T 7714-2015\r\nT1 信息与文献　参考文献著录规则\r\nA1 北京大学信息管理系;中国科学技术信息研究所;北京师范大学学报(自然科学版)编辑部;北京大学学报(哲学社会科学版)编辑部;中国科学院文献情报中心\r\nPB 中华人民共和国国家质量监督检验检疫总局;中国国家标准化管理委员会\r\nFD 2015-05-15\r\nU4 2015-12-01\r\nID GB/T 7714-2015\r\nK1 参考文献著录\r\nURL https://kns.cnki.net/kcms2/article/abstract?v=-0THPtffOh00JB5Z9CHU6lQVSx18AmafJZeJhSoiTGAgHvDF6DzXn86h63xRGxMbxiLcNNJ9tH7KahkAHrg_2yeTiUGo4LszZ5cA1X7ID3Z4xZw47Y1OwppKQ0se7eqqI1KxlSihqA8=&amp;uniplatform=NZKPT&amp;language=CHS\r\nDB 国家标准\r\nDS CNKI",
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献　参考文献著录规则",
				"creators": [],
				"date": "2015-05-15",
				"extra": "applyDate: 2015-12-01",
				"number": "GB/T 7714-2015",
				"attachments": [],
				"tags": [
					{
						"tag": "参考文献著录"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "RT Patent\r\nSR 1\r\nA1  施吉庆;   杨亮华\r\nA2 扬中市旭禾管业制造有限公司\r\nT1 不锈钢管的制造方法\r\nAD 212214 江苏省镇江市扬中市三茅街道丰联西路1号\r\nFD 2020-04-17\r\nID CN111020404A\r\nCL 发明公开\r\nAB 本发明提供不锈钢管的制造方法,包括如下步骤：S1、管坯加工：将管坯加工成坯料,且坯料的化学组成质量百分比计为：C：0.04-0.06%；Cr：15-21%；Ti：0.1-0.3%；Ni：1.5-9%；Mn：0.1～1.3%；Cu：1.5～3.5%；S：0.002-0.004%；余量为Fe以及不可避免的杂质。本发明通过对坯料进行预热处理,将工件加热到预定温度,并保持一定的时间,将预热后的坯料分别采用两种不同的温度进行处理,且两次处理前后衔接,解决了现有的不锈钢管在生产工艺方面,缺乏对不锈钢管强度的提升,强度较低,导致其在使用过程中,局限性较大,在很多高强度的压力下,易出现折断,不仅大大缩短了不锈钢管的使用寿命,而且存在较大安全隐患的问题。\r\nDB 中国专利\r\nDS CNKI",
		"items": [
			{
				"itemType": "patent",
				"title": "不锈钢管的制造方法",
				"creators": [
					{
						"lastName": "施吉庆",
						"firstName": "",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "杨亮华",
						"firstName": "",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2020-04-17",
				"abstractNote": "本发明提供不锈钢管的制造方法,包括如下步骤：S1、管坯加工：将管坯加工成坯料,且坯料的化学组成质量百分比计为：C：0.04-0.06%；Cr：15-21%；Ti：0.1-0.3%；Ni：1.5-9%；Mn：0.1～1.3%；Cu：1.5～3.5%；S：0.002-0.004%；余量为Fe以及不可避免的杂质。本发明通过对坯料进行预热处理,将工件加热到预定温度,并保持一定的时间,将预热后的坯料分别采用两种不同的温度进行处理,且两次处理前后衔接,解决了现有的不锈钢管在生产工艺方面,缺乏对不锈钢管强度的提升,强度较低,导致其在使用过程中,局限性较大,在很多高强度的压力下,易出现折断,不仅大大缩短了不锈钢管的使用寿命,而且存在较大安全隐患的问题。",
				"applicationNumber": "发明公开",
				"country": "中国",
				"extra": "Genre: 发明公开",
				"patentNumber": "CN111020404A",
				"place": "中国",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "import",
		"input": "RT Other Article\r\nSR 1\r\nT1 25MW/100MWh液流电池长时储能系统关键技术研发与示范\r\nA1 孟青\r\nAD 山西国润储能科技有限公司\r\nFD 2023-02-01\r\nK1 液流电池;储能系统;关键技术研发;电解液活性;储能电站\r\nAB 本项目拟通过分析材料、电堆、电解液和模块性能提升、成本控制制约因素,将关键材料性能提升与电堆结构优化设计以及系统电气、智能控制设施等的优化研究相结合,以最大限度地提升性能、降低系统成本。针对液流电池电解液活性物种溶解度不高,高、低温稳定性差,长期循环过程中容量衰减和效率降低问题,开发高浓度、高稳定性、活性电解液配方与制备工艺。在功率单元和能量单元性能优化基础上,以可靠性和系统性能优化为目标,分析指标,开发储能单元模块,以此为基础设计储能电站工程,针对工程应用开发调控和运维平台,形成示范应用及经济性分析。\r\nDB 科技成果",
		"items": [
			{
				"itemType": "report",
				"title": "25MW/100MWh液流电池长时储能系统关键技术研发与示范",
				"creators": [
					{
						"lastName": "孟青",
						"firstName": "",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-02-01",
				"abstractNote": "本项目拟通过分析材料、电堆、电解液和模块性能提升、成本控制制约因素,将关键材料性能提升与电堆结构优化设计以及系统电气、智能控制设施等的优化研究相结合,以最大限度地提升性能、降低系统成本。针对液流电池电解液活性物种溶解度不高,高、低温稳定性差,长期循环过程中容量衰减和效率降低问题,开发高浓度、高稳定性、活性电解液配方与制备工艺。在功率单元和能量单元性能优化基础上,以可靠性和系统性能优化为目标,分析指标,开发储能单元模块,以此为基础设计储能电站工程,针对工程应用开发调控和运维平台,形成示范应用及经济性分析。",
				"reportType": "科技成果",
				"attachments": [],
				"tags": [
					{
						"tag": "储能电站"
					},
					{
						"tag": "储能系统"
					},
					{
						"tag": "关键技术研发"
					},
					{
						"tag": "液流电池"
					},
					{
						"tag": "电解液活性"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
