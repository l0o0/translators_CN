{
	"translatorID": "98c0661d-484c-4c46-b6e2-cfa25630fe3d",
	"label": "CNKI Oversea",
	"creator": "jiaojiaodubai",
	"target": "^https?://oversea\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-03-18 17:50:29"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	const dbcode = attr(doc, paramsMap.dbcode, 'value');
	for (const lang in typeMap) {
		const type = typeMap[lang][dbcode];
		if (type) return type;
	}
	for (const map of Object.values(typeMap)) {
		const type = map[dbcode];
		if (type) return type;
	}
	if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	// Ignore books
	if (attr(doc, '.doctype-menus li.cur > a', 'resource') === 'BOOK') {
		return false;
	}
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
			row: '#rightCatalog dd',
			filter: row => row.querySelector('.name'),
			title: row => innerText(row, '.name'),
			href: row => attr(row, '.name > a', 'href')
		},
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
			const rows = Array.from(doc.querySelectorAll(page.row))
				.filter(row => !page.filter || page.filter(row));
			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				const href = page.href(row);
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
	else {
		await scrapeMain(doc, url);
	}
}

async function scrapeScholar(doc, url) {
	const data = getLabeledData(
		doc.querySelectorAll('.wx-tit-scholar > h3'),
		row => innerText(row, 'b').replace(/：$/, ''),
		row => row.querySelector('b+span'),
		doc.createElement('div')
	);
	try {
		// When debugging, uncomment the following line to jump to `catch` block
		// throw new Error('debug');
		await scrapeSearch({ DOI: data('DOI') });
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
	}
	catch (e) {
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
	const data = getLabeledData(
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
	doc.querySelectorAll('.total-inform-oversea > span:not(:last-child)').forEach((elm) => {
		const match = /^(?<label>.+)：(?<value>.+)$/.exec(elm.innerText);
		if (match && match.groups && match.groups.value) {
			totalInfo[match.groups.label] = match.groups.value;
		}
	});
	const newItem = new Z.Item(itemType);
	newItem.title = extractTitle(doc.querySelector('.wx-tit > h1 > .title-one'));
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
	setExtra(newItem, 'CNKICite', innerText(doc, '#RefAuthorArea .num') || innerText(doc, '#citations+span').substring(1, -1));
	setExtra(newItem, 'dbcode', params.dbcode);
	setExtra(newItem, 'dbname', params.dbname);
	setExtra(newItem, 'filename', params.filename);
	switch (itemType) {
		case 'journalArticle': {
			const pubInfo = ZU.trimInternal(innerText(doc, '.top-tip'));
			const match = /^(?<publicationTitle>.+?)\s?\.\s?(?<year>\d{4})?\s?(,(?<volume>\d+))?\s?(\(0*(?<issue>\d+)\))?/.exec(pubInfo);
			newItem.publicationTitle = match.groups.publicationTitle.replace(/\((\p{Unified_Ideograph}+)\)$/u, '（$1）');
			newItem.date = match.groups.year;
			newItem.volume = match.groups.volume;
			newItem.issue = match.groups.issue;
			newItem.pages = totalInfo.页码;
			setExtra(newItem, 'Fund', data('基金资助'));
			if (doc.querySelectorAll('#authorpart > span').length === 1 && /,/.test(innerText(doc, '#authorpart'))) {
				innerText(doc, '#authorpart').split(',').forEach((name) => {
					newItem.creators.push(cleanAuthor(name));
				});
			}
			else {
				doc.querySelectorAll('#authorpart > span').forEach((elm) => {
					const nameElm = removeNode(elm, 'sup');
					newItem.creators.push(cleanAuthor(nameElm.innerText.trim()));
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
			newItem.university = innerText(doc, '#authorpart+.author').replace(/\((\p{Unified_Ideograph}+)\)$/u, '（$1）');
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
			doc.querySelectorAll('#authorpart > span').forEach((elm) => {
				newItem.creators.push(cleanAuthor(elm.innerText.trim()));
			});
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
				.querySelectorAll('span')
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
		+ `&uniplatform=OVERSEA`
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
	for (const [lang, map] of Object.entries(typeMap)) {
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://oversea.cnki.net/kcms2/article/abstract?v=zO3wb1M9ekzsjBzVld6-H-1ihs-T49cBOeQuW6vXNLc6kxjZv5yO1Ybiyu0n1gEZIdi9uA3xs4G5eS_sN6kHWMYqtnp87d8HGIJxVA1lL2Kl9NtQxYewqcReZsK3oGl4vAnwa-SbIsuS0_KF3sXjw5WpGcMJEbwzBDOiJ6C8zL9L8gTZPg0eVw==&uniplatform=OVERSEA&language=CHS",
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
				"issue": "34",
				"language": "zh",
				"libraryCatalog": "CNKI Oversea",
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
		"url": "https://oversea.cnki.net/kcms2/article/abstract?v=zO3wb1M9ekzk5ONdaf-GT71OAJlkqG5POdW6bOyTgiyOHb1V_4Hy2qU-YMkIjGgAFFug_0ugYfyXp5kgnRt6DVk1txRcXCajDzgcQ6wS5G-HKFZVuyXrYxhb4-7ruRD9NQcnGkhVtgWxMM2QU2Pin3s0DS3_3hT5fbzYCPQrAEsKsbKxT2UpbQ==&uniplatform=OVERSEA&language=CHS",
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
				"issue": "6",
				"language": "zh",
				"libraryCatalog": "CNKI Oversea",
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
		"url": "https://oversea.cnki.net/kcms2/article/abstract?v=zO3wb1M9ekzQw4BjTapSwhESHdCzX1lEO0CbRTlq7yIZJNnmBfEMgJRBZpeopou1dWGzfcfck8FTJMnlRcnXma-iBwbs4mva7Ib1evKMVkdrw3yrlrXBr_eytsukMGzxDCMTyC7w6d49iMD9F0VXes5xmBL1fTx0c4zpqiKPdxW4ZvqSL-k9TtOjLzV7sGgZ&uniplatform=OVERSEA&language=CHS",
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
				"language": "zh",
				"libraryCatalog": "CNKI Oversea",
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
		"url": "https://oversea.cnki.net/kcms2/article/abstract?v=zO3wb1M9ekxPeMV3Aa94Ku61-JWQ7qR4MGX4soSxw2wU92Xu4Xadu5nSaBveW9xgoHJ1HTgcC2CLI3EvuQSNWMnsif1FbLq-9Wvop5TSaYDkcAYzhEVI344zRnRcXoJl-l0MxTroJ-mspdunAf5akZC3vZzL3OAgqWLuDuKnhn-ma_uVXH7C1w==&uniplatform=OVERSEA&language=CHS",
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
				"language": "zh",
				"libraryCatalog": "CNKI Oversea",
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
		"url": "https://oversea.cnki.net/kcms2/article/abstract?v=zO3wb1M9ekwMjlDwv3j9x06c2r_MtKCsaJJGIAgmhBrjbY8LjPnSeyjduKm7jpQB4zL_AL5GiUP65UKLZomOjBRQH2fg8HS5XmCOgb__T7qH8MxLSGMCzeZRF5L6HWTHn2wBdpbOeyVR5wh6rNydgTIdYK2bgi-rjNM6MIa986n8fZTfTakhgg==&uniplatform=OVERSEA&language=CHS",
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
				"date": "1990-10",
				"abstractNote": "<正>辽西区的范围从大兴安岭南缘到渤海北岸,西起燕山西段,东止辽河平原,基本上包括内蒙古的赤峰市(原昭乌达盟)、哲里木盟西半部,辽宁省西部和河北省的承德、唐山、廊坊及其邻近的北京、天津等地区。这一地区的古人类遗存自旧石器时代晚期起,就与同属东北的辽东区有着明显的不同,在后来的发展中,构成自具特色的一个考古学文化区,对我国东北部起过不可忽视的作用。以下就辽西地区新石器时代的考古学文化序列、编年、谱系及有关问题简要地谈一下自己的认识。 更多 还原 AbstractFilter('ChDivSummary', 'ChDivSummaryMore', 'ChDivSummaryReset');",
				"conferenceName": "内蒙古东部地区考古学术研讨会",
				"eventPlace": "中国内蒙古赤峰",
				"language": "zh",
				"libraryCatalog": "CNKI Oversea",
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
		"url": "https://oversea.cnki.net/kcms2/article/abstract?v=zO3wb1M9ekwHcsqfKBCraR8iXMKssqejl-ehdGcJqVAiK0pNquMPsszEV-nuLOwfioS5UD7jsQCCZ0tj3b6ledu5DAAumxa7ZIi8gYCC_JNZvVf89ZGgh96XcjYJ2L5Fec-Al1MhqVOyyoBf-OTW9SkvVhKaH1NGC9kSNDQVaDL8mBvVHCuNX1L7rWQQb65Q&uniplatform=OVERSEA&language=CHS",
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
				"language": "zh",
				"libraryCatalog": "CNKI Oversea",
				"pages": "4",
				"shortTitle": "灭绝物种RNA首次分离测序",
				"url": "https://link.cnki.net/doi/10.28502/n.cnki.nkjrb.2023.005521",
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
		"url": "https://oversea.cnki.net/kcms2/article/abstract?v=zO3wb1M9ekzO6nQ7eA1BzVEuXR0P9wLhM9meBIvrt67As2kmsCZP9gGSamIZ_l3IZZNvG_hPZiKafT_nW514l1q-CHoII8WPDEm2gz7nodA0C8V3b4EJKy1NNuPay7_1iBMO7LfGk9hC_7SRFNGmf1m3aMD4y7BGpg8dUp6StOwLYn95-yjQXg==&uniplatform=OVERSEA&language=CHS",
		"items": [
			{
				"itemType": "patent",
				"title": "TIG焊接不锈钢管的制造方法、TIG焊接不锈钢管、及TIG焊接不锈钢构件",
				"creators": [
					{
						"lastName": "仲子武文",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "延时智和",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "朝田博",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"lastName": "尹吉伟",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					},
					{
						"lastName": "北京信诺创成知识产权代理有限公司",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					}
				],
				"issueDate": "2020-09-15",
				"abstractNote": "1.一种焊接品质优异的TIG焊接不锈钢管的制造方法,所述方法包括以下步骤：将不锈钢带沿宽度方向通过辊成型法进行弯曲加工,以便将两缘部对接；以及将由此对接的两缘部进行TIG焊接,由此制造焊接不锈钢管,所述不锈钢带是铁素体不锈钢带,将不添加H2的惰性气体作为保护气体使用,作为焊接电源的电流波形,使用脉冲频率40Hz～300Hz的脉冲波形,与通过TIG焊接形成的焊接焊道的焊接方向垂直的方向上的宽度,称为焊接焊道宽度,所述焊接焊道中的焊接焊道宽度为恒定或大致恒定的部分称为稳定部,所述焊接焊道中的焊接焊道宽度大于所述稳定部的部分称为缺陷部位,以及所述焊接焊道具有5％或更低的变动比例,该变动是由电弧沿所述焊接方向来回摇摆引起的热量输入的变化产生,所述变动比例由以下公式(1)表示：(变动比例)＝(|XB-XC|/XC)···(1)其中XB是所述缺陷部位中的最大焊接焊道宽度,XC是所述稳定部的焊接焊道宽度。",
				"applicationNumber": "CN201780033978.X",
				"assignee": "日新制钢株式会社",
				"filingDate": "2017-06-02",
				"language": "zh",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=SCPD&dbname=SCPD202002&filename=CN109562475B",
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
		"url": "https://oversea.cnki.net/kcms2/article/abstract?v=zO3wb1M9ekyxnAxr6vi_kH261FEPjG9vVVOx8-L9ZzeNkfMjsdaxTqEv-HEfYCT956z6bRIfDgAXzbgLLM2qOaog0_KtlYoeoOhFFUkN_TFNsudX-uYwwk9_x0jaGRBWSoKJeEXaj_UtHGcsfH4YMszU47dwtCnZPwjzl1q73M4=&uniplatform=OVERSEA&language=CHS",
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
				"language": "zh",
				"libraryCatalog": "CNKI Oversea",
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
		"url": "https://oversea.cnki.net/kcms2/article/abstract?v=zO3wb1M9ekx9RqqALHgwRLPqHojmiWRvrkMKk_JAZ2XLmLDdnVbTkK-KC2MmCknrVYCSIkBBQLqjoq6SDwBOqR1bQ1QEmcI12W2sQ4WLcMumkUHcojtEh_SUV1kqYLm3wmAKmGVW3cptLLVQhZUn81N-dyqPaootr5SgvolmiYRs6N5TDKQoug==&uniplatform=OVERSEA&language=CHS",
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
				"language": "zh",
				"libraryCatalog": "CNKI Oversea",
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
		"url": "https://oversea.cnki.net/kns8s/defaultresult/index?crossids=ON8XK5WL%2CB7ZYGRCM%2CBT8YKI4I%2CTBRPZP83%2C4SCRTXA2%2CSZU0GLDC%2CI8IOAWAD%2CHT3U9UVL%2CBHWTLLXZ%2CIAF5Y951&language=chs&korder=SU&kw=%E7%BA%B3%E7%B1%B3",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://oversea.cnki.net/kns8s/search?language=chs",
		"detectedItemType": false,
		"items": []
	},
	{
		"type": "web",
		"url": "https://oversea.cnki.net/kns8s/AdvSearch?dbcode=CFLS&crossDbcodes=CJFQ,CDMD,CIPD,CCND,CYFD,CCJD,BDZK,CISD,SNAD,CJFN&language=CHS",
		"detectedItemType": false,
		"items": []
	},
	{
		"type": "web",
		"url": "https://oversea.cnki.net/knavi/detail?p=LajMYrylUhAlKgxzK5XsCX_ctoRPxREtEsFYw75YRTihCieBQl3nLWa6uTqDc8sKDl7NrEWNnl7LIFQQQatmxYCXRAvDSO8nol7LZ43WO5jedVprz2yMQQ==&uniplatform=OVERSEA&language=CHS",
		"detectedItemType": false,
		"items": []
	},
	{
		"type": "web",
		"url": "https://oversea.cnki.net/kcms2/article/abstract?v=_JlElU3EDUouvKLu08xFNvT6WUlriTQIbz86rRZ7q9R4L7YB69vk3aG-dfUOfqZA0C8RLV7onXq8Q_prooA-6pm-lGmGjT3obJM5Mjfi9VlpQ-lu3jlvTcJdjN0rJxcTqFwn2B3jLMsyvy1hXfvTU_3GAayF31h4uZsaxe-sYXptZde81rpCqdBUfKfksqrZi8NVpHI8SdZUfNBrGdQQLg==&uniplatform=OVERSEA&language=CHS",
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
	}
]
/** END TEST CASES **/
