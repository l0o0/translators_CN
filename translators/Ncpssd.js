{
	"translatorID": "5b731187-04a7-4256-83b4-3f042fa3eaa4",
	"label": "Ncpssd",
	"creator": "018<lyb018@gmail.com>,l0o0<linxzh1989@gmail.com>",
	"target": "^https?://([^/]+\\.)?ncpssd\\.org/Literature/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-03-31 03:05:50"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 018<lyb018@gmail.com>
	
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
	journalArticle: "中文期刊文章",
	eJournalArticle: "外文期刊文章",
	Ancient: "古籍"
};

var itemTypeMatch = {
	journalArticle: "journalArticle",
	eJournalArticle: "journalArticle",
	Ancient: "book"
};

var fieldMap = {
	mediac: "publicationTitle",
	vol: "volume",
	publishdate: 'date',
	num: "issue",
	issn: 'ISSN',
	showorgan: "AuthorAddress",
	titlec: "title",
	remarkc: "abstractNote",
	language: "language",
	section: "edition",
	isbn: "callNumber"
}

function getIDFromURL(url) {
	if (!url) return false;
	let useB64 = false;
	var type = url.match(/[?&]type=([^&#]*)/i);
	var id = url.match(/[?&]id=([^&#]*)/i);
	var typename = url.match(/[?&]typename=([^&#]*)/i);
	var barcodenum = url.match(/[?&]barcodenum=([^&#]*)/i);
	if (!type || !type[1] || !id || !id[1] || !typename || !typename[1]) return false;
	useB64 = type[1] % 4 == 0 || id[1] % 4 == 0 || typename[1] % 4 == 0 || type[1].endsWith("=") || id[1].endsWith("=") || typename[1].endsWith("=");
	if (!useB64) {
		return {
			type: type[1],
			id: id[1],
			typename: decodeURI(typename[1]),
			barcodenum: (barcodenum && barcodenum[1] ? barcodenum[1] : '')
		};
	} else {
		return {
			type: atob(type[1]),
			id: atob(id[1]),
			typename: atob(typename[1]),
			barcodenum: (barcodenum && barcodenum[1] ? atob(barcodenum[1]) : '')
		};
	}
}

function addCreators(names) {
	return names.replace(/\[\d+\]/g, "").split(";").reduce((a, b) => {
		if (b.includes(",")) {
			a.push({ firstName: b.split(",")[0].trim(), lastName: b.split(",")[1].trim(), creatorType: "author" });
		} else {
			a.push({ lastName: b, creatorType: "author", fieldMode: 1 });
		}
		return a;
	}, [])
}

function addTags(tags) {
	return tags.split(";").reduce((a, b) => { a.push({ tag: b }); return a }, []);
}

function addPages(data) {
	if ('beginpage' in data) {
		return data.endpage ? `${data.beginpage}-${data.endpage}` : data.beginpage;
	}
	return "";
}

function detectWeb(doc, url) {
	let id = getIDFromURL(url);
	// Z.debug(id);
	if (id.type) {
		return itemTypeMatch[id.type];
	} else if (getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}

function getSearchResults(doc, url, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('#ul_articlelist li');
	for (let row of rows) {
		let a = row.querySelector('.julei-list a');
		if (!a) {
			continue;
		}

		if (checkOnly) return true;
		let url = getUrl(a);

		// Z.debug(url);
		let title = row.querySelector('div.julei-list').innerText.split("\n")[0];
		found = true;
		items[url] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		let selectItems = await Zotero.selectItems(getSearchResults(doc, false));
		for (var url in selectItems) {
			await scrape(url, getIDFromURL(url));
		}
	}
	else {
		await scrape(url, getIDFromURL(url));
	}
}

async function scrape(url, id) {
	// Note this code contains Chinese character and symbol, （）；：
	let postData = { type: typeMap[id.type] };
	let postUrl = 'getjournalarticletable';
	if (id.type == 'Ancient') {
		postData.barcodenum = id.barcodenum;
		postUrl = 'getancientbooktable';
	} else {
		postData.lngid = id.id;
	}
	postData = JSON.stringify(postData);
	let headers = {
		'Content-Type': 'application/json',
		Referer: url
	};
	// Z.debug(postData);
	let json = await requestJSON("https://www.ncpssd.org/articleinfoHandler/" + postUrl, { method: "POST", body: postData, headers: headers });
	let data = json.data;
	// Clean data
	data.vol = data.vol ? data.vol.match(/(\d+)/)[0] : null;
	if (data.vol == '000') data.vol = null;
	data.language = data.language == 2 ? "en" : "zh-CN";
	data.mediac = data.mediac || data.mediae;
	data.showwriter = data.showwriter || data.authorc;
	// Z.debug(json);
	var item = new Zotero.Item(itemTypeMatch[id.type] || id.type);
	item.url = url;
	if (item.itemType == 'book') {
		item.extra = "Type: classic";
		item.extra = item.extra + (data.pubdatenote ? '\nOriginal Date:' + data.pubdatenote : '');
		item.extra = item.extra + (data.classname ? '\n分类:' + data.classname : '');
		let juan = data.titlec.match(/([一二三四五六七八九十]+卷)$/g);
		data.vol = (juan ? juan[0] : "") + data.num;
		data.num = null;
		data.showwriter = data.showwriter.replace(/（.*?）/, '').replace(/撰$/, '');
		data.section = data.section.replace(/^.*?）/, '');
	}
	for (let k in data) {
		if (k in fieldMap && data[k]) item[fieldMap[k]] = data[k];
	}
	if ("showwriter" in data && data.showwriter) item.creators = addCreators(data.showwriter);
	if ("keywordc" in data && data.keywordc) item.tags = item.tags.concat(addTags(data.keywordc));
	if ("keyworde" in data && data.keyworde) item.tags = item.tags.concat(addTags(data.keyworde));
	item.pages = addPages(data);
	let pdfurl = await getPDFUrl(id);
	if (pdfurl) item.attachments.push({
		url: pdfurl,
		mimeType: "application/pdf",
		title: "Full Text PDF",
		referer: "https://www.ncpssd.org/"
	})
	item.complete();
}

async function getPDFUrl(id) {
	let pdfurl;
	if (id.type == 'Ancient') {
		pdfurl = 'https://ft.ncpssd.org/pdf/getn/' + `ancient/pdf/${id.barcodenum}.pdf`;
	} else {
		let geturl = `https://www.ncpssd.org/Literature/readurl?id=${id.type == 'eJournalArticle' ? id.id.match(/(\d+)$/g)[0] : id.id}&type=${id.type == 'eJournalArticle' ? 2 : 1}`;
		// Z.debug(geturl);
		let resp = await requestJSON(geturl, { method: "GET", "Content-Type": "application/json" });
		// Z.debug(resp);
		if (resp) pdfurl = resp.url;
	}
	return pdfurl;
}

function getUrl(node, searchUrl) {
	var id = node.getAttribute("data-id");
	var type = node.getAttribute("data-name");
	var datatype = node.getAttribute("data-type");
	var typename = node.getAttribute("data-type");
	var barcodenum = "";
	if (datatype == "中文期刊文章") {
		datatype = "journalArticle";
	}
	if (datatype == "外文期刊文章") {
		datatype = "eJournalArticle";
	}
	if (datatype == "古籍") {
		barcodenum = node.getAttribute("data-barcodenum");
		datatype = "Ancient";
	}
	if (datatype == "外文图书") {
		barcodenum = node.getAttribute("data-id");
		datatype = "Book";
	}
	if (datatype == "方志") {
		datatype = "LocalRecords";
	}
	if (datatype == "会议论文") {
		datatype = "Conference";
	}
	if (datatype == "学位论文") {
		datatype = "Degree";
	}
	return encodeURI("https://www.ncpssd.org/Literature/articleinfo?id=" + id + "&type=" + datatype + "&datatype=" + type + "&typename=" + typename + "&nav=0" + "&barcodenum=" + barcodenum);
}/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.ncpssd.org/Literature/articleinfo.aspx?id=NzAwMTg3ODc4Mw==&type=am91cm5hbEFydGljbGU=&datatype=am91cm5hbEFydGljbGU=&typename=5Lit5paH5pyf5YiK5paH56ug&nav=0&barcodenum=",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "关键词法在大学英语词汇学习中应用效果的实证研究——以接受性和产出性测试为例",
				"creators": [
					{
						"lastName": "朱珺",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "杨继林",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "徐方雯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "[1]上饶师范学院外国语学院,江西上饶334001",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "[2]上饶师范学院教务处,江西上饶334001",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "需要学习者在母语与目的语之间找到发音相同或相近的词汇,在两个词汇之间构建语音连接,并以心理意象的形式记忆,利用言语和表象的双重编码过程促进记忆。这种词汇信息处理方式与常见的语义语境法不同,两种词汇学习方法值得进一步比较,为大学英语词汇教学提供启示。采用关键词法和语义语境法进行组间对比研究,可以发现在接受性和产出性两项测验中,前者的成绩皆明显优于后者,说明采取关键词法更能促进英语词汇的短时记忆、长时记忆和理解。",
				"libraryCatalog": "ncpssd",
				"pages": "112-118",
				"publicationTitle": "《上饶师范学院学报》(上饶师范学院学报)",
				"url": "http://www.ncpssd.org/Literature/articleinfo.aspx?id=NzAwMTg3ODc4Mw==&type=am91cm5hbEFydGljbGU=&datatype=am91cm5hbEFydGljbGU=&typename=5Lit5paH5pyf5YiK5paH56ug&nav=0&barcodenum=",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "关键词法"
					},
					{
						"tag": "短时记忆"
					},
					{
						"tag": "语义语境法"
					},
					{
						"tag": "长时记忆"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.ncpssd.org/Literature/articlelist.aspx?search=KElLVEU9IumVv+aXtuiusOW/hiIgT1IgSUtTVD0i6ZW/5pe26K6w5b+GIiBPUiBJS0VUPSLplb/ml7borrDlv4YiIE9SIElLU0U9IumVv+aXtuiusOW/hiIp&searchname=6aKY5ZCNL+WFs+mUruivjT0i6ZW/5pe26K6w5b+GIg==&nav=0",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.ncpssd.org/Literature/articleinfo.aspx?id=Q0FTUzQyODE2Mjc2&type=ZUpvdXJuYWxBcnRpY2xl&typename=5aSW5paH5pyf5YiK5paH56ug&nav=1&langType=2",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Patriot",
				"creators": [
					{
						"lastName": "Ross, Rick",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"issue": "2531958",
				"language": "en",
				"libraryCatalog": "ncpssd",
				"pages": "null",
				"publicationTitle": "《》(Wings of Gold)",
				"url": "http://www.ncpssd.org/Literature/articleinfo.aspx?id=Q0FTUzQyODE2Mjc2&type=ZUpvdXJuYWxBcnRpY2xl&typename=5aSW5paH5pyf5YiK5paH56ug&nav=1&langType=2",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
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
		"url": "https://www.ncpssd.org/Literature/articleinfo?id=GJ10001&type=Ancient&barcodenum=70041420&nav=5&typename=%E5%8F%A4%E7%B1%8D",
		"items": [
			{
				"itemType": "book",
				"title": "古今韻攷四卷",
				"creators": [
					{
						"lastName": "李因篤",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"abstractNote": "音韻",
				"callNumber": "經930/4060",
				"edition": "天壤閣合刻本",
				"extra": "Type: classic",
				"language": "zh-CN",
				"libraryCatalog": "Ncpssd",
				"volume": "四卷第一册",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/Literature/articleinfo?id=CASS265584219&type=eJournalArticle&typename=%E5%A4%96%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&nav=1&langType=2&pageUrl=https%253A%252F%252Fwww.ncpssd.org%252Fjournal%252Fdetails%253Fgch%253D185079%2526nav%253D1%2526langType%253D2",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Developing a Prediction Model for Author Collaboration in Bioinformatics Research Using Graph Mining Techniques and Big Data Applications",
				"creators": [
					{
						"lastName": "Fezzeh Ebrahimi",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "Asefeh Asemi",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "Ahmad Shabani",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "Amin Nezarat",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"ISSN": "2008-8302",
				"abstractNote": "Nowadays, scientific collaboration has dramatically increased due to web-based technologies, advanced communication systems, and information and scientific databases. The present study aims to provide a predictive model for author collaborations in bioinformatics research output using graph mining techniques and big data applications. The study is applied-developmental research adopting a mixed-method approach, i.e., a mix of quantitative and qualitative measures. The research population consisted of all bioinformatics research documents indexed in PubMed (n=699160). The correlations of bioinformatics articles were examined in terms of weight and strength based on article sections including title, abstract, keywords, journal title, and author affiliation using graph mining techniques and big data applications. Eventually, the prediction model of author collaboration in bioinformatics research was developed using the abovementioned tools and expert-assigned weights. The calculations and data analysis were carried out using Expert Choice, Excel, Spark, and Scala, and Python programming languages in a big data server. Accordingly, the research was conducted in three phases: 1) identifying and weighting the factors contributing to authors’ similarity measurement; 2) implementing co-authorship prediction model; and 3) integrating the first and second phases (i.e., integrating the weights obtained in the previous phases). The results showed that journal title, citation, article title, author affiliation, keywords, and abstract scored 0.374, 0.374, 0.091, 0.075, 0.055, and 0.031. Moreover, the journal title achieved the highest score in the model for the co-author recommender system. As the data in bibliometric information networks is static, it was proved remarkably effective to use content-based features for similarity measures. So that the recommender system can offer the most suitable collaboration suggestions. It is expected that the model works efficiently in other databases and provides suitable recommendations for author collaborations in other subject areas. By integrating expert opinion and systemic weights, the model can help alleviate the current information overload and facilitate collaborator lookup by authors.",
				"issue": "2",
				"language": "en",
				"libraryCatalog": "Ncpssd",
				"pages": "1-18",
				"publicationTitle": "International Journal of Information Science and Management (IJISM)",
				"volume": "19",
				"attachments": [],
				"tags": [
					{
						"tag": "Bibliographic Networks"
					},
					{
						"tag": "Co-author"
					},
					{
						"tag": "Graph Theory"
					},
					{
						"tag": "Network Analysis"
					},
					{
						"tag": "Recommender System"
					},
					{
						"tag": "Research collaboration"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
