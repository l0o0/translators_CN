{
	"translatorID": "70f12b6e-1be5-4077-8363-fdee22f4fdfd",
	"label": "Samson",
	"creator": "jiaojiaodubai",
	"target": "",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-10-06 11:30:26"
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


function detectWeb(doc, url) {
	const hasScript = !!doc.querySelector('script[data-redirecturi*="samsoncn.com"]');
	let hasCopyright = false;
	if (!hasScript) {
		// for old
		if (/西安(三才科技实业|知先信息技术)有限公司/.test(attr(doc, 'meta[name="copyright"]', 'content'))) {
			hasCopyright = true;
		}
		else {
			for (const selector of ['.buttom', '.copyright', '.container']) {
				const copyrightNodes = doc.querySelectorAll(`footer ${selector}`);
				for (const elm of copyrightNodes) {
					if (elm.querySelector('a[href*="www.samson.com"]') || elm.textContent.includes('西安三才科技实业有限公司')) {
						hasCopyright = true;
						break;
					}
				}
				if (hasCopyright) break;
			}
		}
	}
	Z.debug(`hasScript: ${hasScript}; hasCopyright: ${hasCopyright}`);
	if (!hasScript && !hasCopyright) return false;
	if (/\bArticleID=\d+|\bdarticle\.aspx\?.*id=\d+/i.test(url)) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('.selectList~div[class*="tab_con"]');
	for (const row of rows) {
		const id = tryMatch(row.className, /tab_con(\d+)/i, 1);
		const href = `${doc.location.protocol}//${doc.location.host}/#/digest?ArticleID=${id}`;
		const title = text(row, '.ml_title > a');
		if (!id || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	// for old
	const links = doc.querySelectorAll('.item> .title > a[href*="article.aspx?type=view&id="]');
	for (const row of links) {
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
			if (/\bdarticle\.aspx\?.*id=\d+/i.test(url)) {
				await scrapeOld(await requestDocument(url));
			}
			else {
				await scrapeAPI(url);
			}
		}
	}
	// for old
	else if (/\bdarticle\.aspx\?.*id=\d+/i.test(url)) {
		await scrapeOld(doc, url);
	}
	else {
		try {
			await scrapeAPI(url);
		}
		catch (error) {
			Z.debug(error);
			await scrapeDoc(doc, url);
		}
	}
}

async function scrapeAPI(url) {
	const sec = Date.now();
	const _t = Math.floor(sec / 100);
	const id = tryMatch(url, /ArticleID=([^&]+)/i, 1);
	const respond = await requestJSON(`/api/api/Web/GetArticleDetailed?_t=${_t}&id=${id}&sec=${sec}`);
	Z.debug(respond);
	if (!respond.IsSuccess) throw new Error('invalid respond');
	const handler = {
		get(target, prop) {
			const value = target[prop];
			return value === null
				? ''
				: value;
		},
	};
	const proxy = new Proxy(respond.Data, handler);
	const extra = new Extra();
	const newItem = new Z.Item('journalArticle');
	newItem.title = proxy.Title;
	extra.set('original-title', ZU.capitalizeTitle(proxy.TitleE), true);
	newItem.abstractNote = proxy.Abstract_Chinese.trim();
	newItem.publicationTitle = tryMatch(proxy.InCite, /\[J\]\.(.+?),/, 1).replace(/\(([\u4e00-\u9fff]+)\)$/, '（$1）');
	extra.set('original-container-title', ZU.capitalizeTitle(tryMatch(proxy.InCiteEN, /\[J\]\.(.+?),/, 1)), true);
	newItem.volume = proxy.Volume.replace(/0*(\d+)/, '$1');
	newItem.issue = proxy.IssueNum.replace(/0*(\d+)/, '$1');
	newItem.pages = proxy.Page_Num === proxy.Page_NumEnd
		? proxy.Page_Num
		: `${proxy.Page_Num}-${proxy.Page_NumEnd}`;
	newItem.date = ZU.strToISO(proxy.Publish_Date);
	newItem.language = 'zh-CN';
	newItem.DOI = ZU.cleanDOI(proxy.DOI);
	newItem.url = url;
	extra.set('view', proxy.View_Times);
	extra.set('download', proxy.Read_Times);
	const creatorsZh = proxy.AuthorsList.replace(/<.+?>/g, '').split('，');
	const creatorsEn = proxy.AuthorsListE.replace(/<.+?>/g, '').split(', ');
	newItem.creators = creatorsZh.map(name => cleanAuthor(name));
	if (creatorsEn.length) {
		const creators = [];
		for (let i = 1; i < creatorsZh.length; i++) {
			const creatorZh = cleanAuthor(creatorsZh[i]);
			if (creatorsEn[i]) {
				const creatorEn = ZU.capitalizeName(creatorsEn[i]);
				creatorZh.original = creatorEn;
				extra.push('original-author', creatorEn, true);
			}
			creators.push(creatorZh);
		}
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	const attId = proxy.PDFFileNameUrlGUID;
	if (attId) {
		newItem.attachments.push({
			title: 'Full Text PDF',
			mimeType: 'application/pdf',
			url: `/api/api/Web/OpenArticleFilebyGuidNew?Id=${attId}`
		});
	}
	newItem.tags = proxy.Keyword_Chinese.trim().split(/[;；]\s?/);
	newItem.extra = extra.toString();
	newItem.complete();
}

async function scrapeDoc(doc, url) {
	const digest = doc.querySelector('#digest_table');
	const labels = new Labels(doc, 'table.tabless > tbody > tr > td');
	const extra = new Extra();
	Z.debug(labels.data.map(arr => [arr[0], arr[1].textContent]));
	const newItem = new Z.Item('journalArticle');
	newItem.title = text(digest, 'h3');
	newItem.abstractNote = labels.get('摘要');
	newItem.publicationTitle = text(doc, '.detail_yjq > span:first-child').replace(/《(.+)》/, '$1').replace(/\(([\u4e00-\u9fff]+)\)$/, '（$1）');
	const pubLabels = new Labels(doc, '.detail_yjq > span');
	Z.debug(pubLabels.data.map(arr => [arr[0], arr[1].textContent]));
	newItem.volume = pubLabels.get('卷').replace(/\b0*(\d+)/, '$1');
	newItem.issue = pubLabels.get('期').replace(/\b0*(\d+)/, '$1');
	newItem.pages = pubLabels.get('页码');
	newItem.date = ZU.strToISO(pubLabels.get(['出版日期', '年']));
	newItem.language = 'zh-CN';
	newItem.DOI = labels.get('DOI');
	newItem.ISSN = ZU.cleanISSN(text(doc, '.detail_yjq > span:nth-child(2)').split('/')[0]);
	newItem.url = url;
	extra.set('view', text(doc, '.rightfloat'));
	extra.set('download', text(doc, '.rightfloat'), 1);
	newItem.extra = extra.toString();
	let creators = Array.from(labels.get('作者', true).querySelectorAll('a.sapn > sapn')).map(elm => elm.innerText);
	if (creators.length == 1) {
		creators = creators[1].split(/([\d*](,\s?)?)+/);
	}
	newItem.creators = creators.map(name => cleanAuthor(name));
	let tags = Array.from(labels.get('关键词', true).querySelectorAll('a.sapn > sapn')).map(elm => elm.innerText);
	if (tags.length == 1) {
		tags = tags[1].split(/[;；]\s?/);
	}
	newItem.tags = tags;
	newItem.complete();
}

async function scrapeOld(doc, url = doc.location.href) {
	const extra = new Extra();
	const newItem = new Z.Item('journalArticle');
	newItem.title = text(doc, '#LbTitleC');
	extra.set('original-title', text(doc, '#LbTitleE'), true);
	newItem.abstractNote = text(doc, '#LbZY');
	newItem.publicationTitle = text(doc, '#LbZaZhiShe').replace(/《(.+)》/, '$1').replace(/\(([\u4e00-\u9fff]+)\)$/, '（$1）');
	extra.set('original-container-title', ZU.capitalizeTitle(tryMatch(text(doc, '#lbreferenceen'), /\[J\]\.(.+?),/, 1)), true);
	newItem.volume = text(doc, '#lbvolumne').replace(/\b0*(\d+)/, '$1');
	newItem.issue = text(doc, '#LbIssue').replace(/^\d{4}年第?(\d+)期?/, '$1').replace(/\b0*(\d+)/, '$1');
	newItem.pages = text(doc, '#LbPageNum');
	newItem.date = ZU.strToISO(text(doc, '#LbIssueDate'));
	newItem.language = 'zh_CN';
	newItem.DOI = ZU.cleanDOI(text(doc, '#LbDOI > a'));
	newItem.ISSN = ZU.cleanISSN(text(doc, '#LbISSN'));
	newItem.url = url;
	const creatorsZh = Array.from(doc.querySelectorAll('#LbAuthorC > a'))
		.map(elm => elm.title.replace(/([\d*](,\s?)?)+$/, ''))
		.filter(str => str);
	const creatorsEn = Array.from(doc.querySelectorAll('#LbAuthorE > a'))
		.map(elm => elm.title.replace(/([\d*](,\s?)?)+$/, ''))
		.filter(str => str);
	newItem.creators = creatorsZh.map(name => cleanAuthor(name));
	if (creatorsEn.length) {
		const creators = [];
		for (let i = 1; i < creatorsZh.length; i++) {
			const creatorZh = cleanAuthor(creatorsZh[i]);
			if (creatorsEn[i]) {
				const creatorEn = ZU.capitalizeName(creatorsEn[i]);
				creatorZh.original = creatorEn;
				extra.push('original-author', creatorEn, true);
			}
			creators.push(creatorZh);
		}
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	const pdfLink = doc.querySelector('#downlinks > a');
	if (pdfLink) {
		newItem.attachments.push({
			title: 'Full Text PDF',
			mimeType: 'application/pdf',
			url: pdfLink.href
		});
	}
	let tags = Array.from(doc.querySelectorAll('#LbKeyC > a')).map(elm => elm.title);
	if (tags.length == 1) {
		tags = tags[0].split(/[,;，；、]\s?|\s/);
	}
	newItem.tags = tags;
	newItem.extra = extra.toString();
	newItem.complete();
}

function cleanAuthor(name) {
	const creator = ZU.cleanAuthor(name, 'author');
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	return creator;
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		const nodes = doc.querySelectorAll(selector);
		for (const node of nodes) {
			// avoid nesting
			// avoid empty
			if (node.querySelector(selector) || !/\S/.test(node.textContent)) continue;
			const elmCopy = node.cloneNode(true);
			// avoid empty text
			while (![1, 3, 4].includes(elmCopy.firstChild.nodeType) || !/\S/.test(elmCopy.firstChild.textContent)) {
				elmCopy.removeChild(elmCopy.firstChild);
				if (!elmCopy.firstChild) break;
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
		}
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://journal.seu.edu.cn/#/digest?ArticleID=7583",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "海水干湿循环作用下UHTCC动态压缩性能试验研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "李庆华",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈奕琨",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "何晓宇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "姚福成",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "徐世烺",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-07-06",
				"DOI": "10.3969/j.issn.1001-0505.2024.04.002",
				"abstractNote": "为研究应变率和海水干湿循环周期对超高韧性水泥基复合材料(UHTCC)动态压缩性能的影响,采用直径75 mm的分离式霍普金森压杆系统对0~120 d海水干湿循环作用后的UHTCC试件开展动态压缩试验.通过改进ZWT非线性黏弹性本构模型,提出了一种考虑海水干湿循环作用的UHTCC试件的动态本构模型.结果表明,UHTCC试件的动态抗压强度增强因子随着干湿循环周期的增加逐渐减小.在同一冲击气压下,随着干湿循环周期的增加,UHTCC试件的峰值应力和耗能先增大后减小,并分别在60和90 d时达到峰值.在相同干湿循环周期下,UHTCC试件的峰值应力、动态抗压强度增强因子和耗能均随应变率的增大而增大,表现出明显的应变率效应.改进的动态本构模型能够较好地描述海水干湿循环作用下UHTCC试件的动态压缩应力-应变关系.",
				"extra": "original-title: Experimental study on dynamic compression properties of UHTCC under seawater dry-wet cycle\noriginal-container-title: Journal of Southeast University (Natural Science Edition)\noriginal-author: Chen Yikun\noriginal-author: He Xiaoyu\noriginal-author: Yao Fucheng\noriginal-author: Xu Shilang\nview: 405\ndownload: 201\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"陈奕琨\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Chen Yikun\"},{\"firstName\":\"\",\"lastName\":\"何晓宇\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"He Xiaoyu\"},{\"firstName\":\"\",\"lastName\":\"姚福成\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Yao Fucheng\"},{\"firstName\":\"\",\"lastName\":\"徐世烺\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Xu Shilang\"}]",
				"issue": "4",
				"language": "zh-CN",
				"libraryCatalog": "Samson",
				"pages": "807-815",
				"publicationTitle": "东南大学学报（自然科学版）",
				"url": "http://journal.seu.edu.cn/#/digest?ArticleID=7583",
				"volume": "54",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "动态压缩力学性能"
					},
					{
						"tag": "本构模型"
					},
					{
						"tag": "海水干湿循环"
					},
					{
						"tag": "超高韧性水泥基复合材料"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://trqgy.paperonce.org/#/digest?ArticleID=11116",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "不同构造单元页岩孔隙结构差异及其油气地质意义——以四川盆地泸州地区深层页岩为例",
				"creators": [
					{
						"firstName": "",
						"lastName": "唐洪明",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘贤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈洋",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "于魏铭",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "赵宁",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "石学文",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王猛",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "廖纪佳",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-05-25",
				"DOI": "10.3787/j.issn.1000-0976.2024.05.002",
				"abstractNote": "不同构造单元页岩储层品质、含气性差异明显，构造改造作用对页岩气勘探开发具有控制作用，但关于深层页岩气的构造控制作用机理研究较少，相关认识尚不明确，制约了深层页岩气的勘探开发。为此，通过“岩心—薄片—扫描电镜”多尺度观察、全岩矿物X射线衍射分析、核磁共振等技术手段，对比分析了四川盆地南部泸州地区不同构造单元上奥陶统五峰组—下志留统龙马溪组深层页岩孔隙结构和储层特征的差异，探讨了不同构造单元页岩孔隙结构差异与储层品质的耦合关系，明确了页岩气产量差异的内在地质原因，落实了构造改造作用下的页岩气勘探开发有利区。研究结果表明：①向斜区页岩主要以有机质孔隙、非构造裂缝为主，孔径大；背斜区页岩孔隙结构被强烈改造，以矿物粒间孔、构造裂缝为主，矿物粒间孔狭长且定向排列，孔径小。②向斜区构造相对稳定，有机质孔隙、矿物粒间孔以及成岩裂缝保存较好，宏孔占比高，储集性能好，含气量和产量高；背斜区页岩储层发育大量构造裂缝与断层，孔隙和成岩裂缝被压实，孔径减小，储集性能变差，含气量和产量低。③距盆缘剥蚀区越远，构造越稳定的单元，保存条件越好，该类构造单元页岩储层越发育，含气量和产量越高，页岩气勘探开发潜力越大。结论认为，构造运动对于压力系统的影响是形成不同构造单元深层页岩孔隙结构特征差异的重要因素，并控制了页岩储层的含气性与产量；向斜区深层保存条件好，远离剥蚀区，为勘探开发的最有利区，该认识可为深层页岩气勘探开发提供技术支撑。",
				"extra": "original-title: Pore structure difference of shale in different structural units and its petroleum geological implications: A case study on deep shale in the Luzhou area, southern Sichuan Basin\noriginal-container-title: Natural Gas Industry\nview: 2036\ndownload: 390\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"刘贤\",\"creatorType\":\"author\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"陈洋\",\"creatorType\":\"author\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"于魏铭\",\"creatorType\":\"author\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"赵宁\",\"creatorType\":\"author\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"石学文\",\"creatorType\":\"author\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"王猛\",\"creatorType\":\"author\",\"fieldMode\":1},{\"firstName\":\"\",\"lastName\":\"廖纪佳\",\"creatorType\":\"author\",\"fieldMode\":1}]",
				"issue": "5",
				"language": "zh-CN",
				"libraryCatalog": "Samson",
				"pages": "16-28",
				"publicationTitle": "天然气工业",
				"url": "https://trqgy.paperonce.org/#/digest?ArticleID=11116",
				"volume": "44",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "上奥陶统五峰组—下志留统龙马溪组"
					},
					{
						"tag": "含气性"
					},
					{
						"tag": "四川盆地"
					},
					{
						"tag": "孔隙结构"
					},
					{
						"tag": "构造作用"
					},
					{
						"tag": "构造单元"
					},
					{
						"tag": "泸州地区"
					},
					{
						"tag": "深层页岩"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://pub.gthjjs.com//#/digest?ArticleID=2582",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "HAN基电控固体推进剂电化学性能对燃烧性能的影响",
				"creators": [
					{
						"firstName": "",
						"lastName": "郭昊琪",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨玉林",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-06-25",
				"DOI": "10.7673/j.issn.1006-2793.2024.03.006",
				"abstractNote": "硝酸羟胺(HAN)基电控固体推进剂是一种以HAN为主要氧化剂的新型智能推进剂,通过外加电源控制其燃烧速率与启停。为探索电化学性能与燃烧性能间的关系,在研究推进剂的离子迁移率、过电位的变化规律的基础上,将其与推进剂的点火电压、点火延迟进行关联。研究发现,推进剂在外加低电压(1.6～2.8 V)刺激下,离子迁移率与电压大小正相关,推进剂基体的改良在提高离子迁移率方面的效果大于离子掺杂。在燃烧性能方面,离子迁移率影响点火电压,过电位决定点火延迟; 离子迁移率越高,点火时,推进剂的电流密度与反应活性越高; 当迁移率由0.09 mm<sup>2</sup>·s<sup>-1</sup>·V<sup>-1</sup>升高至0.16 mm<sup>2</sup>·s<sup>-1</sup>·V<sup>-1</sup>时,点火电压由210 V降至70 V,有利于拓宽电控固体推进剂的应用范围; 点火电压一定时,推进剂过电位越小,电分解速率越大,点火延迟越小,当过电位由0.67 V降至0.51 V时,点火延迟由1.68 s降至0.31 s,有利于推进剂满足快速响应的战略需求。",
				"extra": "original-title: Effect of electrochemical properties of HAN-based electronically controlled solid propellants on its combustion performance\noriginal-container-title: Journal of Solid Rocket Technology\nview: 117\ndownload: 95\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"杨玉林\",\"creatorType\":\"author\",\"fieldMode\":1}]",
				"issue": "3",
				"language": "zh-CN",
				"libraryCatalog": "Samson",
				"pages": "341-347",
				"publicationTitle": "固体火箭技术",
				"url": "http://pub.gthjjs.com//#/digest?ArticleID=2582",
				"volume": "47",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "电控固体推进剂"
					},
					{
						"tag": "电控燃烧"
					},
					{
						"tag": "硝酸羟胺"
					},
					{
						"tag": "离子迁移率"
					},
					{
						"tag": "过电位"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://journal.szu.edu.cn/#/",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://ydsjjs.paperopen.com/#/",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.zgylxtb.cn/#/",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://cpnj.smmu.edu.cn/oa/darticle.aspx?type=view&id=202312012",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "老年脑卒中患者跌倒恐惧干预方案的构建",
				"creators": [
					{
						"firstName": "",
						"lastName": "陈园园",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "徐月",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "皮红英",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-12-15",
				"DOI": "10.3969/j.issn.2097-1826.2023.12.012",
				"ISSN": "2097-1826",
				"abstractNote": "目的 构建老年脑卒中患者跌倒恐惧(fear of falling,FoF)干预方案,以降低老年脑卒中患者FoF程度,提高患者活动水平。方法 系统检索国内外文献,以理论域的行为改变技术为指导,构建老年脑卒中患者FoF干预方案初稿。通过德尔菲法进行2轮专家函询,征询专家意见并修订,形成方案终稿。结果 经过2轮函询后15名专家意见趋于一致,专家权威系数为0.923,肯德尔和谐系数为0.204(P<0.001),条目变异系数为0.000～0.198,最终形成的干预方案涉及到7个理论领域,分为基础内容和巩固提升2个阶段。结论 构建的老年脑卒中患者FoF干预方案具有科学性,能为降低老年脑卒中患者FoF提供指导。",
				"extra": "original-title: Construction of An Intervention Program for the Fear of Falling in Elderly Stroke Patients\noriginal-container-title: Nursing Journal Of Chinese People's Laberation Army\noriginal-author: Xu Yue\noriginal-author: Pi Hongying\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"徐月\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Xu Yue\"},{\"firstName\":\"\",\"lastName\":\"皮红英\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Pi Hongying\"}]",
				"issue": "12",
				"language": "zh_CN",
				"libraryCatalog": "Samson",
				"pages": "46-49",
				"publicationTitle": "军事护理",
				"url": "http://cpnj.smmu.edu.cn/oa/darticle.aspx?type=view&id=202312012",
				"volume": "40",
				"attachments": [],
				"tags": [
					{
						"tag": " 脑卒中"
					},
					{
						"tag": " 行为改变"
					},
					{
						"tag": " 跌倒恐惧"
					},
					{
						"tag": "老年"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://cjir.paperonce.org//oa/darticle.aspx?type=view&id=202409000014",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "复杂脾动脉瘤腔内介入治疗方法及疗效分析",
				"creators": [
					{
						"firstName": "",
						"lastName": "张鑫",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "胡红耀",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-09-17",
				"ISSN": "1008-794X",
				"abstractNote": "【摘要】目的探讨复杂脾动脉瘤（complicated splenic artery aneurysms，CSAA）的腔内介入治疗方法及临床疗效。方法收集2013年1月至2022年12月本中心收治的15例CSAA患者的临床资料，其表现为破裂出血（n=2）、脾动脉瘤起源于正常脾动脉近端（n=3）、脾动脉瘤起源于肠系膜上动脉-脾动脉共干（n=4）、脾动脉瘤起源于腹腔干-肠系膜上动脉共干（n=6）。根据脾动脉瘤起源及瘤腔大小不同，腔内介入治疗包括：①单纯瘤腔内弹簧圈栓塞；②流出道、瘤腔及流入道联合栓塞；③覆膜支架置入腔内隔绝；④裸支架辅助联合弹簧圈栓塞等技术及多种方法联合治疗，并分析腔内介入治疗后中远期疗效。结果15例CSAA患者共计15枚瘤体，瘤体直径1.8～3.2 cm（2.5±0.4 cm），腔内治疗手术成功率100%，随访时间（22.8±10.2）个月，13例患者（86.7%）术后脾动脉瘤血栓形成且瘤腔无增大，1例患者因瘤腔持续增大再次行腔内介入治疗，1例患者术后未规律服药导致覆膜支架闭塞，随访期间并未出现肝脏及小肠缺血坏死，5例患者出现无症状局灶性脾梗死。结论对于不同解剖变异起源的脾动脉瘤，腔内介入治疗是可行、安全有效的治疗方法。",
				"extra": "original-title: Endovascular interventional treatment for complicated splenic aneurysms and analysis of its curative efficacy\noriginal-container-title: journal interventional radiology\noriginal-author: Hu Hongyao\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"胡红耀\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Hu Hongyao\"}]",
				"issue": "9",
				"language": "zh_CN",
				"libraryCatalog": "Samson",
				"pages": "1000-1005",
				"publicationTitle": "介入放射学杂志",
				"url": "http://cjir.paperonce.org//oa/darticle.aspx?type=view&id=202409000014",
				"volume": "33",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "【关键词】脾动脉瘤"
					},
					{
						"tag": "变异脾动脉"
					},
					{
						"tag": "破裂"
					},
					{
						"tag": "腔内介入"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.mat-china.com/#",
		"items": "multiple"
	}
]
/** END TEST CASES **/
