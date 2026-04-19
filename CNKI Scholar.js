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
	"lastUpdated": "2026-03-16 09:04:18"
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

const typeMap = {
	journal: 'journalArticle',
	book: 'book',
	bookchapter: 'bookSection',
	conference: 'conferencePaper',
	edt: 'thesis'
};

function detectWeb(doc, _url) {
	const typeKey = innerText(doc, '#journal-summarize > :first-child');
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
	// TODO: adjust the CSS selector
	var rows = doc.querySelectorAll('h2 > a.title[href*="/article/"]');
	for (let row of rows) {
		// TODO: check and maybe adjust
		let href = row.href;
		// TODO: check and maybe adjust
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
	const json = JSON.parse(text(doc, '#__NEXT_DATA__'));
	const data = json.props.pageProps.detailInfo.data.articleBaseInfo;
	try {
		// When debugging, uncomment the following line to jump to `catch` block
		// throw new Error('debug');
		if (data.articleDataType === 'Bchapter') {
			throw new Error('Skip searching for book section');
		}
		await scrapeSearch({ DOI: data.articleDoi, ISBN: data.isbn });
	}
	catch (e) {
		Z.debug('Failed to use search translator, falling back to page scraping');
		Z.debug(e);
		const newItem = new Z.Item(detectWeb(doc, url));
		newItem.title = data.articleTitle;
		newItem.abstractNote = data.articleSummary;
		const doi = data.articleDoi;
		if (doi) {
			newItem.DOI = doi;
			newItem.url = `https://dx.doi.org/${doi}`;
		}
		else {
			newItem.url = url;
		}
		newItem.language = {
			Chinese: 'zh-CN',
			English: 'en-US',
		}[data.articleLanguage] ?? 'en-US';
		switch (newItem.itemType) {
			case 'journalArticle':
				newItem.publicationTitle = data.journal;
				newItem.date = data.articlePubDate ?? data.year;
				newItem.volume = data.volume;
				newItem.issue = data.issue;
				newItem.pages = data.pages;
				newItem.ISSN = data.issn;
				break;
			case 'book':
				newItem.series = data.series;
				newItem.date = data.articlePubDate ?? data.year;
				newItem.publisher = data.publisher;
				newItem.place = data.pubArea;
				newItem.numPages = data.pageCount;
				newItem.ISBN = data.isbn;
				break;
			case 'bookSection': {
				newItem.bookTitle = data.bookName;
				newItem.series = data.series;
				newItem.date = data.articlePubDate ?? data.year;
				newItem.publisher = data.publisher;
				newItem.place = data.pubArea;
				newItem.pages = data.pages;
				newItem.ISBN = data.isbn;
				const bookUrl = attr(doc, '[class^="detail_journal_name"] > a', 'href');
				if (bookUrl) {
					const bookDoc = await requestDocument(bookUrl);
					const bookJson = JSON.parse(text(bookDoc, '#__NEXT_DATA__'));
					const bookData = bookJson.props.pageProps.detailInfo.data.articleBaseInfo;
					try {
						await scrapeSearch(
							{ DOI: bookData.articleDoi, ISBN: bookData.isbn },
							(item) => {
								item.creators.forEach((creator) => {
									const creatorType = creator.creatorType === 'author'
										? 'bookAuthor'
										: creator.creatorType;
									newItem.creators.push({
										...creator,
										creatorType
									});
								});
								item.bookTitle = item.title;
								delete item.itemType;
								delete item.title;
								delete item.numPages;
								delete item.creators;
								Object.assign(newItem, item);
							}
						);
					}
						catch (error) {
							bookData.articleAuthor?.forEach((name) => {
								newItem.creators.push(ZU.cleanAuthor(name, 'bookAuthor'));
							});
						}
				}
				break;
			}
			case 'conferencePaper':
				newItem.proceedingsTitle = data.proceeding;
				newItem.conferenceName = data.conference;
				newItem.place = data.pubArea;
				newItem.date = data.articlePubDate ?? data.year;
				newItem.volume = data.volume;
				newItem.issue = data.issue;
				newItem.pages = data.pages;
				break;
			case 'thesis':
				newItem.thesisType = {
					Doctor: 'Doctoral dissertation',
					Master: 'Master thesis'
				}[data.degree];
				newItem.university = data.articleAffiliation;
				newItem.place = data.affiliationCountryEn;
				newItem.date = data.articlePubDate ?? data.year;
				newItem.Major = data.major;
				break;
			default:
				break;
		}
		data.articleAuthor?.forEach((name) => {
			newItem.creators.push(ZU.cleanAuthor(name, 'author'));
		});
			data.articleKeywords?.forEach((word) => {
				newItem.tags.push(word.trim());
			});
		newItem.complete();
	}
}

async function scrapeSearch(item, callback = item => item.complete()) {
	if (!item.DOI && !item.ISBN) throw new Error('no identifier available');
	const translator = Z.loadTranslator('search');
	translator.setSearch(item);
	translator.setHandler('translators', (_, translators) => {
		translator.setTranslator(translators);
	});
	translator.setHandler('itemDone', (_obj, item) => {
		callback(item);
	});
	translator.setHandler('error', () => { });
	await translator.getTranslators();
	await translator.translate();
}

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
				"date": "04/2020",
				"DOI": "10.1016/j.tree.2019.12.007",
				"ISSN": "01695347",
				"issue": "4",
				"journalAbbreviation": "Trends in Ecology & Evolution",
				"language": "en",
				"libraryCatalog": "DOI.org (Crossref)",
				"pages": "367-376",
				"publicationTitle": "Trends in Ecology & Evolution",
				"shortTitle": "Climate Change and Edaphic Specialists",
				"url": "https://linkinghub.elsevier.com/retrieve/pii/S0169534719303520",
				"volume": "35",
				"attachments": [],
				"tags": [],
				"notes": [],
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
				"title": "Building the critical anthropology of climate change: towards a socio-ecological revolution",
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
				"ISBN": "9781003469940 9781032745770 9781032745763",
				"abstractNote": "\"This book applies a critical perspective to anthropogenic climate change and the global socio-ecological crisis. The book focuses on the critical anthropology of climate change by opening up a dialogue with the two main contending perspectives in the anthropology of climate change, namely the cultural ecological and the cultural interpretive perspectives. Guided by these, the authors take a firm stance on the types of changes that are needed to sustain life on earth as we know it. Within this framework, they explore issues of climate and social equity, the nature of the current era in earth's geohistory, the perspectives of the elite polluters driving climate change, and the regrettable contributions of anthropologists and other scholars to climate change. Engaging with perspectives from sociology, political science, and the geography of climate change, the book explores various approaches to thinking about and responding to the existential threat of an ever-warming climate. In doing so, it lays the foundation for a brave new sustainable world that is socially just, highly democratic, and climatically-safe for humans and other species. This book will be of interest to researchers and students studying environmental anthropology, climate change, human geography, sociology, and political science\"--",
				"language": "eng",
				"libraryCatalog": "K10plus ISBN",
				"numPages": "284",
				"place": "London New York",
				"publisher": "Routledge, Taylor & Francis Group",
				"series": "Routledge environmental anthropology",
				"shortTitle": "Building the critical anthropology of climate change",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "Includes bibliographical references and index"
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
						"firstName": "Lydia",
						"lastName": "Dotto",
						"creatorType": "bookAuthor"
					}
				],
				"date": "2006",
				"ISBN": "9780889209688 9780889208247",
				"bookTitle": "Thinking the Unthinkable",
				"language": "eng",
				"libraryCatalog": "K10plus ISBN",
				"pages": "55-64",
				"place": "Waterloo, CANADA",
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
				"date": "2020-01-01",
				"abstractNote": "This project develops a Lacanian framework for analysing the EU’s climate change mitigation policymaking in a period that corresponds to the finalisation of the 2030 Clean energy package and the launch of the 2050 long-term decarbonization strategy. It empirically follows the work of the EU at its Brussels headquarters and at the level of the UNFCCC Conferences of the Parties between 2017 and 2018 and methodologically contributes to the poststructuralist strands of Global Environmental Politics in International Relations. This project aims to reflect on the nature of the EU’s current climate action and on the possibility of “change” in relation to scientifically informed climate warnings and recommendations on departing from the business as usual logic. The investigation is guided by the case studies of energy efficiency and renewables, and circular economy given their policy-relevance and given that these are considered desirable policy tools by the EU. It builds on Jacques Lacan’s theory of discourse which allows us to emphasise signification and its effects on the speaking subjects. This makes it possible to open a seemingly closed discourse and expose its inherent fractures through the speaking subjects by empirically exploring how energy efficiency, renewables and circular economy are spoken. It is demonstrated that energy efficiency, renewables and circular economy cannot be thought as a presupposition of sense that automatically delivers the desired and required emissions reductions. I argue that to understand the current EU’s climate action and any possibility of change, attention must be paid to the way in which any produced fractures are handled in signification by the subjects, as these can be either positively integrated into signification or can disrupt it and cause a change of paradigm. I conclude that except for a few potentially disruptive elements that leave room for a true rupture and possible change, the current EU’s climate mitigation action appears more as a fictitious change than as a real transition.",
				"language": "en-US",
				"libraryCatalog": "CNKI Scholar",
				"place": "United Kingdom",
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
				"date": "2023-01-01",
				"abstractNote": "Coral reef fish exhibit a large variety of behaviours crucial for fitness and survival. The cleaner wrasse Labroides dimidiatus displays cognitive abilities in its interaction with other species by providing services of ectoparasite cleaning. These features serve as a good model to understand the complex processes of social behaviour and how these interactions might be altered by changes in the marine environment due to ocean acidification (caused by elevated CO2) and warming (elevated temperature). In general, little is known about the functional molecular basis of cooperative behaviour between L. dimidiatus and its potential client fishes and how rapid environmental changes might affect it. Thus, here we investigate the molecular mechanisms responsible for the interaction behaviour using Acanthurus leucosternon as client. In addition, we exposed interacting fish species to three conditions representing predicted future climate change conditions (according to RCP8.0 2100) and compare with a control of present-day levels of temperature and CO2 :1) elevated levels of pCO2 (1000 μatm), 2) elevated temperature (32oC), and 3) a combined condition of elevated levels of CO2 and temperature. We dissected the fore-, mid-, and hindbrain regions of each fish to analyse specific differential gene expression, using transcriptomics, and we found that most of the variation and transcriptional response in both species was regulated in the hindbrain and forebrain regions. The interaction behaviour responses of L. dimidiatus during ambient environmental conditions involved immediate early gene alteration, dopaminergic and glutamatergic pathways, the expression of neurohormones (such as isotocin) and steroids (e.g. progesterone and estrogen), as well as social decision-making genes. In contrast, for the client, fewer molecular alterations were found, mostly involving pituitary hormone responses. However, the molecular signatures of L. dimidiatus were affected in all future climate change conditions with transcriptional changes observed in functions such as stress response (i.e. hypoxia, apoptosis, heat shock proteins), histone regulation, metabolism and the synapse. Key molecular processes, such as learning and memory activation in the cleaner wrasse and stress relief and reduced aggression in the client, were affected by the future climate change conditions. Genes involved in behaviour and memory were altered in expression under the elevated CO2 and temperature conditions, whereas the combined condition showed no expression changes related to behaviour, suggesting no additive effect on the cognitive abilities of L. dimidiatus with two simultaneous conditions. Hence, future environmental conditions influence the molecular programming involved in the mutualism maintenance for L. dimidiatus and its potential clients with possible large-scale effects on the coral reef ecosystems.",
				"language": "en-US",
				"libraryCatalog": "CNKI Scholar",
				"place": "Hong Kong,China",
				"thesisType": "Master thesis",
				"university": "The University of Hong Kong (Pokfulam, Hong Kong)",
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
				"DOI": "10.2507/34th.daaam.proceedings.027",
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
