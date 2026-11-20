{
	"translatorID": "07b2cafc-f7d0-4943-8eda-1afc99b1d2ad",
	"label": "Wikimedia Commons",
	"creator": "Daxoel",
	"target": "^https?://commons\\.wikimedia\\.org",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-08-18 20:00:00"
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
	// Diff 界面不支持
	if (new URLSearchParams(doc.location.search).get('diff')) {
		return false;
	}
	// 文件页
	if (/\/wiki\/File:/.test(url) || /[?&]title=File:/.test(url)) {
		if (doc.querySelector('#file, .fullImageLink, #fileinfotpl_desc, table.fileinfotpl')) {
			return isBookFile(doc) ? 'book' : 'artwork';
		}
		return false;
	}
	// 搜索结果页
	if (doc.querySelector('ul.search-results')) {
		return 'multiple';
	}
	// 画廊
	if (doc.querySelector('ul.gallery')) {
		return 'multiple';
	}
	return false;
}

function isBookFile(doc) {
	// PDF/DjVu 文件页视为图书
	const link = doc.querySelector('#file a[href*="upload.wikimedia.org"], div.fullImageLink a');
	return !!(link && /\.(pdf|djvu)(\?|#|$)/i.test(link.href));
}

function getSearchResults(doc) {
	const items = {};
	// 搜索结果页
	if (doc.querySelector('ul.search-results')) {
		const links = doc.querySelectorAll('ul.search-results a[title*="File:"]');
		for (const link of links) {
			const title = ZU.trimInternal(link.textContent);
			const href = link.href;
			if (!title || !href) continue;
			items[href] = title;
		}
	}
	// 画廊页
	else if (doc.querySelector('ul.gallery')) {
		const links = doc.querySelectorAll('ul.gallery a.image');
		const texts = doc.querySelectorAll('ul.gallery .gallerytext');
		for (let i = 0; i < links.length; i++) {
			const href = links[i].href;
			const title = texts[i] ? ZU.trimInternal(texts[i].textContent) : '';
			if (!href || !title) continue;
			items[href] = title;
		}
	}
	return Object.keys(items).length ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) === 'multiple') {
		const searchResults = getSearchResults(doc);
		if (!searchResults) return;
		const items = await Z.selectItems(searchResults);
		if (!items) return;
		await processDocuments(Object.keys(items), scrape);
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url) {
	const wikitext = await getWikitext(url);
	if (wikitext) {
		try {
			const book = extractTemplate(wikitext, 'Book');
			if (book) {
				scrapeBook(doc, url, book);
				return;
			}
			const info = extractTemplate(wikitext, 'Information');
			if (info) {
				scrapeInformation(doc, url, info);
				return;
			}
		}
		catch (e) {
			Z.debug('Wikimedia Commons: wikitext scraping failed, falling back to DOM: ' + e);
		}
	}
	// DOM 兜底
	if (isBookFile(doc)) {
		scrapeBookFromDOM(doc, url);
		return;
	}
	scrapeFromDOM(doc, url);
}

async function getWikitext(url) {
	const m = url.match(/\/wiki\/(File:[^?#]+)/) || url.match(/[?&]title=(File:[^&#]+)/);
	if (!m) return '';
	let page = m[1];
	// URL 中的页面名是百分号编码的，必须先解码再重新编码，避免双重编码
	try {
		page = decodeURIComponent(page);
	}
	catch (e) {
		// 解码失败则使用原样
	}
	page = page.replace(/_/g, ' ');
	const apiUrl = 'https://commons.wikimedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&origin=*&page='
		+ encodeURIComponent(page);
	// 优先使用 requestJSON（现代 API），不可用时回退到 requestText
	try {
		const data = await requestJSON(apiUrl);
		return (data.parse && data.parse.wikitext) ? data.parse.wikitext : '';
	}
	catch (e) {
		Z.debug('Wikimedia Commons: requestJSON failed: ' + e);
	}
	// 回退到 requestText + JSON.parse
	try {
		const text = await requestText(apiUrl);
		const data = JSON.parse(text);
		return (data.parse && data.parse.wikitext) ? data.parse.wikitext : '';
	}
	catch (e) {
		Z.debug('Wikimedia Commons: requestText failed: ' + e);
	}
	return '';
}

// 从 wikitext 中提取 {{Name ...}} 模板体（花括号配平）
function extractTemplate(wikitext, name) {
	if (!wikitext) return null;
	const re = new RegExp('\\{\\{\\s*' + name + '\\b', 'i');
	const startMatch = re.exec(wikitext);
	if (!startMatch) return null;
	const start = startMatch.index;
	let depth = 0;
	for (let i = start; i < wikitext.length; i++) {
		if (wikitext.startsWith('{{', i)) {
			depth++;
			i++;
		}
		else if (wikitext.startsWith('}}', i)) {
			depth--;
			if (depth === 0) {
				return wikitext.slice(start + 2, i);
			}
			i++;
		}
	}
	return null;
}

// 提取 wikitext 中所有名为 name 的模板体
function extractAllTemplates(wikitext, name) {
	const results = [];
	if (!wikitext) return results;
	const re = new RegExp('\\{\\{\\s*' + name + '\\b', 'ig');
	let startMatch;
	while ((startMatch = re.exec(wikitext))) {
		const start = startMatch.index;
		let depth = 0;
		let i = start;
		for (; i < wikitext.length; i++) {
			if (wikitext.startsWith('{{', i)) {
				depth++;
				i++;
			}
			else if (wikitext.startsWith('}}', i)) {
				depth--;
				if (depth === 0) {
					results.push(wikitext.slice(start + 2, i));
					re.lastIndex = i + 2;
					break;
				}
				i++;
			}
		}
	}
	return results;
}

// 解析模板体为 参数名(小写)→值 的映射（跳过模板名）
function parseTemplateParams(body) {
	const params = {};
	// 跳过模板名，定位到第一个参数分隔符
	let i = 0;
	while (i < body.length && body[i] !== '|') i++;
	i++;
	let key = '';
	let val = '';
	let afterEq = false;
	let depth = 0;
	let linkDepth = 0;
	const flush = function () {
		if (!afterEq && !key.trim()) return;
		const k = afterEq ? key.trim().toLowerCase() : String(Object.keys(params).length + 1);
		const v = (afterEq ? val : key + val).trim();
		if (!k || !v) return;
		if (!(k in params)) params[k] = v;
	};
	for (; i < body.length; i++) {
		const c = body[i];
		const n = body[i + 1];
		if (c === '{' && n === '{') {
			depth++;
			if (afterEq) val += '{{';
			else key += '{{';
			i++;
			continue;
		}
		if (c === '}' && n === '}') {
			depth--;
			if (afterEq) val += '}}';
			else key += '}}';
			i++;
			continue;
		}
		if (c === '[' && n === '[') {
			linkDepth++;
			if (afterEq) val += '[[';
			else key += '[[';
			i++;
			continue;
		}
		if (c === ']' && n === ']') {
			linkDepth--;
			if (afterEq) val += ']]';
			else key += ']]';
			i++;
			continue;
		}
		if (c === '|' && depth <= 0 && linkDepth <= 0) {
			flush();
			key = '';
			val = '';
			afterEq = false;
			continue;
		}
		if (c === '=' && !afterEq && depth <= 0 && linkDepth <= 0) {
			afterEq = true;
			continue;
		}
		if (afterEq) val += c;
		else key += c;
	}
	flush();
	return params;
}

// 清理 wikitext 值：去语言模板/链接/注释/标签
// 保留换行（作者参数常以换行分隔多作者）
function cleanWikitext(value) {
	if (!value) return '';
	let v = value;
	// HTML 注释
	v = v.replace(/<!--[\s\S]*?-->/g, '');
	// 语言包装模板 {{en|1=...}} / {{lang|xx|...}} → 内容
	v = v.replace(/\{\{\s*(?:en|zh|zh-hans|zh-hant|zh-cn|zh-tw|zh-hk|zh-sg|ja|ko|fr|de|es|ru|it|pt|la|mul|lang)\s*([^{}]*)\}\}/gi, function (match, rest) {
		const parts = rest.split('|');
		const last = parts[parts.length - 1] || '';
		const m = last.match(/^\s*(?:\d+\s*=)?\s*(.+?)\s*$/);
		return m ? m[1] : '';
	});
	// 内部链接 [[a|b]] → b，[[a]] → a
	v = v.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2');
	v = v.replace(/\[\[([^\]]*)\]\]/g, '$1');
	// 作者模板 {{Creator:Name}} / {{Author:Name}} → Name
	v = v.replace(/\{\{\s*(?:Creator|Author)\s*:\s*([^{}]*?)\s*\}\}/gi, '$1');
	// DOI {{doi|...}} → 值
	v = v.replace(/\{\{\s*doi\s*\|([^{}]*?)\}\}/gi, '$1');
	// 机构模板 {{Institution:Name}} → Name
	v = v.replace(/\{\{\s*Institution\s*:\s*([^{}]*?)\s*\}\}/gi, '$1');
	// CADAL 链接 {{China Academic Digital Associative Library link|ID}} → CADAL: ID
	v = v.replace(/\{\{\s*China Academic Digital Associative Library link\s*\|([^{}]*?)\s*\}\}/gi, 'CADAL: $1');
	// PDF 页链接 {{PDF page link|page=N|text=T}} → T
	v = v.replace(/\{\{\s*PDF page link\s*\|[^{}]*?text\s*=\s*([^{}]*?)\s*\}\}/gi, '$1');
	// 移除剩余模板
	v = v.replace(/\{\{[^{}]*\}\}/g, '');
	// 移除引用与标签
	v = v.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
	v = v.replace(/<[^>]+>/g, '');
	// 压缩空白，保留单个换行
	return v.replace(/[ \t\u00a0\u200b\u200c]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{2,}/g, '\n')
		.trim();
}

// 单行清理（标题/出版社等不应包含换行的字段）
function cleanSingle(value) {
	return cleanWikitext(value).replace(/\n/g, ' ');
}

// 语言代码映射
function mapLanguage(lang) {
	if (!lang) return '';
	const l = lang.toLowerCase();
	const map = {
		'chinese': 'zh',
		'english': 'en',
		'japanese': 'ja',
		'french': 'fr',
		'german': 'de',
		'spanish': 'es',
		'russian': 'ru',
		'italian': 'it',
		'portuguese': 'pt',
		'latin': 'la',
		'korean': 'ko'
	};
	if (map[l]) return map[l];
	return /^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(l) ? l : '';
}

function pushCreator(item, name, creatorType = 'author') {
	let n = (name || '').replace(/ほか$/, '').trim();
	n = n.replace(/[著編撰譯注校訂整理]+$/, '').trim();
	if (!n) return;
	if (/^(unknown|anonym|anonymous|anon|unknown author)[：:]?\s*$/i.test(n)) return;
	if (/^Q\d+$/.test(n)) return;
	if (/[\u4e00-\u9fff]/.test(n)) {
		item.creators.push({
			lastName: n,
			creatorType: creatorType,
			fieldMode: 1
		});
	}
	else {
		const creator = ZU.cleanAuthor(n, creatorType);
		if (creator.lastName) {
			item.creators.push(creator);
		}
	}
}

// 解析作者字符串（支持多作者；作者可能以换行/分号/逗号分隔）
// 兼容 NDL 目录格式 "姓, 名, 生卒年"（如 "久保, 良英, 1883-1942"）
function addCreators(item, authorString, creatorType = 'author') {
	if (!authorString) return;
	// 按换行/分号分为多个作者组
	const groups = authorString.split(/[\n;；]+/);
	for (const group of groups) {
		const g = group.trim();
		if (!g) continue;
		// NDL 格式：姓, 名, 生卒年（有生卒年佐证，可安全合并）
		const ndl = g.match(/^([\u3040-\u30ff\u4e00-\u9fa5]{1,8})\s*[,，]\s*([\u3040-\u30ff\u4e00-\u9fa5]{1,8})\s*[,，]\s*\d{4}\s*[-–]\s*\d{4}$/);
		if (ndl) {
			pushCreator(item, ndl[1] + ndl[2], creatorType);
			continue;
		}
		// 假名形式的 姓, 名（日文名，无生卒年）
		const ndlKana = g.match(/^([\u3040-\u30ff]{1,8})\s*[,，]\s*([\u3040-\u30ff]{1,8})$/);
		if (ndlKana) {
			pushCreator(item, ndlKana[1] + ndlKana[2], creatorType);
			continue;
		}
		// 西文 姓名, 生卒年
		const west = g.match(/^([A-Za-zÀ-ÿ' .-]{2,})\s*,\s*\d{4}\s*[-–]\s*\d{4}$/);
		if (west) {
			pushCreator(item, west[1], creatorType);
			continue;
		}
		// 常规：按逗号/顿号拆分
		for (const seg of g.split(/[,，、]+/)) {
			pushCreator(item, seg, creatorType);
		}
	}
}

// 从文件页 DOM 中取 "Original file" 链接（原文件直链）
function getOriginalFileURL(doc) {
	let link = doc.querySelector('#file a[href*="upload.wikimedia.org"]')
		|| doc.querySelector('div.fullImageLink a')
		|| doc.querySelector('#file a[href*="special/filepath"]');
	if (link && link.href) return link.href;
	const img = doc.querySelector('#file img');
	if (img && img.src) return img.src;
	return '';
}

function getMimeType(url) {
	const ext = (url.match(/\.([a-z0-9]+)(\?|#|$)/i) || [])[1];
	const map = {
		'pdf': 'application/pdf',
		'djvu': 'image/vnd.djvu',
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'png': 'image/png',
		'tif': 'image/tiff',
		'tiff': 'image/tiff',
		'gif': 'image/gif'
	};
	return map[(ext || '').toLowerCase()] || '';
}

function addFileAttachment(item, doc, isBook) {
	const fileURL = getOriginalFileURL(doc);
	if (!fileURL) return;
	const mimeType = getMimeType(fileURL);
	if (isBook) {
		const title = /\.pdf$/i.test(fileURL) ? 'Full Text PDF' : decodeURIComponent(fileURL.split('/').pop() || '');
		item.attachments.push({
			title: title,
			mimeType: mimeType,
			url: fileURL
		});
	}
	else {
		item.attachments.push({
			title: 'Wikimedia Image',
			mimeType: mimeType,
			url: fileURL
		});
	}
}

// 从 DOM 单元格取渲染后的值（模板渲染结果），无 {{ 时用 wikitext 清理值
function hybridValue(rawWikitext, doc, id) {
	if (rawWikitext && !rawWikitext.includes('{{')) {
		return cleanWikitext(rawWikitext);
	}
	const el = doc.getElementById(id);
	const cell = el && el.nextElementSibling;
	if (cell) {
		return ZU.trimInternal(cell.textContent);
	}
	return rawWikitext ? cleanWikitext(rawWikitext) : '';
}

// 去除描述开头的语言前缀，如 "English: xxx" / "中文（简体）：xxx"
function stripLangPrefix(str) {
	return str.replace(/^\s*(中文(（简体|繁體）)?|English|日本語|Français|Deutsch|Русский|Español)\s*[:：]\s*/, '').trim();
}

// 解析 {{Information field|name=X|value=Y}} 序列（{{Book}} 的 Other_fields 参数）
function parseOtherFields(raw) {
	const fields = {};
	if (!raw) return fields;
	for (const body of extractAllTemplates(raw, 'Information field')) {
		const params = parseTemplateParams('Book|' + body);
		const name = cleanSingle(params['name']);
		const value = cleanSingle(params['value']);
		if (name && value && !(name in fields)) fields[name] = value;
	}
	return fields;
}

// 从日期值提取开头年份/年月，其余（如民国纪年注解）留给 extra
function extractDate(rawDate) {
	const m = rawDate.match(/^\d{4}(?:-\d{1,2}(?:-\d{1,2})?)?/);
	return m ? m[0] : '';
}

// {{Book}} 模板 → book
function scrapeBook(doc, url, body) {
	const params = parseTemplateParams(body);
	const otherFields = parseOtherFields(params['other fields'] || params['other_fields']);
	const item = new Z.Item('book');
	item.url = url;
	item.libraryCatalog = 'Wikimedia Commons';

	// 标题
	const title = cleanSingle(params['title']);
	item.title = title || ZU.trimInternal(doc.querySelector('#firstHeading').textContent).replace(/^File:/, '').trim();

	// 作者：优先 Author 参数，其次 Other_fields 的 Creator
	const author = cleanWikitext(params['author']);
	if (author) addCreators(item, author);
	if (!item.creators.length) {
		const creator = cleanWikitext(otherFields['Creator']);
		if (creator) addCreators(item, creator);
	}
	// 译者
	const translator = cleanWikitext(params['translator']);
	if (translator) addCreators(item, translator, 'translator');

	// 出版社与出版地（支持 "地点：出版社" 与 "出版社·地点" 两种格式）
	const publisherRaw = cleanSingle(params['publisher'] || params['printer']);
	if (publisherRaw) {
		const pubColon = publisherRaw.match(/^(.+?)[：:]\s*(.+)$/);
		if (pubColon) {
			item.place = pubColon[1].trim();
			item.publisher = pubColon[2].trim();
		}
		else {
			const pubParts = publisherRaw.split(/[·・]/);
			if (pubParts.length >= 2) {
				item.publisher = pubParts[0].trim();
				item.place = pubParts[pubParts.length - 1].trim();
			}
			else {
				item.publisher = publisherRaw;
			}
		}
	}
	// 出版地：优先 Other_fields 的 Publication Place，其次 City 参数（排除国家代码）
	if (!item.place) {
		const pubPlace = cleanSingle(otherFields['Publication Place']);
		if (pubPlace) {
			item.place = pubPlace;
		}
		else {
			const city = cleanSingle(params['city'] || params['place of publication']);
			if (city && !/^[a-z]{2}$/i.test(city)) item.place = city;
		}
	}

	// 日期（提取开头年月，纪年注解放入 extra）
	const rawDate = cleanSingle(params['publication date'] || params['date'] || params['year']);
	if (rawDate) {
		const date = extractDate(rawDate);
		if (date) item.date = date;
		else item.date = rawDate;
	}

	const language = mapLanguage(cleanSingle(params['language']));
	if (language) item.language = language;

	const isbn = cleanSingle(params['isbn']);
	if (isbn) {
		const isbnMatch = isbn.match(/(\d[\dXx-]{9,})/);
		if (isbnMatch) item.ISBN = ZU.cleanISBN(isbnMatch[1]);
	}

	const volume = cleanSingle(params['volume']);
	if (volume) item.volume = volume;

	const edition = cleanSingle(params['edition']);
	if (edition) item.edition = edition;

	// 页数：Book 的 Pages 参数或 Other_fields 的 Extent（如 "604p ; 19cm"）
	const pages = cleanSingle(params['pages']);
	if (pages) {
		const pageMatch = pages.match(/(\d+)\s*页?p?/i);
		if (pageMatch) item.numPages = pageMatch[1];
	}
	if (!item.numPages) {
		const extent = cleanSingle(otherFields['Extent']);
		if (extent) {
			const extentMatch = extent.match(/(\d+)\s*页?p?/i);
			if (extentMatch) item.numPages = extentMatch[1];
		}
	}

	const description = cleanSingle(params['description']);
	if (description) item.abstractNote = description;

	const source = cleanSingle(params['source']);
	const extraParts = [];
	if (source) {
		// DOI（如 NDL 的 10.11501/969301）
		const doiMatch = source.match(/10\.\d{4,9}\/[^\s]+/i);
		if (doiMatch) item.DOI = doiMatch[0].replace(/\.$/, '');
		extraParts.push('Source: ' + source);
	}
	// 纪年注解等日期补充信息
	if (rawDate && item.date && rawDate !== item.date) {
		extraParts.push('Publication date: ' + rawDate);
	}
	// Other_fields 中的其余元信息（跳过已映射字段与结构噪声字段）
	for (const name of Object.keys(otherFields)) {
		const lower = name.toLowerCase();
		const value = otherFields[name];
		if (lower === 'creator') continue;            // 已作作者处理
		if (lower === 'publication place') continue;  // 已作出版地处理
		if (lower === 'extent') continue;             // 已作页数处理
		if (lower === 'page list' || lower === 'empty pages') continue; // 结构噪声
		if (lower === 'call number') {
			item.callNumber = value;
			continue;
		}
		extraParts.push(name + ': ' + value);
	}

	if (extraParts.length) item.extra = extraParts.join('\n');

	addFileAttachment(item, doc, true);
	item.complete();
}

// {{Information}} 模板 → artwork（PDF/DjVu 则作为 book）
function scrapeInformation(doc, url, body) {
	const params = parseTemplateParams(body);
	const isBook = isBookFile(doc);

	const description = hybridValue(params['description'], doc, 'fileinfotpl_desc');
	const title = stripLangPrefix(description);

	const author = hybridValue(params['author'], doc, 'fileinfotpl_aut');
	const date = cleanSingle(hybridValue(params['date'], doc, 'fileinfotpl_date'));
	const source = cleanSingle(hybridValue(params['source'], doc, 'fileinfotpl_src'));
	const permission = cleanSingle(hybridValue(params['permission'], doc, 'fileinfotpl_perm'))
		|| textFromLicensetpl(doc);

	if (isBook) {
		const item = new Z.Item('book');
		item.url = url;
		item.libraryCatalog = 'Wikimedia Commons';
		item.title = title || ZU.trimInternal(doc.querySelector('#firstHeading').textContent).replace(/^File:/, '').trim();
		addCreators(item, author);
		if (date) item.date = date;
		if (source) item.extra = 'Source: ' + source;
		addFileAttachment(item, doc, true);
		item.complete();
		return;
	}

	const item = new Z.Item('artwork');
	item.url = url;
	item.libraryCatalog = 'Wikimedia Commons';
	item.title = title;
	addCreators(item, author);
	if (date) item.date = date;
	if (source) item.archive = source;
	if (permission) item.rights = permission;
	addFileAttachment(item, doc, false);
	item.complete();
}

// 兜底：从 DOM 的 fileinfotpl_* ID 直接提取（API 不可用时）
// 不依赖 findBookTable 的文本匹配，直接用 ID 定位更可靠
function scrapeBookFromDOM(doc, url) {
	const item = new Z.Item('book');
	item.url = url;
	item.libraryCatalog = 'Wikimedia Commons';

	// 直接用 fileinfotpl_* ID 取值（th 的 nextElementSibling 即 td）
	const valById = function (id) {
		const el = doc.getElementById(id);
		if (el && el.nextElementSibling) {
			return ZU.trimInternal(el.nextElementSibling.textContent);
		}
		return '';
	};

	let title = valById('fileinfotpl_art_title');
	if (!title) {
		const heading = doc.querySelector('#firstHeading');
		title = heading ? ZU.trimInternal(heading.textContent).replace(/^File:/, '').trim() : '';
	}
	item.title = title;

	const author = valById('fileinfotpl_aut');
	if (author) addCreators(item, author);

	// 出版社与出版地（支持 "地点：出版社" 与 "出版社·地点" 两种格式）
	const publisherRaw = valById('fileinfotpl_book_publisher');
	if (publisherRaw) {
		const pubColon = publisherRaw.match(/^(.+?)[：:]\s*(.+)$/);
		if (pubColon) {
			item.place = pubColon[1].trim();
			item.publisher = pubColon[2].trim();
		}
		else {
			const pubParts = publisherRaw.split(/[·・]/);
			if (pubParts.length >= 2) {
				item.publisher = pubParts[0].trim();
				item.place = pubParts[pubParts.length - 1].trim();
			}
			else {
				item.publisher = publisherRaw;
			}
		}
	}
	if (!item.place) {
		const place = valById('fileinfotpl_book_place-of-publication');
		if (place && !/^[a-z]{2}$/i.test(place)) item.place = place;
	}

	const date = valById('fileinfotpl_publication_date') || valById('fileinfotpl_date');
	if (date) {
		const dateMatch = extractDate(date);
		item.date = dateMatch || date;
	}

	const langRaw = valById('fileinfotpl_book_language');
	if (langRaw) {
		const lang = mapLanguage(langRaw);
		if (lang) item.language = lang;
	}

	const edition = valById('fileinfotpl_edition');
	if (edition) item.edition = edition;

	const isbn = valById('fileinfotpl_isbn');
	if (isbn) {
		const isbnMatch = isbn.match(/(\d[\dXx-]{9,})/);
		if (isbnMatch) item.ISBN = ZU.cleanISBN(isbnMatch[1]);
	}

	// Source 字段：DOM 渲染的 source 单元格可能包含大量机构信息，只取前面部分
	const source = valById('fileinfotpl_src');
	const extraParts = [];
	if (source) {
		// 截取前 200 字符避免机构模板的长文本
		const shortSource = source.slice(0, 200);
		extraParts.push('Source: ' + shortSource);
	}
	if (date && item.date && date !== item.date) {
		extraParts.push('Publication date: ' + date);
	}
	if (extraParts.length) item.extra = extraParts.join('\n');

	addFileAttachment(item, doc, true);
	item.complete();
}

// 兼容旧调用：查找 {{Book}} 渲染表格
function findBookTable(doc) {
	const tables = doc.querySelectorAll('table');
	for (const table of tables) {
		const rows = table.querySelectorAll('tr');
		for (const row of rows) {
			const cells = row.querySelectorAll('th, td');
			if (cells.length < 2) continue;
			const label = ZU.trimInternal(cells[0].textContent).toLowerCase();
			if (label === 'title' || label === 'author') {
				return table;
			}
		}
	}
	return null;
}

// 兜底：普通图片/照片页
function scrapeFromDOM(doc, url) {
	const item = new Z.Item('artwork');
	item.url = url;
	item.libraryCatalog = 'Wikimedia Commons';

	const titleCell = doc.getElementById('fileinfotpl_art_title') || doc.getElementById('fileinfotpl_desc');
	if (titleCell && titleCell.nextElementSibling) {
		item.title = stripLangPrefix(ZU.trimInternal(titleCell.nextElementSibling.textContent));
	}
	if (!item.title) {
		item.title = ZU.trimInternal(doc.querySelector('#firstHeading').textContent).replace(/^File:/, '').trim();
	}

	const author = textAfterId(doc, 'fileinfotpl_aut');
	if (author) addCreators(item, author);

	const date = textAfterId(doc, 'fileinfotpl_date');
	if (date) item.date = date;

	const source = textAfterId(doc, 'fileinfotpl_src');
	if (source) item.archive = source;

	const rights = textAfterId(doc, 'fileinfotpl_perm') || textFromLicensetpl(doc);
	if (rights) item.rights = rights;

	addFileAttachment(item, doc, false);
	item.complete();
}

function textAfterId(doc, id) {
	const el = doc.getElementById(id);
	if (el && el.nextElementSibling) {
		return ZU.trimInternal(el.nextElementSibling.textContent);
	}
	return '';
}

function textFromLicensetpl(doc) {
	const cell = doc.querySelector('table.licensetpl tbody tr td:nth-child(2), table.licensetpl tbody tr td span');
	return cell ? ZU.trimInternal(cell.textContent) : '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://commons.wikimedia.org/wiki/File:Boy_with_a_Basket_of_Fruit-Caravaggio_(1593).jpg",
		"items": [
			{
				"itemType": "artwork",
				"title": "Boy with a Basket of Fruit",
				"creators": [
					{
						"firstName": "",
						"lastName": "Caravaggio",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "circa 1593",
				"archive": "Galleria Borghese",
				"libraryCatalog": "Wikimedia Commons",
				"rights": "Public domain",
				"url": "https://commons.wikimedia.org/wiki/File:Boy_with_a_Basket_of_Fruit-Caravaggio_(1593).jpg",
				"attachments": [
					{
						"title": "Wikimedia Image",
						"mimeType": "image/jpeg"
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
		"url": "https://commons.wikimedia.org/w/index.php?search=peron&button=&title=Special%3ASearch&limit=100",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://commons.wikimedia.org/wiki/File:Portrait_of_Ambroise_Vollard.jpg",
		"items": [
			{
				"itemType": "artwork",
				"title": "Portrait of Ambroise Vollard",
				"creators": [
					{
						"firstName": "Paul",
						"lastName": "Cézanne",
						"creatorType": "author"
					}
				],
				"date": "1899",
				"archive": "Petit Palais, Paris",
				"libraryCatalog": "Wikimedia Commons",
				"rights": "Public domain",
				"url": "https://commons.wikimedia.org/wiki/File:Portrait_of_Ambroise_Vollard.jpg",
				"attachments": [
					{
						"title": "Wikimedia Image",
						"mimeType": "image/jpeg"
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
		"url": "https://commons.wikimedia.org/wiki/File:Plaza_Congreso.JPG",
		"items": [
			{
				"itemType": "artwork",
				"title": "Congressional Plaza, Buenos Aires, Argentina.",
				"creators": [
					{
						"firstName": "",
						"lastName": "Napoletano",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "28 January 2012",
				"archive": "Own work",
				"libraryCatalog": "Wikimedia Commons",
				"rights": "Permission is granted to copy, distribute and/or modify this document under the terms of the GNU Free Documentation License, Version 1.2 or any later version published by the Free Software Foundation; with no Invariant Sections, no Front-Cover Texts, and no Back-Cover Texts. A copy of the license is included in the section entitled GNU Free Documentation License.http://www.gnu.org/copyleft/fdl.htmlGFDLGNU Free Documentation Licensetruetrue",
				"url": "https://commons.wikimedia.org/wiki/File:Plaza_Congreso.JPG",
				"attachments": [
					{
						"title": "Wikimedia Image",
						"mimeType": "image/jpeg"
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
		"url": "http://commons.wikimedia.org/wiki/Commons:Valued_images_by_topic/Science",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://commons.wikimedia.org/wiki/File:NDL969301_%E7%B2%BE%E7%A5%9E%E5%88%86%E6%9E%90%E6%B3%95_part4.pdf",
		"items": [
			{
				"itemType": "book",
				"title": "精神分析法",
				"creators": [
					{
						"firstName": "",
						"lastName": "久保良英",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"callNumber": "503-166",
				"date": "1922",
				"DOI": "10.11501/969301",
				"edition": "増訂3版",
				"extra": "Source: 10.11501/969301 National Diet Library\nPublication date: 1922 大正11\nSubject: NDC: 146\nMaterial Type: Book\nSource Identifier: JPNO: 43036499\nDate Digitized: W3CDTF: 2009-03-31\nAudience: 一般\nTitle Transcription: セイシン ブンセキホウ\nPublisher Transcription: チュウオウカン ショテン\nSource Identifier: NDLBibID: 000000583869\nCreator Transcription: NDLNA: クボ, ヨシヒデ\nCreator: NDLNAId: 00036666\nContents: 第七　グレデイヴア物語/592",
				"language": "ja",
				"libraryCatalog": "Wikimedia Commons",
				"numPages": "604",
				"place": "東京",
				"publisher": "中央館書店",
				"url": "https://commons.wikimedia.org/wiki/File:NDL969301_%E7%B2%BE%E7%A5%9E%E5%88%86%E6%9E%90%E6%B3%95_part4.pdf",
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
		"url": "https://commons.wikimedia.org/wiki/File:CADAL03011260_%E7%B2%BE%E7%A5%9E%E5%88%86%E6%9E%90%E5%AD%B8ABC.djvu",
		"items": [
			{
				"itemType": "book",
				"title": "精神分析學ABC",
				"creators": [
					{
						"firstName": "",
						"lastName": "张东荪",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1929-05",
				"extra": "Source: CADAL: 03011260 Jilin University\nPublication date: 1929-05（民国十八年）",
				"language": "zh",
				"libraryCatalog": "Wikimedia Commons",
				"place": "上海",
				"publisher": "世界书局",
				"url": "https://commons.wikimedia.org/wiki/File:CADAL03011260_%E7%B2%BE%E7%A5%9E%E5%88%86%E6%9E%90%E5%AD%B8ABC.djvu",
				"attachments": [
					{
						"title": "CADAL03011260_精神分析學ABC.djvu",
						"mimeType": "image/vnd.djvu"
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
		"url": "https://commons.wikimedia.org/wiki/File:SSID-12434636_%E7%B2%BE%E7%A5%9E%E5%88%86%E6%9E%90%E8%88%87%E5%94%AF%E7%89%A9%E5%8F%B2%E8%A7%80.pdf",
		"items": [
			{
				"itemType": "book",
				"title": "精神分析與唯物史觀",
				"creators": [
					{
						"firstName": "",
						"lastName": "奥斯旁",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1949",
				"language": "zh",
				"libraryCatalog": "Wikimedia Commons",
				"place": "香港",
				"publisher": "世界书局出版社",
				"url": "https://commons.wikimedia.org/wiki/File:SSID-12434636_%E7%B2%BE%E7%A5%9E%E5%88%86%E6%9E%90%E8%88%87%E5%94%AF%E7%89%A9%E5%8F%B2%E8%A7%80.pdf",
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
	}
]
/** END TEST CASES **/
