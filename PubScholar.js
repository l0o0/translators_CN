{
	"translatorID": "58df4473-a324-4fb5-8a8f-25d1e1897c73",
	"label": "PubScholar",
	"creator": "l0o0",
	"target": "https?://pubscholar\\.cn/",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-11-04 12:16:01"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 l0o0

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

const URLTypes = {
	patents: 'patent',
	articles: 'journalArticle',
	literatures: 'journalArticle',
	books: 'book'
};

function getTypeFromUrl(url) {
	for (const key in URLTypes) {
		if (url.includes(key)) return URLTypes[key];
	}
	return false;
}

const TagTypes = {
	论文: 'journalArticle',
	专利: 'patent',
	图书: 'book'
};

function getTypeFromTab(doc) {
	let key = text(doc, '.AppSearchTab.is-active');
	return Object.keys(TagTypes).includes(key) ? TagTypes[key] : false;
}

const FieldMap = {
	title: 'span[class$="__titleText"]',
	author: 'div.AuthorInfo__content',
	abstractNote: 'div[class$="__abstracts"], div.FullAbstracts',
	tags: 'div[class$="__keywords"] span.Keyword',
};

function parseAuthors(s) {
	let type = 'author';
	let sclean = s.replace(/等?\s?主?编?著?$|等?主译$|^发明人: /g, "");
	sclean = sclean.replace(/\(.*\)/);
	if (s.match(/等主译$/)) type = 'translator';
	if (s.match(/主编$/)) type = 'editor';
	if (s.match(/^发明人: /)) type = 'inventor';
	return sclean.split(/[,，]/).map(c => ({ lastName: c.replace(/\s?\d+\s?$/, ''), creatorType: type }));
}

function parseAuthorStr(s) {
	let creators = [];
	const parts = s.split(/[；;]/);
	parts.forEach((p) => {
		let pc = parseAuthors(p.trim());
		creators = creators.concat(pc);
	});
	return creators;
}

function parseTags(nodeList) {
	return nodeList.map((n) => {
		return { tag: n.textContent.trim() };
	});
}

function detectWeb(doc, url) {
	var type = getTypeFromUrl(url);
	// Z.debug(id);
	if (type) {
		return type;
	}

	else if (getTypeFromTab(doc) && getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll("div.List div.List__item");
	// 最后一个预加载的元素缺少必要信息
	for (let i = 0; i < rows.length - 1; i++) {
		let title = ZU.trimInternal(rows[i].querySelector(".ContentItem__titleText").innerText);
		if (!title) continue;
		if (checkOnly) return true;
		found = true;
		items[i] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let index of Object.keys(items)) {
			var itemElement = doc.querySelectorAll('div.List div.List__item')[index];
			await scrape(itemElement, getTypeFromTab(doc));
		}
	}
	else {
		await scrape(doc, getTypeFromUrl(url), url);
	}
}

function tryMAtch(string, regx, index) {
	try {
		return string.match(regx)[index];
	}
	catch (error) {
		return '';
	}
}

function trySelectNext(node, selector, string) {
	try {
		return Array.from(node.querySelectorAll(selector)).find(
			element => element.innerText == string
		).nextElementSibling.textContent;
	}
	catch (error) {
		return '';
	}
}

async function scrape(doc, type, url = '') {
	var citationText = text(doc, '.QuoteList > .QuoteListItem:nth-child(1) > .QuoteListItem__content').split('.').reverse()[1];
	// Z.debug(citationText);
	var newItem = new Zotero.Item(type);
	// 展开摘要
	var button = {};
	button = doc.querySelector('div.RichContent__inner > button');
	if (button && button.innerText.includes('阅读全部')) await button.click();
	// 展开作者
	button = doc.querySelector('AuthorInfo__extra');
	if (button && button.innerText.includes("···")) await button.click();
	for (let field in FieldMap) {
		if (field == 'author') {
			newItem.creators = parseAuthorStr(text(doc, FieldMap[field]));
		}
		else if (field == 'tags') {
			let tmp = doc.querySelectorAll(FieldMap[field]);
			newItem.tags = parseTags(Array.from(tmp));
		}
		else {
			newItem[field] = text(doc, FieldMap[field]);
		}
	}
	if (newItem.itemType == 'journalArticle') {
		newItem.date = tryMAtch(citationText, /\d{4}/, 0);
		newItem.pages = tryMAtch(citationText, /:?([\d- ]*)$/, 1).replace(/\s/g, '');
		newItem.publicationTitle = tryMAtch(citationText, /^(.*?),/, 1);
		newItem.volume = tryMAtch(citationText, /\d{4},(\d*)\(/, 1);
		newItem.issue = tryMAtch(citationText, /\((\d*)\)/, 1);
	}
	else if (newItem.itemType == 'patent') {
		newItem.filingDate = trySelectNext(doc, 'span[class$="__label"]', '申请日:');
		newItem.applicationNumber = trySelectNext(doc, 'span[class$="__label"]', '申请号:');
		newItem.issueDate = trySelectNext(doc, 'span[class$="__label"]', '公开日:');
		newItem.rights = text(doc, '.FullTextContent', 1);
	}
	else if (newItem.itemType == 'book') {
		newItem.title = text(doc, 'h1[class$="__title"]');
		newItem.date = citationText;
		newItem.publisher = '科学出版社';
		newItem.ISBN = trySelectNext(doc, 'span[class$="__label"]', 'ISBN:');
		newItem.subject = trySelectNext(doc, 'span[class$="__label"]', '学科分类:');
	}
	// fix item
	if (newItem.abstractNote) newItem.abstractNote = newItem.abstractNote.replace(/收起\s?$/, '').trim();
	if (url) newItem.url = url;
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://pubscholar.cn/books/e4a5804428c6b5e93293f8c4ddd63a66d58a750f1abb13c6bfaacec097f5c64322091ecd0d4ce09303f0e1625267ddad",
		"items": [
			{
				"itemType": "book",
				"title": "人类基因组编辑：科学、伦理和监管（中文翻译版）",
				"creators": [
					{
						"lastName": "美国国家科学院",
						"creatorType": "editor"
					},
					{
						"lastName": "马慧",
						"creatorType": "translator"
					}
				],
				"date": "2019-01",
				"ISBN": "9787030600479",
				"abstractNote": "基因组编辑，尤其是CRISPRCas9基因组编辑系统被Science评为2015年度十大科学突破，在全球范围内引起了极大关注。该技术的迅猛发展为改善人类健康提供了更加有效的新策略。但是，基因编辑技术的进步也伴随着潜在的问题，如在治愈疾病甚至预防自身及后代疾病的同时如何减少与健康需求无关的基因或性状的改变。基因编辑技术已应用于人体细胞编辑研究，其生物医学突破与技术及伦理风险并存。生物医学和伦理方面的深入研究和风险监管旨在促进基因编辑技术，认真审查该技术引发的科学、伦理和社会问题，并评估有关部门在确保其健康有序发展及应用方面的监管能力。",
				"libraryCatalog": "PubScholar",
				"publisher": "科学出版社",
				"url": "https://pubscholar.cn/books/e4a5804428c6b5e93293f8c4ddd63a66d58a750f1abb13c6bfaacec097f5c64322091ecd0d4ce09303f0e1625267ddad",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://pubscholar.cn/articles/3c9b1ffd2848ebedb60f220461178c361bbe3e43934eaea9546e3fbac10ced2f0ad59b1f00a83155bd2a31da806d3178",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "基因编辑技术在油菜中的应用",
				"creators": [
					{
						"lastName": "杨文文",
						"creatorType": "author"
					},
					{
						"lastName": "聂甲玥",
						"creatorType": "author"
					},
					{
						"lastName": "樊红霞",
						"creatorType": "author"
					},
					{
						"lastName": "吴德伟",
						"creatorType": "author"
					},
					{
						"lastName": "王幼平",
						"creatorType": "author"
					}
				],
				"date": "2023",
				"abstractNote": "油菜作为世界主要油料作物之一，在农业生产中占有重要地位。长期以来，油菜育种家致力于利用杂交、人工诱变、细胞工程等多种技术，培育优良油菜品种，提质增效。近年来，以CRISPR为代表的基因编辑技术突飞猛进，为油菜育种提供了新的方法和思路，并已被成功用于改变油菜的菜籽产量、油脂品质、抗病性、开花时间、花色、除草剂抗性等性状，展现了巨大的应用潜力。本研究对基因编辑技术在油菜中的应用实例进行了全面总结，并对尚待解决的一些技术问题和未来可能的发展方向进行了探讨，为相关学者提供参考。",
				"issue": "7",
				"libraryCatalog": "PubScholar",
				"pages": "2253-2261",
				"publicationTitle": "分子植物育种",
				"url": "https://pubscholar.cn/articles/3c9b1ffd2848ebedb60f220461178c361bbe3e43934eaea9546e3fbac10ced2f0ad59b1f00a83155bd2a31da806d3178",
				"volume": "21",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://pubscholar.cn/patents/d1067ea442b3b43a3a301abc252eb139a0fbe21d5ec4e8bb250fde14e9c6a173880526c9b4434ff87754e650b78fecac/0",
		"items": [
			{
				"itemType": "patent",
				"title": "基因编辑构建体及其应用",
				"creators": [
					{
						"lastName": "梁德生 ",
						"creatorType": "inventor"
					},
					{
						"lastName": "胡志青 ",
						"creatorType": "inventor"
					},
					{
						"lastName": "唐齐玉 ",
						"creatorType": "inventor"
					},
					{
						"lastName": "邬玲仟",
						"creatorType": "inventor"
					}
				],
				"issueDate": "2023-08-22",
				"abstractNote": "本公开提供一种基因编辑构建体及其应用，所述基因编辑构建体用于将外源基因定点整合入基因组的核糖体DNA(rDNA)区，并能高效地表达其携带的外源基因。",
				"applicationNumber": "CN202310645338.1",
				"filingDate": "2023-06-01",
				"rights": "1.一种基因编辑构建体，所述构建体包括包含上游同源臂、下游同源臂以及上游同源臂和下游同源臂之间多克隆位点的构建体骨架；所述上游同源臂的核苷酸序列如SEQ ID NO:2所示或与SEQ ID NO:2具有至少70％、至少80％、至少90％、至少95％或至少98％的序列同一性，所述下游同源臂的核苷酸序列如SEQ ID NO:4所示或与SEQ ID NO:4具有至少70％、至少80％、至少90％、至少95％或至少98％的序列同一性；和所述构建体骨架为非病毒骨架。2.根据权利要求1所述的构建体，其中所述上游同源臂的核苷酸序列如SEQ ID NO:2所示和所述下游同源臂的核苷酸序列如SEQ ID NO:4所示。3.根据权利要求1或2所述的构建体，其包含如SEQ ID NO:27所示的核苷酸序列。4.根据权利要求1至3任一所述的构建体，所述构建体进一步包含外源基因，所述外源基因位于所述多克隆位点，所述外源基因编码治疗性肽、DNA结合蛋白、RNA结合蛋白、荧光蛋白或酶。5.根据权利要求4所述的构建体，其中所述治疗性肽选自人白细胞介素家族成员(例如，IL-2、IL-7、IL-10、IL-11、IL-12、IL-15、IL-23和IL-24)、肿瘤坏死因子家族成员(例如，TNF、LTA、LTB、FASLG、TNFSF8、TNFSF9、TNFSF10、TNFSF11、TNFSF12、TNFSF13、TNFSF14、TNFSF15、TNFSF18和EDA)、干扰素(INF-α、INF-β和INF-γ)、CAR、F8、F9、TNFR和TRAIL。6.根据权利要求1至5任一所述的构建体，所述构建体进一步包含启动子，所述启动子位于所述多克隆位点，优选地，所述启动子为CMV启动子或EF1α启动子。7.一种基因编辑方法，包括将权利要求1至6任一所述的构建体导入细胞，通过基因编辑系统将外源基因定点整合入所述细胞的基因组中。8.根据权利要求7所述的方法，其中所述基因编辑系统选自Cre-lox系统、Zinc FingerNucleases(ZFNs)、CRISPR-Cas9或Transcription Activator-Like Effector Nucleases(TALENs)，优选为TALENs，更优选为采用人工核酸酶TALENickases进行基因编辑。9.根据权利要求7或8所述的方法，其中所述定点整合位点位于基因组的核糖体RNA转录区(rDNA区)18S rRNA转录区的5468位点。10.根据权利要求7至9任一所述的方法，其中所述细胞选自间充质干细胞、T细胞、B细胞、NK细胞、巨噬细胞或诱导性多能干细胞及其衍生细胞。11.根据权利要求10所述的方法，其中所述诱导性多能干细胞的衍生细胞为由所述诱导性多能干细胞分化而来的间充质干细胞、T细胞、B细胞、NK细胞、巨噬细胞、造血细胞、内皮细胞、肝细胞、心肌细胞、神经元细胞或胰岛细胞。12.根据权利要求7至11任一所述的方法，其中所述外源基因选自CAR基因、白细胞介素-15、白细胞介素-24、F8、F9、TNFR和TRAIL。13.一种细胞，其由权利要求7至12任一所述的方法编辑后获得。14.一种药物组合物，其包含根据权利要求1至6任一所述的构建体或权利要求13所述的细胞和药学上可接受的辅料。15.根据权利要求1至6任一所述的构建体或权利要求13所述的细胞在制备治疗肿瘤的药物中的用途。",
				"url": "https://pubscholar.cn/patents/d1067ea442b3b43a3a301abc252eb139a0fbe21d5ec4e8bb250fde14e9c6a173880526c9b4434ff87754e650b78fecac/0",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://pubscholar.cn/explore",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://pubscholar.cn/literatures/8bd0891c723144d4a2a2171aff6da1346ccc6261415f13a2834b4779486970385e61e49e5da6bae88d139b636cab7e48",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Polarized thermal emission from dust in a galaxy at redshift 2.6",
				"creators": [
					{
						"lastName": "J. E. Geach undefined",
						"creatorType": "author"
					},
					{
						"lastName": " E. Lopez-Rodriguez",
						"creatorType": "author"
					},
					{
						"lastName": " M. J. Doherty",
						"creatorType": "author"
					},
					{
						"lastName": " Jianhang Chen",
						"creatorType": "author"
					},
					{
						"lastName": " R. J. Ivison",
						"creatorType": "author"
					},
					{
						"lastName": " G. J. Bendo",
						"creatorType": "author"
					},
					{
						"lastName": " S. Dye & K. E. K. Coppin .",
						"creatorType": "author"
					}
				],
				"abstractNote": "Magnetic fields are fundamental to the evolution of galaxies, playing a key role in the astrophysics of the interstellar medium and star formation. Large-scale ordered magnetic fields have been mapped in the Milky Way and nearby galaxies, but it is not known how early in the Universe such structures formed. Here we report the detection of linearly polarized thermal emission from dust grains in a strongly lensed, intrinsically luminous galaxy that is forming stars at a rate more than 1,000 times that of the Milky Way at redshift 2.6, within 2.5 Gyr of the Big Bang. The polarized emission arises from the alignment of dust grains with the local magnetic field. The median polarization fraction is of the order of 1%, similar to nearby spiral galaxies8. Our observations support the presence of a 5-kiloparsec-scale ordered magnetic field with a strength of around 500 μG or lower, oriented parallel to the molecular gas disk. This confirms that such structures can be rapidly formed in galaxies, early in cosmic history. Fig. 1: The magnetic field orientation of the gravitationally lensed galaxy 9io9 at z = 2.553. a–d, ALMA 242 GHz polarimetric observations of the Stokes I, Q and U parameters, and the polarized intensity (PI). The synthetic beam of the observations (1.2″ × 0.9″, θ = 68°) is shown as the red ellipse, lower left. The B field orientation is indicated by white lines shown at the Nyquist sampling, with line lengths proportional to the polarization fraction. e–h, Synthetic polarimetric observations using a constant B field configuration in the source plane. Contours indicate signal to noise: for Stokes I, the contours increase as σI × 23,4,5,…. For Stokes Q and U and for PI, the contours start at 3σ and increase in steps of 1σ. Dec., declination; RA, right ascension.  Fig. 2: Source plane configuration of the magnetic field and lensing model.a, Source plane intensity and field orientation. b, Lensed source plane image. c, Synthetic observations with the synthetic beam size (1.2″ × 0.9″, θ = 68°) indicated by the red ellipse. The B field orientation is indicated by white lines with lengths proportional to the polarization fraction. The median and root mean squared values of the polarization fraction and B field orientation are indicated in the images. The caustics in the source plane and image plane are shown as green and yellow lines, respectively.",
				"libraryCatalog": "PubScholar",
				"pages": "483-486",
				"publicationTitle": "Nature",
				"url": "https://pubscholar.cn/literatures/8bd0891c723144d4a2a2171aff6da1346ccc6261415f13a2834b4779486970385e61e49e5da6bae88d139b636cab7e48",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
