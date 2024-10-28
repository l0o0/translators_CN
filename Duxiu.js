{
	"translatorID": "c198059a-3e3a-4ee5-adc0-c3011351365c",
	"label": "Duxiu",
	"creator": "Bo An, jiaojiaodubai",
	"target": ".*\\.duxiu\\..*(getPage|search|bookDetail|JourDetail|NPDetail|thesisDetail|CPDetail|patentDetail|StdDetail|\\/base)",
	"minVersion": "6.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-10-28 08:36:35"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Bo An
	Copyright © 2022 YFdyh000
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

function detectWeb(doc, url) {
	const pageMap = {
		'/book/base/': 'bookSection',
		bookDetail: 'book',
		JourDetail: 'journalArticle',
		NPDetail: 'newspaperArticle',
		thesisDetail: 'thesis',
		CPDetail: 'conferencePaper',
		patentDetail: 'patent',
		StdDetail: 'standard'
	};
	const subUrl = Object.keys(pageMap).find(key => url.includes(key));
	if (subUrl) {
		return pageMap[subUrl];
	}
	else if (/search|getpage/i.test(url) && getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('ul dt a');
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
	const itemType = detectWeb(doc, url);
	if (itemType == 'multiple') {
		const items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url of Object.keys(items)) {
			// browser needed
			// 不支持图书章节，因为图书章节的页面是动态加载
			const itemDoc = await requestDocument(url);
			await doWeb(itemDoc, url);
		}
	}
	else if (itemType == 'bookSection') {
		await scrapeBookSection(doc, url);
	}
	else {
		const newItem = await scrape(doc, url);
		newItem.complete();
	}
}

async function scrape(doc, url = doc.location.href) {
	const fields = {};
	const rows = doc.querySelectorAll('.card_text > dl > dd');
	for (const row of rows) {
		const elmCopy = row.cloneNode(true);
		const label = elmCopy.querySelector('.card_text-dd-label,span:first-child');
		if (!label) continue;
		const labelText = ZU.trimInternal(label.textContent).replace(/\s|:$/g, '');
		const colon = elmCopy.querySelector('.card_text-dd-label+span');
		label.parentNode.removeChild(label);
		colon && colon.parentNode.removeChild(colon);
		if (/\S/.test(labelText)) fields[labelText] = elmCopy;
	}
	function getField(labels, element = false) {
		if (!Array.isArray(labels)) labels = [labels];
		for (const label of labels) {
			const value = fields[label];
			if (value) return element ? value : ZU.trimInternal(value.textContent);
		}
		return '';
	}
	Z.debug(Object.keys(fields).map(key => [key, getField(key)]));
	const extra = new Extra();
	const newItem = new Z.Item(detectWeb(doc, url));
	newItem.title = ZU.trimInternal(text(doc, '.card_text > dl > dt'));
	newItem.abstractNote = getField(['摘要', '内容提要', '简介']).replace(/\s*隐藏更多$/, '');
	const creatorsExt = [];
	getField(['作者', '发明人']).split(/[;；]\s*/)
		.forEach((group) => {
			const creators = group.split(/[,，]\s*/);
			const creatorType = /翻?译$/.test(creators[creators.length - 1])
				? 'translator'
				: 'author';
			creators.forEach((creator) => {
				creator = creator
					.replace(/^：/, '')
					.replace(/[主编著翻译\d\s]*$/g, '');
				const country = tryMatch(creator, /^（(.+?)）/, 1);
				creator = creator.replace(/^（.+?）/, '');
				const original = tryMatch(creator, /（(.+?)）$/, 1);
				creator = creator.replace(/（.+?）$/, '');
				if (original) extra.push('original-author', ZU.capitalizeName(original), true);
				creator = ZU.cleanAuthor(creator, creatorType);
				if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
					creator.lastName = (creator.firstName + creator.lastName).replace(/([\u4e00-\u9fff])\s?([A-Z])/g, '$1·$2').replace(/([A-Z])\.(\S)/g, '$1. $2');
					creator.firstName = '';
					creator.fieldMode = 1;
				}
				newItem.creators.push(JSON.parse(JSON.stringify(creator)));
				creator.country = country;
				creator.original = original;
				creatorsExt.push(creator);
			});
		});
	if (creatorsExt.some(creator => creator.country || creator.original)) extra.set('creatorsExt', JSON.stringify(creatorsExt));
	switch (newItem.itemType) {
		case 'book': {
			newItem.series = getField('丛书名');
			const pubInfo = getField('出版发行');
			newItem.edition = tryMatch(newItem.title, /\b.+?版$/);
			newItem.place = tryMatch(pubInfo, /(.+?)：/, 1);
			// 有时pubInfo仅含出版社：https://book.duxiu.com/bookDetail.jsp?dxNumber=000007798830&d=84337FB71A1ED5917061A4BB4C3610AF
			newItem.publisher = /[：，]/.test(pubInfo)
				? tryMatch(pubInfo, /：(.+?)\s?[,，]\s?/, 1)
				: pubInfo;
			newItem.date = ZU.strToISO(tryMatch(pubInfo, /[\d.-]*$/));
			newItem.numPages = getField('页数');
			newItem.ISBN = getField('I S B N');
			// newItem.shortTitle = 短标题;
			break;
		}
		case 'journalArticle':
			newItem.publicationTitle = getField(['刊名', '来源']);
			newItem.issue = tryMatch(getField('期号'), /0*(\d+)/, 1);
			newItem.pages = getField('页码');
			newItem.date = getField('出版日期');
			newItem.ISSN = getField('ISSN');
			break;
		case 'newspaperArticle':
			newItem.publicationTitle = getField('来源');
			newItem.date = ZU.strToISO(getField('日期'));
			newItem.pages = tryMatch(getField('版次'), /0*(\d+)/, 1);
			break;
		case 'thesis': {
			newItem.university = getField('学位授予单位');
			newItem.date = getField('学位年度');
			newItem.thesisType = `${getField('学位名称')}学位论文`;
			const tutors = getField('导师姓名');
			if (tutors) {
				tutors.split(/[,;，；]\s*/).forEach((tutor) => {
					newItem.creators.push(ZU.cleanAuthor(tutor, 'contributor'));
				});
			}
			break;
		}
		case 'conferencePaper':
			newItem.date = getField('日期');
			newItem.proceedingsTitle = getField('会议录名称');
			newItem.conferenceName = getField('会议名称');
			// "place": "地点",
			// "publisher": "出版社",
			// "pages": "页码",
			break;
		case 'patent': {
			newItem.place = getField('地址');
			newItem.filingDate = ZU.strToISO(getField('申请日期'));
			newItem.applicationNumber = getField('申请号');
			const patentDetail = attr(doc, 'dd > a[href*="pat.hnipo"]', 'href');
			if (patentDetail) {
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
				newItem.issueDate = ZU.strToISO(tabel.getNext('法律状态公告日'));
				newItem.legalStatus = tabel.getNext('法律状态');
			}
			break;
		}
		case 'standard':
			newItem.number = getField('标准号').replace('-', '—');
			break;
	}
	newItem.url = tryMatch(url, /^.+dxNumber=\w+/i) || url;
	extra.set('original-title', ZU.capitalizeTitle(getField(['外文题名', '标准英文名'])), true);
	extra.set('genre', getField('专利类型'), true);
	extra.set('price', getField('原书定价'));
	extra.set('IF', getField('影响因子'));
	extra.set('fund', getField('基金'));
	extra.set('citeAs', getField('参考文献格式'));
	extra.set('CLC', getField('中图法分类号'));
	extra.set('contact', getField('作者联系方式'));
	extra.set('IPC', getField('IPC'));
	extra.set('ICS', getField('ICS'));
	extra.set('reference', getField('引用标准'));
	// https://book.duxiu.com/StdDetail.jsp?dxid=320151549195&d=443146B469770278DD217B9CF31D9D84
	extra.set('replacement', getField('替代情况'));
	extra.set('CCS', getField('中标分类号'));
	getField(['关键词', '主题词']).split(/[;，；]/).forEach(tag => newItem.tags.push(tag));
	newItem.extra = extra.toString();
	return newItem;
}

async function scrapeBookSection(doc, url = doc.location.href) {
	const bookUrl = tryMatch(Array.from(doc.querySelectorAll('script'))
		.map(element => element.innerText)
		.find(script => script.includes('bookDetail.jsp?')),
	/\('(https:\/\/book\.duxiu\.com\/bookDetail.jsp\?dxNumber=\d+&d=\w+)'\)/i,
	1
	);
	Z.debug(`bookUrl: ${bookUrl}`);
	// 依赖浏览器环境
	let bookItem = await scrape(await requestDocument(bookUrl));
	Z.debug(bookItem);
	const sectionItem = new Z.Item('bookSection');
	sectionItem.title = text(doc, 'title');
	sectionItem.pages = tryMatch(attr(doc, '#saveAs', 'href'), /PageRanges=([\d-]+)&/i, 1);
	sectionItem.url = url;
	bookItem.bookTitle = bookItem.title;
	delete bookItem.itemType;
	delete bookItem.title;
	delete bookItem.pages;
	delete bookItem.url;
	bookItem = Object.assign(sectionItem, bookItem);
	const pdfLink = doc.querySelector('#saveAs');
	if (pdfLink) {
		sectionItem.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	sectionItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	sectionItem.complete();
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

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://book.duxiu.com/views/specific/4010/bookDetail.jsp?dxNumber=000030591379&d=AAB0ABB8D0C543BFF26956EE9601E809",
		"items": [
			{
				"itemType": "book",
				"title": "计算机组成与设计 硬件/软件接口 MIPS版 原书第6版",
				"creators": [
					{
						"firstName": "",
						"lastName": "戴维·A. 帕特森",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "约翰·L. 亨尼斯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王党辉",
						"creatorType": "translator",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "安建峰",
						"creatorType": "translator",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张萌",
						"creatorType": "translator",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王继禾",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "2022-07",
				"abstractNote": "： 本书由2017年图灵奖的两位得主撰写，是计算机体系结构领域的经典教材。第6版在保留计算机组成方面传统论题并延续前5版特点的基础上，引入了许多近几年计算机领域发展中的新论题，如领域专用体系结构（DSA）、硬件安全攻击等。另外，在实例方面也与时俱进地采用新的ARMCortex-A53微体系结构和IntelCorei76700Skylake微体系结构等现代设计对计算机组成的基本原理进行说明。在关于处理器的一章中，在单周期处理器和流水线处理器之间增加了对多周期处理器的介绍，使读者更易理解流水线处理器产生的必然性。",
				"edition": "MIPS版 原书第6版",
				"extra": "original-author: David A. Patterson\noriginal-author: John L. Hennessy\noriginal-title: COMPUTER ORGANNIZATION AND DESIGN THE HARDWARE/SOFTWARE INTERFACE，MIPS EDITION，SIXTH EDITION\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"戴维·A. 帕特森\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"美\",\"original\":\"David A. Patterson\"},{\"firstName\":\"\",\"lastName\":\"约翰·L. 亨尼斯\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"美\",\"original\":\"John L. Hennessy\"},{\"firstName\":\"\",\"lastName\":\"王党辉\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"安建峰\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"张萌\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"王继禾\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"}]\nprice: 149.00\nciteAs: （美）戴维·A.帕特森（David A. Patterson），（美）约翰 L.亨尼斯（John L. Hennessy）著；王党辉，安建峰，张萌，王继禾译. 计算机组成与设计 硬件/软件接口 MIPS版 原书第6版[M]. 北京：机械工业出版社, 2022.07.\nCLC: TP301 ( 工业技术->自动化技术、计算机技术->计算技术、计算机技术->一般性问题 )",
				"libraryCatalog": "Duxiu",
				"numPages": "580",
				"place": "北京",
				"publisher": "机械工业出版社",
				"series": "计算机科学丛书 华章教育",
				"url": "https://book.duxiu.com/views/specific/4010/bookDetail.jsp?dxNumber=000030591379",
				"attachments": [],
				"tags": [
					{
						"tag": "计算机组成原理"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.duxiu.com/search?channel=search&gtag=&sw=%E5%9B%BD%E5%AD%A6&ecode=utf-8&Field=all&adminid=&btype=&seb=0&pid=0&year=&sectyear=&showc=0&fenleiID=&searchtype=&authid=0&exp=0&expertsw=&Sort=2",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://jour.duxiu.com/JourDetail.jsp?dxNumber=100232796446&d=3D8C8F355C594EBCD96602E1EE599A61&fenlei=13011005",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "什么是随机动力系统",
				"creators": [
					{
						"firstName": "",
						"lastName": "段金桥",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "郑雅允",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "白露",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "姜涛",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015",
				"ISSN": "2095-3070",
				"abstractNote": "本文综述随机动力系统的基本概念、理论、方法与应用,内容包括Brownian运动、Lévy运动和随机微分方程及其解的刻画。重点讨论通过量化指标、不变结构、几何方法和非高斯性态来理解随机动力学现象。本文还介绍了段金桥的著作《An Introduction to Stochastic Dynamics(随机动力系统导论)》的基本内容。",
				"extra": "original-title: What Are Stochastic Dynamical Systems\nIF: 0.8901(2023)\nfund: 国家自然科学基金项目；中央高校基本科研业务费专项资金\nciteAs: 段金桥1,2,3,郑雅允2,白露2,姜涛2.什么是随机动力系统[J].数学建模及其应用,2015,(第4期).",
				"issue": "4",
				"libraryCatalog": "Duxiu",
				"pages": "1-9",
				"publicationTitle": "数学建模及其应用",
				"url": "https://jour.duxiu.com/JourDetail.jsp?dxNumber=100232796446",
				"attachments": [],
				"tags": [
					{
						"tag": "Brownian运动"
					},
					{
						"tag": "Fokker-Planck方程"
					},
					{
						"tag": "Lévy运动"
					},
					{
						"tag": "不变流形"
					},
					{
						"tag": "随机动力系统"
					},
					{
						"tag": "随机微分方程"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://newspaper.duxiu.com/NPDetail.jsp?dxNumber=406009217912&d=84EAFEA9F557F7B8AA076F2533E47863",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "国学与家风",
				"creators": [
					{
						"firstName": "",
						"lastName": "张建云",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-05-17",
				"libraryCatalog": "Duxiu",
				"pages": "10",
				"publicationTitle": "今晚报",
				"url": "https://newspaper.duxiu.com/NPDetail.jsp?dxNumber=406009217912",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://jour.duxiu.com/thesisDetail.jsp?dxNumber=390107234763&d=C427F0C1FF6DF58569AA4E671806709F&fenlei=07020202",
		"items": [
			{
				"itemType": "thesis",
				"title": "《国学丛刊》研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "景欢",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "于亭",
						"creatorType": "contributor"
					}
				],
				"date": "2018",
				"abstractNote": "《国学丛刊》由国立东南大学国学研究会顾实等人于1923年11月创办,停刊于1926年,是中国近代国学发展史上的重要期刊。本文首先通过对当时的学术背景分析、国学研究会的创办及其指导员和主要活动的介绍等展现了《国学丛刊》从创办到消亡的全过程中所面临的外部状况。继而对几大板块的文本内容和目录进行了详细的讨论和梳理,这也构成了本文的核心内容所在。长期以来,学术界习惯 更多... 摘 要 : 《国学丛刊》由国立东南大学国学研究会顾实等人于1923年11月创办,停刊于1926年,是中国近代国学发展史上的重要期刊。本文首先通过对当时的学术背景分析、国学研究会的创办及其指导员和主要活动的介绍等展现了《国学丛刊》从创办到消亡的全过程中所面临的外部状况。继而对几大板块的文本内容和目录进行了详细的讨论和梳理,这也构成了本文的核心内容所在。长期以来,学术界习惯性地将《国学丛刊》与文化保守主义者归为文化“关门主义”的代表,却对其真正内容的特色和发展缺乏深度的理解。《国学丛刊》向后世学者展示的绝不是简单的文化保守,而是在激进的西化大潮中对民族文化的本位坚守,是一种理性和积极乐观的文化立场和态度。在提倡“爱国好学”、坚守传统本位的同时,《国学丛刊》也主张“学融中西”,以包容、开放的态度面对西方学术和文化。丛刊引入了大量的西方学术理论知识并对科学先锋徐寿等人做出了高度的评价,这也是《国学丛刊》精神的可贵所在。同时,丛刊关注辛亥革命等政治变革,收录了大量的爱国主义诗歌和作品。在这些作品中,流露着丛刊作者群体忧国忧民的家国情怀,洋溢着浓厚的爱国主义精神。他们认为,民族命运的变迁和个人息息相关,面对国家危机,知识分子应该拿出勇气和担当。而一个民族的发展离不开本民族文化的强大,因此在近代化的过程中坚守民族文化的本位至关重要。《国学丛刊》代表了 20世纪20年代仁人志士对民族文化命运的一种深刻思考和行动,当下这种思考和行动仍然没有停止,从刊正是为我们展示了这样一种视角和学术理路供我们学习和借鉴。",
				"libraryCatalog": "Duxiu",
				"thesisType": "硕士学位论文",
				"university": "武汉大学",
				"url": "https://jour.duxiu.com/thesisDetail.jsp?dxNumber=390107234763",
				"attachments": [],
				"tags": [
					{
						"tag": "《国学丛刊》"
					},
					{
						"tag": "保守主义"
					},
					{
						"tag": "文本研究"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://jour.duxiu.com/thesisDetail.jsp?dxNumber=390109152129&d=67FF0CFDCA295D070C801D4765239348&fenlei=181704110101%3B%7C1817020603",
		"items": [
			{
				"itemType": "thesis",
				"title": "基于神经网络的中文拼写纠错",
				"creators": [
					{
						"firstName": "",
						"lastName": "陈贝",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "高明",
						"creatorType": "contributor"
					},
					{
						"firstName": "",
						"lastName": "陆雪松",
						"creatorType": "contributor"
					}
				],
				"date": "2022",
				"abstractNote": "中文拼写纠错任务是检测和纠正句子中拼写错误的汉字,即错别字。它在日常生活和工作中有着广泛的应用。譬如,帮助搜索引擎进行关键词消歧,纠正语音、光学字符识别中出现的错别字,以及辅助作文自动批改等等。同时,中文拼写纠错是一项极具挑战性的任务,因为汉字的组合具有多样性和复杂性,而且错误字符会给句子的语义带来极大的干扰。因此,一个有效的中文拼写纠错解决方案往往需要具备 更多... 摘 要 : 中文拼写纠错任务是检测和纠正句子中拼写错误的汉字,即错别字。它在日常生活和工作中有着广泛的应用。譬如,帮助搜索引擎进行关键词消歧,纠正语音、光学字符识别中出现的错别字,以及辅助作文自动批改等等。同时,中文拼写纠错是一项极具挑战性的任务,因为汉字的组合具有多样性和复杂性,而且错误字符会给句子的语义带来极大的干扰。因此,一个有效的中文拼写纠错解决方案往往需要具备人类级别的语义理解能力。在早期,研究人员利用端到端的机器翻译模型来解决该问题,尝试直接将错误句子翻译成正确的句子。但此方法作为一个序列到序列的通用模型,并没有特别考虑如何利用错误字符的相似性信息。针对此问题,本文展开了第一项研究,尝试利用对比学习来获取错误字符的相似性信息,以此让模型学到更多的错误字符信息。另外,近年来的研究焦点是将BERT与外部知识（例如混淆集以及字符的语音和形态特征）相结合来解决该任务。但BERT本身的错别字检测能力不足仍是这类方法的性能瓶颈。因此本文展开了第二项研究,提出了使用“输入显著性”技术来识别字符错误并将错误信息集成到纠正模型中,以提高整个模型的检测和纠正能力。本文的主要贡献可总结如下:·本文提出一个基于对比学习和指针网络的端到端中文拼写纠错模型,即Contr PN。为了能有效利用错误字符的相似性信息,本文先用混淆集构建和原始错误句子相似的句子,然后使用对比学习使得原始错误句子和通过混淆集构成的错误句子表征距离接近,同时使原始错误句子和训练批次中的随机句子的表征距离变远,从而使得属于同一个混淆集的字符具有更加相似的表征,提高模型纠正错误字符的概率。此外,在Seq2Seq模型的基础上利用指针网络来让模型学习复制句子中的正确字符,而不单从词表中生成候选词,可以减少误纠率。·本文提出一个基于“显著性”信息的中文拼写纠错模型,即Spel LM。本文针对BERT本身错别字检测能力不足,以模仿人类纠正拼写错误的方式来缓解此问题。具体来说,人类会首先根据上下文信息识别拼写错误的字符,然后用正确的字符替代它们。因此,本文提出了一个检测-纠正的两阶段模型,模型在第一阶段识别拼写错误,然后在第二阶段借助错误检测信息来纠正错误。模型使用“输入显著性”技术来识别字符错误并将较精确的错误信息集成到纠正模型BERT中,以提高整个模型的检测和纠正能力。此方法独立于相似性过滤器、混淆集、语音和形态特征或候选依赖特征等现有技术,使其独立且可以灵活地与现有方法结合,且更加高效。·本文将深度模型的可解释技术应用于深度模型,展示了如何利用可解释人工智能（XAI）技术来提升深度学习模型在特定任务中的性能。通过中文拼写纠错这个任务,本文在Spel LM模型中利用输入显著性技术提取字符对于句子错误预测的显著性信息,显著性越高的字符越有可能是错误字符,随后可以利用这个信息与字符纠错模型相结合,提高纠正错误字符的成功率。尽管中文拼写纠错是本研究的重点任务,但我们相信这个思想可以经过迁移,用来解决其他相关任务。综上所述,对于中文拼写纠错任务,本文重点研究了如何在基于端到端的纠错模型中有效利用错误字符的相关性信息,以及如何进一步提高基于BERT的纠错模型的错误检测能力。针对这两个问题,本文分别提出了各自的改进方案,构建了相应的神经网络模型,即上述的Contr PN模型和Spel LM模型。并结合基准模型,利用两种评估矩阵在多个测试集上进行评估,印证了改进方案的有效性和可行性。",
				"libraryCatalog": "Duxiu",
				"thesisType": "硕士学位论文",
				"university": "华东师范大学",
				"url": "https://jour.duxiu.com/thesisDetail.jsp?dxNumber=390109152129",
				"attachments": [],
				"tags": [
					{
						"tag": "BERT"
					},
					{
						"tag": "中文拼写纠错"
					},
					{
						"tag": "对比学习"
					},
					{
						"tag": "归因网络"
					},
					{
						"tag": "显著性信息"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://jour.duxiu.com/CPDetail.jsp?dxNumber=330108219629&d=07D54E26D018CFFE717D9DC8F3E28BA4&fenlei=0",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "\"重工业电影\"形态下电影民族主体性表达的再思考",
				"creators": [
					{
						"firstName": "",
						"lastName": "荆婧",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018",
				"abstractNote": "电影的民族主体性一直是中国电影人孜孜以求的议题，当前中国电影市场面临再次升级，电影工业化体系建设被提上议程。随着\"重工业电影\"概念的提出，在新的产业形势下正确表达中国电影的民族主体性将成为时代的必然，同时新的电影形态也给中国电影民族主体性的表达带来新的讨论空间。在\"重工业电影\"的创作中，可结合其自身特点，利用视效优势建立电影的民族影像风骨，在类型化创作中把握 更多... 摘 要 : 电影的民族主体性一直是中国电影人孜孜以求的议题，当前中国电影市场面临再次升级，电影工业化体系建设被提上议程。随着\"重工业电影\"概念的提出，在新的产业形势下正确表达中国电影的民族主体性将成为时代的必然，同时新的电影形态也给中国电影民族主体性的表达带来新的讨论空间。在\"重工业电影\"的创作中，可结合其自身特点，利用视效优势建立电影的民族影像风骨，在类型化创作中把握民族审美心理，并在叙事中回归故事本身，表达民族精神及情感，从而达到民族主体性与\"重工业电影\"的有机结合，实现民族话语的准确表达。",
				"conferenceName": "中国艺术学理论学会艺术管理专业委员会第七届年会",
				"extra": "contact: 临沂大学历史文化学院",
				"libraryCatalog": "Duxiu",
				"proceedingsTitle": "中国艺术学理论学会艺术管理专业委员会第七届年会论文集",
				"url": "https://jour.duxiu.com/CPDetail.jsp?dxNumber=330108219629",
				"attachments": [],
				"tags": [
					{
						"tag": "民族主体性"
					},
					{
						"tag": "海外传播"
					},
					{
						"tag": "身份认同"
					},
					{
						"tag": "重工业电影"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.duxiu.com/patentDetail.jsp?dxid=166042694583&d=01E8862E4B5CAEAFB1E2CCDFEF566CF6",
		"items": [
			{
				"itemType": "patent",
				"title": "一种结合知网与词林的词语相似度获取方法及系统",
				"creators": [
					{
						"firstName": "",
						"lastName": "唐贤伦",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "罗杨",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "党晓圆",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨敬明",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "邓武权",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "邹密",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "徐梓辉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李锐",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"issueDate": "2024.08.23",
				"abstractNote": "本发明公开了一种结合知网与词林的词语相似度获取方法及系统，利用《知网》义原层次树计算知网义原信息内容含量；并构建第一词语相似度计算模型；根据扩展版《同义词词林》词林拓扑树中的路径信息构建第二词语相似度计算模型；根据待测词语对在《知网》和扩展版《同义词词林》中的分布情况，综合两个计算模型的计算结果，获得待测词语对的最终词语相似度，在原本的信息内容含量的基础上引入义原节点的密度信息，能够得到更符合人类判断的词语相似度计算结果，同时在词林的计算过程中设置关于路径信息的权重参数，通过改变该参数的值，得到更高的皮尔森相关系数，更符合人类主观判断的结果，从而提高词语相似度的计算精度和范围。 收起",
				"applicationNumber": "202111510160.7",
				"extra": "genre: 发明专利",
				"filingDate": "2021-12-10",
				"legalStatus": "授权",
				"place": "400000 重庆市南岸区南山街道崇文路2号",
				"url": "https://book.duxiu.com/patentDetail.jsp?dxid=166042694583&d=01E8862E4B5CAEAFB1E2CCDFEF566CF6",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.duxiu.com/StdDetail.jsp?dxid=320151457340&d=D15D61CC62E6E40DE6DB82785CA3212E",
		"items": [
			{
				"itemType": "standard",
				"title": "中国结绳",
				"creators": [],
				"abstractNote": "本标准规定了中国结绳的术语和定义、技术要求、分等规定、试验方法、检验规则、包装、标识、运输、贮存。 ;本标准适用于以涤纶长丝、锦纶长丝为主体原材料，直径为1.5 mmm～15 mm的中国结绳。",
				"extra": "reference: FZ/T 63043-2018",
				"libraryCatalog": "Duxiu",
				"number": "FZ/T 63043—2018",
				"url": "https://book.duxiu.com/StdDetail.jsp?dxid=320151457340&d=D15D61CC62E6E40DE6DB82785CA3212E",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
