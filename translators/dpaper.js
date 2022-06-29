{
	"translatorID": "78ba8722-6748-47f4-9976-8985d75a220c",
	"label": "dpaper",
	"creator": "with",
	"target": "http://dpaper.las.ac.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2022-06-29 01:57:00"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2021 with
	
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

function detectWeb(doc) {
	let a = doc.getElementById("education");
	if (a !== null) {
		if (a.textContent !== null) {
			return "thesis";
		}
	}
	return false;
}

function doWeb(doc, url) {
	const pageType = detectWeb(doc);

	switch (pageType) {
		case "thesis":
			scrape(doc, url, pageType);
			break;

		default:
			break;
	}
}

function scrape(doc, url, itemType) {
	if (itemType === "thesis") {
		const newItem = new Zotero.Item(itemType);
		const title = doc.getElementById("title_cn").textContent;
		let teacher = "导师:暂无";
		let author = "作者:暂无";
		if (doc.getElementById("teacher_name").childNodes[1] !== undefined) {
			teacher = doc.getElementById("teacher_name").childNodes[1].textContent;
		}
		if (doc.getElementById("author_name").childNodes[1] !== undefined) {
			author = doc.getElementById("author_name").childNodes[1].textContent;
		}
		if (doc.getElementById("more_abstract_cn").textContent === "【显示更多内容】") {
			doc.getElementById("more_abstract_cn").click(); //模拟点击显示更多摘要
		}
		const abstract = doc.getElementById("abstract_cn").textContent;
		const iso = doc.getElementById("education_grant_time").textContent; //毕业时间作为论文发表时间
		const sid = doc.getElementById("fullText").children[0].href.match("'(.*?)'")[0]; //获取学生学号
		const education = doc.getElementById("education").textContent;
		const institute = doc.getElementById("training_institution").textContent;
		newItem.url = url;
		newItem.title = title;
		newItem.creators = [
			{
				lastName: author,
				creatorType: "author",
			},
			{
				lastName: teacher,
				creatorType: "contributor",
			},
		];
		newItem.abstractNote = abstract;
		newItem.sid = sid; //学生的学号
		newItem.date = ZU.strToISO(iso);
		newItem.thesisType = education;
		newItem.university = institute;
		newItem.libraryCatalog = "中国科学院文献情报中心";
		newItem.complete();
	}
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://dpaper.las.ac.cn/Dpaper/detail/detailNew?paperID=20172916&title=%E7%BC%85%E7%94%B8%E5%8C%97%E9%83%A8%E5%9B%A0%E9%81%93%E6%94%AF%E6%B9%96%E9%B1%BC%E7%B1%BB%E7%89%A9%E7%A7%8D%E5%A4%9A%E6%A0%B7%E6%80%A7&author=THINN%20SU%20TIN&highsearch=training_institution_all%253A345345345%25E5%258A%25A8%25E7%2589%25A9345345345%2520%2520234234234234234234%2520%2520specification_training_institution_str%253A%25E4%25B8%25AD%25E5%259B%25BD%25E7%25A7%2591%25E5%25AD%25A6%25E9%2599%25A2%25E6%2598%2586%25E6%2598%258E%25E5%258A%25A8%25E7%2589%25A9%25E7%25A0%2594%25E7%25A9%25B6%25E6%2589%2580&sortField=score%2520desc%252Cid&start=0&actionType=Browse&searchText=%E5%8A%A8%E7%89%A9",
		"items": [
			{
				"itemType": "thesis",
				"title": "缅甸北部因道支湖鱼类物种多样性",
				"creators": [
					{
						"lastName": "THINN SU TIN",
						"creatorType": "author"
					},
					{
						"lastName": "陈小勇",
						"creatorType": "contributor"
					}
				],
				"date": "2020-07-01",
				"abstractNote": "因道支湖是缅甸最大的淡水湖之一，位于缅甸北部密支那地区，在北纬25°5'–25°20'和东经96°18'–96°23'之间，海拔约550英尺。在雨季过后，由于湖水蔓延到周围的城市，使得湖泊的面积变得更大。因道支湖具有丰富的水生生态系统和生物多样性。并且因道支湖具有特有种和稀有种鱼类。因此本文的主要目的是..",
				"libraryCatalog": "中国科学院文献情报中心",
				"thesisType": "硕士",
				"university": "昆明动物研究所",
				"url": "http://dpaper.las.ac.cn/Dpaper/detail/detailNew?paperID=20172916&title=%E7%BC%85%E7%94%B8%E5%8C%97%E9%83%A8%E5%9B%A0%E9%81%93%E6%94%AF%E6%B9%96%E9%B1%BC%E7%B1%BB%E7%89%A9%E7%A7%8D%E5%A4%9A%E6%A0%B7%E6%80%A7&author=THINN%20SU%20TIN&highsearch=training_institution_all%253A345345345%25E5%258A%25A8%25E7%2589%25A9345345345%2520%2520234234234234234234%2520%2520specification_training_institution_str%253A%25E4%25B8%25AD%25E5%259B%25BD%25E7%25A7%2591%25E5%25AD%25A6%25E9%2599%25A2%25E6%2598%2586%25E6%2598%258E%25E5%258A%25A8%25E7%2589%25A9%25E7%25A0%2594%25E7%25A9%25B6%25E6%2589%2580&sortField=score%2520desc%252Cid&start=0&actionType=Browse&searchText=%E5%8A%A8%E7%89%A9",
				"attachments": [
					{
						"title": "缅甸北部因道支湖鱼类物种多样性",
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
		"url": "http://dpaper.las.ac.cn/Dpaper/detail/detailNew?paperID=20173144&title=%E4%B8%8D%E5%90%8C%E6%A3%AE%E6%9E%97%E7%94%9F%E6%80%81%E7%B3%BB%E7%BB%9F%E8%9A%9C%E8%99%AB%E4%B8%8E%E8%9A%82%E8%9A%81%E5%85%B1%E6%A0%96%E5%85%B3%E7%B3%BB%E7%A0%94%E7%A9%B6&author=%E9%BE%99%E6%B5%B7&highsearch=training_institution_all%253A345345345%25E5%258A%25A8%25E7%2589%25A9345345345&sortField=score%2520desc%252Cid&start=0&actionType=Browse&searchText=%E5%8A%A8%E7%89%A9",
		"items": [
			{
				"itemType": "thesis",
				"title": "不同森林生态系统蚜虫与蚂蚁共栖关系研究",
				"creators": [
					{
						"lastName": "龙海",
						"creatorType": "author"
					},
					{
						"lastName": "乔格侠",
						"creatorType": "contributor"
					}
				],
				"date": "2020-07-01",
				"abstractNote": "种间关系是促进生物多样性形成的动力因素之一，一直被生物学家广泛研究。近些年来，非紧密联系的种间关系已经成为生物学研究的一个新热点，特别是以蚜虫-蚂蚁为典型的非紧密联系的种间关系。全世界蚜虫大约5000种，几乎分布在温暖的北半球,全世界蚂蚁大约有13000种，广布全球。无论从进化历史还是从物种数目上来看，蚜虫蚂蚁都是较为成功的物种。(Strathdee, Howling et al. 1995, Hulle, Pannetier et al. 2003)蜜露是半翅目昆虫取食后产生的含糖物质，这些排泄物主要由蚂蚁收集，但是也有其他昆虫参与。在蚜虫大发生时，如果蜜露不及时清理会导致霉污病的发生，这不仅会影响到植物的生长，也会影响到蚜虫的生长。以蜜露为结点，蚜虫蚂蚁发生复杂的共栖关系。对于种共栖关系的研究已经持续了100多年，其中提出来10多种假说来诠释蚜虫蚂蚁为什么建立共栖关系。但是随着研究的深入，对蚂蚁蚜虫共栖关系的建立有了新的看法。但是大多数的研究都是以生物因素来讨论蚜虫蚂蚁共栖关系，却很少有研究从气候角度来探究蚜虫蚂蚁共栖关系，因此我们选取不同的生态系统，不同的季节来研究蚜虫蚂蚁与气候的关系。对北京东灵山、小龙门森林公园、百花山和广西十万大山地区进行蚜虫蚂蚁共栖物种数据的采集，通过不同季节，不同年份的处理分析发现，与蚜虫建立共栖关系的蚂蚁亚科主要以臭蚁亚科，蚁亚科，切叶蚁亚科为主，其余亚科零星出现。对于东灵山地区来说，在春季与夏季蚜虫物种的优势种群大致相同，但是在秋季由于气候、植被等因素的影响，其优势种群发生改变。对于蚂蚁来说，其优势种群在2018与2019三个季节中并未改变，都为日本弓背蚁，但是其种群数量随着季节的变化不断的改变。万玉斑蚜只与亮毛蚁建立共栖关系。虽然季节对种群数量与物种组成有影响，但是对于整个共栖网络影响较小，不同季节网络参数有一定的波动，但是整体来说较为稳定。 对于在十万大山地区来说，该地区主要以蚜亚科为主。对于蚂蚁来说， 2013年10月、2015年7月和2018年7,2019年7月主要以切叶蚁亚科亚科为主，但在2018年10月则是以蚁亚科和臭蚁亚科为主，季节的波动会影响共栖蚂蚁亚科水平上的组成。虽然季节与年份对种群数量与物种组成有影响，对于整个共栖网络影响较小，不同季节网络参数有一定的波动，但是整体来说较为稳定。对比东灵山来看，十万大山地区网路共栖强度较弱，可能与纬度有一定联系。从蚜虫—蚂蚁共栖关系建立来说，在相同的地区一旦蚜虫与蚂蚁建立共栖关系后，这种关系会一直维持，不会因为季节的变化而导致共栖关系的断裂。从物种组成上来说，与同种蚜虫建立共栖关系的蚂蚁物种会跟随季节，年份的变化而变化，共栖强度也会跟随季节的变化而变化。从共栖网络上来说，共栖网络专化性与连接强度受到季节年份影响的波动较小。系统发育对物种选择建立共栖关系的伙伴与建立共栖关系的次数无影响。蚜虫蚂蚁共栖关系处于动态平衡状态。",
				"libraryCatalog": "中国科学院文献情报中心",
				"thesisType": "硕士",
				"university": "动物研究所",
				"url": "http://dpaper.las.ac.cn/Dpaper/detail/detailNew?paperID=20173144&title=%E4%B8%8D%E5%90%8C%E6%A3%AE%E6%9E%97%E7%94%9F%E6%80%81%E7%B3%BB%E7%BB%9F%E8%9A%9C%E8%99%AB%E4%B8%8E%E8%9A%82%E8%9A%81%E5%85%B1%E6%A0%96%E5%85%B3%E7%B3%BB%E7%A0%94%E7%A9%B6&author=%E9%BE%99%E6%B5%B7&highsearch=training_institution_all%253A345345345%25E5%258A%25A8%25E7%2589%25A9345345345&sortField=score%2520desc%252Cid&start=0&actionType=Browse&searchText=%E5%8A%A8%E7%89%A9",
				"attachments": [
					{
						"title": "不同森林生态系统蚜虫与蚂蚁共栖关系研究",
						"mimeType": "application/pdf"
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
