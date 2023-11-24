{
	"translatorID": "0fbde090-5376-4ed9-8636-2c39588f7a0c",
	"label": "National Science and Technology Library - China",
	"creator": "jiaojiaodubai23",
	"target": "^https?://www\\.nstl\\.gov\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-24 12:34:28"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai@gmail.com

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


const LABELMAP = {
	期刊论文: 'journalArticle',
	会议论文: 'presentation',
	学位论文: 'thesis',
	图书: 'bookSection',
	文集汇编: 'bookSection',
	标准: 'standard',
	专利: 'patent'
};

function detectWeb(doc, url) {
	// Z.debug(label);
	if (url.includes('/paper_detail')) {
		let label = doc.querySelector('#title > span.frontLabel');
		if (!label) return false;
		label = label.innerText.slice(1, -1);
		LABELMAP.hasOwnProperty(label);
		return LABELMAP[label];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.result-list-tit > a');
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

function trimZero(string) {
	return (string) ? string.replace(/^0*/, '') : '';
}

function matchCreator(creator) {
	// Z.debug(creators);
	if (/[A-Za-z]/.test(creator)) {
		creator = ZU.cleanAuthor(creator, 'author');
	}
	else {
		creator = creator.replace(/\s/g, '');
		creator = {
			lastName: creator,
			creatorType: 'author',
			fieldMode: 1
		};
	}
	return creator;
}

const TYPEMAP = {
	JournalPaper: 'journalArticle',
	ProceedingsPaper: 'presentation',
	DegreePaper: 'thesis',
	Book: 'bookSection',
	CorpusCompile: 'bookSection',
	StandardLiterature: 'standard',
	Patent: 'patent'
};

const FIELDMAP = {
	title: { node: 'tit' },
	abstractNote: { node: 'abs' },
	abstractTranslation: { node: 'abal' },
	titleTranslation: { node: 'tial' },
	publicationTitle: { node: 'hasSotit_s' },
	volume: {
		node: 'vol',
		callback: function (text) {
			return trimZero(text);
		}
	},
	issue: {
		node: 'iss',
		callback: function (text) {
			return trimZero(text);
		}
	},
	firstPage: { node: 'stpa' },
	lastPage: { node: 'enpa' },
	date: { node: 'yea' },
	language: {
		node: 'lan',
		callback: function (obj) {
			let lang = Object.keys(obj)[0];
			let language = {
				zh: 'zh-CN',
				en: 'en-US',
				ja: 'jp-JP'
			}[lang];
			return language ? language : 'zh-CN';
		}
	},
	ISSN: { node: 'issn' },
	DOI: { node: 'doi' },
	archive: { node: 'soty' },
	archiveLocation: { node: 'hasHollico' },
	callNumber: { node: 'hasHolhonu' },
	ISBN: { node: 'isbn' },
	place: { node: 'hasPropla' },
	meetingName: { node: 'hasPronam_s' },
	bookTitle: { node: 'hasSotit_s' },
	thesisType: { node: 'deg' },
	university: { node: 'uni_s' },
	majority: { node: 'maj_s' },
	supervisor: { node: 'hasTutnam_s' },
	publisher: { node: 'isbo' },
	number: { node: 'stnu' },
	applyDate: { node: 'vada' },
	replaced: { node: 'rebyst' },
	replacedBy: { node: 'restd' },
	organization: { mode: 'hasCrOrnam_s' },
	country: { node: 'opcoco' },
	apend: { node: 'assignee' },
	patentNumber: { node: 'apnu' },
	filingDate: { node: 'apda' },
	applicationNumber: { node: 'apnu' },
	issueDate: { node: 'opda' },
	legalStatus: { node: 'iast' }
};

class DATA {
	constructor(innerData) {
		this.innerData = innerData;
	}

	get(node, str = true) {
		var result = this.innerData.find(element => (element.f == node));
		if (!result) return '';
		result = result.v;
		if (Array.isArray(result) && str) {
			return result[0];
		}
		return result;
	}
}

async function scrape(doc, url = doc.location.href) {
	let id = url.match(/id=[\da-z]+/)[0].substring(3);
	// Z.debug(id);
	let requestResult = await requestJSON(
		'https://www.nstl.gov.cn/api/service/nstl/web/execute?target=nstl4.search4&function=paper/pc/detail',
		{
			method: 'POST',
			body: `id=${id}`
		}
	);
	var data = new DATA(requestResult.data);
	// Z.debug(data);
	var newItem = new Z.Item(TYPEMAP[data.get('type')]);
	var result = '';
	for (const field in FIELDMAP) {
		const recipe = FIELDMAP[field];
		result = data.get(recipe.node);
		if (recipe.callback) {
			result = recipe.callback(result);
		}
		newItem[field] = result;
	}
	newItem.pages = (function () {
		let firstPage = newItem.firstPage;
		let lastPage = newItem.lastPage;
		delete newItem.firstPage;
		delete newItem.lastPage;
		if (firstPage && lastPage) {
			return `${firstPage}-${lastPage}`;
		}
		else {
			return '';
		}
	})();
	switch (newItem.itemType) {
		case 'standard':
			try {
				newItem.creators = data.get('creator').split(';').map(creator => (matchCreator(creator)));
			}
			catch (error) {
				newItem.creators = [];
			}
			break;
		case 'patent':
			newItem.place = data.get('add');
			newItem.creators = data.get('hasAutnam_s', false).map(creator => (matchCreator(creator)));
			break
		case 'bookSection':
			break;
		default:
			try {
				newItem.creators = data.get('hasAutnam_s', false).map(creator => (matchCreator(creator)));
				newItem.tags = data.get('key', false).map(element => ({ tag: element }));
			}
			catch (erro) {
				newItem.creators = [];
				newItem.tags = [];
			}
			break;
	}
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=11548b4483a0090a29ff858849128255",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "基于量子中心的测量型量子保密求和协议",
				"creators": [
					{
						"lastName": "王跃",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "张可佳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "韩睿",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"ISSN": "1007-5461",
				"abstractNote": "量子保密求和是量子安全计算的基础,目的是在保护参与者私有信息的前提下求出参与者秘密信息的和.提出一个基于GHZ类态的三方量子保密求和协议,其中只有量子中心拥有全量子能力,其余参与者只能对接收的量子态进行反射或测量.理论分析表明,所提出的协议可以确保正确性,即多个参与者最后可以成功计算他们秘密的和;同时,该协议还可以抵抗参与者攻击和外部攻击,即无论是外部攻击者还是内部参与者都不能获得除自己的秘密与结果之外的任何信息.最后,进一步讨论了如何将协议的参与者由三方拓展至多方.",
				"archive": "journal",
				"archiveLocation": "CN111001",
				"callNumber": "0120230300503894",
				"issue": "1",
				"language": "zh-CN",
				"libraryCatalog": "National Science and Technology Library - China",
				"pages": "104-111",
				"publicationTitle": "量子电子学报",
				"volume": "40",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "GHZ类态"
					},
					{
						"tag": "量子中心"
					},
					{
						"tag": "量子保密求和"
					},
					{
						"tag": "量子安全多方计算"
					},
					{
						"tag": "量子通信"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=c762f4f25f0af517b6927f967c807b33",
		"items": [
			{
				"itemType": "presentation",
				"title": "Quantum cryptography beyond quantum key distribution: variants of quantum oblivious transfer",
				"creators": [
					{
						"firstName": "Erika",
						"lastName": "Andersson",
						"creatorType": "author"
					},
					{
						"firstName": "Lara",
						"lastName": "Stroh",
						"creatorType": "author"
					},
					{
						"firstName": "Ittoop V.",
						"lastName": "Puthoor",
						"creatorType": "author"
					},
					{
						"firstName": "David",
						"lastName": "Reichmuth",
						"creatorType": "author"
					},
					{
						"firstName": "Nikola",
						"lastName": "Horova",
						"creatorType": "author"
					},
					{
						"firstName": "Robert",
						"lastName": "Starek",
						"creatorType": "author"
					},
					{
						"firstName": "Michal",
						"lastName": "Micuda",
						"creatorType": "author"
					},
					{
						"firstName": "Miloslav",
						"lastName": "Dusek",
						"creatorType": "author"
					},
					{
						"firstName": "Petros",
						"lastName": "Wallden",
						"creatorType": "author"
					}
				],
				"date": "2023",
				"abstractNote": "Modern cryptography is more than sending secret messages, and quantum cryptography is more than quantum key distribution. One example is oblivious transfer, which is interesting partly because it can be used to implement secure multiparty computation. We discuss a protocol for quantum XOR oblivious transfer, and how non-interactive quantum oblivious transfer protocols can be \"reversed\", so that oblivious transfer is still implemented from a sender to a receiver, but so that it is the receiver who sends a quantum state to the sender, who measures it, instead of the other way round. This is useful when one party can only prepare and send quantum states, and the other party can only measure them, which is often the case in practical quantum communication systems. Both the \"original\" XOR oblivious transfer protocol and its reversed version have been implemented optically. We also discuss how quantum random access codes can be connected with quantum oblivious transfer.",
				"language": "en-US",
				"meetingName": "Quantum Computing, Communication, and Simulation (conference)",
				"place": "San Francisco, California",
				"shortTitle": "Quantum cryptography beyond quantum key distribution",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "Entangled states"
					},
					{
						"tag": "Quantum communication protocols"
					},
					{
						"tag": "Quantum communications"
					},
					{
						"tag": "Quantum cryptography"
					},
					{
						"tag": "Quantum entanglement"
					},
					{
						"tag": "Quantum key distribution"
					},
					{
						"tag": "Quantum probability"
					},
					{
						"tag": "Quantum protocols"
					},
					{
						"tag": "Quantum receivers"
					},
					{
						"tag": "Quantum states"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=8a8df2a8037c93e39ef90c83c3f9854d",
		"items": [
			{
				"itemType": "bookSection",
				"title": "Promoting Innovative Culture",
				"creators": [],
				"date": "2018",
				"ISBN": "9781119383239",
				"abstractNote": "As mentioned earlier, innovation is a process of transforming creative ideas or inventions into new products, services, business processes, organizational processes, or marketing processes that generate value for relevant stakeholders. Part IV: Promoting Innovative Culture is composed of 10 chapters, as follows (Figure 4.1).",
				"archive": "book",
				"archiveLocation": "CN111015",
				"bookTitle": "Practical Creativity and Innovation in Systems Engineering",
				"callNumber": "Y58124",
				"language": "en-US",
				"libraryCatalog": "National Science and Technology Library - China",
				"pages": "205-325",
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
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=8232bdce6ef1c515e701e5c8333980b5",
		"items": [
			{
				"itemType": "thesis",
				"title": "跨文化交际中的文化身份",
				"creators": [
					{
						"lastName": "温福兰",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2005",
				"abstractNote": "Chapter One.Introduction  1.1.The Significance of the Thesis\n    Cultural identity is important in intercultural communication，because a   person's cultural identity exerts a profound influence on his or her communicative   style and there are cultural differences in the structures of expectation to identity.  When people from different ethnic or cultural background come in contact，cultural   differences and historical and economical disparity between these cultural or social   groups Can easily lead to stereotyping，prejudice，discrimination，ethnocentrism，  which are serious pronems to effective intercultural communication. Sometimes   cultural conflicts occur.among which identity conflict is one of those intractable   conflicts.So，it is important for people to appreciate what constitutes membership in   the cultures and how that membership might influence the manner in which people   approach，perceive，and interact with other cultures.  1.2.The Purpose of the Thesis\n    This thesis is the study of cultural identity of sonic minority or marginalized  social groups.The author describes stereotypes，prejudice，discrimination based on  those identities，analyses their formation from the cultural，social.political and  historical perspectives and their negative effects on intercultural communication,in  ordder that we can develop our sensitivity to cultural diversity and cultural differences  and find out some practical approaches to effective intercultural communication  1.3.The PractieaI Value of the Thesis\n    Cultural identity is a controversial issue all around the world.\n    Cultural diversity has become a fact.Cultural diversity is considered as one of  key phenomena shaping the contemporary world and greatly enhances sensitivity to  cultural identity.Today,in an age when discrete cultures themselves are under threat.the question of cultural identity becomes newly problematic and takes on new urgency.People become more and more concerned about the uniqueness or the particularity of their own culture.National governments that promote multicultural，multiracial harmony like Singapore，or the United States，in fact eahance ethnic separateness by constantly drawing attention tO“racial”,or“ethnic”identities.\n    Contemporarily or in the long run，to preserve and promote cultural identities  and to discover their traditional value and adaptive function can achieve the harmony  of multicultural or multiethnic societies，and eventual integration and assimilation of cultures，whether on the global level or on the local level.So，the study of cultaral identity in this thesis embodies great practical and historical value.1.4.Methodity\n    Theoretical and methodological developments of recent decades have transformed anthropology by situating local ethnographic researches within larger systems of power,and by focusing attention on the complex relationships between local communities and larger-scale structures within which these communities are embedded.Studying multi-level，multi-sited research problems is undertaken through the local setting but frames them in terms of global issues and often incorporates ethnographic experience elsewhere.Sociocultural and linguistic anthropologists share a study of many key phenomena and critically analyze and theorize these phenomena through ethnographic investigation of contemporary social, cultural，political，economic，and communicative processes.\n    This thesis is to study communicative problems based on some cultural identities in intercultural communication.The author develops this study on the basis of sociocultural，anthropological and ethnographic approaches.",
				"archive": "thesis",
				"archiveLocation": "CN111001",
				"callNumber": "Y949023",
				"language": "zh-CN",
				"libraryCatalog": "National Science and Technology Library - China",
				"thesisType": "硕士",
				"university": "江西师范大学",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "功能语言学"
					},
					{
						"tag": "文化身份"
					},
					{
						"tag": "语篇体裁"
					},
					{
						"tag": "语言空间"
					},
					{
						"tag": "跨文化交际"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=62a65387857fda4549fa792153075229",
		"items": [
			{
				"itemType": "bookSection",
				"title": "量子ドットによる細胞イメージング",
				"creators": [],
				"date": "2007",
				"abstractNote": "蛍光性半導体ナノ結晶、すなわち量子ドット(QDs)は、電子材料として開発されて以来、ここ十数年の間に著しく改良が加えられ、生物学分野へまでその適用範囲を拡げてきた。量子ドットは、半導体材料であるCdSeやCdTe,InP,InAsなどの様々な材料から合成され、それぞれのバンドギヤップエネルギーに応じた蛍光波長を有する。",
				"archive": "collection",
				"archiveLocation": "CN111001",
				"bookTitle": "電気学会研究会資料 バイオ·マイクロシステム研究会 BMS-07-1~6",
				"callNumber": "3040641",
				"language": "jp-JP",
				"libraryCatalog": "National Science and Technology Library - China",
				"pages": "25-28",
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
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=031c48a44b069d07c3405be97782013f",
		"items": [
			{
				"itemType": "standard",
				"title": "制药机械(设备)材料选用导则",
				"creators": [
					{
						"lastName": "中国制药装备行业协会",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "国药集团重庆医药设计院有限公司",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "湖南千山制药机械股份有限公司",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "浙江厚达智能科技股份有限公司",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "山西太钢不锈钢股份有限公司",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"archiveLocation": "CN111025",
				"language": "zh-CN",
				"libraryCatalog": "National Science and Technology Library - China",
				"number": "GB/T 42354-2023",
				"publisher": "CN-GB",
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
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=693a65c33411667d124712efa881aca8",
		"items": [
			{
				"itemType": "patent",
				"title": "不锈钢平底锅",
				"creators": [
					{
						"lastName": "黄桂深",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"issueDate": "2023",
				"abstractNote": "1.本外观设计产品的名称：不锈钢平底锅。2.本外观设计产品的用途：本外观设计产品用于烹调食物的锅。3.本外观设计产品的设计要点：在于形状。4.最能表明设计要点的图片或照片：立体图1。5.仰视图已在立体图2中体现出来故省略，省略仰视图。",
				"applicationNumber": "CN202230481835.9",
				"country": "CN",
				"filingDate": "2022-07-27 08:00:00",
				"language": "zh-CN",
				"legalStatus": "有效",
				"patentNumber": "CN202230481835.9",
				"place": "521000 广东省潮州市潮安区彩塘镇仙乐二村东彩路外侧内洋长池片",
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
		"url": "https://www.nstl.gov.cn/search.html?t=JournalPaper,ProceedingsPaper,DegreePaper&q=6YeP5a2Q",
		"items": "multiple"
	}
]
/** END TEST CASES **/
