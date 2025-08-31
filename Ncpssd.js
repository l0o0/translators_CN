{
	"translatorID": "5b731187-04a7-4256-83b4-3f042fa3eaa4",
	"label": "Ncpssd",
	"creator": "jiaojiaodubai",
	"target": "^https?://([^/]+\\.)?ncpssd\\.(org|cn)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-08-31 19:39:38"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 018<lyb018@gmail.com>, l0o0<linxzh1989@gmail.com>
	
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

class ID {
	constructor(url) {
		this.id = tryMatch(url, /[?&]id=([^&#]*)/i, 1);
		this.datatype = tryMatch(url, /[?&]type=([^&#]*)/i, 1);
		this.typename = decodeURI(tryMatch(url, /[?&]typename=([^&#]*)/i, 1));
		this.barcodenum = tryMatch(url, /[?&]barcodenum=([^&#]*)/i, 1);
	}

	toItemType() {
		return {
			journalArticle: 'journalArticle',
			eJournalArticle: 'journalArticle',
			Ancient: 'book',
			collectionsArticle: 'journalArticle'
		}[this.datatype];
	}

	static toTypeName(datatype) {
		return {
			journalArticle: '中文期刊文章',
			eJournalArticle: '外文期刊文章',
			Ancient: '古籍',
			collectionsArticle: '集刊'
		}[datatype];
	}
}

const typeMap = {
	中文期刊文章: 'journalArticle',
	外文期刊文章: 'journalArticle',
	古籍: 'book',
	集刊: 'journalArticle'
};

function detectWeb(doc, url) {
	if (url.includes('/articleinfo?')) {
		const typeKey = text(doc, 'h1 > i');
		return typeMap[typeKey];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('#ul_articlelist li .julei-list a:first-of-type, a[onclick*="/Literature/"]');
	for (const row of rows) {
		const title = ZU.trimInternal(row.textContent);
		const datatype = {
			中文期刊文章: 'journalArticle',
			外文期刊文章: 'eJournalArticle',
			古籍: 'Ancient',
			外文图书: 'Book'
		}[row.getAttribute('data-type')];
		const url = datatype
			? genUrl({
				id: row.getAttribute('data-id'),
				// 这里没有填反
				datatype: datatype,
				typename: row.getAttribute('data-type'),
				barcodenum: row.getAttribute('data-barcodenum')
			})
			: `https://www.ncpssd.cn${tryMatch(row.getAttribute('onclick'), /\('(.+)'\)/, 1)}`;
		if (checkOnly) return true;
		found = true;
		items[url] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrapeAPI(url);
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	if (url.includes('/secure/')) {
		await scrapeDoc(doc, url);
	}
	else {
		await scrapeAPI(url);
	}
}

async function scrapeDoc(doc, url) {
	function getContent(suffix) {
		const p = doc.querySelector(`#p_${suffix}`);
		const content = removeChild(p, 'strong:first-child');
		return content.textContent.trim();
	}
	const newItem = new Z.Item(detectWeb(doc, url));
	const extra = new Extra();
	const titleElm = doc.querySelector('#h2_title_c');
	const titleCopy = removeChild(titleElm, 'i');
	newItem.title = ZU.trimInternal(titleCopy.textContent);
	switch (newItem.itemType) {
		case 'journalArticle': {
			newItem.abstractNote = getContent('remark');
			const publication = getContent('media');
			newItem.publicationTitle = tryMatch(publication, /《(.+?)》/, 1);
			extra.set('original-publication-title', tryMatch(publication, /\((.+?)\)$/, 1));
			const pubInfo = getContent('year');
			newItem.issue = tryMatch(pubInfo, /第(.+?)期$/i, 1).replace(/([A-Z]?)0*([1-9]\d*)/i, '$1$2');
			newItem.pages = getContent('page').replace(/页$/, '');
			getContent('creator').split('\n').forEach(name => newItem.creators.push(cleanAuthor(name)));
			break;
		}
		case 'book':
			newItem.publisher = getContent('media');
			newItem.date = getContent('year');
			newItem.edition = getContent('remark');
			getContent('imburse').split('\n').forEach(name => newItem.creators.push(cleanAuthor(name.slice(3, -1))));
			extra.set('type', 'classic', true);
			break;
	}
	if (text(doc, 'h1 > i').includes('中文')) {
		newItem.language = 'zh-CN';
	}
	newItem.libraryCatalog = '国家哲学社会科学文献中心';
	newItem.extra = extra.toString();
	doc.querySelectorAll('#p_keyword > font').forEach(elm => newItem.tags.push(elm.textContent.trim()));
	newItem.complete();
}


async function scrapeAPI(url) {
	const ids = new ID(url);
	const newItem = new Z.Item(ids.toItemType());
	const extra = new Extra();
	const postData = { type: ID.toTypeName(ids.datatype) };
	if (ids.datatype == 'Ancient') {
		postData.barcodenum = ids.barcodenum;
	}
	else {
		postData.lngid = ids.id;
	}
	let json = {};
	let postUrl = `https://www.ncpssd.cn/articleinfoHandler/${ids.datatype == 'Ancient' ? 'getancientbooktable' : 'getjournalarticletable'}`;
	json = await requestJSON(
		postUrl,
		{
			method: 'POST',
			body: JSON.stringify(postData),
			headers: {
				// 以下是必需的
				'Content-Type': 'application/json',
				Referer: encodeURI(url)
			}
		}
	);
	const data = {
		innerData: json.data,
		get: function (label) {
			let result = this.innerData[label];
			return result
				? result
				: '';
		}
	};
	Z.debug(json);
	newItem.title = data.get('titlec');
	extra.set('original-title', data.get('titlee'), true);
	newItem.publicationTitle = data.get('mediac');
	switch (newItem.itemType) {
		case 'journalArticle':
			newItem.abstractNote = data.get('remarkc');
			newItem.volume = tryMatch(data.get('vol'), /0*([1-9]\d*)/, 1);
			newItem.issue = data.get('num').replace(/([A-Z]?)0*([1-9]\d*)/i, '$1$2');
			newItem.pages = Array.from(
				new Set([data.get('beginpage'), data.get('endpage')].filter(page => page))
			).join('-');
			newItem.date = data.get('publishdate');
			newItem.ISSN = data.get('issn');
			data.get('showwriter').split(';').forEach(name => newItem.creators.push(cleanAuthor(name)));
			break;
		case 'book':
			newItem.publisher = data.get('press');
			newItem.date = data.get('pubdate');
			newItem.edition = data.get('section');
			data.get('authorc').split(';').forEach(name => newItem.creators.push(cleanAuthor(name.slice(3, -1))));
			extra.set('type', 'classic', true);
			break;
	}
	if (ids.datatype != 'eJournalArticle') {
		newItem.language = 'zh-CN';
	}
	newItem.url = ID.toUrl(ids);
	newItem.libraryCatalog = '国家哲学社会科学文献中心';
	newItem.extra = extra.toString();
	data.get('keywordc').split(';').forEach(tag => newItem.tags.push(tag));
	let pdfLink = data.get('pdfurl');
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink,
			mimeType: 'application/pdf',
			title: 'Full Text PDF',
		});
	}
	newItem.complete();
}

function genUrl(params) {
	return encodeURI(
		'https://www.ncpssd.cn/Literature/articleinfo'
		+ `?id=${params.id}`
		+ `&type=${params.datatype}`
		+ `&typename=${params.typename}`
		+ `&nav=0`
		+ `+&barcodenum=${params.barcodenum}`
	);
}

function removeChild(parent, childSelector) {
	const copy = parent.cloneNode(true);
	const child = copy.querySelector(childSelector);
	if (child) {
		copy.removeChild(child);
	}
	return copy;
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function cleanAuthor(name, creatorType = 'author') {
	name = name.replace(/\[.*\]$/, '');
	if (/\p{Unified_Ideograph}/u.test(name)) {
		return {
			lastName: name,
			creatorType,
			fieldMode: 1
		};
	}
	else {
		return ZU.cleanAuthor(ZU.capitalizeName(name), creatorType);
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
		"url": "https://www.ncpssd.org/Literature/articlelist?sType=0&search=KElLVEU9IuaWh+WMluiHquS/oSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh+WMluiHquS/oSIgT1IgSUtTRT0i5paH5YyW6Ieq5L+hIik=&searchname=6aKY5ZCNL+WFs+mUruivjT0i5paH5YyW6Ieq5L+hIg==&nav=0&ajaxKeys=5paH5YyW6Ieq5L+h",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/index",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/Literature/articleinfo?id=SDJY2023035035&type=journalArticle&datatype=null&typename=%E4%B8%AD%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&synUpdateType=undefined&nav=0&barcodenum=&pageUrl=https%253A%252F%252Fwww.ncpssd.org%252FLiterature%252Farticlelist%253Fsearch%253DKElLVEU9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252BhIikgQU5EIChUWVBFPSLkuK3mlofmnJ%252FliIrmlofnq6AiKQ%253D%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252BhIiDkuI4gKOexu%252BWeiz3kuK3mlofmnJ%252FliIrmlofnq6Ap%2526nav%253D0",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "文化自信视角下陶行知外语论著的海外传播",
				"creators": [
					{
						"firstName": "",
						"lastName": "郭晓菊",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-12-10",
				"abstractNote": "陶行知外语论著在世界范围内的传播可被视为中国教育史上的一次现象级传播，同时也是中国教育领域思想与文化的成功输出。作为中国优质教育文化的陶行知外语论著不仅彰显出陶行知教育理念的魅力，也凸显出了中华文化的当代价值及文化自信。基于此，本文在总结陶行知外语论著的传播现状的基础上，阐述了文化自信视角下陶行知外语论著的海外传播。",
				"issue": "35",
				"language": "zh-CN",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"pages": "103-105",
				"publicationTitle": "时代教育",
				"url": "https://www.ncpssd.cn/Literature/articleinfo?id=SDJY2023035035&type=journalArticle&typename=%E4%B8%AD%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&nav=0+&barcodenum=",
				"attachments": [],
				"tags": [
					{
						"tag": "外语论著"
					},
					{
						"tag": "文化自信"
					},
					{
						"tag": "陶行知"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/Literature/articleinfo?id=CASS1039961165&type=eJournalArticle&datatype=journalArticle&typename=%E5%A4%96%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&synUpdateType=undefined&nav=0&barcodenum=&pageUrl=https%253A%252F%252Fwww.ncpssd.org%252FLiterature%252Farticlelist%253Fsearch%253DKElLVEU9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252BhIikgQU5EIChUWVBFPSLlpJbmlofmnJ%252FliIrmlofnq6AiKQ%253D%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252BhIiDkuI4gKOexu%252BWeiz3lpJbmlofmnJ%252FliIrmlofnq6Ap%2526nav%253D0",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "文化自信视域下古体诗词在专业教学中的应用研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "王艺霖",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李秀领",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王军",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张玉明",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"ISSN": "2160-729X",
				"abstractNote": "为提升理工科专业知识教育与思政教育的实效，本文以土木工程专业为例，基于“文化自信”理念探讨了将古体诗词与专业课程进行有机融合的新思路：首先创作了一系列表达专业知识的古体诗词，体现了文学性、艺术性与专业性的统一，进而提出了在教学中的具体应用方式(融入课件、用于课内；结合新媒体平台、用于课外)。研究表明，本方式可发掘传统文化的现代价值、提升学生的学习兴趣、感受文化自信、促进人文素养的提升，达到专业教育与传统文化教育的双赢。",
				"issue": "11",
				"language": "en-US",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"pages": "4294-4299",
				"url": "https://www.ncpssd.cn/Literature/articleinfo?id=CASS1039961165&type=eJournalArticle&typename=%E5%A4%96%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&nav=0+&barcodenum=",
				"volume": "12",
				"attachments": [],
				"tags": [
					{
						"tag": "古体诗词"
					},
					{
						"tag": "土木工程"
					},
					{
						"tag": "思政"
					},
					{
						"tag": "文化自信"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/Literature/articleinfo?id=FXJYYJ2023001009&type=collectionsArticle&datatype=journalArticle&typename=%E9%9B%86%E5%88%8A%E6%96%87%E7%AB%A0&synUpdateType=undefined&nav=0&barcodenum=&pageUrl=https%253A%252F%252Fwww.ncpssd.org%252FLiterature%252Farticlelist%253Fsearch%253DKElLVEU9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252BhIikgQU5EIChUWVBFPSLpm4bliIrmlofnq6AiKQ%253D%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252BhIiDkuI4gKOexu%252BWeiz3pm4bliIrmlofnq6Ap%2526nav%253D0",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "文化安全视阈下高校法治人才培养策略研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "雷艳妮",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-01-01",
				"abstractNote": "文化安全事关国家安全和人民幸福，高校法治人才培养与文化安全紧密关联。当前，高校法治人才培养面临诸多文化安全困境，如西方价值观的文化渗透、社会不良文化思潮的冲击、网络新媒体应用过程中的负面影响、高校文化安全教育的不足等。对此，高校法治人才培养应当在保障文化安全的前提下开展。其具体策略有五项：一是将习近平法治思想融入高校法治人才培养，牢固树立思想政治意识；二是将中华优秀传统文化融入高校法治人才培养，着力提升思想道德水平；三是将红色文化融入高校法治人才培养，全面提高思想道德修养；四是加强法律职业道德教育，持续提升职业道德水准；五是加强文化安全教育，坚定文化自觉与文化自信。唯有如此，方能为将我国建成社会主义现代化文化强国提供强大的法治人才保障与智力支持。",
				"issue": "1",
				"language": "zh-CN",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"pages": "144-157",
				"publicationTitle": "法学教育研究",
				"url": "https://www.ncpssd.cn/Literature/articleinfo?id=FXJYYJ2023001009&type=collectionsArticle&typename=%E9%9B%86%E5%88%8A%E6%96%87%E7%AB%A0&nav=0+&barcodenum=",
				"volume": "40",
				"attachments": [],
				"tags": [
					{
						"tag": "培养策略"
					},
					{
						"tag": "文化安全"
					},
					{
						"tag": "文化自信"
					},
					{
						"tag": "文化自觉"
					},
					{
						"tag": "法治人才"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/Literature/articleinfo?id=GJ10017&type=Ancient&typename=%E5%8F%A4%E7%B1%8D&nav=5&barcodenum=70050810",
		"items": [
			{
				"itemType": "book",
				"title": "太平樂圖",
				"creators": [
					{
						"firstName": "",
						"lastName": "吳之龍",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"edition": "繪本",
				"extra": "Type: classic\nclassify: 子\nremark: 版心：樂闲馆本；浙江民俗畫 \nbarcode: 70050810",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"publisher": "樂闲馆",
				"url": "https://www.ncpssd.cn/Literature/articleinfo?id=GJ10017&type=Ancient&typename=%E5%8F%A4%E7%B1%8D&nav=0+&barcodenum=70050810",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.cn/Literature/articleinfo?id=PRP1192499916434309120&type=journalArticle&datatype=journalArticle&typename=%E4%B8%AD%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&synUpdateType=2&nav=0&barcodenum=&pageUrl=https%253A%252F%252Fwww.ncpssd.cn%252FLiterature%252Farticlelist%253FsType%253D0%2526search%253DKElLVEU9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252BhIik%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252BhIg%253D%253D%2526nav%253D0%2526ajaxKeys%253D5paH5YyW6Ieq5L%252Bh",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "新中国成立以来中国共产党榜样文化叙事的特色与经验",
				"creators": [
					{
						"firstName": "",
						"lastName": "艾丹",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-01-04",
				"ISSN": "1673-3851",
				"abstractNote": "榜样因其真实、生动、形象的特点，具有强大的说服力和感染力。中国共产党榜样文化建设对社会主义核心价值观的培育与践行以及对外弘扬中国价值、彰显中国力量、讲好中国故事等具有不可替代的价值。新中国成立以来，中国共产党榜样文化叙事呈现出鲜明的中国特色，积累了宝贵的工作经验：榜样选树标准突显人民性和时代性的价值取向；榜样典型构建彰显代表性和先进性的双重特质；榜样人物奖励注重规范化和制度化的运作机制；榜样文化传播体现传承性与创新性的融合发展。该研究拓宽了榜样文化的研究视域，有助于深入推进社会主义文化强国建设。",
				"language": "zh-CN",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"pages": "52-58",
				"publicationTitle": "浙江理工大学学报：社会科学版",
				"url": "https://www.ncpssd.cn/Literature/articleinfo?id=PRP1192499916434309120&type=journalArticle&typename=%E4%B8%AD%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&nav=0+&barcodenum=",
				"attachments": [
					{
						"mimeType": "application/pdf",
						"title": "Full Text PDF"
					}
				],
				"tags": [
					{
						"tag": "中国共产党 榜样文化 英雄模范 主流意识形态 精神谱系 社会主义核心价值观 文化自信"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
