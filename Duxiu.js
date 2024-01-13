{
	"translatorID": "c198059a-3e3a-4ee5-adc0-c3011351365c",
	"label": "Duxiu",
	"creator": "Bo An, jiaojiaodubai",
	"target": ".*duxiu\\..*(getPage|search|bookDetail|JourDetail|NPDetail|thesisDetail|CPDetail|patentDetail|StdDetail|\\/base)",
	"minVersion": "6.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-13 10:22:39"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Bo An
	Copyright © 2022 YFdyh000

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
	Z.debug('---------- Duxiu 2024-01-13 16:31:44 ----------');
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
	let subUrl = Object.keys(pageMap).find(key => url.includes(key));
	if (subUrl) {
		return pageMap[subUrl];
	}
	else if (/search|getpage/i.test(url) && getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('ul dt a');
	for (let row of rows) {
		let href = row.href;
		Z.debug(href);
		let title = ZU.trimInternal(row.textContent);
		Z.debug(title);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	Z.debug(doc.body.innerText);
	const itemType = detectWeb(doc, url);
	if (itemType == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			// browser needed
			// 不支持图书章节，因为图书章节的页面是动态加载
			let itemDoc = await requestDocument(url);
			Z.debug(itemDoc.body.innerText);
			await doWeb(itemDoc, url);
		}
	}
	else if (itemType == 'bookSection') {
		await scrapeBookSection(doc, url);
	}
	else {
		let newItem = await scrape(doc, url);
		newItem.complete();
	}
}

async function scrape(doc, url = doc.location.href) {
	// Z.debug(doc.body.innerText);
	let labels = new Labels(doc, 'dl > dd');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	var newItem = new Z.Item(detectWeb(doc, url));
	newItem.title = text(doc, 'dl > dt');
	newItem.extra = '';
	newItem.abstractNote = labels.getWith(['摘要', '内容提要', '简介']).replace(/\s*隐藏更多$/, '');
	labels.getWith(['作者', '发明人']).split(/[;；]\s*/)
		.forEach((group) => {
			let creators = group.split(/[,，]\s*/);
			let creatorType = /翻?译$/.test(creators[creators.length - 1])
				? 'translator'
				: 'author';
			creators.forEach((creator) => {
				creator = creator
					.replace(/^：/, '')
					.replace(/[主编著翻译\d\s]*$/g, '');
				creator = ZU.cleanAuthor(creator, creatorType);
				if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
					creator.fieldMode = 1;
				}
				newItem.creators.push(creator);
			});
		});
	switch (newItem.itemType) {
		case 'book': {
			newItem.series = labels.getWith('丛书名');
			let pubInfo = labels.getWith('出版发行');
			// newItem.edition = 版本;
			newItem.place = tryMatch(pubInfo, /(.+?)：/, 1);
			// 有时pubInfo仅含出版社：https://book.duxiu.com/bookDetail.jsp?dxNumber=000007798830&d=84337FB71A1ED5917061A4BB4C3610AF
			newItem.publisher = /[：，]/.test(pubInfo)
				? tryMatch(pubInfo, /：(.+?)(?:，|\s*,\s*)/, 1)
				: pubInfo;
			newItem.date = ZU.strToISO(tryMatch(pubInfo, /[\d.-]*$/));
			newItem.numPages = labels.getWith('页数');
			newItem.ISBN = labels.getWith('ISBN');
			// newItem.shortTitle = 短标题;
			break;
		}
		case 'journalArticle':
			newItem.publicationTitle = labels.getWith('刊名, 来源');
			newItem.issue = tryMatch(labels.getWith('期号'), /0*(\d+)/, 1);
			newItem.pages = labels.getWith('页码');
			newItem.date = labels.getWith('出版日期');
			newItem.ISSN = labels.getWith('ISSN');
			break;
		case 'newspaperArticle':
			newItem.publicationTitle = labels.getWith('来源');
			newItem.date = ZU.strToISO(labels.getWith('日期'));
			newItem.pages = tryMatch(labels.getWith('版次'), /0*(\d+)/, 1);
			break;
		case 'thesis': {
			newItem.university = labels.getWith('学位授予单位');
			newItem.date = labels.getWith('学位年度');
			newItem.thesisType = `${labels.getWith('学位名称')}学位论文`;
			let tutors = labels.getWith('导师姓名');
			if (tutors) {
				tutors.split(/[,;，；]\s*/).forEach((tutor) => {
					newItem.creators.push(ZU.cleanAuthor(tutor, 'contributor'));
				});
			}
			break;
		}
		case 'conferencePaper':
			newItem.date = labels.getWith('日期');
			newItem.proceedingsTitle = labels.getWith('会议录名称');
			newItem.conferenceName = labels.getWith('会议名称');
			// "place": "地点",
			// "publisher": "出版社",
			// "pages": "页码",
			break;
		case 'patent': {
			newItem.place = labels.getWith('地址');
			newItem.filingDate = ZU.strToISO(labels.getWith('申请日期'));
			newItem.applicationNumber = labels.getWith('申请号');
			let patentDetail = attr(doc, 'dd > a[href*="pat.hnipo"]', 'href');
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
				newItem.issueDate = tabel.getNext('法律状态公告日');
				newItem.legalStatus = tabel.getNext('法律状态');
			}
			break;
		}
		case 'standard':
			newItem.number = labels.getWith('标准号').replace('-', '—');
			break;
	}
	newItem.url = tryMatch(url, /^.+dxNumber=\w+/i) || url;
	newItem.extra += addExtra('original-title', labels.getWith(['外文题名', '标准英文名']));
	newItem.extra += addExtra('Genre', labels.getWith('专利类型'));
	newItem.extra += addExtra('price', labels.getWith('原书定价'));
	newItem.extra += addExtra('IF', labels.getWith('影响因子'));
	newItem.extra += addExtra('fund', labels.getWith('基金'));
	newItem.extra += addExtra('cite as', labels.getWith('参考文献格式'));
	newItem.extra += addExtra('CLC', labels.getWith('中图法分类号'));
	newItem.extra += addExtra('contact', labels.getWith('作者联系方式'));
	newItem.extra += addExtra('IPC', labels.getWith('IPC'));
	newItem.extra += addExtra('ICS', labels.getWith('ICS'));
	newItem.extra += addExtra('reference', labels.getWith('引用标准'));
	// https://book.duxiu.com/StdDetail.jsp?dxid=320151549195&d=443146B469770278DD217B9CF31D9D84
	newItem.extra += addExtra('replacement', labels.getWith('替代情况'));
	newItem.extra += addExtra('CCS', labels.getWith('中标分类号'));
	labels.getWith(['关键词', '主题词']).split(/[;，；]/).forEach(tag => newItem.tags.push(tag));
	return newItem;
}

async function scrapeBookSection(doc, url = doc.location.href) {
	let bookUrl = tryMatch(Array.from(doc.querySelectorAll('script'))
		.map(element => element.innerText)
		.find(script => script.includes('bookDetail.jsp?')),
	/\('(https:\/\/book\.duxiu\.com\/bookDetail.jsp\?dxNumber=\d+&d=\w+)'\)/i,
	1
	);
	Z.debug(`bookUrl: ${bookUrl}`);
	// 依赖浏览器环境
	let bookItem = await scrape(await requestDocument(bookUrl));
	Z.debug(bookItem);
	var sectionItem = new Z.Item('bookSection');
	sectionItem.title = text(doc, 'title');
	sectionItem.pages = tryMatch(attr(doc, '#saveAs', 'href'), /PageRanges=([\d-]+)&/i, 1);
	sectionItem.url = url;
	bookItem.bookTitle = bookItem.title;
	delete bookItem.itemType;
	delete bookItem.title;
	delete bookItem.pages;
	delete bookItem.url;
	bookItem = Object.assign(sectionItem, bookItem);
	let pdfLink = doc.querySelector('#saveAs');
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

/* Util */
class Labels {
	constructor(doc, selector) {
		this.innerData = [];
		Array.from(doc.querySelectorAll(selector))
			.filter(element => element.firstElementChild)
			.filter(element => !element.querySelector(selector))
			.filter(element => !/^\s*$/.test(element.textContent))
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

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
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
		"url": "https://book.duxiu.com/bookDetail.jsp?dxNumber=000030156491&d=E232D717765DD7E60641F94C0D55032C",
		"items": [
			{
				"itemType": "book",
				"title": "海德格尔文集  尼采  下",
				"creators": [
					{
						"firstName": "",
						"lastName": "（德）海德格尔",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙周兴",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王庆节",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙周兴",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "2015-11",
				"ISBN": "9787100094313",
				"abstractNote": "本书分上、下两册，是作者1936至1940年间在弗莱堡大学做的讲座，又附加了若干篇论文，意在审视作者从1930年以来直至“关于人道主义的书信”（发表于1947年）所走过的思想道路。",
				"extra": "price: 268.00（全2卷）\noriginal-title: ：Martin Heidegger Nietzsche\ncite as: （德）海德格尔著；孙周兴，王庆节主编；孙周兴译. 海德格尔文集 尼采 下[M]. 北京：商务印书馆, 2015.11.\nCLC: B516.47 ( 哲学、宗教->欧洲哲学->欧洲各国哲学->德国哲学 )",
				"libraryCatalog": "Duxiu",
				"numPages": "1235",
				"place": "北京",
				"publisher": "商务印书馆",
				"url": "https://book.duxiu.com/bookDetail.jsp?dxNumber=000030156491",
				"attachments": [],
				"tags": [
					{
						"tag": "F.W.（1844-1900）-哲学思想-研究"
					},
					{
						"tag": "尼采"
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
				"extra": "original-title: What Are Stochastic Dynamical Systems\nIF: 1.1868(2022)\nfund: 国家自然科学基金项目；中央高校基本科研业务费专项资金\ncite as: 段金桥1,2,3,郑雅允2,白露2,姜涛2.什么是随机动力系统[J].数学建模及其应用,2015,(第4期).",
				"issue": "4",
				"libraryCatalog": "Duxiu",
				"pages": "1-9",
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
				"abstractNote": "摘 要 : 《国学丛刊》由国立东南大学国学研究会顾实等人于1923年11月创办,停刊于1926年,是中国近代国学发展史上的重要期刊。本文首先通过对当时的学术背景分析、国学研究会的创办及其指导员和主要活动的介绍等展现了《国学丛刊》从创办到消亡的全过程中所面临的外部状况。继而对几大板块的文本内容和目录进行了详细的讨论和梳理,这也构成了本文的核心内容所在。长期以来,学术界习惯性地将《国学丛刊》与文化保守主义者归为文化“关门主义”的代表,却对其真正内容的特色和发展缺乏深度的理解。《国学丛刊》向后世学者展示的绝不是简单的文化保守,而是在激进的西化大潮中对民族文化的本位坚守,是一种理性和积极乐观的文化立场和态度。在提倡“爱国好学”、坚守传统本位的同时,《国学丛刊》也主张“学融中西”,以包容、开放的态度面对西方学术和文化。丛刊引入了大量的西方学术理论知识并对科学先锋徐寿等人做出了高度的评价,这也是《国学丛刊》精神的可贵所在。同时,丛刊关注辛亥革命等政治变革,收录了大量的爱国主义诗歌和作品。在这些作品中,流露着丛刊作者群体忧国忧民的家国情怀,洋溢着浓厚的爱国主义精神。他们认为,民族命运的变迁和个人息息相关,面对国家危机,知识分子应该拿出勇气和担当。而一个民族的发展离不开本民族文化的强大,因此在近代化的过程中坚守民族文化的本位至关重要。《国学丛刊》代表了 20世纪20年代仁人志士对民族文化命运的一种深刻思考和行动,当下这种思考和行动仍然没有停止,从刊正是为我们展示了这样一种视角和学术理路供我们学习和借鉴。",
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
				"abstractNote": "摘 要 : 中文拼写纠错任务是检测和纠正句子中拼写错误的汉字,即错别字。它在日常生活和工作中有着广泛的应用。譬如,帮助搜索引擎进行关键词消歧,纠正语音、光学字符识别中出现的错别字,以及辅助作文自动批改等等。同时,中文拼写纠错是一项极具挑战性的任务,因为汉字的组合具有多样性和复杂性,而且错误字符会给句子的语义带来极大的干扰。因此,一个有效的中文拼写纠错解决方案往往需要具备人类级别的语义理解能力。在早期,研究人员利用端到端的机器翻译模型来解决该问题,尝试直接将错误句子翻译成正确的句子。但此方法作为一个序列到序列的通用模型,并没有特别考虑如何利用错误字符的相似性信息。针对此问题,本文展开了第一项研究,尝试利用对比学习来获取错误字符的相似性信息,以此让模型学到更多的错误字符信息。另外,近年来的研究焦点是将BERT与外部知识（例如混淆集以及字符的语音和形态特征）相结合来解决该任务。但BERT本身的错别字检测能力不足仍是这类方法的性能瓶颈。因此本文展开了第二项研究,提出了使用“输入显著性”技术来识别字符错误并将错误信息集成到纠正模型中,以提高整个模型的检测和纠正能力。本文的主要贡献可总结如下:·本文提出一个基于对比学习和指针网络的端到端中文拼写纠错模型,即Contr PN。为了能有效利用错误字符的相似性信息,本文先用混淆集构建和原始错误句子相似的句子,然后使用对比学习使得原始错误句子和通过混淆集构成的错误句子表征距离接近,同时使原始错误句子和训练批次中的随机句子的表征距离变远,从而使得属于同一个混淆集的字符具有更加相似的表征,提高模型纠正错误字符的概率。此外,在Seq2Seq模型的基础上利用指针网络来让模型学习复制句子中的正确字符,而不单从词表中生成候选词,可以减少误纠率。·本文提出一个基于“显著性”信息的中文拼写纠错模型,即Spel LM。本文针对BERT本身错别字检测能力不足,以模仿人类纠正拼写错误的方式来缓解此问题。具体来说,人类会首先根据上下文信息识别拼写错误的字符,然后用正确的字符替代它们。因此,本文提出了一个检测-纠正的两阶段模型,模型在第一阶段识别拼写错误,然后在第二阶段借助错误检测信息来纠正错误。模型使用“输入显著性”技术来识别字符错误并将较精确的错误信息集成到纠正模型BERT中,以提高整个模型的检测和纠正能力。此方法独立于相似性过滤器、混淆集、语音和形态特征或候选依赖特征等现有技术,使其独立且可以灵活地与现有方法结合,且更加高效。·本文将深度模型的可解释技术应用于深度模型,展示了如何利用可解释人工智能（XAI）技术来提升深度学习模型在特定任务中的性能。通过中文拼写纠错这个任务,本文在Spel LM模型中利用输入显著性技术提取字符对于句子错误预测的显著性信息,显著性越高的字符越有可能是错误字符,随后可以利用这个信息与字符纠错模型相结合,提高纠正错误字符的成功率。尽管中文拼写纠错是本研究的重点任务,但我们相信这个思想可以经过迁移,用来解决其他相关任务。综上所述,对于中文拼写纠错任务,本文重点研究了如何在基于端到端的纠错模型中有效利用错误字符的相关性信息,以及如何进一步提高基于BERT的纠错模型的错误检测能力。针对这两个问题,本文分别提出了各自的改进方案,构建了相应的神经网络模型,即上述的Contr PN模型和Spel LM模型。并结合基准模型,利用两种评估矩阵在多个测试集上进行评估,印证了改进方案的有效性和可行性。",
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
				"abstractNote": "摘 要 : 电影的民族主体性一直是中国电影人孜孜以求的议题，当前中国电影市场面临再次升级，电影工业化体系建设被提上议程。随着\"重工业电影\"概念的提出，在新的产业形势下正确表达中国电影的民族主体性将成为时代的必然，同时新的电影形态也给中国电影民族主体性的表达带来新的讨论空间。在\"重工业电影\"的创作中，可结合其自身特点，利用视效优势建立电影的民族影像风骨，在类型化创作中把握民族审美心理，并在叙事中回归故事本身，表达民族精神及情感，从而达到民族主体性与\"重工业电影\"的有机结合，实现民族话语的准确表达。",
				"conferenceName": "中国艺术学理论学会艺术管理专业委员会第七届年会",
				"libraryCatalog": "Duxiu",
				"proceedingsTitle": "中国艺术学理论学会艺术管理专业委员会第七届年会论文集",
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
				"issueDate": "2022.04.15",
				"abstractNote": "本发明公开了一种结合知网与词林的词语相似度获取方法及系统，利用《知网》义原层次树计算知网义原信息内容含量；并构建第一词语相似度计算模型；根据扩展版《同义词词林》词林拓扑树中的路径信息构建第二词语相似度计算模型；根据待测词语对在《知网》和扩展版《同义词词林》中的分布情况，综合两个计算模型的计算结果，获... 展开",
				"applicationNumber": "202111510160.7",
				"extra": "Genre: 发明专利\nIPC: G06F16/35;G06F40/247;G06F40/194",
				"filingDate": "2021-12-10",
				"legalStatus": "实质审查的生效",
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
				"extra": "ICS: 59.080.99\nreference: FZ/T 63043-2018",
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
