{
	"translatorID": "5c95b67b-41c5-4f55-b71a-48d5d7183063",
	"label": "CNKI",
	"creator": "Aurimas Vinckevicius, Xingzhong Lin, jiaojiaodubai",
	"target": "https?://.*?(cnki\\.net)?/(kns8?s?|kcms2?|KNavi)/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 150,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-03-18 07:51:29"
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

function detectWeb(doc, _url) {
	// For thesis and conference paper, pulication infomation is loaded dynamically
	const doctop = doc.querySelector('.doc-top');
	if (doctop) {
		Z.monitorDOMChanges(doctop, { childList: true, subtree: true });
	}
	const dbcode = attr(doc, paramsMap.dbcode, 'value');
	for (const lang in exports.typeMap) {
		const type = exports.typeMap[lang][dbcode];
		if (type) return type;
	}
	for (const map of Object.values(exports.typeMap)) {
		const type = map[dbcode];
		if (type) return type;
	}
	if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const multiplePage = [

		/* Search result */
		{
			path: /\/defaultresult\/|\/search\?|\/AdvSearch\?/,
			dynamicElm: '#ModuleSearchResult',
			row: '.result-table-list > tbody > tr',
			// Yearbook titles use `.yearbook-title`; current selector is sufficient as yearbooks are not handled
			title: row => innerText(row, '.name'),
			href: row => attr(row, '.name > a', 'href')
		},

		/* Navigation of publication */
		{
			path: /\/knavi\/detail\?/,
			dynamicElm: '#rightCatalog',
			// `dd > .name` for journal, conference, newspaper;`tr > .name` for thesis
			row: '#rightCatalog :is(dd, tr)',
			filter: row => row.querySelector('.name'),
			title: row => innerText(row, '.name'),
			href: row => attr(row, '.name > a', 'href')
		},

		/* Author profile */
		{
			path: /\/author\/detail\?/,
			dynamicElm: '.main > .container',
			row: '#kcms-author-literatures ul.ebBd > li',
			title: row => attr(row, 'a', 'title'),
			href: row => attr(row, 'a', 'href')
		}
	];
	for (const page of multiplePage) {
		if (page.path.test(doc.location.href)) {
			const target = doc.querySelector(page.dynamicElm);
			if (target) {
				Z.monitorDOMChanges(target, { childList: true, subtree: true });
			}
			const items = {};
			let found = false;
			// Compatiblity with old browser that doesn't support `:has()` selector
			const rows = Array.from(target.querySelectorAll(page.row))
				.filter(row => !page.filter || page.filter(row));
			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				// Ensure compatibility with multi-item pages on subsites (e.g., CHKD)
				// Replace `uniplatform` parameter to redirect to the main site
				const href = page.href(row).replace(/(&uniplatform=)([A-Z]+)/, '$1NZKPT');
				const title = `【${i + 1}】 ${page.title(row)}`;
				if (!href || !title) continue;
				if (checkOnly) return true;
				found = true;
				items[href] = title;
			}
			return found ? items : false;
		}
	}
	return false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const isScholar = doc.querySelector('.main-scholar');
	if (isScholar) {
		await scrapeScholar(doc, url);
	}
	else if (url.includes('thinker.cnki')) {
		const translator = Z.loadTranslator('web');
		// CNKI thinker
		translator.setTranslator('5393921c-d543-4b3a-a874-070b5d73b03a');
		translator.setDocument(doc);
		await translator.translate();
	}
	else {
		await scrapeMain(doc, url);
	}
}

async function scrapeScholar(doc, url) {
	const data = exports.data ?? getLabeledData(
		doc.querySelectorAll('.wx-tit-scholar > h3'),
		row => innerText(row, 'b').replace(/：$/, ''),
		row => row.querySelector('b+span'),
		doc.createElement('div')
	);
	const detail = getLabeledData(
		doc.querySelectorAll('.doc-detail-scholar .row'),
		row => innerText(row, '.rowtit'),
		row => removeNode(row, '.rowtit'),
		doc.createElement('div')
	);
	try {
		// When debugging, uncomment the following line to jump to `catch` block
		// throw new Error('debug');
		await scrapeSearch({ DOI: data('DOI'), ISBN: detail('ISBN') });
	}
	catch (e) {
		Z.debug('Failed to use search translator, falling back to page scraping');
		Z.debug(e);
		const newItem = new Z.Item(detectWeb(doc, url));
		const titleNode = doc.querySelector('.h1-scholar');
		newItem.title = ZU.capitalizeTitle(removeNode(titleNode, '.mt-trans').innerText);
		newItem.DOI = data('DOI');
		doc.querySelectorAll('#authorpart a').forEach((elm) => {
			newItem.creators.push(cleanAuthor(elm.innerText.trim().replace(/;$/, '')));
		});
		// Last line may point to original source, we prefer it
		setExtra(newItem, 'Source URL', attr(doc, '.all-source p:last-child a', 'href'));
		switch (newItem.itemType) {
			case 'journalArticle': {
				newItem.abstractNote = innerText(doc, '.abstract-text', 1);
				newItem.publicationTitle = innerText(doc, '.top-tip-scholar a[href*="/journal/"]');
				const pubInfo = innerText(doc, '.top-tip-scholar');
				const match = /Volume (?<volume>\d+)?\s*,\s*Issue (?<issue>\d+)?\s*\.\s*(?<year>\d{4})\.\s*PP\s*(?<pages>[a-z\d]+|[a-z\d]+-[a-z\d]+)/.exec(pubInfo);
				if (match && match.groups) {
					newItem.date = match.groups.year;
					newItem.volume = match.groups.volume;
					newItem.issue = match.groups.issue;
					newItem.pages = match.groups.pages;
				}
				doc.querySelectorAll('#keyword_cn a').forEach((elm) => {
					newItem.tags.push(elm.innerText.trim().replace(/;$/, ''));
				});
				break;
			}
			case 'book': {
				newItem.abstractNote = detail('Abstract');
				const pubInfo = innerText(doc, '.top-tip-scholar');
				const match = /\| (?<publisher>.+?) (?<year>\d{4})/.exec(pubInfo);
				if (match && match.groups) {
					newItem.publisher = match.groups.publisher;
					newItem.date = match.groups.year;
				}
				newItem.language = detail('Language').toLowerCase();
				newItem.ISBN = ZU.cleanISBN(detail('ISBN'));
				detail('Keywords', true).querySelectorAll('a').forEach((elm) => {
					newItem.tags.push(elm.innerText.replace(/;$/, ''));
				});
				break;
			}
			default:
				break;
		}
		newItem.complete();
	}
}

async function scrapeSearch(item) {
	if (Object.keys(item).length === 0) throw new Error('no identifier available');
	const translator = Z.loadTranslator('search');
	translator.setSearch(item);
	translator.setHandler('translators', (_, translators) => {
		translator.setTranslator(translators);
	});
	translator.setHandler('error', () => { });
	await translator.getTranslators();
	await translator.translate();
}

async function scrapeMain(doc, url) {
	const itemType = detectWeb(doc, url);
	let rows = [];
	try {
		rows = doc.querySelectorAll('.main .container :has(>[class^="rowtit"])');
	} catch (e) {
		// Compatibility with old browser that doesn't support `:has()` selector
		const titles = doc.querySelectorAll('.main .container [class^="rowtit"]');
		const uniqueRows = new Set();
		for (const title of titles) {
			if (title.parentElement) {
				uniqueRows.add(title.parentElement);
			}
		}
		rows = Array.from(uniqueRows);
	}
	const data = exports.data ?? getLabeledData(
		// 1. Most case: .row > .rowtit
		// 2. Patent and standard: .row > .row-2 > .rowtit2
		// 3. Journal article: .row > ul > li.top-space > .rowtit
		rows,
		row => innerText(row, '[class^="rowtit"]').replace(/：$/, ''),
		row => removeNode(row, '[class^="rowtit"]'),
		doc.createElement('div')
	);
	const params = {};
	for (const [key, selector] of Object.entries(paramsMap)) {
		params[key] = attr(doc, selector, 'value');
	}
	const totalInfo = {};
	doc.querySelectorAll('.total-inform > span:not(:last-child)').forEach((elm) => {
		const match = /^(?<label>.+)：(?<value>.+)$/.exec(elm.innerText);
		if (match && match.groups && match.groups.value) {
			totalInfo[match.groups.label] = match.groups.value;
		}
	});
	const newItem = new Z.Item(itemType);
	newItem.title = extractTitle(doc.querySelector('.wx-tit > h1'));
	// Abstract in '.row' may be chuncated, so we prefer to use data from '#abstract_text' instead
	newItem.abstractNote = innerText(doc, '.abstract-text');
	const doi = data('DOI');
	newItem.DOI = doi;
	if (doi) {
		newItem.url = doi.includes('.cnki.')
			? `https://link.cnki.net/doi/${doi}`
			: `https://doi.org/${doi}`;
	}
	else {
		newItem.url = 'https://kns.cnki.net/KCMS/detail/detail.aspx?'
			+ `dbcode=${params.dbcode}`
			+ `&dbname=${params.dbname}`
			+ `&filename=${params.filename}`;
	}
	newItem.language = detectLanguage(params.dbcode);
	setExtra('CNKICite', innerText(doc, '#RefAuthorArea .num') || innerText(doc, '#citations+span').substring(1, -1));
	setExtra('dbcode', params.dbcode);
	setExtra('dbname', params.dbname);
	setExtra('filename', params.filename);
	switch (itemType) {
		case 'journalArticle': {
			const pubInfo = ZU.trimInternal(innerText(doc, '.top-tip'));
			const match = /^(?<publicationTitle>.+?)\s?\.\s?(?<year>\d{4})?\s?(,(?<volume>\d+))?\s?(\(0*(?<issue>\d+)\))?\s?(:(?<pages>[\d,\s-]+))?/.exec(pubInfo);
			newItem.publicationTitle = match.groups.publicationTitle.replace(/\((\p{Unified_Ideograph}+)\)$/u, '（$1）');
			newItem.date = match.groups.year;
			newItem.volume = match.groups.volume;
			newItem.issue = match.groups.issue;
			newItem.pages = match.groups.pages;
			if (!newItem.pages) {
				newItem.pages = totalInfo.页码;
			}
			if (doc.querySelector('.icon-shoufa')) {
				setExtra(newItem, 'Status', 'advance online publication');
				newItem.date = ZU.strToISO(text(doc, '.head-time'));
			}
			setExtra(newItem, 'Fund', data('基金资助'));
			const isTagged = doc.querySelector('#authorpart > span > a');
			if (isTagged) {
				doc.querySelectorAll('#authorpart > span > a').forEach((elm) => {
					const nameElm = removeNode(elm, 'sup');
					newItem.creators.push(cleanAuthor(nameElm.innerText.trim()));
				});
			}
			else {
				innerText(doc, '#authorpart').split(',').forEach((name) => {
					newItem.creators.push(cleanAuthor(name));
				});
			}
			try {
				const patch = await getItemFromAPI(doc);
				if (patch) {
					newItem.ISSN = patch.ISSN;
					newItem.volume = patch.volume || newItem.volume;
					newItem.issue = patch.issue || newItem.issue;
					newItem.pages = patch.pages || newItem.pages;
				}
			}
			catch (e) {
				Z.debug('Failed to get additional information from API');
				Z.debug(e);
			}
			break;
		}
		case 'thesis': {
			newItem.university = innerText(doc, '.top-tip a[href*="/knavi/"]').replace(/\((\p{Unified_Ideograph}+)\)$/u, '（$1）');
			newItem.thesisType = {
				CMFD: '硕士学位论文',
				CDFD: '博士学位论文',
				CDMH: '硕士学位论文'
			}[params.dbcode];
			newItem.date = ZU.strToISO(innerText(doc, '#ndate'));
			newItem.numPages = totalInfo.页数;
			setExtra(newItem, 'Major', data('学科专业'));
			setExtra(newItem, 'Fund', data('基金资助'));
			newItem.creators.push(cleanAuthor(innerText(doc, '#authorpart')));
			data('导师').split(/[;；]\s*/).forEach((str) => {
				newItem.creators.push(cleanAuthor(str.trim(), 'contributor'));
			});
			try {
				const patch = await getItemFromAPI(doc);
				if (patch) {
					// `date` from page is online publish date, we prefer `date` from API which is graduation date
					newItem.date = patch.date;
				}
			}
			catch (e) {
				Z.debug('Failed to get additional information from API');
				Z.debug(e);
			}
			break;
		}
		case 'conferencePaper': {
			newItem.abstractNote = data('摘要');
			newItem.date = ZU.strToISO(data('会议时间'));
			newItem.proceedingsTitle = attr(doc, '.top-tip > :first-child', 'title');
			newItem.conferenceName = data('会议名称');
			newItem.eventPlace = data('会议地点');
			newItem.pages = data('页码');
			doc.querySelectorAll('#authorpart > span > a').forEach((elm) => {
				newItem.creators.push(cleanAuthor(elm.innerText.trim()));
			});
			try {
				Z.debug('Try to get publication infomation from API');
				const apiHost = attr(doc, '#apiHost', 'value') || 'https://kns.cnki.net/restapi';
				// The following code simulates the `body > script:not([type])` script on the detail page
				const vv = attr(doc, '#publication-api-vv', 'value');
				const clientId = attr(doc, '#publication-api-clientId', 'value');
				const postUrl = `${apiHost}/knavi-api/v1/criteria/query`
					+ `?vv=${vv}`
					+ `&clientId=${clientId}`;
				const postData = {
					Resource: "",
					// "M4YX7Q77" for Conference, for more classid, see `.doctype-menus` element in search result page
					Classid: "M4YX7Q77",
					Products: "",
					QNode: {
						QGroup: [
							{
								Key: "subject",
								Title: "",
								Logic: 0,
								Items: [
									{
										Field: "BH",
										Value: attr(doc, '#publicationcode', 'value'),
										Operator: "DEFAULT",
										Logic: 0
									}
								],
								ChildItems: []
							}
						]
					},
					ExScope: 1,
					SearchType: 2,
					Rlang: "Both",
					sort: "",
					sortType: "",
					pageNum: 1,
					pageSize: 5
				};
				const respond = await requestJSON(
					postUrl,
					{
						method: 'POST',
						body: JSON.stringify(postData)
					}
				);
				const metadata = respond.data.data[0].metadata;
				const getValue = (tag) => {
					const entry = metadata.find(e => e.name === tag);
					return entry ? entry.value : "";
				};
				newItem.publisher = getValue("AF");
				newItem.place = getValue("PL");
				newItem.date = getValue("DT");
				newItem.ISBN = ZU.cleanISBN(getValue("BN"));
			}
			catch (e) {
				Z.debug('Failed to get publication information from API');
				Z.debug(e);
			}
			break;
		}
		case 'newspaperArticle': {
			const subTitle = data('副标题');
			if (subTitle) {
				newItem.shortTitle = newItem.title;
				newItem.title = `${newItem.title}：${subTitle}`;
			}
			newItem.publicationTitle = innerText(doc, '.top-tip > a');
			newItem.date = ZU.strToISO(data('报纸日期'));
			newItem.pages = data('版号').replace(/^0*/, '');
			doc.querySelectorAll('#authorpart > span').forEach((elm) => {
				newItem.creators.push(cleanAuthor(elm.innerText));
			});
			break;
		}
		case 'patent': {
			newItem.patentNumber = data('申请公布号');
			newItem.applicationNumber = data('申请(专利)号');
			const translate = Z.loadTranslator('import');
			// CNKI Refer
			translate.setTranslator('7b6b135a-ed39-4d90-8e38-65516671c5bc');
			const { patentCountry } = await translate.getTranslatorObject();
			newItem.place = newItem.country = patentCountry(newItem.patentNumber || newItem.applicationNumber, newItem.language);
			newItem.assignee = data('申请人');
			newItem.filingDate = data('申请日');
			newItem.issueDate = data('授权公告日');
			newItem.rights = ZU.trimInternal(innerText(doc, '.claim > h5 + div'));
			setExtra('Genre', data('专利类型'));
			data('发明人', true)
				.querySelectorAll('a')
				.forEach((elm) => {
					newItem.creators.push(cleanAuthor(elm.innerText.replace(/;\s*$/, ''), 'inventor'));
				});
			data('代理人').split(/;\s*/).forEach((name) => {
				newItem.creators.push(cleanAuthor(name, 'attorneyAgent'));
			});
			data('代理机构').split(/;\s*/).forEach((name) => {
				newItem.creators.push(cleanAuthor(name, 'attorneyAgent'));
			});
			break;
		}
		case 'standard': {
			let titleNode = doc.querySelector('.wx-tit > h1');
			// Remove status tag:
			// In CNKI main site, this is a.type
			// In CHKD site, this is span.type
			// So we use `.type` for compatibility
			titleNode = removeNode(titleNode, '.type');
			// Remove English title
			titleNode = removeNode(titleNode, 'br+span');
			newItem.title = titleNode.textContent.trim();
			newItem.abstractNote = innerText(doc, '.abstract-text');
			newItem.number = data('标准号');
			if (newItem.number.startsWith('GB')) {
				newItem.number = newItem.number.replace(/(\d)-(\d)/, '$1—$2');
				newItem.title = newItem.title.replace(/(\p{Unified_Ideograph}) (\p{Unified_Ideograph})/u, '$1　$2');
			}
			newItem.status = innerText(doc, 'h1 > .type');
			newItem.date = data('发布日期');
			newItem.numPages = data('总页数');
			setExtra(newItem, 'Original Title', innerText(doc, 'h1 > br+span'));
			setExtra(newItem, 'Apply Date', data('实施日期'));
			data(['标准技术委员会', '归口单位'])
				.split(/[;；]\s*/)
				.forEach((name) => {
					newItem.creators.push(cleanAuthor(name));
				});
			break;
		}
		case 'report':
			newItem.abstractNote = data('成果简介');
			newItem.date = data('成果入库时间');
			data('成果完成人').split(/[;；]\s*/).forEach((name) => {
				newItem.creators.push(cleanAuthor(name));
			});
			newItem.institution = data('第一完成单位');
			setExtra(newItem, 'Achievement Type', data('成果类别'));
			setExtra(newItem, 'Level', data('成果水平'));
			setExtra(newItem, 'Evaluation', data('评价形式'));
			break;
		default:
			break;
	}
	const isTagged = doc.querySelector('.keywords > a');
	if (isTagged) {
		doc.querySelectorAll('.keywords > a').forEach((elm) => {
			newItem.tags.push(elm.innerText.replace(/;$/, ''));
		});
	}
	else {
		innerText(doc, '.keywords').split(/[;；]\s*/).forEach((tag) => {
			newItem.tags.push(ZU.trimInternal(tag));
		});
	}
	addAttachments(newItem, doc);
	newItem.complete();
}

async function getItemFromAPI(doc) {
	Z.debug('use API: GetExport');
	const postUrl = attr(doc, '#export-url', 'value');
	const postData = `filename=${attr(doc, '#export-id', 'value')}`
		+ `&uniplatform=${exports.uniplatform}`
		// Although there are two data formats that are redundant, it can make the request more "ordinary" to server.
		+ '&displaymode=GBTREFER%2Celearning%2CEndNote';
	const respond = await requestJSON(
		postUrl,
		{
			method: 'POST',
			body: postData,
			headers: {
				Referer: doc.location.href
			}
		}
	);
	if (!respond.data || !respond.data.length) {
		return null;
	}
	let item = {};
	const referText = respond.data[2].value[0].replace(/<br>/g, '\n');
	const translator = Z.loadTranslator('import');
	// CNKI Refer
	translator.setTranslator('7b6b135a-ed39-4d90-8e38-65516671c5bc');
	translator.setString(referText);
	translator.setHandler('itemDone', (_obj, parsed) => {
		item = parsed;
	});
	await translator.translate();
	return item;
}

const paramsMap = {
	filename: '#paramfilename',
	dbcode: '#paramdbcode',
	dbname: '#paramdbname',
};

/*
 In the following comments,
 "wai wen" indicates the pinyin of Chinese word "外文", meaning "foreign language",
 "zong ku" indicates the pinyin of Chinese word "总库", meaning "total database".
*/

const enTypeMap = {
	// 外文学术期刊数据库（Wai Wen Journal Database）
	WWJD: 'journalArticle',
	// 国外会议全文数据库（Wai Wen Proceeding Full-text Database）
	WWPD: 'conferencePaper',
	// 境外专利全文数据库（Outbound Patent Full-text Database）
	SOPD: 'patent',
	// 国际会议论文全文数据库（International Proceeding Full-text Database）
	IPFD: 'conferencePaper',
	// 外文图书数据库（wai wen Book Database）
	WWBD: 'book',
	// 国外标准全文数据库（Outbound Standard Full-text Database）
	SOSD: 'standard',
};

const zhTypeMap = {
	// 中国学术期刊全文数据库（China Academic Journal Full-text Database, AKA CAJD, CJZK）
	CJFD: 'journalArticle',
	CJFQ: 'journalArticle',
	// 中国预出版期刊全文数据库（China Advance Publish Journal Full-text Database）
	CAPJ: 'journalArticle',
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
	// 中国专利全文数据库（China Patent Full-text Database）
	SCPD: 'patent',
	// 境内外专利全文数据库（China & Outbound Patent Full-text Database）
	SCOD: 'patent',
	
	// Yearbook resources require login and are rarely used; due to testing difficulties, we have decided not to support them for now
	// 中国年鉴全文数据库（China Yearbook Full-text Database）
	// CYFD: 'bookSection',

	/* conference paper */
	// 国际及国内会议论文全文数据库（Cina & International Important Proceeding Full-text Database）
	CIPD: 'conferencePaper',
	// 中国会议论文全文数据库（Cina Proceeding Full-text Database）
	CPFD: 'conferencePaper',

	/* Video resources have been moved to a separate website, and the current page is broken, so we no longer handle video */
	// 会议视频（China Proceeding Video Database）
	// CPVD: 'conferencePaper',
	// 视频（China Conference Video Database）
	// CCVD: 'videoRecording',

	/* book */
	// Book Datab 总库
	// BDZK: 'book',
	// 中文图书 book, zh
	// WBFD: 'book',

	/* Standard */
	// 标准数据总库（Cina & International Stand Database）
	CISD: 'standard',
	// 中国标准全文数据库（China Standard Full-text Database）
	SCSF: 'standard',
	// 中国行业标准全文数据库（China Hang Ye Standard Full-text Database）
	SCHF: 'standard',
	// 中国标准题录数据库（China Standard Full-text Database）
	SCSD: 'standard',

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

const typeMap = {
	en: enTypeMap,
	zh: zhTypeMap
};

function getLabeledData(rows, labelGetter, dataGetter, defaultElm) {
	const labeledElm = {};
	for (const row of rows) {
		labeledElm[labelGetter(row, rows)] = dataGetter(row, rows);
	}
	const data = (labels, element = false) => {
		if (Array.isArray(labels)) {
			for (const label of labels) {
				const result = data(label, element);
				if (
					(element && /\S/.test(result.textContent))
					|| (!element && /\S/.test(result))) {
					return result;
				}
			}
			return element ? defaultElm : '';
		}
		const targetElm = labeledElm[labels];
		return targetElm
			? element ? targetElm : ZU.trimInternal(targetElm.textContent)
			: element ? defaultElm : '';
	};
	return data;
}

function removeNode(parent, selector) {
	const clone = parent.cloneNode(true);
	const node = clone.querySelector(selector);
	if (node) node.remove();
	return clone;
}

function extractTitle(elm) {
	if (!elm) return '';
	const parts = [];
	// Handle HTML tags
	for (let node of elm.childNodes) {
		const content = ZU.trimInternal(node.textContent);
		if (node.nodeType === Node.ELEMENT_NODE) {
			const tag = node.tagName.toLowerCase();
			if (node.style.display === 'none') {
				continue;
			}
			if (tag === 'sup' || tag === 'sub') {
				parts.push(`<${tag}>${content}</${tag}>`);
			}
			else {
				parts.push(content);
			}
		}
		else if (node.nodeType === Node.TEXT_NODE) {
			parts.push(content);
		}
	}
	// Fix Chinese colon
	return parts.join('').replace(/(\p{Unified_Ideograph}):(\p{Unified_Ideograph})/u, '$1：$2');
}

function detectLanguage(dbcode) {
	for (const [lang, map] of Object.entries(exports.typeMap)) {
		if (dbcode in map) {
			return lang;
		}
	}
	return 'zh-CN';
}

function setExtra(item, key, value) {
	if (typeof value === 'string' && value) {
		item.setExtra(key, value);
	}
}

function cleanAuthor(string, creatorType = 'author') {
	if (!string) return {};
	return /\p{Unified_Ideograph}/u.test(string)
		? {
			lastName: string.replace(/\s/g, ''),
			creatorType: creatorType,
			fieldMode: 1
		}
		: ZU.cleanAuthor(ZU.capitalizeName(string), creatorType);
}

function addAttachments(item, doc) {
	// If you want CAJ instead of PDF, set keepPDF = false
	// 如果你想将PDF文件替换为CAJ文件，将下面一行 keepPDF 设为 false
	let keepPDF = Z.getHiddenPref('CNKIPDF');
	if (keepPDF === undefined) keepPDF = true;
	// The legal status of patent is shown in the picture on webpage
	if (['patent', 'report'].includes(item.itemType)) {
		item.attachments.push({
			title: 'Snapshot',
			document: doc
		});
		const cajLink = attr(doc, '.btn-qwxz > a', 'href');
		Z.debug(`get CAJ link:\n${cajLink}`);
		if (cajLink) {
			item.attachments.push({
				title: 'Full Text CAJ',
				mimeType: 'application/caj',
				url: cajLink
			});
		}
	}
	const pdfLink = attr(doc, '.btn-dlpdf > a', 'href');
	Z.debug(`get PDF Link:\n${pdfLink}`);
	const cajLink = attr(doc, '.btn-dlcaj > a', 'href');
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

var exports = {
	uniplatform: 'NZKPT',
	data: undefined,
	typeMap,
	scrapeMain,
	getItemFromAPI
};

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=JITlTmCwHjKk7rt1kXJYCGd7w5kLImGYZEzreg0tf46p5U51q7-WEuvxOUJ9tpkwX3woslqCaRgrSD-oXJI6otNpsrc9Mw8Kug5Zx56B35v2nXItyi9ATHek17qJn5Rl7USDdnnMpyOk8hp6fkVvdtQLNUg-9NUxfSqzUQjN4wrwk0N7uZSoiE2m_xjRKVrm&uniplatform=NZKPT&captchaId=67e34e5d-2393-421d-99c9-39c51a224d68",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "蓝田生物群：一个认识多细胞生物起源和早期演化的新窗口",
				"creators": [
					{
						"lastName": "袁训来",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陈哲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "肖书海",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "万斌",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "关成国",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "王伟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "周传明",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "华洪",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2012",
				"ISSN": "0023-074X",
				"abstractNote": "蓝田生物群位于安徽省休宁县蓝田镇,保存在埃迪卡拉纪早期蓝田组的黑色页岩中,是已知最古老的复杂宏体生物群,既包含了扇状、丛状生长的海藻,也有具触手和类似肠道特征、形态可与现代腔肠动物相比较的后生动物.这一特殊埋藏的生物群为多细胞生物的起源和早期演化带来了新的启示:微体真核生物在新元古代大冰期结束后迅速演化出宏体形态,它们底栖固着生活在较深水的安静环境中.也许,早期多细胞生物形态复杂化和生物多样性的产生与有性繁殖方式和世代交替现象的出现紧密相关.该时期海洋水体复杂多变的氧化-还原条件,很可能是蓝田生物群繁盛和特殊埋藏的重要原因.",
				"extra": "Fund: 国家自然科学基金重点项目(41030209,41130209)； 国家杰出青年科学基金(40625006)； 中国科学院知识创新工程重要方向性项目(KZZD-EW-02,KZCX2-YW-153,KZCX2-EW-119)资助；",
				"issue": "34",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "3219-3227",
				"publicationTitle": "科学通报",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFD2012&filename=KXTB201234003",
				"volume": "57",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "埃迪卡拉纪"
					},
					{
						"tag": "多细胞生物"
					},
					{
						"tag": "蓝田生物群"
					},
					{
						"tag": "起源与早期演化"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=JITlTmCwHjJO_u1nf5OyKOLliu26d-TC6IBTl-_Vv_4KZMKSWbM94kKViis7lifOY2LFeJfqeFHtVMtriD2udhWRpNxzfTFqBZc97U9R9sxh57qfsxgFLrANCy4MLkyP60SYceLt8CUAOw2DLi-ONUAAxUwwryfj&uniplatform=NZKPT&captchaId=3833a357-4de4-4a70-8043-da6a6dea2282",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "外施Ca<sup>2+</sup>、ABA及H<sub>3</sub>PO<sub>4</sub>对盐碱胁迫的缓解效应",
				"creators": [
					{
						"lastName": "颜宏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "石德成",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "尹尚军",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "赵伟",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2000",
				"DOI": "10.13287/j.1001-9332.2000.0212",
				"ISSN": "1001-9332",
				"abstractNote": "分别对 30 0mmol·L-1NaCl和 10 0mmol·L-1Na2 CO3 盐碱胁迫下的羊草苗进行以不同方式施加Ca2 +、ABA和H3PO4 等缓解胁迫处理 .结果表明 ,外施Ca2 +、ABA和H3PO4 明显缓解了盐碱对羊草生长的抑制作用 .叶面喷施效果好于根部处理 ;施用Ca(NO3) 2 效果好于施用CaCl2 效果 ;混合施用CaCl2 和ABA的效果比单独施用ABA或CaCl2 的效果好 .",
				"extra": "Fund: 国家自然科学基金资助项目!(39670 0 83) .；",
				"issue": "6",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "889-892",
				"publicationTitle": "应用生态学报",
				"url": "https://doi.org/10.13287/j.1001-9332.2000.0212",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "Ca2+"
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
						"tag": "脯氨酸(Pro)"
					},
					{
						"tag": "脱落酸(ABA)"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=JITlTmCwHjJTJJSXR98EcWVrQ7bFmc1MN3oSFhA_gfXvXW-Frs3nzyguQt3_JMQRQTiZKH0UlOo5_3OHFyy-4ZLDdAbDXmGEJu0RMCRy4H9KPvSUSjpU0_v8ACDxjKDMiFlLK-6DgrTcOtxUhZp8Nsbygz1cNjZY&uniplatform=NZKPT&captchaId=5c413680-8559-440d-ad41-21dae4ad4346",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "黄瓜胚性愈伤组织的诱导保存和再生",
				"creators": [
					{
						"lastName": "薛婉钰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "刘娜",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "苑鑫",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "张婷婷",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "曹云娥",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陈书霞",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-01-05",
				"DOI": "10.13207/j.cnki.jnwafu.2024.07.011",
				"abstractNote": "【目的】对黄瓜胚性愈伤组织的诱导保存和再生进行研究,为黄瓜高频率遗传转化奠定基础。【方法】以欧洲温室型黄瓜自交系14-1子叶节为外植体,在MS培养基上附加1.5 mg/L 2,4-D,进行25 d的胚性愈伤组织诱导培养后,取胚性愈伤组织在添加30,60,90,100,110,120,130,140和150 g/L蔗糖及1.5 mg/L 2,4-D的MS培养基进行继代培养,每30 d继代1次,观察胚性愈伤组织的褐变情况及胚性分化能力,并用电子天平在超净工作台中记录胚性愈伤组织质量的变化。继代培养60 d后,将保存的胚性愈伤组织和体细胞胚移至含1.5 mg/L 2,4-D的MS培养基上,待出现体细胞胚后移至MS培养基进行萌发,观察再生小植株的生长情况。【结果】将欧洲温室型黄瓜自交系14-1的子叶节,接种到附加1.5 mg/L 2,4-D的MS培养基上进行诱导培养后,子叶节一端的愈伤组织集中聚集于下胚轴处,之后有黄色胚性愈伤组织产生。在继代培养过程中,当培养基中添加的蔗糖为60～150 g/L时,胚性愈伤组织能保持胚性愈伤状态达60 d。之后将继代培养60 d后的胚性愈伤组织转接至附加1.5...",
				"extra": "Status: advance online publication\nFund: 国家自然科学基金项目(32072562;32272748；",
				"issue": "7",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "1-7",
				"publicationTitle": "西北农林科技大学学报（自然科学版）",
				"url": "https://link.cnki.net/doi/10.13207/j.cnki.jnwafu.2024.07.011",
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=JITlTmCwHjKXjj7ARwgsRbnBi4PwoeQy1LH1gU0l7jEaC69yAzGe_Y9BkDZCFGNXPyfR3mGV4QpBriXjeX7vsLgSXYWyzy-qTUYAQ6XmhLYOav_f_U3mtuaBdEQQP2FMv8tlyuRXKjnLLhqtEaJVJqhW-FzFZ5MRYhef1wOQXEg&uniplatform=NZKPT&captchaId=42ac3ddd-e9d3-4bad-9c6d-cfc851487b11",
		"items": [
			{
				"itemType": "thesis",
				"title": "黄瓜共表达基因模块的识别及其特点分析",
				"creators": [
					{
						"lastName": "林行众",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "黄三文",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"lastName": "杨清",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2015",
				"abstractNote": "黄瓜(Cucumis sativus L.)是我国最大的保护地栽培蔬菜作物,也是植物性别发育和维管束运输研究的重要模式植物。黄瓜基因组序列图谱已经构建完成,并且在此基础上又完成了全基因组SSR标记开发和涵盖330万个变异位点变异组图谱,成为黄瓜功能基因研究的重要平台和工具,相关转录组研究也有很多报道,不过共表达网络研究还是空白。本实验以温室型黄瓜9930为研究对象,选取10个不同组织,进行转录组测序,获得10份转录组原始数据。在对原始数据去除接头与低质量读段后,将高质量读段用Tophat2回贴到已经发表的栽培黄瓜基因组序列上。用Cufflinks对回贴后的数据计算FPKM值,获得10份组织的24274基因的表达量数据。计算结果中的回贴率比较理想,不过有些基因的表达量过低。为了防止表达量低的基因对结果的影响,将10份组织中表达量最大小于5的基因去除,得到16924个基因,进行下一步分析。共表达网络的构建过程是将上步获得的表达量数据,利用R语言中WGCNA(weighted gene co-expression network analysis)包构建共表达网络。结果得到的共表达网络包括11...",
				"extra": "Major: 生物化学与分子生物学",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=JITlTmCwHjKC8704VrIGBx2go4IgvRHHtULuNNSHaZK7YYr-_2jm5Bxttct-sy-VCjXgfcm9HzBmKbH1XgLgShaXdy6tfZ10OaOp53n-XJ8FB2TCo-pDQShpUPwlerLojFT7e4fISrPiRN3faFf9GT9Ne_SYJWuq&uniplatform=NZKPT&captchaId=16b025dc-3dce-4620-9eee-2fb48fd941cf",
		"items": [
			{
				"itemType": "thesis",
				"title": "高导热聚合物基复合材料的制备与性能研究",
				"creators": [
					{
						"lastName": "虞锦洪",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "江平开",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2012",
				"abstractNote": "随着微电子集成技术和组装技术的快速发展，电子元器件和逻辑电路的体积越来越小，而工作频率急剧增加，半导体的环境温度向高温方向变化，为保证电子元器件长时间可靠地正常工作，及时散热能力就成为其使用寿命长短的制约因素。高导热聚合物基复合材料在微电子、航空、航天、军事装备、电机电器等诸多制造业及高科技领域发挥着重要的作用。所以研制综合性能优异的高导热聚合物基复合材料成为了目前研究热点。本论文分别以氧化铝（Al2O3）、石墨烯和氮化硼（BN）纳米片为导热填料，以环氧树脂和聚偏氟乙烯（PVDF）为基体，制备了新型的高导热聚合物基复合材料。首先，采用两步法将超支化聚芳酰胺接枝到纳米Al2O3粒子表面：纳米颗粒先进行硅烷偶联剂处理引入氨基基团，在改性后的纳米粒子上接枝超支化聚合物；再利用X射线衍射、傅立叶红外光谱、核磁共振氢谱和热失重等方法对纳米Al2O3粒子的表面改性进行表征；然后分别将未改性的纳米Al2O3粒子、硅烷接枝...",
				"extra": "Major: 材料学",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=JITlTmCwHjLrw3OFdT2fzMoXh-T8QdiKmABodlt-0MZR5ctjhfybIMYIcljnbTqcgxvGn6n3o-dhJ7OvTWNGfF_Mqvk8p5sGDhOhVEY0T_B2OHy65d5_i5buE3PGV6zLi8KRDcmVnJ1q8LaGAgoirwVplTijP89st7e4Hrm4JZQ&uniplatform=NZKPT&captchaId=1eb26d2e-b3d9-4385-949c-4166def5c495",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "辽西区新石器时代考古学文化纵横",
				"creators": [
					{
						"lastName": "朱延平",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "<正>辽西区的范围从大兴安岭南缘到渤海北岸,西起燕山西段,东止辽河平原,基本上包括内蒙古的赤峰市(原昭乌达盟)、哲里木盟西半部,辽宁省西部和河北省的承德、唐山、廊坊及其邻近的北京、天津等地区。这一地区的古人类遗存自旧石器时代晚期起,就与同属东北的辽东区有着明显的不同,在后来的发展中,构成自具特色的一个考古学文化区,对我国东北部起过不可忽视的作用。以下就辽西地区新石器时代的考古学文化序列、编年、谱系及有关问题简要地谈一下自己的认识。 更多 还原 AbstractFilter('ChDivSummary', 'ChDivSummaryMore', 'ChDivSummaryReset');",
				"conferenceName": "内蒙古东部地区考古学术研讨会",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"place": "中国内蒙古赤峰",
				"proceedingsTitle": "内蒙古东部区考古学文化研究文集",
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=BkbJkO_np9OXN7IWs4ROElYDLRXQ7YJmT64TXc_xnJK7s7TtXvtKm041-VzJzSGCWOMpqLd_LQ7BRqUH8BulyuE_W9BIZYNqUdQsLCq9fe2b0Moh6u1rm6nLs7QzAscomcsrHcJlfbuOyzTUEtTyHRR8GZURD-MGDj9XNPsMS9c&uniplatform=NZKPT&captchaId=f41cfb8c-acec-4cd9-b4c2-933b9aac6104",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "灭绝物种RNA首次分离测序：为复活物种或研究RNA病毒开创新方向",
				"creators": [
					{
						"lastName": "刘霞",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-09-21",
				"DOI": "10.28502/n.cnki.nkjrb.2023.005521",
				"abstractNote": "科技日报北京9月20日电 （记者刘霞）瑞典国家分子生物科学中心科学家首次分离和测序了一个已灭绝物种的RNA分子，从而重建了该灭绝物种（塔斯马尼亚虎）的皮肤和骨骼肌转录组。该项成果对复活塔斯马尼亚虎和毛猛犸象等灭绝物种，以及研究如新冠病毒等RNA病毒具有重要意义。相......",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "4",
				"shortTitle": "灭绝物种RNA首次分离测序",
				"url": "https://link.cnki.net/doi/10.28502/n.cnki.nkjrb.2023.005521",
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=BkbJkO_np9PmAzroQ138IEogJAxrykf4qcy0Fg1bK3ZfezUZOfupWPld61qwmMwmafxDNYaUlsVv-jBS-NgFVhel1DknrRQYaNtHzezX0zkTMVx_wFbuqodLZsCwYvu3F71n_w3vFvHjzW5ATiAjgg&uniplatform=NZKPT&captchaId=c5e55a43-0791-4881-aa41-e14d3954662d",
		"items": [
			{
				"itemType": "patent",
				"title": "不锈钢管的制造方法",
				"creators": [
					{
						"lastName": "李玉和",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "李守军",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "李扬洲",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "罗通伟",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "彭声通",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "贺同正",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "刘世平",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					},
					{
						"lastName": "成都虹桥专利事务所",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					}
				],
				"abstractNote": "本发明公开了一种不锈钢管的制造方法,具有可提高不锈钢管质量的优点。该不锈钢管的制造方法,其特征是包括下述步骤：①将不锈钢液在熔炼炉中进行熔炼；②不锈钢液熔清后进行去渣及脱氧处理；③将不锈钢液浇入旋转的离心浇铸机型筒中进行离心浇铸后在离心力作用下冷却凝固成型为不锈钢管坯料。采用离心浇铸方法制作不锈钢空心管,使得在离心力作用下,离心管坯补缩效果好,组织较致密,气体和非金属夹杂容易排出,缺陷少 ,有效地提高了不锈钢管的质量,且通过离心浇铸后可直接获得不锈钢空心管,金属的收得率高,且通过采用离心浇铸后,管坯在后续加工中具有工序少、成材率高的特点,尤其适合在高端钢材产品的制造上面推广使用。",
				"applicationNumber": "CN200710201273.2",
				"assignee": "攀钢集团攀枝花钢铁研究院",
				"country": "中国",
				"filingDate": "2007-08-03",
				"language": "zh-CN",
				"patentNumber": "CN101091984",
				"place": "中国",
				"rights": "1.不锈钢管的制造方法,其特征是包括下述步骤：①、将不锈钢液在熔炼炉中进行熔炼；②、不锈钢液熔清后进行去渣及脱氧处理；③、将不锈钢液浇入旋转的离心浇铸机型筒中进行离心浇铸后在离心力作用下冷却凝固成型为不锈钢管坯料。",
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=BkbJkO_np9MrSlcksJ6J2QPpe4Jl48nn28AWXxVRL32OuZKWGN65-O5HaNpG1onp1cXEufZj1ms-4aeDvN-pyoVdmUPiK7bz7X7dFWk_tXFEvoAYuFQ9D18s-_OFHktGvHS16quz9fmAj2aTshfQFA&uniplatform=NZKPT&captchaId=b172dd7f-bda9-4457-8fdc-a5e72b141554",
		"items": [
			{
				"itemType": "standard",
				"title": "粮油检验　小麦粉膨胀势的测定",
				"creators": [
					{
						"lastName": "全国粮油标准化技术委员会(SAC/TC270)",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019-05-10",
				"extra": "Original Title: Inspection of grain and oils—Swelling properties test of wheat flour\nApply Date: 2019-12-01",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"numPages": "16",
				"number": "GB/T 37510—2019",
				"status": "现行",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=SCSF&dbname=SCSF&filename=SCSF00058274",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=BkbJkO_np9PVyHDEmDBGgeAXl2eEPire-EwAK1-KTgsmP0j6BisUZrylf7LbiYVXzSVb6E_yvj-l2PLiN0SLR6_hR6-Wj9w-8OeV21YlzY8I5XpZAj29WdLFl4pAYt3OfIQZY7bcir91nbroUbJy_w7_A6lSOSvD&uniplatform=NZKPT&captchaId=fd0f51a6-58c1-4777-912d-a0a1d5d2fff5",
		"items": [
			{
				"itemType": "report",
				"title": "25MW/100MWh液流电池长时储能系统关键技术研发与示范",
				"creators": [
					{
						"lastName": "孟青",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "刘素琴",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "李建林",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "曾义凯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "张家乐",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "吴志宽",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "刘文",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "周明月",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "何震",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "王珏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "解祯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "娄明坤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "许超",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "李继伟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "王璐嘉",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "本项目拟通过分析材料、电堆、电解液和模块性能提升、成本控制制约因素,将关键材料性能提升与电堆结构优化设计以及系统电气、智能控制设施等的优化研究相结合,以最大限度地提升性能、降低系统成本。针对液流电池电解液活性物种溶解度不高,高、低温稳定性差,长期循环过程中容量衰减和效率降低问题,开发高浓度、高稳定性、活性电解液配方与制备工艺。在功率单元和能量单元性能优化基础上,以可靠性和系统性能优化为目标,分析指标,开发储能单元模块,以此为基础设计储能电站工程,针对工程应用开发调控和运维平台,形成示范应用及经济性分析。",
				"extra": "Achievement Type: 应用技术\nEvaluation: 验收",
				"institution": "山西国润储能科技有限公司",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=SNAD&dbname=SNAD&filename=SNAD000002043401",
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
		"url": "https://kns.cnki.net/kns8s/defaultresult/index?classid=EMRPGLPA&korder=SU&kw=%E7%BA%B3%E7%B1%B3",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kns8s/search?classid=WD0FTY92&kw=%E7%85%A4%E7%82%AD&korder=SU",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kns8s/AdvSearch?classid=WD0FTY92",
		"detectedItemType": false,
		"items": []
	},
	{
		"type": "web",
		"url": "https://navi.cnki.net/knavi/detail?p=66hTXjLmYFoPLB8ZHEO99z5JQcrxEt6KTYvTL360DayvPHB9-Al8vdVWV1kjDnRlbLbI52uF2OUlMEJMIyCB67P7FuW41YnuorMp8kBUZcv39uVP9C6uSg==&uniplatform=NZKPT&language=CHS",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://navi.cnki.net/knavi/detail?p=66hTXjLmYFrT4Za8YY4-Kc9CYdk26Cez9lhZH53FJEPTRRP2vsfUGwifP9aClnwz0-DPUbKhG1Ac1Q4dl9W4Iri9LjQ3ChgW30E47GebFEk=&uniplatform=NZKPT&language=CHS",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/author/detail?v=BkbJkO_np9NwnZW19EtZtAvAk9jLCw9-VzKZMuwF06qlunM3Hw6cTtTfYIrYO4yKzLJ5oUN4v2x9ALrI--Lxf7A_fyIiJzSfQxVFSFQWtm3sWEFjn2gQJiBks7XJkUI_&uniplatform=NZKPT&language=CHS",
		"detectedItemType": false,
		"items": []
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=tC3tAMdiXNeS75CAt70gwAZL78yz-fZxn0g5vAysREDtiAkOpkV556EYl7a66xbomSvKAZJw8ROxrh2IAf_ZI6BusyOZf5s4mdwELCFedbI0ImfuRYBVH73B3MA3rJ2wR5w09EG89pSLG6_6KOe3gp6lshoIpbnsOYjtpne0N0wqRwb_QQiAXcJJXImN02aT&uniplatform=NZKPT&captchaId=bf673573-ef9a-428b-b59f-10f1ac5ce826",
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
				"date": "04/2024",
				"DOI": "10.1016/j.bioadv.2024.213780",
				"ISSN": "27729508",
				"journalAbbreviation": "Biomaterials Advances",
				"language": "en",
				"libraryCatalog": "DOI.org (Crossref)",
				"pages": "213780",
				"publicationTitle": "Biomaterials Advances",
				"url": "https://linkinghub.elsevier.com/retrieve/pii/S2772950824000232",
				"volume": "158",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=tC3tAMdiXNdr_ij7NFfRLWYes4QmMPO4gZXqTsPv5smzrbJnEwQT1GQpukxsCtuqEHfw58sde9BJLdLH_14uEUmCoEg-W7Hw-T_evqclldOFOT7ACUkKaT5_N7QXDOTYg-nBkYz4121AwN8-bi93nDEgoYZqgeCfenlhkI1whYWKolOCUtt5Lg&uniplatform=NZKPT&captchaId=52efdbc4-3d75-4e50-93c7-084984c49628",
		"items": [
			{
				"itemType": "book",
				"title": "IMF Terminology Bulletin: Climate & the Environment, Fintech, Gender, and Related Acronyms: English to Arabic",
				"creators": [
					{
						"lastName": "International Monetary Fund",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"DOI": "10.5089/9798400251245.073",
				"ISBN": "9798400251245",
				"abstractNote": "The world has witnessed transformational changes in recent years, not the least in technical parlance. With the massive amount of new and interdisciplinary concepts, the need has emerged to standardize and communicate emerging technical terms in languages other than English. The language Services Division of the IMF's Corporate Services and Facilities Department prepared this thematic bulletin as a contribution to the international effort of linguists and translation experts, for the benefit of topical experts, member countries, professional translators and interpreters, and the general public. It is produced on the occasion of the 2023 Annual Meetings of the World Bank Group and the International Monetary Fund in Marrakesh, Morocco",
				"language": "ara",
				"libraryCatalog": "K10plus ISBN",
				"numPages": "1",
				"place": "Washington, D.C",
				"publisher": "International Monetary Fund",
				"shortTitle": "IMF Terminology Bulletin",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
