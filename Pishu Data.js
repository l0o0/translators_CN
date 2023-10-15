{
	"translatorID": "8651aa89-eb54-47bc-9916-17720fe22a86",
	"label": "Pishu Data",
	"creator": "jiaojiaodubai23",
	"target": "https?://www.pishu.com.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-10 16:24:08"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai23@gmail.com

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


function detectWeb(doc, url) {
	if (url.includes('/bookDetail?')) {
		return 'book';
	}
	else if (url.includes('contentType=literature') || url.includes('/literature/')) {
		return 'bookSection';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.searCon > .searCon_tit > a');
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
	var type = detectWeb(doc, url);
	if (type == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			await ZU.doGet(
				url,
				function(getresult) {
					// Z.debug(getresult);
					var parser = new DOMParser();
					getresult = parser.parseFromString(getresult, "text/html");
					var type = detectWeb(doc, url);
					scrape(getresult, url, type);
				}
			);
		}
	}
	else {
		await scrape(doc, url, type);
	}
}

function match_creators(raw_text) {
	raw_text = raw_text.replace(/(&nbsp;)/g, '');
	var zhnamesplit = Z.getHiddenPref('zhnamesplit');
	var creators = raw_text.split(' ');
	for (var i = 0, n = creators.length; i < n; i++) {
		creator = creators[i];
		/* 暂未见西文名案例 */
		// if (creator.lastName.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
		// 	// western name. split on last space
		// 	creator.firstName = creator.lastName.substr(0, lastSpace);
		// 	creator.lastName = creator.lastName.substr(lastSpace + 1);
		// }
		// else
		if ((zhnamesplit === undefined) ? true : zhnamesplit) {
			// zhnamesplit is true, split firstname and lastname.
			// Chinese name. first character is last name, the rest are first name
			creator = {
				"firstName": creator.substr(1),
				"lastName": creator.charAt(0),
				"creatorType": "author",
			};
		}
		else {
			creator = {
				"lastName": creator,
				"creatorType": "author",
			};
		}
		creators[i] = creator;
	}
	return creators;
}

async function scrape_multi(doc, url) {

}

async function scrape(doc, url = doc.location.href, type) {
	// Z.debug(typeof(doc));
	// Z.debug(url);
	const jspath = {
		'book': 'head style:first-of-type + script',
		'bookSection': 'div.data_foot.margintop20 > script:first-of-type'
	}[type];
	var jsdata = {
		text: doc.querySelector(jspath).textContent,
		getVar: function(varname) {
			var expression = this.text.match(new RegExp(`var ${varname} = .*`))[0];
			const vartext = new Function(`${expression};\n return ${varname}`);
			return vartext();
		}
	}
	var newItem = new Z.Item(type);
	newItem.title = jsdata.getVar('title');
	newItem.creators = match_creators(jsdata.getVar('author'));
	newItem.date = jsdata.getVar('publishdate');
	newItem.place = jsdata.getVar('province');
	newItem.publisher = jsdata.getVar('publishname');
	newItem.abstractNote = ZU.trimInternal(ZU.xpath(doc, '//div[@class="summaryCon"]')[0].innerText);
	if (type == 'book') {
		var data = {};
		let data_counts = ZU.xpath(doc, '//div[@class="books margintop10"]//table/tbody')[0].childElementCount;
		for (let i = 1; i <= data_counts; i++) {
			let label = ZU.xpath(doc, `//div[@class="books margintop10"]//table/tbody/tr[${i}]/td[1]`)[0].innerText.replace(/\s/g, '');
			let value = ZU.xpath(doc, `//div[@class="books margintop10"]//table/tbody/tr[${i}]/td[2]`)[0];
			data[label] = value;
		}
		newItem.ISBN = data['ISBN：'].innerText;
		newItem.tags = data['关键词：'].textContent.trim().split(/\s/).map((element) => ({"tag": element}));
		newItem.series = data['丛书名：'].innerText;
	}
	else {
		newItem.bookTitle = jsdata.getVar('pertainbook');
		newItem.pages = jsdata.getVar('ebookNumber');
		newItem.tags = ZU.xpath(doc, '//div[@class="zl_keywords"][1]//a').map((element) => ({"tag": element.innerText}));
		newItem.seeAlso.push(ZU.xpath(doc, '//ul[@class="Buy_detail"]/li/a')[0].href);
	}
	newItem.attachments.push({
		'url': url,
		'document': doc,
		'tittle': 'Snapshot',
		'mimeType': 'text/html'
	});
	newItem.url = url;
	newItem.complete();
}







/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.pishu.com.cn/skwx_ps/literature/6334/14724751.html",
		"items": [
			{
				"itemType": "bookSection",
				"title": "以平台经济增加中低收入群体要素收入",
				"creators": [
					{
						"firstName": "利涛",
						"lastName": "端",
						"creatorType": "author"
					}
				],
				"date": "2023-08",
				"abstractNote": "按要素分配是中国特色社会主义市场经济分配制度的重要内容，探索多种渠道增加中低收入群体要素收入是当下推进共同富裕的重要任务。本文梳理了平台经济中的劳动要素收入分配情况，认为平台经济可以作为增加中低收入群体要素收入的重要途径。增加劳动就业、优化收入分配和改善公共服务是平台经济增加要素收入的三个着力点。在此基础上，本文提出平台经济增加中低收入群体要素收入的实现路径：第一，规范和保障零工经济发展；第二，加快推进平台经济均衡发展；第三，大力推广基于平台模式的共享经济。",
				"bookTitle": "中国五年规划发展报告（2022～2023）",
				"libraryCatalog": "Pishu Data",
				"pages": "597-613",
				"place": "北京",
				"publisher": "社会科学文献出版社",
				"url": "https://www.pishu.com.cn/skwx_ps/literature/6334/14724751.html",
				"attachments": [
					{
						"tittle": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "中低收入群体"
					},
					{
						"tag": "平台经济"
					},
					{
						"tag": "要素收入"
					}
				],
				"notes": [],
				"seeAlso": [
					"https://www.pishu.com.cn/skwx_ps/bookdetail?SiteID=14&ID=14722402"
				]
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.pishu.com.cn/skwx_ps/initDatabaseDetail?siteId=14&contentId=13484900&contentType=literature",
		"items": [
			{
				"itemType": "bookSection",
				"title": "从“无理论”的教育到“无教育”的理论",
				"creators": [
					{
						"firstName": "永胜",
						"lastName": "吴",
						"creatorType": "author"
					}
				],
				"date": "2021-07",
				"abstractNote": "正如杰克·古迪所说：“人类思维的细分能力，是与社会生活不断分化的进程相随发展的。”伴随着实践领域的日益细分，理论领域也日益走向专业化，各个实践领域都有相对应的理论类型。在教育领域中，“无理论”的教育现象与“无教育”的理论现象的普遍存在，造成了教育理论与实践之间的长期疏离。通过对教育理论的实践性问题的探讨，对这个老问题做出尝试性的新回答，既是学术之需，亦为个人之趣。文献和现实的双重阅读，要求在探讨教育理论的实践性问题时，改变从理论建设的立场去谈教育理论之实践性的原有研究套路。实践之于理论的框架或基底作用决定了有必要尝试彻底地转换思路，即教育实践到底需要什么样的教育理论，已有理论能否满足教育实践的需要，什么样的理论路径才能使之满足教育实践的需要。如此，不再是为理论而理论，而是为实践而理论。\n<<",
				"bookTitle": "从批判到重构",
				"libraryCatalog": "Pishu Data",
				"pages": "1-29",
				"place": "北京",
				"publisher": "社会科学文献出版社",
				"url": "https://www.pishu.com.cn/skwx_ps/initDatabaseDetail?siteId=14&contentId=13484900&contentType=literature",
				"attachments": [
					{
						"tittle": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "“无教育”"
					},
					{
						"tag": "“无理论”"
					},
					{
						"tag": "教育理论"
					}
				],
				"notes": [],
				"seeAlso": [
					"https://www.pishu.com.cn/skwx_ps/bookdetail?SiteID=14&ID=13484778"
				]
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.pishu.com.cn/skwx_ps/bookDetail?SiteID=14&ID=13395521",
		"items": [
			{
				"itemType": "book",
				"title": "上海合作组织20年",
				"creators": [
					{
						"firstName": "进峰",
						"lastName": "李",
						"creatorType": "author"
					}
				],
				"date": "2021-07",
				"ISBN": "9787520178181",
				"abstractNote": "2021年是上海合作组织成立20周年。20年来，上合组织经受了来自本地区和外部世界的种种考验，不断发展、壮大，自2017年扩员后，上合组织已成为全球人口最多、幅员最辽阔的地区组织，也成为维护世界和平与稳定的重要力量之一。\n\n本书对上合组织20年来的发展历程进行了全面回顾和梳理，总结了20年来上合组织在政治、安全、经济、人文和对外关系五大领域的合作成就，深入分析了上合组织在发展过程中存在的问题和面临的内、外部挑战，以及上合组织未来发展的机遇与前景，提出上合组织的理论基础有三个来源、上合组织发展经历了五次理论创新、上合组织未来发展壮大将取决于三个因素，并对上合组织未来发展预测了三种可能的模式，这些研究结论具有创新性。\n\n本书对上合组织20年发展状况的论述，既有实践分析，又有理论探讨；既有量化研究，也有定性研判；既有问题意识，也有政策建议。本书是上合组织研究领域非常重要也相当权威的一部参考书和工具书。",
				"libraryCatalog": "Pishu Data",
				"url": "https://www.pishu.com.cn/skwx_ps/bookDetail?SiteID=14&ID=13395521",
				"attachments": [
					{
						"tittle": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "上海合作组织"
					},
					{
						"tag": "人文合作"
					},
					{
						"tag": "安全合作"
					},
					{
						"tag": "政治合作"
					},
					{
						"tag": "经济合作"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
