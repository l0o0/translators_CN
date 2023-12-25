{
	"translatorID": "5c95b67b-41c5-4f55-b71a-48d5d7183063",
	"label": "CNKI",
	"creator": "Aurimas Vinckevicius, Xingzhong Lin, jiaojiaodubai23",
	"target": "https?://.*?(thinker\\.cnki)|(cnki\\.com)|/(kns8?s?|kcms2?|KXReader|KNavi|Kreader)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-25 07:49:03"
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

/* A series of identifiers for item, used to request data from APIs. */
class ID {
	constructor(doc, url) {
		this.dbname = '';
		this.filename = '';
		this.dbcode = '';
		this.url = '';
		if (doc && url) {
			this.commonId(doc, url);
		}
		// For cases where there is only one parameter, what is passed in is actually a URL
		else if (doc) {
			this.spaceId(doc);
		}
	}


	/* ID initialization method suitable for CNKI space */
	// e.g. https://www.cnki.com.cn/Article/CJFDTOTAL-CXKJ202311006.htm
	spaceId(url) {
		this.filename = tryMatch(url, /-([A-Z\d]+)\./, 1);
		this.dbcode = tryMatch(url, /\/([A-Z]{4})TOTAL-/, 1);
		this.dbname = `${this.dbcode}AUTO${tryMatch(this.filename, /[A-Z](\d{4})/, 1)}`;
		this.url = 'https://kns.cnki.net/KCMS/detail/detail.aspx?'
			+ `dbcode=${this.dbcode}`
			+ `&dbname=${this.dbname}`
			+ `&filename=${this.filename}`
			+ `&v=`;
	}


	/* ID initialization method suitable for ordinary CNKI */
	commonId(doc, url) {
		let frame = {
			dbname: {
				selector: 'input#paramdbname',
				pattern: /[?&](?:db|table)[nN]ame=([^&#]*)/i
			},
			filename: {
				selector: 'input#paramfilename',
				pattern: /[?&]filename=([^&#]*)/i
			},
			dbcode: {
				selector: 'input#paramdbcode',
				pattern: /[?&]dbcode=([^&#]*)/i
			}
		};
		for (const key in frame) {
			this[key] = attr(doc, frame[key].selector, 'value')
				|| tryMatch(url, frame[key].pattern, 1);
		}
		// geology version
		if (url.includes('inds.cnki.net')) {
			this.dbcode = this.dbname.slice(6, 10);
			this.dbname = this.dbname.slice(6);
		}
		else {
			this.dbcode = this.dbcode || this.dbname.substring(0, 4).toUpperCase();
		}
		this.url = url;
	}

	toBoolean() {
		return Boolean(this.dbname && this.filename);
	}

	toItemtype() {
		let typeMap = {
			// 学术辑刊 zh
			CCJD: 'journalArticle',
			// 学术期刊 journal zh
			CJFQ: 'journalArticle',
			// 学术期刊 journal en
			WWJD: 'journalArticle',
			// 特色期刊 journal
			CJFN: 'journalArticle',

			/* 余下journal未在页面找到，可能已经过时 */
			CDMD: 'journalArticle',
			CJFD: 'journalArticle',
			CAPJ: 'journalArticle',
			CJZK: 'journalArticle',
			SJES: 'journalArticle',
			SJPD: 'journalArticle',
			SSJD: 'journalArticle',
			// 博士 dissertation zh
			CDFD: 'thesis',
			// 硕士 dissertation zh
			CMFD: 'thesis',
			// 报纸 newspaper zh
			CCND: 'newspaperArticle',
			// 中国专利 patent zh
			SCPD: 'patent',
			// 境外专利 patent en
			SOPD: 'patent',
			SCOD: 'patent',
			// 年鉴 almanac zh，无对应条目类型，以期刊记录
			CYFD: 'journalArticle',
			// 国内会议 conference zh
			CPFD: 'conferencePaper',
			// （国外）会议 en
			WWPD: 'conferencePaper',
			// 会议视频 video zh
			CPVD: 'conferencePaper',
			// 国际会议 conference en zh
			CIPD: 'conferencePaper',
			IPFD: 'conferencePaper',
			// 视频 video zh
			// CCVD
			/* 实际上无法匹配到图书的dbcode */
			// 中文图书 book zh
			WBFD: 'book',
			// 外文图书 book en
			WWBD: 'book',
			// 国家标准 standard zh
			SCSF: 'standard',
			// 行业标准 standard zh
			SCHF: 'standard',
			// 标准题录 standard zh
			SCSD: 'standard',
			// 标准题录 standard en
			SOSD: 'standard',
			// 成果 achievements
			// SNAD
			/* hospital */
			// https://chkdx.cnki.net/kns8/#/
			CLKM: 'thesis',
			CHKJ: 'journalArticle',
			PUBMED: 'journalArticle',
			CDMH: 'thesis',
			CHKP: 'conferencePaper',
			CHKN: 'newspaperArticle'
		};
		return typeMap[this.dbcode];
	}

	toLanguage() {
		// zh database code: CJFQ,CDFD,CMFD,CPFD,IPFD,CPVD,CCND,WBFD,SCSF,SCHF,SCSD,SNAD,CCJD,CJFN,CCVD
		// en database code: WWJD,IPFD,WWPD,WWBD,SOSD
		return ['WWJD', 'IPFD', 'WWPD', 'WWBD', 'SOSD'].includes(this.dbcode)
			? 'en-US'
			: 'zh-CN';
	}
}

// var debugMode = false;

function detectWeb(doc, url) {
	Z.debug("---------------- CNKI 2023-12-25 2023-12-25 ------------------");
	let ids = url.includes('www.cnki.com.cn')
		// CNKI space
		? new ID(url)
		: new ID(doc, url);
	Z.debug('detect ids:');
	Z.debug(ids);
	const multiplePattern = [

		/*
		search
		https://kns.cnki.net/kns/search?dbcode=SCDB
		https://kns.cnki.net/kns8s/
		https://inds.cnki.net/kns/search/index?dbCode=DKCTZK&kw=5g&korder=1
		 */
		/kns8?s?\/search\??/i,

		/*
		advanced search
		old version: https://kns.cnki.net/kns/advsearch?dbcode=SCDB
		new version: https://kns.cnki.net/kns8s/AdvSearch?classid=WD0FTY92
		 */
		/KNS8?s?\/AdvSearch\?/i,

		/*
		article/yearbook list in journal navigation page or CNKI thingker search page
		https://navi.cnki.net/knavi/journals/ZGSK/detail?uniplatform=NZKPT
		 */
		/\/KNavi\//i,

		/* https://kns.cnki.net/kns8s/defaultresult/index?korder=&kw= */
		/kns8?s?\/defaultresult\/index/i,

		/*
		search page in CNKI space
		https://search.cnki.com.cn/Search/Result?theme=%u6C34%u7A3B
		 */
		/search\.cnki\.com/i,
		// seems outdated
		/kns\/brief\/(default_)?result\.aspx/i,
		// https://chkdx.cnki.net/kns8/#/
		/kns8\/#\//i
	];
	// #ModuleSearchResult for commom CNKI,
	// #contentPanel for journal/yearbook navigation,
	// .main_sh for oldversion,
	// .resault-cont for CNKI space
	// #content for geology version
	// .main.clearfix for hospital version
	let searchResult = doc.querySelector('#ModuleSearchResult, #contentPanel, .main_sh, .resault-cont, #content, .main.clearfix');
	if (searchResult) {
		Z.monitorDOMChanges(searchResult, { childList: true, subtree: true });
	}
	if (ids.toBoolean()) {
		return ids.toItemtype();
	}
	// e.g. https://thinker.cnki.net/bookstore/book/bookdetail?bookcode=9787111520269000&type=book
	else if (url.includes('book/bookdetail')) {
		// 知网心可图书馆，CNKI thingker
		return 'book';
	}
	// e.g https://thinker.cnki.net/BookStore/chapter/chapterdetail?bookcode=9787111520269000_174&type=chapter#div6
	else if (url.includes('chapter/chapterdetail')) {
		// 知网心可图书馆，CNKI thingker
		return 'bookSection';
	}
	else if (multiplePattern.find(element => element.test(url)) && getSearchResults(doc, url, true)) {
		return 'multiple';
	}
	else {
		return false;
	}
}

function getSearchResults(doc, url, checkOnly) {
	var items = {};
	var found = false;
	var searchTypes = [

		/* journalNavigation */
		{
			pattern: /\/journals\/.+\/detail/i,
			rowSlector: 'dl#CataLogContent dd',
			aSlector: 'span.name > a'
		},

		/* yearbookNavigation */
		{
			pattern: /\/yearbooks\/.+\/detail/i,
			rowSlector: '#contentPanel .itemNav',
			aSlector: 'a'
		},

		/* CNKISpace */
		{
			pattern: /search\.cnki\.com/i,
			rowSlector: '#contentPanel .itemNav',
			aSlector: 'p > a'
		},

		/* geology */
		// https://dizhi.cnki.net/
		{
			pattern: /\/search\/index?/i,
			rowSlector: '.s-single',
			aSlector: 'h1 > a'
		},

		/* hospital */
		// https://chkdx.cnki.net/kns8/#/
		{
			pattern: /chkdx\.cnki\.net/,
			rowSlector: 'table.list_table tbody tr',
			aSlector: 'td.seq+td > a'
		},

		/* commom */
		{
			pattern: /.*/i,
			rowSlector: 'table.result-table-list tbody tr',
			aSlector: 'td.name > a'
		}
	];
	var type = searchTypes.find(element => element.pattern.test(url));
	var rows = doc.querySelectorAll(type.rowSlector);
	if (!rows.length) return false;
	for (let i = 0; i < rows.length; i++) {
		let row = rows[i];
		let href = attr(row, type.aSlector, 'href');
		let title = attr(row, type.aSlector, 'title') || text(row, type.aSlector);
		// Z.debug(`${href}\n${title}`);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		// Use the key to transmit some useful information.
		items[JSON.stringify({
			url: href,
			// reference count
			cite: text(row, 'td.quote'),
			// Another identifier for requesting data from the API.
			// In Chinese Mainland, it is usually dynamic,
			// while overseas is composed of fixed ids.filename.
			cookieName: attr(row, '[name="CookieName"]', 'value'),
			downloadlink: attr(row, 'td.operat > a.downloadlink', 'href')
		})] = `【${i + 1}】${title}`;
		// Z.debug(items);
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	// Because CNKI has different APIs inside and outside Chinese Mainland, it needs to be differentiated.
	const inMainland = Boolean(!/oversea/i.test(url));
	Z.debug(`inMainland: ${inMainland}`);
	let ids = new ID(doc, url);

	/*
	For multiple items, prioritize trying to crawl them one by one, as documents always provide additional information;
	If it is not possible to obtain the document, consider using bulk export API.
	 */
	if (detectWeb(doc, url) == "multiple") {
		let items = await Z.selectItems(getSearchResults(doc, url, false));
		if (!items) return;
		for (let key in items) {
			let itemKey = JSON.parse(key);
			try {
				// During debugging, may manually throw errors to guide the program to run inward
				// throw ReferenceError;
				let doc = await requestDocument(itemKey.url);
				// CAPTCHA
				if (doc.querySelector('#verify_pic')) {
					Z.debug('Accessing single item page failed!');
					throw new TypeError('❌打开页面过程中遇到验证码❌');
				}
				await scrape(doc, itemKey.url, itemKey, inMainland);
			}
			catch (erro1) {
				Z.debug('Attempt to use bulk export API');
				try {
					if (Object.keys(items).some(element => JSON.parse(element).cookieName)) {
						throw new TypeError('This page is not suitable for using bulk export API');
					}
					var itemKeys = Object.keys(items)
						.map(element => JSON.parse(element))
						.filter(element => element.cookieName);
					await scrapeWithShowExport(itemKeys, inMainland);
					// Bulk export API can request all data at once.
					break;
				}

				/*
				Some older versions of CNKI and industry customized versions may not support retrieving CookieName from search pages.
				In these cases, CAPTCHA issue should be handled by the user.
				*/
				catch (erro2) {
					let debugItem = new Z.Item('webpage');
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
	// CHKI thingker
	else if (url.includes('thinker.cnki')) {
		await scrapeZhBook(doc, url);
	}
	// geology, scholar
	else if (ids.dbcode == 'WWBD') {
		await scrapeDoc(
			doc,
			ids,
			{ url: '', cite: '', cookieName: '', downloadlink: '' }
		);
	}
	else {
		await scrape(
			doc,
			// The itemKey can only be obtained from the search page,
			// and it is set to empty here to meet compatibility requirements.
			url,
			{ url: '', cite: '', cookieName: '', downloadlink: '' },
			inMainland
		);
	}
}

async function scrape(doc, url = doc.location.href, itemKey, inMainland) {
	var isSpace = /cnki\.com\.cn/.test(url);
	let ids = isSpace ? new ID(url) : new ID(doc, url);
	Z.debug('scrape single item with ids:');

	/*
	In some rare cases, an exception occurred while scrape item,
	but the program was not correctly guided to the next scrape scheme,
	and in this case, debugMode needs to be applied to save any potentially useful debugging information.
	 */
	try {
		await scrapeWithGetExport(doc, ids, itemKey, inMainland);
	}
	catch (error) {
		// Value return from API is invalid, scrape metadata from webpage.
		if (!isSpace) await scrapeDoc(doc, ids, itemKey);
	}
}

/* API from "cite" button */
async function scrapeWithGetExport(doc, ids, itemKey, inMainland) {
	Z.debug('use API GetExport');
	// To avoid triggering anti crawlers due to frequent requests,
	// uncomment the expression below during debugging to test functionality unrelated to requests.
	/*
	  referText = {
		code: 1,
		msg: "返回成功",
		data: [
			{
				key: "GB/T 7714-2015 格式引文",
				value: [
					"[1]张福锁,王激清,张卫峰等.中国主要粮食作物肥料利用率现状与提高途径[J].土壤学报,2008(05):915-924."
				]
			},
			{
				key: "知网研学（原E-Study）",
				value: [
					"DataType: 1<br>Title-题名: 中国主要粮食作物肥料利用率现状与提高途径<br>Author-作者: 张福锁;王激清;张卫峰;崔振岭;马文奇;陈新平;江荣风;<br>Source-刊名: 土壤学报<br>Year-年: 2008<br>PubTime-出版时间: 2008-09-15<br>Keyword-关键词: 肥料农学效率;氮肥利用率;影响因素;提高途径<br>Summary-摘要: 总结了近年来在全国粮食主产区进行的1 333个田间试验结果,分析了目前条件下中国主要粮食作物水稻、小麦和玉米氮磷钾肥的偏生产力、农学效率、肥料利用率和生理利用率等,发现水稻、小麦和玉米的氮肥农学效率分别为10.4 kg kg-1、8.0 kg kg-1和9.8 kg kg-1,氮肥利用率分别为28.3%、28.2%和26.1%,远低于国际水平,与20世纪80年代相比呈下降趋势。造成肥料利用率低的主要原因包括高产农田过量施肥,忽视土壤和环境养分的利用,作物产量潜力未得到充分发挥以及养分损失未能得到有效阻控等。要大幅度提高肥料利用率就必须从植物营养学、土壤学、农学等多学科联合攻关入手,充分利用来自土壤和环境的养分资源,实现根层养分供应与高产作物需求在数量上匹配、时间上同步、空间上一致,同时提高作物产量和养分利用效率,协调作物高产与环境保护。<br>Period-期: 05<br>PageCount-页数: 10<br>Page-页码: 915-924<br>SrcDatabase-来源库: 期刊<br>Organ-机构: 农业部植物营养与养分循环重点实验室教育部植物-土壤相互作用重点实验室中国农业大学资源与环境学院;河北农业大学资源与环境学院;<br>Link-链接: https://kns.cnki.net/kcms2/article/abstract?v=2Wn7gbiy3W_uaYxWWHbfX6Eo_zqFxhUVFviONVwAOwGJb2qk1H2f2iCbMlOvOoP0DDONsYAP4T3EvRsDbBj1xyCMf7DOnq6aiLuQE42fefZ_sYdhZ4stRfXyaoK7TPbe&uniplatform=NZKPT&language=CHS<br>"
				]
			},
			{
				key: "EndNote",
				value: [
					"%0 Journal Article<br>%A 张福锁%A 王激清%A 张卫峰%A 崔振岭%A 马文奇%A 陈新平%A 江荣风<br>%+ 农业部植物营养与养分循环重点实验室教育部植物-土壤相互作用重点实验室中国农业大学资源与环境学院;河北农业大学资源与环境学院;<br>%T 中国主要粮食作物肥料利用率现状与提高途径<br>%J 土壤学报<br>%D 2008<br>%N 05<br>%K 肥料农学效率;氮肥利用率;影响因素;提高途径<br>%X 总结了近年来在全国粮食主产区进行的1 333个田间试验结果,分析了目前条件下中国主要粮食作物水稻、小麦和玉米氮磷钾肥的偏生产力、农学效率、肥料利用率和生理利用率等,发现水稻、小麦和玉米的氮肥农学效率分别为10.4 kg kg-1、8.0 kg kg-1和9.8 kg kg-1,氮肥利用率分别为28.3%、28.2%和26.1%,远低于国际水平,与20世纪80年代相比呈下降趋势。造成肥料利用率低的主要原因包括高产农田过量施肥,忽视土壤和环境养分的利用,作物产量潜力未得到充分发挥以及养分损失未能得到有效阻控等。要大幅度提高肥料利用率就必须从植物营养学、土壤学、农学等多学科联合攻关入手,充分利用来自土壤和环境的养分资源,实现根层养分供应与高产作物需求在数量上匹配、时间上同步、空间上一致,同时提高作物产量和养分利用效率,协调作物高产与环境保护。<br>%P 915-924<br>%@ 0564-3929<br>%L 32-1119/P<br>%W CNKI<br>"
				]
			}
		],
		traceid: "a7af1c2425ec49b5973f756b194256c6.191.17014617381526837"
	};
	 */

	// During debugging, may manually throw errors to guide the program to run inward
	// throw ReferenceError;

	// TODO: use (https?.*)(?:https?) check whether in a webVPN environment
	// e.g. https://ras.cdutcm.lib4s.com:7080/s/net/cnki/kns/G.https/dm/API/GetExport?uniplatform=NZKPT
	let postUrl = inMainland
		? `${/https?.*https?/.test(ids.url) ? tryMatch(ids.url, /https?.*https?/) : 'https://kns.cnki.net'}/dm/API/GetExport?uniplatform=NZKPT`
		: ids.url.includes('//chn.')
			// https://chn.oversea.cnki.net is an oversea CNKI site with Chinese language.
			? 'https://chn.oversea.cnki.net/kns8/manage/APIGetExport'
			: 'https://oversea.cnki.net/kns8/manage/APIGetExport';
	let postData = `filename=${ids.dbname}!${ids.filename}!1!0`
		// Although there are two data formats that are redundant,
		// this can make the request more "ordinary" to the server.
		+ `${inMainland ? '&uniplatform=NZKPT' : ''}`
		+ '&displaymode=GBTREFER%2Celearning%2CEndNote';
	Z.debug(postUrl);
	Z.debug(postData);
	if (!postUrl || !postData) throw new ReferenceError('没有适合的接口可用');
	let referText = await requestJSON(
		postUrl,
		{
			method: 'POST',
			body: postData,
			headers: {
				// The server uses the refer parameter to verify whether the request it receives comes from its own client web page.
				Referer: ids.url
			}
		}
	);
	Z.debug('get respond from API GetExport:');
	Z.debug(referText);

	if (!referText.data) {
		throw new ReferenceError('Failed to retrieve data from API: GetExport');
	}
	referText = referText.data[2].value[0];
	await parseRefer(referText, doc, ids, itemKey);
}

/* API from "Check - Export citations" */
async function scrapeWithShowExport(itemKeys, inMainland) {
	var fileNames = itemKeys.map(element => element.cookieName);
	Z.debug('use API showExport');
	// To avoid triggering anti crawlers due to frequent requests,
	// uncomment the expression below during debugging to test functionality unrelated to requests.

	/* let referText = {
		status: 200,
		headers: {
			connection: "close",
			"content-encoding": "br",
			"content-type": "text/plain;charset=utf-8",
			date: "Sun,03 Dec 2023 14: 56: 40 GMT",
			"transfer-encoding": "chunked"
		},
		body: "<ul class='literature-list'><li> %0 Journal Article<br> %A 贾玲 <br> %+ 晋中市太谷区北洸乡人民政府;<br> %T 抗旱转基因小麦的研究进展<br> %J 种子科技<br> %D 2023<br> %V 41<br>%N 17<br> %K 小麦;抗旱;转基因<br> %X 受气候复杂多变的影响，小麦生长期间干旱胁迫成为影响其产量的主要因素之一，利用基因工程技术提高小麦抗旱性非常必要。目前，已鉴定出一部分与小麦抗旱性相关并可以提高产量的基因，但与水稻、玉米和其他粮食作物相比，对抗旱转基因小麦的开发研究较少。文章重点关注小麦耐旱性的评价标准以及转基因小麦品种在提高抗旱性方面的进展，讨论了当前在转基因小麦方面取得的一些成就和发展中存在的问题，以期为小麦抗旱性基因工程育种提供理论依据。<br>%P 11-14<br> %@ 1005-2690<br> %U https: //link.cnki.net/doi/10.19904/j.cnki.cn14-1160/s.2023.17.004<br> %R 10.19904/j.cnki.cn14-1160/s.2023.17.004<br> %W CNKI<br> </li><li> %0 Journal Article<br> %A 刘志宏<br> %A 田媛<br> %A 陈红娜<br> %A 周志豪<br> %A 郑洁<br> %A 杨晓怀 <br> %+深圳市农业科技促进中心;暨南大学食品科学与工程系;<br> %T 水稻转基因育种的研究进展与应用现状<br> %J 中国种业<br> %D 2023<br> %V <br> %N 09<br> %K 转基因育种;水稻;病虫害;除草剂<br> %X 随着生物技术发展的不断深入，我国水稻种业的发展也面临着全新的机遇和挑战。目前，改善水稻品种质量的主要方法有分子标记技术、基因编辑技术和转基因技术。其中，转基因水稻是利用生物技术手段将外源基因转入到目标水稻的基因组中，通过外源基因的表达，获得具有抗病、抗虫、抗除草剂等优良性状的水稻品种。近年来，国内外在采用转基因技术进行水稻育种，提升水稻产量、改善水稻品质方面具有较多的研究进展。在阐述转基因技术工作原理的基础上，概述国内外利用转基因技术在优质水稻育种方面的研究进展，进一步探究转基因技术在我国水稻育种领域的发展前景。<br>%P 11-17<br> %@ 1671-895X<br> %U https: //link.cnki.net/doi/10.19462/j.cnki.1671-895x.2023.09.038<br> %R10.19462/j.cnki.1671-895x.2023.09.038<br> %W CNKI<br> </li><li> %0 Journal Article<br> %A 孙萌<br> %A 李荣田 <br> %+ 黑龙江大学生命科学学院/黑龙江省普通高等学校分子生物学重点实验室;黑龙江大学农业微生物技术教育部工程研究中心;<br> %T 基于文献计量学的中国水稻转录组研究进展<br> %J 环境工程<br> %D 2023<br> %V 41<br> %N S2<br> %K 水稻转录组;文献计量学;VOSviewer<br> %X 为了探究水稻转录组(Ricetranscriptome)研究的热点与趋势,本研究基于CNKI数据库,基于文献计量学的方法,对中国的发文量、关键词、研究机构、作者、基金、学科方向,进行相关分析。发现水稻转录组的研究进展与趋势动态,旨在为水稻转录组等领域的研究人员提供一定量的数据进行参考。结果显示:2003—2021年水稻转录组的研究论文数量共1512篇;文献的数量逐年增加,其中在2020年的产出数量最高;发文量前3的作者分别是刘向东、吴锦文、梁五生;华中农业大学,南京农业大学,浙江大学,中国农业科学院,华南农业大学发表的水稻转录组文献数量居全国前5位;该领域主要研究学科是,农作物、植物保护、园艺、生物学和林业等;国家自然科学基金是支持水稻转录组研究的主要项目。综合来看,中国在研究水稻转录组领域处于优势地位。<br>%P 1016-1019<br> %@ 1000-8942<br> %U https://kns.cnki.net/kcms2/article/abstract?v=ebrKgZyeBkxImzDUXjcVU04XYh7-VuK-twxFNRUx7mIL4CLVOe5VfbRl0TM7H3f_mb78up_-AjT2Rwgo5xU0wbsknYXBxlrO6GG-wlfR5dIIK8MKL8g8Vmc4O-Q3_qdDWz1MlRhZmckhhPAGlFwAFQ==&uniplatform=NZKPT&language=CHS<br>%W CNKI<br> </li></ul><input id='hidMode' type='hidden' value='BATCH_DOWNLOAD,EXPORT,CLIPYBOARD,PRINT'><input id='traceid' type='hidden'value='27077cd0510c4c989a7ac58b5541a910.173062.17016154007783847'>"
	}; */

	// During debugging, may manually throw errors to guide the program to run inward
	// throw ReferenceError;

	let postData = `FileName=${fileNames.join(',')}`
		+ '&DisplayMode=EndNote'
		+ '&OrderParam=0'
		+ '&OrderType=desc'
		+ '&SelectField='
		+ `${inMainland ? '&PageIndex=1&PageSize=20&language=CHS&uniplatform=NZKPT' : ''}`
		+ `&random=${Math.random()}`;
	let postUrl = inMainland
		? 'https://kns.cnki.net/dm8/api/ShowExport'
		: [
			'http://www.cnki.net/kns/manage/ShowExport',
			'https://chn.oversea.cnki.net/kns/manage/ShowExport',
			'https://oversea.cnki.net/kns/manage/ShowExport',
		].find(element => element.includes(tryMatch(itemKeys[0].url, /\/\/.*?\//)));
	let refer = inMainland
		? 'https://kns.cnki.net/dm8/manage/export.html?'
		: [
			'http://www.cnki.net/kns/manage/export.html?displaymode=EndNote',
			'https://chn.oversea.cnki.net/kns/manage/export.html?displaymode=EndNote',

		].find(element => element.includes(tryMatch(itemKeys[0].url, /\/\/.*?\//)));
	if (!postUrl || !postData) throw new ReferenceError('没有适合的接口可用');
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
	if (!referText.body) {
		throw new ReferenceError('Failed to retrieve data from API: ShowExport');
	}
	referText = referText.body
		// prefix
		.replace(/^<ul class='literature-list'>/, '')
		// suffix
		.replace(/<\/ul><input.*>$/, '').match(/<li>.*?<\/li>/g);

	for (let i = 0; i < referText.length; i++) {
		let text = referText[i];
		text = text.replace(/(^<li>\s*)|(\s*<\/li>$)/g, '');
		Z.debug(text);
		await parseRefer(
			text,
			document.createElement('div'),
			// This function is designed to be used when the item documents are unavailable,
			// so passing an empty Element to meet compatibility requirements.
			{
				dbname: '',
				filename: '',
				dbcode: '',
				url: ''
			},
			itemKeys[i]);
	}
}

async function parseRefer(referText, doc, ids, itemKey) {
	Z.debug('parsing referText:');
	Z.debug(referText);
	// Item without title is invalid.
	if (!/%T /.test(referText)) throw TypeError;
	Z.debug('Get referText from API successfuly!');
	referText = referText
		// breakline
		.replace(/<br>\s*|\r/g, '\n')
		// Sometimes, authors, contributors, or keywords may be mistakenly placed in the same tag.
		.replace(/^%([KAYI]) .*/gm, function (match) {
			let tag = match[1];
			return match.replace(/[,;，；]\s?/g, `\n%${tag} `);
		})
		// Sometimes, authors, contributors, or keywords have their tags, but do not wrap before the tags.
		.replace(/(%[KAYI]) /gm, '\n$1 ')
		.replace(/^%R /m, '%U ')
		// Custom tag "9" corresponds to the degree of the graduation thesis,
		//and tag "~" corresponds standard type (national standard or industry standard).
		.replace(/^%[9~] /m, '%R ')
		.replace(/^%V 0?/m, '%V ')
		.replace(/^%N 0?/m, '%N ')
		// \t in abstract
		.replace(/\t/g, '')
		.replace(/(\n\s*)+/g, '\n');
	Z.debug(referText);
	var translator = Zotero.loadTranslator("import");
	// Refer/BibIX
	translator.setTranslator('881f60f2-0802-411a-9228-ce5f47b64c7d');
	translator.setString(referText);
	translator.setHandler('itemDone', (_obj, newItem) => {
		// Record the yearbook as a journal article.
		if (newItem.type == '年鉴') {
			newItem.itemType = 'journalArticle';
		}
		switch (newItem.itemType) {
			case 'journalArticle':
				delete newItem.callNumber;
				break;
			case 'statute':
				newItem.itemType = 'standard';
				newItem.number = newItem.volume;
				delete newItem.volume;
				delete newItem.publisher;
				break;
			case 'thesis':
				newItem.university = newItem.publisher;
				delete newItem.publisher;
				if (newItem.type) {
					newItem.thesisType = `${newItem.type}学位论文`;
					delete newItem.type;
				}
				newItem.creators.forEach((element) => {
					if (element.creatorType == 'translator') {
						element.creatorType = 'contributor';
					}
				});
				break;
			case 'newspaperArticle':
				delete newItem.callNumber;
				break;
			case 'conferencePaper':
				newItem.conferenceName = newItem.publicationTitle;
				delete newItem.publicationTitle;
				break;
			case 'patent':
				newItem.issueDate = newItem.date;
				delete newItem.date;
				newItem.extra += addExtra('Genre', newItem.type);
				delete newItem.type;
				break;
			default:
				break;
		}
		newItem.ISSN = tryMatch(referText, /^%@ (.*)/, 1);
		delete newItem.archiveLocation;
		newItem = Object.assign(newItem, fixItem(newItem, doc, ids, itemKey));
		newItem.complete();
	});
	await translator.translate();
}

/* TODO: Compatible with English labels in English version of CNKI. */
async function scrapeDoc(doc, ids, itemKey) {
	Z.debug('scraping from document...');
	var newItem = new Zotero.Item(ids.toItemtype());
	newItem.extra = newItem.extra ? newItem.extra : '';
	// "#content p, .summary li.pdfN" only found on geology version
	// in standard page, ".row", ".row_1"
	let labels = new Labels(doc, 'div.doc div[class^="row"], li.top-space, #content summary > p, .summary li.pdfN');

	/* title */
	newItem.title = getPureText(doc.querySelector('div.doc h1, .h1-scholar, #chTitle'));
	if (newItem.title.includes('\n')) {
		newItem.extra += addExtra('original-title', newItem.title.split('\n')[1]);
		newItem.title = newItem.title.split('\n')[0];
	}
	newItem.title = newItem.title.replace(/MT翻译$/, '');

	/* creators */
	var creators = [
		// Do not use comma separated selector, as there may be duplicate code that is difficult to filter
		Array.from(doc.querySelectorAll('#authorpart a'))
			.map(element => element.textContent.trim().replace(/[\d,;，；]/g, '')),
		Array.from(doc.querySelectorAll('#authorpart span'))
			// Clear footnote labels ([\d,，]*), email ((\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*)*), saperator ([;；]*) for author names
			.map(element => element.textContent.trim().replace(/[\d,，]*(\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*)*[;；]*$/g, '')),
		// For oversea CNKI.
		text(doc, '.brief h3').split(/[,.，；\d]\s*/).filter(element => element),
		labels.getWith(['主编单位', '作者']).split(/[,;，；]\s*/),
		// standard
	].find(element => element.length);
	newItem.creators = creators.map(element => ZU.cleanAuthor(element, 'author'));
	let mentor = labels.getWith('导师').split(/[,;，；\d]\s*/);
	if (mentor.length) {
		mentor.forEach(element => newItem.creators.push(ZU.cleanAuthor(element, 'contributor')));
	}

	/* publication information */
	let pubInfo = innerText(doc, 'div.top-tip')
		+ getPureText(doc.querySelector('.summary .detailLink'))
		+ labels.getWith(['作者基本信息', '出版信息']);
	Z.debug(`puinfo:${pubInfo}`);
	newItem.publicationTitle = tryMatch(pubInfo, /(.*?)[.,]/, 1)
		|| labels.getWith('报纸网站')
		|| '';
	newItem.date = tryMatch(pubInfo, /(\d+),/, 1)
		|| tryMatch(pubInfo, /(\d{4})年?/, 1)
		|| labels.getWith(['发布日期', '发布单位', '报纸日期']);
	newItem.volume = tryMatch(pubInfo, /(\d*)\s*\(/, 1) || tryMatch(pubInfo, /0?(\d+)卷/, 1);
	newItem.issue = tryMatch(pubInfo, /\(0?(\d+)\)/, 1) || tryMatch(pubInfo, /0?(\d+)期/, 1);
	newItem.university = tryMatch(pubInfo, /.*?(大学|university|school)/i);
	newItem.thesisType = {
		CMFD: '硕士学位论文',
		CDFD: '博士学位论文',
		CDMH: '硕士学位论文'
	}[ids.dbcode] || (tryMatch(pubInfo, /(硕士|博士)/) ? `${tryMatch(pubInfo, /(硕士|博士)/)}学位论文` : '');
	newItem.ISBN = labels.getWith('ISBN');

	/* else fields */
	newItem.pages = tryMatch(text(doc, 'div.doc p.total-inform span:nth-child(2)'), /[\d-,+~]*/)
		|| labels.getWith(['Pages', '版号'])
		|| '';
	newItem.extra += addExtra('Genre', labels.getWith('专利类型'));
	newItem = Object.assign(newItem, fixItem(newItem, doc, ids, itemKey));
	newItem.complete();
}

/* TODO: Compatible with English labels in English version of CNKI. */
function fixItem(newItem, doc, ids, itemKey) {
	Z.debug('fixing item...');
	// "#content p, .summary li.pdfN" only found on geology version
	// in standard page, ".row", ".row_1"
	let labels = new Labels(doc, 'div.doc div[class^="row"], li.top-space, #content summary > p, .summary li.pdfN');
	Z.debug('get labels:');
	Z.debug(labels.innerData.map(element => [element[0], ZU.trimInternal(element[1].textContent)]));
	newItem.extra = newItem.extra ? newItem.extra : '';
	switch (newItem.itemType) {
		case 'journalArticle':
			break;
		case 'thesis':
			break;
		case 'patent':
			// newItem.place = labels.getWith('地址');
			newItem.place = labels.getWith('国省代码');
			newItem.country = labels.getWith('国省代码');
			newItem.patentNumber = labels.getWith('申请(专利)号');
			newItem.filingDate = labels.getWith('申请日');
			newItem.applicationNumber = labels.getWith('申请(专利)号');
			newItem.issueDate = labels.getWith('授权公告日');
			newItem.rights = text(doc, '.claim > h5 + div');
			break;
		case 'conferencePaper':
			newItem.proceedingsTitle = labels.getWith('会议录名称');
			newItem.conferenceName = labels.getWith('会议名称');
			newItem.date = labels.getWith('会议时间');
			newItem.place = labels.getWith('会议地点');
			break;
		case 'standard':
			newItem.number = labels.getWith('标准号').replace(/(\d)\s*-\s*(\d)/, '$1—$2');
			newItem.creators = [ZU.cleanAuthor(labels.getWith('标准技术委员会'), 'author')];
			newItem.extra += addExtra('applyDate', labels.getWith('实施日期'));
			newItem.status = text(doc, '.type');
			break;
		case 'newspaperArticle':
			break;
		default:
			break;
	}

	/* Click to get a full abstract in a single article page */
	let detailBtn = doc.querySelector('a[id*="ChDivSummaryMore"]');
	if (detailBtn) detailBtn.click();
	// 'div.abstract-text' is usually found on old versions of CNKI or oversea CNKI.
	// "#abstract_text": scoolar
	newItem.abstractNote = attr(doc, '#abstract_text', 'value')
		|| text(doc, 'span#ChDivSummary, div.abstract-text')
		|| labels.getWith('摘要')
		|| newItem.abstractNote
		|| '';
	newItem.abstractNote = newItem.abstractNote
		.replace(/\s*[\r\n]\s*/g, '\n')
		.replace(/&lt;.*?&gt;/g, '')
		.replace(/^＜正＞/, '');
	newItem.extra += addExtra('cite', itemKey.cite);
	// Build a shorter url
	let url = itemKey.url || ids.url || '';
	newItem.url = /kcms2/i.test(url)
		? 'https://kns.cnki.net/KCMS/detail/detail.aspx?'
		+ `dbcode=${ids.dbcode}`
		+ `&dbname=${ids.dbname}`
		+ `&filename=${ids.filename}`
		+ `&v=`
		: url;
	// CNKI DOI
	if (!newItem.DOI) newItem.DOI = labels.getWith('DOI');
	newItem.creators.forEach((element) => {
		if (/[\u4e00-\u9fa5]/.test(element.lastName)) {
			element.fieldMode = 1;
		}
	});
	if (doc.querySelector('.icon-shoufa')) {
		newItem.extra += 'status: advance online publication\n';
		newItem.extra += addExtra('available-date', newItem.data);
		// delete newItem.date;
		newItem.date = tryMatch(innerText(doc, '.head-time, .head-tag'), /：([\d-]*)/, 1);
	}
	newItem.language = ids.toLanguage();

	if (newItem.pages) {
		newItem.pages = newItem.pages.replace(/0*([1-9]\d*)/g, '$1').replace(/[+]/g, ', ').replace(/~/g, '-');
	}


	/* tags */
	// "#keyword_cn a": scholar
	let tags = Array.from(doc.querySelectorAll('div.doc p.keywords a, #ChDivKeyWord > a, #keyword_cn a'))
		.map(element => ZU.trimInternal(element.innerText).replace(/[,;，；]$/, ''));
	// Keywords sometimes appear as a whole paragraph
	if (!tags.length) {
		tags = text(doc, 'div.doc p.keywords') || labels.getWith('Keywords');
		tags = tags.split(/[,;，；n]\s*/g);
	}
	newItem.tags = tags.map(element => ({ tag: element }));

	/* add PDF/CAJ attachment */
	// If you want CAJ instead of PDF, set keepPDF = false
	// 如果你想将PDF文件替换为CAJ文件，将下面一行 keepPDF 设为 false
	var keepPDF = Z.getHiddenPref('CNKIPDF');
	if (keepPDF === undefined) keepPDF = true;
	if (ids.url.includes('KXReader/Detail')) {
		newItem.attachments.push({
			title: 'Snapshot',
			document: doc
		});
	}
	else {
		getAttachments(doc, keepPDF, itemKey).forEach((attachment) => {
			newItem.attachments.push(attachment);
		});
	}
	return newItem;
}

/* A dedicated scrape scheme for Chinese books in CNKI thingker. */
async function scrapeZhBook(doc, url) {
	var bookItem = new Z.Item(detectWeb(doc, url));
	bookItem.title = text(doc, '#b-name, .art-title > h1');
	bookItem.abstractNote = text(doc, '[name="contentDesc"], .desc-content').replace(/\n+/, '\n');
	bookItem.creators = text(doc, '.xqy_b_mid li:nth-child(2), .art-title > .art-name')
		.replace(/^责任者：/, '')
		.replace(/\s+/, ' ')
		.split(/\s/)
		.map(element => ZU.cleanAuthor(element, 'author'));
	bookItem.creators.forEach(element => element.fieldMode = 1);
	// ".bc_a > li" for book, and ".desc-info > p" for chapter
	let labels = new Labels(doc, '.bc_a > li, .desc-info > p');
	Z.debug('get labels:');
	Z.debug(labels.innerData.map(element => [element[0], ZU.trimInternal(element[1].textContent)]));
	bookItem.edition = labels.getWith('版次');
	bookItem.pages = labels.getWith('页数');
	bookItem.publisher = text(doc, '.xqy_g') || labels.getWith('出版社');
	bookItem.date = labels.getWith('出版时间')
		.replace(/(\d{4})(0?\d{1,2})(\d{1,2})/, '$1-$2-$3')
		.replace(/-$/, '');
	bookItem.language = 'zh-CN';
	bookItem.ISBN = labels.getWith('国际标准书号ISBN');
	bookItem.libraryCatalog = labels.getWith('所属分类');
	bookItem.extra = addExtra('cite', text(doc, '.book_zb_yy span:last-child'));
	bookItem.complete();
}

// add pdf or caj to attachments, default is pdf
function getAttachments(doc, keepPDF, itemKey) {
	var attachments = [];
	let pdfLink = attr(doc, 'a[id^="pdfDown"]', 'href')
		|| attr(doc, 'a[href*="/down/"]', 'href', 1)
		|| attr(doc, '.operate-btn a[href*="Download"]');
	Z.debug(`get PDF Link:\n${pdfLink}`);
	let cajLink = attr(doc, 'a#cajDown', 'href') || attr(doc, 'a[href*="/down/"]', 'href', 0) || itemKey.downloadlink;
	Z.debug(`get CAJ link:\n${cajLink}`);
	if (keepPDF && pdfLink) {
		attachments.push({
			title: 'Full Text PDF',
			mimeType: 'application/pdf',
			url: pdfLink
		});
	}
	else if (cajLink) {
		attachments.push({
			title: 'Full Text CAJ',
			mimeType: 'application/caj',
			url: cajLink
		});
	}
	else {
		attachments = [];
	}
	return attachments;
}

/* Util */
class Labels {
	constructor(doc, selector) {
		this.innerData = [];
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => element.textContent.replace(/\s/g, ''))
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				// avoid empty text
				while (!elementCopy.firstChild.textContent.replace(/\s/g, '')) {
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
					let key = tryMatch(text, /^[[【]?.*?[】\]:：]/);
					elementCopy.textContent = text.replace(new RegExp(`^${key}`), '');
					this.innerData.push([key, elementCopy]);
				}
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(element => this.getWith(element))
				.filter(element => element);
			return result.length
				? result.find(element => element)
				: '';
		}
		let pattern = new RegExp(label);
		let keyValPair = this.innerData.find(element => pattern.test(element[0]));
		if (element) return keyValPair ? keyValPair[1] : document.createElement('div');
		return keyValPair
			? ZU.trimInternal(keyValPair[1].textContent)
			: '';
	}
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function getPureText(element) {
	if (!element) return '';
	// Deep copy to avoid affecting the original page.
	let elementCopy = element.cloneNode(true);
	while (elementCopy.lastElementChild) {
		elementCopy.removeChild(elementCopy.lastElementChild);
	}
	return elementCopy.innerText;
}

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFDLAST2015&filename=SPZZ201412003&v=MTU2MzMzcVRyV00xRnJDVVJMS2ZidVptRmkva1ZiL09OajNSZExHNEg5WE5yWTlGWjRSOGVYMUx1eFlTN0RoMVQ=",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "基于部分酸水解-亲水作用色谱-质谱的黄芪多糖结构表征",
				"creators": [
					{
						"firstName": "",
						"lastName": "梁图",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "傅青",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "辛华夏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李芳冰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "金郁",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "梁鑫淼",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2014",
				"abstractNote": "来自中药的水溶性多糖具有广谱治疗和低毒性特点,是天然药物及保健品研发中的重要组成部分。针对中药多糖结构复杂、难以表征的问题,本文以中药黄芪中的多糖为研究对象,采用\"自下而上\"法完成对黄芪多糖的表征。首先使用部分酸水解方法水解黄芪多糖,分别考察了水解时间、酸浓度和温度的影响。在适宜条件（4 h、1.5mol/L三氟乙酸、80℃）下,黄芪多糖被水解为特征性的寡糖片段。接下来,采用亲水作用色谱与质谱联用对黄芪多糖部分酸水解产物进行分离和结构表征。结果表明,提取得到的黄芪多糖主要为1→4连接线性葡聚糖,水解得到聚合度4~11的葡寡糖。本研究对其他中药多糖的表征具有一定的示范作用。",
				"issue": "12",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "1306-1312",
				"publicationTitle": "色谱",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFDLAST2015&filename=SPZZ201412003&v=MTU2MzMzcVRyV00xRnJDVVJMS2ZidVptRmkva1ZiL09OajNSZExHNEg5WE5yWTlGWjRSOGVYMUx1eFlTN0RoMVQ=",
				"volume": "32",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "亲水作用色谱"
					},
					{
						"tag": "多糖"
					},
					{
						"tag": "表征"
					},
					{
						"tag": "质谱"
					},
					{
						"tag": "部分酸水解"
					},
					{
						"tag": "黄芪"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CMFD&dbname=CMFD201701&filename=1017045605.nh&v=MDc3ODZPZVorVnZGQ3ZrV3JyT1ZGMjZHYk84RzlmTXFwRWJQSVI4ZVgxTHV4WVM3RGgxVDNxVHJXTTFGckNVUkw=",
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
				"abstractNote": "黄瓜（Cucumis sativus L.）是我国最大的保护地栽培蔬菜作物,也是植物性别发育和维管束运输研究的重要模式植物。黄瓜基因组序列图谱已经构建完成,并且在此基础上又完成了全基因组SSR标记开发和涵盖330万个变异位点变异组图谱,成为黄瓜功能基因研究的重要平台和工具,相关转录组研究也有很多报道,不过共表达网络研究还是空白。本实验以温室型黄瓜9930为研究对象,选取10个不同组织,进行转录组测序,获得10份转录组原始数据。在对原始数据去除接头与低质量读段后,将高质量读段用Tophat2回贴到已经发表的栽培黄瓜基因组序列上。用Cufflinks对回贴后的数据计算FPKM值,获得10份组织的24274基因的表达量数据。计算结果中的回贴率比较理想,不过有些基因的表达量过低。为了防止表达量低的基因对结果的影响,将10份组织中表达量最大小于5的基因去除,得到16924个基因,进行下一步分析。共表达网络的构建过程是将上步获得的表达量数据,利用R语言中WGCNA（weighted gene co-expression network analysis）包构建共表达网络。结果得到的共表达网络包括1134个模块。这些模块中的基因表达模式类似,可以认为是共表达关系。不过结果中一些模块内基因间相关性同其他模块相比比较低,在分析过程中,将模块中基因相关性平均值低于0.9的模块都去除,最终得到839个模块,一共11,844个基因。共表达的基因因其表达模式类似而聚在一起,这些基因可能与10份组织存在特异性关联。为了计算模块与组织间的相关性,首先要对每个模块进行主成分分析（principle component analysis,PCA）,获得特征基因（module eigengene,ME）,特征基因可以表示这个模块所有基因共有的表达趋势。通过计算特征基因与组织间的相关性,从而挑选出组织特异性模块,这些模块一共有323个。利用topGO功能富集分析的结果表明这些特异性模块所富集的功能与组织相关。共表达基因在染色体上的物理位置经常是成簇分布的。按照基因间隔小于25kb为标准。分别对839个模块进行分析,结果发现在71个模块中共有220个cluster,这些cluster 一般有2～5个基因,cluster中的基因在功能上也表现出一定的联系。共表达基因可能受到相同的转录调控,这些基因在启动子前2kb可能会存在有相同的motif以供反式作用元件的结合起到调控作用。对839个模块中的基因,提取启动子前2kb的序列,上传到PLACE网站进行motif分析。显著性分析的结果表明一共有367个motif存在富集,其中6个motif已经证实在黄瓜属植物中发挥作用。最后结合已经发表的黄瓜苦味生物合成途径研究,找到了 3个模块,已经找到的11个基因中,有10个基因在这4个模块中。这些模块的功能富集也显示与苦味合成相关,同时这些参与合成的基因在染色体上也成簇分布。本论文所描述的方法结合了转录组测序与网络分析方法,发现了黄瓜中的共表达基因模块,为黄瓜基因的共表达分析提供了非常重要的研究基础和数据支持。",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"thesisType": "硕士学位论文",
				"university": "南京农业大学",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CMFD&dbname=CMFD201701&filename=1017045605.nh&v=MDc3ODZPZVorVnZGQ3ZrV3JyT1ZGMjZHYk84RzlmTXFwRWJQSVI4ZVgxTHV4WVM3RGgxVDNxVHJXTTFGckNVUkw=",
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
		"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CPFD&dbname=CPFD9908&filename=OYDD199010001004&v=MDI5NTRITnI0OUZaZXNQQ0JOS3VoZGhuajk4VG5qcXF4ZEVlTU9VS3JpZlplWnZGeW5tVTdqSkpWb1RLalRQYXJLeEY5",
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
					}
				],
				"date": "1990-10",
				"abstractNote": "辽西区的范围从大兴安岭南缘到渤海北岸,西起燕山西段,东止辽河平原,基本上包括内蒙古的赤峰市（原昭乌达盟）、哲里木盟西半部,辽宁省西部和河北省的承德、唐山、廊坊及其邻近的北京、天津等地区。这一地区的古人类遗存自旧石器时代晚期起,就与同属东北的辽东区有着明显的不同,在后来的发展中,构成自具特色的一个考古学文化区,对我国东北部起过不可忽视的作用。以下就辽西地区新石器时代的考古学文化序列、编年、谱系及有关问题简要地谈一下自己的认识。",
				"conferenceName": "内蒙古东部地区考古学术研讨会",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "6",
				"place": "中国内蒙古赤峰",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CPFD&dbname=CPFD9908&filename=OYDD199010001004&v=MDI5NTRITnI0OUZaZXNQQ0JOS3VoZGhuajk4VG5qcXF4ZEVlTU9VS3JpZlplWnZGeW5tVTdqSkpWb1RLalRQYXJLeEY5",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
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
				"abstractNote": "目的利用生物信息学方法探索2型糖尿病发病的相关基因,并研究这些基因与阿尔茨海默病的关系。方法基因表达汇编（GEO）数据库下载GSE85192、GSE95849、GSE97760、GSE85426数据集,获得健康人和2型糖尿病患者外周血的差异基因,利用加权基因共表达网络（WGCNA）分析差异基因和临床性状的关系。使用DAVID数据库分析与2型糖尿病有关的差异基因的功能与相关通路,筛选关键蛋白。根据结果将Toll样受体4 （TLR4）作为关键基因,利用基因集富集分析（GSEA）分析GSE97760中与高表达TLR4基因相关的信号通路。通过GSE85426验证TLR4的表达量。结果富集分析显示,差异基因主要参与的生物学过程包括炎症反应、Toll样受体（TLR）信号通路、趋化因子产生的正向调节等。差异基因主要参与的信号通路有嘧啶代谢通路、TLR信号通路等。ILF2、TLR4、POLR2G、MMP9为2型糖尿病的关键基因。GSEA显示,TLR4上调可通过影响嘧啶代谢及TLR信号通路而导致2型糖尿病及阿尔茨海默病的发生。TLR4在阿尔茨海默病外周血中高表达。结论 ILF2、TLR4、POLR2G、MMP9为2型糖尿病发病的关键基因,TLR4基因上调与2型糖尿病、阿尔茨海默病发生有关。",
				"issue": "12",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"publicationTitle": "中国医科大学学报",
				"url": "https://chn.oversea.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFD&dbname=CJFDLAST2020&filename=ZGYK202012011&v=%25mmd2BHGGqe3MG%25mmd2FiWsTP5sBgemYG4X5LOYXSuyd0Rs%25mmd2FAl1mzrLs%25mmd2F7KNcFfXQMiFAipAgN",
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
		"url": "https://thinker.cnki.net/bookstore/book/bookdetail?bookcode=9787111520269000&type=book",
		"items": [
			{
				"itemType": "book",
				"title": "近红外光谱技术在食品品质检测方法中的研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘翠玲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴静珠",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙晓荣",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-1-1",
				"ISBN": "9787111520269",
				"abstractNote": "本书从社会实际需求出发，根据多年的科研经验和成果，与多年从事测控信息处理、食品等相关专业的研究人员合作，融入许多解决实际问题的研究和实践成果，系统介绍了本课题组基于近红外光谱分析技术在果蔬类农药残留量的检测、食用植物油品质、小麦粉、淀粉的品质检测中的应用研究成",
				"edition": "1",
				"extra": "cite: 34",
				"language": "zh-CN",
				"publisher": "机械工业出版社",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://thinker.cnki.net/BookStore/chapter/chapterdetail?bookcode=9787111520269000_174&type=chapter#div6",
		"items": [
			{
				"itemType": "bookSection",
				"title": "第8章 基于近红外光谱的淀粉品质检测方法研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘翠玲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴静珠",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙晓荣",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015",
				"abstractNote": "8.1||简介\n淀粉是以谷类、薯类、豆类为原料,不经过任何化学方法处理,也不改变淀粉内在的物理和化学特性加工而成的。它是日常生活中必不可少的作料之一,如煎炸烹炒,做汤勾芡都少不了要用到淀粉。随着食用淀粉在现代食品加工业中的广泛应用,淀粉生产和加工贸易取得了较大的发展。常见的产品主要有玉米淀粉、马铃薯淀粉、红薯淀粉和绿豆淀粉等,不同种类的淀粉价格差别较大,有的相差高达10倍以上,但是不同种类淀粉颗粒的宏观外观和普通物化指标差别不明显,无法辨认。由于缺乏相应的食用淀粉鉴别检验技术标准,国内淀粉市场严格监管很难执...",
				"language": "zh-CN",
				"publisher": "机械工业出版社",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://inds.cnki.net/kcms/detail?dbcode=&dbname=DKCTLKCMFDTEMP&filename=1023734733.nh&pcode=DKCT&zylx=",
		"items": [
			{
				"itemType": "thesis",
				"title": "铜离子表面印迹材料的制备及其催化性能研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "吕智博",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "迟子芳",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李怀",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "含铜废水污染广泛、毒性大,已严重威胁生态环境和人体健康。吸附法是一种常见的金属铜去除方法,通过物理化学吸附作用广泛应用于富集和分离金属铜。由于环境介质中污染情况复杂,环境污染风险高,因此需要一种针对于目标离子高效去除及选择性识别能力的技术。表面离子印迹技术通过选择合适的功能单体、交联剂及基底材料制备针对于目标离子形成特异性识别位点的材料,具有较高的选择性。本文以氧化石墨烯（GO）为印迹母体材料、四氧化三铁（Fe3O4/M）为磁性组分,二价铜离子（Cu（Ⅱ））作为模版离子,经过有机-无机杂化功能单体ATPES（硅烷偶联剂350）-MAA（甲基丙烯酸）,以及交联剂二甲基丙烯酸乙二醇酯（EGDMA）结合作用,成功制备了高效选择去除铜离子的铜离子表面印迹聚合物（MS/MGO-Cu-iip）。为确定该材料的最佳合成及反应条件,本文通过功能单体喂料比,动力学,热力学分析等进行探究。此外,在印迹材料循环吸附重金属五次后,吸附剂吸附能力下降,对于废弃物处理需要一种经济、高效的手段来有效利用印迹材料。本文制备的铜离子印迹材料不但解决了污水中铜污染的问题,并且将铜离子印迹材料作为一种高效的催化剂活性成分,直接加间接催化降解四环素,大大提高了材料回收利用及环保的经济价值。针对于将MS/MGO-Cu-iip磁性回收并将其作为非均相催化剂结合氧气催化降解四环素（TC）是本研究的亮点,本文主要结论如下:（1）硅烷偶联剂（APTES）和甲基丙烯酸（MAA）的喂料比是材料吸附性能效果的重要因素。最佳合成条件为:APTES 14 m L、MAA 51 m L、Cu（Ⅱ）8 mmol、MGO 0.5 g。探究了Zn（Ⅱ）、Pb（Ⅱ）、Cd（Ⅱ）和Ni（Ⅱ）作为Cu（Ⅱ）的对比离子进行竞争的影响。结果表明,影响吸附容量的因素为金属离子的水合离子半径,并且在双元体系中,MS/MGO-Cu-iip对Cu（II）吸附容量有所下降,但下降效果有限。MS/MGO-Cu-iip对铜离子具有较高的选择性吸附效果。（2）通过扫描电镜（SEM）、磁敏性分析（VSM）、比表面积,孔径分析（BET）、X射线晶体衍射表征分析（XRD）对MS/MGO-Cu-iip进行表征分析。结果表明:反应前MS/MGO-Cu-iip材料表面呈不规则且具有丰富印迹空穴结构,反应后印迹空穴成功捕获铜离子,致使吸附位点充分填充;与磁性氧化石墨烯（MGO）相比,印迹材料的制备导致MS/MGO-Cu-iip比饱和磁场强度在一定程度上减弱,但材料仍为超顺磁性。两者的饱和磁化强度分别为42.2 emu/g和57.3 emu/g。BET分析表明,表面印迹材料为介孔材料,MGO与MS/MGO-Cu-iip的比表面积分别为88.54 m2/g和155.55 m2/g;Fe3O4成功结合在GO之上,且交联过程没有改变材料的基本结构。MS/MGO-Cu-iip在5次循环使用后,可用反应位点不断减少,其对Cu（Ⅱ）吸附性能逐步下降到80%以下。（3）为了使循环后的印迹材料“变废为宝”。针对MS/MGO-Cu-iip作为非均相催化剂高效利用,进行四环素（TC）的催化降解。结果表明,在不同材料投加量和TC初始投加量下,MS/MGO-Cu-iip活化活性氧物质（ROS）对TC的去除效果均好于单独使用GO或MGO。值得注意的是,由于铜离子的介入,致使非均相催化剂相较于传统芬顿反应,在中性条件下也具有良好的TC去除效果。在自由基淬灭试验中,O2·-为TC去除反应的主要活性自由基。此外,依据通氮气和脱附试验计算,TC对MS/MGO-Cu-iip的吸附率和降解率分别为30.98%和63.10%。其中,MS/MGO-Cu-iip对TC的直接降解率和间接降解率分别为45.93%和17.17%。",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"thesisType": "硕士学位论文",
				"university": "吉林大学",
				"url": "https://inds.cnki.net/kcms/detail?dbcode=&dbname=DKCTLKCMFDTEMP&filename=1023734733.nh&pcode=DKCT&zylx=",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "copper ion surface imprinting"
					},
					{
						"tag": "heterogeneous catalyst"
					},
					{
						"tag": "reuse of imprinted materials"
					},
					{
						"tag": "selective adsorption"
					},
					{
						"tag": "tetracycline"
					},
					{
						"tag": "印迹材料的再利用"
					},
					{
						"tag": "四环素"
					},
					{
						"tag": "选择性吸附"
					},
					{
						"tag": "铜离子表面印迹"
					},
					{
						"tag": "非均相催化剂"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cnki.com.cn/Article/CJFDTOTAL-ZNJJ202310008.htm",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "“两山”理念的有效载体与实践：林下经济的经济效应、环境效应及其协同逻辑",
				"creators": [
					{
						"firstName": "",
						"lastName": "吴伟光",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "许恒",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王凤婷",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "熊立春",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "林下经济是生态文明建设背景下推进山区绿色高质量发展、实现“两山”理念的重要载体。本文基于里昂惕夫生产函数和最优生产决策理论刻画林下经济的经济效应、环境效应及其协同的理论模型，并通过对典型案例县的研究，对林下经济的经济效应与环境效应协同发展的理论机制加以印证。研究发现：第一，林下经济经营中，给定其他条件不变，当劳动力投入效率增加时，劳动力投入先增加后降低、林地投入单调递增，林下经济的经济价值也是单调递增，而林下经济的生态价值先增加后降低，林下经济的经济价值和生态价值总和递增；第二，进一步基于扩展模型的分析发现，在适度经营规模下，林下经济产生生态反馈效应，经营主体不再单纯追求经济利润最大化，而是通过降低林地要素的投入来提高林地资源的生态反馈效应，从而提升环境效应，最终实现经济效应和环境效应协同发展；第三，浙江省松阳县的案例剖析表明，在政府的合理扶持下，依靠适度规模经营、生态化种植和三产融合能够实现林下经济的经济效应与环境效应协同发展。因此，林下经济作为“两山”理念的有效载体，应积极推广，通过科学有效经营，能够实现经济效应和环境效应的协同增长。",
				"issue": "10",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "158-174",
				"publicationTitle": "中国农村经济",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFD&dbname=CJFDAUTO2023&filename=ZNJJ202310008&v=",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CCND&dbname=CCNDLAST2023&filename=KJRB202309210044&v=",
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
				"abstractNote": "科技日报北京9月20日电 （记者刘霞）瑞典国家分子生物科学中心科学家首次分离和测序了一个已灭绝物种的RNA分子，从而重建了该灭绝物种（塔斯马尼亚虎）的皮肤和骨骼肌转录组。该项成果对复活塔斯马尼亚虎和毛猛犸象等灭绝物种，以及研究如新冠病毒等RNA病毒具有重要意义。相?",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "4",
				"publicationTitle": "科技日报",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CCND&dbname=CCNDLAST2023&filename=KJRB202309210044&v=",
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
		"url": "https://t.cnki.net/kcms/article/abstract?v=hqt_j-uEELGSLvtgfx2DVRxu9hbobgYrzQM3qkFcwxOVpORfI69a9hTWtAs-pPLWmSBjAiedoGDickqGBeqDgHdui5mzNYguPjqqm7qe0730Wy6IeHRrQUWY1n75lu9wEYSllSA6s9s=&uniplatform=NZKPT",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "压型钢板-聚氨酯夹芯楼板受弯性能研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "王腾",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "冯会康",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "乔文涛",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "苏佶智",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王丽欢",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022",
				"DOI": "10.13206/j.gjgS22031502",
				"abstractNote": "金属面夹芯板以其保温绝热、降噪、自重轻和装配效率高等优点在围护结构中得到了很好的应用，基于金属面夹芯板的构造，提出一种新型的压型钢板与聚氨酯组合的夹芯楼板结构。为了研究压型钢板-聚氨酯夹芯楼板的受弯性能，对夹芯楼板试件进行了两点对称静载试验。在试验的基础上，提出并验证了夹芯楼板有限元模型，并对槽钢楼板厚度、压型钢板厚度和聚氨酯密度等进行了参数分析。研究结果表明：夹芯楼板的破坏形式主要表现为挠度过大，最大挠度达到了板跨度的1/42,并且跨中截面处的槽钢出现畸变屈曲；夹芯楼板受弯变形后，槽钢首先达到屈服状态，而受压钢板的材料性能未能得到充分发挥；新型压型钢板聚氨酯夹芯楼板相比传统金属面夹芯板的承载能力和刚度有明显提升，承载力和刚度均提高203%;楼板厚度和压型钢板厚度对夹芯楼板的承载能力和刚度均具有显著影响，而楼板厚度相比压型钢板厚度对刚度的影响效果更明显，当楼板厚度从120 mm增大到160 mm时，夹芯楼板的承载力在正常使用状态下提高87%,在承载能力极限状态下提高63%,刚度提高88%,钢板厚度由1 mm增至3 mm时，夹芯楼板的承载力在正常使用状态下提高59%,在承载能力极限状态下提高84%,刚度提高61%;聚氨酯泡沫密度的变化对夹芯楼板的承载能力和刚度影响较小，当密度从45 kg/m<sup>3</sup>变化到90 kg/m<sup>3</sup>时，正常使用状态下夹芯楼板的承载力增幅为12%,承载能力极限状态下的承载力增幅仅为2%,刚度增幅为12%。",
				"issue": "8",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "9-16",
				"publicationTitle": "钢结构(中英文)",
				"url": "https://t.cnki.net/kcms/article/abstract?v=hqt_j-uEELGSLvtgfx2DVRxu9hbobgYrzQM3qkFcwxOVpORfI69a9hTWtAs-pPLWmSBjAiedoGDickqGBeqDgHdui5mzNYguPjqqm7qe0730Wy6IeHRrQUWY1n75lu9wEYSllSA6s9s=&uniplatform=NZKPT",
				"volume": "37",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "压型钢板"
					},
					{
						"tag": "受弯性能"
					},
					{
						"tag": "夹芯楼板"
					},
					{
						"tag": "有限元分析"
					},
					{
						"tag": "静载试验"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=hqt_j-uEELHgLjhVNERafpOMj4EDV7-j9ZKXv3QjqYLauJu1jZonbySDN7NdTxP89ZRbEb74WGJU6Ue5Ew7P8MPqFzTNTsD1AUMujHfQ9NrE3lh8jv2FHKJ9wCzq-0L2BzEAi_jJKFmSZp7Nce3arw==&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "standard",
				"title": "粮油检验　小麦粉膨胀势的测定",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国粮油标准化技术委员会(SAC/TC 270)",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019-05-10",
				"extra": "applyDate: 2019-12-01",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"number": "GB/T 37510—2019",
				"status": "现行",
				"type": "国家标准",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=SCSF&dbname=SCSF&filename=SCSF00058274&v=",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=hqt_j-uEELFh-0x72PDDFlk4L3Q06bx-Aw8_PZo38665XqHiWONkvmAl_MapyRqrU0K-wDy2cOi7kGHcQsG2NAhlAQ6f-u2vj1AVdjUPbZkpj95j-3pnqpgjHGPc6nOAc6WqvrEbl7o=&uniplatform=CHKD",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "略谈肿瘤病的辨治要领",
				"creators": [
					{
						"firstName": "",
						"lastName": "熊继柏",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-11-23",
				"abstractNote": "笔者根据多年临床实践经验,总结中医诊治肿瘤病的四辨:辨部位、辨痰瘀、辨寒热、辨虚实,阐述肿瘤治疗四法:攻法、消法、散法、补法,并通过临床验案分享诊疗经验,以供同仁参考。",
				"extra": "status: advance online publication",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "1-5",
				"publicationTitle": "湖南中医药大学学报",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CHKJ&dbname=CHKJCAPJ&filename=HNZX20231121001&v=",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "中医治法"
					},
					{
						"tag": "临床辨证"
					},
					{
						"tag": "临床验案"
					},
					{
						"tag": "国医大师"
					},
					{
						"tag": "熊继柏"
					},
					{
						"tag": "肿瘤"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=hqt_j-uEELEIIUdFv9kRm1Mah8H4G3CAV0XKVQng-WEkrfZb07GimDqvWKEl2-u2V4q_XV_Xl3w3Uu6JvDSUCPq15jVihZO87YRdxnBPDjW-7gi8c-NJ8jBfjF-HyWBH2k5d_psm1M9CdEHFZ9yyosImddQGWLfbxlVssmcHR_dTVMa3QRn82Q==&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "book",
				"title": "Economy, Society & Culture in Contemporary Yemen",
				"creators": [
					{
						"firstName": "B. R.",
						"lastName": "Pridham",
						"creatorType": "author"
					}
				],
				"ISBN": "9781003165156",
				"language": "en-US",
				"libraryCatalog": "CNKI",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=WWBD&dbname=GARBLAST&filename=STBD3CF0CF2800E929699A2F05BC9DBD89F7&v=",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://inds.cnki.net/kcms/detail?dbcode=&dbname=AKZTLKCAPJLAST&filename=XJKB20230821001&pcode=AKZT&zylx=&uid=WEEvREcwSlJHSldSdmVqelcxWUxlMTZJa2Z6N0Z0eUN4TXBCRUlLRTJwaz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "陶瓷的激光连接技术研究进展",
				"creators": [
					{
						"firstName": "",
						"lastName": "黄常聪",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈健",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "马宁宁",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "祝明",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈文辉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李凡凡",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "黄政仁",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "随着材料加工快速化、智能化、数字化的发展要求，材料连接技术越来越受到广泛的重视，其中激光连接陶瓷技术是引人关注的重要技术之一，论述了近年来激光连接陶瓷技术的研究现状与进展。首先阐述了激光连接技术的原理和分类；其次对适合陶瓷激光连接的激光器类型和特点进行了介绍，并分析了影响激光连接陶瓷质量的关键因素；然后对基于激光连接技术的陶瓷与陶瓷之间的连接以及陶瓷与异质材料之间的连接进展进行了详细的介绍，阐述了各种激光连接陶瓷方法的特点、机理和连接强度；最后对激光连接陶瓷技术进行总结，并展望其发展趋势。",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "1-9",
				"publicationTitle": "中国材料进展",
				"url": "https://inds.cnki.net/kcms/detail?dbcode=&dbname=AKZTLKCAPJLAST&filename=XJKB20230821001&pcode=AKZT&zylx=&uid=WEEvREcwSlJHSldSdmVqelcxWUxlMTZJa2Z6N0Z0eUN4TXBCRUlLRTJwaz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "ceramics"
					},
					{
						"tag": "dissimilar materials"
					},
					{
						"tag": "joint strength"
					},
					{
						"tag": "laser joining"
					},
					{
						"tag": "lasers"
					},
					{
						"tag": "异质材料"
					},
					{
						"tag": "激光器"
					},
					{
						"tag": "激光连接"
					},
					{
						"tag": "连接强度"
					},
					{
						"tag": "陶瓷材料"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
