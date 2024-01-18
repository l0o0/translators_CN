{
	"translatorID": "78ba8722-6748-47f4-9976-8985d75a220c",
	"label": "dpaper",
	"creator": "with, jiaojiaodubai",
	"target": "http://dpaper.las.ac.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-18 14:06:55"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2021 with9, 2023 jiaojiaodubai<jiaojiaodubai23@gmail.com>
	
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
	Z.debug('---------- 2024-01-18 22:06:51 ----------');
	if (text(doc, '#education')) {
		return "thesis";
	}
	return false;
}

async function doWeb(doc, url) {
	await scrape(doc, url);
}

async function scrape(doc, url) {
	var newItem = new Z.Item('thesis');
	newItem.title = text(doc, '#title_cn');
	if (text(doc, '#more_abstract_cn') === "【显示更多内容】") {
		//模拟点击显示更多摘要
		await doc.getElementById('more_abstract_cn').click();
	}
	newItem.abstractNote = text(doc, '#abstract_cn');
	newItem.creators.push(ZU.cleanAuthor(text(doc, '#author_name > a'), 'author'));
	let tutor = doc.querySelectorAll('#teacher_name > a');
	tutor.forEach(creator => newItem.creators.push(ZU.cleanAuthor(creator.textContent, 'contributor')));
	newItem.creators.forEach((creator) => {
		if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
	});
	newItem.tags.push(text(doc, '#keyword_cn').split(/[,;，；]/g));
	//毕业时间作为论文发表时间
	newItem.date = ZU.strToISO(text(doc, '#education_grant_time'));
	newItem.thesisType = `${text(doc, '#education')}学位论文`;
	newItem.university = text(doc, '#grant_institution');
	newItem.url = tryMatch(url, /^.+paperID=\w+/i);
	extra.add('original-title', text(doc, '#title_other'), true);
	extra.add('major', text(doc, 'major'));
	extra.add('CSTR', text(doc, '#cstr'));
	newItem.extra = extra.toString();
	newItem.complete();
}


/**
 * Attempts to get the part of the pattern described from the character,
 * and returns an empty string if not match.
 * @param {String} string
 * @param {RegExp} pattern
 * @param {Number} index
 * @returns
 */
function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

const extra = {
	clsFields: [],
	elseFields: [],
	add: function (key, value, cls = false) {
		if (value && cls) {
			this.clsFields.push([key, value]);
		}
		else if (value) {
			this.elseFields.push([key, value]);
		}
	},
	toString: function () {
		return [...this.clsFields, ...this.elseFields]
			.map(entry => `${entry[0]}: ${entry[1]}`)
			.join('\n');
	}
};/** BEGIN TEST CASES **/
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
						"firstName": "THINN SU",
						"lastName": "TIN",
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "陈小勇",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2020-07-01",
				"abstractNote": "因道支湖是缅甸最大的淡水湖之一，位于缅甸北部密支那地区，在北纬25°5'–25°20'和东经96°18'–96°23'之间，海拔约550英尺。在雨季过后，由于湖水蔓延到周围的城市，使得湖泊的面积变得更大。因道支湖具有丰富的水生生态系统和生物多样性。并且因道支湖具有特有种和稀有种鱼类。因此本文的主要目的是保护因道支湖特有种和稀有种鱼类，使鱼类资源得到可持续性发展，以及为相关的保护措施提一些建议。本文以缅甸北部的因道支湖为研究区域，借助香农–威纳指数计算物种多样性指数、运用PAST 4.02软件包采用主成成分分析法（PCA）对鱼类栖息地进行分析、采用SPSS软件包和IUCN红色名录标准对鱼类的生态状况进行评价，于2018年10月至2019年10月期间进行采样，对因道支湖的鱼类物种组成、季节性发生和丰富程度进行评估。研究期间共获得31科106种鱼类。在夏季的第一次采样，获得鱼类标本372尾，得到49种鱼类物种。在5月的雨季进行采样，获得鱼类标本444尾，得到74种鱼类物种。包括2018年10月冬季的采样，共获得鱼类标本849尾，得到鱼类物种80种。2019年10月再次进行采样，获得鱼类标本892尾，得到鱼类物种80种。鱼类物种组成以鲤形目居多。在冬季和雨季得到较高的物种数，旱季的物种数偏低。一共获得鱼类物种106种，其中11种为特有种，83种为土著种，并且似鳞头鳅属的Lepidocephalichthys goalparensis为新纪录。鱼类的形态鉴定根据Munro（1955）、Day（1969）、Jayaram（1987）和Talwar & Jhingaran（1991）。此外，根据对湖泊鱼类的调查，我们应该主要保护特有种鱼类，并且制湖泊的捕捞面积，使鱼类资源可持续性发展。同时加强对湖泊保护的科学研究。",
				"extra": "original-title: Species Diversity of Fishes in Indawgyi Lake, Northern Myanmar\nCSTR: CSTR:35001.37.02.33170.20200008",
				"libraryCatalog": "dpaper",
				"thesisType": "硕士学位论文",
				"university": "中国科学院大学",
				"url": "http://dpaper.las.ac.cn/Dpaper/detail/detailNew?paperID=20172916",
				"attachments": [],
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
						"firstName": "",
						"lastName": "龙海",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "乔格侠",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2020-07-01",
				"abstractNote": "种间关系是促进生物多样性形成的动力因素之一，一直被生物学家广泛研究。近些年来，非紧密联系的种间关系已经成为生物学研究的一个新热点，特别是以蚜虫-蚂蚁为典型的非紧密联系的种间关系。全世界蚜虫大约5000种，几乎分布在温暖的北半球,全世界蚂蚁大约有13000种，广布全球。无论从进化历史还是从物种数目上来看，蚜虫蚂蚁都是较为成功的物种。(Strathdee, Howling et al. 1995, Hulle, Pannetier et al. 2003)蜜露是半翅目昆虫取食后产生的含糖物质，这些排泄物主要由蚂蚁收集，但是也有其他昆虫参与。在蚜虫大发生时，如果蜜露不及时清理会导致霉污病的发生，这不仅会影响到植物的生长，也会影响到蚜虫的生长。以蜜露为结点，蚜虫蚂蚁发生复杂的共栖关系。对于种共栖关系的研究已经持续了100多年，其中提出来10多种假说来诠释蚜虫蚂蚁为什么建立共栖关系。但是随着研究的深入，对蚂蚁蚜虫共栖关系的建立有了新的看法。但是大多数的研究都是以生物因素来讨论蚜虫蚂蚁共栖关系，却很少有研究从气候角度来探究蚜虫蚂蚁共栖关系，因此我们选取不同的生态系统，不同的季节来研究蚜虫蚂蚁与气候的关系。对北京东灵山、小龙门森林公园、百花山和广西十万大山地区进行蚜虫蚂蚁共栖物种数据的采集，通过不同季节，不同年份的处理分析发现，与蚜虫建立共栖关系的蚂蚁亚科主要以臭蚁亚科，蚁亚科，切叶蚁亚科为主，其余亚科零星出现。对于东灵山地区来说，在春季与夏季蚜虫物种的优势种群大致相同，但是在秋季由于气候、植被等因素的影响，其优势种群发生改变。对于蚂蚁来说，其优势种群在2018与2019三个季节中并未改变，都为日本弓背蚁，但是其种群数量随着季节的变化不断的改变。万玉斑蚜只与亮毛蚁建立共栖关系。虽然季节对种群数量与物种组成有影响，但是对于整个共栖网络影响较小，不同季节网络参数有一定的波动，但是整体来说较为稳定。 对于在十万大山地区来说，该地区主要以蚜亚科为主。对于蚂蚁来说， 2013年10月、2015年7月和2018年7,2019年7月主要以切叶蚁亚科亚科为主，但在2018年10月则是以蚁亚科和臭蚁亚科为主，季节的波动会影响共栖蚂蚁亚科水平上的组成。虽然季节与年份对种群数量与物种组成有影响，对于整个共栖网络影响较小，不同季节网络参数有一定的波动，但是整体来说较为稳定。对比东灵山来看，十万大山地区网路共栖强度较弱，可能与纬度有一定联系。从蚜虫—蚂蚁共栖关系建立来说，在相同的地区一旦蚜虫与蚂蚁建立共栖关系后，这种关系会一直维持，不会因为季节的变化而导致共栖关系的断裂。从物种组成上来说，与同种蚜虫建立共栖关系的蚂蚁物种会跟随季节，年份的变化而变化，共栖强度也会跟随季节的变化而变化。从共栖网络上来说，共栖网络专化性与连接强度受到季节年份影响的波动较小。系统发育对物种选择建立共栖关系的伙伴与建立共栖关系的次数无影响。蚜虫蚂蚁共栖关系处于动态平衡状态。",
				"extra": "original-title: Study on the symbiotic relationship between aphid and ant in different forest ecosystems\nCSTR: CSTR:35001.37.02.33146.20200040",
				"libraryCatalog": "dpaper",
				"thesisType": "硕士学位论文",
				"university": "中国科学院大学",
				"url": "http://dpaper.las.ac.cn/Dpaper/detail/detailNew?paperID=20173144",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
