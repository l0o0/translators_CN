{
	"translatorID": "5c95b67b-41c5-4f55-b71a-48d5d7183063",
	"label": "CNKI",
	"creator": "Aurimas Vinckevicius, Xingzhong Lin",
	"target": "https?://.*?/(kns8?/defaultresult/index|kns8?/AdvSearch|kcms/detail|KXReader/Detail\\?|KNavi/|Kreader/CatalogViewPage\\.aspx\\?|kcms2?/article/abstract\\?v=|kcms/doi/)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-03-10 14:41:03"
}

/*
	***** BEGIN LICENSE BLOCK *****
	CNKI(China National Knowledge Infrastructure) Translator
	Copyright © 2013 Aurimas Vinckevicius
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

// Target regex for default search, advance search, detail page and journal articles pages.
// Fetches RefWorks records for provided IDs and calls onDataAvailable with resulting text
// ids should be in the form [{dbname: "CDFDLAST2013", filename: "1013102302.nh"}]
function getRefWorksByID(ids, onDataAvailable) {
	if (!ids.length) return;
	var { dbname, filename, url } = ids.shift();
	let postData = "filename=" + filename + 
		"&displaymode=Refworks&orderparam=0&ordertype=desc&selectfield=&dbname=" + 
		dbname + "&random=0.2111567532240084";
	
	ZU.doPost('https://kns.cnki.net/KNS8/manage/ShowExport', postData,
		function (text) {
			let data = text
				.replace("<ul class='literature-list'><li>", "")
				.replace("<br></li></ul>", "")
				.replace("</li><li>", "") // divide results
				.replace(/<br>|\r/g, "\n")
				.replace(/vo (\d+)\n/, "VO $1\n") // Divide VO and IS to different line
				.replace(/IS 0(\d+)\n/g, "IS $1\n")  // Remove leading 0
				.replace(/VO 0(\d+)\n/g, "VO $1\n")
				.replace(/\n+/g, "\n")
				.replace(/\n([A-Z][A-Z1-9]\s)/g, "<br>$1")
				.replace(/\n/g, "")
				.replace(/<br>/g, "\n")
				.replace(/\t/g, "") // \t in abstract
				.replace(
					/^RT\s+Conference Proceeding/gim,
					"RT Conference Proceedings"
				)
				.replace(/^RT\s+Dissertation\/Thesis/gim, "RT Dissertation")
				.replace(/^(A[1-4]|U2)\s*([^\r\n]+)/gm, function (m, tag, authors) {
					authors = authors.split(/\s*[;，,]\s*/); // that's a special comma
					if (!authors[authors.length - 1].trim()) authors.pop();
					return tag + " " + authors.join("\n" + tag + " ");
				})
				.trim();
			// Z.debug(data);
			onDataAvailable(data, url);
			// If more results, keep going
			if (ids.length) {
				getRefWorksByID(ids, onDataAvailable);
			}
		}
	);
}


function getIDFromURL(url) {
	if (!url) return false;
	var dbname = url.match(/[?&](?:db|table)[nN]ame=([^&#]*)/i);
	var filename = url.match(/[?&]filename=([^&#]*)/i);
	var dbcode = url.match(/[?&]dbcode=([^&#]*)/i);
	if (
		!filename ||
		!filename[1] ||
		!dbcode ||
		!dbcode[1] ||
		!dbname ||
		!dbname[1]
	)
		return false;
	return { dbname: dbname[1], filename: filename[1], dbcode: dbcode[1], url: url };
}

// Get dbname and filename from pre-released article web page.
function getIDFromHeader(doc, url) {
	var dbname = ZU.xpath(doc, "//input[@id='paramdbname']");
	var dbcode = ZU.xpath(doc, "//input[@id='paramdbcode']");
	var filename = ZU.xpath(doc, "//input[@id='paramfilename']");
	if (
		filename.length +
		dbcode.length +
		dbname.length < 3
	) {
		return false;
	}
	return { dbname: dbname[0].value, filename: filename[0].value, dbcode: dbcode[0].value, url: url };
}

function getIDFromPage(doc, url) {
	return getIDFromHeader(doc, url)
		|| getIDFromURL(url)
		|| getIDFromURL(ZU.xpathText(doc, '//div[@class="zwjdown"]/a/@href'));
}

function getTypeFromDBName(id) {
	var dbType = {
		CJFQ: "journalArticle",
		CJFD: "journalArticle",
		CAPJ: "journalArticle",
		SJES: "journalArticle",
		SJPD: "journalArticle",
		SSJD: "journalArticle",
		CCJD: "journalArticle",
		CDMD: "journalArticle",
		CYFD: "journalArticle",
		CDFD: "thesis",
		CMFD: "thesis",
		CLKM: "thesis",
		CCND: "newspaperArticle",
		CPFD: "conferencePaper",
		IPFD: "conferencePaper",
		SCPD: "patent"
	};
	var db = id.dbname.substr(0, 4).toUpperCase();

	return dbType[db] || dbType[id.dbcode];


}

function getItemsFromSearchResults(doc, url, itemInfo) {
	var links, aXpath, fileXpath = '';
	if (url.includes('JournalDetail')) { // for journal detail page
		links = ZU.xpath(doc, "//dl[@id='CataLogContent']/dd");
		aXpath = "./span/a";
		fileXpath = "./ul/li/a";
	}
	else { // for search result page
		var result = doc.querySelector('table.result-table-list');
		links = doc.querySelectorAll("table.result-table-list tbody tr");
		aXpath = './td/a[@class="fz14"]';
		fileXpath = "./td[@class='operat']/a[contains(@class, 'downloadlink')]";
	}
	if (!links.length) {
		return false;
	}
	var items = {};
	for (var i = 0, n = links.length; i < n; i++) {
		// Z.debug(links[i].innerHTML)
		var a = ZU.xpath(links[i], aXpath)[0];
		var title = a.innerText;
		if (title) title = ZU.trimInternal(title);
		var id = getIDFromURL(a.href);
		var itemUrl = "";
		// Now can get db data from url in new version
		// English articles
		if (!id) {
			var td = ZU.xpath(links[i], "./td[@class='operat']/a");
			itemUrl = `https://kns.cnki.net/KCMS/detail/${a.href}`;
			id = {
				dbname: td[0].getAttribute("data-table"),
				filename: td[0].getAttribute("data-filename"),
				dbcode: td[1].getAttribute("data-dbname"),
				url: itemUrl
			};
		} else {
			itemUrl = `https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=${id.dbcode}&dbname=${id.dbname}&filename=${id.filename}&v=`;
			id.url = itemUrl;
		}
		// download link in search result
		var filelink = ZU.xpath(links[i], fileXpath);
		if (!title || !id) continue;
		if (itemInfo) {
			itemInfo[itemUrl] = { id: id };
			if (filelink.length) {
				filelink = filelink[0].href;
				itemInfo[itemUrl].filelink = filelink;
			}
			var cite = ZU.xpath(links[i], "./td[@class='quote']/span/a");
			cite = cite.length > 0 ? cite[0].innerText : "";
			itemInfo[itemUrl].cite = cite;
		}
		items[itemUrl] = links[i].innerText;
	}
	return items;
}

function detectWeb(doc, url) {
	// Z.debug(doc);
	var id = getIDFromPage(doc, url);
	Z.debug(id);
	if (id) {
		return getTypeFromDBName(id);
	}
	// Add new version kns8
	else if (
		url.match(/kns\/brief\/(default_)?result\.aspx/i)
		|| url.includes("/KNavi/") // Article list in Navigation page
		|| url.match(/kns8?\/defaultresult\/index/i) // search page
		|| url.match(/KNS8?\/AdvSearch\?/i)) {  // search page
		return "multiple";
	}
	else {
		return false;
	}
}

function doWeb(doc, url) {
	Z.debug("----------------CNKI 20221221---------------------");
	if (detectWeb(doc, url) == "multiple") {
		var itemInfo = {};
		var items = getItemsFromSearchResults(doc, url, itemInfo);
		// Z.debug(itemInfo);
		if (!items) return false;// no items
		Z.selectItems(items, function (selectedItems) {
			if (!selectedItems) return;
			var ids = [];
			for (var url in selectedItems) {
				ids.push(itemInfo[url].id);
			}
			scrape(ids, doc, itemInfo);
		});
	}
	else {
		scrape([getIDFromPage(doc, url)], doc);
	}
}

function scrape(ids, doc, itemInfo) {
	getRefWorksByID(ids, function (text, url) {
		var translator = Z.loadTranslator('import');
		translator.setTranslator('1a3506da-a303-4b0a-a1cd-f216e6138d86'); // RefWorks Tagged
		translator.setString(text);
		translator.setHandler('itemDone', function (obj, newItem) {
			// add PDF/CAJ attachments
			var cite = citeStr = pubType = pubTypeStr = "";
			// If you want CAJ instead of PDF, set keepPDF = false
			// 如果你想将PDF文件替换为CAJ文件，将下面一行 keepPDF 设为 false
			var keepPDF = Z.getHiddenPref('CNKIPDF');
			if (keepPDF === undefined) {
				keepPDF = true;
			}
			if (itemInfo) { // search page
				newItem.attachments = getAttachments(null, itemInfo[url].filelink, keepPDF);
				cite = itemInfo[url].cite;
			}
			else if (!itemInfo) { // detail page
				if (url.includes("KXReader/Detail")) {
					Z.debug("HTML text");
					newItem.attachments.push({
						title: "Snapshot",
						document: doc
					});
				} else {
					var pdfurl = getPDF(doc, newItem.itemType);
					var cajurl = getCAJ(doc, newItem.itemType);
					newItem.attachments = getAttachments(pdfurl, cajurl, keepPDF, url);
				}
				cite = doc.querySelector("span.num");
				cite = cite ? cite.innerText.split('\n')[0] : "";
				pubType = ZU.xpath(doc, "//div[@class='top-tip']//a[@class='type']");
				pubTypeStr = pubType.length > 0 ? "<" + pubType.map(ele => ele.innerText)
					.join(", ") + ">" : "";
				var doi = ZU.xpath(doc, "//*[contains(text(), 'DOI')]/parent::li | //div[@class='tips']"); // add DOI
				if (doi.length > 0 && doi[0].innerText.includes("DOI")) {
					var DOI = doi[0].innerText.split("DOI");
					newItem.DOI = DOI[DOI.length - 1].trim().replace(/[：:]/, '');
				}
				var moreClick = ZU.xpath(doc, "//span/a[@id='ChDivSummaryMore']");
				if (moreClick.length) {
					moreClick[0].click();// click to get a full abstract in a single article page
					newItem.abstractNote = ZU.xpath(doc, "//span[@id='ChDivSummary']")[0].innerText;
				}
			}
			newItem.attachments[0].referer = url;
			var timestamp = new Date().toLocaleDateString().replace(/\//g, '-');
			var citeStr = cite ? `${cite} citations(CNKI)[${timestamp}]` : "";
			newItem.extra = (citeStr + pubTypeStr).trim();
			// split names, Chinese name split depends on Zotero Connector preference translators.zhnamesplit
			var zhnamesplit = Z.getHiddenPref('zhnamesplit');
			if (zhnamesplit === undefined) {
				zhnamesplit = true;
			}
			for (var i = 0, n = newItem.creators.length; i < n; i++) {
				var creator = newItem.creators[i];
				if (newItem.itemType == 'thesis' && i != 0) {  // Except first author are Advisors in thesis
					creator.creatorType = 'contributor';  // Here is contributor
				}
				if (creator.firstName) continue;

				var lastSpace = creator.lastName.lastIndexOf(' ');
				if (creator.lastName.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
					// western name. split on last space
					creator.firstName = creator.lastName.substr(0, lastSpace);
					creator.lastName = creator.lastName.substr(lastSpace + 1);
				}
				else if (zhnamesplit) {
					// zhnamesplit is true, split firstname and lastname.
					// Chinese name. first character is last name, the rest are first name
					creator.firstName = creator.lastName.substr(1);
					creator.lastName = creator.lastName.charAt(0);
				}
			}

			// clean up tags. Remove numbers from end
			for (var j = 0, l = newItem.tags.length; j < l; j++) {
				newItem.tags[j] = newItem.tags[j].replace(/:\d+$/, '');
			}
			newItem.url = url;

			if (newItem.abstractNote) {
				newItem.abstractNote = newItem.abstractNote.replace(/\s*[\r\n]\s*/g, '\n')
					.replace(/&lt;.*?&gt;/g, "");
			}
			newItem.title = ZU.trimInternal(newItem.title);
			// CN 中国刊物编号，非refworks中的callNumber
			// CN in CNKI refworks format explains Chinese version of ISSN
			newItem.callNumber = null;
			newItem.complete();
		});

		translator.translate();
	});
}

// get pdf download link
function getPDF(doc, itemType) {
	// retrieve PDF links from CNKI oversea
	var pdf = '';
	if (itemType == 'thesis') {
		pdf = ZU.xpath(doc, "//div[@id='DownLoadParts']//a[contains(text(), 'PDF')]");
	}
	else {
		pdf = ZU.xpath(doc, "//a[@name='pdfDown']");
	}
	return pdf.length ? pdf[0].href : false;
}

// caj download link, default is the whole article for thesis.
function getCAJ(doc, itemType) {
	// //div[@id='DownLoadParts']
	var caj = ZU.xpath(doc, "//a[@name='cajDown']|//div[@id='downLoadFile']//a[@class='titleClass']");
	return caj.length ? caj[0].href : false;
}

// add pdf or caj to attachments, default is pdf
function getAttachments(pdfurl, cajurl, keepPDF, weburl) {
	var attachments = [];
	if (keepPDF && pdfurl) {
		attachments.push({
			title: "Full Text PDF",
			mimeType: "application/pdf",
			url: pdfurl
		});
	} else if (keepPDF && !cajurl.includes("bar.cnki.net")) {  //Can not download PDF when contains bar.cnki.net
		var url = cajurl.includes("&dflag=nhdown") ? cajurl.replace('&dflag=nhdown', '&dflag=pdfdown') : cajurl + '&dflag=pdfdown';
		attachments.push({
			title: "Full Text PDF",
			mimeType: "application/pdf",
			url: url
		});
	} else if (keepPDF && weburl && weburl.includes("kns.cnki.net/kcms/detail/detail.aspx?")) {  //使用海外版进行pdf下载
		var url = weburl.replace('kns.cnki.net/kcms/detail/detail.aspx?', 'chn.oversea.cnki.net/kns/download?');
		attachments.push({
			title: "Full Text PDF",
			mimeType: "application/pdf",
			url: url
		});
	} else if (cajurl) {
		attachments.push({
			title: "Full Text CAJ",
			mimeType: "application/caj",
			url: cajurl
		});
	}
	return attachments;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFDLAST2015&filename=SPZZ201412003&v=MTU2MzMzcVRyV00xRnJDVVJMS2ZidVptRmkva1ZiL09OajNSZExHNEg5WE5yWTlGWjRSOGVYMUx1eFlTN0RoMVQ=",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "基于部分酸水解-亲水作用色谱-质谱的黄芪多糖结构表征",
				"creators": [
					{
						"lastName": "梁",
						"firstName": "图",
						"creatorType": "author"
					},
					{
						"lastName": "傅",
						"firstName": "青",
						"creatorType": "author"
					},
					{
						"lastName": "辛",
						"firstName": "华夏",
						"creatorType": "author"
					},
					{
						"lastName": "李",
						"firstName": "芳冰",
						"creatorType": "author"
					},
					{
						"lastName": "金",
						"firstName": "郁",
						"creatorType": "author"
					},
					{
						"lastName": "梁",
						"firstName": "鑫淼",
						"creatorType": "author"
					}
				],
				"date": "2014",
				"ISSN": "1000-8713",
				"abstractNote": "来自中药的水溶性多糖具有广谱治疗和低毒性特点,是天然药物及保健品研发中的重要组成部分。针对中药多糖结构复杂、难以表征的问题,本文以中药黄芪中的多糖为研究对象,采用\"自下而上\"法完成对黄芪多糖的表征。首先使用部分酸水解方法水解黄芪多糖,分别考察了水解时间、酸浓度和温度的影响。在适宜条件(4 h、1.5mol/L三氟乙酸、80℃)下,黄芪多糖被水解为特征性的寡糖片段。接下来,采用亲水作用色谱与质谱联用对黄芪多糖部分酸水解产物进行分离和结构表征。结果表明,提取得到的黄芪多糖主要为1→4连接线性葡聚糖,水解得到聚合度4~11的葡寡糖。本研究对其他中药多糖的表征具有一定的示范作用。",
				"extra": "<北大核心, CSCD>",
				"issue": "12",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "1306-1312",
				"publicationTitle": "色谱",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFDLAST2015&filename=SPZZ201412003&v=MTU2MzMzcVRyV00xRnJDVVJMS2ZidVptRmkva1ZiL09OajNSZExHNEg5WE5yWTlGWjRSOGVYMUx1eFlTN0RoMVQ=",
				"volume": "32",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf",
						"referer": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFDLAST2015&filename=SPZZ201412003&v=MTU2MzMzcVRyV00xRnJDVVJMS2ZidVptRmkva1ZiL09OajNSZExHNEg5WE5yWTlGWjRSOGVYMUx1eFlTN0RoMVQ="
					}
				],
				"tags": [
					{
						"tag": "Astragalus"
					},
					{
						"tag": "characterization"
					},
					{
						"tag": "hydrophilic interaction liquid chromatography(HILIC)mass spectrometry(MS)"
					},
					{
						"tag": "partial acid hydrolysis"
					},
					{
						"tag": "polysaccharides"
					},
					{
						"tag": "亲水作用色谱"
					},
					{
						"tag": "多糖"
					},
					{
						"tag": "表征"
					},
					{
						"tag": "质谱"
					},
					{
						"tag": "部分酸水解"
					},
					{
						"tag": "黄芪"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CMFD&dbname=CMFD201701&filename=1017045605.nh&v=MDc3ODZPZVorVnZGQ3ZrV3JyT1ZGMjZHYk84RzlmTXFwRWJQSVI4ZVgxTHV4WVM3RGgxVDNxVHJXTTFGckNVUkw=",
		"items": [
			{
				"itemType": "thesis",
				"title": "黄瓜共表达基因模块的识别及其特点分析",
				"creators": [
					{
						"lastName": "林",
						"firstName": "行众",
						"creatorType": "author"
					},
					{
						"lastName": "黄",
						"firstName": "三文",
						"creatorType": "contributor"
					},
					{
						"lastName": "杨",
						"firstName": "清",
						"creatorType": "contributor"
					}
				],
				"date": "2015",
				"abstractNote": "黄瓜(Cucumis sativus L.)是我国最大的保护地栽培蔬菜作物,也是植物性别发育和维管束运输研究的重要模式植物。黄瓜基因组序列图谱已经构建完成,并且在此基础上又完成了全基因组SSR标记开发和涵盖330万个变异位点变异组图谱,成为黄瓜功能基因研究的重要平台和工具,相关转录组研究也有很多报道,不过共表达网络研究还是空白。本实验以温室型黄瓜9930为研究对象,选取10个不同组织,进行转录组测序,获得10份转录组原始数据。在对原始数据去除接头与低质量读段后,将高质量读段用Tophat2回贴到已经发表的栽培黄瓜基因组序列上。用Cufflinks对回贴后的数据计算FPKM值,获得10份组织的2...",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"thesisType": "硕士学位论文",
				"university": "南京农业大学",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CMFD&dbname=CMFD201701&filename=1017045605.nh&v=MDc3ODZPZVorVnZGQ3ZrV3JyT1ZGMjZHYk84RzlmTXFwRWJQSVI4ZVgxTHV4WVM3RGgxVDNxVHJXTTFGckNVUkw=",
				"attachments": [
					{
						"title": "Full Text CAJ",
						"mimeType": "application/caj",
						"referer": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CMFD&dbname=CMFD201701&filename=1017045605.nh&v=MDc3ODZPZVorVnZGQ3ZrV3JyT1ZGMjZHYk84RzlmTXFwRWJQSVI4ZVgxTHV4WVM3RGgxVDNxVHJXTTFGckNVUkw="
					}
				],
				"tags": [
					{
						"tag": "co-expression"
					},
					{
						"tag": "cucumber"
					},
					{
						"tag": "network"
					},
					{
						"tag": "transcriptome"
					},
					{
						"tag": "共表达"
					},
					{
						"tag": "网络"
					},
					{
						"tag": "转录组"
					},
					{
						"tag": "黄瓜"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CPFD&dbname=CPFD9908&filename=OYDD199010001004&v=MDI5NTRITnI0OUZaZXNQQ0JOS3VoZGhuajk4VG5qcXF4ZEVlTU9VS3JpZlplWnZGeW5tVTdqSkpWb1RLalRQYXJLeEY5",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "辽西区新石器时代考古学文化纵横",
				"creators": [
					{
						"lastName": "朱",
						"firstName": "延平",
						"creatorType": "author"
					}
				],
				"date": "1990",
				"abstractNote": "辽西区的范围从大兴安岭南缘到渤海北岸,西起燕山西段,东止辽河平原,基本上包括内蒙古的赤峰市(原昭乌达盟)、哲里木盟西半部,辽宁省西部和河北省的承德、唐山、廊坊及其邻近的北京、天津等地区。这一地区的古人类遗存自旧石器时代晚期起,就与同属东北的辽东区有着明显的不同,在后来的发展中,构成自具特色的一个考古学文化区,对我国东北部起过不可忽视的作用。以下就辽西地区新石器时代的考古学文化序列、编年、谱系及有关问题简要地谈一下自己的认识。",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "13-18",
				"proceedingsTitle": "内蒙古东部区考古学文化研究文集",
				"publisher": "中国社会科学院考古研究所、内蒙古文物考古研究所、赤峰市文化局",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CPFD&dbname=CPFD9908&filename=OYDD199010001004&v=MDI5NTRITnI0OUZaZXNQQ0JOS3VoZGhuajk4VG5qcXF4ZEVlTU9VS3JpZlplWnZGeW5tVTdqSkpWb1RLalRQYXJLeEY5",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf",
						"referer": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CPFD&dbname=CPFD9908&filename=OYDD199010001004&v=MDI5NTRITnI0OUZaZXNQQ0JOS3VoZGhuajk4VG5qcXF4ZEVlTU9VS3JpZlplWnZGeW5tVTdqSkpWb1RLalRQYXJLeEY5"
					}
				],
				"tags": [
					{
						"tag": "兴隆洼文化"
					},
					{
						"tag": "努鲁儿虎山"
					},
					{
						"tag": "半坡文化"
					},
					{
						"tag": "夹砂陶"
					},
					{
						"tag": "富河文化"
					},
					{
						"tag": "小河沿文化"
					},
					{
						"tag": "庙底沟文化"
					},
					{
						"tag": "彩陶花纹"
					},
					{
						"tag": "文化纵横"
					},
					{
						"tag": "新石器时代考古"
					},
					{
						"tag": "红山文化"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://chn.oversea.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFD&dbname=CJFDLAST2020&filename=ZGYK202012011&v=%25mmd2BHGGqe3MG%25mmd2FiWsTP5sBgemYG4X5LOYXSuyd0Rs%25mmd2FAl1mzrLs%25mmd2F7KNcFfXQMiFAipAgN",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "多芯片联合分析2型糖尿病发病相关基因及其与阿尔茨海默病的关系",
				"creators": [
					{
						"lastName": "辛",
						"firstName": "宁",
						"creatorType": "author"
					},
					{
						"lastName": "陈",
						"firstName": "建康",
						"creatorType": "author"
					},
					{
						"lastName": "陈",
						"firstName": "艳",
						"creatorType": "author"
					},
					{
						"lastName": "杨",
						"firstName": "洁",
						"creatorType": "author"
					}
				],
				"date": "2020",
				"ISSN": "0258-4646",
				"abstractNote": "目的利用生物信息学方法探索2型糖尿病发病的相关基因,并研究这些基因与阿尔茨海默病的关系。方法基因表达汇编(GEO)数据库下载GSE85192、GSE95849、GSE97760、GSE85426数据集,获得健康人和2型糖尿病患者外周血的差异基因,利用加权基因共表达网络(WGCNA)分析差异基因和临床性状的关系。使用DAVID数据库分析与2型糖尿病有关的差异基因的功能与相关通路,筛选关键蛋白。根据结果将Toll样受体4 (TLR4)作为关键基因,利用基因集富集分析(GSEA)分析GSE97760中与高表达TLR4基因相关的信号通路。通过GSE85426验证TLR4的表达量。结果富集分析显示,差异...",
				"extra": "3 citations(CNKI)[2022-10-11]<北大核心, CSCD>",
				"issue": "12",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "1106-1111+1117",
				"publicationTitle": "中国医科大学学报",
				"url": "https://chn.oversea.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFD&dbname=CJFDLAST2020&filename=ZGYK202012011&v=%25mmd2BHGGqe3MG%25mmd2FiWsTP5sBgemYG4X5LOYXSuyd0Rs%25mmd2FAl1mzrLs%25mmd2F7KNcFfXQMiFAipAgN",
				"volume": "49",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf",
						"referer": "https://chn.oversea.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFD&dbname=CJFDLAST2020&filename=ZGYK202012011&v=%25mmd2BHGGqe3MG%25mmd2FiWsTP5sBgemYG4X5LOYXSuyd0Rs%25mmd2FAl1mzrLs%25mmd2F7KNcFfXQMiFAipAgN"
					}
				],
				"tags": [
					{
						"tag": "2型糖尿病"
					},
					{
						"tag": "Alzheimer disease"
					},
					{
						"tag": "data mining"
					},
					{
						"tag": "gene chip"
					},
					{
						"tag": "islet inflammation"
					},
					{
						"tag": "type 2 diabetes"
					},
					{
						"tag": "基因芯片"
					},
					{
						"tag": "数据挖掘"
					},
					{
						"tag": "胰岛炎症反应"
					},
					{
						"tag": "阿尔茨海默病"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://t.cnki.net/kcms/article/abstract?v=7zUO4zIUaYCFYmofRdVaTccS6pQdozTC-dL0zYy_U5BuOnmujzA0Ctv9HaxYLNybybuKuIahaVhLLubCnEd36GhbDFWEhAQoEqKJRGoexyZgSy0rMOE4Rj6CrXMcnd8WqI3k6fX10AM=&uniplatform=NZKPT",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "压型钢板-聚氨酯夹芯楼板受弯性能研究",
				"creators": [
					{
						"lastName": "王",
						"firstName": "腾",
						"creatorType": "author"
					},
					{
						"lastName": "冯",
						"firstName": "会康",
						"creatorType": "author"
					},
					{
						"lastName": "乔",
						"firstName": "文涛",
						"creatorType": "author"
					},
					{
						"lastName": "苏",
						"firstName": "佶智",
						"creatorType": "author"
					},
					{
						"lastName": "王",
						"firstName": "丽欢",
						"creatorType": "author"
					}
				],
				"date": "2022",
				"DOI": "10.13206/j.gjgS22031502",
				"ISSN": "2096-6865",
				"abstractNote": "金属面夹芯板以其保温绝热、降噪、自重轻和装配效率高等优点在围护结构中得到了很好的应用，基于金属面夹芯板的构造，提出一种新型的压型钢板与聚氨酯组合的夹芯楼板结构。为了研究压型钢板-聚氨酯夹芯楼板的受弯性能，对夹芯楼板试件进行了两点对称静载试验。在试验的基础上，提出并验证了夹芯楼板有限元模型，并对槽钢楼板厚度、压型钢板厚度和聚氨酯密度等进行了参数分析。研究结果表明：夹芯楼板的破坏形式主要表现为挠度过大，最大挠度达到了板跨度的1/42,并且跨中截面处的槽钢出现畸变屈曲；夹芯楼板受弯变形后，槽钢首先达到屈服状态，而受压钢板的材料性能未能得到充分发挥；新型压型钢板聚氨酯夹芯楼板相比传统金属面夹芯板的承载...",
				"issue": "8",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "9-16",
				"publicationTitle": "钢结构(中英文)",
				"url": "https://t.cnki.net/kcms/article/abstract?v=7zUO4zIUaYCFYmofRdVaTccS6pQdozTC-dL0zYy_U5BuOnmujzA0Ctv9HaxYLNybybuKuIahaVhLLubCnEd36GhbDFWEhAQoEqKJRGoexyZgSy0rMOE4Rj6CrXMcnd8WqI3k6fX10AM=&uniplatform=NZKPT",
				"volume": "37",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf",
						"referer": "https://t.cnki.net/kcms/article/abstract?v=7zUO4zIUaYCFYmofRdVaTccS6pQdozTC-dL0zYy_U5BuOnmujzA0Ctv9HaxYLNybybuKuIahaVhLLubCnEd36GhbDFWEhAQoEqKJRGoexyZgSy0rMOE4Rj6CrXMcnd8WqI3k6fX10AM=&uniplatform=NZKPT"
					}
				],
				"tags": [
					{
						"tag": "finite element analysis"
					},
					{
						"tag": "flexural capacity"
					},
					{
						"tag": "profiled steel sheet"
					},
					{
						"tag": "sandwich slab"
					},
					{
						"tag": "static test"
					},
					{
						"tag": "压型钢板"
					},
					{
						"tag": "受弯性能"
					},
					{
						"tag": "夹芯楼板"
					},
					{
						"tag": "有限元分析"
					},
					{
						"tag": "静载试验"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://t.cnki.net/kcms/article/abstract?v=7zUO4zIUaYCFYmofRdVaTccS6pQdozTC-dL0zYy_U5BuOnmujzA0Ctv9HaxYLNybybuKuIahaVhLLubCnEd36GhbDFWEhAQoEqKJRGoexyZgSy0rMOE4Rj6CrXMcnd8WqI3k6fX10AM=&uniplatform=NZKPT",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "压型钢板-聚氨酯夹芯楼板受弯性能研究",
				"creators": [
					{
						"lastName": "王",
						"firstName": "腾",
						"creatorType": "author"
					},
					{
						"lastName": "冯",
						"firstName": "会康",
						"creatorType": "author"
					},
					{
						"lastName": "乔",
						"firstName": "文涛",
						"creatorType": "author"
					},
					{
						"lastName": "苏",
						"firstName": "佶智",
						"creatorType": "author"
					},
					{
						"lastName": "王",
						"firstName": "丽欢",
						"creatorType": "author"
					}
				],
				"date": "2022",
				"DOI": "10.13206/j.gjgS22031502",
				"ISSN": "2096-6865",
				"abstractNote": "金属面夹芯板以其保温绝热、降噪、自重轻和装配效率高等优点在围护结构中得到了很好的应用，基于金属面夹芯板的构造，提出一种新型的压型钢板与聚氨酯组合的夹芯楼板结构。为了研究压型钢板-聚氨酯夹芯楼板的受弯性能，对夹芯楼板试件进行了两点对称静载试验。在试验的基础上，提出并验证了夹芯楼板有限元模型，并对槽钢楼板厚度、压型钢板厚度和聚氨酯密度等进行了参数分析。研究结果表明：夹芯楼板的破坏形式主要表现为挠度过大，最大挠度达到了板跨度的1/42,并且跨中截面处的槽钢出现畸变屈曲；夹芯楼板受弯变形后，槽钢首先达到屈服状态，而受压钢板的材料性能未能得到充分发挥；新型压型钢板聚氨酯夹芯楼板相比传统金属面夹芯板的承载...",
				"issue": "8",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "9-16",
				"publicationTitle": "钢结构(中英文)",
				"url": "https://t.cnki.net/kcms/article/abstract?v=7zUO4zIUaYCFYmofRdVaTccS6pQdozTC-dL0zYy_U5BuOnmujzA0Ctv9HaxYLNybybuKuIahaVhLLubCnEd36GhbDFWEhAQoEqKJRGoexyZgSy0rMOE4Rj6CrXMcnd8WqI3k6fX10AM=&uniplatform=NZKPT",
				"volume": "37",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf",
						"referer": "https://t.cnki.net/kcms/article/abstract?v=7zUO4zIUaYCFYmofRdVaTccS6pQdozTC-dL0zYy_U5BuOnmujzA0Ctv9HaxYLNybybuKuIahaVhLLubCnEd36GhbDFWEhAQoEqKJRGoexyZgSy0rMOE4Rj6CrXMcnd8WqI3k6fX10AM=&uniplatform=NZKPT"
					}
				],
				"tags": [
					{
						"tag": "finite element analysis"
					},
					{
						"tag": "flexural capacity"
					},
					{
						"tag": "profiled steel sheet"
					},
					{
						"tag": "sandwich slab"
					},
					{
						"tag": "static test"
					},
					{
						"tag": "压型钢板"
					},
					{
						"tag": "受弯性能"
					},
					{
						"tag": "夹芯楼板"
					},
					{
						"tag": "有限元分析"
					},
					{
						"tag": "静载试验"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://t.cnki.net/kcms/article/abstract?v=7zUO4zIUaYCFYmofRdVaTccS6pQdozTC-dL0zYy_U5BuOnmujzA0Ctv9HaxYLNybybuKuIahaVhLLubCnEd36GhbDFWEhAQoEqKJRGoexyZgSy0rMOE4Rj6CrXMcnd8WqI3k6fX10AM=&uniplatform=NZKPT",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "压型钢板-聚氨酯夹芯楼板受弯性能研究",
				"creators": [
					{
						"lastName": "王",
						"firstName": "腾",
						"creatorType": "author"
					},
					{
						"lastName": "冯",
						"firstName": "会康",
						"creatorType": "author"
					},
					{
						"lastName": "乔",
						"firstName": "文涛",
						"creatorType": "author"
					},
					{
						"lastName": "苏",
						"firstName": "佶智",
						"creatorType": "author"
					},
					{
						"lastName": "王",
						"firstName": "丽欢",
						"creatorType": "author"
					}
				],
				"date": "2022",
				"DOI": "10.13206/j.gjgS22031502",
				"ISSN": "2096-6865",
				"abstractNote": "金属面夹芯板以其保温绝热、降噪、自重轻和装配效率高等优点在围护结构中得到了很好的应用，基于金属面夹芯板的构造，提出一种新型的压型钢板与聚氨酯组合的夹芯楼板结构。为了研究压型钢板-聚氨酯夹芯楼板的受弯性能，对夹芯楼板试件进行了两点对称静载试验。在试验的基础上，提出并验证了夹芯楼板有限元模型，并对槽钢楼板厚度、压型钢板厚度和聚氨酯密度等进行了参数分析。研究结果表明：夹芯楼板的破坏形式主要表现为挠度过大，最大挠度达到了板跨度的1/42,并且跨中截面处的槽钢出现畸变屈曲；夹芯楼板受弯变形后，槽钢首先达到屈服状态，而受压钢板的材料性能未能得到充分发挥；新型压型钢板聚氨酯夹芯楼板相比传统金属面夹芯板的承载能力和刚度有明显提升，承载力和刚度均提高203%;楼板厚度和压型钢板厚度对夹芯楼板的承载能力和刚度均具有显著影响，而楼板厚度相比压型钢板厚度对刚度的影响效果更明显，当楼板厚度从120 mm增大到160 mm时，夹芯楼板的承载力在正常使用状态下提高87%,在承载能力极限状态下提高63%,刚度提高88%,钢板厚度由1 mm增至3 mm时，夹芯楼板的承载力在正常使用状态下提高59%,在承载能力极限状态下提高84%,刚度提高61%;聚氨酯泡沫密度的变化对夹芯楼板的承载能力和刚度影响较小，当密度从45 kg/m~3变化到90 kg/m~3时，正常使用状态下夹芯楼板的承载力增幅为12%,承载能力极限状态下的承载力增幅仅为2%,刚度增幅为12%。",
				"issue": "8",
				"language": "zh-CN",
				"libraryCatalog": "CNKI",
				"pages": "9-16",
				"publicationTitle": "钢结构(中英文)",
				"url": "https://t.cnki.net/kcms/article/abstract?v=7zUO4zIUaYCFYmofRdVaTccS6pQdozTC-dL0zYy_U5BuOnmujzA0Ctv9HaxYLNybybuKuIahaVhLLubCnEd36GhbDFWEhAQoEqKJRGoexyZgSy0rMOE4Rj6CrXMcnd8WqI3k6fX10AM=&uniplatform=NZKPT",
				"volume": "37",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf",
						"referer": "https://t.cnki.net/kcms/article/abstract?v=7zUO4zIUaYCFYmofRdVaTccS6pQdozTC-dL0zYy_U5BuOnmujzA0Ctv9HaxYLNybybuKuIahaVhLLubCnEd36GhbDFWEhAQoEqKJRGoexyZgSy0rMOE4Rj6CrXMcnd8WqI3k6fX10AM=&uniplatform=NZKPT"
					}
				],
				"tags": [
					{
						"tag": "finite element analysis"
					},
					{
						"tag": "flexural capacity"
					},
					{
						"tag": "profiled steel sheet"
					},
					{
						"tag": "sandwich slab"
					},
					{
						"tag": "static test"
					},
					{
						"tag": "压型钢板"
					},
					{
						"tag": "受弯性能"
					},
					{
						"tag": "夹芯楼板"
					},
					{
						"tag": "有限元分析"
					},
					{
						"tag": "静载试验"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
