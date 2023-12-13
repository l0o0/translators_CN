{
	"translatorID": "e034d9be-c420-42cf-8311-23bca5735a32",
	"label": "Baidu Scholar",
	"creator": "l0o0<linxzh1989@gmail.com>",
	"target": "^https?://(www\\.|a\\.)?xueshu\\.baidu\\.com/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-13 13:36:27"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2017 Philipp Zumstein

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

function detectWeb(doc, _url) {
	let source = text(doc, '#dtl_r .dtl_journal > h3').replace(/^来源/, '');
	let labels = Array.from(doc.querySelectorAll('[class^="label_"]')).map(element => element.innerText);
	let labeMap = {
		专利: 'patent',
		标准号: 'standard',
		形成单位: 'report'
	};
	if (source) {
		return {
			期刊: 'journalArticle',
			会议: 'conferencePaper',
			学校: 'thesis',
			出版社: 'book',
			图书: 'book'
		}[source];
	}
	for (const key in labeMap) {
		if (labels.some(element => element.includes(key))) {
			return labeMap[key];
		}
	}
	if (doc.querySelectorAll('.bookAuthor')) {
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('h3 > a[href*="show?paperid="], h3 > a[href*="cmd=paper_forward"]');
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.textContent);
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
	let labels = new Labels(doc, '.c_content > [class$="_wr"]');
	let id = url.match(/paperid=(\w+)/);
	let itemType = detectWeb(doc, url);
	id = false;
	// Z.debug(id);
	if (id && !['standard', 'report'].includes(itemType)) {
		let bibUrl = `https://xueshu.baidu.com/u/citation?type=bib&${id[0]}`;
		let bibText = await requestText(bibUrl);
		Z.debug(bibText);
		let translator = Zotero.loadTranslator("import");
		translator.setTranslator('9cb70025-a888-4a29-a210-93ec52da40d4');
		translator.setString(bibText);
		translator.setHandler('itemDone', (_obj, item) => {
			delete item.itemID;
			item.itemType = itemType;
			item.extra = '';
			switch (item.itemType) {
				case 'book':
					delete item.publisher;
					break;
				case 'conferencePaper':
					item.conferenceName = item.publicationTitle;
					delete item.publicationTitle;
					break;
				case 'patent':
					break;
				case 'thesis':
					item.unniversityunniversity = item.publisher;
					delete item.publisher;
					delete item.type;
					break;
				default:
					break;
			}
			item = Object.assign(item, fixItem(item, doc, url));
			item.complete();
		});
		await translator.translate();
	}
	else {
		var newItem = new Z.Item(detectWeb(doc, url));
		newItem.title = text(doc, '.main-info h3');
		newItem.extra = '';
		let creators = Array.from(doc.querySelectorAll('.author_text > span, .author_wr [class^="kw_main"] > span'));
		creators.forEach((element) => {
			newItem.creators.push(ZU.cleanAuthor(element.innerText, 'author'));
		});
		switch (newItem.itemType) {
			case 'conferencePaper':
				newItem.conferenceName = labels.getWith('会议名称');
				newItem.place = labels.getWith('会议地点');
				break;
			case 'report':
				newItem.date = ZU.strToISO(text(doc, '.year_wr [class^="kw_main"]'));
				newItem.institution = text(doc, '.publisher_wr [class^="kw_main"]');
				break;
			case 'standard':
				newItem.number = labels.getWith('标准号').replace(/(\d)\s*-\s*(\d)/, '$1—$2');
				newItem.date = labels.getWith('发布日期');
				newItem.extra += addExtra('CCS number', labels.getWith('CCS'));
				newItem.extra += addExtra('ICS number', labels.getWith('ICS'));
				break;
			default:
				break;
		}
		newItem = Object.assign(newItem, fixItem(newItem, doc, url));
		newItem.complete();
	}
}

function fixItem(item, doc, url) {
	let labels = new Labels(doc, '.c_content > [class$="_wr"]');
	Z.debug('fixing item...');
	Z.debug('labels:');
	Z.debug(labels.innerData.map(element => [element[0], element[1].innerText]));
	item.abstractNote = text(doc, 'p.abstract');
	item.DOI = labels.getWith('DOI');
	item.url = attr(doc, '.paper_src_content .allversion_content a', 'href') || url;
	item.creators.forEach((element) => {
		if (/[\u4e00-\u9fa5]/.test(element.lastName)) {
			element.fieldMode = 1;
		}
	});
	let tags = doc.querySelectorAll('div.kw_wr a') || labels.getWith('关键词', true).querySelectorAll('a');
	if (tags && tags.length == 1) {
		item.tags = tags[0].innerText.split("；");
	}
	else if (tags && tags.length > 1) {
		tags.forEach(function (tag) {
			item.tags.push(tag.innerText);
		});
	}
	switch (item.itemType) {
		case 'thesis':
			item.thesisType = (labels.getWith('学位级别') ? `${labels.getWith('学位级别')}学位论文` : '');
			break;
		case 'book':
			item.ISBN = labels.getWith('IGBN');
			item.date = labels.getWith('出版时间');
			item.publisher = labels.getWith('出版社');
			break;
		case 'journalArticle':
			item.date = labels.getWith('年份');
			break;
		case 'patent':
			item.country = labels.getWith('国省代号');
			item.assignee = labels.getWith('申请\\(专利权\\)人');
			item.patentNumber = labels.getWith('申请\\(专利\\)号');
			item.applicationNumber = labels.getWith('申请\\(专利\\)号');
			item.filingDate = ZU.strToISO(labels.getWith('申请日期'));
			item.rights = labels.getWith('主权项');
			item.creators = Array.from(doc.querySelectorAll('.author_wr [class^="kw_main"] span')).map(element => ZU.cleanAuthor(element.innerText, 'inventor'));
			break;
		default:
			break;
	}
	return item;
}

/* Util */
class Labels {
	constructor(doc, selector) {
		this.innerData = [];
		Array.from(doc.querySelectorAll(selector)).forEach((element) => {
			let elementCopy = element.cloneNode(true);
			let key = elementCopy.removeChild(elementCopy.firstElementChild).innerText.replace(/\s/g, '');
			this.innerData.push([key, elementCopy]);
		});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(element => this.getWith(element))
				.filter(element => element);
			return result.length
				? result.find(element => element)
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=b3ab239032d44d951d8eee26d7bc44bf&site=xueshu_se",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Zotero: information management software 2.0",
				"creators": [
					{
						"firstName": "P.",
						"lastName": "Fernandez",
						"creatorType": "author"
					}
				],
				"DOI": "info:doi/10.1108/07419051111154758",
				"abstractNote": "Purpose – The purpose of this paper is to highlight how the open-source bibliographic management program Zotero harnesses Web 2.0 features to make library resources more accessible to casual users without sacrificing advanced features. This reduces the barriers understanding library resources and provides additional functionality when organizing information resources. Design/methodology/approach – The paper reviews select aspects of the program to illustrate how it can be used by patrons and information professionals, and why information professionals should be aware of it. Findings – Zotero has some limitations, but succeeds in meeting the information management needs of a wide variety of users, particularly users who use online resources. Originality/value – This paper is of interest to information professionals seeking free software that can make managing bibliographic information easier for themselves and their patrons.",
				"libraryCatalog": "Baidu Scholar",
				"shortTitle": "Zotero",
				"url": "https://www.nstl.gov.cn/paper_detail.html?id=83a33794f9a21e9744c0ddfab800f71f",
				"attachments": [],
				"tags": [
					{
						"tag": "Citation management"
					},
					{
						"tag": "Internet"
					},
					{
						"tag": "Library services"
					},
					{
						"tag": "Open source"
					},
					{
						"tag": "Reference management"
					},
					{
						"tag": "Technology"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://xueshu.baidu.com/s?wd=zotero&rsv_bp=0&tn=SE_baiduxueshu_c1gjeupa&rsv_spt=3&ie=utf-8&f=8&rsv_sug2=0&sc_f_para=sc_tasktype%3D%7BfirstSimpleSearch%7D",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=99d353b9677f0d0287e051e400aea729&site=xueshu_se",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "中国物理学会2012年秋季学术会议导带弯曲对有限深GaN/Ga1-xAlxN球形量子点中杂质态的影响及其压力效应",
				"creators": [
					{
						"firstName": "",
						"lastName": "曹艳娟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "闫祖威",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "以三角势近似界面导带弯曲,采用变分理论研究了有限高势垒GaN/Ga1-xAlxN球形量子点[1]中杂质态的结合能[2].并考虑电子的有效质量[3],材料的介电常数以及禁带宽度随流体静压力的变化,数值计算了杂质态结合能随量子点尺寸,电子的面密度,铝组分和压力的变化关系.结果表明,随着电子面密度的增加,杂质态结合能降低,当电子面密度较大时,随着量子点尺寸的增大,结合能趋于一个相同且较小的值.",
				"conferenceName": "中国物理学会2012年秋季学术会议",
				"libraryCatalog": "Baidu Scholar",
				"place": "广州",
				"url": "https://d.wanfangdata.com.cn/Conference/7884709",
				"attachments": [],
				"tags": [
					{
						"tag": "流体静压力"
					},
					{
						"tag": "电子面密度"
					},
					{
						"tag": "结合能"
					},
					{
						"tag": "量子点"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=3f9bd602ac5e8d658307fd3708fed410",
		"items": [
			{
				"itemType": "thesis",
				"title": "美国的欧洲犹太难民政策研究(1933-1945)",
				"creators": [
					{
						"firstName": "",
						"lastName": "娄伟光",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "1933-1945年是希特勒在德国建立纳粹极权统治,反犹主义逐步升级至顶峰的时期.纳粹政府的反犹,迫犹政策造成了严重的欧洲犹太难民问题.做为犹太难民躲避纳粹迫害的主要目的地和二战期间世界\"民主的堡垒\",美国的欧洲犹太难民政策对欧洲犹太难民的影响是举足轻重的.本文将对1933-1945年美国的欧洲犹太难民政策进行综合研究,并提出一些自己的浅见. 第一章主要阐述1933-1945年的纳粹反犹政策和欧洲犹太难民问题这一历史背景.欧洲犹太难民问题的发展和纳粹反犹政策的升级密不可分,随着纳粹反犹政策的一步步升级,欧洲犹太难民的数量变得越来越多,国际社会对难民问题的应对也变得越来越无力. 第二章主要研究1933-1945年美国的欧洲犹太难民政策.1933-1945年美国对欧洲犹太难民的政策完全是在美国既有的移民限额体系内实施的,同时,美国的欧洲犹太难民政策在不同时期又呈现出不同的特点.1933-1937年是美国消极接纳犹太难民的时期,这一时期美国的做法是不主动接收难民,不主动承担责任.1938-1941年美国多次主动寻求解决难民问题的办法,并多次主动召开了解决难民问题的国际会议,但这一时期美国的难民政策从整体看仍是消极的,不作为的.1941-1945年是纳粹大屠杀时期,这一时期美国的欧洲犹太难民政策主要涉及到对犹太人的援救,但在1944年之前,美国少有援救行动,直到1944年成立战时难民委员会后才做了一些积极的援救行动. 第三章分析美国的欧洲犹太难民政策的成因.美国的犹太难民政策的成因是较为复杂的,在受到美国国内的孤立主义思潮和美国国内的反犹主义的制约的同时,还受到美德关系的制约以及罗斯福个人因素的影响. 第四章研究美国的欧洲犹太难民政策产生的影响.美国较为消极的政策首先对欧洲犹太难民产生了直接影响,使众多本可以逃离纳粹魔掌的犹太难民没有得到生存的机会.其次,美国接收的欧洲犹太难民和众多的知识难民对美国社会产生了巨大影响,他们在诸多领域为美国做出了巨大贡献. 本文得出的结论主要有:1933—1945年期间美国的欧洲犹太难民政策是较为消极和不作为的,这一特性是由美国政府面临的国家利益与国内外现实因素决定的.客观来说,欧洲犹太难民的困境并不能完全由美国来承担责任,当时的整个文明世界也都对犹太难民缺乏足够有力的援助与安置.美国接收的犹太\"知识难民\"在战后为美国经济,社会及文化的繁荣创造了有利条件.从某种程度上看,这也是美国战时欧洲犹太难民政策为美国社会带来的一个长久的积极影响.",
				"libraryCatalog": "Baidu Scholar",
				"thesisType": "硕士学位论文",
				"url": "https://d.wanfangdata.com.cn/thesis/Y2314659",
				"attachments": [],
				"tags": [
					{
						"tag": "德国"
					},
					{
						"tag": "犹太难民政策"
					},
					{
						"tag": "纳粹"
					},
					{
						"tag": "罗斯福"
					},
					{
						"tag": "美国"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=b11b0a933ef004fff0f56bf0e864b69e",
		"items": [
			{
				"itemType": "patent",
				"title": "微波加热路面综合养护车",
				"creators": [
					{
						"firstName": "",
						"lastName": "肖铁和",
						"creatorType": "inventor"
					},
					{
						"firstName": "",
						"lastName": "胡健",
						"creatorType": "inventor"
					}
				],
				"abstractNote": "本实用新型是一种采用微波加热的原理对沥青破损路面进行现场加热再生修补的特种民用汽车.包括有车头(20),车底盘(21),车轮(22)及其驱动装置,其中车底盘(21)内装设有动力电流装置(2),微波加热装置(5),高压电源(6),运动驱动装置(12),电气控制装置(13),综合养护设备(16)及沥青混凝土加热装置A.本实用新型由于采用微波加热路面的结构,因此,其不仅可节约路面加热时间,提高工作效率,且路面修补质量好;此外,本实用新型可使路面加热与路面修补综合进行,修复路面一气呵成,本实用新型满足了高等级公路养护工程的\"快速进入,快速作业,快速撤离\"的现代化工作要求,是养护路面特种专用车的新发展.其经济效益及社会效益都较显著.",
				"applicationNumber": "CN 200420095088",
				"assignee": "佛山市美的日用家电集团有限公司",
				"country": "广东",
				"filingDate": "2004-11-12",
				"patentNumber": "CN 200420095088",
				"rights": "1、一种微波加热路面综合养护车,包括有车头(20)、车底盘(21)、车\\r\\r\\r\\r\\n轮(22)及其驱动装置,其特征在于车底盘(21)内装设有动力电流装置(2)、\\r\\r\\r\\r\\n微波加热装置(5)、高压电源(6)、运动驱动装置(12)、电气控制装置(13)、\\r\\r\\r\\r\\n综合养护设备(16)及沥青混凝土加热装置A,其中微波加热装置(5)通过运\\r\\r\\r\\r\\n动驱动装置(12)装设在车底盘(21)的后端,综合养护设备(16)装设在车\\r\\r\\r\\r\\n底盘(21)的前端,沥青混凝土加热装置A装设在车底盘(21)的中部,微波\\r\\r\\r\\r\\n加热装置(5)及沥青混凝土加热装置A与高压电源(6)电连接,运动驱动装\\r\\r\\r\\r\\n置(12)及综合养护设备(16)与动力电流装置(2)电连接,且动力电流装\\r\\r\\r\\r\\n置(2)、微波加热装置(5)、高压电源(6)、运动驱动装置(12)、综合养护\\r\\r\\r\\r\\n设备(16)及沥青混凝土加热装置A均与电气控制装置(13)电连接。 展开",
				"url": "http://cprs.patentstar.com.cn/Search/Detail?ANE=4CAA0AAA9GFCCFIA9ICD9IED9HCA9AEA9BHD6DCA9CFC9BHA",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=160v0040de7d06c0640g0g20ta759296",
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献 参考文献著录规则",
				"creators": [],
				"date": "2015-05-15",
				"abstractNote": "本标准规定了各个学科,各种类型信息资源的参考文献的著录项目,著录顺序,著录用符号,著录用文字,各个著录项目的著录方法以及参考文献在正文中的标注法.本标准适用于著者和编辑著录参考文献,而不是供图书馆员,文献目录编制者以及索引编辑者使用的文献著录规则.",
				"extra": "CCS number: A 综合-A10/19 经济、文化-A14 图书馆、档案、文献与情报工作\nICS number: 01 综合、术语学、标准化、文献-01.140 信息学、出版-01.140.20 信息学",
				"libraryCatalog": "Baidu Scholar",
				"number": "GB/T 7714—2015",
				"url": "http://www.nssi.org.cn/nssi/front/87860706.html",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=1b0d02509s6u0c80b77u0440h0651943",
		"items": [
			{
				"itemType": "report",
				"title": "四川省南充市仪陇县地质灾害详细调查成果报告",
				"creators": [
					{
						"firstName": "",
						"lastName": "雷耕",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2017-04-19",
				"abstractNote": "受\"5.12\"汶川特大地震,\"4.20\"芦山强烈地震,\"11.12\"康定地震及频发极端天气,不合理人类工程活动等影响,四川省境内山区地质环境条件变得更加脆弱,诱发新增了大量崩塌,滑坡,泥石流,不稳定斜坡等次生地质灾害,原有地质灾害隐患点绝大部分出现变形加剧,险情加重趋势,严重危害人民群众生命财产安全,制约着社会经济可持续发展.在此背景下,我单位通过收集资料,野外踏勘和积极参加投标活动,有幸中标\"四川省2016年地质灾害详细调查第11标段(南充市仪陇县)\",成为该项目承建单位.本次详查在充分收集已有资料的基础上,以遥感解译,地面调查,测绘和工程勘查为主要手段,开展仪陇县滑坡,崩塌,泥石流等地质灾害详细调查,基本查明县境内地质灾害及其隐患发育特征,分布规律以及形成的地质环境条件,并对其危害程度进行评价,划分地质灾害易发区和危险区,建立健全群测群防网络,建立地质灾害信息系统,为减灾防灾和制定区域防灾规划提供基础地质依据.本次详查完成了全县1:50000调查测绘面积1791km2,其中重点调查区面积363.3km2,一般调查区面积1427.7km2;调查了各类地质灾害点769处,地质环境点136处;完成全县1:50000遥感解译面积1791km2,完成重点场镇及典型小流域1:10000遥感解译73.7km2,解译地质灾害和环境点131处;完成金城镇,大寅镇,永乐镇,立山镇4处重点地段1:10000调查测绘面积39.7km2;完成肖水河典型小流域综合调查测绘,面积34km2;完成了金城镇瑞泉路危岩,赵家湾堆积场滑坡,三河镇兰田滑坡3处典型点勘查及小流域勘查;完成典型斜坡,岩土体结构实测剖面19条18.452km;完成钻探31孔410.4m,浅井30口102.2m;完成全县已实施治理工程及排危除险复核29处,完成地质灾害宣传培训13场次,汛期指导(3人),四川省地质环境地质灾害基础数据库数据录入等工作,全部或超额完成了投标及设计书所有工作量.",
				"institution": "四川省地质矿产勘查开发局四0五地质队",
				"libraryCatalog": "Baidu Scholar",
				"url": "http://www.ngac.cn/dzzlfw_sjgl/d2d/dse/category/detail.do?method=cdetail&_id=223_20745&tableCode=ty_qgg_edmk_t_ajxx&categoryCode=dzzlk",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=d2047af90e6290d3c8bc3dd213bde044&site=xueshu_se",
		"items": [
			{
				"itemType": "book",
				"title": "国务院关于鼓励支持和引导个体私营等非公有制经济发展的若干意见",
				"creators": [
					{
						"firstName": "",
						"lastName": "新华社",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "公有制为主体,多种所有制经济共同发展是我国社会主义初级阶段的基本经济制度.毫不动摇地巩固和发展公有制经济,毫不动摇地鼓励,支持和引导非公有制经济发展.使两者在社会主义现代化进程中相互促进.共同发展,是必须长期坚持的基本方针,是完善社会主义市场经济体制,建设中国特色社会主义的必然要求.改革开放以来.我国个体,私营等非公有制经济不断发展壮大,已经成为社会主义市场经济的重要组成部分和促进社会生产力发展的重要力量.",
				"libraryCatalog": "Baidu Scholar",
				"url": "https://d.wanfangdata.com.cn/periodical/zgzxqy200503002",
				"attachments": [],
				"tags": [
					{
						"tag": "个体私营"
					},
					{
						"tag": "中国"
					},
					{
						"tag": "中国特色社会主义"
					},
					{
						"tag": "共同发展"
					},
					{
						"tag": "基本方针"
					},
					{
						"tag": "基本经济制度"
					},
					{
						"tag": "多种所有制经济"
					},
					{
						"tag": "社会主义市场经济体制"
					},
					{
						"tag": "社会主义现代化"
					},
					{
						"tag": "非公有制经济"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=9151406471e5456fb7183e0ecd035527",
		"items": [
			{
				"itemType": "book",
				"title": "图解大国陆权",
				"creators": [
					{
						"firstName": "",
						"lastName": "哈尔福德・麦金德",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2014.12",
				"abstractNote": "本书是一本系统介绍英国\"陆权论\"提出者哈尔福德麦金德的陆权思想的书籍,满足了读者了解陆权和地缘政治的需求,文中有陆战分析和历史解读,还配以图片,有助于读者理解麦金德的理论.通过分析各大帝国在\"心脏地带\"的纷乱争斗历史中,麦金德发现有一点是非常明确的,即无论英国与俄国竞争,还是与德国对方,政策的出发点都是一致的,那就是要避免\"心脏地带\"落入陆地强权之手.此后,他提出了著名的麦氏三段论:谁统治了东欧,谁就能控制大陆\"心脏地带\";谁控制大陆\"心脏地带\",谁就能控制\"世界岛(欧亚大陆)\";谁控制了\"世界岛\",谁就能控制整个世界!",
				"libraryCatalog": "Baidu Scholar",
				"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=9151406471e5456fb7183e0ecd035527",
				"attachments": [],
				"tags": [
					{
						"tag": "政治地理学"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=90b81c383fc4d0c258666fc5be53a6b0",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "欧亚心脏地带的各种梦想——地缘政治学重新崛起",
				"creators": [
					{
						"firstName": "",
						"lastName": "克洛弗",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "汤玉鼎",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1999",
				"DOI": "CNKI:SUN:WSWZ.0.1999-10-009",
				"abstractNote": "本文揭示了地缘政治学在俄罗斯政界已重新崛起,并体现在一系列路线、方针和政策中,值得世人关注。",
				"libraryCatalog": "Baidu Scholar",
				"url": "http://qikan.cqvip.com/Qikan/Article/Detail?id=687838790199910009",
				"attachments": [],
				"tags": [
					{
						"tag": "亚心"
					},
					{
						"tag": "俄罗斯民族主义"
					},
					{
						"tag": "加诺"
					},
					{
						"tag": "地缘政治学"
					},
					{
						"tag": "心脏地带"
					},
					{
						"tag": "普里马科夫"
					},
					{
						"tag": "欧亚主义"
					},
					{
						"tag": "民族主义者"
					},
					{
						"tag": "泛斯拉夫主义"
					},
					{
						"tag": "重新崛起"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=120u04b0932h0e30p8410e10up662850",
		"items": [
			{
				"itemType": "patent",
				"title": "一种网络小说防盗章方法,装置,存储器和处理器",
				"creators": [
					{
						"firstName": "",
						"lastName": "余洋",
						"creatorType": "inventor"
					}
				],
				"abstractNote": "本发明公开了一种网络小说防盗章方法,装置,存储器和处理器,主要用于实现网络小说正版防盗章的功能,具体流程为当网络小说收费章节更新时向用户账号屏蔽收费章节若干时间,若干时间内,用户账号向网站请求下发收费章节时需回答验证问题,用户账号回答正确时下发真实收费章节,用户账号回答错误时下发特殊章节,若干时间后,用户账号向网站请求下发收费章节时可正常获取收费章节,本技术方案还包括用于执行这一方法的装置,存储器和处理器,本技术方案可以很好的降低网络盗版事件的发生概率,防止自动盗章软件对网络小说的盗章行为.",
				"applicationNumber": "CN201810679432.8",
				"assignee": "深圳市必发达科技有限公司",
				"country": "CN440303",
				"patentNumber": "CN201810679432.8",
				"url": "https://www.zhangqiaokeyan.com/patent-detail/06120111504719.html",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=f4423dadd27ee5bdf386006d0791548d",
		"items": [
			{
				"itemType": "book",
				"title": "\"泰国人民之声\"电台热烈欢呼我新的氢弹爆炸和首次地下核试验成功 中国新的成就是毛泽东思想伟大胜利",
				"creators": [
					{
						"firstName": "",
						"lastName": "新华社",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1969.10.21",
				"libraryCatalog": "Baidu Scholar",
				"url": "https://xueshu.baidu.com/usercenter/paper/show?paperid=f4423dadd27ee5bdf386006d0791548d",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
