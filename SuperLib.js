{
	"translatorID": "44c46760-3a27-4145-a623-9e42b733fbe8",
	"label": "SuperLib",
	"creator": "Xingzhong Lin",
	"target": "https?://.*?\\.ucdrs\\.superlib\\.net",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-01 08:47:02"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Xingzhong Lin, jiaojiaodubai
	
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

const urlMap = {
	bookDetail: 'book',
	JourDetail: 'journalArticle',
	NPDetail: 'newspaperArticle',
	thesisDetail: 'thesis',
	CPDetail: 'conferencePaper',
	patentDetail: 'patent',
	StdDetail: 'standard'
};

function detectWeb(doc, url) {
	let type = Object.keys(urlMap).find(key => new RegExp(`${key}\\.`, 'i').test(url));
	if (type) {
		return urlMap[type];
	}
	else if (getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('[name=formid] > table > tbody > tr > td:last-child, [name=formid] > [class^="book"]');
	for (let row of rows) {
		let header = row.querySelector('table a,a');
		let href = header.href;
		let title = `${ZU.trimInternal(header.textContent)}_${ZU.trimInternal(text(row, 'td > span, #m_fl'))}`;
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
			// 依赖浏览器环境
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	Z.debug(doc.body.innerText);
	const labels = new Labels(doc, '.content > ul:first-child > li, .tubox dd');
	Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	let extra = new Extra();
	var newItem = new Zotero.Item(detectWeb(doc, url));
	newItem.extra = '';
	newItem.title = text(doc, 'h1, .tutilte');
	// #zymore见于期刊
	// .tu_content 见于图书
	// #more 见于学位论文
	// div[id^="content"]见于专利
	newItem.abstractNote = innerText(doc, '#zymore, .tu_content, #more, div[id^="content"]').replace(/^【摘 要】/, '') || labels.get('简介');
	switch (newItem.itemType) {
		case 'book': {
			let pubInfo = labels.get('出版项');
			newItem.series = labels.get('丛书名');
			// newItem.seriesNumber = 系列编号;
			// newItem.volume = 卷次;
			// newItem.numberOfVolumes = 总卷数;
			// newItem.edition = 版本;
			newItem.place = tryMatch(pubInfo, /(.+)：/, 1);
			newItem.publisher = tryMatch(pubInfo, /：\s*(.+)，\s*/);
			newItem.date = ZU.strToISO(tryMatch(pubInfo, /[\d.]*$/));
			newItem.numPages = labels.get('形态项');
			newItem.ISBN = labels.get('ISBN号');
			extra.set('CLC', labels.get('中图分类法'));
			extra.set('price', labels.get('定价'));
			let creators = [];
			labels.get('作者').replace(/(\w)，(\w)/g, '$1, $2')
				.split('；')
				.forEach((group) => {
					let creatorType = /译$/.test(group)
						? 'translator'
						: 'author';
					group.split('，').forEach((creator) => {
						Z.debug(creator);
						creator = creator.replace(/[等翻译主副参编著作]*$/, '');
						let country = tryMatch(creator, /^（(.+?)）/, 1);
						Z.debug(country);
						creator = creator.replace(/^（.*?）/, '');
						let original = tryMatch(creator, /（(.+?)）$/, 1);
						creator = creator.replace(/（.*?）$/, '');
						Z.debug(original);
						Z.debug(creator);
						creator = cleanAuthor(creator, creatorType);
						creator.country = country;
						creator.original = original;
						creators.push(creator);
					});
				});
			if (creators.some(creator => creator.country || creator.original)) {
				extra.set('creatorsExt', JSON.stringify(creators));
			}
			creators.forEach((creator) => {
				delete creator.country;
				extra.push('origianl-author', creator.original, true);
				delete creator.original;
				newItem.creators.push(creator);
			});
			break;
		}
		case 'journalArticle':
			newItem.publicationTitle = labels.get('刊名');
			// newItem.volume = 卷次;
			newItem.issue = tryMatch(labels.get('期号'), /0*([1-9]\d*)/, 1);
			// newItem.pages = 页码;
			newItem.date = labels.get('出版日期');
			extra.set('original-title', labels.get('外文题名'), true);
			extra.set('fund', labels.get('基金项目'));
			extra.set('if', labels.get('影响因子'));
			labels.get('作者', true).querySelectorAll('a').forEach(element => newItem.creators.push(cleanAuthor(element.textContent, 'author')));
			labels.get('关键词', true).querySelectorAll('a').forEach(element => newItem.tags.push(element.textContent));
			break;
		case 'newspaperArticle':
			newItem.publicationTitle = labels.get('来源');
			newItem.date = ZU.strToISO(labels.get('日期'));
			newItem.paegs = tryMatch(labels.get('版次'), /0*([1-9]\d*)/, 1);
			labels.get('作者', true).querySelectorAll('a').forEach(element => newItem.creators.push(cleanAuthor(element.textContent, 'author')));
			// 报纸语言皆为中文，使用空格分割不会造成意外
			labels.get('关键词').split(' ').forEach(tag => newItem.tags.push(tag));
			break;
		case 'thesis':
			newItem.thesisType = `${labels.get('学位名称')}学位论文`;
			newItem.university = labels.get('学位授予单位');
			newItem.date = labels.get('学位年度');
			newItem.creators.push(cleanAuthor(labels.get('作者'), 'author'));
			labels.get('导师').split('，').forEach(creator => newItem.creators.push(cleanAuthor(creator, 'contributor')));
			break;
		case 'conferencePaper':
			newItem.date = labels.get('日期');
			newItem.proceedingsTitle = labels.get('会议录名称');
			newItem.conferenceName = labels.get('会议名称');
			labels.get('作者', true).querySelectorAll('a').forEach(element => newItem.creators.push(cleanAuthor(element.textContent, 'author')));
			labels.get('关键词', true).querySelectorAll('a').forEach(element => newItem.tags.push(element.textContent));
			break;
		case 'patent': {
			newItem.filingDate = ZU.strToISO(labels.get('申请日期'));
			newItem.applicationNumber = labels.get('申请号');
			let patentDetail = attr(doc, 'li > a[href*="pat.hnipo"]', 'href');
			if (newItem.itemType == 'patent' && patentDetail) {
				let detailDoc = await requestDocument(patentDetail);
				var tabel = {
					cells: Array.from(detailDoc.querySelectorAll('td.table_15')),
					getNext: function (label) {
						let result = this.cells.find(element => element.innerText == `${label}:`);
						return result && result.nextElementSibling
							? result.nextElementSibling.innerText
							: '';
					}
				};
				newItem.issueDate = tabel.getNext('法律状态公告日');
				newItem.legalStatus = tabel.getNext('法律状态');
			}
			extra.set('Genre', labels.get('专利类型'), true);
			labels.get('发明人').split('，').forEach(creator => newItem.creators.push(cleanAuthor(creator, 'inventor')));
			break;
		}
		case 'standard':
			newItem.number = labels.get('标准号').replace('-', '—');
			extra.set('original-title', labels.get('标准英文名'), true);
			extra.set('IPC', labels.get('IPC分类号'));
			extra.set('ICS', labels.get('ICS分类号'));
			extra.set('reference', labels.get('引用标准'));
			extra.set('draftingCommittee', labels.get('起草单位'));
			extra.set('replacement', labels.get('替代情况'));
			extra.set('CCS', labels.get('中标分类号'));
			break;
		default:
			break;
	}
	newItem.url = url;
	newItem.extra = extra.toString();
	newItem.complete();
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
	let match = string.match(pattern);
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://jour.ucdrs.superlib.net/views/specific/2929/JourDetail.jsp?dxNumber=100287199277&d=EDA67F761EA0741D8CCBA19AAE292498&s=%E5%9F%BA%E5%9B%A0%E5%85%B1%E8%A1%A8%E8%BE%BE&ecode=utf-8",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "卵巢癌基因共表达网络及预后标志物的研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "顾云婧",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "朱平",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020",
				"abstractNote": "卵巢癌是一种早期诊断率低而致死率较高的恶性肿瘤,对其预后标志物的鉴定和生存率的预测仍是生存分析的重要任务。利用卵巢癌预后相关基因构建基因共表达网络,鉴定预后生物标志物并进行生存率的预测。首先,对TCGA(The cancer genome atlas)数据库下载的卵巢癌基因表达数据实施单因素回归分析,利用得到的747个预后相关基因构建卵巢癌预后加权基因共表达网络。其次,考虑网络的生物学意义,利用蛋白质相互作用(Protein-protein interaction, PPI)数据对共表达网络中的模块重新加权,并根据网络中基因的拓扑重要性对基因进行排序。最后,运用Cox比例风险回归对网络中的重要基因构建卵巢癌预后模型,鉴定了3个预后生物标志物。生存分析结果显示,这3个标志物能够显著区分不同预后的患者,较好地预测卵巢癌患者的预后情况。  隐藏更多",
				"issue": "5",
				"libraryCatalog": "SuperLib",
				"publicationTitle": "生物学杂志",
				"url": "http://jour.ucdrs.superlib.net/views/specific/2929/JourDetail.jsp?dxNumber=100287199277&d=EDA67F761EA0741D8CCBA19AAE292498&s=%E5%9F%BA%E5%9B%A0%E5%85%B1%E8%A1%A8%E8%BE%BE&ecode=utf-8",
				"attachments": [],
				"tags": [
					{
						"tag": "加权基因共表达网络分析(WGCNA)"
					},
					{
						"tag": "卵巢癌"
					},
					{
						"tag": "生物标志物"
					},
					{
						"tag": "预后模型"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000015416568&d=7C4B0704D86B606CB102A5B3A3EC74CE&fenlei=151206",
		"items": [
			{
				"itemType": "book",
				"title": "基因工程",
				"creators": [
					{
						"firstName": "",
						"lastName": "郑振宇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王秀利",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘丹梅",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "宋运贤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈国梁",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "邵燕",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "胡沂淮",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "阚劲松",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "韩凤桐",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙新城",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李宏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张锐",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王彦芹",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-03",
				"ISBN": "9787560997186",
				"abstractNote": "内容提要:\n本书以基因工程的研究步骤及实际操作中的需要为主线，共分12章，包括基因工程的基本概念、基因工程基本技术原理、基因工程的工具酶和克隆载体、目的基因的克隆、外源基因的原核表达系统等。",
				"libraryCatalog": "SuperLib",
				"numPages": "375",
				"place": "武汉",
				"series": "全国普通高等院校生物科学类“十二五”规划教材",
				"url": "http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000015416568&d=7C4B0704D86B606CB102A5B3A3EC74CE&fenlei=151206",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000000369267&d=2C67EBC1D046CAEAB6C7168473C0C540&fenlei=080401070331",
		"items": [
			{
				"itemType": "book",
				"title": "朗文英语正误词典",
				"creators": [
					{
						"firstName": "",
						"lastName": "希顿",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "特顿",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴骅",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "1992-02",
				"ISBN": "9787533707538",
				"abstractNote": "内容提要:\n著者原题无汉译名:按字母顺序罗列1700多个常见错误、正误例句、英语与美语的差异、语法术语要领等,大多错误取自剑桥第一证书考试答卷。",
				"libraryCatalog": "SuperLib",
				"numPages": "476",
				"place": "合肥",
				"url": "http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000000369267&d=2C67EBC1D046CAEAB6C7168473C0C540&fenlei=080401070331",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://newspaper.ucdrs.superlib.net/views/specific/2929/NPDetail.jsp?dxNumber=406010835180&d=2D1753A572EC38E418149C5B105B093F&sw=+%E7%BA%B3%E7%B1%B3&ecode=utf-8",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "纳米纤维工业滤纸下线",
				"creators": [
					{
						"firstName": "",
						"lastName": "冯倩",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "秦燕香",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张晓茹",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-06-13",
				"libraryCatalog": "SuperLib",
				"publicationTitle": "阳泉日报",
				"url": "http://newspaper.ucdrs.superlib.net/views/specific/2929/NPDetail.jsp?dxNumber=406010835180&d=2D1753A572EC38E418149C5B105B093F&sw=+%E7%BA%B3%E7%B1%B3&ecode=utf-8",
				"attachments": [],
				"tags": [
					{
						"tag": "工业滤纸"
					},
					{
						"tag": "纳米纤维"
					},
					{
						"tag": "过滤效率"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://jour.ucdrs.superlib.net/views/specific/2929/thesisDetail.jsp?dxNumber=390104353359&d=9358F557560F983157C9B1F338A23F94&sw=%E7%89%B9%E5%BC%82%E6%80%A7%E5%90%B8%E9%99%84%E5%A4%9A%E7%A7%8D%E6%B1%A1%E6%9F%93%E7%89%A9%E7%9A%84%E5%88%86%E5%AD%90%E5%8D%B0%E8%BF%B9%E7%BA%B3%E7%B1%B3%E8%86%9C%E7%9A%84%E5%88%B6%E5%A4%87%E5%92%8C%E6%80%A7%E8%83%BD%E8%AF%84%E4%BB%B7",
		"items": [
			{
				"itemType": "thesis",
				"title": "特异性吸附多种污染物的分子印迹纳米膜的制备和性能评价",
				"creators": [
					{
						"firstName": "",
						"lastName": "鲁志强",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "石云",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吕斌",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2013",
				"abstractNote": "目的：食品、水、土壤中均含有低剂量的双酚A（bisphenolA，BPA）和戊唑醇（Tebuconazole，TBZ），这两种环境污染物均为环境雌激素，并可通过食物链富集，因此需要灵敏准确地分析环境中这两种污染物的浓度。分子印迹技术是制备对某一特定靶分子具有选择性识别能力的聚合物的技术，广泛用于特异性分离富集痕量污染物上。但是分子印迹一般是针对单一模板分子的，如何制备可同时特异性分离富集多种污染物的分子印迹材料，一直是近期的研究热点。本研究将BPA分子印迹纳米微球（B-MIP）和TBZ分子印迹纳米微球（T-MIP）封装入聚乙烯醇（PVA）纳米纤维中得到分子印迹纳米纤维膜并以该膜作为吸附材料，以实现同时特异性吸附不同性质污染物之目的。方法：本研究分别以化学结构不同的BPA和TBZ作为模板分子，按不同的组合（BPA、TBZ、BPA+TBZ），合成系列MIPs纳米微球。然后通过静电纺丝技术将不同的MIPs微球包裹进聚乙烯醇（polyvinyl，PVA）纳米纤维膜中，制备出系列分子印迹膜，并对各种膜的吸附性能进行评价。结果：静态吸附实验结果显示，同时含有0.2g BPA-MIPs和0.2g TBZ-MIPs的膜（B&T-MIM），对BPA和TBZ的吸附容量和吸附特异性均明显高于含有0.4g同时以BPA和TBZ为模板印迹的膜（D-MIM）。结果显示纳米纤维膜中的两种MIPs可高效特异性吸附各自的靶污染物，并未互相干扰。结论：B&T-MIM可同时高效特异性吸附痕量酸性污染物BPA和碱性污染物TBZ。  隐藏更多",
				"libraryCatalog": "SuperLib",
				"thesisType": "硕士学位论文",
				"university": "华中科技大学",
				"url": "http://jour.ucdrs.superlib.net/views/specific/2929/thesisDetail.jsp?dxNumber=390104353359&d=9358F557560F983157C9B1F338A23F94&sw=%E7%89%B9%E5%BC%82%E6%80%A7%E5%90%B8%E9%99%84%E5%A4%9A%E7%A7%8D%E6%B1%A1%E6%9F%93%E7%89%A9%E7%9A%84%E5%88%86%E5%AD%90%E5%8D%B0%E8%BF%B9%E7%BA%B3%E7%B1%B3%E8%86%9C%E7%9A%84%E5%88%B6%E5%A4%87%E5%92%8C%E6%80%A7%E8%83%BD%E8%AF%84%E4%BB%B7",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://jour.ucdrs.superlib.net/views/specific/2929/CPDetail.jsp?dxNumber=330108499702&d=B5E6BEF31839C4BD39ED8471E85C4950&sw=%E7%BA%B3%E7%B1%B3",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "纳米MMT/SBR复合改性沥青性能研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "吴池",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "弓鑫",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张新宇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张建朝",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "常晓娟",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022",
				"abstractNote": "为改善SBR改性沥青的抗老化性能,在SBR改性沥青中加入掺量为1%、2%、3%、4%、5%的纳米MMT对其进行改性,制备纳米MMT/SBR复合改性沥青。通过三大指标试验、旋转薄膜烘箱加热、布氏旋转黏度试验、动态剪切流变试验等试验对基质沥青、SBR改性沥青及复合改性沥青的高低温性能、抗老化性能、抗疲劳性能、热储存稳定性能进行对比分析。结果表明:加入纳米MMT后,相较于SBR改性沥青,纳米MMT/SBR复合改性沥青拥有更好的高温性能、抗老化性能、抗疲劳性能及热储存稳定性能,但其低温性能有所下降。实际使用时,考虑到加入4%纳米MMT后,复合改性沥青低温延度下降幅度较大,推荐纳米MMT掺量为3%～4%。  隐藏更多",
				"conferenceName": "2022世界交通运输大会（WTC2022）",
				"libraryCatalog": "SuperLib",
				"proceedingsTitle": "2022世界交通运输大会（WTC2022）",
				"url": "http://jour.ucdrs.superlib.net/views/specific/2929/CPDetail.jsp?dxNumber=330108499702&d=B5E6BEF31839C4BD39ED8471E85C4950&sw=%E7%BA%B3%E7%B1%B3",
				"attachments": [],
				"tags": [
					{
						"tag": "SBR"
					},
					{
						"tag": "复合改性沥青"
					},
					{
						"tag": "性能"
					},
					{
						"tag": "纳米MMT"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://book.ucdrs.superlib.net/views/specific/2929/patentDetail.jsp?dxid=166050451063&d=DDA36D0C0E33BB3674CFCA8E87A1F4FE&sw=+%E7%BA%B3%E7%B1%B3&ecode=utf-8",
		"items": [
			{
				"itemType": "patent",
				"title": "黑板（纳米）",
				"creators": [
					{
						"firstName": "",
						"lastName": "马燕",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "金心茹",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2023.10.03",
				"abstractNote": "1.本外观设计产品的名称：黑板（纳米）。2.本外观设计产品的用途：用于书写的黑板。3.本外观设计产品的设计要点：在于形状。4.最能表明设计要点的图片或照片：立体图。1.本外观设计产品的名称：黑板（纳米）。2.本外观设计产品的用途：用于书写的黑板。3.本外观设计产品的设计要点：在于形状。4.最能表明设...\n展开",
				"applicationNumber": "202330176115.6",
				"filingDate": "2023-04-04",
				"legalStatus": "授权",
				"url": "http://book.ucdrs.superlib.net/views/specific/2929/patentDetail.jsp?dxid=166050451063&d=DDA36D0C0E33BB3674CFCA8E87A1F4FE&sw=+%E7%BA%B3%E7%B1%B3&ecode=utf-8",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://book.ucdrs.superlib.net/views/specific/2929/StdDetail.jsp?dxid=320151546977&d=F3BF82FD19585130C75082812F38D5C9&sw=+%E8%91%97%E5%BD%95",
		"items": [
			{
				"itemType": "standard",
				"title": "生态环境档案著录细则",
				"creators": [],
				"libraryCatalog": "SuperLib",
				"number": "HJ 9—2022",
				"url": "http://book.ucdrs.superlib.net/views/specific/2929/StdDetail.jsp?dxid=320151546977&d=F3BF82FD19585130C75082812F38D5C9&sw=+%E8%91%97%E5%BD%95",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://eng.ucdrs.superlib.net/views/specific/2929/FBookDetail.jsp?dxNumber=164030712467&d=AF328D3CD1401FE9489CF56D78387CFE#ctop",
		"items": [
			{
				"itemType": "book",
				"title": "Phonetics: The Science of Speech",
				"creators": [
					{
						"firstName": "Martin J. Ball; Joan",
						"lastName": "Rahilly",
						"creatorType": "author"
					}
				],
				"abstractNote": "In their comprehensive new introduction to phonetics, Ball and Rahilly offer a detailed explanation of the process of speech production, from the anatomical initiation of sounds and their modification in the larynx, through to the final articulation of vowels and consonants in the oral and nasal tracts.This textbook is one of the few to give a balanced account of segmental and suprasegmental aspects of speech, showing clearly that the communication chain is incomplete without accurate production of both individual speech sounds(segmental features)and aspects such as stress and intonation(suprasegmental features).Throughout the book the authors provide advice on transcription, primarily using the International Phonetic Alphabet(IPA).Students are expertly guided from basic attempts to record speech sounds on paper, to more refined accounts of phonetic detail in speech.The authors go on to explain acoustic phonetics in a manner accessible both to new students in phonetics, and to those who wish to advance their knowledge of key pursuits in the area, including the sound spectrograph.They describe how speech waves can be measured, as well as considering how they are heard and decoded by listeners, discussing both physiological and neurological aspects of hearing and examining the methods of psychoacoustic experimentation.A range of instrumentation for studying speech production is also presented.The next link is acoustic phonetics, the study of speech transmission.Here the authors introduce the basic concepts of sound acoustics and the instrumentation used to analyse the characteristics of speech waves.Finally, the chain is completed by examining auditory phonetics, and providing a fascinating psychoacoustic experimentation, used to determine what parts of the speech signal are most crucial for listener understanding.The book concludes with a comprehensive survey and description of modern phonetic instrumentation, from the sound spectrograph to magnetic resonance imaging(MRI)",
				"libraryCatalog": "SuperLib",
				"shortTitle": "Phonetics",
				"url": "http://eng.ucdrs.superlib.net/views/specific/2929/FBookDetail.jsp?dxNumber=164030712467&d=AF328D3CD1401FE9489CF56D78387CFE#ctop",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
