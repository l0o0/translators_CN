{
	"translatorID": "58df4473-a324-4fb5-8a8f-25d1e1897c73",
	"label": "PubScholar",
	"creator": "l0o0",
	"target": "https?://pubscholar.cn/",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-11-03 09:13:36"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 YOUR_NAME <- TODO

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

const ItemTypes = {
	patents: "patent",
	articles: "journalArticle",
	books: "book"
}

const FieldMatch = {
	author: "//span[@class='AuthorInfo__nameText'] | //div[@class='AuthorInfo__content']",  // 书籍|期刊，过滤等主译，主编，过滤数字
	date: "//span[text()='出版日期:' and @class='ArticleInfo__label']/following-sibling::span[1]",
	publisher: "//span[text()='出版社:' and @class='ArticleInfo__label']/following-sibling::span[1]",  // book
	publicationTitle: "//span[@class='ArticleInfo__metaSource']", // 期刊
	ISBN: "//span[text()='ISBN:' and @class='ArticleInfo__label']/following-sibling::span[1]",
	"学科分类": "//span[text()='学科分类:' and @class='ArticleInfo__label']/following-sibling::span[1]",
	abstractNote: "//div[contains(@class, 'FullAbstracts')] | //div[@class='ArticleInfo__abstracts']",  // 注意摘要过长会收起
	影响因子: "//div[@class='JournalContent__meta']",
	tags: "//div[@class='ArticleInfo__keywords']/span[@class='ArticleInfo__keyword']",
	metadata: "//div[@class='ArticleInfo__source']/span[@class='ArticleInfo__sourceTitle']/span[contains(text(), '年') or contains(text(), '期') or contains(text(), '卷')]",

}

function parseAuthors(s) {
	let type = 'author';
	let sclean = s.replace(/主编$|等主译$|^发明人: /g, "");
	if (s.match(/等主译$/)) type = 'translator';
	if (s.match(/主编$/)) type = 'editor';
	if (s.match(/^发明人: /)) type = 'inventor';
	return sclean.split(/[,，]/).map( (c) => {return {lastName: c.replace(/\s?\d+\s?$/, ''), creatorType: type}});
}

function parseAuthorStr(s) {
	let creators = [];
	const parts = s.split(/[；;]/);
	parts.forEach( (p) => {
		let pc = parseAuthors(p.trim());
		creators = creators.concat(pc);
	});
	return creators;
}

function parseMetadata(metadata, newItem) {
	let meta = {};
	const ymatch = metadata.match(/(\d{4}) 年/);
	const imatch = metadata.match(/第 (\d+) 期/);
	const pmatch = metadata.match(/共 (\d+) 页/);
	const vmatch = metadata.match(/第 (\d+) 卷/);
	if (!ymatch && !imatch && !pmatch && !vmatch) return newItem;
	if (ymatch) newItem.date = ymatch[1];
	if (imatch) newItem.issue = imatch[1];
	if (pmatch) newItem.pages = pmatch[1];
	if (vmatch) newItem.volume = vmatch[1];
	return newItem;
}

function parseTags(nodeList) {
	return nodeList.map( (n) => {
		return {tag: n.textContent.trim()}
	})
}

function getIDFromUrl(url) {
	const mre = url.match(/\/(books|articles|patents)\/([\d\w]*)/);
	if (!mre || mre.length != 3) return false;
	return {
		type: ItemTypes[mre[1]],
		id: mre[2]
	}
}

function detectWeb(doc, url) {
	const id = getIDFromUrl(url);
	// Z.debug(id);
	if (id) return id.type;
	return false;
}

// TODO: Hard to parse search page
function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll("div.List div.List__item");
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
	const id = getIDFromUrl(url);
	let newItem = new Zotero.Item(id.type);
	newItem.title = doc.title;
	newItem.url = url;
	// Read more button
	const button = ZU.xpath(doc, "//button[contains(@class, 'RichContent__more')]");
	if (button.length > 0) button[0].click();

	for (let field in FieldMatch) {
		// Z.debug(field);
		let tmp = ZU.xpath(doc, FieldMatch[field])
		if (tmp.length == 0) continue;
		const v = tmp[0].textContent.trim();
		
		// Z.debug(tmp[0].textContent);
		if (field == 'author') {
			newItem.creators = parseAuthorStr(v);
		} else if (field == 'metadata') {
			newItem = parseMetadata(v, newItem);
		} else if (field == 'tags') {
			newItem.tags = parseTags(tmp);
		}else {
			newItem[field] = v
		}
	}
	// fix item
	if (newItem.publicationTitle) newItem.publicationTitle = newItem.publicationTitle.replace(/[《》]/g, "");
	if (newItem.abstractNote) newItem.abstractNote = newItem.abstractNote.replace(/收起\s?$/, '').trim();
	if (newItem.影响因子) newItem.影响因子 = newItem.影响因子.replace("影响因子：", '').trim();
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
						"lastName": "美国国家科学院等",
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
				"publicationTitle": "分子植物育种",
				"url": "https://pubscholar.cn/articles/3c9b1ffd2848ebedb60f220461178c361bbe3e43934eaea9546e3fbac10ced2f0ad59b1f00a83155bd2a31da806d3178",
				"attachments": [],
				"tags": [
					{
						"tag": "CRISPR"
					},
					{
						"tag": "基因编辑"
					},
					{
						"tag": "甘蓝型油菜"
					}
				],
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
				"abstractNote": "本公开提供一种基因编辑构建体及其应用，所述基因编辑构建体用于将外源基因定点整合入基因组的核糖体DNA(rDNA)区，并能高效地表达其携带的外源基因。",
				"url": "https://pubscholar.cn/patents/d1067ea442b3b43a3a301abc252eb139a0fbe21d5ec4e8bb250fde14e9c6a173880526c9b4434ff87754e650b78fecac/0",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
