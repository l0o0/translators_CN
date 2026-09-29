{
	"translatorID": "1c209d20-79a7-4602-89ea-f83f4bb16a81",
	"label": "CADAL",
	"creator": "Daxoel",
	"target": "^https?://cadal\\.edu\\.cn/(cardpage/bookCardPage|cadalinfo/search)",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-08-18 10:00:00"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 4965898

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
	// 详情页
	if (/cardpage\/bookCardPage/.test(url)) {
		if (doc.querySelector('span.title')) {
			return detectType(doc);
		}
		return false;
	}
	// 搜索结果页
	if (/cadalinfo\/search/.test(url) && getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function detectType(doc) {
	const fields = getDDFields(doc);
	const resourceType = getField(fields, '资源类型');
	if (/学位论文/.test(resourceType)) return 'thesis';
	if (/标准/.test(resourceType)) return 'standard';
	if (/期刊/.test(resourceType)) return 'journalArticle';
	if (/会议/.test(resourceType)) return 'conferencePaper';
	if (/专利/.test(resourceType)) return 'patent';
	return 'book';
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	// 搜索结果项: <a class="title" onclick="bookCardPageGo('ssno','card')">
	const titleLinks = doc.querySelectorAll('a.title');
	for (const titleLink of titleLinks) {
		const onclick = titleLink.getAttribute('onclick') || '';
		const match = onclick.match(/bookCardPageGo\(['"]([^'"]+)['"]/);
		if (!match) continue;
		const ssno = match[1];
		const url = 'https://cadal.edu.cn/cardpage/bookCardPage?ssno=' + ssno + '&source=card';
		const title = ZU.trimInternal(titleLink.textContent);
		if (!title) continue;
		if (checkOnly) return true;
		found = true;
		items[url] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) === 'multiple') {
		const searchResults = getSearchResults(doc, false);
		const items = await Z.selectItems(searchResults);
		if (!items) return;
		for (const itemUrl in items) {
			const itemDoc = await requestDocument(itemUrl);
			scrape(itemDoc, itemUrl);
		}
	}
	else {
		scrape(doc, url);
	}
}

function scrape(doc, url) {
	const itemType = detectType(doc);
	const item = new Z.Item(itemType);

	item.url = url;
	item.libraryCatalog = '大学数字图书馆国际合作计划';
	item.language = 'zh-CN';

	// 标题
	const titleEl = doc.querySelector('span.title');
	if (titleEl) {
		item.title = ZU.trimInternal(titleEl.textContent);
	}

	// 获取所有 <dd> 字段
	const fields = getDDFields(doc);

	// 作者
	const author = getField(fields, '作者');
	if (author) addCreators(item, author);

	// 出版社 / 学位授予单位
	const publisher = getField(fields, '出版社');
	if (publisher) {
		if (itemType === 'thesis') {
			item.university = publisher;
		}
		else {
			// 处理 "出版社·出版地" 格式
			const pubParts = publisher.split(/[·・]/);
			if (pubParts.length >= 2) {
				item.publisher = pubParts[0].trim();
				item.place = pubParts[pubParts.length - 1].trim();
			}
			else {
				item.publisher = publisher;
			}
		}
	}

	// 出版时间
	const date = getField(fields, '出版时间');
	if (date) item.date = date;

	// ISBN
	const isbn = getField(fields, 'ISBN');
	if (isbn) {
		const isbnMatch = isbn.match(/([\dXx-]{10,})/);
		if (isbnMatch) item.ISBN = isbnMatch[1];
	}

	// 摘要
	const abstract = getAbstract(doc);
	if (abstract) item.abstractNote = abstract;

	// 标签
	const tags = getField(fields, '标签');
	if (tags) {
		item.tags = tags.split(/[,，;；]/).map(function (t) {
			return t.trim();
		}).filter(function (t) {
			return t && t !== '添加标签';
		});
	}

	// 主题（学位论文常见）
	const subject = getField(fields, '主题');
	if (subject) {
		const subjectTags = subject.split(/[；;]/).map(function (t) {
			return t.trim();
		}).filter(function (t) {
			return t;
		});
		for (const subjectTag of subjectTags) {
			if (item.tags.indexOf(subjectTag) === -1) {
				item.tags.push(subjectTag);
			}
		}
	}

	// 馆藏单位
	const library = getField(fields, '馆藏单位');
	const extraParts = [];
	if (library) {
		extraParts.push('馆藏单位: ' + library);
	}

	// 资源类型
	const resourceType = getField(fields, '资源类型');
	if (resourceType) {
		extraParts.push('资源类型: ' + resourceType);
	}

	if (extraParts.length > 0) {
		item.extra = extraParts.join('\n');
	}

	if (itemType === 'thesis') {
		item.thesisType = '学位论文';
	}

	item.complete();
}

// 获取包含标题的主 <dl> 元素
function getMainDL(doc) {
	const titleEl = doc.querySelector('span.title');
	if (titleEl) {
		let node = titleEl;
		while (node && node.tagName !== 'DL') {
			node = node.parentElement;
		}
		if (node) return node;
	}
	return doc.querySelector('dl');
}

// 从 <dd> 元素中提取字段
function getDDFields(doc) {
	const fields = {};
	const dl = getMainDL(doc);
	if (!dl) return fields;

	const ddEls = dl.querySelectorAll('dd');
	for (const dd of ddEls) {
		// 跳过操作按钮区域
		if (dd.className && /tool/.test(dd.className)) continue;

		const text = dd.textContent;
		// 匹配 "标签：值" 格式（中文冒号或英文冒号）
		const match = text.match(/^([\u4e00-\u9fa5A-Za-z]+)[：:]\s*([\s\S]*)$/);
		if (match) {
			const label = match[1].trim();
			let value = match[2].trim();
			// 清理标签字段中的"添加标签"链接文字
			if (label === '标签') {
				value = value.replace(/添加标签/g, '').trim();
			}
			if (value) fields[label] = value;
		}
	}
	return fields;
}

function getField(fields, labels) {
	if (!Array.isArray(labels)) labels = [labels];
	// 第一轮：精确匹配
	for (const label of labels) {
		if (fields[label]) return fields[label];
	}
	// 第二轮：模糊匹配
	for (const label of labels) {
		const re = new RegExp(label);
		for (const key in fields) {
			if (re.test(key)) return fields[key];
		}
	}
	return '';
}

// 提取摘要（处理展开/收起机制）
function getAbstract(doc) {
	const dl = getMainDL(doc);
	if (!dl) return '';

	const ddEls = dl.querySelectorAll('dd');
	for (const dd of ddEls) {
		const text = dd.textContent.trim();
		if (/^说明[：:]/.test(text)) {
			// 克隆节点并移除链接，合并展开/收起内容
			const clone = dd.cloneNode(true);
			const links = clone.querySelectorAll('a');
			for (const link of links) {
				link.remove();
			}
			let abstract = ZU.trimInternal(clone.textContent);
			// 移除 "说明：" 前缀
			abstract = abstract.replace(/^说明[：:]\s*/, '');
			return abstract;
		}
	}
	return '';
}

// 解析作者（处理多作者、国籍前缀、角色标识）
function addCreators(item, authorString) {
	if (!authorString) return;

	// 按中英文分号/逗号分割，但不分割括号内的逗号
	const names = authorString.split(/[,，;；](?![^(]*\))/);

	for (const rawName of names) {
		let name = rawName.trim();
		if (!name) continue;

		// 移除国籍前缀，如 (苏联)、(澳)
		name = name.replace(/^\([\u4e00-\u9fa5]{1,5}\)\s*/, '');

		// 移除括号内的角色标识，如 (著)、(编)、(译)
		name = name.replace(/\([著编译辑撰注校订整理主编]+\)/g, '').trim();

		// 移除末尾角色字符，如 著、编、译
		name = name.replace(/[著编译辑撰注校订整理主编]+$/, '').trim();

		if (!name) continue;

		// 处理括号内的西文名
		const westernMatch = name.match(/\(([A-Za-z][^)]+)\)/);
		if (westernMatch) {
			const creator = ZU.cleanAuthor(westernMatch[1], 'author');
			if (creator.lastName) {
				item.creators.push(creator);
				continue;
			}
		}

		// 移除剩余括号内容（用于中文名清理）
		name = name.replace(/\([^)]*\)/g, '').trim();
		if (!name) continue;

		if (/[\u4e00-\u9fa5]/.test(name)) {
			// 中文名：单字段模式
			item.creators.push({
				lastName: name,
				creatorType: 'author',
				fieldMode: 1
			});
		}
		else {
			// 西文名：解析为姓+名
			const creator2 = ZU.cleanAuthor(name, 'author');
			if (creator2.lastName) {
				item.creators.push(creator2);
			}
		}
	}
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://cadal.edu.cn/cardpage/bookCardPage?ssno=SD297043500&source=card",
		"items": [
			{
				"itemType": "book",
				"title": "重写翻译史",
				"creators": [
					{
						"lastName": "谢天振",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"ISBN": "9787308212533",
				"language": "zh-CN",
				"libraryCatalog": "大学数字图书馆国际合作计划",
				"publisher": "浙江大学出版社",
				"date": "2021-04-12",
				"url": "https://cadal.edu.cn/cardpage/bookCardPage?ssno=SD297043500&source=card",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://cadal.edu.cn/cardpage/bookCardPage?ssno=03033710&source=card",
		"items": [
			{
				"itemType": "thesis",
				"title": "文化转型：鲁迅在中国近现代翻译史上的地位与意义",
				"creators": [
					{
						"lastName": "雷亚平",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"language": "zh-CN",
				"libraryCatalog": "大学数字图书馆国际合作计划",
				"university": "吉林大学",
				"thesisType": "学位论文",
				"date": "1999-12",
				"url": "https://cadal.edu.cn/cardpage/bookCardPage?ssno=03033710&source=card",
				"attachments": [],
				"tags": [
					"文化",
					"转型",
					"鲁迅",
					"中国",
					"近现代",
					"翻译",
					"史上",
					"意义",
					"吉林",
					"九十年代",
					"专著",
					"中国近现代翻译史",
					"中国文化转型",
					"鲁迅"
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://cadal.edu.cn/cadalinfo/search?searchType=sw&leftSearchContent=翻译史",
		"items": "multiple"
	}
]
/** END TEST CASES **/
