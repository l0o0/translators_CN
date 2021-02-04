{
	"translatorID": "cdd6de3b-5a71-4d3f-afe4-a3bd654e81fd",
	"label": "Wanfang Data",
	"creator": "Lin Xingzhong",
	"target": "^https?://[a-z]\\.(g\\.)?wanfangdata\\.com\\.cn",
	"minVersion": "",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 12,
	"browserSupport": "gcs",
	"lastUpdated": "2021-02-04 06:24:09"
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

var typeFieldMapper = {
	"journalArticle" : {
		"PeriodicalTitle":"publicationTitle",
		"Volum":"volume",
		"Issue":"issue",
		"Page":"pages",
		"PublishDate":"date",
		"journalAbbreviation": "",
		"DOI": "DOI",
		"ISSN": "ISSN",
		"Keywords": "tags",
		"Creator": [["Creator", "author"]]
	},
	"thesis": {
		"Degree":"thesisType",
		"OrganizationNorm":"university",
		"PublishDate": "date",
		"MachinedKeywords": "tags",
		"Creator": [
			["Creator", "author"],
			["Tutor", "contributor"]
		],
	},
	"conferencePaper": {
		"MeetingDate": "date",
		"MeetingTitle": "conferenceName",
		"MeetingCorpus": "proceedingsTitle",
		"MeetingArea": "place",
		"MachinedKeywords": "tags",
		"Volum":"volume",
		"Page": "pages",
		"DOI": "DOI",
		"Sponsor": "publisher",
		"Creator": [["Creator", "author"]],
	},
	"patent": {
		"ApplicantArea": "place",
		"CountryOrganization": "country",
		"PatentCode" : "patentNumber",
		"ApplicationDate":"filingDate",
		"PublicationDate": "issueDate",
		"LegalStatus": "legalStatus",
		"SignoryItem": "rights",
		"Applicant": "issuingAuthority",
		"PublicationNo" : "applicationNumber",
		"Creator": [
			["Inventor", "inventor"],
			["Agent", "attorneyAgent"]
		],
	}
};


function getRefworksByID(ids, next) {
	if (!ids.length) return;
	var { dbname, filename, url} = ids.shift();
	var headers = {
		'Content-Type': 'application/json;charset=UTF-8'
	};
	var postData = JSON.stringify({'Id':filename});
	Z.debug(dbname, filename, url);
	var searchType = {
		journalArticle: "Periodical",
		thesis: "Thesis",
		conferencePaper: "Conference",
		patent: "Patent"
	};
	var postUrl = "http://d.wanfangdata.com.cn/Detail/" + searchType[dbname] + "/";
	ZU.doPost(postUrl, postData, 
		function(text) {
			detail = JSON.parse(text).detail[0];
			detail = detail[Object.keys(detail)[0]];
			// Z.debug(detail);
			detail.url = url;
			detail.dbname = dbname;
			next(detail);
			if (ids.length) {
				getRefworksByID(ids, next);
			}
		},
		headers=headers
	);
	
}


function scrape(ids, itemInfo) {
	Z.debug("---------------WanFang Data 20210204---------------");
	getRefworksByID(ids, function(detail) {
		// Z.debug(detail);
		var dbname = detail.dbname;
		var newItem = new Zotero.Item();
		var matcher = typeFieldMapper[dbname];
		newItem.itemType = dbname;
		newItem.title = detail.Title[0];
		newItem.abstractNote = detail.Abstract[0];
		detail.Language ? newItem.language=detail.Language : newItem.language = 'chi';
		if (detail.FulltextPath && detail.FulltextPath.startsWith("http")) { // add full text path in note
			var note = `文章全文链接<br><a href="${detail.FulltextPath}">${detail.FulltextPath}</a>`;
			newItem.notes.push({note:note});
		}
		newItem.url = detail.url;
		for (let k in matcher) {
			var field = matcher[k];
			if (k === "Creator") {
				newItem.creators = addCreators(field, detail);
				continue;
			}
			if (field === "tags") {
				var tags = [];
				detail[k].forEach(tag => newItem.tags.push({"tag":tag}));
				continue;
			}
			if (typeof field === "string") {
				field = [field];
			}
			field.forEach(f => newItem[f] = (typeof detail[k] != 'object' ? detail[k]: detail[k][0]));
			
		}
		var pdflink = getPDF(itemInfo, detail);
		if (pdflink) {
			// Z.debug(pdflink);
			newItem.attachments = [{
				title: "Full Text PDF",
				mimeType: "application/pdf",
				url: pdflink
			}];
		}
		// Core Periodical
		if (detail.CorePeriodical) {
			newItem.extra = "<" + 
			detail.CorePeriodical.map((c) => core[c]).join(', ') + 
			">";
		}
		newItem.complete();
	});
}


function addCreators(field, detail) {
	var creators = [];
	for (let pair of field) {
		// Z.debug(pair);
		var names = detail[pair[0]];
		names = names.includes("%") ? names.split("%") : names;
		if (names instanceof Array) {
			names.forEach(
				name => creators.push({lastName: name, creatorType:pair[1]})
			);
		} else {
			creators.push({lastName: names, creatorType:pair[1]});
		}
	}
	var zhnamesplit = Z.getHiddenPref('zhnamesplit') === undefined ? true : false;
	for (var i = 0, n = creators.length; i < n; i++) {
		var creator = creators[i];

		if (creator.firstName) continue;
		var lastSpace = creator.lastName.lastIndexOf(' ');
		if (creator.lastName.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
			// western name. split on last space
			creator.firstName = creator.lastName.substr(0, lastSpace);
			creator.lastName = creator.lastName.substr(lastSpace + 1);
		} else if (zhnamesplit) {
			// zhnamesplit is true, split firstname and lastname.
			// Chinese name. first character is last name, the rest are first name
			creator.firstName = creator.lastName.substr(1);
			creator.lastName = creator.lastName.charAt(0);
		}
	}
	return creators;
}


// Get file name and database name.
function getIDFromURL(url) {
	if (!url) return false;
	var tmp = url.split('/');
	var dbname = tmp[3];
	var filename = tmp.slice(4).join('/');
	if (dbname && filename) {
		return {dbname: getTypeFromDBName(dbname),
		filename: filename, url:url};
	} else {
		return false;
	}
}

// database and item type match
function getTypeFromDBName(db) {
	var dbType = {
		periodical: "journalArticle",
		thesis: "thesis",
		// claw: "statute",
		conference: "conferencePaper",
		patent: "patent",
		// nstr: "report",
		perio: "journalArticle",
		degree: "thesis",
		// tech: "report"
	};
	if (db) {
		return dbType[db];
	} else {
		return false;
	}
}


function detectWeb(doc, url) {
	var id = getIDFromURL(url);
	var items = doc.querySelector("div.normal-list");
	if (items) {
		return "multiple";
	} else if (id) {
		return id.dbname;
	} else {
		return false;
	}
}

function getSearchResults(doc, itemInfo) {
  var items = {};
  var found = false;
  var rows = ZU.xpath(doc, "//div[@class='normal-list']");
  var idx = 1
  for (let row of rows) {
	var title = ZU.xpath(row, ".//a[normalize-space()!='目录']")[0];
	var href = title.href;
	// Z.debug(href);
	items[href] = idx + " " + title.innerText;
	var id = getIDFromURL(href);
	id.url = href;
	// Z.debug(id);
	itemInfo[href] = id;
	idx +=1
  }
  // Z.debug(itemInfo);
  return items;
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		var itemInfo = {};
		var items = getSearchResults(doc, itemInfo);
		Z.selectItems(items, function(selectedItems) {
			if (!selectedItems) return true;
			var ids = [];
			for (var href in selectedItems) {
				ids.push(itemInfo[href]);
			}
			// Z.debug(ids);
			scrape(ids, itemInfo)
		});
	} else {
		var id = getIDFromURL(url);
		scrape([id], doc);
	}
}

function getPDF(target, detail) {
	if (Object.prototype.toString.call(target) == "[object Object]") {
		var pdflink = "http://oss.wanfangdata.com.cn/www/" + detail.Title[0] + ".ashx?isread=true&type=perio&resourceId=" + detail.Id;
	} else {
		var pdflink = ZU.xpath(target, "//a[@class='onlineRead']");
		var pdflink = pdflink.length > 0 ? pdflink[0].href : null;
	}
	return pdflink;
}/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://d.wanfangdata.com.cn/periodical/hgxb2019z1002",
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
				"date": "2019-12-30 00:00:00",
				"DOI": "10.11949/j.issn.0438?1157.20181400",
				"ISSN": "0438-1157",
				"abstractNote": "基于微波的选择性、瞬时性及体积性加热的特点,可以有效提高反应分子的平均能量、分子的碰撞频率,加快反应速率,采用微波辅助催化酯交换反应制备生物柴油近几年得到了国内外学者的广泛关注.将微波能应用于生物柴油制备过程具有显著的优势,与传统加热方式相比,采用微波辐射加热,反应时间明显缩短,产物组成也有所变化.因此主要从酸碱催化剂催化酯交换反应和酯化反应的角度,综述了国内外对微波辅助生物柴油制备的研究进展,并对微波优势及未来发展趋势进行了展望.",
				"extra": "<美国《工程索引》, 中国科技论文与引文数据库, 北大《中文核心期刊要目总览》>",
				"issue": "z1",
				"language": "chi",
				"libraryCatalog": "Wanfang Data",
				"pages": "15-22",
				"publicationTitle": "化工学报",
				"url": "http://d.wanfangdata.com.cn/periodical/hgxb2019z1002",
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
		"url": "http://d.wanfangdata.com.cn/thesis/D01698671",
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
				"language": "chi",
				"libraryCatalog": "Wanfang Data",
				"thesisType": "硕士",
				"university": "山东农业大学",
				"url": "http://d.wanfangdata.com.cn/thesis/D01698671",
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
		"url": "http://d.wanfangdata.com.cn/conference/9534067",
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
				"language": "chi",
				"libraryCatalog": "Wanfang Data",
				"pages": "69-74",
				"place": "广州",
				"proceedingsTitle": "2018年广东省食品学会年会论文集",
				"publisher": "广东省食品学会",
				"url": "http://d.wanfangdata.com.cn/conference/9534067",
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
		"url": "http://d.wanfangdata.com.cn/patent/CN201880013080.0",
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
				"language": "chi",
				"legalStatus": "在审",
				"patentNumber": "CN201880013080.0",
				"place": "日本;JP",
				"rights": "1.一种生物体签名系统，其特征在于， 包括处理器和存储器， 所述存储器保持第一模板和第二模板，该第一模板表示通过规定的转换将从用户的规定部位得到的第一生物体信息进行转换后的结果，该第二模板表示通过规定的单向性转换将从所述用户的所述规定部位得到的第二生物体信息进行转换后的结果， 所述处理器进行以下处理： 获取认证对象的所述第一生物体信息和所述第二生物体信息， 根据获取到的所述第一生物体信息生成所述认证对象的第一模板， 对使用参数修正后的所述认证对象的第一模板与所述存储器保持的第一模板之间的相似度比规定条件高的所述参数进行特定， 分别使用包括特定出的所述参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息， 分别根据修正后的所述第二生物体信息生成所述认证对象的第二模板， 将生成的所述第二模板分别与所述存储器保持的第二模板进行比较来判定所述认证对象的认证成功与否。 2.根据权利要求1所述的生物体签名系统，其特征在于， 所述处理器通过所述规定的转换对获取到的所述第一生物体信息进行转换而生成所述认证对象的第一模板。 3.根据权利要求1所述的生物体签名系统，其特征在于， 所述处理器通过所述规定的单向性转换对修正后的所述第二生物体信息分别进行转换而生成所述认证对象的第二模板。 4.根据权利要求1所述的生物体签名系统，其特征在于， 储存于所述存储器内的第一生物体信息与第二生物体信息的相关系数为规定值以下。 5.根据权利要求1所述的生物体签名系统，其特征在于， 所述参数包括所述第一模板及所述第二模板的修正中的、表示平行移动量的参数和表示旋转量的参数。 6.根据权利要求1所述的生物体签名系统，其特征在于， 所述存储器保持多个用户的第一模板和第二模板， 所述处理器进行以下处理： 对与所述存储器保持的多个第一模板中的、存在所述相似度比规定条件高的所述参数的第一模板对应的用户群进行特定， 关于特定出的所述用户群的每个用户，分别使用包括特定出的参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息并生成第二模板，并且将该生成的第二模板分别与该用户的第二模板进行比较， 基于分别针对特定出的所述用户群的比较结果来判定所述认证对象的认证成功与否。 7.一种生物体签名方法，由生物体签名系统进行生物体签名，其特征在于， 所述生物体签名系统保持第一模板和第二模板，该第一模板表示通过规定的转换将从用户的规定部位得到的第一生物体信息进行转换后的结果，该第二模板表示通过规定的单向性转换将从所述用户的所述规定部位得到的第二生物体信息进行转换后的结果， 在所述方法中，所述生物体签名系统进行以下处理： 获取认证对象的所述第一生物体信息和所述第二生物体信息， 根据获取到的所述第一生物体信息生成所述认证对象的第一模板， 对使用参数修正后的所述认证对象的第一模板与所述生物体签名系统保持的第一模板之间的相似度比规定条件高的所述参数进行特定， 分别使用包括特定出的所述参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息， 分别从修正后的所述第二生物体信息生成所述认证对象的第二模板， 将生成的所述第二模板分别与所述生物体签名系统保持的第二模板进行比较来判定所述认证对象的认证成功与否。 8.根据权利要求7所述的方法，其特征在于， 在所述方法中，所述生物体签名系统通过所述规定的转换对获取到的所述第一生物体信息进行转换而生成所述认证对象的第一模板。 9.根据权利要求7所述的方法，其特征在于， 在所述方法中，所述生物体签名系统通过所述规定的单向性转换对修正后的所述第二生物体信息分别进行转换而生成所述认证对象的第二模板。 10.根据权利要求7所述的方法，其特征在于， 储存于所述生物体签名系统内的第一生物体信息与第二生物体信息的相关系数为规定值以下。 11.根据权利要求7所述的方法，其特征在于， 所述参数包括所述第一模板及所述第二模板的修正中的、表示平行移动量的参数和表示旋转量的参数。 12.根据权利要求7所述的方法，其特征在于， 所述生物体签名系统保持多个用户的第一模板和第二模板， 在所述方法中，所述生物体签名系统进行以下处理： 对与所述生物体签名系统保持的多个第一模板中的、存在所述相似度比规定条件高的所述参数的第一模板对应的用户群进行特定， 关于特定出的所述用户群的每个用户，分别使用包括特定出的参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息并生成第二模板，并且将该生成的第二模板分别与该用户的第二模板进行比较， 基于分别针对特定出的所述用户群的比较结果来判定所述认证对象的认证成功与否。",
				"url": "http://d.wanfangdata.com.cn/patent/CN201880013080.0",
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
		"url": "http://d.wanfangdata.com.cn/periodical/10.1111%252Fbjd.18291",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "皮肤微生物组检查",
				"creators": [
					{
						"lastName": "Prast‐Nielsen",
						"creatorType": "author",
						"firstName": "S."
					},
					{
						"lastName": "Tobin",
						"creatorType": "author",
						"firstName": "A.‐M."
					},
					{
						"lastName": "Adamzik",
						"creatorType": "author",
						"firstName": "K."
					},
					{
						"lastName": "Powles",
						"creatorType": "author",
						"firstName": "A."
					},
					{
						"lastName": "Hugerth",
						"creatorType": "author",
						"firstName": "L.W."
					},
					{
						"lastName": "Sweeney",
						"creatorType": "author",
						"firstName": "C."
					},
					{
						"lastName": "Kirby",
						"creatorType": "author",
						"firstName": "B."
					},
					{
						"lastName": "Engstrand",
						"creatorType": "author",
						"firstName": "L."
					},
					{
						"lastName": "Fry",
						"creatorType": "author",
						"firstName": "L."
					}
				],
				"date": "2019-09-01 00:00:00",
				"DOI": "10.1111/bjd.18291",
				"ISSN": "0007-0963",
				"abstractNote": "Summary 确定皮肤中存在何种细菌的传统方法是使用拭子取样。这种方法的一个局限是:拭子采样只能从皮肤表面采集,而细菌可能也存在于皮肤的深层。来自瑞典、爱尔兰和英国的研究者们调查了皮肤拭子和实际活检(组织样本)结果的差异。 在 16 名接受躯干或肢体皮损切除(手术去除)的患者中,从相同部位采集了一份拭子样本和一份 2 mm 环钻活检样本。首先润湿使用的拭子,之后对下方的脂肪层进行活检。对活检样本使用一种称为 16S rRNA 基因测序的技术来明确细菌的存在情况。这是一种非常敏感的技术,甚至在细菌不能被培养(生长)的情况发现细菌的 DNA。 活检显示称为梭菌目和拟杆菌门的细菌显著增多。梭菌目不需要氧气即可存活,因此预计可能在更深层皮肤发现。另一方面,其他细菌,如常见的金黄色葡萄球菌,在拭子样本中含量更为丰富。 更准确地了解皮肤中生活着何种细菌具有重要意义,因为这些细菌可能引发免疫反应,此反应对于特应性皮炎、银屑病和化脓性汗腺炎等皮肤病具有重要意义。 Linked Article: Prast‐Nielsen et al. Br J Dermatol 2019; 181:572–579",
				"extra": "<>",
				"issue": "3",
				"language": "eng",
				"libraryCatalog": "Wanfang Data",
				"pages": "e84-e84",
				"publicationTitle": "British Journal of Dermatology",
				"url": "http://d.wanfangdata.com.cn/periodical/10.1111%252Fbjd.18291",
				"volume": "181",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "文章全文链接<br><a href=\"https://doi.org/10.1111/bjd.18291\">https://doi.org/10.1111/bjd.18291</a>"
					}
				],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
