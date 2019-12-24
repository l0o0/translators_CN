{
	"translatorID": "5c95b67b-41c5-4f55-b71a-48d5d7183063",
	"label": "CNKI",
	"creator": "Aurimas Vinckevicius, Xingzhong Lin",
	"target": "^https?://([^/]+\\.)?cnki\\.net",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2019-12-24 07:35:29"
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

// Fetches RefWorks records for provided IDs and calls onDataAvailable with resulting text
// ids should be in the form [{dbname: "CDFDLAST2013", filename: "1013102302.nh"}]
function getRefWorksByID(ids, onDataAvailable) {
	if (!ids.length) return;
	var { dbname, filename } = ids.shift();
	var postData = "formfilenames=" + encodeURIComponent(dbname + "!" + filename + "!1!0,")
		+ '&hid_kLogin_headerUrl=/KLogin/Request/GetKHeader.ashx%3Fcallback%3D%3F'
		+ '&hid_KLogin_FooterUrl=/KLogin/Request/GetKHeader.ashx%3Fcallback%3D%3F'
		+ '&CookieName=FileNameS';
	ZU.doPost('/kns/ViewPage/viewsave.aspx?displayMode=Refworks', postData,
		function (text) {
			var parser = new DOMParser();
			var html = parser.parseFromString(text, "text/html")
			var text = ZU.xpath(html, "//table[@class='mainTable']//td")[0].innerHTML;
			var text = text.replace(/<br>/g, '\n');
			text = text.replace(/^RT\s+Dissertation\/Thesis/gmi, 'RT Dissertation');
			text = text.replace(
				/^(A[1-4]|U2)\s*([^\r\n]+)/gm,
				function (m, tag, authors) {
					var authors = authors.split(/\s*[;，,]\s*/); //that's a special comma
					if (!authors[authors.length-1].trim()) authors.pop();
					return tag + ' ' + authors.join('\n' + tag + ' ');
				}
			);
			onDataAvailable(text);
			// If more results, keep going
			if (ids.length) {
				getRefWorksByID(ids, onDataAvailable);
			}
		}
	)
}

function getIDFromURL(url) {
	if (!url) return false;
	
	var dbname = url.match(/[?&]dbname=([^&#]*)/i);
	var filename = url.match(/[?&]filename=([^&#]*)/i);
	if (!dbname || !dbname[1] || !filename || !filename[1]) return false;
	
	return { dbname: dbname[1], filename: filename[1], url: url };
}


// 网络首发期刊信息并不能从URL获取dbname和filename信息
// Get dbname and filename from pre-released article web page.
function getIDFromRef(doc, url) {
	var func = ZU.xpath(doc, '//div[@class="link"]/a');
	if (!func.length) {
		return false;
	}
	func = func[0].getAttribute('onclick');
	var tmp = func.split(',')[1].split('!');
	// Z.debug(func + tmp[0].slice(1));
	return { dbname: tmp[0].slice(1), filename: tmp[1], url: url };
}

function getIDFromPage(doc, url) {
	return getIDFromURL(url)
		|| getIDFromURL(ZU.xpathText(doc, '//div[@class="zwjdown"]/a/@href'))
		|| getIDFromRef(doc, url);
}

function getTypeFromDBName(dbname) {
	var dbType = {
		CJFQ: "journalArticle",
		CJFD: "journalArticle",
		CAPJ: "journalArticle",
		CDFD: "thesis",
		CMFD: "thesis",
		CLKM: "thesis",
		CCND: "newspaperArticle",
		CPFD: "conferencePaper",
	};
	var db = dbname.substr(0, 4).toUpperCase();
	if (dbType[db]) {
		return dbType[db];
	} else {
		return false;
	}
}

function getItemsFromSearchResults(doc, url, itemInfo) {
	var iframe = doc.getElementById('iframeResult');
	if (iframe) {
		var innerDoc = iframe.contentDocument || iframe.contentWindow.document;
		if (innerDoc) {
			doc = innerDoc;
		}
	}
	
	var links = ZU.xpath(doc, '//tr[not(.//tr) and .//a[@class="fz14"]]');
	var aXpath = './/a[@class="fz14"]';
	if (!links.length) {
		links = ZU.xpath(doc, '//table[@class="GridTableContent"]/tbody/tr[./td[2]/a]');
		aXpath = './td[2]/a';
	}

	if (!links.length) {
		return false;
	} 
	var items = {};
	for (var i = 0, n = links.length; i < n; i++) {
		// Z.debug(links[i].innerHTML)
		var a = ZU.xpath(links[i], aXpath)[0];
		var title = ZU.xpathText(a, './node()[not(name()="SCRIPT")]', null, '');
		if (title) title = ZU.trimInternal(title);
		var id = getIDFromURL(a.href);
		// pre-released item can not get ID from URL, try to get ID from element.value
		if (!id) {
			var td1 = ZU.xpath(links[i], './td')[0];
			var tmp = td1.value.split('!');
			id = { dbname: tmp[0], filename: tmp[1], url: a.href };
		}
		// download link in search result
		var filelink = ZU.xpath(links[i], "./td[8]/a");
		var author = ZU.xpath(links[i], "./td[3]")[0].innerText.split(';')[0];
		if (!title || !id) continue;
		if (itemInfo) {
			var fatTitle = (title + "-" + author).replace(/\s/g, '');
			itemInfo[a.href] = { id: id };
			if (filelink.length) {
				var filelink = filelink[0].href;
				itemInfo[fatTitle] = filelink;
			}
		}
		var authors = ZU.xpath(links[i], "./td[3]")[0].innerText;
		var pub = ZU.xpath(links[i], "./td[4]")[0].innerText
		items[a.href] = title +"， " + authors + "《" + pub + "》";
	}
	return items;
}

function detectWeb(doc, url) {
	// Z.debug(doc);
	// Z.monitorDOMChanges(ZU.xpath(doc, "//div[@id='HeaderDiv']")[0]);
	var id = getIDFromPage(doc, url);
	if (id) {
		return getTypeFromDBName(id.dbname);
	} else if (url.match(/kns\/brief\/(default_)?result\.aspx/i)) {
		return "multiple";
	} else {
		return false;
	}
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		var itemInfo = {};
		var items = getItemsFromSearchResults(doc, url, itemInfo);
		Z.debug(itemInfo);
		if (!items) return false;  // no items
		Z.selectItems(items, function(selectedItems) {
			if (!selectedItems) return true;
			var ids = [];
			for (var url in selectedItems) {
				ids.push(itemInfo[url].id);
			}
			scrape(ids, doc, url, itemInfo);
		});
	} else {
		scrape([getIDFromPage(doc, url)], doc, url);
	}
}

function scrape(ids, doc, url, itemInfo) {
	getRefWorksByID(ids, function (text) {
		var translator = Z.loadTranslator('import');
		translator.setTranslator('1a3506da-a303-4b0a-a1cd-f216e6138d86'); // RefWorks Tagged
		text = text.replace(/IS (\d+)\nvo/, "IS $1\nVO");
		translator.setString(text);
		translator.setHandler('itemDone', function(obj, newItem) {
			// add PDF/CAJ attachments
			// var loginStatus = loginDetect(doc);
			var loginStatus = true;
			// If you want CAJ instead of PDF, set keepPDF = false
			// 如果你想将PDF文件替换为CAJ文件，将下面一行 keepPDF 设为 false
			var keepPDF = true;
			var fatTitle = (newItem.title + "-" + newItem.creators[0].lastName).replace(/\s/g, '');
			Z.debug(fatTitle);
			// Z.debug('loginStatus: '+loginStatus);
			if (itemInfo && loginStatus) { // search result 
				if (itemInfo[fatTitle].includes('&dflag=') && keepPDF) {
					// replace CAJ with PDF
					var fileUrl = itemInfo[fatTitle].replace('&dflag=nhdown', '&dflag=pdfdown');
				} else {
					var fileUrl = itemInfo[fatTitle] + "&dflag=pdfdown";
				} 
				newItem.attachments = [{
					title: "Full Text PDF",
					mimeType: "application/pdf",
					url: fileUrl
				}];
			} else if (loginStatus && (!itemInfo)) { // detail page
				newItem.attachments = getAttachments(doc, newItem, keepPDF);
			}
			// split names
			for (var i = 0, n = newItem.creators.length; i < n; i++) {
				var creator = newItem.creators[i];
				if (creator.firstName) continue;
				
				var lastSpace = creator.lastName.lastIndexOf(' ');
				if (creator.lastName.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
					// western name. split on last space
					creator.firstName = creator.lastName.substr(0,lastSpace);
					creator.lastName = creator.lastName.substr(lastSpace + 1);
				} else {
					// Chinese name. first character is last name, the rest are first name
					creator.firstName = creator.lastName.substr(1);
					creator.lastName = creator.lastName.charAt(0);
				}
			}
			
			// clean up tags. Remove numbers from end
			for (var j = 0, l = newItem.tags.length; j < l; j++) {
				newItem.tags[j] = newItem.tags[j].replace(/:\d+$/, '');
			}
			// url in search result is invalid
			if (!itemInfo) {
				newItem.url = url;
				var moreClick = ZU.xpath(doc, "//span/a[@id='ChDivSummaryMore']");
				if (moreClick.length) {
					moreClick[0].click();
					newItem.abstractNote = ZU.xpath(doc, "//span[@id='ChDivSummary']")[0].innerText;		
				}
			}
			if (newItem.abstractNote) {
				newItem.abstractNote = newItem.abstractNote.replace(/\s*[\r\n]\s*/g, '\n');
				// remove tag in abstract
				newItem.abstractNote = newItem.abstractNote.replace(/&lt;.*?&gt;/, "");
			}
			newItem.title = ZU.trimInternal(newItem.title);
			
			// CN 中国刊物编号，非refworks中的callNumber
			// CN in CNKI refworks format explains Chinese version of ISSN
			if (newItem.callNumber){
			//	newItem.extra = 'CN ' + newItem.callNumber;
				newItem.callNumber = "";
			}
			newItem.complete();
		});
		
		translator.translate();
	});
}

// get pdf download link
function getPDF(doc, itemType) {
	// retrieve PDF links from CNKI oversea
	if (itemType == 'thesis') {
		var pdf = ZU.xpath(doc, "//div[@id='DownLoadParts']/a[contains(text(), 'PDF')]");
	} else {
		var pdf = ZU.xpath(doc, "//a[@name='pdfDown']");
	}
	return pdf.length ? pdf[0].href : false;
}

// caj download link, default is the whole article for thesis.
function getCAJ(doc, itemType) {
	// //div[@id='DownLoadParts']
	if (itemType == 'thesis') {
		var caj = ZU.xpath(doc, "//div[@id='DownLoadParts']/a");
	} else {
		var caj = ZU.xpath(doc, "//a[@name='cajDown']");
	}
	return caj.length ? caj[0].href : false;
}

// add pdf or caj to attachments, default is pdf
function getAttachments(doc, item, keepPDF) {
	var attachments = [];
	var pdfurl = getPDF(doc, item.itemType);
	var cajurl = getCAJ(doc, item.itemType);
	if (keepPDF && item.itemType == "thesis") {
		pdfurl = cajurl.replace('&dflag=nhdown', '&dflag=pdfdown');
	}
	// Z.debug('pdf' + pdfurl);
	// Z.debug('caj' + cajurl);
	if (pdfurl) {
		attachments.push({
			title: "Full Text PDF",
			mimeType: "application/pdf",
			url: pdfurl
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


// detect login status
// loginState in search result, -1 means logout
function loginDetect(doc) {
	var loginUser = ZU.xpath(doc, "//input[(@id='loginuserid') or (@id='userid')]");
	if (loginUser.length && loginUser[0].value) {
		return true
	} else {
		return false
	}
} 
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFDLAST2015&filename=SPZZ201412003&v=MTU2MzMzcVRyV00xRnJDVVJMS2ZidVptRmkva1ZiL09OajNSZExHNEg5WE5yWTlGWjRSOGVYMUx1eFlTN0RoMVQ=",
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
				"issue": "12",
				"language": "中文;",
				"libraryCatalog": "CNKI",
				"pages": "1306-1312",
				"publicationTitle": "色谱",
				"url": "http://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CJFQ&dbname=CJFDLAST2015&filename=SPZZ201412003&v=MTU2MzMzcVRyV00xRnJDVVJMS2ZidVptRmkva1ZiL09OajNSZExHNEg5WE5yWTlGWjRSOGVYMUx1eFlTN0RoMVQ=",
				"volume": "32",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
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
					}
				],
				"date": "2015",
				"abstractNote": "黄瓜(Cucumis sativus L.)是我国最大的保护地栽培蔬菜作物,也是植物性别发育和维管束运输研究的重要模式植物。黄瓜基因组序列图谱已经构建完成,并且在此基础上又完成了全基因组SSR标记开发和涵盖330万个变异位点变异组图谱,成为黄瓜功能基因研究的重要平台和工具,相关转录组研究也有很多报道,不过共表达网络研究还是空白。本实验以温室型黄瓜9930为研究对象,选取10个不同组织,进行转录组测序,获得10份转录组原始数据。在对原始数据去除接头与低质量读段后,将高质量读段用Tophat2回贴到已经发表的栽培黄瓜基因组序列上。用Cufflinks对回贴后的数据计算FPKM值,获得10份组织的24274基因的表达量数据。计算结果中的回贴率比较理想,不过有些基因的表达量过低。为了防止表达量低的基因对结果的影响,将10份组织中表达量最大小于5的基因去除,得到16924个基因,进行下一步分析。共表达网络的构建过程是将上步获得的表达量数据,利用R语言中WGCNA(weighted gene co-expression network analysis)包构建共表达网络。结果得到的共表达网络包括1134个模块。这些模块中的基因表达模式类似,可以认为是共表达关系。不过结果中一些模块内基因间相关性同其他模块相比比较低,在分析过程中,将模块中基因相关性平均值低于0.9的模块都去除,最终得到839个模块,一共11,844个基因。共表达的基因因其表达模式类似而聚在一起,这些基因可能与10份组织存在特异性关联。为了计算模块与组织间的相关性,首先要对每个模块进行主成分分析(principle component analysis,PCA),获得特征基因(module eigengene,ME),特征基因可以表示这个模块所有基因共有的表达趋势。通过计算特征基因与组织间的相关性,从而挑选出组织特异性模块,这些模块一共有323个。利用topGO功能富集分析的结果表明这些特异性模块所富集的功能与组织相关。共表达基因在染色体上的物理位置经常是成簇分布的。按照基因间隔小于25kb为标准。分别对839个模块进行分析,结果发现在71个模块中共有220个cluster,这些cluster 一般有2～5个基因,cluster中的基因在功能上也表现出一定的联系。共表达基因可能受到相同的转录调控,这些基因在启动子前2kb可能会存在有相同的motif以供反式作用元件的结合起到调控作用。对839个模块中的基因,提取启动子前2kb的序列,上传到PLACE网站进行motif分析。显著性分析的结果表明一共有367个motif存在富集,其中6个motif已经证实在黄瓜属植物中发挥作用。最后结合已经发表的黄瓜苦味生物合成途径研究,找到了 3个模块,已经找到的11个基因中,有10个基因在这4个模块中。这些模块的功能富集也显示与苦味合成相关,同时这些参与合成的基因在染色体上也成簇分布。本论文所描述的方法结合了转录组测序与网络分析方法,发现了黄瓜中的共表达基因模块,为黄瓜基因的共表达分析提供了非常重要的研究基础和数据支持。",
				"language": "中文;",
				"libraryCatalog": "CNKI",
				"thesisType": "硕士",
				"university": "南京农业大学",
				"url": "https://kns.cnki.net/KCMS/detail/detail.aspx?dbcode=CMFD&dbname=CMFD201701&filename=1017045605.nh&v=MDc3ODZPZVorVnZGQ3ZrV3JyT1ZGMjZHYk84RzlmTXFwRWJQSVI4ZVgxTHV4WVM3RGgxVDNxVHJXTTFGckNVUkw=",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
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
		"url": "http://new.gb.oversea.cnki.net/KCMS/detail/detail.aspx?dbcode=CMFD&dbname=CMFDTEMP&filename=1019926131.nh&v=MTA5MjM2RjdxNkdORFBycEViUElSOGVYMUx1eFlTN0RoMVQzcVRyV00xRnJDVVJMT2VadVJxRnkzblY3dkJWRjI=",
		"items": [
			{
				"itemType": "thesis",
				"title": "商业银行个人住房不良资产证券化多元回归定价方法研究",
				"creators": [
					{
						"lastName": "张",
						"firstName": "雪",
						"creatorType": "author"
					}
				],
				"date": "2019",
				"abstractNote": "不良资产证券化是一种新型的不良资产处置方式,其拓宽了商业银行处理不良资产的手段,特别适用于单户金额小、户数多的个人不良资产批量处置,而且这种市场化处置方式将银行不良资产处置和资本市场证券产品发行两个不同领域联接在一起,提高了不良资产的价值。本文以个人住房不良资产证券化为研究对象,确定资产池内不良资产未来回收价值。综合对比市场常用的定价方法,在此基础上提出建立多元回归定价模型的思路。利用YN银行个人住房不良贷款历史数据,分析得出影响不良资产定价的因素,建立定价方程,并对拟证券化的虚拟资产池计算整体回收价值,证明多元回归定价模型的有效性。本文提出的定价模型规避了传统资产定价方法效率低、评估结果不严谨等缺点,采用数理统计的方法,借助分析软件,使定价结果更加科学、准确,为商业银行提供了定价的新途径,也以此为契机建议商业银行成立完备的不良资产处置数据系统,为高效开展资产证券化工作提供数据和技术支持。",
				"language": "中文;",
				"libraryCatalog": "CNKI",
				"thesisType": "硕士",
				"university": "浙江大学",
				"url": "http://new.gb.oversea.cnki.net/KCMS/detail/detail.aspx?dbcode=CMFD&dbname=CMFDTEMP&filename=1019926131.nh&v=MTA5MjM2RjdxNkdORFBycEViUElSOGVYMUx1eFlTN0RoMVQzcVRyV00xRnJDVVJMT2VadVJxRnkzblY3dkJWRjI=",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "Asset pool pricing"
					},
					{
						"tag": "Multiple regression pricing model"
					},
					{
						"tag": "Non-performing asset securitization"
					},
					{
						"tag": "Personal housing loan"
					},
					{
						"tag": "不良资产证券化"
					},
					{
						"tag": "个人住房贷款"
					},
					{
						"tag": "多元回归定价模型"
					},
					{
						"tag": "资产池定价"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
