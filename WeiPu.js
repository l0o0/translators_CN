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
	"lastUpdated": "2023-11-02 14:54:26"
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
	}
	else if (getSearchResults(doc, true)) {
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
};

const TRANSLATION = {
	titleTranslation: "div.article-title > em",
	abstractTranslation: "div.abstract > em:last-of-type > span"
};

const parser = new DOMParser();

function matchCreator(creator) {
	if (/[A-Za-z]/.test(creator)) {
		creator = ZU.cleanAuthor(creator, 'author');
	}
	else {
		creator = creator.replace(/\s/, '');
		creator = {
			lastName: creator,
			creatorType: 'author',
			fieldMode: 1
		};
	}
	return creator;
}

async function scrape(doc, url = doc.location.href) {
	var newItem = new Z.Item('journalArticle');
	let ID = getIDFromUrl(url);
	let login = !!doc.querySelector('#Logout'); // '#user-nav>li>#Logout'
	// var debugLog = `scraping ${url}\nlogin statue=${login}\n`;
	try {
		// 以下POST请求需要校验本地cookies,Scaffold不支持,需在浏览器调试
		const referText = await requestText(
			'/Qikan/Search/Export?from=Qikan_Article_ExportTilte',
			{
				method: 'POST',
				body: `ids=${ID}&strType=title_info&type=endnote`
			}
		);
		// debugLog += `Post result is\n${referText}\n`;
		// string -> html
		var postResult = parser.parseFromString(referText, "text/html");
		// debugLog += `transform result to ${typeof (postResult)}\n`;
		// html -> string
		postResult = postResult.querySelector('input#xmlContent').value;
		// debugLog += `get xml:\n${postResult}\n`;
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
				result = result.length ? Array.from(result).map(element => (element.textContent)) : [];
				return result.length ? result : [];
			}
		};
		for (const field in FIELDMAP) {
			const path = FIELDMAP[field];
			// debugLog += `in field ${field}, I get ${postResult.querySelector(path).textContent}\n`;
			newItem[field] = data.get(path);
		}
		newItem.creators = data.getAll('Creators > Creator > Name').map(element => (matchCreator(element)));
		newItem.tags = data.getAll('Keywords > Keyword').map(element => ({ tag: element }));
		// fix language
		if (newItem.language == 'chi') newItem.language = 'zh-CN';
	}
	catch (error) {
		newItem.title = doc.querySelector('div.article-title > h1').innerText;
		newItem.abstractNote = doc.querySelector('span.abstract:nth-of-type(3) > span').innerText;
		newItem.creators = Array.from(doc.querySelectorAll('div.author > span > span > a > span')).map(element => (
			matchCreator(element.innerText)
		));
		newItem.publicationTitle = doc.querySelector('div.journal > span.from > a').title;
		var vol = ZU.trimInternal(doc.querySelector('div.journal > span.from > span.vol').innerText);
		newItem.date = vol.split('年')[0];
		newItem.issue = vol.split(/[第期]/)[1];
		newItem.pages = vol.split(/[期,]/)[1];
		newItem.tags = Array.from(doc.querySelectorAll('div.subject > span > a')).map(element => ({
			tag: element.title
		}));
		// newItem.debugLog = debugLog;
	}
	
	newItem.extra = '';
	for (const field in TRANSLATION) {
		const path = TRANSLATION[field];
		try {
			newItem.extra += `\n${field}: ${doc.querySelector(path).innerText}`;
		}
		catch (error) {
			Z.debug("this is an error");
		}
	}
	// 修正维普镜像站中摘要内的英文引号异常
	newItem.abstractNote = newItem.abstractNote.replace(/&quot；/g, '"');
	newItem.url = url;

	if (login) {
		let filestr = doc.querySelectorAll('.article-source>a')[1].getAttribute('onclick');
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
	if (newItem.date) newItem.date = newItem.date.split("T")[0];
	newItem.complete();
}

async function getPDF(fileid, filekey) {
	let postUrl = "/Qikan/Article/ArticleDown";
	let postData = `id=${fileid}&info=${filekey}&ts=${(new Date).getTime()}`;
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
		"url": "https://lib.cqvip.com/Qikan/Article/Detail?id=7109808542&from=Qikan_Search_Index",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "数字时代背景下在线诉讼的发展路径与风险挑战 认领",
				"creators": [
					{
						"lastName": "刘峥",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "在线诉讼是互联网时代的必然产物,它可能存在发展快或慢的问题,但它的到来不可避免且无法抗拒,其存在的必要性与合理性也是母庸置疑的。现行民事诉讼法已对在线诉讼的效力予以确认。应当明确,基于诉讼活动的特质和规律,目前,在线诉讼只是线下诉讼的有益补充,并非取而代之。本文从《人民法院在线诉讼规则》出发,论述了在线诉讼的时代背景和发展历程,阐明在线诉讼的程序规范性、权利保障性、方式便捷性、模式融合性。同时,在线诉讼将对未来司法制度的完善发展产生巨大推动作用,在理论更新、规则指引、制度完善、技术迭代、安全保障、人才培养等方面均需作出必要的配套跟进。收起",
				"extra": "titleTranslation: Navigating Online Litigation in the Digital Age:Paths and Challenges\nabstractTranslation: The emergence of online litigation is an inevitable corollary of the Internet era.Although the speed of its development may vary,the necessity and rationality of its existence are indisputable.The Civil Procedure Law of the People's Republic of China has confirmed the legal effects of online litigation.Notably,online litigation currently serves as a complementary tool rather than a substitution for offline litigation,given the nature and law of litigation.Drawing on the Online Litigation Rules of the People's Courts,this article examines online litigation's historical background and development.We illustrate how online litigation standardizes procedures,protects litigants'rights,provides convenience to court users,and integrates different modes of litigation.Furthermore,we argue that online litigation can serve as a driving force behind the future advancement of the judicial system.To achieve this,measures such as theoretical innovation,rules-based guidance,institutional improvement,technological iteration,and talent cultivation need to be implemented.FEWER",
				"issue": "2",
				"libraryCatalog": "WeiPu",
				"pages": "122-135",
				"publicationTitle": "数字法治",
				"url": "https://lib.cqvip.com/Qikan/Article/Detail?id=7109808542&from=Qikan_Search_Index",
				"attachments": [],
				"tags": [
					{
						"tag": "在线诉讼"
					},
					{
						"tag": "基本特征"
					},
					{
						"tag": "融合发展"
					},
					{
						"tag": "风险挑战"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
