{
	"translatorID": "7fdba422-8405-4fb4-8e06-a6cc2297d9d9",
	"label": "CQVIP Knowledge",
	"creator": "jiaojiaodubai",
	"target": "^https?://k\\.vipslib\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-08-17 07:39:28"
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


function detectWeb(doc, _) {
	const panel = doc.querySelector('#articlelist, .j-d-articles');
	if (panel) {
		Z.monitorDOMChanges(panel, { subtree: true, childList: true });
	}
	let typeKey = attr(doc, 'h1 > i', 'class');
	if (typeKey && typeKey != 'text-journal') {
		typeKey = typeKey.substring(5);
		return {
			article: 'journalArticle',
			book: 'book',
			paper: 'thesis',
			meeting: 'conferencePaper',
			standard: 'standard',
			patent: 'patent',
			laws: 'statute',
			// 案例库的标题不完整，且只有案号和发布日期，信息过于粗糙，暂不适配
			// judicialcase: 'case',
			achievements: 'report',
			newspaper: 'newspaperArticle'
		}[typeKey];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	// http://k.cqvip.com/asset/search?key=VSUzRCVFOSU5QiU5NSVFNSVBMSU5MQ==&cf=&skey=MF9VXyUyNUU5JTI1OUIlMjU5NSUyNUU1JTI1QTElMjU5MQ==
	// http://k.cqvip.com/asset/journal/20210001787
	// http://k.cqvip.com/asset/guidelist
	const rows = Array.from(doc.querySelectorAll('#articlelist dl, .j-d-articles li')).filter(row => row.querySelector('dt:first-child > a, a'));
	for (const row of rows) {
		const doi = row.querySelector('.doi > i > a');
		const href = row.querySelector('dt:first-child > a, a').href;
		const title = attr(row, 'dt:first-child > a, a', 'title') || ZU.trimInternal(row.querySelector('dt:first-child > a, a', 'title').textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[JSON.stringify({
			url: href,
			doi: doi ? doi.href : ''
		})] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const key of Object.keys(items).map(aKey => JSON.parse(aKey))) {
			// 需要浏览器环境
			const newItem = await scrape(await requestDocument(key.url));
			if (ZU.fieldIsValidForType('DOI', newItem.itemType)) {
				newItem.DOI = ZU.cleanDOI(key.doi);
			}
			else {
				const extra = new Extra();
				extra.set('DOI', ZU.cleanDOI(key.doi), true);
				newItem.extra = extra.toString(newItem.extra);
			}
			newItem.complete();
		}
	}
	else {
		const newItem = await scrape(doc, url);
		newItem.complete();
	}
}

async function scrape(doc, url = doc.location.href) {
	Z.debug(doc.body.innerText);
	let creators = [];
	let creatorsEn = [];
	const labels = new LabelsX(doc, '.article-detail > p');
	const extra = new Extra();
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	const newItem = new Z.Item(detectWeb(doc, url));
	newItem.title = attr(doc, '.article-summary > h1', 'title').replace(/_\((.+?)\)/g, '<sub>$1</sub>').replace(/_(\d)/g, '<sub>$1</sub>');
	extra.set('original-title', text(doc, '.article-summary > em').replace(/_\((.+?)\)/g, '<sub>$1</sub>').replace(/_(\d)/g, '<sub>$1</sub>'), true);
	newItem.abstractNote = labels.getWith('摘要');
	switch (newItem.itemType) {
		case 'journalArticle': {
			newItem.publicationTitle = attr(doc, 'a[href*="/asset/journal/"]', 'title');
			extra.set('original-container-title', tryMatch(labels.getWith('出版物'), /\((\w+)\)$/, 1), true);
			const pubInfo = labels.getWith('年卷期');
			newItem.volume = tryMatch(pubInfo, /第0*(\d+)卷/, 1);
			newItem.issue = tryMatch(pubInfo, /第([A-Z\d]+)期/, 1).replace(/0*(\d)/, '$1');
			newItem.pages = labels.getWith('页码').replace(/\+/g, ', ').replace(/~/g, '-');
			newItem.date = tryMatch(pubInfo, /^(\d{4})年/, 1);
			creators = Array.from(doc.querySelectorAll('.author > a')).map(element => cleanAuthor(ZU.trimInternal(element.textContent)));
			creatorsEn = text(doc, '.author > em').split(/[;，；]\s*/).map(enName => ZU.capitalizeName(enName));
			extra.set('foundation', labels.getWith('基金'));
			break;
		}
		case 'book':
			newItem.series = labels.getWith('丛书名');
			// http://k.cqvip.com/asset/detail/101996618144
			newItem.edition = labels.getWith('版本说明');
			newItem.publisher = labels.getWith('出版社');
			newItem.date = ZU.strToISO(labels.getWith('出版年'));
			newItem.numPages = tryMatch(labels.getWith('页数'), /\d+/);
			newItem.ISBN = ZU.cleanISBN(labels.getWith('ISBN'));
			creators = Array.from(doc.querySelectorAll('.author > a')).map(element => cleanAuthor(ZU.trimInternal(element.textContent)));
			break;
		case 'thesis':
			newItem.thesisType = labels.getWith('学位级别') + '学位论文';
			newItem.university = labels.getWith('作者单位');
			newItem.date = ZU.strToISO(labels.getWith('授予年度'));
			creators = Array.from(doc.querySelectorAll('.author > a')).map(element => cleanAuthor(ZU.trimInternal(element.textContent)));
			labels.getWith('导师姓名').split(/[;，；]/).forEach(creator => creators.push(cleanAuthor(creator, 'contributor')));
			break;
		case 'conferencePaper':
			newItem.date = ZU.strToISO(labels.getWith('会议日期'));
			newItem.conferenceName = labels.getWith('会议名称').replace(/^《|》$/g, '');
			creators = Array.from(doc.querySelectorAll('.author > a')).map(element => cleanAuthor(ZU.trimInternal(element.textContent)));
			break;
		case 'standard':
			newItem.title = attr(doc, '.article-summary > h1', 'title').replace(/([\u4e00-\u9fff]) ([\u4e00-\u9fff])/, '$1　$2');
			newItem.number = labels.getWith('标准编号');
			newItem.date = ZU.strToISO(labels.getWith('发布日期'));
			extra.set('applyDate', labels.getWith('实施日期'));
			newItem.numPages = tryMatch(labels.getWith('页码'), /\d+/);
			extra.set('CCS', labels.getWith('中国标准分类号'));
			extra.set('ICS', labels.getWith('国际标准分类号'));
			break;
		case 'patent':
			newItem.patentNumber = labels.getWith('公开号').split(';')[0];
			newItem.applicationNumber = labels.getWith('专利申请号').split(';')[0];
			newItem.place = newItem.country = patentCountry(newItem.patentNumber || newItem.applicationNumber);
			newItem.filingDate = labels.getWith('申请日');
			newItem.issueDate = labels.getWith('公开日');
			extra.set('Genre', labels.getWith('专利类型'), true);
			creators = Array.from(labels.getWith('发明人', true).querySelectorAll('a')).map(element => cleanAuthor(ZU.trimInternal(element.textContent)));
			break;

		/*
		已知问题：
		1. 缺少修订日期（Edition）
		2. 党内法规无法获取作者
		*/
		case 'statute': {
			newItem.title = newItem.title.replace(/\((.+?)\)/, '（$1）');
			const rank = labels.getWith('效力级别');
			if (rank == '党内法规制度' || newItem.title.includes('草案')) {
				newItem.itemType = 'report';
				newItem.shortTitle = tryMatch(newItem.title, /^(.+)——.+/, 1);
				newItem.date = labels.getWith('颁布日期');
			}
			else {
				if (!labels.getWith('效力级别').includes('法律')) {
					extra.set('Type', 'regulation', true);
				}
				if (newItem.title.startsWith('中华人民共和国')) {
					newItem.shortTitle = newItem.title.substring(7);
				}
				newItem.publicLawNumber = labels.getWith('发文文号');
				newItem.dateEnacted = labels.getWith('颁布日期');
				if (labels.getWith('时效性') == '已失效') {
					extra.set('Status', '已废止', true);
				}
			}

			extra.set('applyDate', labels.getWith('实施日期'));
			creators = Array.from(labels.getWith('颁布部门', true).querySelectorAll('a')).map(element => cleanAuthor(ZU.trimInternal(element.textContent)));
			break;
		}
		case 'report':
			newItem.reportType = '科技成果报告';
			newItem.institution = labels.getWith('完成单位');
			newItem.date = labels.getWith('公布年份');
			extra.set('achievementType', labels.getWith('成果类别'));
			creators = Array.from(doc.querySelectorAll('.author > a')).map(element => cleanAuthor(ZU.trimInternal(element.textContent)));
			break;
		case 'newspaperArticle':
			newItem.publicationTitle = attr(labels.getWith('报纸名称', true), 'a', 'title');
			newItem.date = labels.getWith('发表日期');
			newItem.pages = labels.getWith('版名版号').replace(/0*(\d)/, '$1');
			creators = Array.from(doc.querySelectorAll('.author > a')).map(element => cleanAuthor(ZU.trimInternal(element.textContent)));
			break;
	}
	newItem.language = /[\u4e00-\u9fff]/.test(newItem.title) ? 'zh-CN' : 'en-US';
	newItem.url = url;
	newItem.libraryCatalog = '维普经纶知识服务平台';
	newItem.creators = creators;
	creatorsEn.forEach(enName => extra.push('original-author', enName, true));
	creators = ZU.deepCopy(creators);
	if (creatorsEn.length) {
		for (let i = 1; i < creators.length; i++) {
			creators[i].original = creatorsEn[i] || '';
		}
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	labels.getWith(['主题', '关键词'], true).querySelectorAll('a').forEach(element => newItem.tags.push(ZU.trimInternal(element.textContent)));
	extra.set('CLC', labels.getWith('中图分类'));
	newItem.extra = extra.toString();
	return newItem;
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
				const elementCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elementCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elementCopy.removeChild(elementCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elementCopy.childNodes.length > 1) {
					const key = elementCopy.removeChild(elementCopy.firstChild).textContent.replace(/\s/g, '');
					this.innerData.push([key, elementCopy]);
				}
				else {
					const text = ZU.trimInternal(elementCopy.textContent);
					const key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elementCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.innerData.push([key, elementCopy]);
				}
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			const results = label
				.map(aLabel => this.getWith(aLabel, element));
			const keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElement
					: '';
		}
		const pattern = new RegExp(label, 'i');
		const keyVal = this.innerData.find(arr => pattern.test(arr[0]));
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
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function cleanAuthor(creator, creatorType = 'author') {
	creator = ZU.cleanAuthor(creator, creatorType);
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	return creator;
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
		"url": "http://k.vipslib.com/asset/detail/2031156636722",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "溶剂热法可控合成NiCo<sub>2</sub>O<sub>4</sub>锂电池负极材料及储锂机制研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "华丽",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "曾建华",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "樊锋凯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "朱玉涵",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "翁方青",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "胡庆兰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李景蕻",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022",
				"abstractNote": "溶剂热法可控合成NiCo_(2)O_(4)锂电池负极材料,进行XRD、ESEM、电化学性能分析并获得分散性好、晶型完整的尖晶石型NiCo_(2)O_(4)纳米片。充放电测试显示:首次比容量分别为1376mAh/g和1544mAh/g;经150次循环后,容量保持率约70%。低倍率下(0.05~2C)稳定性明显高于高倍率(10C)下,与Li+在电解液中的扩散电阻增大有关,这在交流阻抗(EIS)中得到证实。循环伏安(CV)为进一步弄清脱嵌锂机理提供了依据。EIS等效电路拟合结果显示:60次循环后,电极电阻(R1)由357Ω·cm^(2)下降到154Ω·cm^(2),与电极材料活化有关。但电解液扩散电阻(WS)从345Ω·cm^(2)增大到467Ω·cm^(2),与电极材料被破坏粉化有关。为了更好平衡这两个相互矛盾的变量,有效控制合成NiCo_(2)O_(4)电极材料十分关键,本法获得的NiCo_(2)O_(4)负极材料其电化学性能较优异。",
				"extra": "original-title: Controllable Synthesis of NiCo<sub>2</sub>O<sub>4</sub>Anode Materials by Solvothermal Method for Lithium Battery Together with Its Lithium Storage Mechanism\noriginal-author: Hua Li\noriginal-author: Zeng Jian-hua\noriginal-author: Fan Feng-kai\noriginal-author: Zhu Yu-han\noriginal-author: Weng Fang-qing\noriginal-author: Hu Qing-lan\noriginal-author: Li Jing-hong\nfoundation: 湖北省自然科学基金(2021CFB251) 国家自然科学基金青年项目(22004029) 湖北第二师范学院校级教学研究和科学研究项目(X2019013,X2020001和20XGZX10).\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"华丽\",\"creatorType\":\"author\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"曾建华\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Zeng Jian-hua\"},{\"firstName\":\"\",\"lastName\":\"樊锋凯\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Fan Feng-kai\"},{\"firstName\":\"\",\"lastName\":\"朱玉涵\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Zhu Yu-han\"},{\"firstName\":\"\",\"lastName\":\"翁方青\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Weng Fang-qing\"},{\"firstName\":\"\",\"lastName\":\"胡庆兰\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Hu Qing-lan\"},{\"firstName\":\"\",\"lastName\":\"李景蕻\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Li Jing-hong\"}]\nCLC: O614[数理科学和化学-化学]",
				"issue": "11",
				"language": "zh-CN",
				"libraryCatalog": "维普经纶知识服务平台",
				"pages": "19-25",
				"publicationTitle": "武汉理工大学学报",
				"url": "http://k.vipslib.com/asset/detail/2031156636722",
				"volume": "44",
				"attachments": [],
				"tags": [
					{
						"tag": "NiCo_(2)O_(4)负极材料"
					},
					{
						"tag": "储锂机制研究"
					},
					{
						"tag": "可控合成"
					},
					{
						"tag": "锂电池"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://k.vipslib.com/asset/detail/20157997658",
		"items": [
			{
				"itemType": "book",
				"title": "电视色彩学",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘恩御",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李振",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019",
				"ISBN": "9787565724480",
				"abstractNote": "本书是在《电视色彩学》原本的基础上修订而成。作者为中国传媒大学教授刘恩御，他多年从事“电视色彩学教学工作，结合教学实践，用17年的时间研究、设计了“染料三基色系统。本书正是他多年研究成果的结晶。本书从物理、生理及心理的角度阐述色彩形成的原理、特征、不同的色彩组合所表达的意境或感情以及这些自然规律在电视节目制作中的美术、灯光、摄影、摄像、编辑等制作环节上的应用。由于各类视觉艺术且有对色彩应用的共性，因此，电视色彩学的应用范围不仅仅限于电视节目制作，它对电影、戏剧、摄影、美术、染织及广泛的生活领域都有一定的实用、参考价值。",
				"edition": "第2版",
				"extra": "original-title: Television chromatology\nCLC: G222.3[文化、科学、教育、体育-信息与知识传播] J91[艺术-电影、电视艺术] G222[文化、科学、教育、体育-信息与知识传播] TN949.12[工业技术-无线电电子学、电信技术]",
				"language": "zh-CN",
				"libraryCatalog": "维普经纶知识服务平台",
				"numPages": "205",
				"publisher": "北京：中国传媒大学出版社",
				"series": "电视艺术学丛书",
				"url": "http://k.vipslib.com/asset/detail/20157997658",
				"attachments": [],
				"tags": [
					{
						"tag": "信息与知识传播"
					},
					{
						"tag": "广播、电视事业"
					},
					{
						"tag": "文化、科学、教育、体育"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://k.vipslib.com/asset/detail/20471967745",
		"items": [
			{
				"itemType": "thesis",
				"title": "基于压褶形态的服装设计创新研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "张玲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "许旭兵",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "田玲",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "人们对服装精神层面追求的不断提高以及服装市场竞争程度的不断激烈，推动了压褶服装的流行，凸显了压褶服装创新设计研究的重要性和必要性。文章通过六个章节对本课题的研究进行阐述，在整篇文章中，笔者首先阐述了关于本课题的研究背景、研究意义、研究现状、研究内容与思路框架以及研究的方法与创新点，继而对本课题研究对象的概念、研究对象的历史渊源及其发展历程进行了较为全面的整理归纳。由相关内容整理归纳的基础上切入主题，通过设计师的设计作品解析了几个常见的具有代表性的压褶形态在服装设计中的工艺方法及其形态造型，并以设计师的设计作品案例为基础，从工艺手法、服装款式、服装色彩三个方面分析总结了压褶形态在服装设计中的创新应用方法，为后续压褶形态服装的创新性设计实践提供理论参照。最后笔者详细的阐述了关于本课题的设计实践，呈现了笔者设计实践的作品，并且对本课题的相关研究进行了总结和展望。 压褶服装设计的创新性研究不仅势在必行而且意义深远，立足压褶元素、创新服装设计是适应潮流，满足人们对于服装的精神层面需求的重要途径，也是增强压褶服装市场竞争力的重要因素。文章通过文献研究法、图形分析法、比较分析法、设计实践法等研究方法对压褶形态的相关内容进行分析阐述，创造性地归纳总结了其成型原理，结合案例，对压褶形态与服装之间的创新融合设计进行研究分析，挖掘其设计创新的方法以及设计创新的关键，并最终通过实践操作对研究结果进行验证和呈现，为解读压褶符号的神秘、拓展服装设计的思路、丰富服装时尚的语言提供理论上以及实践上的支持。",
				"extra": "CLC: TS941.2[工业技术-轻工业、手工业]",
				"language": "zh-CN",
				"libraryCatalog": "维普经纶知识服务平台",
				"thesisType": "硕士学位论文",
				"university": "东华大学",
				"url": "http://k.vipslib.com/asset/detail/20471967745",
				"attachments": [],
				"tags": [
					{
						"tag": "创新设计"
					},
					{
						"tag": "压褶形态"
					},
					{
						"tag": "压褶服装"
					},
					{
						"tag": "服装设计"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://k.vipslib.com/asset/detail/20668882544",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "字体设计的方法与实践探索",
				"creators": [
					{
						"firstName": "",
						"lastName": "吴莹",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019",
				"abstractNote": "在今天的生活中，我们面临着如何利用视觉语言形式的创新去构造具有吸引力和传达力的字体作品。《字体设计的方法与实践》课程通过形态分析、效果运用与视觉表现三个方面使学生基本掌握现代字体设计的创新思维与方法技能。第一阶段，引导学生在平时的生活中学会观察、发现各种与字体相关的视觉因素，及其在不同环境中所呈现的视觉状态与视觉效果;第二阶段，通过古老形制方式现代材质应用和多维形态呈现等方法，尝试字体设计中不同视觉效果的创作过程与构建方式;第三阶段，通过图形借代和文字的图案化等表现形式的展开，探索并形成字体独特的风格与表现力。在课程中，教师指导学生不断尝试字体设计的新观念、新手法，通过对不同类型应用设计作品的分析，使学生对现实生活中字体应用的客观规律有较为详尽的认识与理解，形成解决字体方面不同问题的能力。",
				"conferenceName": "2019第九届全国视觉传达设计教育论坛",
				"language": "zh-CN",
				"libraryCatalog": "维普经纶知识服务平台",
				"url": "http://k.vipslib.com/asset/detail/20668882544",
				"attachments": [],
				"tags": [
					{
						"tag": "古老形制"
					},
					{
						"tag": "图形借代"
					},
					{
						"tag": "图案化"
					},
					{
						"tag": "字体设计"
					},
					{
						"tag": "现代材质"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://k.vipslib.com/asset/detail/20512556185",
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献　参考文献著录规则",
				"creators": [],
				"date": "2015",
				"abstractNote": "本标准规定了各个学科、各种类型信息资源的参考文献的著录项目、著录顺序、著录用符号、著录用文字、各个著录项目的著录方法以及参考文献在正文中的标注法。 本标准适用于著者和编辑著录参考文献，而不是供图书馆员、文献目录编制者以及索引编辑者使用的文献著录规则。",
				"extra": "original-title: Information and documentation—Rules for bibliographic references and citations to information resources\napplyDate: 2015-12-01\nCCS: A14\nICS: 01_140_20",
				"language": "zh-CN",
				"libraryCatalog": "维普经纶知识服务平台",
				"numPages": "27",
				"number": "GB/T 7714-2015",
				"url": "http://k.vipslib.com/asset/detail/20512556185",
				"attachments": [],
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
		"url": "http://k.vipslib.com/asset/detail/207336700438",
		"items": [
			{
				"itemType": "patent",
				"title": "一种面料的后整理加工方法及面料",
				"creators": [
					{
						"firstName": "",
						"lastName": "张瑞喜",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "梁竹青",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "段雪梅",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "高丽忠",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "金永乐",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"issueDate": "2023-10-24",
				"abstractNote": "本发明公开了一种面料的后整理加工方法及面料，包括如下步骤：步骤a：将面料进行缩绒处理；步骤b：将所述步骤a中进行缩绒处理后的面料进行拉幅烘干处理；步骤c：将所述步骤b中经拉幅烘干处理后的面料进行钢丝起毛处理；步骤d：将所述步骤c中经钢丝起毛处理后的面料进行刺果起毛处理；步骤e：将所述步骤d中经刺果起毛处理后的面料进行逆毛冲水处理；步骤f：将所述步骤e中经逆毛冲水后的面料进行烘干处理；步骤g：将所述步骤f中经烘干之后的面料进行干刷毛处理；步骤h：将所述步骤g中经干刷毛之后的面料进行烫光处理。本发明所提供的面料的后整理加工方法，使得面料表面覆盖一层长而自然卷曲的纤维，蓬松丰厚，光泽柔和。",
				"applicationNumber": "CN202310901127.X",
				"country": "中国",
				"extra": "Genre: 发明专利",
				"filingDate": "2023-07-20",
				"language": "zh-CN",
				"patentNumber": "CN116926835A",
				"place": "中国",
				"url": "http://k.vipslib.com/asset/detail/207336700438",
				"attachments": [],
				"tags": [
					{
						"tag": "冲水"
					},
					{
						"tag": "刺果"
					},
					{
						"tag": "加工"
					},
					{
						"tag": "后整理"
					},
					{
						"tag": "干刷"
					},
					{
						"tag": "拉幅"
					},
					{
						"tag": "柔和"
					},
					{
						"tag": "烘干"
					},
					{
						"tag": "烘干处理"
					},
					{
						"tag": "烫光"
					},
					{
						"tag": "纤维"
					},
					{
						"tag": "缩绒"
					},
					{
						"tag": "自然卷曲"
					},
					{
						"tag": "蓬松"
					},
					{
						"tag": "覆盖"
					},
					{
						"tag": "起毛处理"
					},
					{
						"tag": "钢丝"
					},
					{
						"tag": "面料"
					},
					{
						"tag": "面料表面"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://k.vipslib.com/asset/detail/20843700223",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "最高人民法院、最高人民检查院关于依法严惩破坏计划生育犯罪活动的通知",
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
				"abstractNote": "各省、自治区、直辖市高级人民法院、人民检察院，解放军军事法院、军事检察院：实行计划生育是我国的一项基本国策。它关系到民族的昌盛、子孙后代的幸福。对少数人以各种手段破坏计划生育工作的行为，除进行必要的教育外，对那些伪造计划生育证明出售牟利，多次为他人做",
				"extra": "Type: regulation\nStatus: 已废止\napplyDate: 1993-11-12",
				"language": "zh-CN",
				"publicLawNumber": "法发36号",
				"url": "http://k.vipslib.com/asset/detail/20843700223",
				"attachments": [],
				"tags": [
					{
						"tag": "犯罪活动"
					},
					{
						"tag": "计划生育"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://k.vipslib.com/asset/detail/20865128867",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "report",
				"title": "高举中国特色社会主义伟大旗帜 为全面建设社会主义现代化国家而团结奋斗——在中国共产党第二十次全国代表大会上的报告",
				"creators": [
					{
						"firstName": "",
						"lastName": "中国共产党中央委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-10-16",
				"abstractNote": "高举中国特色社会主义伟大旗帜 为全面建设社会主义现代化国家而团结奋斗 --在中国共产党第二十次全国代表大会上的报告 （2022年10月16日） 习近平 同志们： 现在，我代表第十九届中央委员会向大会作报告。 中国共产党第二十次全国代表大会，是在全党全国各族人民迈上全面建设社会主义现代化国家新征程、向第二个百年奋斗目标进军的关键时刻召开的一次十分重要的大会。 大会的主题是：高举中国特色社会主义伟大旗帜，全面贯彻新时代中国特色社会主义思想，弘扬伟大建党精神，自信自强、守正创新，踔厉奋发、勇毅前行，为全面建设社会主义现代化国家、全面推进中华民族伟大复兴而团结奋斗。 中国共产党已走过百年奋斗历程。我们党立志于中华民族千秋伟业，致力于人类和平与发展崇高事业，责任无比重大，使命无上光荣。全党同志务必不忘初心、牢记使命，务必谦虚谨慎、艰苦奋斗，务必敢于斗争、善于斗争，坚定历史自信，增强历史主动，谱写新时代中国特色社会主义更加绚丽的华章。 一、过去五年的工作和新时代十年的伟大变革 十九大以来的五年，是极不寻常、极不平凡的五年。党中央统筹中华民族伟大复兴战略全局和世界百年未有之大变局，召开七次全会，分别就宪法修改，深化党和国家机构改革，坚持和完善中国特色社会主义制度、推进国家治理体系和治理能力现代化，制定“十四五规划和二〇三五年远景目标，全面总结党的百年奋斗重大成就和历史经验等重大问题作出决定和决议，就党和国家事业发展作出重大战略部署，团结带领全党全军全国各族人民有效应对严峻复杂的国际形势和接踵而至的巨大风险挑战，以奋发有为的精神把新时代中国特色社会主义不断推向前进。 五年来，我们坚持加强党的全面领导和党中央集中统一领导，全力推进全面建成小康社会进程，完整、准确、全面贯彻新发展理念，着力推动高质量发展，主动构建新发展格局，蹄疾步稳推进改革，扎实推进全过程人民民主，全面推进依法治国，积极发展社会主义先进文化，突出保障和改善民生，集中力量实施脱贫攻坚战，大力推进生态文明建设，坚决维护国家安全，防范化解重大风险，保持社会大局稳定，大力度推进国防和军队现代化建设，全方位开展中国特色大国外交，全面推进党的建设新的伟大工程。我们隆重庆祝中国共产党成立一百周年、中华人民共和国成立七十周年，制定第三个历史决议，在全党开展党史学习教育，建成中国共产党历史展览馆，号召全党学习和践行伟大建党精神，在新的征程上更加坚定、更加自觉地牢记初心使命、开创美好未来。特别是面对突如其来的新冠肺炎疫情，我们坚持人民至上、生命至上，坚持外防输入、内防反弹，坚持动态清零不动摇，开展抗击疫情人民战争、总体战、阻击战，最大限度保护了人民生命安全和身体健康，统筹疫情防控和经济社会发展取得重大积极成果。面对香港局势动荡变化，我们依照宪法和基本法有效实施对特别行政区的全面管治权，制定实施香港特别行政区维护国家安全法，落实“爱国者治港原则，香港局势实现由乱到治的重大转折，深入推进粤港澳大湾区建设，支持香港、澳门发展经济、改善民生、保持稳定。面对“台独势力分裂活动和外部势力干涉台湾事务的严重挑衅，我们坚决开展反分裂、反干涉重大斗争，展示了我们维护国家主权和领土完整、反对“台独的坚强决心和强大能力，进一步掌握了实现祖国完全统一的战略主动，进一步巩固了国际社会坚持一个中国的格局。面对国际局势急剧变化，特别是面对外部讹诈、遏制、封锁、极限施压，我们坚持国家利益为重、国内政治优先，保持战略定力，发扬斗争精神，展示不畏",
				"extra": "applyDate: 2022-10-16",
				"language": "zh-CN",
				"libraryCatalog": "维普经纶知识服务平台",
				"shortTitle": "高举中国特色社会主义伟大旗帜 为全面建设社会主义现代化国家而团结奋斗",
				"url": "http://k.vipslib.com/asset/detail/20865128867",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://k.vipslib.com/asset/detail/20858657837",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "report",
				"title": "关于《中华人民共和国行政诉讼法修正案（草案）》的说明",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国人大常委会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2013-12-23",
				"abstractNote": "关于《中华人民共和国行政诉讼法修正案（草案）》的说明 （2013年12月23日在第十二届全国人民代表大会常务委员会第六次会议上 全国人大常委会法制工作委员会副主任 信春鹰） 委员长、各位副委员长、秘书长、各委员： 我受委员长会议的委托，作关于《中华人民共和国行政诉讼法修正案（草案）》的说明。 行政诉讼法于1989年由第七届全国人大第二次会议通过，1990年10月1日起实施。这部被称为“民告官的法律规定了行政诉讼程序的基本规则，实施以来，在解决行政争议，推进依法行政，保护公民、法人和其他组织的合法权益等方面，发挥了重要作用。同时，随着社会主义民主法制建设的深入推进，行政诉讼制度与社会经济发展不协调、不适应的问题也日渐突出。人民群众对行政诉讼中存在的“立案难、审理难、执行难等突出问题反映强烈。为解决这些突出问题，适应依法治国、依法执政、依法行政共同推进，法治国家、法治政府、法治社会一体建设的新要求，有必要对行政诉讼法予以修改完善。 近年来，许多全国人大代表和有关方面陆续提出修改行政诉讼法的意见和建议。法制工作委员会从2009年开始着手行政诉讼法的修改调研工作，先后到山东、湖南等多地进行调研，听取基层人民法院、地方政府部门的意见和建议。采取旁听案件审理、阅卷、派人到行政审判一线蹲点等多种方式了解行政诉讼实践的情况。多次召开国务院部门、学者和律师座谈会，听取意见。今年11月又分两次召开17个省、自治区、直辖市人大法制机构、政府法制部门、人民法院和人民检察院参加的座谈会。按照党的十八届三中全会精神和各方面的意见，修改工作把握以下几点：一是维护行政诉讼制度的权威性，针对现实中的突出问题，强调依法保障公民、法人和其他组织的诉讼权利；二是坚持我国行政诉讼制度的基本原则，维护行政权依法行使和公民、法人和其他组织寻求司法救济渠道畅通的平衡，保障人民法院依法独立行使审判权；三是坚持从实际出发，循序渐进，逐步完善；四是总结行政审判实践的经验，把经实践证明的有益经验上升为法律。经与最高人民法院、国务院法制办公室等方面沟通协商、反复研究，在充分论证并取得基本共识的基础上，形成了行政诉讼法修正案（草案）。现就主要问题说明如下： 一、关于保障当事人的诉讼权利 行政诉讼面临的“三难，最突出的是立案难。公民、法人或者其他组织与政府机关及其工作人员产生纠纷，行政机关不愿当被告，法院不愿受理，导致许多应当通过诉讼解决的纠纷进入信访渠道，在有些地方形成了“信访不信法的局面。为通畅行政诉讼的入口，建议从五个方面完善对当事人的诉权保护： 1.明确人民法院和行政机关应当保障当事人的起诉权利。增加规定：人民法院应当保障公民、法人或者其他组织的起诉权利，对应当受理的行政案件依法受理。行政机关不得干预、阻碍人民法院受理行政案件。被诉行政机关应当依法应诉。（修正案草案第三条） 2.扩大受案范围。将行政机关侵犯公民、法人或者其他组织依法享有的土地、矿藏、水流、森林、山岭、草原、荒地、滩涂、海域等自然资源的所有权或者使用权，行政机关侵犯农村土地承包经营权，行政机关违法集资、征收征用财产、摊派费用，行政机关没有依法支付最低生活保障待遇或者社会保险待遇等纳入受案范围。（修正案草案第四条） 3.明确可以口头起诉，方便当事人行使诉权。增加规定：起诉应当向人民法院递交起诉状，并按照被告人数提出副本。书写起诉状确有困难的，可以口头起诉，由人民法院记入笔录，出具注明日期的书面凭证，并告知对方当事人。（修正案草案第二十五条） 4.强化受理程序约束。增加规定：一是人民法院应当在接到起诉状时当场予以登记，并出具注明日期的书面凭证。起诉状内容欠缺或者有其他错误的，应当给予指导和释明，并一次性告知当事人补正。不得未经指导和释明即以起诉不符合条件为由不受理。二是起诉符合条件的，人民法院应当在接到起诉状或者口头起诉之日起七日内立案，并通知当事人；不符合起诉条件的，应当在七日内作出裁定书，不予受理。裁定书应当载明不予受理的理由。原告对裁定不服的，可以提起上诉。三是人民法院在七日内既不立案，又不作出裁定书的，当事人可以向上一级人民法院起诉。上一级人民法院认为符合起诉条件的，应当立案、审理，也可以指定其他下级人民法院立案、审理。（修正案草案第二十五条、第二十七条） 5.明确人民法院的相应责任。增加规定：对于不接收起诉状、接收起诉状后不出具书面凭证，以及不一次性告知当事人补正起诉状内容的，当事人可以向上级人民法院投诉，上级人民法院应当责令改正，并对直接负责的主管人员和其他直接责任人员依法给予处分。（修正案草案第二十五条） 二、关于对规范性文件的附带审查 实践中，有些具体行政行为侵犯公民、法人或者其他组织的合法权益，是地方政府及其部门制定的规范性文件中越权错位等规定造成的。为从根本上减少违法具体行政行为，可以由法院在审 ······",
				"language": "zh-CN",
				"libraryCatalog": "维普经纶知识服务平台",
				"url": "http://k.vipslib.com/asset/detail/20858657837",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://k.vipslib.com/asset/detail/20913559137",
		"items": [
			{
				"itemType": "report",
				"title": "光伏储能一体机系统",
				"creators": [
					{
						"firstName": "",
						"lastName": "李新富",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "郭华为",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王建星",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "周勇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "施鑫淼",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张祥平",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈青青",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019年",
				"abstractNote": "项目采用模块化设计,并分层设置在多层柜仓中,多层柜仓内分别设置有储能电池、电池充放电模块、逆变器、配电模块,电池充放电模块对储能电池的充放电进行管理,对光伏储能智能一体机的运行过程进行控制并显示各种状态参数,实现人机交互功能,通信模块与云端服务器及用户手机通信连接,互联网监控实时上传汇总,生成数据报告;通过有线和无线实现于云端的无缝对接,可以让客户无论在何时何地都能监控到家里的发电用电情况,实现了智能化。",
				"extra": "achievementType: 应用技术",
				"institution": "浙江艾罗网络能源技术有限公司",
				"language": "zh-CN",
				"libraryCatalog": "维普经纶知识服务平台",
				"reportType": "科技成果报告",
				"url": "http://k.vipslib.com/asset/detail/20913559137",
				"attachments": [],
				"tags": [
					{
						"tag": "一体机"
					},
					{
						"tag": "储能"
					},
					{
						"tag": "光伏"
					},
					{
						"tag": "系统"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://k.vipslib.com/asset/detail/21142496714",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "日本登月探测器怎么了？",
				"creators": [
					{
						"firstName": "",
						"lastName": "钱铮",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张伊伊",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-01-22",
				"abstractNote": "新华社东京1月20日电（记者钱铮 张伊伊）日本小型登月探测器SLIM东京时间20日凌晨在月球表面着陆，但随后被发现其搭载的太阳能电池无法发电。无法发电意味着什么？此次登月任务有何特点？到底算不算成功？探测器还能否恢复活力？ SLIM能否运行？ 东京时间20日零时(北京时?",
				"language": "zh-CN",
				"libraryCatalog": "维普经纶知识服务平台",
				"pages": "8",
				"publicationTitle": "新华每日电讯",
				"url": "http://k.vipslib.com/asset/detail/21142496714",
				"attachments": [],
				"tags": [
					{
						"tag": "探测器"
					},
					{
						"tag": "月球着陆"
					},
					{
						"tag": "月球表面"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
