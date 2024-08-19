{
	"translatorID": "28d5d2c7-de04-4661-8c04-978c6b8ed5a9",
	"label": "RDFYBK",
	"creator": "jiaojiaodubai",
	"target": "^https?://.*\\.rdfybk(\\.com)?",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-02-28 14:05:55"
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
	// 期刊全文数据库
	if (/qw\/detail\?id=/i.test(url)) {
		return 'journalArticle';
	}
	// else if (/bk\/detail\?id=/i.test(url)) {
	// 	return 'newspaperArticle';
	// }
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('a[href*="qw/detail?id="]');
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
			await scrapeAPI(url);
		}
	}
	else {
		await scrapeDoc(doc, url);
	}
}

async function scrapeDoc(doc, url = doc.location.href) {
	Z.debug(url);
	let labels = new Labels(doc, '.desc > div, .desc > span, #content >p');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	let extra = new Extra();
	let newItem = new Z.Item('journalArticle');
	let title = text(doc, '#artTitles');
	let subTitle = text(doc, '.subT');
	if (subTitle) {
		newItem.shortTitle = title;
		title += subTitle;
	}
	newItem.title = title;
	extra.set('original-title', text(doc, '#subTitleNote'), true);
	newItem.abstractNote = text(doc, '#astInfo > span');
	let pubInfo = labels.get('原文出处');
	newItem.publicationTitle = tryMatch(pubInfo, /《(.+?)》/, 1);
	newItem.volume = tryMatch(pubInfo, /0*(\d+)卷/, 1);
	newItem.issue = tryMatch(pubInfo, /([A-Z]?\d+)期/i, 1).replace(/0*(\d)/, '$1');
	newItem.pages = tryMatch(pubInfo, /第([\d,\s+~-]+?)页/, 1).replace(/\+/g, ', ').replace(/~/g, '-');
	newItem.date = tryMatch(pubInfo, /(\d{4})年/, 1);
	extra.set('place', tryMatch(pubInfo, /》\((.+?)\)/, 1), true);
	extra.set('remark', labels.get('标题注释'));
	newItem.libraryCatalog = '人大复印报刊资料';
	newItem.url = tryMatch(url, /^.+id=\d+/);
	newItem.rights = '中国人民大学书报资料中心';
	let creators = Array.from(doc.querySelectorAll('#autInfo > a')).map(element => processName(ZU.trimInternal(element.textContent)));
	if (creators.some(creator => creator.country)) {
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	creators.forEach(creator => delete creator.country);
	newItem.creators = creators;
	let pdfLink = doc.querySelector('a[href*="DownPdf"]');
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	doc.querySelectorAll('#artKeyword a').forEach(element => newItem.tags.push(ZU.trimInternal(element.textContent)));
	newItem.extra = extra.toString();
	newItem.complete();
}

async function scrapeAPI(url) {
	let xmlText = await requestText(`https://www.rdfybk.com/Qw/GetBaseArt?${tryMatch(url, /id=[^#&/]+/)}`);
	Z.debug(xmlText);

	/* 不能用requestDocument，因为它会以HTML的方式去解析XML，从而无法很好地处理某些自闭合标签 */
	let parser = new DOMParser();
	let xml = parser.parseFromString(xmlText, 'application/xml');
	let newItem = new Z.Item('journalArticle');
	let extra = new Extra();
	newItem.title = text(xml, 'til');
	extra.set('original-title', text(xml, 'etil'), true);
	newItem.abstractNote = text(xml, 'ast');
	newItem.publicationTitle = text(xml, 'taut > opc');
	newItem.issue = text(xml, 'taut > opn').substring(4).replace(/([A-Z])?0*(\d+)/i, '$1$2');
	newItem.pages = text(xml, 'taut > opg').replace(/\+/g, ', ').replace(/~/g, '-');
	newItem.date = text(xml, 'taut > opy');
	extra.set('place', text(xml, 'taut > oad'), true);
	extra.set('remark', text(xml, 'tno'));
	newItem.libraryCatalog = '人大复印报刊资料';
	newItem.url = tryMatch(url, /^.+id=\d+/);
	newItem.rights = '中国人民大学书报资料中心';
	let creators = text(xml, 'aut').split('#').map(creator => processName(creator));
	if (creators.some(creator => creator.country)) {
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	creators.forEach(creator => delete creator.country);
	newItem.creators = creators;
	newItem.attachments.push({
		url: new URL(url).origin + `/qw/DownPdf?${tryMatch(url, /id=[^#&/]+/)}`,
		title: 'Full Text PDF',
		mimeType: 'application/pdf'
	});
	newItem.tags = text(xml, 'kew').split('#');
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

function processName(creator, creatorType = 'author') {
	let country = tryMatch(creator, /^\(.+?\)/);
	creator = creator.replace(/^\(.+?\)/, '');
	creator = ZU.cleanAuthor(creator, creatorType);
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	creator.country = country;
	return creator;
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	if (match && match[index]) {
		return match[index];
	}
	return '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.rdfybk.com/qw/detail?id=834083&kw=",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "关系性评价和新时代教育转型",
				"creators": [
					{
						"firstName": "",
						"lastName": "肯尼斯·格根",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "谢尔托·吉尔",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "对公共教育能否使年轻人充分准备好应对未来世界复杂需求的质疑已经浮现。正如这类质疑所表明的，传统教育结构——类似工业化生产——并不符合这些需求。维系这种生产模式的关键乃是评估方式，通常都是以对学生表现进行测试和评分的形式。因此，亟需一种更具前景的模式替代当下的生产模式，并对传统评估方法进行相应变革。为应对所面临的挑战，文章提出了“基于关系”的教育过程观，以及以关系性过程为中心的评价概念，继而重点关注一系列体现对话、欣赏等实质的相关评价方式。这些评价方式不仅适用于学生评价，也适用于教师评价和学校评价。与此同时，倡导在课程教学中突出对关系性行为的倚重。总之，关系性评价是教育转型的关键所在，而教育转型也有利于发展不断扩大的学习社区，以及有关自身利益的关系性福祉评价。",
				"extra": "original-title: Relational Evaluation and Educational Transformation in the New Era\nremark: 本文系格根教授与吉尔教授专程为教育部哲学社会科学研究重大课题攻关项目“教育高质量发展评价指标体系研究”(20JZD053)撰写的论文，文章系统阐释了关系性评价的意涵及其时代价值，从教育评价视域多向度探讨了推进教育高质量发展和教育转型的世界举措和经验。感谢蔡茹、钟振国等在翻译过程中提供的帮助。\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"肯尼斯·格根\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"(美)\"},{\"firstName\":\"\",\"lastName\":\"谢尔托·吉尔\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"(英)\"}]",
				"issue": "4",
				"libraryCatalog": "人大复印报刊资料",
				"pages": "38-51",
				"publicationTitle": "南京师大学报：社会科学版",
				"rights": "中国人民大学书报资料中心",
				"url": "https://www.rdfybk.com/qw/detail?id=834083",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "educational transformation"
					},
					{
						"tag": "relational evaluation"
					},
					{
						"tag": "the New Era"
					},
					{
						"tag": "关系性评价"
					},
					{
						"tag": "教育转型"
					},
					{
						"tag": "新时代"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.rdfybk.com/qw/detail?id=834265&kw=",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "竞争的强制规律——资本内在趋势的实现及其物化批判",
				"creators": [
					{
						"firstName": "",
						"lastName": "户晓坤",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "将竞争混同于社会内卷化的一般观念遮蔽了竞争规律的社会历史规定。竞争作为由偶然性支配的人本身的交往条件，构成了资本内在趋势的外在必然性与实现方式，并构造出通过竞争实现个体自由的现代性意识形态幻想。马克思将竞争范畴界定为“许多资本”的现实运动，在一般利润率的外部性指标强制下，劳动的社会联系颠倒地表现为按照私有财产的一定比例分割剩余价值的社会权力，利润的平均化过程使剩余价值取得了与自身源泉及内在本质相对立的物化形态。竞争的自由表象无非意味着，以个人自由为基础的社会生产不过是资本统治的自由发展。就此而言，克服社会内卷化困境的现实出路正在于，以自由劳动的社会联合与生产资料的共同占有取代资本主义私人占有制。",
				"extra": "original-title: The Compulsory Rules of Competition:The Realization of the Intrinsic Tendency and Its Materialization Critique\nplace: 沪\nremark: 国家社科基金重大项目“中国式现代化新道路与人类文明新形态研究”(21&ZD012)。",
				"issue": "7",
				"libraryCatalog": "人大复印报刊资料",
				"pages": "167-176",
				"publicationTitle": "探索与争鸣",
				"rights": "中国人民大学书报资料中心",
				"shortTitle": "竞争的强制规律",
				"url": "https://www.rdfybk.com/qw/detail?id=834265",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "物化"
					},
					{
						"tag": "竞争强制"
					},
					{
						"tag": "许多资本"
					},
					{
						"tag": "资本主义再生产"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.rdfybk.com/qk/detail?DH=B4",
		"items": "multiple"
	}
]

/** END TEST CASES **/
