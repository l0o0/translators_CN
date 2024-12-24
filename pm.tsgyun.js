{
	"translatorID": "d8aa03df-6163-47a8-bc27-f23fcdbdba5a",
	"label": "pm.tsgyun",
	"creator": "jiaojiaodubai",
	"target": "^https://pm\\.yuntsg\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-12-24 13:04:25"
}

/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2024 jiaojiaodubai

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
	const searchPage = doc.querySelector('.searchPageMain');
	if (searchPage) {
		Z.monitorDOMChanges(searchPage, { childList: true, subtree: true });
	}
	if (url.includes('/details.html?')) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('.searchList  .titleRow');
	for (const row of rows) {
		const pmid = attr(row, 'input[type="checkbox"]', 'value');
		const title = text(row, '.titleH');
		if (!pmid || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[`https://pm.yuntsg.com/details.html?pmid=${pmid}`] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url of Object.keys(items)) {
			await scrape(url);
		}
	}
	else {
		await scrape(url);
	}
}

async function scrape(url) {
	const parser = new URL(url);
	const pmid = parser.searchParams.get('pmid');
	Z.debug(`PMID: ${pmid}`);
	const translator = Zotero.loadTranslator('search');
	// Pubmed
	translator.setTranslator('3d0231ce-fd4b-478c-b1d3-840389e5b68c');
	translator.setSearch({ itemType: "journalArticle", PMID: pmid });
	translator.setHandler('itemDone', (_obj, item) => {
		item.url = `https://pm.yuntsg.com/details.html?pmid=${pmid}`;
		item.language = 'en';
		item.complete();
	});
	translator.setHandler('error', () => { });
	await translator.translate();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://pm.yuntsg.com/details.html?pmid=25833107&key=%E5%BF%83%E8%84%8F",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "The heart's 'little brain' controlling cardiac function in the rabbit",
				"creators": [
					{
						"firstName": "Kieran E.",
						"lastName": "Brack",
						"creatorType": "author"
					}
				],
				"date": "2015-04-01",
				"DOI": "10.1113/expphysiol.2014.080168",
				"ISSN": "1469-445X",
				"abstractNote": "What is the topic of this review? The topic of the review is the intrinsic cardiac nervous system in the rabbit. What advances does it highlight? The anatomy of rabbit intrinsic ganglia is similar to that of other species, including humans. Immunohistochemistry confirms the presence of cholinergic and adrenergic neurones, with a striking arrangement of neuronal nitric oxide synthase-positive cell bodies. Activation of atrial ganglia produces effects on local and remote regions. Heart disease is a primary cause of mortality in the developed world, and it is well recognized that neural mechanisms play an important role in many cardiac pathologies. The role of extrinsic autonomic nerves has traditionally attracted the most attention. However, there is a rich intrinsic innervation of the heart, including numerous cardiac ganglia (ganglionic plexuses), that has the potential to affect cardiac function independently as well as to influence the actions of the extrinsic nerves. To investigate this, an isolated, perfused, innervated rabbit Langendorff heart preparation was considered the best option. Although ganglionic plexuses have been well described for several species, there was no full description of the anatomy and histochemistry of rabbit hearts. To this end, rabbit intrinsic ganglia were located using acetylcholinesterase histology (n = 33 hearts). This revealed six generalized ganglionic regions, defined as a left neuronal complex above the left pulmonary vein, a right neuronal complex around the base of right cranial vein, three scattered in the dorsal right atrium and a region containing numerous ventricular ganglia located on the conus arteriosus. Using immunohistochemistry, neurons were found to contain choline acetyltransferase or tyrosine hydroxylase and/or neuronal nitric oxide synthase in differing amounts (choline acetyltransferase > tyrosine hydroxylase > neuronal nitric oxide synthase). The function of rabbit intrinsic ganglia was investigated using a bolus application of nicotine or electrical stimulation at each of the above sites whilst measuring heart rate and atrioventricular conduction. Nicotine applied to different ganglionic plexuses caused a bradycardia, a tachycardia or a mixture of the two, with the right atrial plexus producing the largest chronotropic responses. Electrical stimulation at these sites induced only a bradycardia. Atrioventricular conduction was modestly changed by nicotine, the main response being a prolongation. Electrical stimulation produced significant prolongation of atrioventricular conduction, particularly when the right neuronal complex was stimulated. These studies show that the intrinsic plexuses of the heart are important and could be crucial for understanding impairments of cardiac function. Additionally, they provide a strong basis from which to progress using the isolated, innervated rabbit heart preparation.",
				"extra": "PMID: 25833107\nPMCID: PMC4409095",
				"issue": "4",
				"journalAbbreviation": "Exp Physiol",
				"language": "eng",
				"libraryCatalog": "PubMed",
				"pages": "348-353",
				"publicationTitle": "Experimental Physiology",
				"url": "https://pm.yuntsg.com/details.html?pmid=25833107",
				"volume": "100",
				"attachments": [
					{
						"title": "PubMed entry",
						"mimeType": "text/html",
						"snapshot": false
					}
				],
				"tags": [
					{
						"tag": "Animals"
					},
					{
						"tag": "Autonomic Nervous System"
					},
					{
						"tag": "Blood Pressure"
					},
					{
						"tag": "Feedback, Physiological"
					},
					{
						"tag": "Heart"
					},
					{
						"tag": "Heart Conduction System"
					},
					{
						"tag": "Heart Rate"
					},
					{
						"tag": "Models, Cardiovascular"
					},
					{
						"tag": "Models, Neurological"
					},
					{
						"tag": "Rabbits"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://pm.yuntsg.com/searchList.html",
		"items": "multiple"
	}
]
/** END TEST CASES **/
