{
	"translatorID": "b9b97a32-a8aa-4688-bd81-491bec21b1de",
	"label": "CNKI Scholar",
	"creator": "jiaojiaodubai",
	"target": "^https?://scholar\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 150,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-02-06 14:09:43"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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

const typeMap = {
	journal: 'journalArticle',
	book: 'book',
	bookchapter: 'bookSection',
	conference: 'conferencePaper',
	edt: 'thesis'
};

function detectWeb(doc, _url) {
	const typeKey = text(doc, '#journal-summarize > span:first-of-type');
	if (typeMap[typeKey.toLowerCase()] == 'book') {
		return doc.querySelector('#doc-chapters')
			? 'multiple'
			: 'book';
	}
	else if (typeKey) {
		return typeMap[typeKey.toLowerCase()];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('.argicle-title > a, #doc-chapters .name > span > a');
	for (const row of rows) {
		const href = row.href;
		const title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Zotero.selectItems(getSearchResults(doc, false));
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
	try {
		// throw new Error('debug');
		await scrapeSearch(doc);
	}
	catch (error) {
		Z.debug(`failed to use search translator.`);
		Z.debug(error);
		await scrapeDoc(doc, url);
	}
}

const selectors = {
	labels: '[id*="doc-about"] .infoBox-item, div[class*="detail_doc-item__"]',
	title: '#doc-title',
	abstractNote: '#doc-summary-content-text',
	publicationTitle: '[class*="detail_journal_name"]',
	pubInfo: '[class*="detail_issue-year-page"]',
	publisher: '[class*="detail_journal_name"], .all-source a',
	DOI: '[class*="detail_doc-doi"] > a',
	creators: '[class*="detail_doc-author"] [class*="detail_text"] > a',
	tags: '[id*="doc-keyword"] a',
	hightlights: '#doc-hightlights-text > .value',
	bookUrl: '[class*="detail_journal_name"] > a'
};

async function scrapeSearch(doc) {
	const labels = new Labels(doc, exports.selectors.labels);
	Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	const doi = text(doc, exports.selectors.DOI) || labels.get('DOI');
	const isbn = labels.get('ISBN');
	if (!doi && !isbn) throw new Error('no identifier available');
	const translator = Zotero.loadTranslator('search');
	translator.setSearch({ ISBN: isbn, DOI: doi });
	translator.setHandler('translators', (_, translators) => {
		translator.setTranslator(translators);
	});
	translator.setHandler('itemDone', (_, item) => {
		let title = doc.querySelector(exports.selectors.title).cloneNode(true);
		if (title.querySelector(':not(sup):not(sub)')) {
			title.removeChild(title.querySelector(':not(sup):not(sub)'));
		}
		item.title = ZU.trimInternal(title.innerHTML);
		if (['journalArticle', 'thesis'].includes(item.itemType)) {
			item.abstractNote = item.abstractNote || text(doc, exports.selectors.abstractNote);
			item.date = ZU.strToISO(item.date);
			if (/^en/i.test(item.language)) {
				item.language = 'en-US';
			}
			if (!item.tags.length) {
				doc.querySelectorAll(exports.selectors.tags)
					.forEach(element => item.tags.push(ZU.trimInternal(element.textContent).replace(/;$/, '')));
			}
			const hightlights = text(doc, exports.selectors.hightlights);
			if (hightlights) {
				item.notes.push('<h1>Highlights / 研究要点</h1>\n' + hightlights);
			}
		}
		item.complete();
	});
	translator.setHandler('error', () => { });
	await translator.getTranslators();
	await translator.translate();
}

async function scrapeDoc(doc, url = doc.location.href) {
	const labels = new Labels(doc, exports.selectors.labels);
	Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	const extra = new Extra();
	const newItem = new Z.Item(typeMap[exports.typeKey.toLowerCase()] || detectWeb(doc, url));
	const title = doc.querySelector(exports.selectors.title).cloneNode(true);
	if (title.querySelector(':not(sup):not(sub)')) {
		title.removeChild(title.querySelector(':not(sup):not(sub)'));
	}
	newItem.title = ZU.trimInternal(title.innerHTML);
	const doi = text(doc, exports.selectors.DOI) || labels.get('DOI');
	if (ZU.fieldIsValidForType('DOI', newItem.itemType)) {
		newItem.DOI = doi;
	}
	else {
		extra.set('DOI', doi, true);
	}
	newItem.url = url;
	if (/^en|英语/i.test(labels.get(['语种', 'Language']))) {
		newItem.language = 'en-US';
	}
	doc.querySelectorAll(exports.selectors.creators).forEach((element) => {
		element = ZU.trimInternal(element.textContent).replace(/\s*;$/, '');
		newItem.creators.push(ZU.cleanAuthor(element, 'author'));
	});
	if (['journalArticle', 'thesis', 'conferencePaper'].includes(newItem.itemType)) {
		newItem.abstractNote = text(doc, exports.selectors.abstractNote);
		doc.querySelectorAll(exports.selectors.tags).forEach((element) => {
			newItem.tags.push(ZU.trimInternal(element.textContent).replace(/;$/, ''));
		});
		const hightlights = text(doc, exports.selectors.hightlights);
		if (hightlights) {
			newItem.notes.push('<h1>Highlights / 研究要点</h1>\n' + hightlights);
		}
		switch (newItem.itemType) {
			case 'conferencePaper':
			case 'journalArticle': {
				const pubInfo = text(doc, exports.selectors.pubInfo);
				newItem.publicationTitle = text(doc, exports.selectors.publicationTitle) || labels.get('journals?$');
				newItem.volume = tryMatch(pubInfo, /Volume 0*([1-9]\d*)/, 1) || labels.get('volume');
				newItem.issue = tryMatch(pubInfo, /Issue 0*([1-9]\d*)/, 1) || labels.get('issue');
				newItem.pages = tryMatch(pubInfo, /PP ([\d+, ~-]*)/, 1) || labels.get('pages');
				newItem.date = tryMatch(pubInfo, /(?:\.\s)?(\d{4})(?:\.\s)?/, 1) || labels.get('year|date');
				break;
			}

			/* thesis is only available on scholar.cnki.net */
			case 'thesis': {
				const pubInfo = labels.get('学位授予');
				newItem.thesisType = {
					Doctor: 'Doctoral dissertation',
					Master: 'Master thesis'
				}[labels.get('学位类型')];
				newItem.university = tryMatch(pubInfo, /^[\w ]+/);
				newItem.place = tryMatch(pubInfo, /\(([\w, ]+)\)$/, 1);
				extra.set('major', labels.get('专业'));
				extra.set('subject', labels.get('学科主题'));
				newItem.creators.push(ZU.cleanAuthor(labels.get('作者'), 'author'));
				break;
			}
		}
		if (newItem.itemType == 'conferencePaper') {
			newItem.proceedingsTitle = newItem.publicationTitle;
			delete newItem.publicationTitle;
		}
	}
	else if (['book', 'bookSection'].includes(newItem.itemType)) {
		switch (newItem.itemType) {
			case 'book':
				newItem.creators = [];
				patchBook(newItem, extra, doc);
				newItem.numPages = labels.get('页数');
				break;

			/* book section is only available on scholar.cnki.net */
			case 'bookSection': {
				const pubInfo = text(doc, exports.selectors.pubInfo);
				newItem.pages = tryMatch(pubInfo, /Page ([\d+, ~-]*)/, 1);
				const bookDoc = await requestDocument(doc.querySelector(exports.selectors.bookUrl).href);
				const bookTitle = bookDoc.querySelector('#doc-title').cloneNode(true);
				if (bookTitle.querySelector(':not(sup):not(sub)')) {
					bookTitle.removeChild(bookTitle.querySelector(':not(sup):not(sub)'));
				}
				newItem.bookTitle = ZU.trimInternal(bookTitle.innerHTML);
				patchBook(newItem, extra, bookDoc);
				break;
			}
		}
	}
	newItem.extra = extra.toString();
	newItem.complete();
}

function patchBook(bookItem, extra, doc) {
	const labels = new Labels(doc, '[id*="doc-about"] .infoBox-item');
	Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	bookItem.abstractNote = labels.get(['摘要', 'Abstract']);
	bookItem.series = labels.get('书系');
	bookItem.publisher = text(doc, exports.selectors.publisher);
	const pubInfo = text(doc, exports.selectors.pubInfo);
	bookItem.date = tryMatch(pubInfo, /(?:\.\s)?(\d{4})(?:\.\s)?/, 1);
	bookItem.ISBN = labels.get('ISBN');
	extra.set('subject', labels.get('学科分类'));
	extra.set('CLC', labels.get(['中图分类号', 'CLC']));
	doc.querySelectorAll(exports.selectors.creators).forEach((element) => {
		element = ZU.trimInternal(element.textContent).replace(/\s*;$/, '');
		bookItem.creators.push(ZU.cleanAuthor(element, 'author'));
	});
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		const nodes = doc.querySelectorAll(selector);
		for (const node of nodes) {
			// avoid nesting
			// avoid empty
			if (node.querySelector(selector) || !/\S/.test(node.textContent)) continue;
			const elmCopy = node.cloneNode(true);
			// avoid empty text
			while (![1, 3, 4].includes(elmCopy.firstChild.nodeType) || !/\S/.test(elmCopy.firstChild.textContent)) {
				elmCopy.removeChild(elmCopy.firstChild);
				if (!elmCopy.firstChild) break;
			}
			if (elmCopy.childNodes.length > 1) {
				const key = elmCopy.removeChild(elmCopy.firstChild).textContent.replace(/\s/g, '');
				this.data.push([key, elmCopy]);
			}
			else {
				const text = ZU.trimInternal(elmCopy.textContent);
				const key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
				elmCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
				this.data.push([key, elmCopy]);
			}
		}
	}

	get(label, element = false) {
		if (Array.isArray(label)) {
			const results = label
				.map(aLabel => this.get(aLabel, element));
			const keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElm
					: '';
		}
		const pattern = new RegExp(label, 'i');
		const keyVal = this.data.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElm
				: '';
	}
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

class Extra {
	constructor() {
		this.fields = [];
	}

	push(key, val, csl = false) {
		this.fields.push({ key: key, val: val, csl: csl });
	}

	set(key, val, csl = false) {
		const target = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		if (target) {
			target.val = val;
		}
		else {
			this.push(key, val, csl);
		}
	}

	get(key) {
		const result = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		return result
			? result.val
			: undefined;
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

var exports = {
	scrape: scrape,
	typeKey: '',
	selectors: selectors
};

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://scholar.cnki.net/zn/Detail/index/GARJ2020/SJES0EA6B92133A57310F3B6CB2E55B25F81",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Climate Change and Edaphic Specialists: Irresistible Force Meets Immovable Object?",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "Richard T.",
						"lastName": "Corlett"
					},
					{
						"creatorType": "author",
						"firstName": "Kyle W.",
						"lastName": "Tomlinson"
					}
				],
				"date": "2020-04",
				"DOI": "10.1016/j.tree.2019.12.007",
				"ISSN": "01695347",
				"abstractNote": "Species exposed to anthropogenic climate change can acclimate, adapt, move, or be extirpated. It is often assumed that movement will be the dominant response, with populations tracking their climate envelopes in space, but the numerous species restricted to specialized substrates cannot easily move. In warmer regions of the world, such edaphic specialists appear to have accumulated in situ over millions of years, persisting despite climate change by local movements, plastic responses, and genetic adaptation. However, past climates were usually cooler than today and rates of warming slower, while edaphic islands are now exposed to multiple additional threats, including mining. Modeling studies that ignore edaphic constraints on climate change responses may therefore give misleading results for a significant proportion of all taxa.",
				"issue": "4",
				"journalAbbreviation": "Trends in Ecology & Evolution",
				"language": "en-US",
				"libraryCatalog": "DOI.org (Crossref)",
				"pages": "367-376",
				"publicationTitle": "Trends in Ecology & Evolution",
				"shortTitle": "Climate Change and Edaphic Specialists",
				"url": "https://linkinghub.elsevier.com/retrieve/pii/S0169534719303520",
				"volume": "35",
				"attachments": [],
				"tags": [
					{
						"tag": "Conservation biology"
					},
					{
						"tag": "Geology"
					},
					{
						"tag": "Refugia"
					},
					{
						"tag": "Soils"
					},
					{
						"tag": "Species distribution models"
					}
				],
				"notes": [
					"<h1>Highlights / 研究要点</h1>\nCurrent approaches to predicting responses to climate change often assume that species will move to track their climate envelopes, but edaphic specialists restricted to globally rare and fragmented substrates cannot easily do this.Some edaphically extreme habitats have acted as refugia during past periods of climate change, as a result of environmental heterogeneity and/or the stress-tolerant functional traits of their biotas, but past climates were usually cooler than today and rates of warming slower.Species distribution models used to predict climate change responses can include edaphic factors, but these are rarely mapped at a high enough spatial resolution. Using low-resolution edaphic data for predictions is likely to give misleading results.Many edaphic islands are now also threatened by other human impacts, including mining, nitrogen deposition, and invasive species."
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://scholar.cnki.net/zn/Detail/index/GARJ2020/SJES0EA6B92133A57310F3B6CB2E55B25F81",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Climate Change and Edaphic Specialists: Irresistible Force Meets Immovable Object?",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "Richard T.",
						"lastName": "Corlett"
					},
					{
						"creatorType": "author",
						"firstName": "Kyle W.",
						"lastName": "Tomlinson"
					}
				],
				"date": "2020-04",
				"DOI": "10.1016/j.tree.2019.12.007",
				"ISSN": "01695347",
				"abstractNote": "Species exposed to anthropogenic climate change can acclimate, adapt, move, or be extirpated. It is often assumed that movement will be the dominant response, with populations tracking their climate envelopes in space, but the numerous species restricted to specialized substrates cannot easily move. In warmer regions of the world, such edaphic specialists appear to have accumulated in situ over millions of years, persisting despite climate change by local movements, plastic responses, and genetic adaptation. However, past climates were usually cooler than today and rates of warming slower, while edaphic islands are now exposed to multiple additional threats, including mining. Modeling studies that ignore edaphic constraints on climate change responses may therefore give misleading results for a significant proportion of all taxa.",
				"issue": "4",
				"journalAbbreviation": "Trends in Ecology & Evolution",
				"language": "en-US",
				"libraryCatalog": "DOI.org (Crossref)",
				"pages": "367-376",
				"publicationTitle": "Trends in Ecology & Evolution",
				"shortTitle": "Climate Change and Edaphic Specialists",
				"url": "https://linkinghub.elsevier.com/retrieve/pii/S0169534719303520",
				"volume": "35",
				"attachments": [],
				"tags": [
					{
						"tag": "Conservation biology"
					},
					{
						"tag": "Geology"
					},
					{
						"tag": "Refugia"
					},
					{
						"tag": "Soils"
					},
					{
						"tag": "Species distribution models"
					}
				],
				"notes": [
					"<h1>Highlights / 研究要点</h1>\nCurrent approaches to predicting responses to climate change often assume that species will move to track their climate envelopes, but edaphic specialists restricted to globally rare and fragmented substrates cannot easily do this.Some edaphically extreme habitats have acted as refugia during past periods of climate change, as a result of environmental heterogeneity and/or the stress-tolerant functional traits of their biotas, but past climates were usually cooler than today and rates of warming slower.Species distribution models used to predict climate change responses can include edaphic factors, but these are rarely mapped at a high enough spatial resolution. Using low-resolution edaphic data for predictions is likely to give misleading results.Many edaphic islands are now also threatened by other human impacts, including mining, nitrogen deposition, and invasive species."
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://scholar.cnki.net/zn/Detail/index/GARBLAST/STBD74429B71BDFEE5C7EC72DB869CD0CC57",
		"items": [
			{
				"itemType": "book",
				"title": "Building the Critical Anthropology of Climate Change:Towards a Socio-Ecological Revolution",
				"creators": [
					{
						"firstName": "Hans A.",
						"lastName": "Baer",
						"creatorType": "author"
					},
					{
						"firstName": "Merrill",
						"lastName": "Singer",
						"creatorType": "author"
					}
				],
				"date": "2025",
				"ISBN": "9781032745770 9781032745763",
				"abstractNote": "\"This book applies a critical perspective to anthropogenic climate change and the global socio-ecological crisis. The book focuses on the critical anthropology of climate change by opening up a dialogue with the two main contending perspectives in the anthropology of climate change, namely the cultural ecological and the cultural interpretive perspectives. Guided by these, the authors take a firm stance on the types of changes that are needed to sustain life on earth as we know it. Within this framework, they explore issues of climate and social equity, the nature of the current era in earth's geohistory, the perspectives of the elite polluters driving climate change, and the regrettable contributions of anthropologists and other scholars to climate change. Engaging with perspectives from sociology, political science, and the geography of climate change, the book explores various approaches to thinking about and responding to the existential threat of an ever-warming climate. In doing so, it lays the foundation for a brave new sustainable world that is socially just, highly democratic, and climatically-safe for humans and other species. This book will be of interest to researchers and students studying environmental anthropology, climate change, human geography, sociology, and political science\"--",
				"callNumber": "QC903 .B145 2025",
				"libraryCatalog": "Library of Congress ISBN",
				"numPages": "284",
				"place": "London ; New York, NY",
				"publisher": "Routledge, Taylor & Francis Group",
				"series": "Routledge environmental anthropology",
				"shortTitle": "Building the Critical Anthropology of Climate Change",
				"attachments": [],
				"tags": [
					{
						"tag": "Climatic changes"
					},
					{
						"tag": "Effect of climate on"
					},
					{
						"tag": "Human beings"
					},
					{
						"tag": "Social aspects"
					}
				],
				"notes": [
					{
						"note": "Climate change, climate science, and anthropology -- Conflicting anthropological perspectives : cultural ecological/ecological anthropological, cultural interpretive, and critical anthropology perspectives of climate change -- Anthropocene, capitalocene, or whatever : rethinking our era of climate change production -- Social inequality and climate change -- Planetary health : a critical health anthropological perspective -- Toward a critical anthropology of climate refugees -- Can ecological modernization contain climate change? How the rich and powerful seek to address the ecological crisis -- The scholarly elephant in the sky : how can anthropologists and other scholars grapple with their heavy reliance on flying in the era of ecocrisis -- Two genres of the climate movement : climate action vs climate justice -- Towards a critical anthropology of the future : climate change and future scenarios -- Eco-socialism as the ultimate climate change mitigation strategy"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://scholar.cnki.net/zn/Detail/index/GARBC_01/SBPMFD4D94EDA2B1FB86FD2E36BC5D0984F6",
		"items": [
			{
				"itemType": "bookSection",
				"title": "4. Thinking the Unthinkable",
				"creators": [
					{
						"firstName": "",
						"lastName": "LydiaDotto",
						"creatorType": "author"
					}
				],
				"date": "2006",
				"ISBN": "9780889209688",
				"bookTitle": "Thinking the Unthinkable:Civilization and Rapid Climate Change",
				"extra": "CLC: J42",
				"libraryCatalog": "CNKI Scholar",
				"pages": "55-64",
				"publisher": "Wilfrid Laurier University Press",
				"url": "https://scholar.cnki.net/zn/Detail/index/GARBC_01/SBPMFD4D94EDA2B1FB86FD2E36BC5D0984F6",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://scholar.cnki.net/zn/Detail/index/GARELAST/STAAF1F9B76994BC80440DB513678E873E69",
		"items": [
			{
				"itemType": "thesis",
				"title": "The European Union's climate change mitigation action : an ongoing transition?",
				"creators": [],
				"abstractNote": "This project develops a Lacanian framework for analysing the EU’s climate change mitigation policymaking in a period that corresponds to the finalisation of the 2030 Clean energy package and the launch of the 2050 long-term decarbonization strategy. It empirically follows the work of the EU at its Brussels headquarters and at the level of the UNFCCC Conferences of the Parties between 2017 and 2018 and methodologically contributes to the poststructuralist strands of Global Environmental Politics in International Relations. This project aims to reflect on the nature of the EU’s current climate action and on the possibility of “change” in relation to scientifically informed climate warnings and recommendations on departing from the business as usual logic. The investigation is guided by the case studies of energy efficiency and renewables, and circular economy given their policy-relevance and given that these are considered desirable policy tools by the EU. It builds on Jacques Lacan’s theory of discourse which allows us to emphasise signification and its effects on the speaking subjects. This makes it possible to open a seemingly closed discourse and expose its inherent fractures through the speaking subjects by empirically exploring how energy efficiency, renewables and circular economy are spoken. It is demonstrated that energy efficiency, renewables and circular economy cannot be thought as a presupposition of sense that automatically delivers the desired and required emissions reductions. I argue that to understand the current EU’s climate action and any possibility of change, attention must be paid to the way in which any produced fractures are handled in signification by the subjects, as these can be either positively integrated into signification or can disrupt it and cause a change of paradigm. I conclude that except for a few potentially disruptive elements that leave room for a true rupture and possible change, the current EU’s climate mitigation action appears more as a fictitious change than as a real transition.",
				"extra": "subject: 理论经济学",
				"libraryCatalog": "CNKI Scholar",
				"shortTitle": "The European Union's climate change mitigation action",
				"thesisType": "Doctoral dissertation",
				"url": "https://scholar.cnki.net/zn/Detail/index/GARELAST/STAAF1F9B76994BC80440DB513678E873E69",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://scholar.cnki.net/zn/Detail/index/GARELAST/STAC996F5D363605965191098B0C2CF2EDEE",
		"items": [
			{
				"itemType": "thesis",
				"title": "Neuromolecular signatures of fish social interactions under normal and climate change conditions",
				"creators": [],
				"abstractNote": "Coral reef fish exhibit a large variety of behaviours crucial for fitness and survival. The cleaner wrasse Labroides dimidiatus displays cognitive abilities in its interaction with other species by providing services of ectoparasite cleaning. These features serve as a good model to understand the complex processes of social behaviour and how these interactions might be altered by changes in the marine environment due to ocean acidification (caused by elevated CO2) and warming (elevated temperature). In general, little is known about the functional molecular basis of cooperative behaviour between L. dimidiatus and its potential client fishes and how rapid environmental changes might affect it. Thus, here we investigate the molecular mechanisms responsible for the interaction behaviour using Acanthurus leucosternon as client. In addition, we exposed interacting fish species to three conditions representing predicted future climate change conditions (according to RCP8.0 2100) and compare with a control of present-day levels of temperature and CO2 :1) elevated levels of pCO2 (1000 μatm), 2) elevated temperature (32oC), and 3) a combined condition of elevated levels of CO2 and temperature. We dissected the fore-, mid-, and hindbrain regions of each fish to analyse specific differential gene expression, using transcriptomics, and we found that most of the variation and transcriptional response in both species was regulated in the hindbrain and forebrain regions. The interaction behaviour responses of L. dimidiatus during ambient environmental conditions involved immediate early gene alteration, dopaminergic and glutamatergic pathways, the expression of neurohormones (such as isotocin) and steroids (e.g. progesterone and estrogen), as well as social decision-making genes. In contrast, for the client, fewer molecular alterations were found, mostly involving pituitary hormone responses. However, the molecular signatures of L. dimidiatus were affected in all future climate change conditions with transcriptional changes observed in functions such as stress response (i.e. hypoxia, apoptosis, heat shock proteins), histone regulation, metabolism and the synapse. Key molecular processes, such as learning and memory activation in the cleaner wrasse and stress relief and reduced aggression in the client, were affected by the future climate change conditions. Genes involved in behaviour and memory were altered in expression under the elevated CO2 and temperature conditions, whereas the combined condition showed no expression changes related to behaviour, suggesting no additive effect on the cognitive abilities of L. dimidiatus with two simultaneous conditions. Hence, future environmental conditions influence the molecular programming involved in the mutualism maintenance for L. dimidiatus and its potential clients with possible large-scale effects on the coral reef ecosystems.",
				"extra": "major: Philosophy\nsubject: 环境",
				"language": "en-US",
				"libraryCatalog": "CNKI Scholar",
				"thesisType": "Master thesis",
				"url": "https://scholar.cnki.net/zn/Detail/index/GARELAST/STAC996F5D363605965191098B0C2CF2EDEE",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://scholar.cnki.net/zn/Detail/index/GARCLAST/SPAGB666445D4FB9CA39DFFDF6EA2B4F5958",
		"detectedItemType": "conferencePaper",
		"items": [
			{
				"itemType": "bookSection",
				"title": "Analysis of Existing Design Temperature for Heating in Sarajevo in Light of Climate Changes",
				"creators": [
					{
						"creatorType": "editor",
						"firstName": "Branko",
						"lastName": "Katalinic"
					},
					{
						"creatorType": "author",
						"firstName": "Rejhana",
						"lastName": "Blazevic"
					},
					{
						"creatorType": "author",
						"firstName": "Armin",
						"lastName": "Teskeredzic"
					},
					{
						"creatorType": "author",
						"firstName": "Melisa",
						"lastName": "Zecevic"
					}
				],
				"date": "2023",
				"ISBN": "9783902734419",
				"bookTitle": "DAAAM Proceedings",
				"edition": "1",
				"extra": "DOI: 10.2507/34th.daaam.proceedings.027",
				"libraryCatalog": "DOI.org (Crossref)",
				"pages": "0209-0218",
				"publisher": "DAAAM International Vienna",
				"url": "http://www.daaam.info/Downloads/Pdfs/proceedings/proceedings_2023/027.pdf",
				"volume": "1",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
