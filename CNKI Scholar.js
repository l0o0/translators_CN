{
	"translatorID": "b9b97a32-a8aa-4688-bd81-491bec21b1de",
	"label": "CNKI Scholar",
	"creator": "jiaojiaodubai",
	"target": "^https?://(scholar\\.cnki\\.net|kns\\.cnki\\.net/kcms2?/article)",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 150,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-02-08 12:05:58"
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

var typeMap = {
	journal: 'journalArticle',
	book: 'book',
	bookchapter: 'bookSection',
	conference: 'conferencePaper',
	edt: 'thesis'
};

function detectWeb(doc, _url) {
	let typeKey = text(doc, '#journal-summarize > span:first-of-type, .top-tip-scholar > span:first-child');
	Z.debug(typeKey);
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
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.argicle-title > a, #doc-chapters .name > span > a');
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

async function scrape(doc, url = doc.location.href) {
	try {
		await scrapeSearch(doc);
	}
	catch (error) {
		Z.debug(`failed to use search translator.`);
		Z.debug(error);
		await scrapeDoc(doc, url);
	}
}

var selectors = {
	labels: '[id*="doc-about"] .infoBox-item, div[class*="detail_item__"]',
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
	let labels = new Labels(doc, exports.selectors.labels);
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	let doi = text(doc, exports.selectors.DOI) || labels.getWith('DOI');
	let isbn = labels.getWith('ISBN');
	Z.debug(`DOI: ${doi}`);
	Z.debug(`ISBN: ${isbn}`);
	// throw new Error('debug');
	if (!doi && !isbn) throw new ReferenceError('no identifier available');
	let translator = Zotero.loadTranslator('search');
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
			let hightlights = text(doc, exports.selectors.hightlights);
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
	let labels = new Labels(doc, exports.selectors.labels);
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	let doi = text(doc, exports.selectors.DOI) || labels.getWith('DOI');
	let isbn = labels.getWith('ISBN');
	Z.debug(`DOI: ${doi}`);
	Z.debug(`ISBN: ${isbn}`);
	var newItem = new Z.Item(detectWeb(doc, url));
	let title = doc.querySelector(exports.selectors.title).cloneNode(true);
	if (title.querySelector(':not(sup):not(sub)')) {
		title.removeChild(title.querySelector(':not(sup):not(sub)'));
	}
	newItem.title = ZU.trimInternal(title.innerHTML);
	newItem.DOI = doi;
	newItem.url = url;
	if (/^en|英语/i.test(labels.getWith(['语种', 'Language']))) {
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
		let hightlights = text(doc, exports.selectors.hightlights);
		if (hightlights) {
			newItem.notes.push('<h1>Highlights / 研究要点</h1>\n' + hightlights);
		}
		switch (newItem.itemType) {
			case 'conferencePaper':
			case 'journalArticle': {
				let pubInfo = text(doc, exports.selectors.pubInfo);
				newItem.publicationTitle = text(doc, exports.selectors.publicationTitle) || labels.getWith('journals?$');
				newItem.volume = tryMatch(pubInfo, /Volume 0*([1-9]\d*)/, 1) || labels.getWith('volume');
				newItem.issue = tryMatch(pubInfo, /Issue 0*([1-9]\d*)/, 1) || labels.getWith('issue');
				newItem.pages = tryMatch(pubInfo, /PP ([\d+, ~-]*)/, 1) || labels.getWith('pages');
				newItem.date = tryMatch(pubInfo, /(?:\.\s)?(\d{4})(?:\.\s)?/, 1) || labels.getWith('year|date');
				break;
			}

			/* thesis is only available on scholar.cnki.net */
			case 'thesis': {
				let pubInfo = labels.getWith('学位授予');
				newItem.thesisType = {
					Doctor: 'Doctoral dissertation',
					Master: 'Master thesis'
				}[labels.getWith('学位类型')];
				newItem.university = tryMatch(pubInfo, /^[\w ]+/);
				newItem.place = tryMatch(pubInfo, /\(([\w, ]+)\)$/, 1);
				extra.add('major', labels.getWith('专业'));
				extra.add('subject', labels.getWith('学科主题'));
				newItem.creators.push(ZU.cleanAuthor(labels.getWith('作者'), 'author'));
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
				patchBook(newItem, doc);
				newItem.numPages = labels.getWith('页数');
				break;

			/* book section is only available on scholar.cnki.net */
			case 'bookSection': {
				let pubInfo = text(doc, exports.selectors.pubInfo);
				newItem.pages = tryMatch(pubInfo, /Page ([\d+, ~-]*)/, 1);
				let bookDoc = await requestDocument(doc.querySelector(exports.selectors.book).href);
				let bookTitle = bookDoc.querySelector('#doc-title').cloneNode(true);
				if (bookTitle.querySelector(':not(sup):not(sub)')) {
					bookTitle.removeChild(bookTitle.querySelector(':not(sup):not(sub)'));
				}
				newItem.bookTitle = ZU.trimInternal(bookTitle.innerHTML);
				patchBook(newItem, bookDoc);
				break;
			}
		}
	}
	newItem.extra = extra.toString();
	newItem.complete();
}

function patchBook(bookItem, doc) {
	let labels = new Labels(doc, '[id*="doc-about"] .infoBox-item');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	bookItem.abstractNote = labels.getWith(['摘要', 'Abstract']);
	bookItem.series = labels.getWith('书系');
	bookItem.publisher = text(doc, exports.selectors.publisher);
	let pubInfo = text(doc, exports.selectors.pubInfo);
	bookItem.date = tryMatch(pubInfo, /(?:\.\s)?(\d{4})(?:\.\s)?/, 1);
	bookItem.ISBN = labels.getWith('ISBN');
	extra.add('subject', labels.getWith('学科分类'));
	extra.add('CLC', labels.getWith(['中图分类号', 'CLC']));
	doc.querySelectorAll(exports.selectors.creators).forEach((element) => {
		element = ZU.trimInternal(element.textContent).replace(/\s*;$/, '');
		bookItem.creators.push(ZU.cleanAuthor(element, 'author'));
	});
}

class Labels {
	constructor(doc, selector) {
		this.innerData = [];
		Array.from(doc.querySelectorAll(selector))
			.filter(element => element.firstElementChild)
			.filter(element => !element.querySelector(selector))
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				let key = elementCopy.removeChild(elementCopy.firstElementChild).innerText.replace(/\s/g, '');
				this.innerData.push([key, elementCopy]);
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.getWith(aLabel, element));
			result = element
				? result.find(element => element.childNodes.length)
				: result.find(element => element);
			return result
				? result
				: element
					? document.createElement('div')
					: '';
		}
		let pattern = new RegExp(label, 'i');
		let keyValPair = this.innerData.find(element => pattern.test(element[0]));
		if (element) return keyValPair ? keyValPair[1] : document.createElement('div');
		return keyValPair
			? ZU.trimInternal(keyValPair[1].innerText)
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

const extra = {
	clsFields: [],
	elseFields: [],
	add: function (key, value, cls = false) {
		if (value && cls) {
			this.clsFields.push([key, value]);
		}
		else if (value) {
			this.elseFields.push([key, value]);
		}
	},
	toString: function () {
		return [...this.clsFields, ...this.elseFields]
			.map(entry => `${entry[0]}: ${entry[1]}`)
			.join('\n');
	}
};

var exports = {
	scrape: scrape,
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
						"firstName": "Richard T.",
						"lastName": "Corlett",
						"creatorType": "author"
					},
					{
						"firstName": "Kyle W.",
						"lastName": "Tomlinson",
						"creatorType": "author"
					}
				],
				"date": "2020",
				"DOI": "10.1016/j.tree.2019.12.007",
				"abstractNote": "Species exposed to anthropogenic climate change can acclimate, adapt, move, or be extirpated. It is often assumed that movement will be the dominant response, with populations tracking their climate envelopes in space, but the numerous species restricted to specialized substrates cannot easily move. In warmer regions of the world, such edaphic specialists appear to have accumulated in situ over millions of years, persisting despite climate change by local movements, plastic responses, and genetic adaptation. However, past climates were usually cooler than today and rates of warming slower, while edaphic islands are now exposed to multiple additional threats, including mining. Modeling studies that ignore edaphic constraints on climate change responses may therefore give misleading results for a significant proportion of all taxa.",
				"issue": "4",
				"libraryCatalog": "CNKI Scholar",
				"pages": "367-376",
				"publicationTitle": "Trends in Ecology & Evolution",
				"shortTitle": "Climate Change and Edaphic Specialists",
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
				"date": "2024",
				"ISBN": "9781003469940",
				"extra": "subject: 美术\nCLC: TU-8",
				"language": "en-US",
				"libraryCatalog": "CNKI Scholar",
				"numPages": "288",
				"publisher": "Taylor and Francis",
				"series": "Routledge Environmental Anthropology",
				"shortTitle": "Building the Critical Anthropology of Climate Change",
				"url": "https://scholar.cnki.net/zn/Detail/index/GARBLAST/STBD74429B71BDFEE5C7EC72DB869CD0CC57",
				"attachments": [],
				"tags": [],
				"notes": [],
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
				"bookTitle": "[object HTMLDivElement]",
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
				"creators": [
					{
						"firstName": "Tolis",
						"lastName": "Valeria",
						"creatorType": "author"
					}
				],
				"abstractNote": "This project develops a Lacanian framework for analysing the EU’s climate change mitigation policymaking in a period that corresponds to the finalisation of the 2030 Clean energy package and the launch of the 2050 long-term decarbonization strategy. It empirically follows the work of the EU at its Brussels headquarters and at the level of the UNFCCC Conferences of the Parties between 2017 and 2018 and methodologically contributes to the poststructuralist strands of Global Environmental Politics in International Relations. This project aims to reflect on the nature of the EU’s current climate action and on the possibility of “change” in relation to scientifically informed climate warnings and recommendations on departing from the business as usual logic. The investigation is guided by the case studies of energy efficiency and renewables, and circular economy given their policy-relevance and given that these are considered desirable policy tools by the EU. It builds on Jacques Lacan’s theory of discourse which allows us to emphasise signification and its effects on the speaking subjects. This makes it possible to open a seemingly closed discourse and expose its inherent fractures through the speaking subjects by empirically exploring how energy efficiency, renewables and circular economy are spoken. It is demonstrated that energy efficiency, renewables and circular economy cannot be thought as a presupposition of sense that automatically delivers the desired and required emissions reductions. I argue that to understand the current EU’s climate action and any possibility of change, attention must be paid to the way in which any produced fractures are handled in signification by the subjects, as these can be either positively integrated into signification or can disrupt it and cause a change of paradigm. I conclude that except for a few potentially disruptive elements that leave room for a true rupture and possible change, the current EU’s climate mitigation action appears more as a fictitious change than as a real transition.",
				"extra": "subject: 理论经济学",
				"libraryCatalog": "CNKI Scholar",
				"shortTitle": "The European Union's climate change mitigation action",
				"thesisType": "Doctoral dissertation",
				"university": "Cardiff University",
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
				"creators": [
					{
						"firstName": "Ramirez Calero Sandra",
						"lastName": "Patricia",
						"creatorType": "author"
					}
				],
				"abstractNote": "Coral reef fish exhibit a large variety of behaviours crucial for fitness and survival. The cleaner wrasse Labroides dimidiatus displays cognitive abilities in its interaction with other species by providing services of ectoparasite cleaning. These features serve as a good model to understand the complex processes of social behaviour and how these interactions might be altered by changes in the marine environment due to ocean acidification (caused by elevated CO2) and warming (elevated temperature). In general, little is known about the functional molecular basis of cooperative behaviour between L. dimidiatus and its potential client fishes and how rapid environmental changes might affect it. Thus, here we investigate the molecular mechanisms responsible for the interaction behaviour using Acanthurus leucosternon as client. In addition, we exposed interacting fish species to three conditions representing predicted future climate change conditions (according to RCP8.0 2100) and compare with a control of present-day levels of temperature and CO2 :1) elevated levels of pCO2 (1000 μatm), 2) elevated temperature (32oC), and 3) a combined condition of elevated levels of CO2 and temperature. We dissected the fore-, mid-, and hindbrain regions of each fish to analyse specific differential gene expression, using transcriptomics, and we found that most of the variation and transcriptional response in both species was regulated in the hindbrain and forebrain regions. The interaction behaviour responses of L. dimidiatus during ambient environmental conditions involved immediate early gene alteration, dopaminergic and glutamatergic pathways, the expression of neurohormones (such as isotocin) and steroids (e.g. progesterone and estrogen), as well as social decision-making genes. In contrast, for the client, fewer molecular alterations were found, mostly involving pituitary hormone responses. However, the molecular signatures of L. dimidiatus were affected in all future climate change conditions with transcriptional changes observed in functions such as stress response (i.e. hypoxia, apoptosis, heat shock proteins), histone regulation, metabolism and the synapse. Key molecular processes, such as learning and memory activation in the cleaner wrasse and stress relief and reduced aggression in the client, were affected by the future climate change conditions. Genes involved in behaviour and memory were altered in expression under the elevated CO2 and temperature conditions, whereas the combined condition showed no expression changes related to behaviour, suggesting no additive effect on the cognitive abilities of L. dimidiatus with two simultaneous conditions. Hence, future environmental conditions influence the molecular programming involved in the mutualism maintenance for L. dimidiatus and its potential clients with possible large-scale effects on the coral reef ecosystems.C",
				"extra": "major: Philosophy\nsubject: 环境",
				"language": "en-US",
				"libraryCatalog": "CNKI Scholar",
				"place": "Pokfulam, Hong Kong",
				"thesisType": "Master thesis",
				"university": "The University of Hong Kong",
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
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "Analysis of Existing Design Temperature for Heating in Sarajevo in Light of Climate Changes",
				"creators": [
					{
						"firstName": "Blazevic",
						"lastName": "Rejhana",
						"creatorType": "author"
					},
					{
						"firstName": "Teskeredzic",
						"lastName": "Armin",
						"creatorType": "author"
					},
					{
						"firstName": "Zecevic",
						"lastName": "Melisa",
						"creatorType": "author"
					}
				],
				"date": "2023",
				"DOI": "10.2507/34TH.DAAAM.PROCEEDINGS.027",
				"abstractNote": "Designers of heating systems and planners of the district heating consider large number of variables that influence the final proposal of the system which will meet the heating needs. Size of the system and investment costs depends on different parameters but are mostly influenced by the outside design temperature. Engineers are aware of the climate change influence but during design process they need either legal or scientific proof that they can use new/updated values of the design temperatures at the specific location. In this paper, an analysis of hourly air temperature values for the city of Sarajevo, Bosnia and Herzegovina (B&H) was conducted in the latest available 20 years dataset. Data on the outside air temperature were obtained by the Federal Hydrometeorological Institute of Bosnia and Herzegovina. Five different methods were briefly explained and used for determination of the new design temperature for Sarajevo based on the period 2001–2020. Results of the analysis demonstrate that the currently valid and official outside design temperature was low and needs to be revised. As a small-scale example, calculation of the heating needs of one residential unit was made in order to demonstrate the influence of different design outside temperature on the heating needs. These numbers were then extrapolated on the district heating system and the benefits of the proposed approach were underlined. Performed analysis suggest an urgent change in the design temperature for all cities in Bosnia and Herzegovina as it was demonstrated on the example of Sarajevo in this paper.",
				"libraryCatalog": "CNKI Scholar",
				"pages": "0209-0218",
				"proceedingsTitle": "34th DAAAM International Symposium on Intelligent Manufacturing and Automation",
				"url": "https://scholar.cnki.net/zn/Detail/index/GARCLAST/SPAGB666445D4FB9CA39DFFDF6EA2B4F5958",
				"volume": "34",
				"attachments": [],
				"tags": [
					{
						"tag": "Climate Change"
					},
					{
						"tag": "Heat Load"
					},
					{
						"tag": "Heating System"
					},
					{
						"tag": "Outside Desgin Temperature"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=phUvsea1i7YNS5znM1G66x3jDJpx3L1zcm6u9YthZbUuBFoxPotxkL56i7W1yfe0GoocNQkff_ksvrgOiypVY0vfWhsTm-7iAkVlpCzcDro0hBUuXajM1Snj4R10pMhHNxDTyQVdV9Z2DmNHQARAOYrNAlw18XlPLU3VAWMRKMKswIf3yAQryw==&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "book",
				"title": "IMF Terminology Bulletin: Climate & the Environment, Fintech, Gender, and Related Acronyms: English to Arabic",
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
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=phUvsea1i7b0LBhQwIVxbNbzKBRWIJp8hSX7PW0Uh_sDA_1ULXt8qcyRECdNOTy3NcitPSkXnaQcN051Rb7NtmChDNB1pmvOBleSaIJ3VDSIkWqqqpOALLL5qZSSMkpkTokstP4K9tRA1TywWgO-2OW4Tod3_pUcHuq24TOLnp8x5uPR3hlvGA==&uniplatform=NZKPT&language=CHS",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Long-term analysis of microseism during extreme weather events: Medicanes and common storms in the Mediterranean Sea",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "Alfio Marco",
						"lastName": "Borzì"
					},
					{
						"creatorType": "author",
						"firstName": "Vittorio",
						"lastName": "Minio"
					},
					{
						"creatorType": "author",
						"firstName": "Raphael",
						"lastName": "De Plaen"
					},
					{
						"creatorType": "author",
						"firstName": "Thomas",
						"lastName": "Lecocq"
					},
					{
						"creatorType": "author",
						"firstName": "Flavio",
						"lastName": "Cannavò"
					},
					{
						"creatorType": "author",
						"firstName": "Giuseppe",
						"lastName": "Ciraolo"
					},
					{
						"creatorType": "author",
						"firstName": "Sebastiano",
						"lastName": "D'Amico"
					},
					{
						"creatorType": "author",
						"firstName": "Carlo Lo",
						"lastName": "Re"
					},
					{
						"creatorType": "author",
						"firstName": "Carmelo",
						"lastName": "Monaco"
					},
					{
						"creatorType": "author",
						"firstName": "Marco",
						"lastName": "Picone"
					},
					{
						"creatorType": "author",
						"firstName": "Giovanni",
						"lastName": "Scardino"
					},
					{
						"creatorType": "author",
						"firstName": "Giovanni",
						"lastName": "Scicchitano"
					},
					{
						"creatorType": "author",
						"firstName": "Andrea",
						"lastName": "Cannata"
					}
				],
				"date": "2024-03",
				"DOI": "10.1016/j.scitotenv.2024.169989",
				"ISSN": "00489697",
				"abstractNote": "本文从地震角度分析了2011年11月至2021年11月期间发生在地中海的12次气象事件。特别地,我们考虑了8个Medicanes和4个更常见的风暴。这些事件虽然有明显差异,但都造成了强降水、强阵风和强风暴潮,其有效波高通常> 3 ? m。我们利用两种不同的方法(基于幅度衰减的网格搜索和阵列技术)从频谱含量、振幅的时空变化和震源位置等方面处理了这些气象事件与微震(是地球上最连续、最广泛的地震信号)特征之间的关系。通过将微震震源位置与风暴潮显著区域进行对比,我们观察到在(两位医生在气象参数方面表现出很低的强度,微震振幅在这两次事件中没有表现出显著的变化)分析的12个事件中,有10个事件的微震位置与风暴潮的实际位置一致。我们还进行了两次分析,通过使用一种利用连续地震噪声相干性的方法来获得这些事件的地震特征,并从地震角度获得它们的强度,称为\"微震降低幅度\"。此外,通过整合这两种方法得到的结果,我们能够\"地震地\"区分Medicanes和普通风暴。因此,我们展示了通过将微震信息与其他常用的研究气象现象的技术结合起来,为地中海气象事件建立一个新的监测系统的可能性。将微震与海况监测(例如,波浪浮...",
				"journalAbbreviation": "Science of The Total Environment",
				"language": "en-US",
				"libraryCatalog": "DOI.org (Crossref)",
				"pages": "169989",
				"publicationTitle": "Science of The Total Environment",
				"shortTitle": "Long-term analysis of microseism during extreme weather events",
				"url": "https://linkinghub.elsevier.com/retrieve/pii/S0048969724001232",
				"volume": "915",
				"attachments": [],
				"tags": [
					{
						"tag": "Climate change"
					},
					{
						"tag": "Common storms"
					},
					{
						"tag": "Hindcast maps"
					},
					{
						"tag": "Medicanes"
					},
					{
						"tag": "Mediterranean Sea"
					},
					{
						"tag": "Microseism"
					},
					{
						"tag": "Monitoring sea state"
					},
					{
						"tag": "Wave buoys"
					}
				],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
