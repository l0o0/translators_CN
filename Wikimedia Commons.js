{
	"translatorID": "c70055c3-a525-45db-8e37-726c6c2ad034",
	"label": "Wikimedia Commons",
	"creator": "Sebastian Karcher",
	"target": "^https?://commons\\.wikimedia\\.org",
	"minVersion": "2.1.9",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-07-10 23:00:00"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2014-2019 Sebastian Karcher

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

// eslint-disable-next-line
/* FW LINE 59:b820c6d */ function flatten(t){var e=new Array;for(var i in t){var r=t[i];r instanceof Array?e=e.concat(flatten(r)):e.push(r)}return e}var FW={_scrapers:new Array};FW._Base=function(){this.callHook=function(t,e,i,r){if("object"==typeof this.hooks){var n=this.hooks[t];"function"==typeof n&&n(e,i,r)}},this.evaluateThing=function(t,e,i){var r=typeof t;if("object"===r){if(t instanceof Array){var n=this.evaluateThing,a=t.map(function(t){return n(t,e,i)});return flatten(a)}return t.evaluate(e,i)}return"function"===r?t(e,i):t},this.makeItems=function(t,e,i,r,n){n()}},FW.Scraper=function(t){FW._scrapers.push(new FW._Scraper(t))},FW._Scraper=function(t){for(x in t)this[x]=t[x];this._singleFieldNames=["abstractNote","applicationNumber","archive","archiveLocation","artworkMedium","artworkSize","assignee","audioFileType","audioRecordingType","billNumber","blogTitle","bookTitle","callNumber","caseName","code","codeNumber","codePages","codeVolume","committee","company","conferenceName","country","court","date","dateDecided","dateEnacted","dictionaryTitle","distributor","docketNumber","documentNumber","DOI","edition","encyclopediaTitle","episodeNumber","extra","filingDate","firstPage","forumTitle","genre","history","institution","interviewMedium","ISBN","ISSN","issue","issueDate","issuingAuthority","journalAbbreviation","label","language","legalStatus","legislativeBody","letterType","libraryCatalog","manuscriptType","mapType","medium","meetingName","nameOfAct","network","number","numberOfVolumes","numPages","pages","patentNumber","place","postType","presentationType","priorityNumbers","proceedingsTitle","programTitle","programmingLanguage","publicLawNumber","publicationTitle","publisher","references","reportNumber","reportType","reporter","reporterVolume","rights","runningTime","scale","section","series","seriesNumber","seriesText","seriesTitle","session","shortTitle","studio","subject","system","thesisType","title","type","university","url","version","videoRecordingType","volume","websiteTitle","websiteType"],this._makeAttachments=function(t,e,i,r){if(i instanceof Array)i.forEach(function(i){this._makeAttachments(t,e,i,r)},this);else if("object"==typeof i){var n=i.urls||i.url,a=i.types||i.type,s=i.titles||i.title,o=i.snapshots||i.snapshot,u=this.evaluateThing(n,t,e),l=this.evaluateThing(s,t,e),c=this.evaluateThing(a,t,e),h=this.evaluateThing(o,t,e);u instanceof Array||(u=[u]);for(var f in u){var p,m,v,d=u[f];p=c instanceof Array?c[f]:c,m=l instanceof Array?l[f]:l,v=h instanceof Array?h[f]:h,r.attachments.push({url:d,title:m,mimeType:p,snapshot:v})}}},this.makeItems=function(t,e,i,r,n){var a=new Zotero.Item(this.itemType);a.url=e;for(var s in this._singleFieldNames){var o=this._singleFieldNames[s];if(this[o]){var u=this.evaluateThing(this[o],t,e);u instanceof Array?a[o]=u[0]:a[o]=u}}var l=["creators","tags"];for(var c in l){var h=l[c],f=this.evaluateThing(this[h],t,e);if(f)for(var p in f)a[h].push(f[p])}this._makeAttachments(t,e,this.attachments,a),r(a,this,t,e),n()}},FW._Scraper.prototype=new FW._Base,FW.MultiScraper=function(t){FW._scrapers.push(new FW._MultiScraper(t))},FW._MultiScraper=function(t){for(x in t)this[x]=t[x];this._mkSelectItems=function(t,e){var i=new Object;for(var r in t)i[e[r]]=t[r];return i},this._selectItems=function(t,e,i){var r=new Array;Zotero.selectItems(this._mkSelectItems(t,e),function(t){for(var e in t)r.push(e);i(r)})},this._mkAttachments=function(t,e,i){var r=this.evaluateThing(this.attachments,t,e),n=new Object;if(r)for(var a in i)n[i[a]]=r[a];return n},this._makeChoices=function(t,e,i,r,n){if(t instanceof Array)t.forEach(function(t){this._makeTitlesUrls(t,e,i,r,n)},this);else if("object"==typeof t){var a=t.urls||t.url,s=t.titles||t.title,o=this.evaluateThing(a,e,i),u=this.evaluateThing(s,e,i),l=u instanceof Array;o instanceof Array||(o=[o]);for(var c in o){var h,f=o[c];h=l?u[c]:u,n.push(f),r.push(h)}}},this.makeItems=function(t,e,i,r,n){if(this.beforeFilter){var a=this.beforeFilter(t,e);if(a!=e)return void this.makeItems(t,a,i,r,n)}var s=[],o=[];this._makeChoices(this.choices,t,e,s,o);var u=this._mkAttachments(t,e,o),l=this.itemTrans;this._selectItems(s,o,function(t){if(t){var e=function(t){var e=t.documentURI,i=l;void 0===i&&(i=FW.getScraper(t,e)),void 0===i||i.makeItems(t,e,u[e],r,function(){})};Zotero.Utilities.processDocuments(t,e,n)}else n()})}},FW._MultiScraper.prototype=new FW._Base,FW.WebDelegateTranslator=function(t){return new FW._WebDelegateTranslator(t)},FW._WebDelegateTranslator=function(t){for(x in t)this[x]=t[x];this.makeItems=function(t,e,i,r,n){var a=this,s=Zotero.loadTranslator("web");s.setHandler("itemDone",function(i,n){r(n,a,t,e)}),s.setDocument(t),this.translatorId?(s.setTranslator(this.translatorId),s.translate()):(s.setHandler("translators",function(t,e){e.length&&(s.setTranslator(e[0]),s.translate())}),s.getTranslators()),n()}},FW._WebDelegateTranslator.prototype=new FW._Base,FW._StringMagic=function(){this._filters=new Array,this.addFilter=function(t){return this._filters.push(t),this},this.split=function(t){return this.addFilter(function(e){return e.split(t).filter(function(t){return""!=t})})},this.replace=function(t,e,i){return this.addFilter(function(r){return"string"!=typeof r?r:r.match(t)?r.replace(t,e,i):r})},this.prepend=function(t){return this.replace(/^/,t)},this.append=function(t){return this.replace(/$/,t)},this.remove=function(t,e){return this.replace(t,"",e)},this.trim=function(){return this.addFilter(function(t){return Zotero.Utilities.trim(t)})},this.trimInternal=function(){return this.addFilter(function(t){return Zotero.Utilities.trimInternal(t)})},this.match=function(t,e){return e||(e=0),this.addFilter(function(i){var r=i.match(t);return void 0===r||null===r?void 0:r[e]})},this.cleanAuthor=function(t,e){return this.addFilter(function(i){return"string"!=typeof i?i:Zotero.Utilities.cleanAuthor(i,t,e)})},this.key=function(t){return this.addFilter(function(e){return e[t]})},this.capitalizeTitle=function(){return this.addFilter(function(t){return Zotero.Utilities.capitalizeTitle(t)})},this.unescapeHTML=function(){return this.addFilter(function(t){return Zotero.Utilities.unescapeHTML(t)})},this.unescape=function(){return this.addFilter(function(t){return unescape(t)})},this._applyFilters=function(t,e){for(i in this._filters){t=flatten(t),t=t.filter(function(t){return void 0!==t&&null!==t});for(var r=0;r<t.length;r++)try{if(void 0===t[r]||null===t[r])continue;t[r]=this._filters[i](t[r],e)}catch(n){t[r]=void 0,Zotero.debug("Caught exception "+n+"on filter: "+this._filters[i])}t=t.filter(function(t){return void 0!==t&&null!==t})}return flatten(t)}},FW.PageText=function(){return new FW._PageText},FW._PageText=function(){this._filters=new Array,this.evaluate=function(t){var e=[t.documentElement.innerHTML];return e=this._applyFilters(e,t),0==e.length?!1:e}},FW._PageText.prototype=new FW._StringMagic,FW.Url=function(){return new FW._Url},FW._Url=function(){this._filters=new Array,this.evaluate=function(t,e){var i=[e];return i=this._applyFilters(i,t),0==i.length?!1:i}},FW._Url.prototype=new FW._StringMagic,FW.Xpath=function(t){return new FW._Xpath(t)},FW._Xpath=function(t){this._xpath=t,this._filters=new Array,this.text=function(){var t=function(t){return"object"==typeof t&&t.textContent?t.textContent:t};return this.addFilter(t),this},this.sub=function(t){var e=function(e,i){var r=i.evaluate(t,e,null,XPathResult.ANY_TYPE,null);return r?r.iterateNext():void 0};return this.addFilter(e),this},this.evaluate=function(t){var e=t.evaluate(this._xpath,t,null,XPathResult.ANY_TYPE,null),i=e.resultType,r=new Array;if(i==XPathResult.STRING_TYPE)r.push(e.stringValue);else if(i==XPathResult.BOOLEAN_TYPE)r.push(e.booleanValue);else if(i==XPathResult.NUMBER_TYPE)r.push(e.numberValue);else if(i==XPathResult.ORDERED_NODE_ITERATOR_TYPE||i==XPathResult.UNORDERED_NODE_ITERATOR_TYPE)for(var n;n=e.iterateNext();)r.push(n);return r=this._applyFilters(r,t),0==r.length?!1:r}},FW._Xpath.prototype=new FW._StringMagic,FW.detectWeb=function(t,e){for(var i in FW._scrapers){var r=FW._scrapers[i],n=r.evaluateThing(r.itemType,t,e),a=r.evaluateThing(r.detect,t,e);if(a.length>0&&a[0])return n}},FW.getScraper=function(t,e){var i=FW.detectWeb(t,e);return FW._scrapers.filter(function(r){return r.evaluateThing(r.itemType,t,e)==i&&r.evaluateThing(r.detect,t,e)})[0]},FW.doWeb=function(t,e){var i=FW.getScraper(t,e);i.makeItems(t,e,[],function(t,e,i,r){e.callHook("scraperDone",t,i,r),t.title||(t.title=""),t.complete()},function(){Zotero.done()}),Zotero.wait()};
var BOOK_EXT_REGEX = /\.(pdf|djvu|epub|mobi)$/i;

function isBookPage(doc, url) {
	return /\/wiki\/File:/.test(url) && BOOK_EXT_REGEX.test(url) &&
		doc.querySelector('#fileinfotpl_book_publisher, #fileinfotpl_book_language, #fileinfotpl_art_title, #fileinfotpl_aut');
}

function isSearchResultsPage(doc, url) {
	if (!/Special:Search/.test(url)) return false;
	var params = parseUrlParams(url);
	return !!(params.search && params.search.trim());
}

function parseUrlParams(url) {
	var params = {};
	var query = url.split('?')[1] || '';
	if (!query) return params;
	var parts = query.split('&');
	for (var i = 0; i < parts.length; i++) {
		var pair = parts[i].split('=');
		if (pair.length < 2) continue;
		var key = decodeURIComponent(pair[0]);
		var value = decodeURIComponent(pair.slice(1).join('=').replace(/\+/g, ' '));
		params[key] = value;
	}
	return params;
}

function getSearchResults(url, callback) {
	var params = parseUrlParams(url);
	var searchTerm = params.search;
	if (!searchTerm) {
		callback({});
		return;
	}

	var namespaces = [];
	for (var key in params) {
		var m = key.match(/^ns(\d+)$/);
		if (m && params[key] === '1') namespaces.push(m[1]);
	}
	var ns = namespaces.length ? namespaces.join('|') : '6';
	var apiUrl = 'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch='
		+ encodeURIComponent(searchTerm)
		+ '&srnamespace=' + ns
		+ '&srlimit=50&format=json';

	ZU.doGet(apiUrl, function (respText) {
		var data;
		try {
			data = JSON.parse(respText);
		}
		catch (e) {
			Zotero.debug('Wikimedia Commons: failed to parse search API response: ' + e);
		}

		var items = {};
		var results = data && data.query && data.query.search || [];
		for (var i = 0; i < results.length; i++) {
			var title = results[i].title;
			if (!title || !/^File:/i.test(title)) continue;
			if (!BOOK_EXT_REGEX.test(title)) continue;
			var pageTitle = title.replace(/ /g, '_');
			var itemUrl = 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(pageTitle).replace(/%2F/g, '/');
			var display = title.replace(/^File:/i, '').replace(/_/g, ' ');
			items[itemUrl] = display;
		}
		callback(items);
	});
}

function getFilenameFromUrl(url) {
	var decoded = decodeURIComponent(url);
	var match = decoded.match(/\/wiki\/File:([^#?]+)/);
	return match ? match[1] : '';
}

function getBookAttachmentMeta(filename) {
	var extMatch = filename.match(/\.([^.]+)$/);
	var ext = extMatch ? extMatch[1].toLowerCase() : '';
	var mimeType = 'application/octet-stream';
	if (ext === 'pdf') mimeType = 'application/pdf';
	else if (ext === 'djvu') mimeType = 'image/vnd.djvu';
	else if (ext === 'epub') mimeType = 'application/epub+zip';
	else if (ext === 'mobi') mimeType = 'application/x-mobipocket-ebook';
	return {
		ext: ext,
		title: ext ? 'Wikimedia Commons ' + ext.toUpperCase() : 'Wikimedia Commons File',
		mimeType: mimeType
	};
}

function textContent(doc, selector) {
	var el = doc.querySelector(selector);
	return el ? el.textContent : '';
}

function normalizeUrl(url) {
	if (!url || typeof url !== 'string') return url;
	if (/^https?:\/\//.test(url)) return url;
	if (/^\/\//.test(url)) return 'https:' + url;
	if (/^\//.test(url)) return 'https://commons.wikimedia.org' + url;
	return url;
}

function parseBookTemplate(wikitext) {
	var params = {};
	var match = wikitext.match(/\{\{\s*Book\s*([\s\S]*?)\n?\}\}/i);
	if (!match) return params;

	var lines = match[1].split('\n');
	var currentKey = null;
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		var paramMatch = line.match(/^\s*\|\s*([^\n=]+?)\s*=\s*(.*)$/);
		if (paramMatch) {
			currentKey = paramMatch[1].trim();
			params[currentKey] = paramMatch[2].trim();
		}
		else if (currentKey && line.trim() && !/^\s*\|/.test(line)) {
			params[currentKey] += '\n' + line.trim();
		}
	}
	return params;
}

function parseInformationTemplate(wikitext) {
	var params = {};
	var match = wikitext.match(/\{\{\s*Information\s*([\s\S]*?)\n?\}\}/i);
	if (!match) return params;

	var lines = match[1].split('\n');
	var currentKey = null;
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		var paramMatch = line.match(/^\s*\|\s*([^\n=]+?)\s*=\s*(.*)$/);
		if (paramMatch) {
			currentKey = paramMatch[1].trim().toLowerCase();
			params[currentKey] = paramMatch[2].trim();
		}
		else if (currentKey && line.trim() && !/^\s*\|/.test(line)) {
			params[currentKey] += '\n' + line.trim();
		}
	}
	return params;
}

function cleanDescription(desc) {
	if (!desc) return '';
	desc = desc.replace(/\{\{\s*[a-z]{2,3}(?:-[a-zA-Z]+)?\s*\|\s*\d*\s*=\s*([^}]+)\}\}/g, '$1');
	desc = desc.replace(/\{\{[^}]+\}\}/g, '');
	return desc.trim();
}

function cleanWikitextLink(text) {
	if (!text) return '';
	var linkMatch = text.match(/\[\[[^\]|]+\|([^\]]+)\]\]/);
	if (linkMatch) return linkMatch[1].trim();
	linkMatch = text.match(/\[\[([^\]]+)\]\]/);
	if (linkMatch) return linkMatch[1].trim();
	return text.trim();
}

function isChineseName(name) {
	return /[\u4e00-\u9fa5]/.test(name);
}

function getInfoField(wikitext, fieldName) {
	var regex = new RegExp('\\{\\{\\s*Information field\\s*\\|\\s*name\\s*=\\s*' + fieldName + '\\s*\\|\\s*value\\s*=\\s*([^}]+)\\}\\}', 'i');
	var m = wikitext.match(regex);
	return m ? m[1].trim() : null;
}

function addCreators(item, value, defaultType) {
	if (!value) return;
	var creators = parseCreators(value, defaultType);
	for (var i = 0; i < creators.length; i++) {
		item.creators.push(creators[i]);
	}
}

function parseCreators(authorString, defaultType) {
	var creators = [];
	var segments = authorString.split(/[；;]/);
	for (var s = 0; s < segments.length; s++) {
		var segment = segments[s].trim();
		if (!segment) continue;

		var creatorType = defaultType || 'author';

		var cleaned = segment.replace(/(原著|著译|著譯|著|译|譯|翻|编译|編|编|撰|[註注]|整理|校订|校訂|主編|主编)/g, '').trim();
		var names = cleaned.split(/[，,]/);
		for (var i = 0; i < names.length; i++) {
			var name = names[i].trim();
			if (!name) continue;

			var parenMatch = name.match(/^([^\(（]+)[\(（]/);
			if (parenMatch && parenMatch[1].trim()) {
				name = parenMatch[1].trim();
			}
			else if (/^[\(（]/.test(name)) {
				name = name.replace(/^[\(（][^\)）]+[\)）]\s*/, '').trim();
			}

			if (!name) continue;

			if (isChineseName(name)) {
				creators.push({
					firstName: '',
					lastName: name,
					creatorType: creatorType,
					fieldMode: 1
				});
			}
			else {
				var cleaned = Zotero.Utilities.cleanAuthor(name, creatorType, false);
				if (cleaned && cleaned.lastName) creators.push(cleaned);
			}
		}
	}
	return creators;
}

function mapLanguage(lang) {
	if (!lang) return '';
	lang = lang.toLowerCase();
	if (lang === 'zh' || lang === 'chinese' || lang === '中文') return 'zh';
	if (lang === 'zh-tw') return 'zh-TW';
	if (lang === 'zh-cn') return 'zh-CN';
	if (lang === 'en' || lang === 'english') return 'en';
	return lang;
}

function scrapeBook(doc, url, doneCallback) {
	var filename = getFilenameFromUrl(url);
	var filePathUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(filename);
	var apiUrl = 'https://commons.wikimedia.org/w/api.php?action=parse&page=File:'
		+ encodeURIComponent(filename) + '&prop=wikitext&format=json';

	ZU.doGet(apiUrl, function (respText) {
		var data;
		try {
			data = JSON.parse(respText);
		}
		catch (e) {
			Zotero.debug('Wikimedia Commons: failed to parse API response: ' + e);
		}

		var wikitext = data && data.parse && data.parse.wikitext && data.parse.wikitext['*'] || '';
		var bookParams = parseBookTemplate(wikitext);
		var infoParams = parseInformationTemplate(wikitext);

		var item = new Zotero.Item('book');
		item.url = url;
		item.libraryCatalog = 'Wikimedia Commons';

		var title = bookParams.Title;
		if (!title && infoParams.description) title = cleanDescription(infoParams.description);
		if (!title) title = textContent(doc, 'h1#firstHeading') || '';
		item.title = title.replace(/^File:/, '').replace(BOOK_EXT_REGEX, '').trim();

		addCreators(item, bookParams.Author, 'author');
		if (!item.creators.length && infoParams.author) {
			addCreators(item, cleanWikitextLink(infoParams.author), 'author');
		}
		addCreators(item, bookParams.Translator, 'author');
		addCreators(item, bookParams.Editor, 'author');
		addCreators(item, bookParams.Illustrator, 'author');

		if (bookParams.Publisher) item.publisher = bookParams.Publisher;
		if (bookParams['Publication date']) item.date = bookParams['Publication date'];
		else if (infoParams.date) item.date = infoParams.date;
		if (bookParams.City) item.place = bookParams.City;
		if (bookParams.Edition) item.edition = bookParams.Edition;
		if (bookParams.Language) item.language = mapLanguage(bookParams.Language);
		else if (infoParams.description && /\{\{\s*en\s*\|/.test(infoParams.description)) item.language = 'en';

		var pages = bookParams.Pages || getInfoField(wikitext, 'Pages');
		if (pages) item.numPages = String(pages);

		var source = bookParams.Source;
		if (source) {
			source = source.replace(/\{\{[^}]+\}\}/g, '').trim();
			item.archive = source;
		}
		else if (infoParams.source) {
			item.archive = cleanWikitextLink(infoParams.source);
		}

		var attachMeta = getBookAttachmentMeta(filename);
		item.attachments.push({
			title: attachMeta.title,
			url: filePathUrl,
			mimeType: attachMeta.mimeType
		});
		item.attachments.push({
			title: 'Wikimedia Commons Snapshot',
			url: url,
			mimeType: 'text/html',
			snapshot: false
		});

		item.complete();
		if (typeof doneCallback === 'function') doneCallback();
	});
}

function detectWeb(doc, url) {
	// Diff interface is not supported
	if (new URLSearchParams(doc.location.search).get('diff')) {
		return false;
	}

	if (isBookPage(doc, url)) return 'book';
	if (isSearchResultsPage(doc, url)) return 'multiple';
	return FW.detectWeb(doc, url);
}

function doWeb(doc, url) {
	var itemType = detectWeb(doc, url);
	if (itemType === 'book') {
		scrapeBook(doc, url, function () { Zotero.done(); });
		Zotero.wait();
	}
	else if (itemType === 'multiple') {
		getSearchResults(url, function (items) {
			if (!items || Object.keys(items).length === 0) {
				Zotero.done();
				return;
			}
			Zotero.selectItems(items, function (selected) {
				if (!selected) {
					Zotero.done();
					return;
				}
				var urls = Object.keys(selected);
				var completed = 0;
				ZU.processDocuments(urls, function (newDoc, newUrl) {
					scrapeBook(newDoc, newUrl, function () {
						completed++;
						if (completed >= urls.length) Zotero.done();
					});
				});
			});
		});
		Zotero.wait();
	}
	else {
		return FW.doWeb(doc, url);
	}
}

/*
	***** BEGIN LICENSE BLOCK *****

	Wikimedia Commons Translator
	Copyright © 2012 Sebastian Karcher

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


/**Art Images*/
FW.Scraper({
	itemType : 'artwork',
	detect : FW.Xpath('//td[@id="fileinfotpl_art_title" or @id="fileinfotpl_desc"]'),
	title : FW.Xpath('//td[@id="fileinfotpl_art_title" or @id="fileinfotpl_desc"]/following-sibling::td').text().trim().remove(/\n.+/g),
	attachments : [{
  	url : FW.Url(),
  	title : "Wikimedia Snapshot",
  	type : "text/html"
	},
	{
		url : FW.Xpath('//div[@id="file"]/a/@href').text(),
		title : "Wikimedia Image"
	}],
	creators : FW.Xpath('//tr/td[@id="fileinfotpl_aut"]/following-sibling::td').text().remove(/\n/g).remove(/\(.+/).cleanAuthor("author"),
	artworkSize : FW.Xpath('//tr/td[@id="fileinfotpl_art_dimensions"]/following-sibling::td').text(),
	artworkMedium : FW.Xpath('//tr/td[@id="fileinfotpl_art_medium"]/following-sibling::td').text(),
	date : FW.Xpath('//tr/td[@id="fileinfotpl_date"]/following-sibling::td').text(),
	archive : FW.Xpath('//tr/td[@id="fileinfotpl_art_gallery"]/following-sibling::td').text().trim().remove(/\n.+/g),
	rights : FW.Xpath('//table[@class="licensetpl" or @class="layouttemplate licensetpl"]/tbody/tr/td[2]|//table[@class="licensetpl" or @class="layouttemplate licensetpl"]/tbody/tr/td/span').text(),

	hooks : {
		"scraperDone": function  (item,doc, url) {
			if (!item.archive) item.archive = ZU.xpathText(doc, '//tr/td[@id="fileinfotpl_src"]/following-sibling::td');
			item.date = item.date ? item.date : item.runningTime;
			item.runningTime = undefined;
			for (let i in item.creators) {
				if (!item.creators[i].firstName){
					item.creators[i].fieldMode=1;
				}
			}
			for (let i = 0; i < item.attachments.length; i++) {
				item.attachments[i].url = normalizeUrl(item.attachments[i].url);
			}
		}
	}
});

/**Photos*/
FW.Scraper({
	itemType : 'artwork',
	detect : FW.Xpath('//span[@class="description"]'),
	title : FW.Xpath('//span[@class="description"]').text().trim(),
	attachments : [{
  	url : FW.Url(),
  	title : "Wikimedia Snapshot",
  	type : "text/html"
	},
	{
		url : FW.Xpath('//div[@id="file"]/a/@href').text(),
		title : "Wikimedia Image"
	}],
	creators : FW.Xpath('//tr/td[@id="fileinfotpl_aut"]/following-sibling::td').text().remove(/\n/g).remove(/\(.+/).cleanAuthor("author"),
	date : FW.Xpath('//tr/td[@id="fileinfotpl_date"]/following-sibling::td').text(),
	archive : FW.Xpath('//tr/td[@id="fileinfotpl_src"]/following-sibling::td').text(),
	rights : FW.Xpath('//table[@class="licensetpl" or @class="layouttemplate licensetpl"]/tbody/tr/td[2]|//table[@class="licensetpl" or @class="layouttemplate licensetpl"]/tbody/tr/td/span').text(),
	//fix authors w/o first names to single field mode
	hooks : {
  	"scraperDone": function  (item,doc, url) {
			item.date = item.date ? item.date : item.runningTime;
			item.runningTime = undefined;
			for (let i in item.creators) {
				if (!item.creators[i].firstName){
					item.creators[i].fieldMode=1;
				}
			}
			for (let i = 0; i < item.attachments.length; i++) {
				item.attachments[i].url = normalizeUrl(item.attachments[i].url);
			}
		}
	}
});

/** Search results */
FW.MultiScraper({
	itemType : "multiple",
	detect : FW.Xpath('//ul[contains(@class, "search-results")]'),
	choices : {
		titles : FW.Xpath('//ul[contains(@class, "search-results")]//a[contains(@title, "File:")]').text(),
		urls : FW.Xpath('//ul[contains(@class, "search-results")]//a[contains(@title, "File:")]').key('href').text()
	}
});

/**Galleries */
FW.MultiScraper({
	itemType : "multiple",
	detect : FW.Xpath('//ul[contains(@class, "gallery")]'),
	choices : {
  	titles : FW.Xpath('//ul[contains(@class, "gallery")]//div[@class="gallerytext"]').text(),
  	urls : FW.Xpath('//ul[contains(@class, "gallery")]//a[@class="image"]').key('href').text()
	}
});
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://commons.wikimedia.org/wiki/File:Boy_with_a_Basket_of_Fruit-Caravaggio_(1593).jpg",
		"items": [
			{
				"itemType": "artwork",
				"title": "English: Boy with a Basket of Fruit",
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
				"artworkMedium": "oil on canvas",
				"artworkSize": "70 × 67 cm",
				"libraryCatalog": "Wikimedia Commons",
				"rights": "Public domain",
				"shortTitle": "English",
				"url": "https://commons.wikimedia.org/wiki/File:Boy_with_a_Basket_of_Fruit-Caravaggio_(1593).jpg",
				"attachments": [
					{
						"title": "Wikimedia Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Wikimedia Image"
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
		"url": "http://commons.wikimedia.org/w/index.php?search=peron&button=&title=Special%3ASearch&limit=100",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://commons.wikimedia.org/wiki/File:Portrait_of_Ambroise_Vollard.jpg",
		"items": [
			{
				"itemType": "artwork",
				"title": "English: Portrait of Ambroise Vollard",
				"creators": [
					{
						"firstName": "Paul",
						"lastName": "Cézanne",
						"creatorType": "author"
					}
				],
				"date": "1899",
				"archive": "Petit Palais, Paris",
				"artworkMedium": "oil on canvas",
				"artworkSize": "101 × 81 cm (39.8 × 31.9 in)",
				"libraryCatalog": "Wikimedia Commons",
				"rights": "Public domain",
				"shortTitle": "English",
				"url": "https://commons.wikimedia.org/wiki/File:Portrait_of_Ambroise_Vollard.jpg",
				"attachments": [
					{
						"title": "Wikimedia Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Wikimedia Image"
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
				"title": "English: Congressional Plaza, Buenos Aires, Argentina.",
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
				"shortTitle": "English",
				"url": "https://commons.wikimedia.org/wiki/File:Plaza_Congreso.JPG",
				"attachments": [
					{
						"title": "Wikimedia Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Wikimedia Image"
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
		"url": "https://commons.wikimedia.org/wiki/File:NCL-9910006496_%E6%80%A7%E5%BF%83%E7%90%86%E5%AD%B8.pdf",
		"items": "book"
	},
	{
		"type": "web",
		"url": "https://commons.wikimedia.org/w/index.php?search=%E5%BF%83%E7%90%86%E5%AD%B8+pdf&title=Special%3ASearch&profile=advanced&fulltext=1&ns0=1&ns6=1&ns12=1&ns14=1&ns100=1&ns106=1",
		"items": "multiple"
	}
]
/** END TEST CASES **/
