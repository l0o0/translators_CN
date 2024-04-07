{
	"translatorID": "eb876bd2-644c-458e-8d05-bf54b10176f3",
	"label": "Wanfang Data",
	"creator": "Ace Strong <acestrong@gmail.com>, rnicrosoft",
	"target": "^https?://.*(d|s)(\\.|-)wanfangdata(\\.|-)com(\\.|-)cn",
	"minVersion": "2.0rc1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-07 02:36:54"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Xingzhong Lin, https://github.com/Zotero-CN/translators_CN

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

// var core = {
// 	PKU: "北大《中文核心期刊要目总览》",
// 	北大核心: "北大《中文核心期刊要目总览》",
// 	ISTIC: "中国科技论文与引文数据库",
// 	CSSCI: "中文社会科学引文索引",
// 	NJU: "中文社会科学引文索引",
// 	CSTPCD: "中文社会科学引文索引",
// 	CSCD: "中国科学引文数据库",
// 	CASS: "《中国人文社会科学核心期刊要览》",
// 	AJ: "俄罗斯《文摘杂志》",
// 	CA: "美国《化学文摘》",
// 	EI: "美国《工程索引》",
// 	SCI: "美国《科学引文索引》",
// 	SCIE: "美国《科学引文索引(扩展版)》",
// 	"A&HCI": "《艺术与人文科学引文索引》",
// 	SSCI: "美国《社会科学引文索引》",
// 	CBST: "日本《科学技术文献速报》",
// 	SA: "英国《科学文摘》",
// 	GDZJ: "广电总局认定学术期刊"
// };

const typeMap = {
	periodical: {
		short: 'perio',
		itemType: 'journalArticle'
	},
	thesis: {
		short: 'degree',
		itemType: 'thesis'
	},
	conference: {
		short: 'conference',
		itemType: 'conferencePaper'
	},
	patent: {
		short: 'patent',
		itemType: 'patent'
	},
	nstr: {
		// 不支持下载
		itemType: 'report'
	},
	cstad: {
		// 不支持下载
		itemType: 'report'
	},
	standard: {
		short: 'standard',
		itemType: 'standard'
	},
	claw: {
		short: 'legislations',
		itemType: 'statute'
	}
};

class ID {
	constructor(docOrElm) {
		// url有时是加密过的字符，而“收藏”按钮上有含id的链接
		let hiddenId = text(docOrElm, 'span.title-id-hidden');
		this.dbname = tryMatch(hiddenId, new RegExp(`(${Object.keys(typeMap).join('|')})_.+$`), 1)
			|| attr(docOrElm, '.collection > wf-favourite', 'literature_type');
		this.filename = tryMatch(hiddenId, new RegExp(`${Object.keys(typeMap).join('|')}_(.+)$`), 1)
			|| attr(docOrElm, '.collection > wf-favourite', 'literature_id');
		this.itemType = typeMap[this.dbname]?.itemType;
		this.shortType = typeMap[this.dbname]?.short;
		this.url = `https://d.wanfangdata.com.cn/${this.dbname}/${this.filename}`;
	}
}

function detectWeb(doc, url) {
	Z.debug("--------------- WanFang Data 2024-04-07 10:36:53 ---------------");
	let dynamic = doc.querySelector('.container-flex, .periodical');
	if (dynamic) {
		Z.monitorDOMChanges(dynamic, { childList: true });
	}
	let ids = new ID(doc, url);
	if (getSearchResults(doc, true)) return 'multiple';
	return ids.itemType
		? ids.itemType
		: false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = Array.from(doc.querySelectorAll('div.normal-list')).filter(row => row.querySelector('.wf-button-quote'));
	for (let i = 0; i < rows.length; i++) {
		let row = rows[i];
		let title = text(row, '.title');
		let filename = text(row, 'span.title-id-hidden');
		if (!filename || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[filename] = `${i + 1}. ${title}`;
	}
	Z.debug(items);
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		Z.debug(items);
		if (!items) return;
		let rows = Array.from(doc.querySelectorAll('div.normal-list'));
		for (let filename of Object.keys(items)) {
			Z.debug(filename);
			let row = rows.find(r => text(r, 'span.title-id-hidden') == filename);
			// Z.debug(row.innerText);
			let cite = row.querySelector('.wf-button-quote');
			if (cite) await cite.click();
			let pane = row.querySelector('.export-tab-pane:nth-last-child(2)');
			let startTime = Date.now();
			while (pane.children.length == 0 && Date.now() - startTime < 5000) {
				await new Promise(resolve => setTimeout(resolve, 200));
			}
			let close = doc.querySelector('.ivu-modal-wrap:not(.ivu-modal-hidden) .ivu-modal-close');
			if (close) await close.click();
			if (pane.children.length > 0) {
				await scrapeRow(row);
			}
		}
	}
	else {
		await scrapePage(doc, url);
	}
}

async function scrapePage(doc, url = doc.location.href) {
	let ids = new ID(doc, url);
	let labels = new LabelsX(doc, '.detailList .list');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	let extra = new Extra();
	let newItem = new Zotero.Item(ids.itemType);
	// .detailTitleCN中可能会含Easy Scholar的标签，es方面已计划修复
	newItem.title = text(doc, '.detailTitleCN > span:first-child') || text(doc, '.detailTitleCN');
	extra.set('original-title', ZU.capitalizeTitle(text(doc, '.detailTitleEN')), true);
	// span.abstractIcon.btn：摘要的详情按钮，多见于学位论文
	// .moreFlex > span:first-child：英文信息的展开按钮
	let clickMore = Array.from(doc.querySelectorAll('span.abstractIcon.btn, .moreFlex > span:first-child'));
	for (let button of clickMore) {
		let buttonText = button.getAttribute('title') || button.innerText;
		if (!buttonText.includes('收起')) await button.click();
	}
	newItem.abstractNote = ZU.trimInternal(text(doc, '.summary > .item+*'));
	doc.querySelectorAll('.author.detailTitle span').forEach((elemant) => {
		newItem.creators.push(cleanAuthor(elemant.innerText.replace(/[\s\d,]*$/, ''), 'author'));
	});
	switch (newItem.itemType) {
		case 'journalArticle': {
			let pubInfo = text(doc, '.publishData > .item+*');
			newItem.date = tryMatch(pubInfo, /^\d{4}/);
			newItem.volume = tryMatch(pubInfo, /,0*(\d+)\(/, 1);
			newItem.issue = tryMatch(pubInfo, /\((.+?)\)/, 1).replace(/0*(\d+)/, '$1');
			newItem.publicationTitle = text(doc, '.periodicalName');
			newItem.pages = tryMatch(labels.getWith('页数'), /\((.+)\)/, 1)
				.replace(/\b0*(\d+)/, '$1')
				.replace(/\+/g, ',')
				.replace(/~/g, '-');
			newItem.DOI = ZU.cleanDOI(text(doc, '.doiStyle > a'));
			newItem.ISSN = ZU.cleanISSN(text(doc, '.periodicalDataItem'));
			break;
		}
		case 'thesis':
			newItem.thesisType = `${text(doc, '.degree > .itemUrl')}学位论文`;
			newItem.university = text(doc, '.detailOrganization');
			doc.querySelectorAll('.tutor > .itemUrl > a').forEach((element) => {
				newItem.creators.push(cleanAuthor(element.innerText, 'contributor'));
			});
			newItem.date = tryMatch(text(doc, '.thesisYear'), /\d+/);
			extra.set('major', text(doc, '.major > .itemUrl'));
			break;
		case 'conferencePaper':
			newItem.date = text(doc, '.meetingDate > .itemUrl');
			newItem.proceedingsTitle = text(doc, '.mettingCorpus > .itemUrl');
			newItem.conferenceName = text(doc, '.mettingName > .itemUrl');
			newItem.place = text(doc, '.meetingArea > .itemUrl');
			newItem.pages = text(doc, '.pageNum > .itemUrl');
			extra.set('organizer', text(doc, '.sponsor > .itemUrl'), true);
			break;
		case 'patent':
			labels.getWith('发明/设计人', true).querySelectorAll('a').forEach((elemant) => {
				newItem.creators.push(cleanAuthor(elemant.innerText, 'inventor'));
			});
			labels.getWith('代理人', true).querySelectorAll('.multi-sep').forEach((elemant) => {
				newItem.creators.push(cleanAuthor(elemant.innerText, 'attorneyAgent'));
			});
			newItem.patentNumber = text(doc, '.publicationNo > .itemUrl');
			newItem.applicationNumber = text(doc, '.patentCode > .itemUrl');
			newItem.country = newItem.place = patentCountry(newItem.patentNumber || newItem.applicationNumber);
			newItem.assignee = labels.getWith('申请/专利权人');
			newItem.filingDate = labels.getWith('申请日期');
			newItem.priorityNumbers = labels.getWith('优先权');
			newItem.issueDate = labels.getWith('公开/公告日');
			newItem.legalStatus = text(doc, '.periodicalContent .messageTime > span:last-child');
			newItem.rights = text(doc, '.signoryItem > .itemUrl');
			extra.set('Genre', text(doc, '.patentType > .itemUrl'), true);
			break;
		case 'report':
			newItem.abstractNote = text(doc, '.abstract > .itemUrl');
			// 成果报告
			newItem.reportNumber = text(doc, '.id > .itemUrl');
			newItem.reportType = {
				nstr: '科技报告',
				cstad: '成果报告'
			}[ids.dbname];
			// 成果报告
			newItem.institution = text(doc, '.organization > .itemUrl');
			// .publishYear > .itemUrl：成果报告
			newItem.date = text(doc, '.preparationTime > .itemUrl, .publishYear > .itemUrl');
			newItem.archiveLocation = text(doc, '.libNum > .itemUrl');
			extra.set('project', text(doc, '.projectName > .itemUrl'));
			// 成果报告
			doc.querySelectorAll('.creator > .itemUrl > .multi-sep').forEach((elemant) => {
				newItem.creators.push(cleanAuthor(elemant.innerText));
			});
			break;
		case 'standard':
			newItem.title = text(doc, '.detailTitleCN').replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/, '$1　$2');
			newItem.number = text(doc, '.standardId > .itemUrl').replace('-', '—');
			newItem.date = text(doc, '.issueDate > .itemUrl');
			newItem.publisher = labels.getWith('出版单位');
			newItem.status = text(doc, '.status > .itemUrl');
			extra.set('CCS', text(doc, '.ccsCode > .itemUrl'));
			extra.set('ICS', text(doc, '.ICSCode > .itemUrl'));
			extra.set('applyDate', text(doc, '.applyDate > .itemUrl'));
			extra.set('substitute', text(doc, '.newStandard > .itemUrl'));
			extra.set('reference', text(doc, '.citeStandard > .itemKeyword'));
			extra.set('adopted', text(doc, '.adoptStandard > .itemUrl'));
			newItem.creators.push(cleanAuthor(text(doc, '.technicalCommittee > .itemUrl').replace(/\(.+?\)$/, '')));
			break;
		case 'statute':
			if (/（\d{4}.*）$/.test(newItem.title)) {
				extra.set('Edition', tryMatch(newItem.title, /（(\d{4}.*)）$/, 1), true);
				newItem.title = tryMatch(newItem.title, /(^.+)（.+?）$/, 1);
			}
			if (newItem.title.startsWith('中华人民共和国')) {
				newItem.shortTitle = newItem.title.substring(7);
			}
			newItem.publicLawNumber = text(doc, '.issueNumber > .itemUrl');
			newItem.dateEnacted = text(doc, '.issueDate > .itemUrl');
			if (!text(doc, '.effectLevel > .itemUrl').includes('法律')) {
				extra.set('Type', 'regulation', true);
			}
			if (text(doc, '.effect > .itemUrl') == '失效') {
				extra.set('Status', '已废止', true);
			}
			extra.set('applyDate', text(doc, '.applyDate > .itemUrl'));
			text(doc, '.issueUnit > .itemUrl').split(/[;，；、]\s?/).forEach(string => newItem.creators.push(cleanAuthor(string)));
			break;
	}
	newItem.url = ids.url;
	extra.set('CLC', text(doc, '.classify > .itemUrl, .classCodeMapping > .itemUrl'));
	doc.querySelectorAll('.keyword > .item+* > a').forEach((element) => {
		newItem.tags.push(element.innerText);
	});
	addAttachment(doc, newItem);
	newItem.extra = extra.toString();
	newItem.complete();
}

async function scrapeRow(row) {
	Z.debug('scrape with row...');
	let ids = new ID(row);
	Z.debug(ids);
	// Refer is better in here.
	let referText = text(row, '.export-tab-pane:nth-last-child(2) > .end-note-list');
	Z.debug('referText:');
	Z.debug(referText);
	referText = referText
		.replace(/\\n/g, '\n')
		.replace(/^%([KAYI]) .*/gm, function (match) {
			let tag = match[1];
			return match.replace(/[,;，；]\s?/g, `\n%${tag} `);
		})
		.replace(/(\n\s*)+/g, '\n');
	Z.debug(referText);
	let translator = Zotero.loadTranslator('import');
	// Refer/BibIX
	translator.setTranslator('881f60f2-0802-411a-9228-ce5f47b64c7d');
	translator.setString(referText);
	translator.setHandler('itemDone', (_obj, item) => {
		if (item.language) {
			item.language = { chi: 'zh-CN', eng: 'en-US' }[item.language] || item.language;
		}
		item.archiveLocation = item?.archiveLocation.replace(/\n.*$/, '');
		addAttachment(row, item);
		item.complete();
	});
	await translator.translate();
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

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

function cleanAuthor(creator, creatorType = 'author') {
	creator = ZU.cleanAuthor(creator, creatorType);
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.fieldMode = 1;
	}
	return creator;
}

function addAttachment(doc, item) {
	let ids = new ID(doc);
	if (ids.shortType) {
		item.attachments.push({
			url: encodeURI('https://oss.wanfangdata.com.cn/www/'
				+ `${doc.title}.ashx?`
				+ 'isread=true'
				+ `&type=${ids.shortType}`
				+ `&resourceId=${ids.filename}`),
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
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
		"url": "https://d.wanfangdata.com.cn/periodical/hgxb2019z1002",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "微波法制备生物柴油研究进展",
				"creators": [
					{
						"firstName": "",
						"lastName": "商辉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "丁禹",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张文慧",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019",
				"ISSN": "0438-1157",
				"abstractNote": "基于微波的选择性、瞬时性及体积性加热的特点,可以有效提高反应分子的平均能量、分子的碰撞频率,加快反应速率,采用微波辅助催化酯交换反应制备生物柴油近几年得到了国内外学者的广泛关注.将微波能应用于生物柴油制备过程具有显著的优势,与传统加热方式相比,采用微波辐射加热,反应时间明显缩短,产物组成也有所变化.因此主要从酸碱催化剂催化酯交换反应和酯化反应的角度,综述了国内外对微波辅助生物柴油制备的研究进展,并对微波优势及未来发展趋势进行了展望.",
				"extra": "original-title: Research progress of microwave assisted biodiesel production\nCLC: TQ51(燃料化学工业（总论）)",
				"issue": "z1",
				"libraryCatalog": "Wanfang Data",
				"pages": "15-22",
				"publicationTitle": "化工学报",
				"url": "https://d.wanfangdata.com.cn/periodical/hgxb2019z1002",
				"volume": "70",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "催化剂"
					},
					{
						"tag": "微波"
					},
					{
						"tag": "生物柴油"
					},
					{
						"tag": "酯交换"
					},
					{
						"tag": "酯化"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/thesis/D01698671",
		"defer": true,
		"items": [
			{
				"itemType": "thesis",
				"title": "济南市生物多样性评价及与生物入侵关系研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "孟令玉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "曲爱军",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2019",
				"abstractNote": "生物多样性是我国生态环境的重要组成部分，也是生态文明建设的重要内容。如何更合理的建立评价生物多样性体系及确定威胁生物多样性相关因素，对政府科学制定生物多样性保护战略规划及行动计划极其重要，对生态文明建设具有重要意义。同时，生物多样性是一种资源，是生物资源的基础，具有多种多样的生态和环境服务功能。　　通过济南市生物多样性现状评价，可明确济南市生物多样性现状、威胁因素和保护现状，有助于济南市资源有效利用与保护，以及相关政府部门科学的制定生物多样性保护战略与具体行动计划。本研究依据环保部生物多样性省域评价体系，组建了暖温带生物多样性评价体系，并依据该两种体系对济南市生物多样性进行了系统评价，并根据评估情况提出了相应建议，评估结果如下：　　1、依据省域生物多样性评价体系评估结果表明，济南市生物多样性处于中等水平，分值为2.9591。其中，植物和动物多样性均处于省内较高水平，分值分别为4.83和4.3908，森林生态系统多样性处于省内中游水平，分值为3.0078，微生物多样性和湿地生态系统多样性处于较差水平，分值分别为1和1.3737；威胁最为严重的是外来物种入侵程度（1.6680），其次为环境污染程度（2.2651）、野生资源的过度利用程度（2.7125）和自然生境破坏程度（3.1427）；迁地保护水平、生境恢复和改善水平处于省内较高水平，分值分别为4和4.3329，自然保护区建设管理较差。　　2、本文首次建立了暖温带评价体系，依据该评价体系，在我国暖温带区域内，济南市生物多样性处于较差水平，分值为2.1640。其中动物多样性均处于暖温带较高水平，分值为4.125，植物多样性、森林生态系统多样性处于省内中游水平，分值分别为2.9488和2.9015，微生物多样性和湿地生态系统多样性处于较差水平，分值分别为1分和1.3098；威胁最为严重的是野生资源的过度利用程度（0.5000），其次为环境污染程度（1.1430）、外来物种入侵程度（1.6680）和自然生境破坏程度（1.8255）。迁地保护水平处于暖温带内较高水平，分值为4，自然保护区建设管理，生境恢复和改善水平较差，类似于省内评价结果。　　3、济南市外来入侵物种共19种，外来入侵物种种类比为1.04%，分布较为广泛，济南市几乎全部区域均受到外来物种的影响。其中对济南市生物多样性威胁最为严重的是美国白蛾（Hyphantria cunea）等昆虫，除生物入侵外，环境污染和野生资源过度利用也对济南市生物多样性造成一定影响。　　本文依据的省域和新组建的生物多样性评价指标体系可为其他地区的生物多样评价提供参考，为济南市生物多样性保护工作方向提供依据，为生物入侵管理和济南市生物资源利用奠定基础。",
				"extra": "major: 植物保护\nCLC: X176(环境生物学)",
				"libraryCatalog": "Wanfang Data",
				"thesisType": "硕士学位论文",
				"university": "山东农业大学",
				"url": "https://d.wanfangdata.com.cn/thesis/D01698671",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "生物入侵"
					},
					{
						"tag": "生物多样性"
					},
					{
						"tag": "评价指标体系"
					},
					{
						"tag": "资源利用"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/conference/9534067",
		"defer": true,
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "生物发酵提高芦笋汁生物利用率研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "吴晓春",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "黄惠华",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018-12-04",
				"abstractNote": "本研究在单因素试验的基础上通过响应面法优化安琪酵母发酵芦笋汁生产工艺,以芦笋汁中总皂苷元含量作为响应值,各影响因素为自变量,设计响应面实验方案.结果表明一次项X1(接种量)、X2(发酵温度)、X3(发酵时间)和所有因素的二次项都达到了极显著水平(P<0.01).并得到安琪酵母发酵芦笋汁的最优生产工艺条件:利用R2A琼脂作为基础培养基接种量0.2％、发酵温度30℃、发酵时间7天.在此条件下重复实验3次,整理结果可知芦笋总皂苷元含量可达到(361.68±8.62)μg.",
				"conferenceName": "2018年广东省食品学会年会",
				"extra": "original-title: Biological Fermentation Improves the Bioavailability of Asparagus Juice\norganizer: 广东省食品学会\nCLC: TS275.5(食品工业)",
				"libraryCatalog": "Wanfang Data",
				"pages": "69-74",
				"place": "广州",
				"proceedingsTitle": "2018年广东省食品学会年会论文集",
				"url": "https://d.wanfangdata.com.cn/conference/9534067",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "总皂苷元含量"
					},
					{
						"tag": "生物利用率"
					},
					{
						"tag": "生物发酵"
					},
					{
						"tag": "芦笋汁"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/patent/CN201880013080.0",
		"defer": true,
		"items": [
			{
				"itemType": "patent",
				"title": "生物体签名系统及生物体签名方法",
				"creators": [
					{
						"firstName": "",
						"lastName": "加贺阳介",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "高桥健太",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "藤尾正和",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈伟",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "沈静",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					}
				],
				"issueDate": "2019-10-11",
				"abstractNote": "生物体签名系统保持将从用户的部位得到的第一生物体信息转换而得到的第一模板和通过单向性转换将从该用户的该部位得到的第二生物体信息进行转换而得到的第二模板，根据认证对象的第一生物体信息生成第一模板，对使用参数修正后的认证对象的第一模板与生物体签名系统保持的第一模板之间的相似度高的该参数进行特定，分别根据分别使用包括该特定出的参数在内的规定范围所包括的参数修正后的认证对象的第二生物体信息，生成第二模板，并将该生成的第二模板分别与生物体签名系统保持的第二模板进行比较来判定认证对象的认证成功与否。",
				"applicationNumber": "CN201880013080.0",
				"assignee": "株式会社日立制作所",
				"country": "中国",
				"extra": "Genre: 发明专利\nCLC: H04L9/32(2006.01)G06F21/32(2013.01)H04L9/32G06F21/32",
				"filingDate": "2018-02-14",
				"legalStatus": "公开",
				"patentNumber": "CN110326254A",
				"place": "中国",
				"priorityNumbers": "2017-114023 2017.06.09 JP",
				"rights": "1.一种生物体签名系统，其特征在于， 包括处理器和存储器， 所述存储器保持第一模板和第二模板，该第一模板表示通过规定的转换将从用户的规定部位得到的第一生物体信息进行转换后的结果，该第二模板表示通过规定的单向性转换将从所述用户的所述规定部位得到的第二生物体信息进行转换后的结果， 所述处理器进行以下处理： 获取认证对象的所述第一生物体信息和所述第二生物体信息， 根据获取到的所述第一生物体信息生成所述认证对象的第一模板， 对使用参数修正后的所述认证对象的第一模板与所述存储器保持的第一模板之间的相似度比规定条件高的所述参数进行特定， 分别使用包括特定出的所述参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息， 分别根据修正后的所述第二生物体信息生成所述认证对象的第二模板， 将生成的所述第二模板分别与所述存储器保持的第二模板进行比较来判定所述认证对象的认证成功与否。 2.根据权利要求1所述的生物体签名系统，其特征在于， 所述处理器通过所述规定的转换对获取到的所述第一生物体信息进行转换而生成所述认证对象的第一模板。 3.根据权利要求1所述的生物体签名系统，其特征在于， 所述处理器通过所述规定的单向性转换对修正后的所述第二生物体信息分别进行转换而生成所述认证对象的第二模板。 4.根据权利要求1所述的生物体签名系统，其特征在于， 储存于所述存储器内的第一生物体信息与第二生物体信息的相关系数为规定值以下。 5.根据权利要求1所述的生物体签名系统，其特征在于， 所述参数包括所述第一模板及所述第二模板的修正中的、表示平行移动量的参数和表示旋转量的参数。 6.根据权利要求1所述的生物体签名系统，其特征在于， 所述存储器保持多个用户的第一模板和第二模板， 所述处理器进行以下处理： 对与所述存储器保持的多个第一模板中的、存在所述相似度比规定条件高的所述参数的第一模板对应的用户群进行特定， 关于特定出的所述用户群的每个用户，分别使用包括特定出的参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息并生成第二模板，并且将该生成的第二模板分别与该用户的第二模板进行比较， 基于分别针对特定出的所述用户群的比较结果来判定所述认证对象的认证成功与否。 7.一种生物体签名方法，由生物体签名系统进行生物体签名，其特征在于， 所述生物体签名系统保持第一模板和第二模板，该第一模板表示通过规定的转换将从用户的规定部位得到的第一生物体信息进行转换后的结果，该第二模板表示通过规定的单向性转换将从所述用户的所述规定部位得到的第二生物体信息进行转换后的结果， 在所述方法中，所述生物体签名系统进行以下处理： 获取认证对象的所述第一生物体信息和所述第二生物体信息， 根据获取到的所述第一生物体信息生成所述认证对象的第一模板， 对使用参数修正后的所述认证对象的第一模板与所述生物体签名系统保持的第一模板之间的相似度比规定条件高的所述参数进行特定， 分别使用包括特定出的所述参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息， 分别从修正后的所述第二生物体信息生成所述认证对象的第二模板， 将生成的所述第二模板分别与所述生物体签名系统保持的第二模板进行比较来判定所述认证对象的认证成功与否。 8.根据权利要求7所述的方法，其特征在于， 在所述方法中，所述生物体签名系统通过所述规定的转换对获取到的所述第一生物体信息进行转换而生成所述认证对象的第一模板。 9.根据权利要求7所述的方法，其特征在于， 在所述方法中，所述生物体签名系统通过所述规定的单向性转换对修正后的所述第二生物体信息分别进行转换而生成所述认证对象的第二模板。 10.根据权利要求7所述的方法，其特征在于， 储存于所述生物体签名系统内的第一生物体信息与第二生物体信息的相关系数为规定值以下。 11.根据权利要求7所述的方法，其特征在于， 所述参数包括所述第一模板及所述第二模板的修正中的、表示平行移动量的参数和表示旋转量的参数。 12.根据权利要求7所述的方法，其特征在于， 所述生物体签名系统保持多个用户的第一模板和第二模板， 在所述方法中，所述生物体签名系统进行以下处理： 对与所述生物体签名系统保持的多个第一模板中的、存在所述相似度比规定条件高的所述参数的第一模板对应的用户群进行特定， 关于特定出的所述用户群的每个用户，分别使用包括特定出的参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息并生成第二模板，并且将该生成的第二模板分别与该用户的第二模板进行比较， 基于分别针对特定出的所述用户群的比较结果来判定所述认证对象的认证成功与否。",
				"url": "https://d.wanfangdata.com.cn/patent/CN201880013080.0",
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
		"url": "https://d.wanfangdata.com.cn/nstr/09146D75-84AB-48CE-A321-369457FD6551",
		"defer": true,
		"items": [
			{
				"itemType": "report",
				"title": "人体安全重要技术标准研制最终报告",
				"creators": [
					{
						"firstName": "",
						"lastName": "汤万金",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨跃翔",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘文",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "郑建国",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王赟松",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2013-09-30",
				"archiveLocation": "306--2013-007964",
				"extra": "project: 人体安全重要技术标准研制",
				"institution": "中国标准化研究院中国标准化研究院中国标准化研究院广东出入境检验检疫局中国标准化研究院",
				"libraryCatalog": "Wanfang Data",
				"reportType": "科技报告",
				"url": "https://d.wanfangdata.com.cn/nstr/09146D75-84AB-48CE-A321-369457FD6551",
				"attachments": [],
				"tags": [
					{
						"tag": "产品安全"
					},
					{
						"tag": "人身安全"
					},
					{
						"tag": "消费品"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/cstad/1500520180",
		"defer": true,
		"items": [
			{
				"itemType": "report",
				"title": "全钒液流电池储能技术及应用",
				"creators": [
					{
						"firstName": "",
						"lastName": "张华民",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "马相坤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李先锋",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘宗浩",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "高素军",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈剑",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015",
				"abstractNote": "该项目属于电化学储能技术领域。能源与环境是人类社会生存的两项基本要素。随着社会与经济的发展，人类对能源的需求量显著增加。化石能源的大量消耗，不仅造成了能源资源匮乏，还造成了严重的环境污染，也严重影响到了人们的身体健康。因此，普及应用可再生能源、提高其在能源消耗中的比重是实现社会可持续发展的必然选择。但是，风能、太阳能等可再生能源发电具有不稳定、不可控的特性，可再生能源大规模并入电网会给电网的安全稳定运行带来严重的冲击。大规模储能系统可有效实现可再生能源发电的调幅调频、平滑输出、跟踪计划发电，提高电网对可再生能源发电的消纳能力，解决弃风、弃光问题，因此是国家实现能源安全、经济可持续发展的重大需求。储能和大容量储能技术是国家《能源发展战略行动计划（2014-2020)》中的重点创新领域和重点创新方向之一。全钒液流电池储能技术具有储能系统的输出功率和储能容量相互独立、储能规模大、设计和安置灵活，使用寿命长，安全可靠，材料和部件可循环利用、环境友好等突出的优势，成为规模储能的首选技术之一。通过多年创新性的研究开发，在液流电池离子传导膜、电极双极板、电解液制造，大功率电堆设计集成，大规模储能系统集成控制等方面取得了一系列技术发明和创新，形成了具有完整自主知识产权体系的全钒液流电池储能技术。1.突破了液流电池关键材料包括非氟离子传导膜、液流电池双极板的制备技术，原创性的研制成功液流电池用高选择性、高传导性、高稳定性非氟多孔离子传导膜，高导电性、高稳定性碳素复合双极板材料。突破了关键材料的规模放大技术，实现了关键材料的工业生产。2.突破了全钒液流电池电堆的设计集成技术，发明了大功率、高功率密度电堆结构设计方法和制造技术，设计集成出32千瓦大功率液流电池单体电堆，突破了单体电堆工程化制造技术，实现了批量化生产，并向国外出口。3.突破了高功率、大容量、高集成度全钒液流电池储能系统设计方法及多体系耦合控制技术，发明了大规模储能系统控制管理策略，实施了迄今为止世界上最大规模的5MW/10MWh全钒液流电池储能系统的商业化应用工程，率先实现了液流电池储能技术的产业化。该项目共获授权发明专利28件，其中日本专利1件。2008年完成国内首套100kW系统的示范应用，2012年完成全球最大规模5MW/10MWh全钒液流电池商业化示范工程，技术指标和工业化进程均处于国际领先水平。已实施20余套应用示范项目。领军能源行业、国家及国际液流电池标准的制定，起草了3项行业标准，5项国家标准和1项国际标准。通过该技术成果的应用，2012年实现销售收入4613万元，2013年销售收入4249万元，2014年销售收入4369万元。对推进中国可再生能源发电的普及应用，实现节能减排重大国策具有十分重要的意义。",
				"extra": "CLC: TM911.3(独立电源技术（直接发电）)",
				"institution": "中国科学院大连化学物理研究所大连融科储能技术发展有限公司",
				"libraryCatalog": "Wanfang Data",
				"reportNumber": "1500520180",
				"reportType": "成果报告",
				"url": "https://d.wanfangdata.com.cn/cstad/1500520180",
				"attachments": [],
				"tags": [
					{
						"tag": "储能系统"
					},
					{
						"tag": "全钒液流电池"
					},
					{
						"tag": "单体电堆"
					},
					{
						"tag": "可再生能源发电"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/standard/ChRTdGFuZGFyZE5ld1MyMDI0MDMyMBIOR0IvVCA3NzE0LTIwMTUaCGZlYnc3YTd3?transaction=%7B%22id%22%3A%22%22,%22transferOutAccountsStatus%22%3A%5B%5D,%22transaction%22%3A%7B%22id%22%3A%221774463618952216576%22,%22status%22%3A1,%22createDateTime%22%3A1711900069355,%22payDateTime%22%3A1711900069355,%22authToken%22%3A%22TGT-2187111-nPPj6nNzKaeXOYIlgakfgjQd4as4qDScfo3yb4LyzKj6AntXP2-auth-iploginservice-7f8df65856-7zhdz%22,%22user%22%3A%7B%22accountType%22%3A%22Group%22,%22key%22%3A%22hebgydx%22%7D,%22transferIn%22%3A%7B%22accountType%22%3A%22Income%22,%22key%22%3A%22StandardDigest%22%7D,%22transferOut%22%3A%7B%22GTimeLimit.hebgydx%22%3A1.0%7D,%22turnover%22%3A1.0,%22orderTurnover%22%3A1.0,%22productDetail%22%3A%22Standard_GB%2FT%207714-2015%22,%22productTitle%22%3A%22%E4%BF%A1%E6%81%AF%E4%B8%8E%E6%96%87%E7%8C%AE%20%20%E5%8F%82%E8%80%83%E6%96%87%E7%8C%AE%E8%91%97%E5%BD%95%E8%A7%84%E5%88%99%22,%22userIP%22%3A%22171.106.70.35%22,%22organName%22%3A%22%E5%93%88%E5%B0%94%E6%BB%A8%E5%B7%A5%E4%B8%9A%E5%A4%A7%E5%AD%A6%22,%22memo%22%3A%22%7B%5C%22expired%5C%22%3A%5C%221800%5C%22%7D%22,%22orderUser%22%3A%22hebgydx%22,%22orderChannel%22%3A%22pc%22,%22payTag%22%3A%22Shibboleth%22,%22webTransactionRequest%22%3A%22%22,%22signature%22%3A%22AmsuJeBsEShVjJn6ys9LuIlja6khQvJPjnS2%2BJU%2BwvTKBeXCX3JeiUeniym%2FTyUCxzM%2Fo7E4j1UG%5CndQtNNyfpETmiKgU%2F6NOcIiX5yNTrB7EPyAK33DRqh1qPdH4CUQD4c2RJTQlVzMS3Y2D3ii4QJD1W%5CnO22dtbwzEqkjZcePHRw%3D%22,%22delete%22%3Afalse%7D,%22isCache%22%3Afalse%7D",
		"defer": true,
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献　参考文献著录规则",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国信息与文献标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-05-15",
				"abstractNote": "本标准规定了各个学科、各种类型信息资源的参考文献的著录项目、著录顺序、著录用符号、著录用文字、各个著录项目的著录方法以及参考文献在正文中的标注法。 本标准适用于著者和编辑著录参考文献，而不是供图书馆员、文献目录编制者以及索引编辑者使用的文献著录规则。",
				"extra": "ICS: 0101.140.20\napplyDate: 2015-12-01\nsubstitute: 该标准替代了如下标准： GB/T 7714-2005;\nreference: GB/T 7408-2005GB/T 28039-2011ISO 4\nadopted: ISO 690:2010(E);",
				"libraryCatalog": "Wanfang Data",
				"number": "GB/T 7714—2015",
				"publisher": "质检出版社",
				"status": "现行",
				"url": "https://d.wanfangdata.com.cn/standard/GB/T 7714-2015",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "书目标准"
					},
					{
						"tag": "参考文献"
					},
					{
						"tag": "规则"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/claw/G001007091",
		"defer": true,
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中华人民共和国刑法修正案（十一）",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国人大常委会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2020-12-26",
				"extra": "applyDate: 2021-03-01",
				"publicLawNumber": "中华人民共和国主席令[2020]第66号",
				"shortTitle": "刑法修正案（十一）",
				"url": "https://d.wanfangdata.com.cn/claw/G001007091",
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
		"url": "https://d.wanfangdata.com.cn/claw/g100001548",
		"defer": true,
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "最高人民法院、最高人民检察院关于依法严惩破坏计划生育犯罪活动的通知",
				"creators": [
					{
						"firstName": "",
						"lastName": "最高人民法院",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "最高人民检察院",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "1993-11-12",
				"extra": "Type: regulation\nStatus: 已废止\napplyDate: 1993-11-12",
				"publicLawNumber": "法发[1993]第36号",
				"url": "https://d.wanfangdata.com.cn/claw/g100001548",
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
		"url": "https://d.wanfangdata.com.cn/claw/G000286112",
		"defer": true,
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
				"dateEnacted": "2018-10-26",
				"extra": "Edition: 2018修正\napplyDate: 2018-10-26",
				"publicLawNumber": "主席令[2018]第15号",
				"shortTitle": "公司法",
				"url": "https://d.wanfangdata.com.cn/claw/G000286112",
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
		"url": "https://s.wanfangdata.com.cn/paper?q=%E9%A3%8E%E6%B9%BF&p=1",
		"defer": true,
		"items": "multiple"
	}
]
/** END TEST CASES **/
