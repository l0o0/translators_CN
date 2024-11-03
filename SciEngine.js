{
	"translatorID": "a6b49a96-35a1-46b7-a722-32f6ef7be125",
	"label": "SciEngine",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.sciengine\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-03 10:28:18"
}

/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gamial.com>

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
	if (doc.querySelector('meta[name="journal_id"]')) {
		return 'journalArticle';
	}
	else if (url.includes('/book/')) {
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	// waiting for chapter export API available, e.g. https://www.sciengine.com/chapter/978-7-03-033988-1_0010005
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	// '.item-content > .title  > a' for search result
	// '.listItem .tag+a' for ranking list
	// '.content > .title > a' for journal navigation
	const rows = doc.querySelectorAll('.item-content > .title  > a,.listItem .tag+a, .content > .title > a');
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
	const itemType = detectWeb(doc, url);
	switch (itemType) {
		case 'journalArticle':
			await scrapeJournal(doc);
			break;
		case 'book':
			await scrapeBook(doc);
			break;
		case 'multiple': {
			const items = await Zotero.selectItems(getSearchResults(doc, false));
			if (!items) return;
			for (const url of Object.keys(items)) {
				await doWeb(await requestDocument(url), url);
			}
			break;
		}
	}
}

async function scrapeBook(doc) {
	const labels = new Labels(doc, '.booksDetails > ul > li');
	const newItem = new Z.Item('book');
	newItem.title = text(doc, '.booktitle > .booksTitletTop');
	newItem.abstractNote = text(doc, '.bookIntro > span');
	newItem.series = labels.get(['丛书名', 'Seriesname']);
	newItem.place = '北京';
	newItem.publisher = labels.get(['出版社', 'Press']);
	newItem.data = ZU.strToISO(labels.get(['出版时间', 'Publishingtime']));
	newItem.numPages = labels.get(['页数', 'Page']);
	newItem.ISBN = labels.get(['书号', 'Booknumber']);
	newItem.DOI = labels.get('DOI');
	newItem.url = attr(doc, '.qrcode', 'title');
	labels.get(['作者', 'Author']).split(',').forEach((name) => {
		const creator = ZU.cleanAuthor(ZU.capitalizeName(name), 'author');
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
		newItem.creators.push(creator);
	});
	labels.get(['编辑', 'Editor']).split(',').forEach((name) => {
		const creator = ZU.cleanAuthor(ZU.capitalizeName(name), 'editor');
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
		newItem.creators.push(creator);
	});
	newItem.complete();
}

async function scrapeJournal(doc) {
	const translator = Zotero.loadTranslator('web');
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);
	translator.setHandler('itemDone', (_obj, item) => {
		function fixField(field, callback) {
			if (item[field]) {
				item[field] = callback(item[field]);
			}
		}
		delete item.institution;
		delete item.company;
		delete item.label;
		delete item.distributor;
		fixField('abstractNote', abstract => abstract.replace(/<p[^>]*>|<\/p>/g, ''));
		fixField('date', ZU.strToISO);
		fixField('language', lang => lang.replace('_', '-'));
		item.libraryCatalog = 'SciEngine';
		item.creators.forEach((creator) => {
			if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
				creator.fieldMode = 1;
			}
		});
		item.attachments.push({
			title: 'Snapshot',
			document: doc
		});
		item.complete();
	});
	await translator.translate();
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
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.sciengine.com/CSB/doi/10.1360/TB-2021-0743",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "日本福岛核废水排海情景下海洋生态环境影响与应对",
				"creators": [
					{
						"firstName": "",
						"lastName": "林武辉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "余克服",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杜金秋",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "林宏阳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "余雯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "莫敏婷",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-12-16",
				"DOI": "10.1360/TB-2021-0743",
				"ISSN": "0023-074X",
				"abstractNote": "Ten years after the Fukushima nuclear accident (FNA), Japan announced the planned discharge of over one million tons of Fukushima radioactive wastewater (FRW) into the Pacific Ocean in two years. This decision regarding FRW disposal has aroused worldwide concerns and public fears, which may be exacerbated by reputational damage and the lack of a clear public understanding of the possible adverse impacts of the FRW. As one of the countries surrounding the Pacific Ocean, China is a stakeholder in this decision regarding the FRW disposal. In this study, we compared the FRW source and its associated radionuclide components with the liquid effluent from routine operation of the nuclear power plant and its associated radionuclides. The activity concentrations of 13 radionuclides in the pre- and post-treated FRW by the Advanced Liquid Processing Systems (ALPS) were quantitatively compared with limits for radionuclide concentrations required by Japan law, guidance levels for radionuclides in drinking water provided by the World Health Organization (WHO), and baseline concentrations of radionuclides in surface seawater from the Pacific Ocean before the FNA. Sediment-seawater distribution coefficients and bioconcentration factors are also shown to provide insights into the mobility and biological availability of radionuclides derived from the FRW in the marine environment. Although 62 radionuclides can be recovered from the FRW by ALPS according to a report from the Tokyo Electric Power Company (TEPCO), a large amount of <sup>3</sup>H remains in the ALPS-treated FRW. The total amount of <sup>3</sup>H in the ALPS-treated FRW was approximately <sc>8.6×10<sup>14</sup> Bq</sc> (by October 31, 2019), with an average concentration of <sc>7.3×10<sup>5</sup> Bq/L,</sc> higher than the concentration limit <sc>(6×10<sup>4</sup> Bq/L)</sc> required by Japan law and guidance level <sc>(10<sup>4</sup> Bq/L)</sc> provided by the WHO. The amount of <sup>3</sup>H in the ALPS-treated FRW <sc>(8.6×10<sup>14</sup> Bq</sc> by October 31, 2019) is continually increasing, and is already higher than the amount of <sup>3</sup>H (3×10<sup>14</sup><sc>‒7×10<sup>14</sup> Bq)</sc> released into the Pacific Ocean immediately after the FNA. Additionally, other radionuclides (e.g., <sup>14</sup>C, <sup>90</sup>Sr, <sup>129</sup>I, etc.) in the ALPS-treated FRW with high bioconcentration factors and high activity-dose conversion factors relative to <sup>3</sup>H should also be carefully monitored and evaluated. The measured results provided by the TEPCO indicated that ~70% of the current ALPS-treated FRW should be repurified to reduce concentrations of other radionuclides to meet Japan’s legal requirements. Despite several unresolved factors (e.g., the FRW source terms, discharging plan, hydrodynamic and biogeochemical processes, etc.) simultaneously influencing the fate of FRW in the marine environment, we qualitatively described the hydrodynamically driven passive transport pathway and the biologically driven active transport pathway of the FRW. The transport of the FRW should be comprehensively investigated from the perspective of physical-biogeochemical processes at multiple scales (e.g., large-scale wind-driven circulation, mesoscale eddies, small-scale turbulence) and three-dimensional (e.g., vertical and horizontal vectors) oceans. Key gateways and transport pathways relevant to the FRW entry into the China seas have been suggested to include the Luzon Strait, the outer continental shelf and cross-shelf penetrating fronts in the East China Sea, the Yellow Sea Warm Current, and the Korean Coastal Current. Under specific conditions, the neglected biologically driven active transport pathway may significantly accelerate transport speed for the FRW-derived radionuclides via migratory animals (e.g., Pacific bluefin tuna) and may impose relatively high radiological risk to humans via seafood consumption.Finally, the consequences of marine ecological environment and our preparedness for the FRW release were discussed from the perspectives of total radioactivity, radionuclide components in the FRW, transport pathways of the FRW, and enhancing capacity to meet radiological risk assessment needs. Nuclear power plants located near the coastal seas are gradually developing in China and play a significant role in China’s national strategy of “Carbon Neutrality”. Technical systems of measurement, tracer, and assessment of radionuclides in the marine environments should be given more attention and be continually enhanced in line with the development of nuclear power plants. Several directions including extremely low minimum detection activity for the analytical methods of radionuclides, buoy-based online and real-time measurement technology for marine radioactivity, construction and validation of numerical models for marine radioactivity, key marine biogeochemical processes for radionuclides, radiation dose-effect for marine biotas, radiological assessment models, and remediation technology for radionuclides in marine environments are emphasized as key technologies in nuclear emergency preparedness to protect marine environment security.",
				"issue": "35",
				"journalAbbreviation": "CSB",
				"language": "zh-CN",
				"libraryCatalog": "SciEngine",
				"pages": "4500-4509",
				"publicationTitle": "科学通报",
				"url": "https://www.sciengine.com/10.1360/TB-2021-0743",
				"volume": "66",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "Fukushima nuclear accident"
					},
					{
						"tag": "Fukushima radioactive wastewater"
					},
					{
						"tag": "biogeochemical process"
					},
					{
						"tag": "marine hydrodynamic process"
					},
					{
						"tag": "nuclear power plant"
					},
					{
						"tag": "radionuclide"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.sciengine.com/AA/doi/10.1051/0004-6361:20041864",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "The Leiden/Argentine/Bonn (LAB) Survey of Galactic HI-Final data release of the combined LDS and IAR surveys withimproved stray-radiation corrections",
				"creators": [
					{
						"firstName": "Kalberla P. M.",
						"lastName": "W",
						"creatorType": "author"
					},
					{
						"firstName": "Burton W.",
						"lastName": "B",
						"creatorType": "author"
					},
					{
						"firstName": "Hartmann",
						"lastName": "Dap",
						"creatorType": "author"
					},
					{
						"firstName": "Arnal E.",
						"lastName": "M",
						"creatorType": "author"
					},
					{
						"firstName": "Bajaja",
						"lastName": "E",
						"creatorType": "author"
					},
					{
						"firstName": "Morras",
						"lastName": "R",
						"creatorType": "author"
					},
					{
						"firstName": "Pöppel W. G.",
						"lastName": "L",
						"creatorType": "author"
					}
				],
				"date": "2021-06-24",
				"DOI": "10.1051/0004-6361:20041864",
				"ISSN": "0004-6361",
				"abstractNote": "We present the final data release of observations of<italic>λ</italic>21-cm emission from Galactic neutral hydrogen over the entiresky, merging the Leiden/Dwingeloo Survey (LDS: Hartmann &amp; Burton 1997, Atlas of Galactic Neutral Hydrogen) of the sky north of <italic>δ</italic> = -30° with the Instituto Argentino de Radioastronomía Survey (IAR: Arnal et al. 2000, A&amp;AS,142, 35; andBajaja et al. 2005, A&amp;A, 440, 767) of the sky south of <italic>δ</italic> = -25°. Theangular resolution of the combined material is <italic>HPBW</italic> ~ <inline-formula content-type=\"tex\"/>. The LSR velocity coverage spans the interval -450 km s<sup>-1</sup> to +400 km s<sup>-1</sup>, at a resolution of 1.3 km s<sup>-1</sup>. The data were corrected for stray radiation at the Institute for Radioastronomy of theUniversity of Bonn, refining the original correction applied to the LDS. The rms brightness-temperature noise of the merged database is <inline-formula content-type=\"tex\"/> K. Residual errors in the profile wings due to defects in the correction for stray radiation are for most of the data below alevel of <inline-formula content-type=\"tex\"/> mK. It would be necessary to construct a telescopewith a main beam efficiency of <inline-formula content-type=\"tex\"/>% to achieve the same accuracy. The merged and refined material entering the LAB Survey of Galactic H <sc>i</sc> is intended to be a general resource useful to a wide range of studies of the physical and structural characteristices ofthe Galactic interstellar environment. The LAB Survey is the most sensitive Milky Way H <sc>i</sc> survey to date, with the most extensive coverage both spatially and kinematically.  <b>FullText for HTML: </b><a target=\"_blank\" class=\"col_4A90E2\" href=\"https://doi.org/10.1051/0004-6361:20041864\">https://doi.org/10.1051/0004-6361:20041864</a>",
				"issue": "2",
				"journalAbbreviation": "AA",
				"language": "zh-CN",
				"libraryCatalog": "SciEngine",
				"pages": "775-782",
				"publicationTitle": "天文学与天体物理",
				"url": "https://www.sciengine.com/AA/doi/10.1051/0004-6361:20041864",
				"volume": "440",
				"attachments": [
					{
						"title": "Full Text PDF",
						"url": "",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "Galaxy: structure"
					},
					{
						"tag": "radio lines: ISM"
					},
					{
						"tag": "surveys"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.sciengine.com/publisher/CSPM/book/978-7-03-053231-2",
		"items": [
			{
				"itemType": "book",
				"title": "中国淡水藻志  第二十一卷  金藻门（Ⅱ）",
				"creators": [
					{
						"firstName": "",
						"lastName": "魏印心",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "韩学哲",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙青",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"ISBN": "9787030532312",
				"abstractNote": "本卷是《中国淡水藻志》金藻门的第Ⅱ册，此卷册根据作者多年所积累的研究成果，并参考国内外最新的资料编写而成。全书分总论和各论两部分，总论部分论述了金藻类的研究简史、形态特征、分类系统、硅质鳞片金藻类在中国的地理分布和生态分布，各论部分系统全面总结了我国金藻门金藻纲、褐枝藻纲、囊壳藻纲和土栖藻纲共16属、137个种、7个变种和2个变型，其中有4个种是在中国首先发现、命名的新分类单位，对1个种进行了特征修改和分类讨论，中国新记录24个分类单位。每个种均以我国的标本逐一作了详细的描述，绘制精致细胞形态图版7幅，光学显微镜彩色照片图版2幅，电子显微镜照片图版111幅，插图5幅。列述了纲、目、科、属、种的检索表，以及译成英文的纲、目、科、属、种检索表。书末附有中文学各名和拉丁学名索引，附录中有金藻类英汉术语对照表。本书是目前中国收集最全的第一部金藻类志书。 本书可供生物学、藻类学、细胞学、生态学和环境科学研究领域的科学工作者和教学人员阅读参考。",
				"libraryCatalog": "SciEngine",
				"numPages": "334",
				"place": "北京",
				"publisher": "科学出版社",
				"series": "中国淡水藻志",
				"url": "https://www.sciengine.com/publisher/CSPM/book/978-7-03-053231-2",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.sciengine.com/plat/search?queryField_a=nano",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.sciengine.com/plat/mostRead",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.sciengine.com/SSI/home",
		"items": "multiple"
	}
]
/** END TEST CASES **/
