{
	"translatorID": "cdd6de3b-5a71-4d3f-afe4-a3bd654e81fd",
	"label": "Wanfang Data",
	"creator": "Xingzhong Lin",
	"target": "^https?://[wd]+\\.wanfangdata\\.com\\.cn",
	"minVersion": "",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 12,
	"browserSupport": "gcs",
	"lastUpdated": "2020-10-19 06:28:11"
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
	Z.debug("---------------WanFang Data 20201018---------------");
	getRefworksByID(ids, function(detail) {
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
		var pdflink = getPDF(itemInfo, newItem.url);
		if (pdflink) {
			Z.debug(pdflink);
			newItem.attachments = [{
				title: "Full Text PDF",
				mimeType: "application/pdf",
				url: pdflink
			}];
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
		names.forEach(
			name => creators.push({lastName: name, creatorType:pair[1]})
		);
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
	var items = url.match(/(\?searchType=)/i);
	Z.debug(items);
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
  var rows = ZU.xpath(doc, "//div[@class='ResultList ']");
  var idx = 1
  for (let row of rows) {
	var title = ZU.xpath(row, ".//a[normalize-space()!='目录']")[0];
	var href = title.href;
	// Z.debug(href);
	items[href] = idx + " " + title.innerText;
	var target = ZU.xpath(row, ".//div[@class='ResultCheck']/input")[0];
	// Z.debug(target.getAttribute('docid'));
	var filename = target.getAttribute('docid');
	var dbname = target.getAttribute('doctype');
	var reader = ZU.xpath(row, ".//a[@class='result_opera_ibook']");
	if (reader.length > 0) {
		var tmp = reader[0].getAttribute('onclick').split("','");
		var pdflink = `http://oss.wanfangdata.com.cn/www/${tmp[5]}.ashx?isread=true&type=${tmp[2]}&resourceId=${tmp[4]}`;
	} else {
		var pdflink = null;
	}
	itemInfo[href] = {filename:filename, dbname:getTypeFromDBName(dbname), url:href, pdflink:pdflink};
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

function getPDF(target, url) {
	if (Object.prototype.toString.call(target) == "[object Object]") {
		var pdflink = target[url].pdflink;
	} else {
		var pdflink = ZU.xpath(target, "//a[@class='onlineRead']");
		var pdflink = pdflink.length > 0 ? pdflink[0].href : null;
	}
	return pdflink;
}/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.wanfangdata.com.cn/details/detail.do?_type=perio&id=hgxb2019z1002",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "微波法制备生物柴油研究进展",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "辉",
						"lastName": "商"
					},
					{
						"creatorType": "author",
						"firstName": "禹",
						"lastName": "丁"
					},
					{
						"creatorType": "author",
						"firstName": "文慧",
						"lastName": "张"
					}
				],
				"date": "2019",
				"DOI": "10.11949/j.issn.0438?1157.20181400[doi]",
				"ISSN": "0438-1157",
				"abstractNote": "基于微波的选择性、瞬时性及体积性加热的特点,可以有效提高反应分子的平均能量、分子的碰撞频率,加快反应速率,采用微波辅助催化酯交换反应制备生物柴油近几年得到了国内外学者的广泛关注.将微波能应用于生物柴油制备过程具有显著的优势,与传统加热方式相比,采用微波辐射加热,反应时间明显缩短,产物组成也有所变化.因此主要从酸碱催化剂催化酯交换反应和酯化反应的角度,综述了国内外对微波辅助生物柴油制备的研究进展,并对微波优势及未来发展趋势进行了展望.",
				"issue": "z1",
				"language": "chi",
				"libraryCatalog": "WanFang",
				"pages": "15-22",
				"publicationTitle": "Research progress of microwave assisted biodiesel production",
				"url": "http://www.wanfangdata.com.cn/details/detail.do?_type=perio&id=hgxb2019z1002",
				"volume": "70",
				"attachments": [
					{
						"title": "微波法制备生物柴油研究进展",
						"mimeType": "text/html",
						"snapshot": true
					}
				],
				"tags": [
					{
						"tag": "biodiesel"
					},
					{
						"tag": "catalyst"
					},
					{
						"tag": "esterification"
					},
					{
						"tag": "microwave"
					},
					{
						"tag": "transesterification"
					},
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
		"url": "http://www.wanfangdata.com.cn/details/detail.do?_type=degree&id=D01698671",
		"items": [
			{
				"itemType": "thesis",
				"title": "济南市生物多样性评价及与生物入侵关系研究",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "令玉",
						"lastName": "孟"
					}
				],
				"date": "2019",
				"language": "chi",
				"libraryCatalog": "WanFang",
				"place": "中国",
				"university": "山东农业大学",
				"url": "http://www.wanfangdata.com.cn/details/detail.do?_type=degree&id=D01698671",
				"attachments": [
					{
						"title": "济南市生物多样性评价及与生物入侵关系研究",
						"mimeType": "text/html",
						"snapshot": true
					}
				],
				"tags": [
					{
						"tag": "济南市"
					},
					{
						"tag": "生物入侵"
					},
					{
						"tag": "生物多样性评价"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.wanfangdata.com.cn/details/detail.do?_type=conference&id=9534067",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "生物发酵提高芦笋汁生物利用率研究",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "晓春",
						"lastName": "吴"
					},
					{
						"creatorType": "author",
						"firstName": "惠华",
						"lastName": "黄"
					}
				],
				"date": "2018",
				"abstractNote": "本研究在单因素试验的基础上通过响应面法优化安琪酵母发酵芦笋汁生产工艺,以芦笋汁中总皂苷元含量作为响应值,各影响因素为自变量,设计响应面实验方案.结果表明一次项X1(接种量)、X2(发酵温度)、X3(发酵时间)和所有因素的二次项都达到了极显著水平(P<0.01).并得到安琪酵母发酵芦笋汁的最优生产工艺条件:利用R2A琼脂作为基础培养基接种量0.2％、发酵温度30℃、发酵时间7天.在此条件下重复实验3次,整理结果可知芦笋总皂苷元含量可达到(361.68±8.62)μg.",
				"language": "chi",
				"libraryCatalog": "WanFang",
				"pages": "69-74",
				"proceedingsTitle": "2018年广东省食品学会年会论文集",
				"publisher": "广东省食品学会",
				"url": "http://www.wanfangdata.com.cn/details/detail.do?_type=conference&id=9534067",
				"attachments": [
					{
						"title": "生物发酵提高芦笋汁生物利用率研究",
						"mimeType": "text/html",
						"snapshot": true
					}
				],
				"tags": [
					{
						"tag": "总皂苷元含量"
					},
					{
						"tag": "生物利用率"
					},
					{
						"tag": "生物发酵"
					},
					{
						"tag": "芦笋汁"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.wanfangdata.com.cn/details/detail.do?_type=patent&id=CN201880013080.0",
		"items": [
			{
				"itemType": "patent",
				"title": "生物体签名系统及生物体签名方法",
				"creators": [],
				"issueDate": "2019-10-11",
				"abstractNote": "生物体签名系统保持将从用户的部位得到的第一生物体信息转换而得到的第一模板和通过单向性转换将从该用户的该部位得到的第二生物体信息进行转换而得到的第二模板，根据认证对象的第一生物体信息生成第一模板，对使用参数修正后的认证对象的第一模板与生物体签名系统保持的第一模板之间的相似度高的该参数进行特定，分别根据分别使用包括该特定出的参数在内的规定范围所包括的参数修正后的认证对象的第二生物体信息，生成第二模板，并将该生成的第二模板分别与生物体签名系统保持的第二模板进行比较来判定认证对象的认证成功与否。",
				"applicationNumber": "发明专利",
				"issuingAuthority": "株式会社日立制作所",
				"url": "http://www.wanfangdata.com.cn/details/detail.do?_type=patent&id=CN201880013080.0",
				"attachments": [
					{
						"title": "生物体签名系统及生物体签名方法",
						"mimeType": "text/html",
						"snapshot": true
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
		"url": "http://www.wanfangdata.com.cn/details/detail.do?_type=perio&id=10.1111%252Fbjd.18291",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "皮肤微生物组检查",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "S.",
						"lastName": "Prast‐Nielsen"
					},
					{
						"creatorType": "author",
						"firstName": "A.‐M.",
						"lastName": "Tobin"
					},
					{
						"creatorType": "author",
						"firstName": "K.",
						"lastName": "Adamzik"
					},
					{
						"creatorType": "author",
						"firstName": "A.",
						"lastName": "Powles"
					},
					{
						"creatorType": "author",
						"firstName": "L.W.",
						"lastName": "Hugerth"
					},
					{
						"creatorType": "author",
						"firstName": "C.",
						"lastName": "Sweeney"
					},
					{
						"creatorType": "author",
						"firstName": "B.",
						"lastName": "Kirby"
					},
					{
						"creatorType": "author",
						"firstName": "L.",
						"lastName": "Engstrand"
					},
					{
						"creatorType": "author",
						"firstName": "L.",
						"lastName": "Fry"
					}
				],
				"date": "2019",
				"DOI": "10.1111/bjd.18291[doi]",
				"ISSN": "0007-0963",
				"abstractNote": "Summary 确定皮肤中存在何种细菌的传统方法是使用拭子取样。这种方法的一个局限是:拭子采样只能从皮肤表面采集,而细菌可能也存在于皮肤的深层。来自瑞典、爱尔兰和英国的研究者们调查了皮肤拭子和实际活检(组织样本)结果的差异。 在 16 名接受躯干或肢体皮损切除(手术去除)的患者中,从相同部位采集了一份拭子样本和一份 2 mm 环钻活检样本。首先润湿使用的拭子,之后对下方的脂肪层进行活检。对活检样本使用一种称为 16S rRNA 基因测序的技术来明确细菌的存在情况。这是一种非常敏感的技术,甚至在细菌不能被培养(生长)的情况发现细菌的 DNA。 活检显示称为梭菌目和拟杆菌门的细菌显著增多。梭菌目不需要氧气即可存活,因此预计可能在更深层皮肤发现。另一方面,其他细菌,如常见的金黄色葡萄球菌,在拭子样本中含量更为丰富。 更准确地了解皮肤中生活着何种细菌具有重要意义,因为这些细菌可能引发免疫反应,此反应对于特应性皮炎、银屑病和化脓性汗腺炎等皮肤病具有重要意义。 Linked Article: Prast‐Nielsen et al. Br J Dermatol 2019; 181:572–579",
				"issue": "3",
				"language": "eng",
				"libraryCatalog": "WanFang",
				"pages": "e84-e84",
				"publicationTitle": "British Journal of Dermatology",
				"url": "http://www.wanfangdata.com.cn/details/detail.do?_type=perio&id=10.1111%252Fbjd.18291",
				"volume": "181",
				"attachments": [
					{
						"title": "皮肤微生物组检查",
						"mimeType": "text/html",
						"snapshot": true
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
