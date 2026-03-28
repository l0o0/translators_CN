{
	"translatorID": "b6a819d3-022f-4d16-a97d-26c8645de1cf",
	"label": "CNKI CHKD",
	"creator": "jiaojiaodubai",
	"target": "^https?://(chkdx?|kns)\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-03-14 07:06:41"
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

function detectWeb(doc, _url) {
	const main = doc.querySelector('#app .main');
	if (main) {
		Z.monitorDOMChanges(main, { subtree: true, childList: true });
	}
	const dbcode = attr(doc, paramsMap.dbcode, 'value');
	for (const lang in typeMap) {
		const type = typeMap[lang][dbcode];
		if (type) return type;
	}
	if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;

	/* We handle search result page only, journal navigation page and author profile page are falled back to CNKI.js */
	const rows = doc.querySelectorAll('.result_wrap tbody > tr');
	for (const row of rows) {
		const href = attr(row, 'a.name', 'href');
		const title = innerText(row, 'a.name');
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
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
	const params = {};
	for (const [key, selector] of Object.entries(paramsMap)) {
		params[key] = attr(doc, selector, 'value');
	}
	if (params.dbcode == 'CHKFJ') {
		await scrapePubMed(doc, url);
	}
	else {
		const translator = Z.loadTranslator('web');
		// CNKI
		translator.setTranslator('5c95b67b-41c5-4f55-b71a-48d5d7183063');
		translator.setDocument(doc);
		const cnki = await translator.getTranslatorObject();
		cnki.uniplatform = 'CHKD';
		cnki.typeMap = typeMap;
		translator.setHandler('itemDone', (_obj, item) => {
			switch (item.itemType) {
				case 'standard':
					// `.type` in CHKD patent page is abused
					delete item.status;
					break;
				default:
					break;
			}
			item.complete();
		});
		await cnki.scrapeMain(doc, url);
	}
}

async function scrapePubMed(doc, url) {
	const fullTextUrl = attr(doc, 'a#cajDown', 'href');
	const item = {};
	const match = /pubmed\/(?<pmid>\d+)/.exec(fullTextUrl);
	if (match && match.groups) {
		item.PMID = match.groups.pmid;
		await scrapeSearch(item);
		return;
	}
	const doi = ZU.cleanDOI(attr(doc, 'a[href*="dx.doi.org"]', 'href'));
	try {
		await scrapeSearch(item);
	}
	catch (e) {
		Z.debug('Failed to use search translator, falling back to page scraping');
		Z.debug(e);
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

		/* Volome, issue, and full-text is unavailable */
		const newItem = new Z.Item('journalArticle');
		newItem.title = extractTitle(doc.querySelector('.wx-tit > h1'));
		newItem.abstractNote = innerText(doc, '.abstract-text');
		newItem.publicationTitle = data('JOURNAL');
		newItem.date = data('YEAR');
		newItem.url = url;
		if (doi) {
			newItem.DOI = doi;
			newItem.url = `https://dx.doi.org/${doi}`;
		}
		else {
			newItem.url = url;
		}
		newItem.pages = data('PAGES');
		doc.querySelectorAll('#authorpart > span').forEach((elm) => {
			newItem.creators.push(cleanAuthor(elm.innerText));
		});
		doc.querySelectorAll('#keyword a').forEach((elm) => {
			newItem.tags.push(elm.innerText.trim().replace(/;$/, ''));
		});
		setExtra(newItem, 'Source URL', attr(doc, '#cajDown a', 'href'));
		newItem.complete();
	}
}

async function scrapeSearch(item) {
	if (!item.DOI && !item.PMID) throw new Error('no identifier available');
	const translator = Z.loadTranslator('search');
	translator.setSearch(item);
	translator.setHandler('translators', (_, translators) => {
		translator.setTranslator(translators);
	});
	translator.setHandler('error', () => { });
	await translator.getTranslators();
	await translator.translate();
}

const paramsMap = {
	filename: '#paramfilename',
	dbcode: '#paramdbcode',
	dbname: '#paramdbname',
};

const enTypeMap = {
	CHKFJ: 'journalArticle',
};

const zhTypeMap = {
	CHKJ: 'journalArticle',
	CDMH: 'thesis',
	CHKP: 'conferencePaper',
	CHKN: 'newspaperArticle',
	// BSFD: 'bookSection',
	BSPD: 'patent',
	BSAD: 'report',
	BSSD: 'standard',
	BSSF: 'standard',
	BSHF: 'standard'
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=esvOG1ozB-jq3j26NWOluoK-2suS2HLL-zMdgdvOsfNB_qnngFSYmsmwh2NiHW4ZSNqjz1hYszsNVhnTU1MsupmMCEdAc8fRUA7Bm3Mu7ya1uednHpN7FboK7hgxwmBW6KyDaPgWbhI&uniplatform=CHKD&captchaId=14ed24af-bceb-4a13-a102-97d428d50e38",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "新型线驱动式微创手术器械结构设计与运动学分析",
				"creators": [
					{
						"lastName": "赵万博",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陈赛旋",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "姜官武",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "李荣",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "章宇",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"ISSN": "1006-754X",
				"abstractNote": "在微创手术机器人系统中，传统线驱动式手术器械的偏摆关节与夹持器的转动关节之间存在运动耦合，这会对手术器械的运动精度产生不良影响。为此，提出了一种新型的四自由度线驱动式手术器械，其偏摆关节采用行星齿轮式结构，以实现偏摆关节与夹持器之间的运动解耦。首先，对传统线驱动式手术器械的关节运动耦合问题进行了分析。然后，设计了行星齿轮式转动的偏摆关节，并通过几何理论分析证明了其具有极低的关节耦合性，且钢丝绳在运动过程中的受迫形变量极小；同时，通过标准D-H参数法建立了新型手术器械的正运动学模型，并利用解析法求得了其逆运动学的封闭解。最后，分别使用MATLAB软件的Robotics Toolbox和Simulink环境中搭建的仿真模型对手术器械的正、逆运动学模型的准确性进行了验证，并采用蒙特卡罗法分析了其工作空间。仿真结果表明，所提出的手术器械的结构设计可靠，关节之间的运动耦合性较低，其工作空间能够满足微创外科手术的要求。研究结果可为柔性线驱动式手术器械的结构设计与运动学分析提供参考。",
				"extra": "Fund: 国家自然科学基金青年基金资助项目（52005316）； 江苏省重点研发计划项目（BE2020082-3,BE2020082-4）； 特殊环境机器人技术四川省重点实验室开放基金资助项目（22kftk04）；",
				"issue": "6",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"pages": "657-666",
				"publicationTitle": "工程设计学报",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CHKJ&dbname=CHKJTEMP&filename=GCSJ202306001",
				"volume": "30",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "Simulink仿真"
					},
					{
						"tag": "微创手术机器人"
					},
					{
						"tag": "手术器械"
					},
					{
						"tag": "线驱动"
					},
					{
						"tag": "运动学"
					},
					{
						"tag": "运动解耦"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=esvOG1ozB-hW6_W5RV_i28QwxZPldNeEON5lAlP1Z11MO_jcRB_UCzZ7GSdzHwVN-9HqmtwV3PK7JwzDU0Uvbmn7z0UHQciME69E9ETSqOIxaCe8wswxfXtdGDwrJGzvtjDCRechGKrBIa8MYx_MjFszYO4xl-ng3fki0CndP0c&uniplatform=CHKD&captchaId=df8ea549-4c7c-406c-8160-8405aad78acd",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Role of PDGFRA+ cells and a CD55+ PDGFRALo fraction in the gastric mesenchymal niche",
				"creators": [
					{
						"firstName": "Elisa",
						"lastName": "Manieri",
						"creatorType": "author"
					},
					{
						"firstName": "Guodong",
						"lastName": "Tie",
						"creatorType": "author"
					},
					{
						"firstName": "Ermanno",
						"lastName": "Malagola",
						"creatorType": "author"
					},
					{
						"firstName": "Davide",
						"lastName": "Seruggia",
						"creatorType": "author"
					},
					{
						"firstName": "Shariq",
						"lastName": "Madha",
						"creatorType": "author"
					},
					{
						"firstName": "Adrianna",
						"lastName": "Maglieri",
						"creatorType": "author"
					},
					{
						"firstName": "Kun",
						"lastName": "Huang",
						"creatorType": "author"
					},
					{
						"firstName": "Yuko",
						"lastName": "Fujiwara",
						"creatorType": "author"
					},
					{
						"firstName": "Kevin",
						"lastName": "Zhang",
						"creatorType": "author"
					},
					{
						"firstName": "Stuart H.",
						"lastName": "Orkin",
						"creatorType": "author"
					},
					{
						"firstName": "Timothy C.",
						"lastName": "Wang",
						"creatorType": "author"
					},
					{
						"firstName": "Ruiyang",
						"lastName": "He",
						"creatorType": "author"
					},
					{
						"firstName": "Neil",
						"lastName": "McCarthy",
						"creatorType": "author"
					},
					{
						"firstName": "Ramesh A.",
						"lastName": "Shivdasani",
						"creatorType": "author"
					}
				],
				"date": "2023-12-02",
				"DOI": "10.1038/s41467-023-43619-y",
				"ISSN": "2041-1723",
				"abstractNote": "PDGFRA-expressing mesenchyme supports intestinal stem cells. Stomach epithelia have related niche dependencies, but their enabling mesenchymal cell populations are unknown, in part because previous studies pooled the gastric antrum and corpus. Our high-resolution imaging, transcriptional profiling, and organoid assays identify regional subpopulations and supportive capacities of purified mouse corpus and antral PDGFRA+ cells. Sub-epithelial PDGFRAHi myofibroblasts are principal sources of BMP ligands and two molecularly distinct pools distribute asymmetrically along antral glands but together fail to support epithelial growth in vitro. In contrast, PDGFRALo CD55+ cells strategically positioned beneath gastric glands promote epithelial expansion in the absence of other cells or factors. This population encompasses a small fraction expressing the BMP antagonist Grem1. Although Grem1+ cell ablation in vivo impairs intestinal stem cells, gastric stem cells are spared, implying that CD55+ cell activity in epithelial self-renewal derives from other subpopulations. Our findings shed light on spatial, molecular, and functional organization of gastric mesenchyme and the spectrum of signaling sources for epithelial support.",
				"extra": "PMID: 38042929\nPMCID: PMC10693581",
				"issue": "1",
				"journalAbbreviation": "Nat Commun",
				"language": "eng",
				"libraryCatalog": "PubMed",
				"pages": "7978",
				"publicationTitle": "Nature Communications",
				"volume": "14",
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
						"tag": "Epithelial Cells"
					},
					{
						"tag": "Gastric Mucosa"
					},
					{
						"tag": "Intestines"
					},
					{
						"tag": "Mice"
					},
					{
						"tag": "Pyloric Antrum"
					},
					{
						"tag": "Receptor Protein-Tyrosine Kinases"
					},
					{
						"tag": "Stem Cells"
					},
					{
						"tag": "Stomach"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=esvOG1ozB-jt_A4zolGVtwEu-C8RXifhzRLpvVKpmdAss5aqyxegt0QOK6tz5eCluRXppiJStBVIwcv1sOkEOgpQ3pKavzzY8RkILjioUlzjqqft6BtwMqB5dafonMgUjLlft1E9nbI&uniplatform=CHKD&captchaId=45fc39c2-7342-4188-b9b2-0397ce62bb3a",
		"items": [
			{
				"itemType": "thesis",
				"title": "风湿免疫病患者潜伏结核感染的流行病学特征、危险因素和预防性治疗状况探究",
				"creators": [
					{
						"lastName": "马亚楠",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "刘晓清",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"DOI": "10.27648/d.cnki.gzxhu.2023.000403",
				"abstractNote": "目的:调查我国风湿免疫病患者中T-SPOT.TB检测的阳性率,并分析影响T-SPOT.TB结果的相关因素;同时调查风湿免疫病患者预防性抗结核治疗的状况,为进一步规范风湿免疫病患者潜伏结核感染的预防与管理提供依据。方法:第一部分:风湿免疫病患者潜伏结核感染率及相关因素的多中心横断面研究纳入自2014年9月至2016年3月我国东、中、西部13家三级甲等综合医院接诊的风湿免疫病患者,应用T-SPOT.TB筛查LTBI。收集研究对象的基本信息,包括性别、年龄、地区、BMI、病程、吸烟史、基础疾病、结核病暴露史、结核病既往史、糖皮质激素、免疫抑制剂及生物制剂的使用情况、实验室化验、风湿免疫病诊断。采用单因素及多因素Logistic回归分析对T-SPOT.TB结果的影响因素进行分析。第二部分:系统性红斑狼疮患者潜伏结核感染率及相关因素的多中心横断面研究纳入自2014年9月至2016年3月我国东、中、西部13家三级甲等综合医院接诊的系统性红斑狼疮患者,应用T-SPOT.TB筛查LTBI。收集研究对象的基本信息,包括性别、年龄、BMI、病程、结核病既往史、SLEDAI-2K评分、糖皮质激素及免疫抑制剂的...",
				"extra": "Major: 内科学（传染病学）（专业学位）",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"thesisType": "硕士学位论文",
				"url": "https://link.cnki.net/doi/10.27648/d.cnki.gzxhu.2023.000403",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "T-SPOT.TB"
					},
					{
						"tag": "潜伏结核感染"
					},
					{
						"tag": "预防性干预"
					},
					{
						"tag": "风湿免疫病"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=esvOG1ozB-hkLT-offlI8XCEdZgjKOT7AOD8nSxawljYb7_vOu5x98wwbC1IEYTW1kmhwDHIHLHysVrUXEEiCs_eiVbvbH6xDiHKhEeUWE74lb0CrV9eH799nPhASw3U9RYvQyDvb6M&uniplatform=CHKD&captchaId=a9a428b1-f4a9-47ac-a476-77d96c20be77",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "针灸在风湿免疫疾病中应用前景",
				"creators": [
					{
						"lastName": "殷海波",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "肖战说",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020-11-28",
				"DOI": "10.26914/c.cnkihy.2020.027433",
				"abstractNote": "中医针灸是老祖宗留下的宝贵医学遗产,在风湿免疫疾病的治疗中发挥着重要作用。风湿免疫性疾病病因复杂,发病率高。诸多古代文献对\"痹病\"\"脊强\"\"狐惑\"及\"蝴蝶疮\"等病的针灸治疗有详细论述,上述中医病名属风湿免疫性疾病范畴,现代针灸医家也多运用针灸治疗风湿免疫性疾病。临床研究表明运用针灸治疗类风湿关节炎、骨关节病、痛风等风湿疾病有良好的临床疗效;现代实验研究探索针灸治疗风湿免疫疾病的机理,发现可能与恢复机体免疫细胞平衡性、减轻炎症反应等机制相关。随着针灸在风湿免疫性疾病的基础与临床研究的不断深入,针灸在复杂的风湿免疫疾病中地位也逐渐上升,针灸在风湿免疫性疾病的治疗中前景广阔。 更多 还原 AbstractFilter('ChDivSummary', 'ChDivSummaryMore', 'ChDivSummaryReset');",
				"conferenceName": "“中医针灸”申遗十周年特别活动暨世界针灸学会联合会2020国际针灸学术研讨会",
				"eventPlace": "中国海南海口",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"proceedingsTitle": "“中医针灸”申遗十周年特别活动暨世界针灸学会联合会2020国际针灸学术研讨会论文集",
				"url": "https://doi.org/10.26914/c.cnkihy.2020.027433",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "展望"
					},
					{
						"tag": "针灸"
					},
					{
						"tag": "风湿免疫病"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=esvOG1ozB-ja_4BmZdMp-8FI6KS73ththi1rlYawejINFBah80ePYEKRB6B4QP7wDH_TJYLUNKwbjemVu1y_jp0bWP1VBd472_0xDIz5b2FXPFjof2YdJrh5jiIcHfTxTSDt9IOd-3I&uniplatform=CHKD&captchaId=60e67ec2-497d-459c-9b03-034fc1f84601",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "微创时代，攻克肾结石的新利器——经皮肾镜",
				"creators": [
					{
						"lastName": "杨璟",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-03-29",
				"DOI": "10.28213/n.cnki.ndzjk.2023.002142",
				"abstractNote": "据不完全统计,近年来,由于受到多种因素的影响,泌尿系统疾病在临床过程中的发病率有所提升,其对于广大人民群众的身心健康埋下了极大隐患。其中,作为较为常见的问题之一,肾结石对于患者日常生活造成了一定的影响。为了有效促进肾结石患者治疗质量的优化与改进,医疗人员结合先进......",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"pages": "K48",
				"url": "https://link.cnki.net/doi/10.28213/n.cnki.ndzjk.2023.002142",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "微创时代"
					},
					{
						"tag": "经皮肾镜"
					},
					{
						"tag": "肾结石"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=esvOG1ozB-i5W9v_S9AGNpA26oMSXjwVzLYfGMi_ZjGXsGTnXBepEOrHTuifVq9Px9LyKA_uPGGTcYRTGZD2OiWCP4oVGgB6YIynK_ItMOVAobJ0vd9e0JEd-GFB-_ENR9bkCkrXQTY&uniplatform=CHKD&captchaId=3c35af60-cdbd-431f-b672-3b41c22578cb",
		"items": [
			{
				"itemType": "report",
				"title": "医院医疗无菌器械实行质量追溯与信息化管理",
				"creators": [
					{
						"lastName": "白晓晶",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "徐凤兰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "徐国凤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "王金兰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "朱其明",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "赵秀良",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "郑丽萍",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "李艳琴",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "刘燕",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020",
				"abstractNote": "本研究课题属于信息领域的实用性研究,其成果主要用最终使用后是否能达到预期的技术水平来表达。最重要的是使消毒供应中心为临床科室所提供材料的质量、数量做到了严密的信息化记载和追溯,实现高效、规范、科学的物品供给管理体系,通过对医疗器械回收、清洗、消毒、灭菌操作流程及无菌物品发放、临床使用,全过程实行“一条线”规范化的追溯管理。提高了医院的服务能力,可更好地服务于患者。随着该新技术的成熟和针对此项技术应用的宣传,可向县区级医院推广应用,使基层医院更好地开展消毒供应工作,所以将会有极为广阔的应用前景,必将产生良好的社会效益与经济效益。 随着高科技、信息化社会的不断开展,医疗系统信息化管理和运用势在必行。医院医疗无菌器械应用追溯系统管理,是医院实行信息化、规范化管理的必然要求,也是科技成果在医疗事业中的必然应用。目前,在全市乃至全省市级医疗机构,武威医学科学院(武威肿瘤医院)是唯一一家开展医疗无菌器材追溯系统新项目的实施和新技术的运用医院。该项目实施后对医院信息化管理和降低医疗成本费用,提高医院医疗质量的成效已显现。随着我院这项新技术的运用显现的成效,同时根据国家对医疗器材实施全面质量追溯的要求,医疗行业采用和实施医疗无菌物品质量追溯这一新技术将一定会得到全面推广和普及运用。本课题发表论文2篇。",
				"extra": "Achievement Type: 应用技术\nLevel: 国内先进\nEvaluation: 验收",
				"institution": "甘肃省武威肿瘤医院",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=BSAD&dbname=BSADLAST&filename=SNAD000001830586",
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=esvOG1ozB-jAP1u1ihg4xZpqk9fQa72Bkz3hRUTtn1fSqcpUf1yZ3T0vRsHQiOpOWcmEFfuiqyvqKSYkORRMkB1LvxuMtesUXXkfW5I0NRGg0i4dsbbx3YOlbLrgGfoMXvck46YPpW4&uniplatform=CHKD&captchaId=40e52c1a-a695-4a60-9eea-aba70bb1425b",
		"items": [
			{
				"itemType": "standard",
				"title": "手术刀片",
				"creators": [],
				"date": "1988-02-13",
				"extra": "Original Title: Knife blades",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"numPages": "11P;A4",
				"number": "GB 2544—1988",
				"status": "题录",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=BSSD&dbname=BSSDLAST&filename=SCSD000000063873",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			},
			{
				"itemType": "standard",
				"title": "手术刀片",
				"creators": [],
				"date": "1988-02-13",
				"extra": "Original Title: Knife blades",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"numPages": "11P;A4",
				"number": "GB 2544—1988",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=BSSD&dbname=BSSDLAST&filename=SCSD000000063873",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=esvOG1ozB-iljH3VZ_nEyr5d7DSxWQgiYEfCt6xibZz-_SdhLA4PnFvlvHbN2Lg1u-GwZ575SF_veCUymCiYBp1yPjat5UJK-f_Ud9cuMMetNShnQtL_Y9k9QFFw5gpQ&uniplatform=CHKD&captchaId=3572eb50-161c-475d-bb59-33ffa035b9d6",
		"items": [
			{
				"itemType": "standard",
				"title": "清洗消毒器　第3部分：对人体废弃物容器进行湿热消毒的清洗消毒器　要求和试验",
				"creators": [
					{
						"lastName": "全国消毒技术与设备标准化技术委员会(SAC/TC200)",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018-12-20",
				"extra": "Original Title: Washer-disinfector—Part 3:Washer-disinfectors employing thermal disinfection for human waste containers—Requirements and tests\nApply Date: 2020-01-01",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"numPages": "16",
				"number": "YY/T 0734.3-2018",
				"status": "现行",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=BSHF&dbname=BSHF&filename=SCHF202001042",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			},
			{
				"itemType": "standard",
				"title": "清洗消毒器　第3部分：对人体废弃物容器进行湿热消毒的清洗消毒器　要求和试验",
				"creators": [
					{
						"lastName": "全国消毒技术与设备标准化技术委员会(SAC/TC200)",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018-12-20",
				"extra": "Original Title: Washer-disinfector—Part 3:Washer-disinfectors employing thermal disinfection for human waste containers—Requirements and tests\nApply Date: 2020-01-01",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"numPages": "16",
				"number": "YY/T 0734.3-2018",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=BSHF&dbname=BSHF&filename=SCHF202001042",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
