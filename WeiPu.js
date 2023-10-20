{
	"translatorID": "dd9efb0b-ca1d-4634-b480-9aabc84213c0",
	"label": "WeiPu",
	"creator": "Xingzhong Lin",
	"target": "^https?://(lib|qikan)\\.cqvip\\.com",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-20 12:36:13"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Xingzhong Lin, https://github.com/Zotero-CN/translators_CN

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

function getIDFromUrl(url) {
	if (!url) return false;
	let ID = url.match(/id=[\da-zA-z]+/);
	if (!ID) return false;
	return ID[0].substring(3);
}

function detectWeb(doc, url) {
  	if (url.includes('/Qikan/Article/Detail')) {
		return 'journalArticle';
  	} else
  	if (getSearchResults(doc, true)) {
		return 'multiple';
  	}
  	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('a[href*="/Qikan/Article/Detail?"]');
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

const FIELDMAP = {
	title: "Titles > Title > Text",
	language: "Titles > Title > Language",
	abstractNote: "Abstracts > Abstract > Text",
	publicationTitle: "Periodical > Name",
	volume: "Volum",
	issue: "Issue",
	pages: "Page",
	date: "PublishDate",
	ISSN: "Periodical > ISSN",
}

const TRANSLATION = {
	titleTranslation: "div.article-title > em",
	abstractTranslation: "div.abstract > em:last-of-type > span"
}

const parser = new DOMParser();

function matchCreator(creator) {
	if (creator.search(/[A-Za-z]/) !== -1) {
		creator = ZU.cleanAuthor(creator, 'author');
	}
	else {
		creator = creator.replace(/\s/, '');
		creator = {
			lastName: creator,
			creatorType: 'author',
			fieldMode: true
		}
	}
	return creator;
}

async function scrape(doc, url = doc.location.href) {
	var newItem = new Z.Item('journalArticle');
	let ID = getIDFromUrl(url);
	let login = !!doc.querySelector('#Logout'); // '#user-nav>li>#Logout'
	var debugLog = `scraping ${url}\nlogin statue=${login}\n`;
	try {
		/* get data from post */
		// 以下POST请求需要校验本地cookies,Scaffold不支持,需在浏览器调试
		const referText = await requestText(
			'/Qikan/Search/Export?from=Qikan_Article_ExportTilte',
			{
				method: 'POST',
				body: `ids=${ID}&strType=title_info&type=endnote`
			}
		);
		debugLog += `Post result is\n${referText}\n`;
		// string -> html
		var postResult = parser.parseFromString(referText, "text/html");
		debugLog += `transform result to ${typeof(postResult)}\n`
		// html -> string
		postResult = postResult.querySelector('input#xmlContent').value;
		debugLog += `get xml:\n${postResult}\n`
		// string -> xml
		postResult = parser.parseFromString(postResult, "application/xml");
		var data = {
			innerData: postResult,
			get: function (path) {
				let result = this.innerData.querySelector(path);
				result = result ? result.textContent : '';
				return result ? result : '';
			},
			getAll: function (path) {
				let result = this.innerData.querySelectorAll(path);
				result = result.length ? Array.from(result).map((element) => (element.textContent)) : [];
				return result.length ? result : [];
			}
		}
		for (const field in FIELDMAP) {
			const path = FIELDMAP[field];
			debugLog += `in field ${field}, I get ${postResult.querySelector(path).textContent}\n`
			newItem[field] = data.get(path);
		}
		newItem.creators = data.getAll('Creators > Creator > Name').map((element) => (matchCreator(element)));
		newItem.tags = data.getAll('Keywords > Keyword').map((element) => ({ tag: element }));
		// fix language
		if (newItem.language == 'chi') newItem.language = 'zh-CN';
	}
	catch (error) {
		newItem.title = doc.querySelector('div.article-title > h1').innerText;
		newItem.abstractNote = doc.querySelector('span.abstract:nth-of-type(3) > span').innerText;
		newItem.creators = Array.from(doc.querySelectorAll('div.author > span > span > a > span')).map((element) => (
			matchCreator(element.innerText)
		));
		newItem.publicationTitle = doc.querySelector('div.journal > span.from > a').title;
		var vol = ZU.trimInternal(doc.querySelector('div.journal > span.from > span.vol').innerText);
		newItem.date = vol.split('年')[0];
		newItem.issue = vol.split(/[第期]/)[1];
		newItem.pages = vol.split(/[期,]/)[1];
		newItem.tags = Array.from(doc.querySelectorAll('div.subject > span > a')).map((element) => ({
			tag: element.title
		}));
		newItem['debugLog'] = debugLog;
	}
	/* get data from page */
	for (const field in TRANSLATION) {
		const path = TRANSLATION[field];
		try {
			newItem[field] = doc.querySelector(path).innerText;
		} catch (error) {
			newItem[field] = '';
		}
	}
	// 修正维普镜像站中摘要内的英文引号异常
	newItem['abstractNote'] = newItem['abstractNote'].replace(/&quot；/g, '"');
	newItem.url = url;

	if (login) {
		let filestr = doc.querySelectorAll('.article-source>a')[1].getAttribute('onclick')
		let fileid = filestr.split(/[,']/)[1];
		let filekey = filestr.split(/[,']/)[4];
		let [pdfUrl, pdfName] = await getPDF(fileid, filekey);
		if (pdfUrl) {
			newItem.attachments = [{
				title: pdfName || "Full Text PDF",
				mimeType: "application/pdf",
				url: pdfUrl
			}];
		}
	}
	newItem.complete();
}

async function getPDF(fileid, filekey) {
	let postUrl = "/Qikan/Article/ArticleDown";
	let postData = `id=${fileid}&info=${filekey}&ts=${(new Date).getTime()}`
	let res = await requestText(postUrl, {
		method: 'POST',
		body: postData
	});
	const fileurl = JSON.parse(res).url;
	let pdfname = decodeURIComponent(fileurl).match(/FileName=(.+?\.pdf)/i);
	let filename = pdfname ? pdfname[1] : null;
	return [fileurl, filename];
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://qikan.cqvip.com/Qikan/Article/Detail?id=HS723722017007008&from=Qikan_Search_Index",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "不确定因素下一类物流车最优路径模型的建立与求解",
				"creators": [
					{
						"firstName": "若男",
						"lastName": "沈"
					},
					{
						"firstName": "有慧",
						"lastName": "苏"
					}
				],
				"date": "2017",
				"abstractNote": "本文以徐州市圆通快递文化宫营业部到中国矿业大学南湖校区为研究对象,建立了不确定因素下最优路径模型,利用正态分布的可加性,得出各条路径的总行驶时间正态分布表达式,并进行标准化,解出行驶时间的表达式。当到达终点的概率确定时,最优路径为行驶时间最少的路径。在此基础上设计了基于深度优先搜索的最优路径算法,运用MATLAB编程,得出7条不同的路径,求出最短行驶时间和最优路径。",
				"issue": "7",
				"language": "zh-CN",
				"libraryCatalog": "WeiPu",
				"pages": "861-870",
				"publicationTitle": "应用数学进展",
				"url": "http://qikan.cqvip.com/Qikan/Article/Detail?id=HS723722017007008&from=Qikan_Search_Index",
				"volume": "6",
				"attachments": [],
				"tags": [
					{
						"tag": "卷积公式"
					},
					{
						"tag": "最优路径模型"
					},
					{
						"tag": "正态分布可加性"
					},
					{
						"tag": "深度优先搜索算法"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
