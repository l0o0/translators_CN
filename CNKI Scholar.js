{
	"translatorID": "b9b97a32-a8aa-4688-bd81-491bec21b1de",
	"label": "CNKI Scholar",
	"creator": "jiaojiaodubai",
	"target": "^https?://scholar\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-02-02 14:59:51"
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
	Journal: 'journalArticle',
	book: 'book',
	BookChapter: 'bookSection',
	Conference: 'conferencePaper',
	EDT: 'thesis'
};

function detectWeb(doc, _url) {
	let typeKey = text(doc, '#journal-summarize > span:first-of-type');
	if (typeMap[typeKey] == 'book') {
		return doc.querySelector('#doc-chapters')
			? 'multiple'
			: 'book';
	}
	else if (typeKey) {
		return typeMap[typeKey];
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
		Z.debug('done');
	}
}

async function scrape(doc, url = doc.location.href) {
	try {
		await scrapeSearch(doc);
	}
	catch (error) {
		Z.debug(error);
		Z.debug(`failed to use search translator.`);
		await scrapeDoc(doc, url);
	}
}

async function scrapeSearch(doc) {
	let labels = new Labels(doc, '[id*="doc-about"] .infoBox-item, div[class*="detail_item__"]');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	let doi = text(doc, '[class^="detail_doc-doi"] > a');
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
		if (['journalArticle', 'thesis'].includes(item.itemType)) {
			item.abstractNote = text(doc, '#doc-summary-content-text');
			item.date = ZU.strToISO(item.date);
			if (/^en/i.test(item.language)) {
				item.language = 'en-US';
			}
			if (!item.tags.length) {
				doc.querySelectorAll('#doc-keyword-text a')
					.forEach(element => item.tags.push(ZU.trimInternal(element.textContent).replace(/;$/, '')));
			}
			item.notes.push('<h1>Highlights / 研究要点</h1>\n' + text(doc, '#doc-hightlights-text > .value'));
		}
		item.complete();
	});
	translator.setHandler('error', () => { });
	await translator.getTranslators();
	await translator.translate();
}

async function scrapeDoc(doc, url = doc.location.href) {
	let labels = new Labels(doc, '[id*="doc-about"] .infoBox-item, div[class*="detail_item__"]');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	let doi = text(doc, '[class^="detail_doc-doi"] > a');
	let isbn = labels.getWith('ISBN');
	Z.debug(`DOI: ${doi}`);
	Z.debug(`ISBN: ${isbn}`);
	var newItem = new Z.Item(detectWeb(doc, url));
	let title = doc.querySelector('#doc-title').cloneNode(true);
	let button = title.querySelector('#changeActive');
	if (button) {
		title.removeChild(button);
	}
	newItem.title = ZU.trimInternal(title.textContent);
	newItem.DOI = doi;
	newItem.url = url;
	if (/^en|英语/i.test(labels.getWith('语种'))) {
		newItem.language = 'en-US';
	}
	doc.querySelectorAll('[class^="detail_doc-author"] [class^="detail_text"] > a').forEach((element) => {
		element = ZU.trimInternal(element.textContent).replace(/\s*;$/, '');
		newItem.creators.push(ZU.cleanAuthor(element, 'author'));
	});
	if (['journalArticle', 'thesis', 'conferencePaper'].includes(newItem.itemType)) {
		newItem.abstractNote = text(doc, '#doc-summary-content-text');
		doc.querySelectorAll('#doc-keyword-text a').forEach((element) => {
			newItem.tags.push(ZU.trimInternal(element.textContent).replace(/;$/, ''));
		});
		let hightlights = text(doc, '#doc-hightlights-text > .value');
		if (hightlights) {
			newItem.notes.push('<h1>Highlights / 研究要点</h1>\n' + hightlights);
		}
		switch (newItem.itemType) {
			case 'conferencePaper':
			case 'journalArticle': {
				let pubInfo = text(doc, '[class^="detail_issue-year-page"]');
				newItem.publicationTitle = text(doc, '[class^="detail_journal_name"]');
				newItem.volume = tryMatch(pubInfo, /Volume 0*([1-9]\d*)/, 1);
				newItem.issue = tryMatch(pubInfo, /Issue 0*([1-9]\d*)/, 1);
				newItem.pages = tryMatch(pubInfo, /PP ([\d+, ~-]*)/, 1);
				newItem.date = tryMatch(pubInfo, /(?:\.\s)?(\d{4})(?:\.\s)?/, 1);
				break;
			}
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
				patchBook(newItem, doc);
				newItem.numPages = labels.getWith('页数');
				break;
			case 'bookSection': {
				let pubInfo = text(doc, '[class^="detail_issue-year-page"]');
				newItem.pages = tryMatch(pubInfo, /Page ([\d+, ~-]*)/, 1);
				let bookDoc = await requestDocument(doc.querySelector('[class^="detail_journal_name"] > a').href);
				let bookTitle = bookDoc.querySelector('#doc-title').cloneNode(true);
				let button = bookTitle.querySelector('#changeActive');
				if (button) {
					bookTitle.removeChild(button);
				}
				newItem.bookTitle = bookTitle;
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
	bookItem.abstractNote = labels.getWith('摘要');
	bookItem.series = labels.getWith('书系');
	bookItem.publisher = text(doc, '[class^="detail_journal_name"]');
	let pubInfo = text(doc, '[class^="detail_issue-year-page"]');
	bookItem.date = tryMatch(pubInfo, /(?:\.\s)?(\d{4})(?:\.\s)?/, 1);
	bookItem.ISBN = labels.getWith('ISBN');
	extra.add('subject', labels.getWith('学科分类'));
	extra.add('CLC', labels.getWith('中图分类号'));
	doc.querySelectorAll('[class^="detail_doc-author"] [class^="detail_text"] > a').forEach((element) => {
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
		let pattern = new RegExp(label);
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
					},
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
	}
]
/** END TEST CASES **/
