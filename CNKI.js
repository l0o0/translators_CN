{
	"translatorID": "5c95b67b-41c5-4f55-b71a-48d5d7183063",
	"label": "CNKI",
	"creator": "Aurimas Vinckevicius, Xingzhong Lin, jiaojiaodubai",
	"target": "https?://.*?(cnki\\.net)?/(kns8?s?|kcms2?|KNavi|KX?Reader)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 150,
	"inRepository": true,
	"translatorType": 12,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-07-12 13:00:47"
}

/*
	***** BEGIN LICENSE BLOCK *****
	CNKI(China National Knowledge Infrastructure) Translator
	Copyright © 2013 Aurimas Vinckevicius
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

/*********************
 * search translator *
 *********************/

function detectSearch(items) {
	return (filterQuery(items).length > 0);
}

/**
 * @param {*} items items or string.
 * @returns an array of DOIs.
 */
function filterQuery(items) {
	Z.debug('input items:');
	Z.debug(items);
	if (!items) return [];

	if (typeof items == 'string' || !items.length) items = [items];

	// filter out invalid queries
	var dois = [], doi;
	for (var i = 0, n = items.length; i < n; i++) {
		if (items[i].DOI && /(\/j\.issn|\/[a-z]\.cnki)/i.test(items[i].DOI) && (doi = ZU.cleanDOI(items[i].DOI))) {
			dois.push(doi);
		}
		else if (typeof items[i] == 'string' && /(\/j\.issn|\/[a-z]\.cnki)/i.test(items[i]) && (doi = ZU.cleanDOI(items[i]))) {
			dois.push(doi);
		}
	}
	Z.debug('return dois:');
	Z.debug(dois);
	return dois;
}

async function doSearch(items) {
	for (let doi of filterQuery(items)) {
		// 仅在国内有效
		let url = `https://link.cnki.net/doi/${encodeURIComponent(doi)}`;
		Z.debug(`search url: ${url}`);
		let doc = await requestDocument(url);
		// Z.debug(doc);
		await doWeb(doc, url);
	}
}

/******************
 * web translator *
 ******************/

/**
 * A mapping table of database code to item type.
 * It may be modified when this Translator called by other translators.
 */
var typeMap = {

	/*
	In the following comments,
	"wai wen" indicates the pinyin of Chinese word "外文", meaning "foreign language",
	"zong ku" indicates the pinyin of Chinese word "总库", meaning "total database".
	 */
	// 中国学术期刊全文数据库（China Academic Journal Full-text Database, AKA CAJD, CJZK）
	CJFD: 'journalArticle',
	CJFQ: 'journalArticle',
	// 中国预出版期刊全文数据库（China Advance Publish Journal Full-text Database）
	CAPJ: 'journalArticle',
	// 外文学术期刊数据库（Wai Wen Journal Database）
	WWJD: 'journalArticle',
	// 特色期刊 journal
	CJFN: 'journalArticle',
	// 中国学术辑刊全文数据库（China Collected Journal Database）
	CCJD: 'journalArticle',

	/* thesis */
	// 中国博硕士学位论文全文数据库（China Doctoral Dissertations and Master’s Theses Full-text Database）
	CDMD: 'thesis',
	// 中国博士学位论文全文数据库（China Doctoral Dissertations Full-text Database）
	CDFD: 'thesis',
	// 中国优秀硕士学位论文全文数据库（China Master’s Theses Full-text Database）
	CMFD: 'thesis',
	// 中国重要报纸全文数据库（China Core Newspapers Full-text Database）
	CCND: 'newspaperArticle',

	/* patent */
	// 境内外专利全文数据库（China & Outbound Patent Full-text Database）
	SCOD: 'patent',
	// 中国专利全文数据库（China Patent Full-text Database）
	SCPD: 'patent',
	// 境外专利全文数据库（Outbound Patent Full-text Database）
	SOPD: 'patent',
	// 中国年鉴全文数据库（China Yearbook Full-text Database）
	CYFD: 'bookSection',

	/* conference paper */
	// 国际及国内会议论文全文数据库（Cina & International Important Proceeding Full-text Database）
	CIPD: 'conferencePaper',
	// 中国会议论文全文数据库（Cina Proceeding Full-text Database）
	CPFD: 'conferencePaper',
	// 国际会议论文全文数据库（International Proceeding Full-text Database）
	IPFD: 'conferencePaper',
	// 国外会议全文数据库（Wai Wen Proceeding Full-text Database）
	WWPD: 'conferencePaper',
	// 会议视频（China Proceeding Video Database）
	CPVD: 'conferencePaper',
	// 视频（China Conference Video Database）
	CCVD: 'videoRecording',

	/* book */
	// Book Datab 总库
	BDZK: 'book',
	// 中文图书 book, zh
	WBFD: 'book',
	// 外文图书数据库（wai wen Book Database）
	WWBD: 'book',

	/* Standard */
	// 标准数据总库（Cina & International Stand Database）
	CISD: 'standard',
	// 中国标准全文数据库（China Standard Full-text Database）
	SCSF: 'standard',
	// 中国行业标准全文数据库（China Hang Ye Standard Full-text Database）
	SCHF: 'standard',
	// 中国标准题录数据库（China Standard Full-text Database）
	SCSD: 'standard',
	// 国外标准全文数据库（Outbound Standard Full-text Database）
	SOSD: 'standard',

	/* report */
	// 中国科技项目创新成果鉴定意见数据库（National Science and Technology Project Innovation Achievement Appraisal Opinion Database）
	SNAD: 'report',
	// 科技报告（Chinese pinyin "Ke Ji Bao Gao", means "Science & Technology Report"）
	KJBG: 'report',

	/* statute */
	// 中国政报公报期刊文献总库
	// GWKT: 'statute',
	// 中国法律知识总库（Cina Law Knowledge Database）
	// CLKD: 'statute',

	/* Rare dbcode migrations from previous code or from user-reported cases. */
	CJZK: 'journalArticle',
	// legacy, see sample on https://www.52pojie.cn/thread-1231722-1-1.html
	SJES: 'journalArticle',
	SJPD: 'journalArticle',
	SSJD: 'journalArticle'
};

// A list of databases containing only English literature for language determination.
// It may be modified when this Translator called by other translators.
var enDatabase = ['WWJD', 'IPFD', 'WWPD', 'WWBD', 'SOSD'];

// A list of databases that look like CNKI Scholar.
// It may be modified when this Translator called by other translators.
var scholarLike = ['WWJD', 'WWBD'];

/**
 * A series of identifiers for item, used to request data from APIs.
 */
class ID {
	constructor(doc, url) {
		let frame = {
			dbname: {
				selector: 'input#paramdbname',
				pattern: /[?&](?:db|table)[nN]ame=([^&#/]*)/i
			},
			filename: {
				selector: 'input#paramfilename',
				pattern: /[?&]filename=([^&#/]*)/i
			},
			dbcode: {
				selector: 'input#paramdbcode',
				pattern: /[?&]dbcode=([^&#/]*)/i
			}
		};
		for (const key in frame) {
			this[key] = attr(doc, frame[key].selector, 'value')
				|| tryMatch(url, frame[key].pattern, 1);
		}
		this.dbcode = this.dbcode || this.dbname.substring(0, 4).toUpperCase();
		this.url = url;
	}

	/**
	 * @returns true when both necessary dbcode and filename are available.
	 */
	toBoolean() {
		return Boolean(this.dbname && this.filename);
	}

	toItemtype() {
		return exports.typeMap[this.dbcode];
	}

	toLanguage() {
		// zh database code: CJFQ,CDFD,CMFD,CPFD,IPFD,CPVD,CCND,WBFD,SCSF,SCHF,SCSD,SNAD,CCJD,CJFN,CCVD
		// en database code: WWJD,IPFD,WWPD,WWBD,SOSD
		return exports.enDatabase.includes(this.dbcode)
			? 'en-US'
			: 'zh-CN';
	}
}

function detectWeb(doc, url) {
	let ids = new ID(doc, url);
	Z.debug('detect ids:');
	Z.debug(ids);
	const multiplePattern = [

		/*
		search
		https://kns.cnki.net/kns/search?dbcode=SCDB
		https://kns.cnki.net/kns8s/
		 */
		/kns8?s?\/search\??/i,

		/* https://kns.cnki.net/kns8s/defaultresult/index?korder=&kw= */
		/kns8?s?\/defaultresult\/index/i,

		/*
		advanced search
		old version: https://kns.cnki.net/kns/advsearch?dbcode=SCDB
		new version: https://kns.cnki.net/kns8s/AdvSearch?classid=WD0FTY92
		 */
		/KNS8?s?\/AdvSearch\?/i,

		/*
		navigation page
		https://navi.cnki.net/knavi/journals/ZGSK/detail?uniplatform=NZKPT
		 */
		/\/KNavi\//i
	];
	// #ModuleSearchResult for commom CNKI,
	// #contentPanel for journal/yearbook navigation,
	// .main_sh for old version
	let searchResult = doc.querySelector('#ModuleSearchResult, #contentPanel, .main_sh');
	if (searchResult) {
		Z.monitorDOMChanges(searchResult, { childList: true, subtree: true });
	}
	if (ids.toBoolean()) {
		// Sometimes dbcode is not a known type, and the itmType cannot be determined by dbcode.
		// But the itemType does not affect the api request, and we can get its real item type later,
		// so it appears temporarily as a journal article.
		return ids.toItemtype() || 'journalArticle';
	}
	else if (multiplePattern.some(element => element.test(url)) && getSearchResults(doc, url, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, url, checkOnly) {
	var items = {};
	var found = false;
	let multiplePage = [

		/*
		journal navigation
		https://navi.cnki.net/knavi/journals/ZGSK/detail?uniplatform=NZKPT
		 */
		{
			isMatch: /\/journals\/.+\/detail/i.test(url),
			// 过刊浏览，栏目浏览
			row: '#rightCatalog dd, .searchresult-list tbody > tr',
			a: '.name > a',
			cite: 'td[align="center"]:nth-last-child(2)',
			download: 'td[align="center"]:last-child'
		},

		/*
		thesis navigation
		https://navi.cnki.net/knavi/degreeunits/GBEJU/detail?uniplatform=NZKPT
		 */
		{
			isMatch: /\/degreeunits\/.+\/detail/i.test(url),
			row: '#rightCatalog tbody > tr',
			a: '.name > a',
			cite: 'td[align="center"]:nth-last-child(2)',
			download: 'td[align="center"]:last-child'
		},

		/*
		conference navigation
		https://navi.cnki.net/knavi/conferences/030681/proceedings/IKJS202311001/detail?uniplatform=NZKPT
		 */
		{
			isMatch: /\/proceedings\/.+\/detail/i.test(url),
			row: '#rightCatalog tbody > tr',
			a: '.name > a',
			cite: 'td[align="center"]:nth-last-child(2)',
			download: 'td[align="center"]:last-child'
		},

		/*
		newspaper navigation
		https://navi.cnki.net/knavi/newspapers/RMRB/detail?uniplatform=NZKPT
		 */
		{
			isMatch: /\/newspapers\/.+\/detail/i.test(url),
			row: '#rightCatalog tbody > tr',
			a: '.name > a'
		},

		/*
		yearbook navigation
		https://kns.cnki.net/knavi/yearbooks/YHYNJ/detail?uniplatform=NZKPT
		 */
		{
			isMatch: /\/yearbooks\/.+\/detail/i.test(url),
			row: '#rightCatalog .itemNav',
			a: 'a'
		},

		/*
		yearbook search result
		https://kns.cnki.net/kns8s/defaultresult/index?classid=HHCPM1F8&korder=SU&kw=%E7%85%A4%E7%82%AD
		 */
		{
			isMatch: doc.querySelector('.yearbook-title > a'),
			row: 'table.result-table-list tbody tr',
			a: '.yearbook-title > a',
			download: 'td.download'
		},

		/* Search page */
		{
			isMatch: /.*/i.test(url),
			row: 'table.result-table-list tbody tr',
			a: 'td.name a',
			cite: 'td.quote',
			download: 'td.download'
		}
	].find(page => page.isMatch);
	var rows = doc.querySelectorAll(multiplePage.row);
	if (!rows.length) return false;
	for (let i = 0; i < rows.length; i++) {
		let itemKey = {};
		let header = rows[i].querySelector(multiplePage.a);
		if (!header) continue;
		itemKey.url = header.href;
		let title = header.getAttribute('title') || ZU.trimInternal(header.textContent);
		// Z.debug(`${href}\n${title}`);
		if (!itemKey.url || !title) continue;
		if (checkOnly) return true;
		found = true;
		// Identifier used for batch export, the format is different for homeland and oversea versions.
		itemKey.cookieName = attr(rows[i], '[name="CookieName"]', 'value');
		// attachment download link.
		itemKey.downloadlink = attr(rows[i], 'td.operat > a.downloadlink', 'href');
		try {
			// citation counts.
			itemKey.cite = text(rows[i], multiplePage.cite);
			// download counts.
			itemKey.download = text(rows[i], multiplePage.download);
		}
		catch (error) {
			Z.debug('Failed to get CNKIcite or download.');
		}

		/* Use the item key to store some useful information */
		items[JSON.stringify(itemKey)] = `【${i + 1}】${title}`;
		// Z.debug(items);
	}
	return found ? items : false;
}

// Whether user ip is in Chinese Mainland, default is true.
var inMainland = true;

// Platform of CNKI, default to the National Zong Ku Ping Tai(pin yin of "Total Database Platform").
// It may be modified when this Translator called by other translators.
var platform = 'NZKPT';

// Css selectors for CNKI Scholar like page, to change the default behavior of CNKI Scholar translator.
// It may be modified when this Translator called by other translators.
var csSelectors = {
	labels: '.brief h3, .row-scholar',
	title: '.h1-scholar',
	abstractNote: '#ChDivSummary',
	publicationTitle: '.top-tip-scholar > span >a',
	pubInfo: '.top-tip-scholar',
	publisher: '.all-source a',
	DOI: 'no-selector-available',
	creators: '.author-scholar > a',
	tags: '[id*="doc-keyword"] a',
	hightlights: 'no-selector-available',
	bookUrl: 'no-selector-available'
};

async function doWeb(doc, url) {
	// for inside and outside Chinese Mainland IP, CNKI uses different APIs.
	inMainland = !/oversea/i.test(url);
	Z.debug(`inMainland: ${inMainland}`);

	if (detectWeb(doc, url) == 'multiple') {
		let items = await Z.selectItems(getSearchResults(doc, url, false));
		if (!items) return;
		await scrapeMulti(items, doc);
	}
	else {
		await scrape(doc);
	}
}

/**
 * For multiple items, prioritize trying to scrape them one by one, as documents always provide more information;
 * if it is not possible to obtain item's document, consider using batch export API.
 * @param {Object} items, items from Zotero.selectedItems().
 */
async function scrapeMulti(items, doc) {
	for (let key in items) {
		let itemKey = JSON.parse(key);
		try {
			// During debugging, may manually throw an error to guide the program to run inward
			// throw new Error('debug');
			let doc = await requestDocument(itemKey.url);
			// CAPTCHA
			if (doc.querySelector('#verify_pic')) {
				doc = await requestDocument(`https://kns.cnki.net/kcms2/newLink?${tryMatch(itemKey.url, /v=[^&/]+/)}`);
			}
			await scrape(doc, itemKey);
		}
		catch (erro1) {
			Z.debug('Error encountered while scraping one by one:');
			Z.debug(erro1);
			try {
				if (!Object.keys(items).some(itemKey => JSON.parse(itemKey).cookieName)) {
					throw new Error('This page is not suitable for using batch export API');
				}
				let itemKeys = Object.keys(items)
					.map(element => JSON.parse(element))
					.filter(element => element.cookieName);
				await scrapeWithShowExport(itemKeys, doc);
				// batch export API can request all data at once.
				break;
			}

			/*
			Some older versions of CNKI may not support retrieving CookieName from search pages.
			In these cases, CAPTCHA issue should be handled by the user.
			*/
			catch (erro2) {
				Z.debug(erro2);
				const debugItem = new Z.Item('webpage');
				debugItem.title = `❌验证码错误！（CAPTCHA Erro!）❌`;
				debugItem.url = itemKey.url;
				debugItem.abstractNote
					= '原始条目在批量抓取过程中遇到验证码，这通常是您向知网请求过于频繁导致的。原始条目的链接已经保存到本条目中，请考虑随后打开这个链接并重新抓取。\n'
					+ 'Encountered CAPTCHA during batch scrape process with original item, which is usually caused by your frequent requests to CNKI. The link to original item has been saved to this entry. Please consider opening this link later and re scrap.';
				debugItem.complete();
				continue;
			}
		}
	}
}

async function scrape(doc, itemKey = { url: '', cite: '', cookieName: '', downloadlink: '' }) {
	let url = doc.location.href;
	let ids = new ID(doc, url);
	Z.debug('scrape single item with ids:');
	Z.debug(ids);
	if (exports.scholarLike.includes(ids.dbcode)) {
		let translator = Zotero.loadTranslator('web');
		// CNKI Scholar
		translator.setTranslator('b9b97a32-a8aa-4688-bd81-491bec21b1de');
		translator.setDocument(doc);
		translator.setHandler('itemDone', (_obj, item) => {
			item.attachments.push({
				title: 'Snapshot',
				document: doc
			});
			item.complete();
		});
		let cs = await translator.getTranslatorObject();
		cs.selectors = exports.csSelectors;
		cs.typeKey = text(doc, '.top-tip-scholar > span:first-child');
		await cs.scrape(doc, url);
	}
	else if (ids.toItemtype() == 'videoRecording' || /^https:\/\/oversea\.cnki\.net/i.test(url)) {
		await scrapeDoc(doc, itemKey);
	}
	else if (url.includes('thinker.cnki')) {
		let translator = Zotero.loadTranslator('web');
		// CNKI thinker
		translator.setTranslator('5393921c-d543-4b3a-a874-070b5d73b03a');
		translator.setDocument(doc);
		translator.setHandler('itemDone', (_obj, item) => {
			item.complete();
		});
		await translator.translate();
	}
	else {
		try {
			// During debugging, may manually throw an error to guide the program to run inward
			// throw new Error('debug');
			await scrapeWithGetExport(doc, ids, itemKey);
		}
		catch (error1) {
			Z.debug('An error was encountered while using GetExport API:');
			Z.debug(error1);
			try {
				// During debugging, may manually throw an error to guide the program to run inward
				// throw new Error('debug');
				itemKey.cookieName = `${ids.dbname}!${ids.filename}!1!0`;
				await scrapeWithShowExport([itemKey], doc);
			}
			catch (error2) {
				Z.debug('An error was encountered while using ShowExport API:');
				Z.debug(error2);
				await scrapeDoc(doc, itemKey);
			}
		}
	}
}

/**
 * API from the "cite" button of the page.
 * @param {Element} doc
 * @param {ID} ids
 * @param {*} itemKey some extra information from "multiple" page.
 */
async function scrapeWithGetExport(doc, ids, itemKey) {
	Z.debug('use API: GetExport');

	/*
	To avoid triggering anti crawlers due to frequent requests,
	uncomment the object below during debugging to test functionality unrelated to requests.
	*/

	/*
	referText = {
		"code": 1,
		"msg": "返回成功",
		"data": [
		  {
			"key": "GB/T 7714-2015 格式引文",
			"value": [
			  "[1]陶金, 健康教育与新闻出版  表彰全国九亿农民健康教育行动先进集体和先进工作者. 刘新明;刘益清,中国卫生年鉴,人民卫生出版社,2001,241-242,CHKD年鉴网络出版总库."
			]
		  },
		  {
			"key": "知网研学（原E-Study）",
			"value": [
			  "DataType: 6<br>Title-题名: 健康教育与新闻出版  表彰全国九亿农民健康教育行动先进集体和先进工作者<br>Author-作者: 陶金<br>Source-文献来源: 中国卫生年鉴<br>Year-年鉴年份: 2001<br>PubTime-发表时间: 2001<br>Keyword-关键词: 表彰全国九亿农民健康教育行动先进集体和先进工作者<br>PageCount-页数: 2<br>Page-页码: 241-242<br>SrcDatabase-来源库: CHKD年鉴网络出版总库<br>Organ-出版者: 人民卫生出版社<br>Link-链接: https://kns.cnki.net/kcms2/detail?v=78ssZZiIu9aYur8TjixANLNB9wqzRDceLXMJjuCqyfxhh98oa9YMgKbWALMGlEL83g_zUCRcmBFFnNyzNcG9yhXWKxGVtFw64_2ieV3_sOq5RgLe_KKZfbU1nPWPoWK-2Xadr4yeP1U=&uniplatform=CHKD&language=CHS<br>"
			]
		  },
		  {
			"key": "EndNote",
			"value": [
			  "%0 Legal Rule or Regulation<br>%T 健康教育与新闻出版  表彰全国九亿农民健康教育行动先进集体和先进工作者<br>%V 7-117-04544-2<br>%K 表彰全国九亿农民健康教育行动先进集体和先进工作者<br>%~ CHKD年鉴网络出版总库<br>%P 241-242<br>%W CNKI<br>"
			]
		  }
		],
		"traceid": "a28ac92deccf46de8e2d1c7fc1b3d2cd.248.17074012330576441"
	  }
	*/

	// During debugging, may manually throw an error to guide the program to run inward.
	// throw new Error('debug');

	// e.g. https://ras.cdutcm.lib4s.com:7080/s/net/cnki/kns/G.https/dm/API/GetExport?uniplatform=NZKPT
	let postUrl = inMainland
		? `https://kns.cnki.net/dm/API/GetExport?uniplatform=${exports.platform}`
		: `${doc.querySelector('.logo > a, a.cnki-logo').href}/kns8/manage/APIGetExport`;
	// "1": row's sequence in search result page, defualt 1; "0": index of page in search result pages, defualt 0.
	let postData = `filename=${ids.dbname}!${ids.filename}!${ids.toItemtype() == 'bookSection' ? 'ALMANAC_LM' : '1!0'}`
		+ `${inMainland ? `&uniplatform=${exports.platform}` : ''}`
		// Although there are two data formats that are redundant,
		// it can make the request more "ordinary" to server.
		+ '&displaymode=GBTREFER%2Celearning%2CEndNote';
	Z.debug(postUrl);
	Z.debug(postData);
	let referText = await requestJSON(
		postUrl,
		{
			method: 'POST',
			body: postData,
			headers: {
				Referer: ids.url
			}
		}
	);
	Z.debug('get respond from API GetExport:');
	Z.debug(referText);

	if (!referText.data || !referText.data.length) {
		throw new ReferenceError(`Failed to retrieve data from API: GetExport\n${JSON.stringify(ids)}\n${JSON.stringify(referText)}`);
	}
	referText = referText.data[2].value[0].replace(/<br>/g, '\n');
	Z.debug(referText);
	await parseRefer(referText, doc, ids.url, itemKey);
}

/**
 * API from buulk-export button.
 * @param {*} itemKey some extra information from "multiple" page.
 */
async function scrapeWithShowExport(itemKeys, doc) {
	Z.debug('use API: showExport');

	/*
	To avoid triggering anti crawlers due to frequent requests,
	uncomment the expression below during debugging to test functionality unrelated to requests.
	*/

	/*
	let referText = {
		status: 200,
		headers: {
			connection: "close",
			"content-encoding": "br",
			"content-type": "text/plain;charset=utf-8",
			date: "Sun,03 Dec 2023 14: 56: 40 GMT",
			"transfer-encoding": "chunked"
		},
		body: "<ul class='literature-list'><li> %0 Journal Article<br> %A 贾玲 <br> %+ 晋中市太谷区北洸乡人民政府;<br> %T 抗旱转基因小麦的研究进展<br> %J 种子科技<br> %D 2023<br> %V 41<br>%N 17<br> %K 小麦;抗旱;转基因<br> %X 受气候复杂多变的影响，小麦生长期间干旱胁迫成为影响其产量的主要因素之一，利用基因工程技术提高小麦抗旱性非常必要。目前，已鉴定出一部分与小麦抗旱性相关并可以提高产量的基因，但与水稻、玉米和其他粮食作物相比，对抗旱转基因小麦的开发研究较少。文章重点关注小麦耐旱性的评价标准以及转基因小麦品种在提高抗旱性方面的进展，讨论了当前在转基因小麦方面取得的一些成就和发展中存在的问题，以期为小麦抗旱性基因工程育种提供理论依据。<br>%P 11-14<br> %@ 1005-2690<br> %U https: //link.cnki.net/doi/10.19904/j.cnki.cn14-1160/s.2023.17.004<br> %R 10.19904/j.cnki.cn14-1160/s.2023.17.004<br> %W CNKI<br> </li><li> %0 Journal Article<br> %A 刘志宏<br> %A 田媛<br> %A 陈红娜<br> %A 周志豪<br> %A 郑洁<br> %A 杨晓怀 <br> %+深圳市农业科技促进中心;暨南大学食品科学与工程系;<br> %T 水稻转基因育种的研究进展与应用现状<br> %J 中国种业<br> %D 2023<br> %V <br> %N 09<br> %K 转基因育种;水稻;病虫害;除草剂<br> %X 随着生物技术发展的不断深入，我国水稻种业的发展也面临着全新的机遇和挑战。目前，改善水稻品种质量的主要方法有分子标记技术、基因编辑技术和转基因技术。其中，转基因水稻是利用生物技术手段将外源基因转入到目标水稻的基因组中，通过外源基因的表达，获得具有抗病、抗虫、抗除草剂等优良性状的水稻品种。近年来，国内外在采用转基因技术进行水稻育种，提升水稻产量、改善水稻品质方面具有较多的研究进展。在阐述转基因技术工作原理的基础上，概述国内外利用转基因技术在优质水稻育种方面的研究进展，进一步探究转基因技术在我国水稻育种领域的发展前景。<br>%P 11-17<br> %@ 1671-895X<br> %U https: //link.cnki.net/doi/10.19462/j.cnki.1671-895x.2023.09.038<br> %R10.19462/j.cnki.1671-895x.2023.09.038<br> %W CNKI<br> </li><li> %0 Journal Article<br> %A 孙萌<br> %A 李荣田 <br> %+ 黑龙江大学生命科学学院/黑龙江省普通高等学校分子生物学重点实验室;黑龙江大学农业微生物技术教育部工程研究中心;<br> %T 基于文献计量学的中国水稻转录组研究进展<br> %J 环境工程<br> %D 2023<br> %V 41<br> %N S2<br> %K 水稻转录组;文献计量学;VOSviewer<br> %X 为了探究水稻转录组(Ricetranscriptome)研究的热点与趋势,本研究基于CNKI数据库,基于文献计量学的方法,对中国的发文量、关键词、研究机构、作者、基金、学科方向,进行相关分析。发现水稻转录组的研究进展与趋势动态,旨在为水稻转录组等领域的研究人员提供一定量的数据进行参考。结果显示:2003—2021年水稻转录组的研究论文数量共1512篇;文献的数量逐年增加,其中在2020年的产出数量最高;发文量前3的作者分别是刘向东、吴锦文、梁五生;华中农业大学,南京农业大学,浙江大学,中国农业科学院,华南农业大学发表的水稻转录组文献数量居全国前5位;该领域主要研究学科是,农作物、植物保护、园艺、生物学和林业等;国家自然科学基金是支持水稻转录组研究的主要项目。综合来看,中国在研究水稻转录组领域处于优势地位。<br>%P 1016-1019<br> %@ 1000-8942<br> %U https://kns.cnki.net/kcms2/article/abstract?v=ebrKgZyeBkxImzDUXjcVU04XYh7-VuK-twxFNRUx7mIL4CLVOe5VfbRl0TM7H3f_mb78up_-AjT2Rwgo5xU0wbsknYXBxlrO6GG-wlfR5dIIK8MKL8g8Vmc4O-Q3_qdDWz1MlRhZmckhhPAGlFwAFQ==&uniplatform=NZKPT&language=CHS<br>%W CNKI<br> </li></ul><input id='hidMode' type='hidden' value='BATCH_DOWNLOAD,EXPORT,CLIPYBOARD,PRINT'><input id='traceid' type='hidden'value='27077cd0510c4c989a7ac58b5541a910.173062.17016154007783847'>"
	};
	 */

	// During debugging, may manually throw an error to guide the program to run inward
	// throw new Error('debug');

	let postUrl = inMainland
		? 'https://kns.cnki.net/dm8/api/ShowExport'
		: `${doc.location.protocol}//${doc.location.host}/kns/manage/ShowExport`;
	Z.debug(postUrl);
	let postData = `FileName=${itemKeys.map(key => key.cookieName).join(',')}`
		+ '&DisplayMode=EndNote'
		+ '&OrderParam=0'
		+ '&OrderType=desc'
		+ '&SelectField='
		+ `${inMainland ? `&PageIndex=1&PageSize=20&language=CHS&uniplatform=${exports.platform}` : ''}`
		+ `&random=${Math.random()}`;
	Z.debug(postData);
	let refer = inMainland
		? 'https://kns.cnki.net/dm8/manage/export.html?'
		: `${doc.location.protocol}//${doc.location.host}/manage/export.html?displaymode=EndNote`;
	let referText = await request(
		postUrl,
		{
			method: 'POST',
			body: postData,
			headers: {
				Referer: refer
			}
		}
	);
	Z.debug('get batch response from API ShowExport:');
	Z.debug(`${JSON.stringify(referText)}`);
	if (!referText.body || !referText.body.length) {
		throw new ReferenceError('Failed to retrieve data from API: ShowExport');
	}
	referText = referText.body
		// prefix
		.replace(/^<ul class='literature-list'>/, '')
		// suffix
		.replace(/<\/ul><input.*>$/, '')
		.match(/<li>.*?<\/li>/g);

	for (let i = 0; i < referText.length; i++) {
		let text = referText[i];
		text = text.replace(/(^<li>\s*|\s*<\/li>$)/g, '').replace(/<br>/g, '\n');
		Z.debug(text);
		await parseRefer(
			text,
			doc,
			itemKeys[i].url,
			itemKeys[i]);
	}
}

/**
 * Alternative offline scrapping scheme.
 * @param {Element} doc
 * @param {*} itemKey some extra information from "multiple" page.
 */
async function scrapeDoc(doc, itemKey) {
	Z.debug('scraping from document...');

	let url = doc.location.href;
	let ids = new ID(doc, url);
	let more = doc.querySelector('#ChDivSummaryMore');
	if (more && /更多|More/.test(more.textContent)) {
		let observer = new MutationObserver(() => {
			observer.disconnect();
		});
		observer.observe(doc.body, { childList: true, subtree: true });
		more.click();
	}
	var newItem = new Zotero.Item(ids.toItemtype());
	let labels = new LabelsX(doc, 'div.doc div[class^="row"], li.top-space, .total-inform > span');
	let extra = new Extra();
	Z.debug(labels.innerData.map(element => [element[0], ZU.trimInternal(element[1].textContent)]));

	richTextTitle(newItem, doc);
	newItem.abstractNote = labels.getWith(['摘要', 'Abstract']).replace(/\s*(更多还原|Reset)$/, '');

	let doi = labels.getWith('DOI');
	if (ZU.fieldIsValidForType('DOI', newItem.itemType)) {
		newItem.DOI = doi;
	}
	else {
		extra.set('DOI', doi, true);
	}

	/* URL */
	if (!newItem.url || !/filename=/i.test(url)) {
		if (doi) {
			newItem.url = 'https://doi.org/' + doi;
		}
		else {
			newItem.url = 'https://kns.cnki.net/KCMS/detail/detail.aspx?'
				+ `dbcode=${ids.dbcode}`
				+ `&dbname=${ids.dbname}`
				+ `&filename=${ids.filename}`;
		}
	}
	newItem.language = ids.toLanguage();

	/* creators */
	let creators = Array.from(doc.querySelectorAll('#authorpart > span > a[href*="/author/"]')).map(element => ZU.trimInternal(element.textContent).replace(/[\d,\s-]+$/, ''));
	if (!creators.length && doc.querySelectorAll('#authorpart > span').length) {
		creators = Array.from(doc.querySelectorAll('#authorpart > span')).map(element => ZU.trimInternal(element.textContent).replace(/[\d\s,;，；~-]*$/, ''));
	}
	if (!creators.length && doc.querySelector('h3 > span:only-child')) {
		creators = ZU.trimInternal(doc.querySelector('h3 > span:only-child').textContent)
			.replace(/\(.+?\)$/, '')
			.replace(/([\u4e00-\u9fff]),\s?([\u4e00-\u9fff])/g, '$1；$2')
			.split(/[;，；]/)
			.filter(string => !(new RegExp([
				'institute',
				'institution',
				'organization',
				'company',
				'corporation',
				'firm',
				'laboratory',
				'lab',
				'co\\.ltd',
				'school',
				'university',
				'college'
			].map(word => `\\b${word}\\b`)
				.join('|'), 'i')
				.test(string)))
			.map(string => string.replace(/[\d\s,~-]*$/, ''));
	}
	creators.forEach((string) => {
		newItem.creators.push(cleanName(string, 'author'));
	});

	/* tags */
	let tags = [
		Array.from(doc.querySelectorAll('.keywords > a')).map(element => ZU.trimInternal(element.textContent).replace(/[，；,;]$/, '')),
		labels.getWith(['关键词', '關鍵詞', 'keywords']).split(/[;，；]\s*/)
	].find(arr => arr.length);
	if (tags) newItem.tags = tags;

	/* specific Fields */
	switch (newItem.itemType) {
		case 'journalArticle': {
			let pubInfo = innerText(doc, '.top-tip');
			newItem.publicationTitle = tryMatch(pubInfo, /^(.+?)\./, 1).replace(/\(([\u4e00-\u9fff]*)\)$/, '（$1）');
			newItem.volume = tryMatch(pubInfo, /,\s?0*([1-9]\d*)\(/, 1);
			newItem.issue = tryMatch(pubInfo, /\(([A-Z]?\d*)\)/i, 1).replace(/0*(\d+)/, '$1');
			newItem.pages = labels.getWith(['页码', '頁碼', 'Page$']);
			newItem.date = tryMatch(pubInfo, /\.\s?(\d{4})/, 1);
			break;
		}
		case 'thesis': {
			newItem.university = text(doc, 'h3 >span >  a[href*="/organ/"]').replace(/\(([\u4e00-\u9fff]*)\)$/, '（$1）');
			newItem.thesisType = inMainland
				? {
					CMFD: '硕士学位论文',
					CDFD: '博士学位论文',
					CDMH: '硕士学位论文'
				}[ids.dbcode]
				: {
					CMFD: 'Master thesis',
					CDFD: 'Doctoral dissertation',
					CDMH: 'Master thesis'
				}[ids.dbcode];
			let pubInfo = labels.getWith('出版信息');
			newItem.date = ZU.strToISO(pubInfo);
			newItem.numPages = labels.getWith(['页数', '頁數', 'Page']);
			labels.getWith(['导师', '導師', 'Tutor']).split(/[;，；]\s*/).forEach((supervisor) => {
				newItem.creators.push(cleanName(ZU.trimInternal(supervisor), 'contributor'));
			});
			extra.set('major', labels.getWith(['学科专业', '學科專業', 'Retraction']));
			break;
		}
		case 'conferencePaper': {
			newItem.abstractNote = labels.getWith(['摘要', 'Abstract']).replace(/^[〈⟨<＜]正[＞>⟩〉]/, '');
			newItem.date = ZU.strToISO(labels.getWith(['会议时间', '會議時間', 'ConferenceTime']));
			newItem.proceedingsTitle = attr(doc, '.top-tip > span:first-child', 'title');
			newItem.conferenceName = labels.getWith(['会议名称', '會議名稱', 'ConferenceName']);
			newItem.place = labels.getWith(['会议地点', '會議地點', 'ConferencePlace']);
			newItem.pages = labels.getWith(['页码', '頁碼', 'Page$']);
			break;
		}
		case 'newspaperArticle':
			newItem.abstractNote = text(doc, '.abstract-text');
			newItem.publicationTitle = text(doc, '.top-tip > a');
			newItem.date = ZU.strToISO(labels.getWith(['报纸日期', '報紙日期', 'NewspaperDate']));
			newItem.pages = labels.getWith(['版号', '版號', 'EditionCode']);
			break;
		case 'bookSection':
			newItem.bookTitle = text(doc, '.book-info .book-tit');
			newItem.date = tryMatch(labels.getWith(['来源年鉴', 'SourceYearbook']), /\d{4}/);
			newItem.pages = labels.getWith(['页码', '頁碼', 'Page$']);
			newItem.creators = labels.getWith(['责任说明', '責任說明', 'Statementofresponsibility'])
				.replace(/\s*([主]?编|Editor)$/, '')
				.split(/[,;，；]/)
				.map(creator => cleanName(creator, 'author'));
			break;
		case 'report':
			newItem.abstractNote = labels.getWith(['成果简介', '成果簡介']);
			newItem.creators = labels.getWith('成果完成人').split(/[,;，；]/).map(creator => cleanName(creator, 'author'));
			newItem.date = labels.getWith(['入库时间', '入庫時間']);
			newItem.institution = labels.getWith(['第一完成单位', '第一完成單位']);
			extra.set('achievementType', labels.getWith(['成果类别', '成果類別']));
			extra.set('level', labels.getWith('成果水平'));
			extra.set('evaluation', labels.getWith(['评价形式', '評價形式']));
			break;
		case 'standard':
			newItem.number = labels.getWith(['标准号', '標準號', 'StandardNo']);
			if (newItem.number.startsWith('GB')) {
				newItem.number = newItem.number.replace('-', '——');
				newItem.title = newItem.title.replace(/([\u4e00-\u9fff]) ([\u4e00-\u9fff])/, '$1　$2');
			}
			newItem.status = text(doc, 'h1 > .type');
			newItem.date = labels.getWith(['发布日期', '發佈日期', 'IssuanceDate']);
			newItem.numPages = labels.getWith(['总页数', '總頁數', 'TotalPages']);
			extra.set('original-title', text(doc, 'h1 > span'));
			newItem.creators = labels.getWith(['标准技术委员会', '归口单位', '技術標準委員會', '歸口單位', 'StandardTechnicalCommittee'])
				.split(/[;，；、]/)
				.map(creator => ({
					firstName: '',
					lastName: creator.replace(/\(.+?\)$/, ''),
					creatorType: 'author',
					fieldMode: 1
				}));
			extra.set('applyDate', labels.getWith(['实施日期', '實施日期']), true);
			break;
		case 'patent':
			newItem.patentNumber = labels.getWith(['申请公布号', '申請公佈號', 'PublicationNo']);
			newItem.applicationNumber = labels.getWith(['申请\\(专利\\)号', '申請\\(專利\\)號', 'ApplicationNumber']);
			newItem.place = newItem.country = patentCountry(newItem.patentNumber || newItem.applicationNumber);
			newItem.filingDate = labels.getWith(['申请日', '申請日', 'ApplicationDate']);
			newItem.issueDate = labels.getWith(['授权公告日', '授權公告日', 'IssuanceDate']);
			newItem.rights = text(doc, '.claim > h5 + div');
			extra.set('Genre', labels.getWith(['专利类型', '專利類型']), true);
			labels.getWith(['发明人', '發明人', 'Inventor'])
				.split(/[;，；]\s*/)
				.forEach((inventor) => {
					newItem.creators.push(cleanName(ZU.trimInternal(inventor), 'inventor'));
				});
			break;
		case 'videoRecording':
			newItem.abstractNote = labels.getWith(['视频简介', '視頻簡介']).replace(/\s*更多还原$/, '');
			newItem.runningTime = labels.getWith(['时长', '時長']);
			newItem.date = ZU.strToISO(labels.getWith(['发布时间', '發佈時間']));
			extra.set('organizer', labels.getWith(['主办单位', '主辦單位']), true);
			doc.querySelectorAll('h3:first-of-type > span').forEach((element) => {
				newItem.creators.push(cleanName(ZU.trimInternal(element.textContent), 'author'));
			});
			break;
	}

	/* pages */
	if (ZU.fieldIsValidForType('pages', newItem.itemType) && newItem.pages) {
		newItem.pages = newItem.pages
			.replace(/\d+/g, match => match.replace(/0*([1-9]\d*)/, '$1'))
			.replace(/~/g, '-').replace(/\+/g, ', ');
	}

	/* date, advance online */
	if (doc.querySelector('.icon-shoufa')) {
		extra.set('Status', 'advance online publication');
		newItem.date = ZU.strToISO(text(doc, '.head-time'));
	}

	/* extra */
	extra.set('foundation', labels.getWith('基金'));
	extra.set('download', labels.getWith(['下载', '下載', 'Download']) || itemKey.download);
	extra.set('album', labels.getWith(['专辑', '專輯', 'Series']));
	extra.set('CLC', labels.getWith(['分类号', '分類號', 'ClassificationCode']));
	extra.set('CNKICite', itemKey.cite || attr(doc, '#paramcitingtimes', 'value') || text(doc, '#citations+span').substring(1, -1));
	extra.set('dbcode', ids.dbcode);
	extra.set('dbname', ids.dbname);
	extra.set('filename', ids.filename);
	await addPubDetail(newItem, extra, ids, doc);
	newItem.extra = extra.toString();
	addAttachments(newItem, doc, url, itemKey);
	newItem.complete();
}

/**
 * Call CNKI Refer.js to parse the text returned by API and supplement some fields from doc elements and itemKey.
 * @param {String} referText Refer/BibIX format text from API.
 * @param {Element} doc
 * @param {String} url
 * @param {*} itemKey
 */
async function parseRefer(referText, doc, url, itemKey) {
	let item = {};

	let labels = new LabelsX(doc, 'div.doc div[class^="row"], li.top-space, .total-inform > span');
	Z.debug('get labels:');
	Z.debug(labels.innerData.map(element => [element[0], ZU.trimInternal(element[1].textContent)]));
	let extra = new Extra();
	let ids = new ID(doc, url);
	let translator = Zotero.loadTranslator('import');
	// CNKI Refer
	translator.setTranslator('7b6b135a-ed39-4d90-8e38-65516671c5bc');
	translator.setString(referText.replace(/<br>/g, '\n'));
	translator.setHandler('itemDone', (_obj, patchItem) => {
		item = patchItem;
	});
	await translator.translate();

	/* title */
	richTextTitle(item, doc);

	/* url */
	if (!item.url || !/filename=/i.test(item.url)) {
		item.url = 'https://kns.cnki.net/KCMS/detail/detail.aspx?'
			+ `dbcode=${ids.dbcode}`
			+ `&dbname=${ids.dbname}`
			+ `&filename=${ids.filename}`;
	}

	/* specific fields */
	switch (item.itemType) {
		case 'journalArticle':
			if (doc.querySelector('.icon-shoufa')) {
				extra.set('Status', 'advance online publication');
				item.date = ZU.strToISO(text(doc, '.head-time'));
			}
			break;
		case 'thesis':
			item.numPages = labels.getWith(['页数', '頁數', 'Page']);
			extra.set('major', labels.getWith(['学科专业', '學科專業', 'Retraction']));
			break;
		case 'conferencePaper': {
			item.proceedingsTitle = attr(doc, '.top-tip > span:first-child', 'title');
			break;
		}
		case 'newspaperArticle':
			item.abstractNote = text(doc, '.abstract-text');
			item.tags = labels.getWith(['关键词', '關鍵詞', 'keywords']).split(/[;，；]\s*/);
			break;

		/* yearbook */
		case 'bookSection': {
			item.bookTitle = text(doc, '.book-tit');
			item.creators = labels.getWith(['责任说明', '責任說明', 'Statementofresponsibility'])
				.replace(/\s*([主]?编|Editor)$/, '')
				.split(/[,;，；]/)
				.map(creator => cleanName(creator, 'author'));
			break;
		}
		case 'report':
			item.creators = labels.getWith('成果完成人').split(/[,;，；]/).map(creator => cleanName(creator, 'author'));
			item.date = labels.getWith(['入库时间', '入庫時間']);
			item.institution = labels.getWith(['第一完成单位', '第一完成單位']);
			extra.set('achievementType', labels.getWith(['成果类别', '成果類別']));
			extra.set('level', labels.getWith('成果水平'));
			extra.set('evaluation', labels.getWith(['评价形式', '評價形式']));
			break;
		case 'standard':
			extra.set('original-title', text(doc, 'h1 > span'));
			item.status = text(doc, '.type');
			item.creators = labels.getWith(['标准技术委员会', '归口单位', '技術標準委員會', '歸口單位', 'StandardTechnicalCommittee'])
				.split(/[;，；、]/)
				.map(creator => ({
					firstName: '',
					lastName: creator.replace(/\(.+?\)$/, ''),
					creatorType: 'author',
					fieldMode: 1
				}));
			extra.set('applyDate', labels.getWith(['实施日期', '實施日期']), true);
			break;
		case 'patent':
			// item.place = labels.getWith('地址');
			item.filingDate = labels.getWith(['申请日', '申請日', 'ApplicationDate']);
			item.applicationNumber = labels.getWith(['申请\\(专利\\)号', '申請\\(專利\\)號', 'ApplicationNumber']);
			item.issueDate = labels.getWith(['授权公告日', '授權公告日', 'IssuanceDate']);
			item.rights = text(doc, '.claim > h5 + div');
			break;
	}
	item.language = ids.toLanguage();
	extra.set('foundation', labels.getWith('基金'));
	extra.set('download', labels.getWith(['下载', '下載', 'Download']) || itemKey.download);
	extra.set('album', labels.getWith(['专辑', '專輯', 'Series']));
	extra.set('CLC', labels.getWith(['分类号', '分類號', 'ClassificationCode']));
	extra.set('CNKICite', itemKey.cite || attr(doc, '#paramcitingtimes', 'value') || text(doc, '#citations+span').substring(1, -1));
	extra.set('dbcode', ids.dbcode);
	extra.set('dbname', ids.dbname);
	extra.set('filename', ids.filename);
	await addPubDetail(item, extra, ids, doc);
	item.extra = extra.toString(item.extra);
	addAttachments(item, doc, url, itemKey);
	item.complete();
}

/*********
 * utils *
 *********/

class LabelsX {
	constructor(doc, selector) {
		this.innerData = [];
		this.emptyElement = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elementCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elementCopy.removeChild(elementCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elementCopy.childNodes.length > 1) {
					let key = elementCopy.removeChild(elementCopy.firstChild).textContent.replace(/\s/g, '');
					this.innerData.push([key, elementCopy]);
				}
				else {
					let text = ZU.trimInternal(elementCopy.textContent);
					let key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elementCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.innerData.push([key, elementCopy]);
				}
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let results = label
				.map(aLabel => this.getWith(aLabel, element));
			let keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElement
					: '';
		}
		let pattern = new RegExp(label, 'i');
		let keyVal = this.innerData.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElement
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

function richTextTitle(item, doc) {
	let title = doc.querySelector('.wx-tit > h1');
	if (title) {
		title = title.cloneNode(true);
		while (title.querySelector(':not(sup):not(sub):not(i):not(b)')) {
			title.removeChild(title.querySelector(':not(sup):not(sub):not(i):not(b)'));
		}
		item.title = title.innerHTML
			.replace(/<(sup|sub|i|b)[^>]+>/g, '<$1>')
			.replace(/<(sup|sub|i|b)><\/(sup|sub|i|b)>/g, '');
	}
}

function cleanName(string, creatorType) {
	if (!string) return {};
	return /[\u4e00-\u9fff]/.test(string)
		? {
			firstName: '',
			lastName: string.replace(/\s/g, ''),
			creatorType: creatorType,
			fieldMode: 1
		}
		: ZU.cleanAuthor(ZU.capitalizeName(string), creatorType);
}

async function addPubDetail(item, extra, ids, doc) {
	let pubDoc = {};
	try {
		if (!['journalArticle', 'conferencePaper', 'bookSection'].includes(item.itemType)) {
			return;
		}
		switch (item.itemType) {
			case 'journalArticle': {
				let url = inMainland
					? doc.querySelector('.top-tip > :first-child > a').href
					: attr(doc, '.top-tip > :first-child > a', 'onclick').replace(
						/^.+\('(.+?)',\s*'(.+?)'\).*$/,
						doc.querySelector('.logo > a, a.cnki-logo').href + 'KNavi/JournalDetail?pcode=$1&pykm=$2'
					);
				Z.debug(url);
				pubDoc = await requestDocument(url);
				break;
			}
			case 'conferencePaper': {
				let url = '';
				if (inMainland) {
					url = doc.querySelector('.top-tip > :first-child > a').href;
					let id = attr(
						await requestDocument(
							'https://navi.cnki.net/knavi/conferences/proceedings/catalog'
							// “论文集”code
							+ `?lwjcode=${tryMatch(url, /\/proceedings\/(\w+)\//, 1)}`
							// “会议”code
							+ `&hycode=${tryMatch(url, /conferences\/(\w+)\//, 1)}`
							+ `&pIdx=0`
						),
						'li[id]',
						'id'
					);
					url = 'https://navi.cnki.net/knavi/conferences/baseinfo'
						+ `?lwjcode=${id}`
						+ '&pIdx=0';
				}
				else {
					url = attr(doc, '.top-tip > :first-child > a', 'onclick').replace(
						/^.+\('(.+?)',\s*'(.+?)'\).*$/,
						doc.querySelector('.logo > a, a.cnki-logo').href + 'knavi/DpaperDetail/CreateDPaperBaseInfo?pcode=$1&lwjcode=$2&pIdx=0'
					);
				}
				Z.debug(url);
				pubDoc = await requestDocument(url);
				break;
			}
			case 'bookSection': {
				let url = doc.querySelector('.book-info a[href*="/issues/"], .container a[href*="/issues/"]').href;
				Z.debug(url);
				let id = attr(await requestDocument(url), '#hidYearbookBH', 'value');
				Z.debug(id);
				id = attr(
					await requestDocument(
						'https://navi.cnki.net/knavi/yearbookDetail/GetYearbooklYearAndPageList'
						+ `?pcode=${ids.dbcode}`
						+ `&pykm=${tryMatch(url, /\/yearbooks\/(\w+)\//, 1)}&`
						+ 'pageIndex=0'
						+ '&pageSize=10'),
					`#${id}`,
					'value'
				);
				Z.debug(id);
				pubDoc = await requestDocument('https://navi.cnki.net/knavi/yearbookDetail/GetBaseInfo', {
					method: 'POST',
					body: `pcode=${ids.dbcode}&bh=${id}`,
					headers: { Referer: url }
				});
			}
		}
		if (!pubDoc) {
			throw new Error('Failed to obtain publication document.');
		}
		let container = {
			originalContainerTitle: ZU.capitalizeTitle(text(pubDoc, '.infobox > h3 > p')),
			innerData: Array.from(pubDoc.querySelectorAll('.listbox li p'))
				.map(element => [tryMatch(ZU.trimInternal(element.textContent), /^[[【]?[\s\S]+?[】\]:：]/).replace(/\s/g, ''), attr(element, 'span', 'title') || text(element, 'span')])
				.filter(arr => arr[0]),
			getWith: function (label) {
				if (Array.isArray(label)) {
					let result = label
						.map(aLabel => this.getWith(aLabel))
						.find(element => element);
					return result
						? result
						: '';
				}
				let pattern = new RegExp(label, 'i');
				let keyValPair = this.innerData.find(arr => pattern.test(arr[0]));
				return keyValPair
					? ZU.trimInternal(keyValPair[1])
					: '';
			}
		};
		Z.debug('publication details:');
		Z.debug(container);
		extra.set('original-container-title', container.originalContainerTitle, true);
		switch (item.itemType) {
			case 'journalArticle': {
				item.ISSN = container.getWith('ISSN');
				extra.set('publicationTag', Array.from(pubDoc.querySelectorAll('.journalType2 > span')).map(element => ZU.trimInternal(element.textContent)).join(', '));
				extra.set('CIF', text(pubDoc, '#evaluateInfo span:not([title])', 0));
				extra.set('AIF', text(pubDoc, '#evaluateInfo span:not([title])', 1));
				break;
			}
			case 'conferencePaper':
				item.publisher = container.getWith('出版单位');
				item.date = ZU.strToISO(container.getWith(['出版时间', '出版日期', 'PublishingDate']));
				container.getWith(['编者', '編者', 'Editor']).split('、').forEach(creator => item.creators.push({
					firstName: '',
					lastName: creator.replace(/\(.*?\)$/, ''),
					creatorType: 'editor',
					fieldMode: 1
				}));
				// extra.set('organizer', container.getWith('主办单位'), true);
				break;
			case 'bookSection': {
				item.ISBN = container.getWith('ISBN');
				item.date = ZU.strToISO(container.getWith('出版时间'));
				item.publisher = container.getWith('出版者');
			}
		}
	}
	catch (error) {
		Z.debug('Failed to add document details.');
		Z.debug(error);
	}
}

/**
 * Return the country name according to the patent number or patent application number.
 */
function patentCountry(idNumber) {
	return {
		AD: '安道尔', AE: '阿拉伯联合酋长国', AF: '阿富汗', AG: '安提瓜和巴布达', AI: '安圭拉', AL: '阿尔巴尼亚', AM: '亚美尼亚', AN: '菏属安的列斯群岛', AO: '安哥拉', AR: '阿根廷', AT: '奥地利', AU: '澳大利亚', AW: '阿鲁巴', AZ: '阿塞拜疆', BB: '巴巴多斯', BD: '孟加拉国', BE: '比利时', BF: '布莱基纳法索', BG: '保加利亚', BH: '巴林', BI: '布隆迪', BJ: '贝宁', BM: '百慕大', BN: '文莱', BO: '玻利维亚', BR: '巴西', BS: '巴哈马', BT: '不丹', BU: '缅甸', BW: '博茨瓦纳', BY: '白俄罗斯', BZ: '伯利兹', CA: '加拿大', CF: '中非共和国', CG: '刚果', CH: '瑞士', CI: '科特迪瓦', CL: '智利', CM: '喀麦隆', CN: '中国', CO: '哥伦比亚', CR: '哥斯达黎加', CS: '捷克斯洛伐克', CU: '古巴', CV: '怫得角', CY: '塞浦路斯',
		DE: '联邦德国', DJ: '吉布提', DK: '丹麦', DM: '多米尼加岛', DO: '多米尼加共和国', DZ: '阿尔及利亚', EC: '厄瓜多尔', EE: '爱沙尼亚', EG: '埃及', EP: '欧洲专利局', ES: '西班牙', ET: '埃塞俄比亚', FI: '芬兰', FJ: '斐济', FK: '马尔维纳斯群岛', FR: '法国',
		GA: '加蓬', GB: '英国', GD: '格林那达', GE: '格鲁吉亚', GH: '加纳', GI: '直布罗陀', GM: '冈比亚', GN: '几内亚', GQ: '赤道几内亚', GR: '希腊', GT: '危地马拉', GW: '几内亚比绍', GY: '圭亚那', HK: '香港', HN: '洪都拉斯', HR: '克罗地亚', HT: '海地', HU: '匈牙利', HV: '上沃尔特', ID: '印度尼西亚', IE: '爱尔兰', IL: '以色列', IN: '印度', IQ: '伊拉克', IR: '伊朗', IS: '冰岛', IT: '意大利',
		JE: '泽西岛', JM: '牙买加', JO: '约旦', JP: '日本', KE: '肯尼亚', KG: '吉尔吉斯', KH: '柬埔寨', KI: '吉尔伯特群岛', KM: '科摩罗', KN: '圣克里斯托夫岛', KP: '朝鲜', KR: '韩国', KW: '科威特', KY: '开曼群岛', KZ: '哈萨克', LA: '老挝', LB: '黎巴嫩', LC: '圣卢西亚岛', LI: '列支敦士登', LK: '斯里兰卡', LR: '利比里亚', LS: '莱索托', LT: '立陶宛', LU: '卢森堡', LV: '拉脱维亚', LY: '利比亚',
		MA: '摩洛哥', MC: '摩纳哥', MD: '莫尔多瓦', MG: '马达加斯加', ML: '马里', MN: '蒙古', MO: '澳门', MR: '毛里塔尼亚', MS: '蒙特塞拉特岛', MT: '马耳他', MU: '毛里求斯', MV: '马尔代夫', MW: '马拉维', MX: '墨西哥', MY: '马来西亚', MZ: '莫桑比克', NA: '纳米比亚', NE: '尼日尔', NG: '尼日利亚', NH: '新赫布里底', NI: '尼加拉瓜', NL: '荷兰', NO: '挪威', NP: '尼泊尔', NR: '瑙鲁', NZ: '新西兰', OA: '非洲知识产权组织', OM: '阿曼',
		PA: '巴拿马', PC: 'PCT', PE: '秘鲁', PG: '巴布亚新几内亚', PH: '菲律宾', PK: '巴基斯坦', PL: '波兰', PT: '葡萄牙', PY: '巴拉圭', QA: '卡塔尔', RO: '罗马尼亚', RU: '俄罗斯联邦', RW: '卢旺达',
		SA: '沙特阿拉伯', SB: '所罗门群岛', SC: '塞舌尔', SD: '苏丹', SE: '瑞典', SG: '新加坡', SH: '圣赫勒拿岛', SI: '斯洛文尼亚', SL: '塞拉利昂', SM: '圣马利诺', SN: '塞内加尔', SO: '索马里', SR: '苏里南', ST: '圣多美和普林西比岛', SU: '苏联', SV: '萨尔瓦多', SY: '叙利亚', SZ: '斯威士兰', TD: '乍得', TG: '多哥', TH: '泰国', TJ: '塔吉克', TM: '土库曼', TN: '突尼斯', TO: '汤加', TR: '土耳其', TT: '特立尼达和多巴哥', TV: '图瓦卢', TZ: '坦桑尼亚', UA: '乌克兰', UG: '乌干达', US: '美国', UY: '乌拉圭', UZ: '乌兹别克',
		VA: '梵蒂冈', VC: '圣文森特岛和格林纳达', VE: '委内瑞拉', VG: '维尔京群岛', VN: '越南', VU: '瓦努阿图', WO: '世界知识产权组织', WS: '萨摩亚', YD: '民主也门', YE: '也门', YU: '南斯拉夫', ZA: '南非', ZM: '赞比亚', ZR: '扎伊尔', ZW: '津巴布韦'
	}[idNumber.substring(0, 2).toUpperCase()] || '';
}

/** add pdf or caj to attachments, default is pdf */
function addAttachments(item, doc, url, itemKey) {
	// If you want CAJ instead of PDF, set keepPDF = false
	// 如果你想将PDF文件替换为CAJ文件，将下面一行 keepPDF 设为 false
	let keepPDF = Z.getHiddenPref('CNKIPDF');
	if (keepPDF === undefined) keepPDF = true;
	if (/KX?Reader/.test(url)) {
		item.attachments.push({
			title: 'Snapshot',
			document: doc
		});
	}
	else {
		// The legal status of patent is shown in the picture on webpage.
		if (item.itemType == 'patent') {
			item.attachments.push({
				title: 'Snapshot',
				document: doc
			});
		}
		let pdfLink = strChild(doc, 'a[id^="pdfDown"],.btn-dlpdf > a', 'href');
		Z.debug(`get PDF Link:\n${pdfLink}`);
		let cajLink = strChild(doc, 'a#cajDown', 'href') || itemKey.downloadlink || strChild(doc, 'a[href*="bar/download"]', 'href');
		Z.debug(`get CAJ link:\n${cajLink}`);
		if (keepPDF && pdfLink) {
			item.attachments.push({
				title: 'Full Text PDF',
				mimeType: 'application/pdf',
				url: pdfLink
			});
		}
		else if (cajLink) {
			item.attachments.push({
				title: 'Full Text CAJ',
				mimeType: 'application/caj',
				url: cajLink
			});
		}
	}
}

/**
 * For elements specified with selector and index,
 * return the value specified by key.
 * @param {Element} docOrElem
 * @param {String} selector
 * @param {String} key
 * @param {Number} index
 * @returns
 */
function strChild(docOrElem, selector, key, index) {
	let element = index
		? docOrElem.querySelector(selector)
		: docOrElem.querySelectorAll(selector).item(index);
	return (element && element[key])
		? element[key]
		: '';
}


/**
 * Attempts to get the part of the pattern described from the character,
 * and returns an empty string if not match.
 * @param {String} string
 * @param {RegExp} pattern
 * @param {Number} index
 * @returns
 */
function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

var exports = {
	scrape: scrape,
	scrapeMulti: scrapeMulti,
	platform: platform,
	typeMap: typeMap,
	scholarLike: scholarLike,
	csSelectors: csSelectors,
	enDatabase: enDatabase
};

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://chn.oversea.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFD&dbname=CJFDLAST2020&filename=ZGYK202012011&v=%25mmd2BHGGqe3MG%25mmd2FiWsTP5sBgemYG4X5LOYXSuyd0Rs%25mmd2FAl1mzrLs%25mmd2F7KNcFfXQMiFAipAgN",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "多芯片联合分析2型糖尿病发病相关基因及其与阿尔茨海默病的关系",
				"creators": [
					{
						"firstName": "",
						"lastName": "辛宁",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈建康",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈艳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨洁",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020",
				"ISSN": "0258-4646",
				"abstractNote": "目的利用生物信息学方法探索2型糖尿病发病的相关基因,并研究这些基因与阿尔茨海默病的关系。方法基因表达汇编(GEO)数据库下载GSE85192、GSE95849、GSE97760、GSE85426数据集,获得健康人和2型糖尿病患者外周血的差异基因,利用加权基因共表达网络(WGCNA)分析差异基因和临床性状的关系。使用DAVID数据库分析与2型糖尿病有关的差异基因的功能与相关通路,筛选关键蛋白。根据结果将Toll样受体4 (TLR4)作为关键基因,利用基因集富集分析(GSEA)分析GSE97760中与高表达TLR4基因相关的信号通路。通过GSE85426验证TLR4的表达量。结果富集分析显示,差异基因主要参与的生物学过程包括炎症反应、Toll样受体(TLR)信号通路、趋化因子产生的正向调节等。差异基因主要参与的信号通路有嘧啶代谢通路、TLR信号通路等。ILF2、TLR4、POLR2G、MMP9为2型糖尿病的关键基因。GSEA显示,TLR4上调可通过影响嘧啶代谢及TLR信号通路而导致2型糖尿病及阿尔茨海默病的发生。TLR4在阿尔茨海默病外周血中高表达。结论 ILF2、TLR4、POLR2G、MMP9为2型糖尿病发病的关键基因,TLR4基因上调与2型糖尿病、阿尔茨海默病发生有关。",
				"extra": "original-container-title: Journal of China Medical University\ndownload: 400\nalbum: 医药卫生科技\nCLC: R587.2;R749.16\nCNKICite: 3\ndbcode: CJFD\ndbname: CJFDLAST2020\nfilename: zgyk202012011\nCIF: 1.156\nAIF: 0.890",
				"issue": "12",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "1106-1111, 1117",
				"publicationTitle": "中国医科大学学报",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFD&dbname=CJFDLAST2020&filename=zgyk202012011",
				"volume": "49",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "2型糖尿病"
					},
					{
						"tag": "基因芯片"
					},
					{
						"tag": "数据挖掘"
					},
					{
						"tag": "胰岛炎症反应"
					},
					{
						"tag": "阿尔茨海默病"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://tra.oversea.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFD&dbname=CJFD2012&filename=QHXB201211002&uniplatform=OVERSEA&v=mHFRnExWYa4LFz1M_R-EDbznu38HtcptZz-0EYf-ysFH9PFH41FafXUWtfsSr6o7",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "互聯網藥品可信交易環境中主體資質審核備案模式",
				"creators": [
					{
						"firstName": "",
						"lastName": "于瀟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "劉義",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "柴躍廷",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孫宏波",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2012",
				"ISSN": "1000-0054",
				"abstractNote": "經濟全球化和新一輪產業升級為電子商務服務產業發展帶來了新的機遇和挑戰。無法全程、及時、有效監管電子商務市場的主體及其相關行為是電子商務發展過程中面臨的主要問題。尤其對于互聯網藥品市場,電子商務主體資質的審核備案是營造電子商務可信交易環境的一項重要工作。該文通過系統網絡結構分析的方法描述了公共審核備案服務模式和分立審核備案模式的基本原理;建立了兩種模式下的總體交易費用模型,分析了公共模式比分立模式節約總體交易費用的充要條件,以及推廣該公共模式的必要條件。研究發現:市場規模越大、集成成本越小,公共模式越容易推廣。應用案例分析驗證了模型,證實了公共審核備案服務模式節約了總體交易費用的結論。",
				"extra": "original-container-title: Journal of Tsinghua University(Science and Technology)\ndownload: 601\nalbum: 理工C(機電航空交通水利建筑能源); 醫藥衛生科技; 經濟與管理科學\nCLC: R95;F724.6\nCNKICite: 7\ndbcode: CJFD\ndbname: CJFD2012\nfilename: qhxb201211002\nCIF: 3.010\nAIF: 1.884",
				"issue": "11",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "1518-1523",
				"publicationTitle": "清華大學學報（自然科學版）",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFD&dbname=CJFD2012&filename=qhxb201211002",
				"volume": "52",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "互聯網藥品交易"
					},
					{
						"tag": "交易主體"
					},
					{
						"tag": "可信交易環境"
					},
					{
						"tag": "資質審核備案"
					},
					{
						"tag": "電子商務"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://cnki.net/KCMS/detail/detail.aspx?dbcode=CPFD&dbname=CPFDLAST2017&filename=ZGPX201612002005&uniplatform=OVERSEA&v=wsSg9cXy6pQW_7zGbUyb2yxqQmW7T_GRYnF8Oqi5Eh1a2V96_8YUJdYPGMwq80tTlFps8uiX4AU%3d",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "大型铁路运输企业职工教育培训体系的构建与实施——以北京铁路局为例",
				"creators": [
					{
						"firstName": "",
						"lastName": "任娜",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "中国职工教育和职业培训协会秘书处",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2016-12",
				"abstractNote": "北京铁路局是以铁路客货运输为主的特大型国有企业,是全国铁路网的中枢。全局共有职工19.1万人,管内铁路营业里程全长6246公里,其中高速铁路营业里程为1143.3公里。近年来,北京铁路局始终坚持\"主要行车工种做实、高技能人才做精、工班长队伍做强\"工作主线,积极构建并实施由教育培训规范、教育培训组织管理、实训基地及现代化设施、专兼职教育培训师资、",
				"extra": "download: 79\nalbum: (H) Education ＆ Social Sciences\nCLC: G726\nCNKICite: 0\ndbcode: CPFD\ndbname: CPFDLAST2017\nfilename: zgpx201612002005",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "8",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CPFD&dbname=CPFDLAST2017&filename=zgpx201612002005",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "教育培训体系"
					},
					{
						"tag": "教育培训激励"
					},
					{
						"tag": "构建与实施"
					},
					{
						"tag": "职工教育培训"
					},
					{
						"tag": "铁路局"
					},
					{
						"tag": "铁路运输企业"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://oversea.cnki.net/KCMS/detail/detail.aspx?dbcode=CAPJ&dbname=CAPJLAST&filename=OELJ20240407003&uniplatform=OVERSEA&v=pjMKCMsesac_7YFl-57_GL6t6cGkC6jtRhCTJq6xTVo2jgEy4kPExsIaqC-0Ee5S",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Extraction of weak values in the process of retrieving quantum entanglement state",
				"creators": [
					{
						"firstName": "Du",
						"lastName": "Shaojiang",
						"creatorType": "author"
					},
					{
						"firstName": "Feng",
						"lastName": "Hairan",
						"creatorType": "author"
					},
					{
						"firstName": "Zhang",
						"lastName": "Lu",
						"creatorType": "author"
					},
					{
						"firstName": "Yang",
						"lastName": "Lianwu",
						"creatorType": "author"
					},
					{
						"firstName": "Peng",
						"lastName": "Yonggang",
						"creatorType": "author"
					}
				],
				"date": "2024-04-12",
				"ISSN": "1673-1905",
				"abstractNote": "A reversible operation protocol is provided for a weak-measured quantum entanglement state. The evolution of weak values is studied under different parameter conditions. The weak values can be extracted from the entanglement state and the weak-measured quantum entanglement state can be revived to its initial state theoretically by weak measurement and reversibility operation respectively. We demonstrate the reversible operation protocol by taking Bell’s state as an example. The negativity is used to analyze the initial state， the weak-measured state and the reversed state in order to describe the evolution of quantum entanglement degree. Weak values is detected from the quantum entanglement state by weak measurement and the degree of the weak-measured quantum entanglement state can be revived to its initial state through reversible operation. The information of quantum entanglement state would be extracted from weak values detected in the process of the scheme.",
				"extra": "original-container-title: Optoelectronics Letters\nStatus: advance online publication\nalbum: (A) Mathematics/ Physics/ Mechanics/ Astronomy\nCLC: O413\nCNKICite: 0\ndbcode: CJFQ\ndbname: CAPJLAST\nfilename: oelj20240407003\nCIF: 0.330\nAIF: 0.197",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "1-6",
				"publicationTitle": "Optoelectronics Letters",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CAPJLAST&filename=oelj20240407003",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "Extraction of weak values in the process of retrieving quantum entanglement state"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=UeijT_GnegCGVXOQlhOpSPEw2k2ZPKi4acW5KCvfKej0zITknmIIPE8j1janIJ5J1XwS_G_uyb1toYfYhT_f_B6CqzGHxIgAXrC5JOSkWp14jSk5qlF_q37uTUtRjU3X0_ozQi9KABOVUWg1-Ms8horQPm3hjGhDvzaRQKRaDU9z5NK19ZpSJMWvXsL1Ndsw&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "A sustainable strategy for generating highly stable human skin equivalents based on fish collagen",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "Shi Hua",
						"lastName": "Tan"
					},
					{
						"creatorType": "author",
						"firstName": "Shaoqiong",
						"lastName": "Liu"
					},
					{
						"creatorType": "author",
						"firstName": "Swee Hin",
						"lastName": "Teoh"
					},
					{
						"creatorType": "author",
						"firstName": "Carine",
						"lastName": "Bonnard"
					},
					{
						"creatorType": "author",
						"firstName": "David",
						"lastName": "Leavesley"
					},
					{
						"creatorType": "author",
						"firstName": "Kun",
						"lastName": "Liang"
					}
				],
				"date": "2024-04",
				"DOI": "10.1016/j.bioadv.2024.213780",
				"ISSN": "27729508",
				"abstractNote": "Tissue engineered skin equivalents are increasingly recognized as potential alternatives to traditional skin models such as human ex vivo skin or animal skin models. However, most of the currently investigated human skin equivalents (HSEs) are constructed using mammalian collagen which can be expensive and difficult to extract. Fish skin is a waste product produced by fish processing industries and identified as a cost-efficient and sustainable source of type I collagen. In this work, we describ...",
				"journalAbbreviation": "Biomaterials Advances",
				"language": "en-US",
				"libraryCatalog": "DOI.org (Crossref)",
				"pages": "213780",
				"publicationTitle": "Biomaterials Advances",
				"url": "https://linkinghub.elsevier.com/retrieve/pii/S2772950824000232",
				"volume": "158",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "3D skin model"
					},
					{
						"tag": "ATR-FTIR"
					},
					{
						"tag": "BC"
					},
					{
						"tag": "CD"
					},
					{
						"tag": "DSC"
					},
					{
						"tag": "FBC"
					},
					{
						"tag": "FC"
					},
					{
						"tag": "FFC"
					},
					{
						"tag": "H&E"
					},
					{
						"tag": "HDF(s)"
					},
					{
						"tag": "HEK(s)"
					},
					{
						"tag": "HSE(s)"
					},
					{
						"tag": "Human skin equivalent"
					},
					{
						"tag": "Hydrogel scaffold"
					},
					{
						"tag": "IHC"
					},
					{
						"tag": "MTT"
					},
					{
						"tag": "SDS-PAGE"
					},
					{
						"tag": "SEM"
					},
					{
						"tag": "TEER"
					},
					{
						"tag": "Td"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "search",
		"input": {
			"DOI": "10.13374/j.issn2095-9389.2022.11.11.005"
		},
		"items": [
			{
				"itemType": "journalArticle",
				"title": "生物质材料炭化的研究进展及其应用展望",
				"creators": [
					{
						"firstName": "",
						"lastName": "田学坤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王霞",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "苏凯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "欧阳德泽",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "赵振毅",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘新红",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"DOI": "10.13374/j.issn2095-9389.2022.11.11.005",
				"ISSN": "2095-9389",
				"abstractNote": "生物质属于可再生资源，在我国含量丰富，生物质材料炭化后的产物在储能、吸附等领域得到了广泛应用.研究生物质材料的炭化过程，有利于生物质炭的有效利用.总结了生物质材料炭化过程中，生物质的种类和炭化条件（包括炭化温度、预处理等）对炭化产物中碳的结构、形态、性质的影响，期望为生物质炭化产物的有效利用提供理论基础.同时总结了在催化剂作用下，利用生物质材料炭化来制备碳纳米管，并分析了生物质材料中木质素和纤维素等组分对碳纳米管制备的影响.在此基础上，展望了生物质材料在含碳耐火材料中的应用前景，以期为制备低成本和高性能的新型含碳耐火材料提供思路.",
				"extra": "original-container-title: Chinese Journal of Engineering\nfoundation: 国家自然科学基金资助项目（51872266,52172031）；\ndownload: 831\nalbum: 工程科技Ⅰ辑;工程科技Ⅱ辑\nCLC: TB383.1;TQ175.7;TK6\nCNKICite: 0\ndbcode: CJFQ\ndbname: CJFDLAST2023\nfilename: BJKD202312004\npublicationTag: 北大核心, JST, Pж(AJ), EI, CSCD, WJCI\nCIF: 3.295\nAIF: 2.29",
				"issue": "12",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "2026-2036",
				"publicationTitle": "工程科学学报",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFDLAST2023&filename=BJKD202312004",
				"volume": "45",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "含碳耐火材料"
					},
					{
						"tag": "炭化条件"
					},
					{
						"tag": "生物质材料"
					},
					{
						"tag": "生物质炭"
					},
					{
						"tag": "碳纳米管"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "search",
		"input": {
			"DOI": "10.19655/j.cnki.1005-4642.2020.09.009"
		},
		"items": [
			{
				"itemType": "journalArticle",
				"title": "特斯拉阀性能的仿真研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "周润中",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "乔宇杰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张钰翔",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "代珍兵",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020",
				"DOI": "10.19655/j.cnki.1005-4642.2020.09.009",
				"ISSN": "1005-4642",
				"abstractNote": "通过CAD软件建立几何模型,通过COMSOL软件建立数值模型并求解,与实验结果进行对比,并通过数值模拟讨论相关参量对阀门单向流通性的影响.研究结果表明:特斯拉阀门适用于低粘度高密度流体;本文所设计的特斯拉阀门在四阀门情况下dedicatee数能达到3.414;单阀门特斯拉阀的性能相较于多阀门更佳.",
				"extra": "original-container-title: Physics Experimentation\ndownload: 1974\nalbum: 基础科学;工程科技Ⅱ辑\nCLC: TH134\nCNKICite: 13\ndbcode: CJFQ\ndbname: CJFDLAST2020\nfilename: WLSL202009009\npublicationTag: JST\nCIF: 0.755\nAIF: 0.562",
				"issue": "9",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "44-50",
				"publicationTitle": "物理实验",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFDLAST2020&filename=WLSL202009009",
				"volume": "40",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "diodicity数"
					},
					{
						"tag": "数值模拟"
					},
					{
						"tag": "特斯拉阀"
					},
					{
						"tag": "阀门性能"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHiJfPd1-3LeRj-WKnQqUbImgyRoJSUXvw06sJxr4HxTgaTY5RlyN-OIqHx_mNjyHY2VSmZdnwR_XQmg3dzHFGkmtgUtIEiBUrxSubRrXN75GIPXIWiptn0-uKS1IS2Mx6f-oEZwMAlkBF_QAa_Waa_8&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "外施Ca<sup>2+</sup>、ABA及H<sub>3</sub>PO<sub>4</sub>对盐碱胁迫的缓解效应",
				"creators": [
					{
						"firstName": "",
						"lastName": "颜宏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "石德成",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "尹尚军",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "赵伟",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2000",
				"DOI": "10.13287/j.1001-9332.2000.0212",
				"ISSN": "1001-9332",
				"abstractNote": "分别对 30 0mmol·L-1NaCl和 10 0mmol·L-1Na2 CO3 盐碱胁迫下的羊草苗进行以不同方式施加Ca2 +、ABA和H3PO4 等缓解胁迫处理 .结果表明 ,外施Ca2 +、ABA和H3PO4 明显缓解了盐碱对羊草生长的抑制作用 .叶面喷施效果好于根部处理 ;施用Ca(NO3) 2 效果好于施用CaCl2 效果 ;混合施用CaCl2 和ABA的效果比单独施用ABA或CaCl2 的效果好 .",
				"extra": "original-container-title: Chinese Journal of Applied Ecology\nfoundation: 国家自然科学基金资助项目!(39670 0 83) .；\ndownload: 464\nalbum: 基础科学;农业科技\nCLC: Q945\nCNKICite: 82\ndbcode: CJFQ\ndbname: CJFD2000\nfilename: YYSB200006019\npublicationTag: 北大核心, CA, JST, Pж(AJ), CSCD, WJCI\nCIF: 4.949\nAIF: 3.435",
				"issue": "6",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "889-892",
				"publicationTitle": "应用生态学报",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFD2000&filename=YYSB200006019",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "Ca<sup>2+</sup>"
					},
					{
						"tag": "盐胁迫"
					},
					{
						"tag": "碱胁迫"
					},
					{
						"tag": "羊草"
					},
					{
						"tag": "胁迫缓解"
					},
					{
						"tag": "脯氨酸（Pro）"
					},
					{
						"tag": "脱落酸（ABA）"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHgNsCevk3J33XvFPtx4G2gHTHYt4nWyQPuSN3_N3h_fu53F2pTHv8KUe5Wlo50Obu55zdIOJf7H4SG2wnx53Wv3yOAhaQaxkASpXlrfjF25yXShFh2WJ7ktvHWYBM8y9mS0AIe2X4fRmtNieFe2na0Y&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "黄瓜胚性愈伤组织的诱导保存和再生",
				"creators": [
					{
						"firstName": "",
						"lastName": "薛婉钰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘娜",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "苑鑫",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张婷婷",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "曹云娥",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈书霞",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-01-05",
				"DOI": "10.13207/j.cnki.jnwafu.2024.07.011",
				"ISSN": "1671-9387",
				"abstractNote": "【目的】对黄瓜胚性愈伤组织的诱导保存和再生进行研究,为黄瓜高频率遗传转化奠定基础。【方法】以欧洲温室型黄瓜自交系14-1子叶节为外植体,在MS培养基上附加1.5 mg/L 2,4-D,进行25 d的胚性愈伤组织诱导培养后,取胚性愈伤组织在添加30,60,90,100,110,120,130,140和150 g/L蔗糖及1.5 mg/L 2,4-D的MS培养基进行继代培养,每30 d继代1次,观察胚性愈伤组织的褐变情况及胚性分化能力,并用电子天平在超净工作台中记录胚性愈伤组织质量的变化。继代培养60 d后,将保存的胚性愈伤组织和体细胞胚移至含1.5 mg/L 2,4-D的MS培养基上,待出现体细胞胚后移至MS培养基进行萌发,观察再生小植株的生长情况。【结果】将欧洲温室型黄瓜自交系14-1的子叶节,接种到附加1.5 mg/L 2,4-D的MS培养基上进行诱导培养后,子叶节一端的愈伤组织集中聚集于下胚轴处,之后有黄色胚性愈伤组织产生。在继代培养过程中,当培养基中添加的蔗糖为60～150 g/L时,胚性愈伤组织能保持胚性愈伤状态达60 d。之后将继代培养60 d后的胚性愈伤组织转接至附加1.5 mg/L 2,4-D的MS培养基上,在蔗糖质量浓度为60 g/L条件下保存的胚性愈伤组织可诱导出正常胚状体,且能形成健康小植株。【结论】由黄瓜子叶节诱导出的胚性愈伤组织可在MS+60 g/L蔗糖的培养基上保存达60 d,之后能正常萌发形成胚状体,进而形成正常小植株。",
				"extra": "original-container-title: Journal of Northwest A & F University(Natural Science Edition)\nStatus: advance online publication\nfoundation: 国家自然科学基金项目(32072562； 32272748；\ndownload: 288\nalbum: 农业科技\nCLC: S642.2\nCNKICite: 0\ndbcode: CAPJ\ndbname: CAPJLAST\nfilename: XBNY20240104006\npublicationTag: 北大核心, JST, Pж(AJ), CSCD, WJCI\nCIF: 2.343\nAIF: 1.657",
				"issue": "7",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "1-7",
				"publicationTitle": "西北农林科技大学学报（自然科学版）",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CAPJ&dbname=CAPJLAST&filename=XBNY20240104006",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "离体保存"
					},
					{
						"tag": "胚性愈伤组织"
					},
					{
						"tag": "遗传转化"
					},
					{
						"tag": "黄瓜"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHhgV8yB3UWCXBZSBjUeApZd4K3N5dRJVSbZlmbo38Lrk1lUwAovAfa5rwr2WAlNqwvutlPMuaClCxE89Iga_HukBRLqp0RnX_MKe0_kRMOMxK84JO7y1DFyEf7kUcmug_4YvOl6cr7rCqDP6Qbasa8lyF3mUOqMHhw=&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "thesis",
				"title": "黄瓜共表达基因模块的识别及其特点分析",
				"creators": [
					{
						"firstName": "",
						"lastName": "林行众",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "黄三文",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨清",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2017",
				"abstractNote": "黄瓜(Cucumis sativus L.)是我国最大的保护地栽培蔬菜作物,也是植物性别发育和维管束运输研究的重要模式植物。黄瓜基因组序列图谱已经构建完成,并且在此基础上又完成了全基因组SSR标记开发和涵盖330万个变异位点变异组图谱,成为黄瓜功能基因研究的重要平台和工具,相关转录组研究也有很多报道,不过共表达网络研究还是空白。本实验以温室型黄瓜9930为研究对象,选取10个不同组织,进行转录组测序,获得10份转录组原始数据。在对原始数据去除接头与低质量读段后,将高质量读段用Tophat2回贴到已经发表的栽培黄瓜基因组序列上。用Cufflinks对回贴后的数据计算FPKM值,获得10份组织的24274基因的表达量数据。计算结果中的回贴率比较理想,不过有些基因的表达量过低。为了防止表达量低的基因对结果的影响,将10份组织中表达量最大小于5的基因去除,得到16924个基因,进行下一步分析。共表达网络的构建过程是将上步获得的表达量数据,利用R语言中WGCNA(weighted gene co-expression network analysis)包构建共表达网络。结果得到的共表达网络包括1134个模块。这些模块中的基因表达模式类似,可以认为是共表达关系。不过结果中一些模块内基因间相关性同其他模块相比比较低,在分析过程中,将模块中基因相关性平均值低于0.9的模块都去除,最终得到839个模块,一共11,844个基因。共表达的基因因其表达模式类似而聚在一起,这些基因可能与10份组织存在特异性关联。为了计算模块与组织间的相关性,首先要对每个模块进行主成分分析(principle component analysis,PCA),获得特征基因(module eigengene,ME),特征基因可以表示这个模块所有基因共有的表达趋势。通过计算特征基因与组织间的相关性,从而挑选出组织特异性模块,这些模块一共有323个。利用topGO功能富集分析的结果表明这些特异性模块所富集的功能与组织相关。共表达基因在染色体上的物理位置经常是成簇分布的。按照基因间隔小于25kb为标准。分别对839个模块进行分析,结果发现在71个模块中共有220个cluster,这些cluster 一般有2～5个基因,cluster中的基因在功能上也表现出一定的联系。共表达基因可能受到相同的转录调控,这些基因在启动子前2kb可能会存在有相同的motif以供反式作用元...",
				"extra": "major: 生物化学与分子生物学\ndownload: 302\nalbum: 基础科学;农业科技\nCLC: S642.2;Q943.2\nCNKICite: 1\ndbcode: CMFD\ndbname: CMFD201701\nfilename: 1017045605.nh",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"numPages": "69",
				"thesisType": "硕士学位论文",
				"university": "南京农业大学",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CMFD&dbname=CMFD201701&filename=1017045605.nh",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "共表达"
					},
					{
						"tag": "网络"
					},
					{
						"tag": "转录组"
					},
					{
						"tag": "黄瓜"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHj6Gayxo8L6fbVE09XgFLEEcf6cQsNi_FxXLO9nipcciMN3_FwQyLgo9ieYMdBGu1Xk6EqEYwRjsYZf3GvEVojk7uR6DhDX2ciH3OcSRfGpARqQ_BXkw_Mql2zaz0ybPTsvmw96vsDwsrfhocinx52z&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "thesis",
				"title": "高导热聚合物基复合材料的制备与性能研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "虞锦洪",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "江平开",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2012",
				"abstractNote": "随着微电子集成技术和组装技术的快速发展，电子元器件和逻辑电路的体积越来越小，而工作频率急剧增加，半导体的环境温度向高温方向变化，为保证电子元器件长时间可靠地正常工作，及时散热能力就成为其使用寿命长短的制约因素。高导热聚合物基复合材料在微电子、航空、航天、军事装备、电机电器等诸多制造业及高科技领域发挥着重要的作用。所以研制综合性能优异的高导热聚合物基复合材料成为了目前研究热点。本论文分别以氧化铝（Al<sub>2</sub>O<sub>3</sub>）、石墨烯和氮化硼（BN）纳米片为导热填料，以环氧树脂和聚偏氟乙烯（PVDF）为基体，制备了新型的高导热聚合物基复合材料。首先，采用两步法将超支化聚芳酰胺接枝到纳米Al<sub>2</sub>O<sub>3</sub>粒子表面：纳米颗粒先进行硅烷偶联剂处理引入氨基基团，在改性后的纳米粒子上接枝超支化聚合物；再利用X射线衍射、傅立叶红外光谱、核磁共振氢谱和热失重等方法对纳米Al<sub>2</sub>O<sub>3</sub>粒子的表面改性进行表征；然后分别将未改性的纳米Al<sub>2</sub>O<sub>3</sub>粒子、硅烷接枝的纳米Al<sub>2</sub>O<sub>3</sub>粒子（Al<sub>2</sub>O<sub>3</sub>-APS）和超支化聚芳酰胺接枝的纳米Al<sub>2</sub>O<sub>3</sub>粒子（Al<sub>2</sub>O<sub>3</sub>-HBP）与环氧树脂复合，并对三种复合材料的热性能和介电性能进行比较研究。结果表明：（1）从SEM、TEM和动态光散射的实验结果表明，三种纳米颗粒相比之下，Al<sub>2</sub>O<sub>3</sub>-HBP纳米粒子在有机溶剂乙醇和环氧树脂中显示出最好的分散性。（2）三种复合材料的导热系数都是随着纳米颗粒含量的增加而增大；在添加相同含量的纳米颗粒时，其导热系数遵循着如下的规律：环氧树脂/Al<sub>2</sub>O<sub>3</sub>-HBP复合材料>环氧树脂/Al<sub>2</sub>O<sub>3</sub>-APS复合材料>环氧树脂/Al<sub>2</sub>O<sub>3</sub>复合材料。而且从DSC、TGA和DMA的实验结果可以得出，与未改性Al<sub>2</sub>O<sub>3</sub>和Al<sub>2</sub>O<s...",
				"extra": "major: 材料学\nfoundation: 国家自然基金；\ndownload: 15299\nalbum: 工程科技Ⅰ辑\nCLC: TB332\nCNKICite: 197\ndbcode: CDFD\ndbname: CDFD1214\nfilename: 1012034749.nh",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"numPages": "148",
				"thesisType": "博士学位论文",
				"university": "上海交通大学",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CDFD&dbname=CDFD1214&filename=1012034749.nh",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "介电"
					},
					{
						"tag": "复合材料"
					},
					{
						"tag": "导热"
					},
					{
						"tag": "氧化铝"
					},
					{
						"tag": "氮化硼"
					},
					{
						"tag": "环氧树脂"
					},
					{
						"tag": "石墨烯"
					},
					{
						"tag": "聚偏氟乙烯"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHh5T13ZNlvftCS5W7lFLaFxrjyYI6gVOQP3L5rywG5-Di5tsOpbfZTa5CCqJefAfcM_Ayf-FEXB3lj67b9ruzE7Ps14A5QcB2pTnsLUd5fkowwl0uVTMz6cnj4o2RA_OAAxz-UyrZx6cDEOWCk81A50aEHZX0w_isQ=&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "辽西区新石器时代考古学文化纵横",
				"creators": [
					{
						"firstName": "",
						"lastName": "朱延平",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "内蒙古文物考古研究所",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "1991-09",
				"abstractNote": "辽西区的范围从大兴安岭南缘到渤海北岸,西起燕山西段,东止辽河平原,基本上包括内蒙古的赤峰市(原昭乌达盟)、哲里木盟西半部,辽宁省西部和河北省的承德、唐山、廊坊及其邻近的北京、天津等地区。这一地区的古人类遗存自旧石器时代晚期起,就与同属东北的辽东区有着明显的不同,在后来的发展中,构成自具特色的一个考古学文化区,对我国东北部起过不可忽视的作用。以下就辽西地区新石器时代的考古学文化序列、编年、谱系及有关问题简要地谈一下自己的认识。",
				"conferenceName": "内蒙古东部地区考古学术研讨会",
				"extra": "organizer: 中国社会科学院考古研究所、内蒙古文物考古研究所、赤峰市文化局\ndownload: 605\nalbum: 哲学与人文科学\nCLC: K872\nCNKICite: 56\ndbcode: CPFD\ndbname: CPFD9908\nfilename: OYDD199010001004",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "6",
				"place": "中国内蒙古赤峰",
				"proceedingsTitle": "内蒙古东部区考古学文化研究文集",
				"publisher": "海洋出版社",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CPFD&dbname=CPFD9908&filename=OYDD199010001004",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "兴隆洼文化"
					},
					{
						"tag": "努鲁儿虎山"
					},
					{
						"tag": "半坡文化"
					},
					{
						"tag": "夹砂陶"
					},
					{
						"tag": "富河文化"
					},
					{
						"tag": "小河沿文化"
					},
					{
						"tag": "庙底沟文化"
					},
					{
						"tag": "彩陶花纹"
					},
					{
						"tag": "文化纵横"
					},
					{
						"tag": "新石器时代考古"
					},
					{
						"tag": "红山文化"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHjJaaUXP2deH7u_E6LIrSZ0d44EaLI0f3uWzHlCytIWirQ-FCMuNtBAfvbqDp9yvzokQinx4AbvzT3uDxBFFavqHMeUGqHrChnRn04dOgGEcnL6EjkjBxbzF_tujbFoNmdpq4qJY17KLP60V3meZEujQ2HtF9Ul4cE=&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "灭绝物种RNA首次分离测序",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘霞",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-09-21",
				"abstractNote": "科技日报北京9月20日电 （记者刘霞）瑞典国家分子生物科学中心科学家首次分离和测序了一个已灭绝物种的RNA分子，从而重建了该灭绝物种（塔斯马尼亚虎）的皮肤和骨骼肌转录组。该项成果对复活塔斯马尼亚虎和毛猛犸象等灭绝物种，以及研究如新冠病毒等RNA病毒具有重要意义。相......",
				"extra": "DOI: 10.28502/n.cnki.nkjrb.2023.005521\ndownload: 19\nalbum: 基础科学\nCLC: Q343.1\nCNKICite: 0\ndbcode: CCND\ndbname: CCNDLAST2023\nfilename: KJRB202309210044",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "4",
				"publicationTitle": "科技日报",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CCND&dbname=CCNDLAST2023&filename=KJRB202309210044",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "RNA"
					},
					{
						"tag": "转录组"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHhYwfUOQkiiROc25goQviQYf_8e6_V0gRtSy-IOCOv-RtNJKQRSWFe_2aQ9FUrPSbZgyTHJcSQltSFIucYSN5-E8Lt2bZqQORfiheWS7osCintOXKh_V0nNfmqtUxSC3_Q=&uniplatform=NZKPT",
		"items": [
			{
				"itemType": "bookSection",
				"title": "大事记",
				"creators": [
					{
						"firstName": "",
						"lastName": "高生记",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"ISBN": "9787514445008",
				"bookTitle": "山西年鉴",
				"extra": "original-container-title: SHAN XI YEARBOOK\nDOI: 10.41842/y.cnki.ysxnj.2022.000050\ndownload: 24\nCLC: Z9\nCNKICite: 0\ndbcode: CYFD\ndbname: CYFD2022\nfilename: N2022040061000062",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "6-23",
				"publisher": "方志出版社",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CYFD&dbname=CYFD2022&filename=N2022040061000062",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "大事记"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kns8s/defaultresult/index?classid=EMRPGLPA&korder=SU&kw=%E7%BA%B3%E7%B1%B3",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHirgXoXDiPipUsry_6qazwhXD76CAFEYQF73bknVpNZIYVKvgGFkNOjQcggV_UucsN4sQAWPUq4iPYlCrFtL8pcd4mcdRyaQLwwy71gJGFhCZ_erWb3f_AMQvR8thZJNEvdh__gjbT_iA==&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "patent",
				"title": "不锈钢管的制造方法",
				"creators": [
					{
						"firstName": "",
						"lastName": "李玉和",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李守军",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李扬洲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "罗通伟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "彭声通",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "贺同正",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "本发明公开了一种不锈钢管的制造方法,具有可提高不锈钢管质量的优点。该不锈钢管的制造方法,其特征是包括下述步骤：①将不锈钢液在熔炼炉中进行熔炼；②不锈钢液熔清后进行去渣及脱氧处理；③将不锈钢液浇入旋转的离心浇铸机型筒中进行离心浇铸后在离心力作用下冷却凝固成型为不锈钢管坯料。采用离心浇铸方法制作不锈钢空心管,使得在离心力作用下,离心管坯补缩效果好,组织较致密,气体和非金属夹杂容易排出,缺陷少,有效地提高了不锈钢管的质量,且通过离心浇铸后可直接获得不锈钢空心管,金属的收得率高,且通过采用离心浇铸后,管坯在后续加工中具有工序少、成材率高的特点,尤其适合在高端钢材产品的制造上面推广使用。",
				"applicationNumber": "CN200710201273.2",
				"country": "中国",
				"extra": "Genre: 发明公开\nalbum: 工程科技Ⅰ辑\nCLC: B22D13/02\ndbcode: SCPD\ndbname: SCPD0407\nfilename: CN101091984",
				"filingDate": "2007-08-03",
				"language": "zh-CN",
				"patentNumber": "CN101091984",
				"place": "中国",
				"rights": "1.不锈钢管的制造方法,其特征是包括下述步骤：①、将不锈钢液 在熔炼炉中进行熔炼；②、不锈钢液熔清后进行去渣及脱氧处理；③、将不锈钢液浇入旋转 的离心浇铸机型筒中进行离心浇铸后在离心力作用下冷却凝固成型为不锈钢管坯料。",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=SCPD&dbname=SCPD0407&filename=CN101091984",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Full Text CAJ",
						"mimeType": "application/caj"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHisDDh3Jbev6bLKM4uZ4zdkHhUKUvu33K3UKhirS0mZ6_0I3ccNw8wZCZpNtFIu56hjZb3BAgFWF9mo2OZ6ZgiV_wB6SBonTcIav-nIFXbZzV1agS7F6sL4YtGYiK6XmR11KS0DBHQb1A==&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "standard",
				"title": "粮油检验　小麦粉膨胀势的测定",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国粮油标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019-05-10",
				"extra": "applyDate: 2019-12-01\noriginal-title: Inspection of grain and oils—Swelling properties test of wheat flour\nalbum: 工程科技Ⅰ辑\nCLC: X04 食品-食品综合-基础标准与通用方法\nCNKICite: 0\ndbcode: SCSF\ndbname: SCSF\nfilename: SCSF00058274",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"numPages": "16",
				"number": "GB/T 37510—2019",
				"status": "现行",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=SCSF&dbname=SCSF&filename=SCSF00058274",
				"attachments": [],
				"tags": [
					{
						"tag": "粮油检验"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHhIQnFHOAYBu_AWGLk-KxuOPHbIodNrllD3-G2sYVXgNLca6cAArRjysadqkuvXTnpLHgWov1Ov0nhTWE2pFTviopsk0NyAZtsRNq3bJJ83cUMRAiJpniProBQx_Wnrc2DKmM5biiR49YDIiMElHUvq&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "report",
				"title": "25MW/100MWh液流电池长时储能系统关键技术研发与示范",
				"creators": [
					{
						"firstName": "",
						"lastName": "孟青",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘素琴",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李建林",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "曾义凯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张家乐",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴志宽",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘文",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "周明月",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "何震",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王珏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "解祯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "娄明坤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "许超",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李继伟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王璐嘉",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "本项目拟通过分析材料、电堆、电解液和模块性能提升、成本控制制约因素,将关键材料性能提升与电堆结构优化设计以及系统电气、智能控制设施等的优化研究相结合,以最大限度地提升性能、降低系统成本。针对液流电池电解液活性物种溶解度不高,高、低温稳定性差,长期循环过程中容量衰减和效率降低问题,开发高浓度、高稳定性、活性电解液配方与制备工艺。在功率单元和能量单元性能优化基础上,以可靠性和系统性能优化为目标,分析指标,开发储能单元模块,以此为基础设计储能电站工程,针对工程应用开发调控和运维平台,形成示范应用及经济性分析。",
				"extra": "achievementType: 应用技术\nevaluation: 验收\nalbum: 工程科技Ⅱ辑\nCLC: TM912.9\ndbcode: SNAD\ndbname: SNAD\nfilename: SNAD000002043401",
				"institution": "山西国润储能科技有限公司",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"reportType": "科技报告",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=SNAD&dbname=SNAD&filename=SNAD000002043401",
				"attachments": [
					{
						"title": "Full Text CAJ",
						"mimeType": "application/caj"
					}
				],
				"tags": [
					{
						"tag": "储能电站"
					},
					{
						"tag": "储能系统"
					},
					{
						"tag": "关键技术研发"
					},
					{
						"tag": "液流电池"
					},
					{
						"tag": "电解液活性"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHhA4oXrQG6Lpqx_vq6kcgTNS4oD2bJVzODP7EqGXfjDg5WMeS8mhDO1sk3y2zLje6VBtd3YG_W67GdiRgsXDLA4u0D1tgwJqvyykWK1VEnTor88f6t5NF_tBrPfve4_5t-rW5QQFp6-Fw==&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "2020年第二季度宏观经济形势分析会",
				"creators": [
					{
						"firstName": "",
						"lastName": "贾康",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "贾康",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020-07-23",
				"abstractNote": "【中国资本市场50人论坛携手中国知网联合出品】 议 程 贾 康 华夏新供给经济学研究院 院长 财政部原财政科学研究所所长 贺 铿 北京民营经济发展促进会会长 十一届全国人大常委、财经委员会副主任 九三学社第十二届中央委员会副主席 王广宇 华夏新供给经济学研究院 理事长 华软资本创始人、董事长 孔泾源 北京民营经济发展促进会理事长 国家发展改革委经济体制综合改革司原司长 姚余栋 大成基金副总经理 兼 首席经济学家 中国 人民银行金融研究所 前 所长 魏加宁 国务院发展研究中心宏观研究部 研究员 中国新供给经济学 50 人论坛成员 黄剑辉 华夏新供给经济学研究院 首席经济学家 中国 民生银行研究院院长 冯俏彬 华夏新供给经济学研究院学术委员会委员 ……",
				"extra": "organizer: 中国资本市场50人论坛; 中国知网;\ndbcode: CCVD\ndbname: CCVD\nfilename: 542618070256",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"runningTime": "03:46:14",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CCVD&dbname=CCVD&filename=542618070256",
				"attachments": [],
				"tags": [
					{
						"tag": "民营经济"
					},
					{
						"tag": "要素市场化"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kns8s/search?classid=WD0FTY92&kw=%E7%85%A4%E7%82%AD&korder=SU",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kns8s/AdvSearch?classid=WD0FTY92",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kns/search?dbcode=SCDB",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=S8jPpdFxNHiery8DXkT083oAvbAx9rgOEcigOFI2MZ_13Vw2PvRBKFn_YSqpi2fcEeJvp73BHlsXABqmXA-6JrgNRrOobwH-TLFr-W-2HLJmq-79RHQxS-bYacMxTadx9jyVX3P1Qojx90fWItiKLTJOEp94azAwKweOUqGKlPFS2Rzm8OTCSg==&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "book",
				"title": "IMF Terminology Bulletin:Climate &amp; the Environment, Fintech, Gender, and Related Acronyms: English to Arabic",
				"creators": [],
				"date": "10/2023",
				"ISBN": "9798400251245",
				"extra": "DOI: 10.5089/9798400251245.073",
				"language": "ar",
				"libraryCatalog": "DOI.org (Crossref)",
				"place": "Washington, D.C.",
				"publisher": "International Monetary Fund",
				"shortTitle": "IMF Terminology Bulletin",
				"url": "https://elibrary.imf.org/openurl?genre=book&isbn=9798400251245&cid=537460-com-dsp-crossref",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
