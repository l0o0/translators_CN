{
	"translatorID": "dbee13de-2baf-4034-bbac-afa05bc29b48",
	"label": "WanFang",
	"creator": "Xingzhong Lin",
	"target": "^https?://www\\.wanfangdata\\.com\\.cn",
	"minVersion": "",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 12,
	"browserSupport": "gcs",
	"lastUpdated": "2019-12-16 07:18:39"
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

function getRefworksByID(ids, next) {
	var searchType = {
		journalArticle: 'periodical',
		patent: 'patent',
		conferencePaper: 'conference',
		thesis: 'thesis'
	}
	var r = Math.random();
	var isHtml5Value = '';
	for (var i=0, n=ids.length; i<n; i++) {
		// only these four types have refworks
		if (searchType[ids[i].dbname]){
			isHtml5Value += searchType[ids[i].dbname] + "_" + ids[i].filename + ";";
		}
	}
	//var isHtml5Value = "thesis_Y3578315;conference_9534067;periodical_jsjyjyfz201910006;patent_CN201880013080.0";
	
	var postData = "r=" + r + "&exportType=refWorks&isHtml5=true&isHtml5Value=" + isHtml5Value;
	// Z.debug(postData);
	ZU.doPost('/export/getExportJson.do', postData, 
		function(text) {
			var text = JSON.parse(text)['exportHtml'];
			var text = text.replace(/<br>/g, '\n');
			text = text.replace(/^RT\s+Dissertation\/Thesis/gmi, 'RT Dissertation');
			text = text.replace(/^RT\s+Conference Proceeding/gmi, "RT Conference Proceedings");
			// Z.debug(text);
			next(text);
		}
	);
}


// Get file name and database name.
function getIDFromURL(url) {
	if (!url) return false;
	
	var filename = url.match(/[?&]id=([^&#]*)/i);
	var dbname = url.match(/[?&]_type=([^&#]*)/i);
	if (!dbname || !dbname[1] || !filename || !filename[1]) return false;
	return { 
				dbname: getTypeFromDBName(dbname[1]), 
				filename: decodeURI(filename[1]).replace('%2F', '/'), url: url };
			}

// database and item type match
function getTypeFromDBName(db) {
	var dbType = {
		perio: "journalArticle",
		degree: "thesis",
		legislations: "statute",
		conference: "conferencePaper",
		patent: "patent",
		tech: "report",
	};
	if (db) {
		return dbType[db];
	} else {
		return false;
	}
}


function detectWeb(doc, url) {
	var id = getIDFromURL(url);
	var items = url.match(/\/(search)\//i);
	Z.debug(id);
	if (id) {
		return id.dbname;
	} else if (items) {
		return "multiple";
	} else {
		return false;
	}
}

function getSearchResults(doc, itemInfo) {
  var items = {};
  var found = false;
  // TODO: adjust the CSS selector
  var rows = ZU.xpath(doc, "//div[@class='ResultList ']");
  for (let row of rows) {
	var title = ZU.xpath(row, ".//a[normalize-space()!='目录']")[0];
	var href = title.href;
	// Z.debug(title.innerText);
	// Z.debug(href);
	items[href] = title.innerText;
	var clickCmd = ZU.xpath(row, ".//a/i")[0].getAttribute('onclick');
	var clickCmdArr = clickCmd.split(/[,)']/);
	var filename = clickCmdArr[2];
	var dbname = clickCmdArr[5]; 
	itemInfo[href] = {filename:filename, dbname:getTypeFromDBName(dbname), url:href};
  }
  return items
}

function doWeb(doc, url) {
  if (detectWeb(doc, url) == "multiple") {
		var itemInfo = {};
		var items = getSearchResults(doc, itemInfo);
		Z.selectItems(items, function(selectedItems) {
			if (!selectedItems) return true;
			
			var itemInfoByTitle = {};
			var ids = [];
			for (var url in selectedItems) {
				// Z.debug('url ' + url);
				// Z.debug(itemInfo[url]);
				ids.push(itemInfo[url]);
				itemInfoByTitle[ZU.trimInternal(selectedItems[url])] = itemInfo[url];
			}
			scrape(ids, doc, url, itemInfoByTitle);
		});
	} else {
		scrape([getIDFromURL(url)], doc, url);
	}
}

function scrape(ids, doc, url, itemInfo) {
	getRefworksByID(ids, function(text, ids) {
		var translator = Z.loadTranslator('import');
		translator.setTranslator('1a3506da-a303-4b0a-a1cd-f216e6138d86'); //Refworks
		translator.setString(text);
		translator.setHandler('itemDone', function(obj, newItem) {
			// split names
			var authors = "";
			for (var i = 0; i < newItem.creators.length; i++) {
				authors = authors + newItem.creators[i]['lastName'] + ';';
			}
			authors = authors.slice(0, authors.length-1);
			// remove [names in PINYIN]
			var authors = authors.replace(/[\s;]\[.*\]/g, '');
			if (newItem.itemType == "conferencePaper"){
				var authors = authors.split(/[\s;]/);
			} else {
				var authors = authors.split(';');
			}
			newItem.creators = [];
			for (var i = 0, n = authors.length; i < n; i++) {
				var author = ZU.trimInternal(authors[i]);
				var creator = {creatorType: "author"};
				var lastSpace = author.lastIndexOf(' ');
				if (author.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
					// western name. split on last space
					creator['firstName'] = author.substr(0,lastSpace);
					creator['lastName'] = author.substr(lastSpace + 1);
				} else {
					// Chinese name. first character is last name, the rest are first name
					creator['firstName'] = author.substr(1);
					creator['lastName'] = author.charAt(0);
				}
				newItem.creators.push(creator);
			}
			// split tags 
			var tags = newItem.tags;
			newItem.tags = [];
			for (var tag of tags){
				var tagSplit = tag.split(/\s+/);
				newItem.tags = newItem.tags.concat(tagSplit);
			}
			// remove unnecessary notes
			if (newItem.notes){
				newItem.notes = [];
			}
				
			if (newItem.abstractNote) {
				newItem.abstractNote = newItem.abstractNote.replace(/\s*[\r\n]\s*/g, '\n');
			}
			
			// clean up tags. Remove numbers from end
			for (var j = 0, l = newItem.tags.length; j < l; j++) {
				newItem.tags[j] = newItem.tags[j].replace(/:\d+$/, '');
			}
			
			newItem.title = ZU.trimInternal(newItem.title);
			if (itemInfo) {
				var info = itemInfo[newItem.title];
				if (!info) {
					Z.debug('No item info for "' + newItem.title + '"');
				} else {
					newItem.url = info.url;
				}
			} else {
				newItem.url = url;
			}
			newItem.attachments = [{
				url: newItem.url,
				title: newItem.title,
				mimeType: "text/html",
				snapshot: true
			}];
			newItem.complete();
		});
		
		translator.translate();
	});
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
				"abstractNote": "Summary 确定皮肤中存在何种细菌的传统方法是使用拭子取样。这种方法的一个局限是:拭子采样只能从皮肤表面采集,而细菌可能也存在于皮肤的深层。来自瑞典、爱尔兰和英国的研究者们调查了皮肤拭子和实际活检(组织样本)结果的差异。 在 16 名接受躯干或肢体皮损切除(手术去除)的患者中,从相同部位采集了一份拭子样本和一份 2 mm 环钻活检样本。首先润湿使用的拭子,之后对下方的脂肪层进行活检。对活检样本使用一种称为 16S rRNA 基因测序的技术来明确细菌的存在情况。这是一种非常敏感的技术,甚至在细菌不能被培养(生长)的情况发现细菌的 DNA。 活检显示称为梭菌目和拟杆菌门的细菌显著增多。梭菌目不需要氧气即可存活,因此预计可能在更深层皮肤发现。另一方面,其他细菌,如常见的金黄色葡萄球菌,在拭子样本中含量更为丰富。 更准确地了解皮肤中生活着何种细菌具有重要意义,因为这些细菌可能引发免疫反应,此反应对于特应性皮炎、银屑病和化脓性汗腺炎等皮肤病具有重要意义。 Linked Article: Prast‐Nielsen et al. Br J Dermatol 2019; 181:572–579",
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
