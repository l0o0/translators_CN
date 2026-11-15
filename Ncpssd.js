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
	"lastUpdated": "2026-11-15 05:10:58"
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

	static toURL(url) {
		const securePrefix = tryMatch(
			url,
			/^(https?:\/\/[^/?#]+\/Literature\/secure\/articleinfo)(?:[?#]|$)/i,
			1
		);
		if (securePrefix) {
			const params = tryMatch(url, /[?&]params=([^&#]*)/i, 1);
			return params
				? `${securePrefix}?params=${params}`
				: url;
		}

		if (!/\/Literature\/articleinfo(?:[?#]|$)/i.test(url)) return url;
		const ids = new ID(url);
		if (!ids.id || !ids.datatype) return url;

		let cleanURL = `https://www.ncpssd.cn/Literature/articleinfo?id=${ids.id}&type=${ids.datatype}`;
		if (['Ancient', 'Book'].includes(ids.datatype) && ids.barcodenum) {
			cleanURL += `&barcodenum=${ids.barcodenum}`;
		}
		return cleanURL;
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
		if (url == "https://www.ncpssd.cn" || url == "https://www.ncpssd.org") continue;
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
		Z.debug(p.innerText);
		const content = p.innerText.split("\n")[1];
		return content ? content.trim() : "";
	}
	function getCreators() {
		const p = doc.querySelector("#p_creator");
		if (p.querySelectorAll("font").length > 0) {
			return Array.from(p.querySelectorAll("font")).map(e => e.textContent.trim());
		}
		else {
			return p.innerText.split("\n")[1].split(";");
		}
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
			newItem.volume = tryMatch(pubInfo, /(?:第)?0*(\d+)卷/i, 1);
			newItem.issue = tryMatch(pubInfo, /(?:第)?0*(\d+)期/i, 1).replace(/([A-Z]?)0*([1-9]\d*)/i, '$1$2');
			newItem.date = tryMatch(pubInfo, /^(\d{4})年/, 1);
			newItem.pages = getContent('page').replace(/页$/, '');
			getCreators().forEach(name => newItem.creators.push(cleanAuthor(name)));
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
	newItem.url = ID.toURL(url);
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
	// Z.debug(json);
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
	newItem.url = ID.toURL(url);
	newItem.libraryCatalog = '国家哲学社会科学文献中心';
	newItem.extra = extra.toString();
	data.get('keywordc').split(';').forEach(tag => newItem.tags.push(tag));
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
		"url": "https://www.ncpssd.org/Literature/secure/articleinfo?params=bTUwa0F4bVF3RExIdkMxNmM4QU96OVR0VWp6Y0hrS2oybUlNdDZCbVFjUlUzUFJLc1p0SlBpcVZrVU1mMHlZM2JWdDJscnZYME9OQVB2dUNuWkNrVHpiZmxSdENJdkNPSnJpSFZuTTk0eGdDblQ5eWNpaThhSmtFVitYZWh6SUNGWkxBTkgyVFdiMFZ5eElCL0hGem5BPT0&pageUrl=https%253A%252F%252Fwww.ncpssd.org%252FLiterature%252Farticlelist%253FsType%253D0%2526search%253DKElLVEU9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252BhIik%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252BhIg%253D%253D%2526nav%253D0%2526ajaxKeys%253D5paH5YyW6Ieq5L%252Bh",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "基于CiteSpace的文化主体性研究的演进、前沿与进路",
				"creators": [
					{
						"lastName": "张玥洋",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "张秀丽",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2026",
				"abstractNote": "在中华民族伟大复兴战略推进与文化自信觉醒的双重背景下，文化主体性已成为彰显文化强国地位、提升国际话语权的核心议题。利用CiteSpace可视化分析工具，对文化主体性构建关键词共现图谱、关键词聚类图谱、关键词时区图谱及关键词突现图谱，能够科学量化地呈现并深度解析该领域的研究热点、发展趋势、演进路径与前沿方向。分析表明，文化主体性研究热点正从抽象理论探讨向文化传承创新的实践领域延伸。然而，当前研究亦存在研究力量分散导致学术共同体尚未形成、跨学科整合不足、典型实践案例挖掘深度不够等局限。基于上述发现，本文从强化问题意识、推动学科融合、拓宽国际视野三个层面提出针对性建议，以期为该领域的进一步发展提供有益参考。",
				"extra": "original-publication-title: Journal of Henan Polytechnic University:Social Sciences",
				"issue": "5",
				"language": "zh-CN",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"pages": "28-37",
				"publicationTitle": "河南理工大学学报：社会科学版",
				"url": "https://www.ncpssd.org/Literature/secure/articleinfo?params=bTUwa0F4bVF3RExIdkMxNmM4QU96OVR0VWp6Y0hrS2oybUlNdDZCbVFjUlUzUFJLc1p0SlBpcVZrVU1mMHlZM2JWdDJscnZYME9OQVB2dUNuWkNrVHpiZmxSdENJdkNPSnJpSFZuTTk0eGdDblQ5eWNpaThhSmtFVitYZWh6SUNGWkxBTkgyVFdiMFZ5eElCL0hGem5BPT0",
				"volume": "27",
				"attachments": [],
				"tags": [
					{
						"tag": "CiteSpace"
					},
					{
						"tag": "文化主体性"
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
		"url": "https://www.ncpssd.org/Literature/secure/articleinfo?params=d1FubG05RUZFRnhsaE13bUJVbFVUU2VHYzllelYwbVJQQitjTlpsY3dycHZVNWgzbnV3NUVaSXRHUUNuYVVGSlBrWTg1M2o4N3RJcExYaHBXNHVyWnFGd1E5ZHdqMTNUYStDZUdRK0JubjF1WUplQytadk82WFY1TEgyeE1xTmY&pageUrl=https%253A%252F%252Fwww.ncpssd.org%252FLiterature%252Farticlelist%253FsType%253D0%2526search%253DKElLVEU9IuaWh%252BWMluiHquS%252FoeinhuinkuS4i%252BmZtuihjOefpeWkluivreiuuuiRl%252BeahOa1t%252BWkluS8oOaSrSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6Hop4bop5LkuIvpmbbooYznn6XlpJbor63orrrokZfnmoTmtbflpJbkvKDmkq0iICBPUiBJS1NUPSLmlofljJboh6rkv6Hop4bop5LkuIvpmbbooYznn6XlpJbor63orrrokZfnmoTmtbflpJbkvKDmkq0iIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoeinhuinkuS4i%252BmZtuihjOefpeWkluivreiuuuiRl%252BeahOa1t%252BWkluS8oOaSrSIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252Bh6KeG6KeS5LiL6Zm26KGM55%252Bl5aSW6K%252Bt6K666JGX55qE5rW35aSW5Lyg5pKtIik%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252Bh6KeG6KeS5LiL6Zm26KGM55%252Bl5aSW6K%252Bt6K666JGX55qE5rW35aSW5Lyg5pKtIg%253D%253D%2526nav%253D0%2526ajaxKeys%253D5paH5YyW6Ieq5L%252Bh6KeG6KeS5LiL6Zm26KGM55%252Bl5aSW6K%252Bt6K666JGX55qE5rW35aSW5Lyg5pKt",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "文化自信视角下陶行知外语论著的海外传播",
				"creators": [
					{
						"lastName": "郭晓菊",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "陶行知外语论著在世界范围内的传播可被视为中国教育史上的一次现象级传播，同时也是中国教育领域思想与文化的成功输出。作为中国优质教育文化的陶行知外语论著不仅彰显出陶行知教育理念的魅力，也凸显出了中华文化的当代价值及文化自信。基于此，本文在总结陶行知外语论著的传播现状的基础上，阐述了文化自信视角下陶行知外语论著的海外传播。",
				"extra": "original-publication-title: Time Education",
				"issue": "35",
				"language": "zh-CN",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"pages": "103-105",
				"publicationTitle": "时代教育",
				"url": "https://www.ncpssd.org/Literature/secure/articleinfo?params=d1FubG05RUZFRnhsaE13bUJVbFVUU2VHYzllelYwbVJQQitjTlpsY3dycHZVNWgzbnV3NUVaSXRHUUNuYVVGSlBrWTg1M2o4N3RJcExYaHBXNHVyWnFGd1E5ZHdqMTNUYStDZUdRK0JubjF1WUplQytadk82WFY1TEgyeE1xTmY",
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
		"url": "https://www.ncpssd.org/Literature/secure/articleinfo?params=T1pQVlVLUW52YXNLS25pSVJ2M256VjZ5dUxBWkJzaVdlYVFEWWxBNzNxaTdYOTlNdmd2UE55anAwVEZNM2RLekw3c2lITlJuSVV4S1BpaHByZ0UxYUxvTnJHN3A4bm53dGhBOE5xVkZ4ZHY5K0VGTWd6ZUpLMmtFRUFjZmxuOEk&pageUrl=https%253A%252F%252Fwww.ncpssd.org%252FLiterature%252Farticlelist%253FsType%253D0%2526search%253DKElLVEU9IuaWh%252BWMluiHquS%252FoeinhuWfn%252BS4i%252BWPpOS9k%252Bivl%252BivjeWcqOS4k%252BS4muaVmeWtpuS4reeahOW6lOeUqOeglOeptiIgT1IgSUtQWVRFPSLmlofljJboh6rkv6Hop4bln5%252FkuIvlj6TkvZPor5for43lnKjkuJPkuJrmlZnlrabkuK3nmoTlupTnlKjnoJTnqbYiICBPUiBJS1NUPSLmlofljJboh6rkv6Hop4bln5%252FkuIvlj6TkvZPor5for43lnKjkuJPkuJrmlZnlrabkuK3nmoTlupTnlKjnoJTnqbYiIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoeinhuWfn%252BS4i%252BWPpOS9k%252Bivl%252BivjeWcqOS4k%252BS4muaVmeWtpuS4reeahOW6lOeUqOeglOeptiIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252Bh6KeG5Z%252Bf5LiL5Y%252Bk5L2T6K%252BX6K%252BN5Zyo5LiT5Lia5pWZ5a2m5Lit55qE5bqU55So56CU56m2Iik%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252Bh6KeG5Z%252Bf5LiL5Y%252Bk5L2T6K%252BX6K%252BN5Zyo5LiT5Lia5pWZ5a2m5Lit55qE5bqU55So56CU56m2Ig%253D%253D%2526nav%253D0%2526ajaxKeys%253D5paH5YyW6Ieq5L%252Bh6KeG5Z%252Bf5LiL5Y%252Bk5L2T6K%252BX6K%252BN5Zyo5LiT5Lia5pWZ5a2m5Lit55qE5bqU55So56CU56m2",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "文化自信视域下古体诗词在专业教学中的应用研究",
				"creators": [
					{
						"lastName": "王艺霖",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "李秀领",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "王军",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "张玉明",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022",
				"abstractNote": "为提升理工科专业知识教育与思政教育的实效，本文以土木工程专业为例，基于“文化自信”理念探讨了将古体诗词与专业课程进行有机融合的新思路：首先创作了一系列表达专业知识的古体诗词，体现了文学性、艺术性与专业性的统一，进而提出了在教学中的具体应用方式(融入课件、用于课内；结合新媒体平台、用于课外)。研究表明，本方式可发掘传统文化的现代价值、提升学生的学习兴趣、感受文化自信、促进人文素养的提升，达到专业教育与传统文化教育的双赢。",
				"issue": "11",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"publicationTitle": "Advances in Education",
				"url": "https://www.ncpssd.org/Literature/secure/articleinfo?params=T1pQVlVLUW52YXNLS25pSVJ2M256VjZ5dUxBWkJzaVdlYVFEWWxBNzNxaTdYOTlNdmd2UE55anAwVEZNM2RLekw3c2lITlJuSVV4S1BpaHByZ0UxYUxvTnJHN3A4bm53dGhBOE5xVkZ4ZHY5K0VGTWd6ZUpLMmtFRUFjZmxuOEk",
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
	}
]
/** END TEST CASES **/
