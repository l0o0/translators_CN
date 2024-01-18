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
	"lastUpdated": "2024-01-14 05:39:05"
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
	const labels = new LabelsX(doc, '.content > ul:first-child > li, .tubox dd');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	var newItem = new Zotero.Item(detectWeb(doc, url));
	newItem.extra = '';
	newItem.title = text(doc, 'h1, .tutilte');
	// #zymore见于期刊
	// .tu_content 见于图书
	// #more 见于学位论文
	// div[id^="content"]见于专利
	newItem.abstractNote = innerText(doc, '#zymore, .tu_content, #more, div[id^="content"]').replace(/^【摘 要】/, '') || labels.getWith('简介');
	switch (newItem.itemType) {
		case 'book': {
			let pubInfo = labels.getWith('出版项');
			newItem.series = labels.getWith('丛书名');
			// newItem.seriesNumber = 系列编号;
			// newItem.volume = 卷次;
			// newItem.numberOfVolumes = 总卷数;
			// newItem.edition = 版本;
			newItem.place = tryMatch(pubInfo, /(.+)：/, 1);
			newItem.publisher = tryMatch(pubInfo, /：\s*(.+)，\s*/);
			newItem.date = ZU.strToISO(tryMatch(pubInfo, /[\d.]*$/));
			newItem.numPages = labels.getWith('形态项');
			newItem.ISBN = labels.getWith('ISBN号');
			newItem.extra += addExtra('CLC', labels.getWith('中图分类法'));
			newItem.extra += addExtra('price', labels.getWith('定价'));
			let creators = [];
			labels.getWith('作者').replace(/(\w)，(\w)/g, '$1, $2').split('；')
.forEach((group) => {
	let creatorType = /译/.test(group)
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
		creator = ZU.cleanAuthor(creator, creatorType);
		creator.country = country;
		creator.original = original;
		if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
			creator.lastName = creator.firstName + creator.lastName;
			creator.firstName = '';
			creator.fieldMode = 1;
		}
		creators.push(creator);
	});
});
			newItem.extra += addExtra('creatorsExt', JSON.stringify(creators));
			creators.forEach((creator) => {
				delete creator.country;
				delete creator.original;
				newItem.creators.push(creator);
			});
			break;
		}
		case 'journalArticle':
			newItem.publicationTitle = labels.getWith('刊名');
			// newItem.volume = 卷次;
			newItem.issue = tryMatch(labels.getWith('期号'), /0*([1-9]\d*)/, 1);
			// newItem.pages = 页码;
			newItem.date = labels.getWith('出版日期');
			newItem.extra += addExtra('original-title', labels.getWith('外文题名'));
			newItem.extra += addExtra('fund', labels.getWith('基金项目'));
			newItem.extra += addExtra('if', labels.getWith('影响因子'));
			labels.getWith('作者', true).querySelectorAll('a').forEach(element => newItem.creators.push(ZU.cleanAuthor(element.textContent, 'author')));
			labels.getWith('关键词', true).querySelectorAll('a').forEach(element => newItem.tags.push(element.textContent));
			break;
		case 'newspaperArticle':
			newItem.publicationTitle = labels.getWith('来源');
			newItem.date = ZU.strToISO(labels.getWith('日期'));
			newItem.paegs = tryMatch(labels.getWith('版次'), /0*([1-9]\d*)/, 1);
			labels.getWith('作者', true).querySelectorAll('a').forEach(element => newItem.creators.push(ZU.cleanAuthor(element.textContent, 'author')));
			// 报纸语言皆为中文，使用空格分割不会造成意外
			labels.getWith('关键词').split(' ').forEach(tag => newItem.tags.push(tag));
			break;
		case 'thesis':
			newItem.thesisType = `${labels.getWith('学位名称')}学位论文`;
			newItem.university = labels.getWith('学位授予单位');
			newItem.date = labels.getWith('学位年度');
			newItem.creators.push(ZU.cleanAuthor(labels.getWith('作者'), 'author'));
			labels.getWith('导师').split('，').forEach(creator => newItem.creators.push(ZU.cleanAuthor(creator, 'contributor')));
			break;
		case 'conferencePaper':
			newItem.date = labels.getWith('日期');
			newItem.proceedingsTitle = labels.getWith('会议录名称');
			newItem.conferenceName = labels.getWith('会议名称');
			labels.getWith('作者', true).querySelectorAll('a').forEach(element => newItem.creators.push(ZU.cleanAuthor(element.textContent, 'author')));
			labels.getWith('关键词', true).querySelectorAll('a').forEach(element => newItem.tags.push(element.textContent));
			break;
		case 'patent': {
			newItem.filingDate = ZU.strToISO(labels.getWith('申请日期'));
			newItem.applicationNumber = labels.getWith('申请号');
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
			newItem.extra += addExtra('Genre', labels.getWith('专利类型'));
			labels.getWith('发明人').split('，').forEach(creator => newItem.creators.push(ZU.cleanAuthor(creator, 'inventor')));
			break;
		}
		case 'standard':
			newItem.number = labels.getWith('标准号').replace('-', '—');
			newItem.extra += addExtra('original-title', labels.getWith('标准英文名'));
			newItem.extra += addExtra('IPC', labels.getWith('IPC分类号'));
			newItem.extra += addExtra('ICS', labels.getWith('ICS分类号'));
			newItem.extra += addExtra('reference', labels.getWith('引用标准'));
			newItem.extra += addExtra('drafting-committee', labels.getWith('起草单位'));
			newItem.extra += addExtra('replacement', labels.getWith('替代情况'));
			newItem.extra += addExtra('CCS', labels.getWith('中标分类号'));
			break;
		default:
			break;
	}
	newItem.url = url;
	newItem.complete();
}

class LabelsX {
	constructor(doc, selector) {
		this.innerData = [];
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				// avoid empty text
				while (!elementCopy.firstChild.textContent.replace(/\s/g, '')) {
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
					let key = tryMatch(text, /^[[【]?[\s\S]+?[】\]:：]/).replace(/\s/g, '');
					elementCopy.textContent = tryMatch(text, /^[[【]?[\s\S]+?[】\]:：]\s*(.+)/, 1);
					this.innerData.push([key, elementCopy]);
				}
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.getWith(aLabel, element))
				.filter(element => element);
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
			? ZU.trimInternal(keyValPair[1].textContent)
			: '';
	}
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
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
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "朱平",
						"creatorType": "author"
					}
				],
				"date": "2020",
				"abstractNote": "卵巢癌是一种早期诊断率低而致死率较高的恶性肿瘤,对其预后标志物的鉴定和生存率的预测仍是生存分析的重要任务。利用卵巢癌预后相关基因构建基因共表达网络,鉴定预后生物标志物并进行生存率的预测。首先,对TCGA(The cancer genome atlas)数据库下载的卵巢癌基因表达数据实施单因素回归分析,利用得到的747个预后相关基因构建卵巢癌预后加权基因共表达网络。其次,考虑网络的生物学意义,利用蛋白质相互作用(Protein-protein interaction, PPI)数据对共表达网络中的模块重新加权,并根据网络中基因的拓扑重要性对基因进行排序。最后,运用Cox比例风险回归对网络中的重要基因构建卵巢癌预后模型,鉴定了3个预后生物标志物。生存分析结果显示,这3个标志物能够显著区分不同预后的患者,较好地预测卵巢癌患者的预后情况。  隐藏更多",
				"extra": "original-title: Research on gene co-expression network and prognostic biomarkers of ovarian cancer\nfund: 国家自然科学基金项目(No.11271163)\nif: 1.6145(2022)",
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
				"extra": "price: 52.00\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"郑振宇\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"王秀利\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"刘丹梅\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"宋运贤\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"陈国梁\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"邵燕\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"胡沂淮\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"阚劲松\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"韩凤桐\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"孙新城\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"李宏\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"张锐\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"王彦芹\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1}]",
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
				"extra": "price: 7.35 8.90\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"希顿\",\"creatorType\":\"author\",\"country\":\"英\",\"original\":\"Heaton, J.B.\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"特顿\",\"creatorType\":\"author\",\"country\":\"英\",\"original\":\"Turton, N.D.\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"吴骅\",\"creatorType\":\"translator\",\"country\":\"\",\"original\":\"\",\"fieldMode\":1}]",
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
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "秦燕香",
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "张晓茹",
						"creatorType": "author"
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
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "石云",
						"creatorType": "contributor"
					},
					{
						"firstName": "",
						"lastName": "吕斌",
						"creatorType": "contributor"
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
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "弓鑫",
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "张新宇",
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "张建朝",
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "常晓娟",
						"creatorType": "author"
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
						"creatorType": "inventor"
					},
					{
						"firstName": "",
						"lastName": "金心茹",
						"creatorType": "inventor"
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
				"extra": "original-title: Description detailed regulations for ecological and environmental archives\nICS: 01.040.13\ndrafting-committee: 苏州大学\nreplacement: 替代HJ/T 9-1995",
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
				"extra": "creatorsExt: [{\"firstName\":\"Martin J. Ball; Joan\",\"lastName\":\"Rahilly\",\"creatorType\":\"author\",\"country\":\"\",\"original\":\"\"}]",
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
