{
	"translatorID": "eb876bd2-644c-458e-8d05-bf54b10176f3",
	"label": "Wanfang Data",
	"creator": "Ace Strong <acestrong@gmail.com>, rnicrosoft",
	"target": "^https?://[a-z]+\\.wanfangdata\\.com\\.cn",
	"minVersion": "2.0rc1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2022-11-16 07:42:02"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Xingzhong Lin, https://github.com/Zotero-CN/translators_CN

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
var core = {
	PKU: "北大《中文核心期刊要目总览》",
	"北大核心": "北大《中文核心期刊要目总览》",
	ISTIC: "中国科技论文与引文数据库",
	CSSCI: "中文社会科学引文索引",
	NJU: "中文社会科学引文索引",
	CSTPCD: "中文社会科学引文索引",
	CSCD: "中国科学引文数据库",
	CASS: "《中国人文社会科学核心期刊要览》",
	AJ: "俄罗斯《文摘杂志》",
	CA: "美国《化学文摘》",
	EI: "美国《工程索引》",
	SCI: "美国《科学引文索引》",
	SCIE: "美国《科学引文索引(扩展版)》",
	"A&HCI": "《艺术与人文科学引文索引》",
	SSCI: "美国《社会科学引文索引》",
	CBST: "日本《科学技术文献速报》",
	SA: "英国《科学文摘》",
	GDZJ: "广电总局认定学术期刊"
};


var nodeFieldMapper = {
	"//div[contains(concat(' ', normalize-space(@class), ' '), ' author ')]": addCreators,
	"//div[contains(concat(' ', normalize-space(@class), ' '), ' detailOrganization ')]": "university",
	"//div[contains(concat(' ', normalize-space(@class), ' '), ' summary ')]": "abstractNote",
	"//div[contains(concat(' ', normalize-space(@class), ' '), ' keyword ')]": addTags,
	"//div[contains(concat(' ', normalize-space(@class), ' '), ' pages ')]": addPages,
	"//div[contains(concat(' ', normalize-space(@class), ' '), ' periodicalName ')]": "publicationTitle",
	"//div[contains(concat(' ', normalize-space(@class), ' '), ' publishData ')]": addDVI,
	"//div[contains(concat(' ', normalize-space(@class), ' '), ' coreContainer ')]": "extra",
	"//div[contains(concat(' ', normalize-space(@class), ' '), ' doiStyle ')]": "DOI",
	"//div[contains(concat(' ', normalize-space(@class), ' '), ' tutor ')]": addCreators,
	"//div[contains(@class, 'degree')]/div[@class='itemUrl']": "thesisType",
	"//div[contains(@class, 'thesisYear')]/div[@class='itemUrl']": "date",
	"//div[contains(@class, 'meetingDate')]/div[@class='itemUrl']": "date",
	"//div[contains(@class, 'meetingName')]/a": "conferenceName",
	"//div[contains(@class, 'mettingCorpus')]/div[@class='itemUrl']": "series",
	"//div[contains(@class, 'meetingArea')]/div[@class='itemUrl']": "palce",
	"//div[contains(@class, 'applicant')][2]": addCreators,
	"//div[contains(@class, 'agent')]": addCreators,
	"//div[contains(@class, 'applicationDate')][2]/div[@class='itemUrl']": 'issueDate',
	"//div[contains(@class, 'applicationDate')][1]/div[@class='itemUrl']": 'filingDate',
	"//div[contains(@class, 'patentCode')]/div[@class='itemUrl']": 'patentNumber',
	"//div[contains(@class, 'publicationNo')]/div[@class='itemUrl']": 'applicationNumber',
	"//div[contains(@class, 'applicantArea')]/div[@class='itemUrl']": 'country',
	"//div[contains(@class, 'applicant')][1]/div[@class='itemUrl']": 'issuingAuthority',
	"//div[contains(@class, 'signoryItem')][1]/div[@class='itemUrl']": '权力要求',
	"//div[contains(@class, 'standardId list')][1]/div[@class='itemUrl']": "code",
	"//div[contains(@class, 'draftsComp list')]": addCreators, // 购买后查看字段
	"//div[contains(@class, 'issueOrganization list')][1]/div[@class='itemUrl']": "rights", // 购买后查看字段
	"//div[contains(@class, 'applyDate list')][1]/div[@class='itemUrl']": "dateEnacted",
	"//div[contains(@class, 'status list')]": addExtra,
	"//div[contains(@class, 'isForce list')]": addExtra,
	"//div[contains(@class, 'applyDate list')]": addExtra,
	"//div[contains(@class, 'standardPageNum list')][1]/div[@class='itemUrl']": "pages",
	"//div[contains(@class, 'newStandard list')][1]/div[@class='itemUrl']": addHistory, // 购买后查看字段
};

var nodeFieldMapperForMed = {
	DOI: "DOI",
	"关键词": addTagsForMed,
	"主题词": addTagsForMed,
	"作者": addCreatorsForMed,
	"刊名": "publicationTitle",
	Journal: "journalAbbreviation",
	"年，卷(期)": addDVI,
	"页码": "pages",
	"作者单位": "extra",
	"基金项目": "extra",
	"在线出版日期": "extra",
	"学位年度": "date",
	"学位授予单位": "university",
	"授予学位": "thesisType",
	"会议地点": "place",
	"会议名称": "conferenceName",
	"母体文献": "series",
	"会议时间": "date",
	"国别省市代码": "country",
	"主申请人地址": "place",
	"发布时间": "extra",
	"期刊": addDVIForMed,
	"申请/专利号": "patentNumber",
	"公开/公告号": "applicationNumber",
	"申请/专利权人": "issuingAuthority",
};

function addField(newItem, field, value) {
	value = value.replace(/\s+/, " ");
	newItem[field] ? newItem[field] = newItem[field] + '\n' + value : newItem[field] = value;
}

function getTextPair(node) {
	return node.textContent.split(/：\s?/).map(e => e.trim());
}

// Get nest node text
function getText(node) {
	function recursor(n) {
		var i, a = [];
		if (n.nodeType !== 3) {
			if (n.childNodes)
				for (i = 0; i < n.childNodes.length; ++i)
					a = a.concat(recursor(n.childNodes[i]));
		} else
			if (n.data.trim()) a.push(n.data.trim());
		return a;
	}
	return recursor(node);
}


function addTagsForMed(newItem, node) {
	var temp = ZU.xpath(node, ".//a").map(e => ({ "tag": e.textContent.trim() }));
	newItem.tags = newItem.tags.concat(temp);
}

function addTags(newItem, tags) {
	newItem.tags = newItem.tags.concat(tags);
}

function addExtra(newItem, extra) {
	newItem.extra = (newItem.extra ? newItem.extra + "\n" : "") + extra[0].trim().replace(/[：:]$/, '') + ": " + extra.slice(1).join('; ');
}

function addDVI(newItem, texts) {
	newItem.date = texts[1];
	newItem.volume = texts[2].replace(",", "");
	newItem.issue = texts[3].replace(/[\(\)]/g, '');
}

function addDVIForMed(newItem, node) {
	var core = ZU.xpath(node, ".//span[@title]").map(e => e.title).join("\n");
	newItem.extra = (newItem.extra ? newItem.extra : "") + "\n" + core;
	if (node.querySelector("em")) newItem.pages = node.querySelector("em").textContent.replace("页", "").replace(",", "-");
	var matchRes = node.textContent.match(/《(.*?)》([0-9]*年)?([0-9]*卷)?([0-9]*期)?/);
	if (matchRes[1]) newItem.publicationTitle = matchRes[1];
	if (matchRes[2]) newItem.date = matchRes[2].replace("年", "");
	if (matchRes[3]) newItem.volume = matchRes[3].replace("卷", "");
	if (matchRes[4]) newItem.issue = matchRes[4].replace("期", "");
}

function addPages(newItem, pages) {
	pages = pages[pages.length - 1];
	pages = pages.replace(/[\(\)]/g, '');
	newItem.pages = pages;
}

function fixCreator(name) {
	name = name.trim();
	var zhnamesplit = Z.getHiddenPref('zhnamesplit') === undefined ? true : false;
	var creator = {};
	var lastSpace = name.lastIndexOf(',');
	if (name.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
		// western name. split on last space
		creator.firstName = name.substr(0, lastSpace);
		creator.lastName = name.substr(lastSpace + 1);
	} else if (zhnamesplit) {
		// zhnamesplit is true, split firstname and lastname.
		// Chinese name. first character is last name, the rest are first name
		creator.firstName = name.substr(1);
		creator.lastName = name.charAt(0);
	}
	return creator;
}

function addCreatorsForMed(newItem, node) {
	for (let name of getTextPair(node)[1].split(/\s{2,}|%|;/)) {
		if (name.includes("[")) continue;
		var creator = fixCreator(name);
		if (getTextPair(node)[0].includes("导师")) {
			creator.creatorType = "contributor"
		} else if (getTextPair(node)[0].includes("发明")) {
			creator.creatorType = "inventor";
		} else if (getTextPair(node)[0].includes("代理人")) {
			creator.creatorType = "attorneyAgent";
		} else {
			creator.creatorType = "author";
		}
		newItem.creators.push(creator);
	}
}

var creatorTypeMap = {
	"导师姓名：": "contributor",
	"发明/设计人：": "inventor",
	"代理人：": "attorneyAgent"
}

function addCreators(newItem, creators) {
	var creatorType = "author";
	var isComp = false;
	for (let name of creators) {
		if (/^\d+$/.test(name)) continue;
		if (name in creatorTypeMap) {
			creatorType = creatorTypeMap[name];
			continue;
		}
		if (name.includes("单位")) {
			isComp = true;
			continue;
		}
		if (name.includes("[")) continue;
		var creator = fixCreator(name);
		if (isComp) {
			creator.lastName = name.trim();
			delete creator.firstName;
			creator.fieldMode = 1;
		}
		creator.creatorType = creatorType;
		newItem.creators.push(creator);
	}
}

function addHistory(newItem, history) {
	history.map(ele => ele.replace(/;$/, ''));
	addField(newItem, "history", history.slice(1).join('; '));
}


function scrape(doc) {
	Z.debug("---------------WanFang Data 20221116---------------");
	var id = getIDFromPage(doc) || getIDFromURL(doc.URL);
	var newItem = new Zotero.Item(id.dbname);
	newItem.title = doc.title.replace("-论文-万方医学网", "");

	// Display full abstract
	var clickMore = ZU.xpath(doc, "//span[@class='getMore' or text()='更多']");
	if (clickMore.length > 0) clickMore[0].click();
	if (doc.URL.includes("med.wanfangdata.com.cn")) { // 万方医学
		newItem.abstractNote = doc.querySelector("meta[name='description']").content;
		var nodes = doc.querySelectorAll("div.detailList div");
		if (nodes.length == 0) nodes = doc.querySelectorAll("div.table-tr"); // Medical
		for (let node of nodes) {
			var nodeTextPair = getTextPair(node);
			// Z.debug(nodeTextPair);
			if (nodeTextPair[0].trim() in nodeFieldMapperForMed) {
				typeof nodeFieldMapperForMed[nodeTextPair[0]] == "string"
					? addField(newItem, nodeFieldMapperForMed[nodeTextPair[0]], nodeTextPair[1].trim())
					: nodeFieldMapperForMed[nodeTextPair[0]](newItem, node) // 调用函数处理
			}
		}
	} else { // 万方数据
		for (let [k, v] of Object.entries(nodeFieldMapper)) {
			var foundNodes = ZU.xpath(doc, k);
			if (foundNodes.length == 0) continue;
			var texts = getText(foundNodes[0]);
			typeof v == 'string'
				? addField(newItem, v, texts.join('; '))
				: v(newItem, texts);
		}
	}
	if (doc.URL.includes("wanfangdata.com.cn/standard/")) {
		addExtra(newItem, ["Type", "standard"]); // https://forums.zotero.org/discussion/comment/409058/#Comment_409058
	}
	newItem.language = 'zh-CN';
	if (newItem.abstractNote) newItem.abstractNote = newItem.abstractNote.replace(/^摘要：;/, "");
	if (newItem.DOI) newItem.DOI = newItem.DOI.replace(/^DOI: /, "");
	if (newItem.itemType != 'thesis' && newItem.university) {
		newItem.extra ? newItem.extra = newItem.extra + "\n地点：" + newItem.university
			: newItem.extra = "地点：" + newItem.university;
		newItem.university = "";
	}

	newItem.url = doc.URL;
	var pdflink = getPDF(newItem, doc);
	// Z.debug(pdflink);
	if (pdflink) {
		newItem.attachments.push({
			url: pdflink,
			title: "Full Text PDF",
			mimeType: "application/pdf"
		})
	}
	newItem.complete();
}


// Get file name and database name.
function getIDFromURL(url) {
	if (!url) return false;
	var tmp, dbname, filename;
	if (url.includes("Detail?id")) {  // For medical
		tmp = url.match(/Detail\?id=(\w+)_(\w+)/)
	} else {
		tmp = url.match(/\/(\w+)[\/_]([0-9a-zA-Z%\-]+)$/);
	}
	if (!tmp) return false;
	dbname = tmp[1];
	filename = tmp[2]
	if (!getTypeFromDBName(dbname)) {
		// http://med.wanfangdata.com.cn/
		tmp = url.match(/id=(\w+)Paper_([0-9a-z]+)&/);
		dbname = tmp[1].toLowerCase();
		filename = tmp[2];
	}
	if (dbname) {
		return {
			dbname: getTypeFromDBName(dbname),
			filename: filename, url: url
		};
	} else {
		return false;
	}
}

// Get ID from page
function getIDFromPage(doc, url) {
	var ele = doc.querySelector("a.download") || doc.querySelector("span.title-id-hidden");
	if (ele === null) return false;
	var hiddenId = ele.getAttribute('href') || ele.innerText;
	var tmp = hiddenId.match(/(\w+)_([^.]+)/);
	if (tmp === null) return false;
	return {
		dbname: getTypeFromDBName(tmp[1]),
		filename: decodeURI(tmp[2]), url: url || `https://d.wanfangdata.com.cn/${hiddenId.replace("_", "/")}`
	}
}

// database and item type match
function getTypeFromDBName(db) {
	var dbType = {
		periodical: "journalArticle",
		perio: "journalArticle",
		thesis: "thesis",
		// claw: "statute",
		conference: "conferencePaper",
		patent: "patent",
		// nstr: "report",
		perio: "journalArticle",
		degree: "thesis",
		// tech: "report"
		PeriodicalPaper: "journalArticle",  // For med
		DegreePaper: "thesis",
		ConferencePaper: "conferencePaper",
		standard: "statute",
		Standard: "statute",
	};
	if (db) {
		return dbType[db];
	} else {
		return false;
	}
}


function detectWeb(doc, url) {
	if (url.includes("?q=") || url.includes("/advanced-search/")) return "multiple";
	var id = getIDFromPage(doc) || getIDFromURL(url);
	Z.debug(id);
	if (id) {
		return id.dbname;
	} else {
		return false;
	}
}

function getSearchResults(doc, itemInfo) {
	var items = {};
	var found = false;
	var rows = ZU.xpath(doc, "//div[@class='normal-list']");
	if (!rows.length > 0) rows = doc.querySelectorAll("div.mod-results-list div.item");
	var idx = 1
	for (let row of rows) {
		var title = ZU.xpath(row, ".//span[@class='title'] | .//div[@class='item-title']/a")[0];
		var id = title.getAttribute("href") ? getIDFromURL(title.href) : getIDFromPage(row);
		// Z.debug(id);
		items[id.url] = idx + " " + title.innerText;
		// var id = getIDFromURL(href);
		// Z.debug(id);
		itemInfo[id.url] = id;
		idx += 1
	}
	// Z.debug(itemInfo);
	return items;
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		var itemInfo = {};
		var items = getSearchResults(doc, itemInfo);
		Z.selectItems(items, function (selectedItems) {
			if (selectedItems) ZU.processDocuments(Object.keys(selectedItems), scrape);
		});
	} else {
		scrape(doc);
	}
}

function getPDF(newItem, doc) {
	var ele = doc.querySelector("a.download") || doc.querySelector("span.title-id-hidden");
	if (ele === null) return false;
	var hiddenId = ele.getAttribute('href') || ele.innerText;
	var tmp = hiddenId.match(/(\w+)_([^.]+)/);
	if (tmp === null) return false;
	// Z.debug(tmp)
	return "https://oss.wanfangdata.com.cn/www/" + encodeURIComponent(doc.title) + ".ashx?isread=true&type=" + tmp[1] + "&resourceId=" + encodeURI(decodeURIComponent(tmp[2]));
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/periodical/hgxb2019z1002",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "微波法制备生物柴油研究进展",
				"creators": [
					{
						"lastName": "商",
						"creatorType": "author",
						"firstName": "辉"
					},
					{
						"lastName": "丁",
						"creatorType": "author",
						"firstName": "禹"
					},
					{
						"lastName": "张",
						"creatorType": "author",
						"firstName": "文慧"
					}
				],
				"date": "2019-01-01 00:00:00",
				"DOI": "10.11949/j.issn.0438?1157.20181400",
				"ISSN": "0438-1157",
				"abstractNote": "基于微波的选择性、瞬时性及体积性加热的特点,可以有效提高反应分子的平均能量、分子的碰撞频率,加快反应速率,采用微波辅助催化酯交换反应制备生物柴油近几年得到了国内外学者的广泛关注.将微波能应用于生物柴油制备过程具有显著的优势,与传统加热方式相比,采用微波辐射加热,反应时间明显缩短,产物组成也有所变化.因此主要从酸碱催化剂催化酯交换反应和酯化反应的角度,综述了国内外对微波辅助生物柴油制备的研究进展,并对微波优势及未来发展趋势进行了展望.",
				"extra": "<北大《中文核心期刊要目总览》, 中国科技论文与引文数据库, 美国《工程索引》>",
				"issue": "z1",
				"language": "zh-CN",
				"libraryCatalog": "Wanfang Data",
				"pages": "15-22",
				"publicationTitle": "化工学报",
				"url": "https://d.wanfangdata.com.cn/periodical/hgxb2019z1002",
				"volume": "70",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "催化剂"
					},
					{
						"tag": "微波"
					},
					{
						"tag": "生物柴油"
					},
					{
						"tag": "酯交换"
					},
					{
						"tag": "酯化"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/thesis/D01698671",
		"items": [
			{
				"itemType": "thesis",
				"title": "济南市生物多样性评价及与生物入侵关系研究",
				"creators": [
					{
						"lastName": "孟",
						"creatorType": "author",
						"firstName": "令玉"
					},
					{
						"lastName": "曲",
						"creatorType": "contributor",
						"firstName": "爱军"
					}
				],
				"date": "2019-06-06 00:00:00",
				"abstractNote": "生物多样性是我国生态环境的重要组成部分，也是生态文明建设的重要内容。如何更合理的建立评价生物多样性体系及确定威胁生物多样性相关因素，对政府科学制定生物多样性保护战略规划及行动计划极其重要，对生态文明建设具有重要意义。同时，生物多样性是一种资源，是生物资源的基础，具有多种多样的生态和环境服务功能。　　通过济南市生物多样性现状评价，可明确济南市生物多样性现状、威胁因素和保护现状，有助于济南市资源有效利用与保护，以及相关政府部门科学的制定生物多样性保护战略与具体行动计划。本研究依据环保部生物多样性省域评价体系，组建了暖温带生物多样性评价体系，并依据该两种体系对济南市生物多样性进行了系统评价，并根据评估情况提出了相应建议，评估结果如下：　　1、依据省域生物多样性评价体系评估结果表明，济南市生物多样性处于中等水平，分值为2.9591。其中，植物和动物多样性均处于省内较高水平，分值分别为4.83和4.3908，森林生态系统多样性处于省内中游水平，分值为3.0078，微生物多样性和湿地生态系统多样性处于较差水平，分值分别为1和1.3737；威胁最为严重的是外来物种入侵程度（1.6680），其次为环境污染程度（2.2651）、野生资源的过度利用程度（2.7125）和自然生境破坏程度（3.1427）；迁地保护水平、生境恢复和改善水平处于省内较高水平，分值分别为4和4.3329，自然保护区建设管理较差。　　2、本文首次建立了暖温带评价体系，依据该评价体系，在我国暖温带区域内，济南市生物多样性处于较差水平，分值为2.1640。其中动物多样性均处于暖温带较高水平，分值为4.125，植物多样性、森林生态系统多样性处于省内中游水平，分值分别为2.9488和2.9015，微生物多样性和湿地生态系统多样性处于较差水平，分值分别为1分和1.3098；威胁最为严重的是野生资源的过度利用程度（0.5000），其次为环境污染程度（1.1430）、外来物种入侵程度（1.6680）和自然生境破坏程度（1.8255）。迁地保护水平处于暖温带内较高水平，分值为4，自然保护区建设管理，生境恢复和改善水平较差，类似于省内评价结果。　　3、济南市外来入侵物种共19种，外来入侵物种种类比为1.04%，分布较为广泛，济南市几乎全部区域均受到外来物种的影响。其中对济南市生物多样性威胁最为严重的是美国白蛾（Hyphantria cunea）等昆虫，除生物入侵外，环境污染和野生资源过度利用也对济南市生物多样性造成一定影响。　　本文依据的省域和新组建的生物多样性评价指标体系可为其他地区的生物多样评价提供参考，为济南市生物多样性保护工作方向提供依据，为生物入侵管理和济南市生物资源利用奠定基础。",
				"language": "zh-CN",
				"libraryCatalog": "Wanfang Data",
				"thesisType": "硕士",
				"university": "山东农业大学",
				"url": "https://d.wanfangdata.com.cn/thesis/D01698671",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "外来入侵物种"
					},
					{
						"tag": "外来物种入侵"
					},
					{
						"tag": "微生物多样性"
					},
					{
						"tag": "暖温带"
					},
					{
						"tag": "济南市"
					},
					{
						"tag": "生态文明建设"
					},
					{
						"tag": "生态系统多样性"
					},
					{
						"tag": "生物入侵"
					},
					{
						"tag": "生物多样性保护"
					},
					{
						"tag": "生物多样性评价"
					},
					{
						"tag": "评价体系"
					},
					{
						"tag": "野生资源"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/conference/9534067",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "生物发酵提高芦笋汁生物利用率研究",
				"creators": [
					{
						"lastName": "吴",
						"creatorType": "author",
						"firstName": "晓春"
					},
					{
						"lastName": "黄",
						"creatorType": "author",
						"firstName": "惠华"
					}
				],
				"date": "20181204",
				"abstractNote": "本研究在单因素试验的基础上通过响应面法优化安琪酵母发酵芦笋汁生产工艺,以芦笋汁中总皂苷元含量作为响应值,各影响因素为自变量,设计响应面实验方案.结果表明一次项X1(接种量)、X2(发酵温度)、X3(发酵时间)和所有因素的二次项都达到了极显著水平(P<0.01).并得到安琪酵母发酵芦笋汁的最优生产工艺条件:利用R2A琼脂作为基础培养基接种量0.2％、发酵温度30℃、发酵时间7天.在此条件下重复实验3次,整理结果可知芦笋总皂苷元含量可达到(361.68±8.62)μg.",
				"conferenceName": "2018年广东省食品学会年会",
				"language": "zh-CN",
				"libraryCatalog": "Wanfang Data",
				"pages": "69-74",
				"place": "广州",
				"proceedingsTitle": "2018年广东省食品学会年会论文集",
				"publisher": "广东省食品学会",
				"url": "https://d.wanfangdata.com.cn/conference/9534067",
				"attachments": [],
				"tags": [
					{
						"tag": "发酵时间"
					},
					{
						"tag": "发酵温度"
					},
					{
						"tag": "响应面法"
					},
					{
						"tag": "生产工艺"
					},
					{
						"tag": "生物发酵"
					},
					{
						"tag": "芦笋汁"
					},
					{
						"tag": "苷元含量"
					},
					{
						"tag": "酵母发酵"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/patent/CN201880013080.0",
		"items": [
			{
				"itemType": "patent",
				"title": "生物体签名系统及生物体签名方法",
				"creators": [
					{
						"lastName": "加",
						"creatorType": "inventor",
						"firstName": "贺阳介"
					},
					{
						"lastName": "高",
						"creatorType": "inventor",
						"firstName": "桥健太"
					},
					{
						"lastName": "藤",
						"creatorType": "inventor",
						"firstName": "尾正和"
					},
					{
						"lastName": "陈",
						"creatorType": "attorneyAgent",
						"firstName": "伟"
					},
					{
						"lastName": "沈",
						"creatorType": "attorneyAgent",
						"firstName": "静"
					}
				],
				"issueDate": "2019-10-11 00:00:00",
				"abstractNote": "生物体签名系统保持将从用户的部位得到的第一生物体信息转换而得到的第一模板和通过单向性转换将从该用户的该部位得到的第二生物体信息进行转换而得到的第二模板，根据认证对象的第一生物体信息生成第一模板，对使用参数修正后的认证对象的第一模板与生物体签名系统保持的第一模板之间的相似度高的该参数进行特定，分别根据分别使用包括该特定出的参数在内的规定范围所包括的参数修正后的认证对象的第二生物体信息，生成第二模板，并将该生成的第二模板分别与生物体签名系统保持的第二模板进行比较来判定认证对象的认证成功与否。",
				"applicationNumber": "CN110326254A",
				"country": "CN",
				"filingDate": "2018-02-14 00:00:00",
				"issuingAuthority": "株式会社日立制作所",
				"language": "zh-CN",
				"legalStatus": "在审",
				"patentNumber": "CN201880013080.0",
				"place": "日本;JP",
				"rights": "1.一种生物体签名系统，其特征在于， 包括处理器和存储器， 所述存储器保持第一模板和第二模板，该第一模板表示通过规定的转换将从用户的规定部位得到的第一生物体信息进行转换后的结果，该第二模板表示通过规定的单向性转换将从所述用户的所述规定部位得到的第二生物体信息进行转换后的结果， 所述处理器进行以下处理： 获取认证对象的所述第一生物体信息和所述第二生物体信息， 根据获取到的所述第一生物体信息生成所述认证对象的第一模板， 对使用参数修正后的所述认证对象的第一模板与所述存储器保持的第一模板之间的相似度比规定条件高的所述参数进行特定， 分别使用包括特定出的所述参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息， 分别根据修正后的所述第二生物体信息生成所述认证对象的第二模板， 将生成的所述第二模板分别与所述存储器保持的第二模板进行比较来判定所述认证对象的认证成功与否。 2.根据权利要求1所述的生物体签名系统，其特征在于， 所述处理器通过所述规定的转换对获取到的所述第一生物体信息进行转换而生成所述认证对象的第一模板。 3.根据权利要求1所述的生物体签名系统，其特征在于， 所述处理器通过所述规定的单向性转换对修正后的所述第二生物体信息分别进行转换而生成所述认证对象的第二模板。 4.根据权利要求1所述的生物体签名系统，其特征在于， 储存于所述存储器内的第一生物体信息与第二生物体信息的相关系数为规定值以下。 5.根据权利要求1所述的生物体签名系统，其特征在于， 所述参数包括所述第一模板及所述第二模板的修正中的、表示平行移动量的参数和表示旋转量的参数。 6.根据权利要求1所述的生物体签名系统，其特征在于， 所述存储器保持多个用户的第一模板和第二模板， 所述处理器进行以下处理： 对与所述存储器保持的多个第一模板中的、存在所述相似度比规定条件高的所述参数的第一模板对应的用户群进行特定， 关于特定出的所述用户群的每个用户，分别使用包括特定出的参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息并生成第二模板，并且将该生成的第二模板分别与该用户的第二模板进行比较， 基于分别针对特定出的所述用户群的比较结果来判定所述认证对象的认证成功与否。 7.一种生物体签名方法，由生物体签名系统进行生物体签名，其特征在于， 所述生物体签名系统保持第一模板和第二模板，该第一模板表示通过规定的转换将从用户的规定部位得到的第一生物体信息进行转换后的结果，该第二模板表示通过规定的单向性转换将从所述用户的所述规定部位得到的第二生物体信息进行转换后的结果， 在所述方法中，所述生物体签名系统进行以下处理： 获取认证对象的所述第一生物体信息和所述第二生物体信息， 根据获取到的所述第一生物体信息生成所述认证对象的第一模板， 对使用参数修正后的所述认证对象的第一模板与所述生物体签名系统保持的第一模板之间的相似度比规定条件高的所述参数进行特定， 分别使用包括特定出的所述参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息， 分别从修正后的所述第二生物体信息生成所述认证对象的第二模板， 将生成的所述第二模板分别与所述生物体签名系统保持的第二模板进行比较来判定所述认证对象的认证成功与否。 8.根据权利要求7所述的方法，其特征在于， 在所述方法中，所述生物体签名系统通过所述规定的转换对获取到的所述第一生物体信息进行转换而生成所述认证对象的第一模板。 9.根据权利要求7所述的方法，其特征在于， 在所述方法中，所述生物体签名系统通过所述规定的单向性转换对修正后的所述第二生物体信息分别进行转换而生成所述认证对象的第二模板。 10.根据权利要求7所述的方法，其特征在于， 储存于所述生物体签名系统内的第一生物体信息与第二生物体信息的相关系数为规定值以下。 11.根据权利要求7所述的方法，其特征在于， 所述参数包括所述第一模板及所述第二模板的修正中的、表示平行移动量的参数和表示旋转量的参数。 12.根据权利要求7所述的方法，其特征在于， 所述生物体签名系统保持多个用户的第一模板和第二模板， 在所述方法中，所述生物体签名系统进行以下处理： 对与所述生物体签名系统保持的多个第一模板中的、存在所述相似度比规定条件高的所述参数的第一模板对应的用户群进行特定， 关于特定出的所述用户群的每个用户，分别使用包括特定出的参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息并生成第二模板，并且将该生成的第二模板分别与该用户的第二模板进行比较， 基于分别针对特定出的所述用户群的比较结果来判定所述认证对象的认证成功与否。",
				"url": "https://d.wanfangdata.com.cn/patent/CN201880013080.0",
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
		"url": "http://med.wanfangdata.com.cn/Paper/Detail?id=PeriodicalPaper_zhyfyx200202011&dbid=WF_QK",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "SF-36健康调查量表中文版的研制及其性能测试",
				"creators": [
					{
						"lastName": "李",
						"creatorType": "author",
						"firstName": "鲁"
					},
					{
						"lastName": "王",
						"creatorType": "author",
						"firstName": "红妹"
					},
					{
						"lastName": "沈",
						"creatorType": "author",
						"firstName": "毅"
					}
				],
				"date": "2002-01-01 00:00:00",
				"DOI": "10.3760/j:issn:0253-9624.2002.02.011",
				"ISSN": "0253-9624",
				"abstractNote": "目的研制SF-36健康调查量表中文版并验证量表维度建立及记分假设、信度和效度.方法采用多阶段混合型等概率抽样法,用SF-36健康调查量表中文版对1 000户家庭的居民进行自评量表式调查;参照国际生命质量评价项目的标准程序,进行正式的心理测验学试验.结果在收回的1 985份问卷中,18岁以上的有效问卷1 972份,其中应答者1 688人(85.6%),1 316人回答了所有条目,372人有1个或以上的缺失答案,无应答者中文盲、半文盲占65.5%.等距假设在活力(VT)和精神健康(MH)维度被打破了,按重编码后值计算维度分数;条目集群的分布接近源量表及其他2个中文译本;除了生理功能(PF)、躯体疼痛(BP)、社会功能(SF)维度,其余维度有相似的标准差;除了SF、VT维度,其余6个维度条目维度相关一致;除了SF维度,7个维度集合效度成功率范围为75%～100%,区分效度成功率范围为87.5%～100%.一致性信度系数除了SF、VT维度,其余6维度变化范围为0.72～0.88,满足群组比较的要求.两周重测信度变化范围为0.66～0.94.因子分析产生了2个主成分,分别代表生理健康和心理健康,解释了56.3%的总方差.结论为SF-36健康调查量表适用于中国提供了证据,已知群效度试验将为量表效度提供更有意义的证据.",
				"extra": "<北大《中文核心期刊要目总览》, 中国科技论文与引文数据库>",
				"issue": "2",
				"language": "zh-CN",
				"libraryCatalog": "Wanfang Data",
				"pages": "109-113",
				"publicationTitle": "中华预防医学杂志",
				"url": "http://med.wanfangdata.com.cn/Paper/Detail?id=PeriodicalPaper_zhyfyx200202011&dbid=WF_QK",
				"volume": "36",
				"attachments": [],
				"tags": [
					{
						"tag": "SF-36量表"
					},
					{
						"tag": "心理学试验"
					},
					{
						"tag": "生活质量"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/periodical/ChlQZXJpb2RpY2FsQ0hJTmV3UzIwMjIwNzE5Eg5RSzE5OTgwMTIxODkyMhoIdm9wbzYzZ2k%3D",
		"items": [
			{
				"itemType": "webpage",
				"title": "个人写作但是在个人与世界之间-肖开愚访谈录",
				"creators": [
					{
						"firstName": "开愚",
						"lastName": "肖",
						"creatorType": "author"
					},
					{
						"firstName": "弦",
						"lastName": "余",
						"creatorType": "author"
					}
				],
				"date": "1998,          (8)",
				"abstractNote": "万方数据知识服务平台-中外学术论文、中外标准、中外专利、科技成果、政策法规等科技文献的在线服务平台。",
				"language": "zh-CN",
				"url": "https://d.wanfangdata.com.cn/periodical/ChlQZXJpb2RpY2FsQ0hJTmV3UzIwMjIwNzE5Eg5RSzE5OTgwMTIxODkyMhoIdm9wbzYzZ2k%3D",
				"websiteTitle": "北京文学",
				"attachments": [],
				"tags": [
					{
						"tag": "个人写作"
					},
					{
						"tag": "中国诗"
					},
					{
						"tag": "书面语言"
					},
					{
						"tag": "余弦"
					},
					{
						"tag": "写作冲动"
					},
					{
						"tag": "动物园"
					},
					{
						"tag": "北京文学"
					},
					{
						"tag": "四川省"
					},
					{
						"tag": "小说"
					},
					{
						"tag": "抒情诗"
					},
					{
						"tag": "肖开愚"
					},
					{
						"tag": "西方诗歌"
					},
					{
						"tag": "诗歌写作"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://med.wanfangdata.com.cn/Paper/Detail/PeriodicalPaper_PM21270037",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Intra-guild competition and its implications for one of the biggest terrestrial predators, Tyrannosaurus rex.",
				"creators": [
					{
						"firstName": "Chris",
						"lastName": "Carbone",
						"creatorType": "author"
					},
					{
						"firstName": "Samuel T",
						"lastName": "Turvey",
						"creatorType": "author"
					},
					{
						"firstName": "Jon",
						"lastName": "Bielby",
						"creatorType": "author"
					}
				],
				"DOI": "10.1098/rspb.2010.2497",
				"abstractNote": "Identifying tradeoffs between hunting and scavenging in an ecological context is important for understanding predatory guilds. In the past century, the feeding strategy of one of the largest and best-known terrestrial carnivores, Tyrannosaurus rex, has been the subject of much debate: was it an active predator or an obligate scavenger? Here we look at the feasibility of an adult T. rex being an obligate scavenger in the environmental conditions of Late Cretaceous North America, given the size distributions of sympatric herbivorous dinosaurs and likely competition with more abundant small-bodied theropods. We predict that nearly 50 per cent of herbivores would have been within a 55-85 kg range, and calculate based on expected encounter rates that carcasses from these individuals would have been quickly consumed by smaller theropods. Larger carcasses would have been very rare and heavily competed for, making them an unreliable food source. The potential carcass search rates of smaller theropods are predicted to be 14-60 times that of an adult T. rex. Our results suggest that T. rex and other extremely large carnivorous dinosaurs would have been unable to compete as obligate scavengers and would have primarily hunted large vertebrate prey, similar to many large mammalian carnivores in modern-day ecosystems.",
				"extra": "Institute of Zoology\n                            [1]\n                        \n                        \n                             Zoological Society of London\n                            [2]\n                        \n                        \n                             Regent's Park\n                            [3]\n                        \n                        \n                             London NW1 4RY\n                            [4]\n                        \n                        \n                             UK. chris.carbone@ioz.ac.uk\n                            [5]\n\n2021-10-20",
				"language": "zh-CN",
				"libraryCatalog": "Wanfang Data",
				"pages": "2682-90",
				"publicationTitle": "Proceedings. Biological sciences",
				"url": "http://med.wanfangdata.com.cn/Paper/Detail/PeriodicalPaper_PM21270037",
				"attachments": [],
				"tags": [
					{
						"tag": "动物(Animals)"
					},
					{
						"tag": "北美洲(North America)"
					},
					{
						"tag": "恐龙(Dinosaurs)"
					},
					{
						"tag": "掠夺行为(Predatory Behavior)"
					},
					{
						"tag": "摄食行为(Feeding Behavior)"
					},
					{
						"tag": "生态系统(Ecosystem)"
					},
					{
						"tag": "竞争行为(Competitive Behavior)"
					},
					{
						"tag": "食人肉癖(Cannibalism)"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/standard/GB%252FT%25252019001-2016",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "万方数据知识服务平台",
				"creators": [],
				"extra": "Type: standard",
				"language": "zh-CN",
				"url": "https://d.wanfangdata.com.cn/standard/GB%252FT%25252019001-2016",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
