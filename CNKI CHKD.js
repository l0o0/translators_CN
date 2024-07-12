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
	"lastUpdated": "2024-07-12 13:05:37"
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
	CHKJ: 'journalArticle',
	PUBMED: 'journalArticle',
	CDMH: 'thesis',
	CHKP: 'conferencePaper',
	CHKN: 'newspaperArticle',
	BSFD: 'bookSection',
	BSPD: 'patent',
	BSAD: 'report',
	BSSD: 'standard',
	BSSF: 'standard',
	BSHF: 'standard'
};

var dbcodeMap = {
	期刊: 'CHKJ',
	硕博: 'CDMH',
	会议: 'CHKP',
	报纸: 'CHKN',
	PubMed: 'PUBMED',
	外文: 'PUBMED',
	年鉴: 'BSFD',
	专利: 'BSPD',
	成果: 'BSAD',
	标准题录: 'BSSD',
	国家标准: 'BSSF',
	行业标准: 'BSHF'
};

function detectWeb(doc, _url) {
	let result = doc.querySelector('.result_wrap');
	if (result) {
		Z.monitorDOMChanges(result, { subtree: true, childList: true });
	}
	let dbcode = attr(doc, '#paramdbcode', 'value');
	if (dbcode) {
		return typeMap[dbcode];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, _url, checkOnly) {
	var items = {};
	var found = false;
	let tab = text(doc, '.box .cur');
	let dbcode = '';
	var rows = doc.querySelectorAll('.list_table tbody > tr');
	for (let row of rows) {
		let href = row.querySelector('.name').href;
		let title = ZU.trimInternal(row.querySelector('.name').textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		if (tab.includes('总库')) {
			dbcode = dbcodeMap[Object.keys(dbcodeMap).find(key => text(row, '.text_center', 1).includes(key))];
		}
		else {
			dbcode = dbcodeMap[tab];
		}
		items[JSON.stringify({
			url: href,
			cookieName: dbcode + JSON.parse(attr(row, '.seq >input', 'logdata')).r + '!!1'
		})] = title;
	}
	return found ? items : false;
}

var csSelectors = {
	labels: '.top-space',
	title: '.brief h1',
	abstractNote: 'ChDivSummary',
	publicationTitle: 'no-selector-available',
	pubInfo: 'no-selector-available',
	publisher: 'no-selector-available',
	DOI: 'no-selector-available',
	creators: '#authorpart > span',
	tags: 'no-selector-available',
	hightlights: 'no-selector-available',
	bookUrl: 'no-selector-available'
};

async function doWeb(doc, url) {
	var translator = Zotero.loadTranslator('web');
	// CNKI
	translator.setTranslator('5c95b67b-41c5-4f55-b71a-48d5d7183063');
	translator.setDocument(doc);
	var cnki = await translator.getTranslatorObject();
	cnki.platform = 'CHKD';
	cnki.typeMap = typeMap;
	cnki.scholarLike = ['PUBMED'];
	cnki.enDatabese = ['PUBMED'];
	cnki.csSelectors = csSelectors;
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		await cnki.scrapeMulti(items, doc);
	}
	else {
		await cnki.scrape(doc);
	}
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=uzDkwlsKYf_ybnqiBgEkJImD70qS6iOlUtE74DoOYdEx1Uc_0fsKAAdVAmvQ__PHOdhBTtnZbFlnvGH_m7f2mgo-KF_8EHt94IzsGWygUsL9NsdJHKZ6KQ==&uniplatform=CHKD",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "新型线驱动式微创手术器械结构设计与运动学分析",
				"creators": [
					{
						"firstName": "",
						"lastName": "赵万博",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈赛旋",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "姜官武",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李荣",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "章宇",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "在微创手术机器人系统中，传统线驱动式手术器械的偏摆关节与夹持器的转动关节之间存在运动耦合，这会对手术器械的运动精度产生不良影响。为此，提出了一种新型的四自由度线驱动式手术器械，其偏摆关节采用行星齿轮式结构，以实现偏摆关节与夹持器之间的运动解耦。首先，对传统线驱动式手术器械的关节运动耦合问题进行了分析。然后，设计了行星齿轮式转动的偏摆关节，并通过几何理论分析证明了其具有极低的关节耦合性，且钢丝绳在运动过程中的受迫形变量极小；同时，通过标准D-H参数法建立了新型手术器械的正运动学模型，并利用解析法求得了其逆运动学的封闭解。最后，分别使用MATLAB软件的Robotics Toolbox和Simulink环境中搭建的仿真模型对手术器械的正、逆运动学模型的准确性进行了验证，并采用蒙特卡罗法分析了其工作空间。仿真结果表明，所提出的手术器械的结构设计可靠，关节之间的运动耦合性较低，其工作空间能够满足微创外科手术的要求。研究结果可为柔性线驱动式手术器械的结构设计与运动学分析提供参考。",
				"extra": "foundation: 国家自然科学基金青年基金资助项目（52005316）； 江苏省重点研发计划项目（BE2020082-3,BE2020082-4）； 特殊环境机器人技术四川省重点实验室开放基金资助项目（22kftk04）；\nCLC: TH77;TP242\nCNKICite: 0",
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=uzDkwlsKYf_EKqnYKaTZ6Dp5sX48QYz_jGkmpGXx_7UFT2jGi3BiLBHe0eB7LzVvKZY1pIWSvKN-pIf-KWPj3adhzQ-waxBZOBVWJm2j3aWVMkLjZOSiVotIdab6fru2nBhH11OctMipY7vXACY1LA==&uniplatform=CHKD",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Role of PDGFRA<sup>+</sup> cells and a CD55<sup>+</sup> PDGFRA<sup>Lo</sup> fraction in the gastric mesenchymal niche.",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "Elisa",
						"lastName": "Manieri"
					},
					{
						"creatorType": "author",
						"firstName": "Guodong",
						"lastName": "Tie"
					},
					{
						"creatorType": "author",
						"firstName": "Ermanno",
						"lastName": "Malagola"
					},
					{
						"creatorType": "author",
						"firstName": "Davide",
						"lastName": "Seruggia"
					},
					{
						"creatorType": "author",
						"firstName": "Shariq",
						"lastName": "Madha"
					},
					{
						"creatorType": "author",
						"firstName": "Adrianna",
						"lastName": "Maglieri"
					},
					{
						"creatorType": "author",
						"firstName": "Kun",
						"lastName": "Huang"
					},
					{
						"creatorType": "author",
						"firstName": "Yuko",
						"lastName": "Fujiwara"
					},
					{
						"creatorType": "author",
						"firstName": "Kevin",
						"lastName": "Zhang"
					},
					{
						"creatorType": "author",
						"firstName": "Stuart H.",
						"lastName": "Orkin"
					},
					{
						"creatorType": "author",
						"firstName": "Timothy C.",
						"lastName": "Wang"
					},
					{
						"creatorType": "author",
						"firstName": "Ruiyang",
						"lastName": "He"
					},
					{
						"creatorType": "author",
						"firstName": "Neil",
						"lastName": "McCarthy"
					},
					{
						"creatorType": "author",
						"firstName": "Ramesh A.",
						"lastName": "Shivdasani"
					}
				],
				"date": "2023-12-02",
				"DOI": "10.1038/s41467-023-43619-y",
				"ISSN": "2041-1723",
				"abstractNote": "Abstract\n            \n              PDGFRA-expressing mesenchyme supports intestinal stem cells. Stomach epithelia have related niche dependencies, but their enabling mesenchymal cell populations are unknown, in part because previous studies pooled the gastric antrum and corpus. Our high-resolution imaging, transcriptional profiling, and organoid assays identify regional subpopulations and supportive capacities of purified mouse corpus and antral PDGFRA\n              +\n              cells. Sub-epithelial PDGFRA\n              Hi\n              myofibroblasts are principal sources of BMP ligands and two molecularly distinct pools distribute asymmetrically along antral glands but together fail to support epithelial growth in vitro. In contrast, PDGFRA\n              Lo\n              CD55\n              +\n              cells strategically positioned beneath gastric glands promote epithelial expansion in the absence of other cells or factors. This population encompasses a small fraction expressing the BMP antagonist\n              Grem1\n              . Although\n              Grem1\n              \n                +\n              \n              cell ablation in vivo impairs intestinal stem cells, gastric stem cells are spared, implying that CD55\n              +\n              cell activity in epithelial self-renewal derives from other subpopulations. Our findings shed light on spatial, molecular, and functional organization of gastric mesenchyme and the spectrum of signaling sources for epithelial support.",
				"issue": "1",
				"journalAbbreviation": "Nat Commun",
				"language": "en-US",
				"libraryCatalog": "DOI.org (Crossref)",
				"pages": "7978",
				"publicationTitle": "Nature Communications",
				"url": "https://www.nature.com/articles/s41467-023-43619-y",
				"volume": "14",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=uzDkwlsKYf_zGikMosUwQSSYP48zoOZp7LOjpdk-gcRwMen9mFjbmlqQeuE-PlxHxy-hTH0TyTp64VKD9TDcLEKIFzOGwIl4HPuauOzpdNdkMcS-0RTHFQ==&uniplatform=CHKD",
		"items": [
			{
				"itemType": "thesis",
				"title": "风湿免疫病患者潜伏结核感染的流行病学特征、危险因素和预防性治疗状况探究",
				"creators": [
					{
						"firstName": "",
						"lastName": "马亚楠",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘晓清",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"abstractNote": "目的:调查我国风湿免疫病患者中T-SPOT.TB检测的阳性率,并分析影响T-SPOT.TB结果的相关因素;同时调查风湿免疫病患者预防性抗结核治疗的状况,为进一步规范风湿免疫病患者潜伏结核感染的预防与管理提供依据。方法:第一部分:风湿免疫病患者潜伏结核感染率及相关因素的多中心横断面研究纳入自2014年9月至2016年3月我国东、中、西部13家三级甲等综合医院接诊的风湿免疫病患者,应用T-SPOT.TB筛查LTBI。收集研究对象的基本信息,包括性别、年龄、地区、BMI、病程、吸烟史、基础疾病、结核病暴露史、结核病既往史、糖皮质激素、免疫抑制剂及生物制剂的使用情况、实验室化验、风湿免疫病诊断。采用单因素及多因素Logistic回归分析对T-SPOT.TB结果的影响因素进行分析。第二部分:系统性红斑狼疮患者潜伏结核感染率及相关因素的多中心横断面研究纳入自2014年9月至2016年3月我国东、中、西部13家三级甲等综合医院接诊的系统性红斑狼疮患者,应用T-SPOT.TB筛查LTBI。收集研究对象的基本信息,包括性别、年龄、BMI、病程、结核病既往史、SLEDAI-2K评分、糖皮质激素及免疫抑制剂的使用情况,采用单因素及多因素Logistic回归分析对T-SPOT.TB结果的影响因素进行分析。第三部分:风湿免疫病患者预防性抗结核治疗情况分析纳入自2014年9月至2016年3月我国东、中、西部13家三级甲等综合医院就诊的接受预防性抗结核治疗的风湿免疫病患者,分析研究对象风湿免疫病的类型及系统受累情况、结核活动的危险因素、预防性抗结核治疗方案及活动性结核病的发生情况。结果:第一部分:风湿免疫病患者潜伏结核感染率及相关因素的多中心横断面研究13445例风湿免疫病患者中有3715例患者进行了 T-SPOT.TB检测,其中检测阳性的患者有672例,风湿免疫病患者总体阳性率为18.1%(95%CI 16.9-19.3)。各病种T-SPOT.TB阳性率从8.9%到44.4%不等,不同病种之间T-SPOT.TB阳性率存在显著差异。男性T-SPOT.TB的阳性率总体高于女性,随年龄增加呈增高趋势。多因素Logistic回归分析显示:年龄大于40岁(OR 1.86,95%CI 1.51-2.28),吸烟(OR 1.65,95%CI 1.14-2.40),有结核既往史(OR 3.87,95%CI 2.72-5.51),患有白塞综合征的患者(OR ...",
				"extra": "DOI: 10.27648/d.cnki.gzxhu.2023.000403\nmajor: 内科学（传染病学）（专业学位）\nCLC: R255.93;R254.3;R181.2;R52;R181.13;\nCNKICite: 0",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"thesisType": "博士学位论文",
				"university": "北京协和医学院",
				"url": "https://doi.org/10.27648/d.cnki.gzxhu.2023.000403",
				"attachments": [
					{
						"title": "Full Text CAJ",
						"mimeType": "application/caj"
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=uzDkwlsKYf8SYErvSSFkdi2QLpx5Clwu_iSdj4x5D0MEctQO1mECnRkBL5fuTmUGfjUv8sh0NA1RiEkoGoida9cyOffv7f0BeS5QA0sq73nZmwz0ebGWXw==&uniplatform=CHKD",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "针灸在风湿免疫疾病中应用前景",
				"creators": [
					{
						"firstName": "",
						"lastName": "殷海波",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "肖战说",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020",
				"DOI": "10.26914/c.cnkihy.2020.027433",
				"abstractNote": "中医针灸是老祖宗留下的宝贵医学遗产,在风湿免疫疾病的治疗中发挥着重要作用。风湿免疫性疾病病因复杂,发病率高。诸多古代文献对\"痹病\"\"脊强\"\"狐惑\"及\"蝴蝶疮\"等病的针灸治疗有详细论述,上述中医病名属风湿免疫性疾病范畴,现代针灸医家也多运用针灸治疗风湿免疫性疾病。临床研究表明运用针灸治疗类风湿关节炎、骨关节病、痛风等风湿疾病有良好的临床疗效;现代实验研究探索针灸治疗风湿免疫疾病的机理,发现可能与恢复机体免疫细胞平衡性、减轻炎症反应等机制相关。随着针灸在风湿免疫性疾病的基础与临床研究的不断深入,针灸在复杂的风湿免疫疾病中地位也逐渐上升,针灸在风湿免疫性疾病的治疗中前景广阔。",
				"conferenceName": "“中医针灸”申遗十周年特别活动暨世界针灸学会联合会2020国际针灸学术研讨会",
				"extra": "organizer: 世界针灸学会联合会、中国中医科学院、海南省卫生健康委员会\nCLC: R593.22;R245;R255.93;\nCNKICite: 0",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"pages": "2",
				"place": "中国海南海口",
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
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=uzDkwlsKYf-FifqyVzfTfRkGotzjbzLLG_aSKsWxtuFMsG-ZrBEaUw5KnYWUDiWFwHgeIRKiSzato4TJktqRQycIR_doZL2o1dCv2DhoJ7KpXJ1rOFmY4Q==&uniplatform=CHKD",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "微创时代，攻克肾结石的新利器——经皮肾镜",
				"creators": [
					{
						"firstName": "",
						"lastName": "杨璟",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-03-29",
				"extra": "DOI: 10.28213/n.cnki.ndzjk.2023.002142\nCLC: R692.4;R61;\nCNKICite: 0",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"pages": "K48",
				"publicationTitle": "大众健康报",
				"url": "https://doi.org/10.28213/n.cnki.ndzjk.2023.002142",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": " 微创时代"
					},
					{
						"tag": " 肾结石"
					},
					{
						"tag": "经皮肾镜"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=uzDkwlsKYf-rht_OSW78wG7pCn2F7KJekSf7qPi2rLgTRHBtO_uUb90oZnj81XrwEZ5fxRHeexCAH2fzIwWz10C9r0-_WcwbfxPJyom-QFoFUaCN_XnWE5ETlPc1RznZ&uniplatform=CHKD",
		"items": [
			{
				"itemType": "bookSection",
				"title": "表彰全国九亿农民健康教育行动先进集体和先进工作者",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘新明",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘益清",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"ISBN": "9787117045445",
				"bookTitle": "中国卫生年鉴",
				"extra": "original-container-title: YEARBOOK OF PUBLIC HEALTH IN THE PEOPLE'S REPUBLIC OF CHINA\nCLC: R193;R194",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"pages": "241-242",
				"publisher": "人民卫生出版社",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=BSFD&dbname=BSFD0611&filename=N2005030077000347",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "表彰全国九亿农民健康教育行动先进集体和先进工作者"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=78ssZZiIu9Z-H8itIiq3FBrYH7yfBBqW_rWKEajfFyOhuqTEL_YnKlB7c361KSErLvYOFZRiJVSWR5i33kX4-7ClBHjrhpcExeyRVfTMuefjN4bVFyhi3w==&uniplatform=CHKD",
		"items": [
			{
				"itemType": "report",
				"title": "医院医疗无菌器械实行质量追溯与信息化管理",
				"creators": [
					{
						"firstName": "",
						"lastName": "白晓晶",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "徐凤兰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "徐国凤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王金兰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "朱其明",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "赵秀良",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "郑丽萍",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李艳琴",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘燕",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020",
				"abstractNote": "本研究课题属于信息领域的实用性研究,其成果主要用最终使用后是否能达到预期的技术水平来表达。最重要的是使消毒供应中心为临床科室所提供材料的质量、数量做到了严密的信息化记载和追溯,实现高效、规范、科学的物品供给管理体系,通过对医疗器械回收、清洗、消毒、灭菌操作流程及无菌物品发放、临床使用,全过程实行“一条线”规范化的追溯管理。提高了医院的服务能力,可更好地服务于患者。随着该新技术的成熟和针对此项技术应用的宣传,可向县区级医院推广应用,使基层医院更好地开展消毒供应工作,所以将会有极为广阔的应用前景,必将产生良好的社会效益与经济效益。  随着高科技、信息化社会的不断开展,医疗系统信息化管理和运用势在必行。医院医疗无菌器械应用追溯系统管理,是医院实行信息化、规范化管理的必然要求,也是科技成果在医疗事业中的必然应用。目前,在全市乃至全省市级医疗机构,武威医学科学院(武威肿瘤医院)是唯一一家开展医疗无菌器材追溯系统新项目的实施和新技术的运用医院。该项目实施后对医院信息化管理和降低医疗成本费用,提高医院医疗质量的成效已显现。随着我院这项新技术的运用显现的成效,同时根据国家对医疗器材实施全面质量追溯的要求,医疗行业采用和实施医疗无菌物品质量追溯这一新技术将一定会得到全面推广和普及运用。本课题发表论文2篇。",
				"extra": "Genre: 应用技术\nlevel: 国内先进\nevaluation: 验收\nCLC: R-331;R197.32",
				"institution": "甘肃省武威肿瘤医院",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"reportType": "科技报告",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=BSAD&dbname=BSADLAST&filename=SNAD000001830586",
				"attachments": [
					{
						"title": "Full Text CAJ",
						"mimeType": "application/caj"
					}
				],
				"tags": [
					{
						"tag": "信息化管理"
					},
					{
						"tag": "医疗无菌器械"
					},
					{
						"tag": "质量追溯"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=78ssZZiIu9ZZ2grQuaPVIp18cl43yuLxT3tnFdDKTV5pa8SsZhgHZMsL_bKq-r07uvwZxw6PoXT2j4cShxl0ERbCk_kuCBhCUWZY8arXNOa3A2zblBcgLg==&uniplatform=CHKD",
		"items": [
			{
				"itemType": "standard",
				"title": "手术刀片",
				"creators": [],
				"date": "1988-02-13",
				"extra": "original-title: Knife blades\nCLC: C31\nCNKICite: 0",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"numPages": "11P;A4",
				"number": "GB 2544—1988",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=BSSD&dbname=BSSDLAST&filename=SCSD000000063873",
				"attachments": [],
				"tags": [
					{
						"tag": "Blades"
					},
					{
						"tag": "Dimensions"
					},
					{
						"tag": "Specifications"
					},
					{
						"tag": "Surgical knives"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/kcms2/article/abstract?v=78ssZZiIu9bapPnWBoS4ajFe3gfjwJ6I3c9D8MJqahoUYhd-vmF_Bbh_XqUxx9HtvP--W-LxEi-r-xwVKSXnSElxirD3uwX7HTD4CLK01ECabc0S7OKuhg==&uniplatform=CHKD",
		"items": [
			{
				"itemType": "standard",
				"title": "清洗消毒器　第3部分：对人体废弃物容器进行湿热消毒的清洗消毒器　要求和试验",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国消毒技术与设备标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018-12-20",
				"extra": "original-title: Washer-disinfector—Part 3:Washer-disinfectors employing thermal disinfection for human waste containers—Requirements and tests\napplyDate: 2020-01-01\nCLC: C47\nCNKICite: 0",
				"language": "zh-CN",
				"libraryCatalog": "CNKI CHKD",
				"numPages": "1-16",
				"number": "YY/T 0734.3—2018",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=BSHF&dbname=BSHF&filename=SCHF202001042",
				"attachments": [],
				"tags": [
					{
						"tag": "清洗消毒器"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://chkdx.cnki.net/kns8/#/",
		"items": "multiple"
	}
]
/** END TEST CASES **/
