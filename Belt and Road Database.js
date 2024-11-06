{
	"translatorID": "c43bec1b-ba31-4a34-a0dd-4f25aeac04ad",
	"label": "Belt and Road Database",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.ydylcn\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-05 13:44:06"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	if (/\/initDatabaseDetail\?/i.test(url)) {
		return 'bookSection';
	}
	else if (/\/(book|competitiveReport)Detail\?/i.test(url)) {
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = Array.from(doc.querySelectorAll('#resultList > li > h4 > a'))
		.filter(elm => /\/(initDatabase|book|competitiveReport)Detail\?/i.test(elm.href));
	for (const row of rows) {
		const href = row.href;
		const title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url of Object.keys(items)) {
			const newItem = await scrape(await requestDocument(url));
			newItem.complete();
		}
	}
	else {
		if (/\/competitiveReportDetail\?/i.test(url)) {
			doc = await requestDocument(attr(doc, 'a[href*="/bookdetail?"],a[href*="/bookDetail?"]', 'href'));
		}
		const newItem = await scrape(doc, url);
		newItem.complete();
	}
}

async function scrape(doc, url = doc.location.href) {
	let newItem = new Z.Item(detectWeb(doc, url));
	const info = {};
	ZU.xpathText(doc, '//script[contains(text(), "#makeCitation")]').match(/var [^=]+ = "[^"]+"/g).forEach((assignment) => {
		const key = tryMatch(assignment, /var ([^=]+) =/, 1);
		const value = tryMatch(assignment, /= "([^"]+)"/, 1);
		info[key] = value;
	});
	Z.debug(info);
	newItem.language = 'zh-CN';
	newItem.url = url;
	newItem.libraryCatalog = '“一带一路”数据库';
	switch (newItem.itemType) {
		case 'book': {
			const labels = new Labels(doc, '.desc > p,.info~.item');
			newItem.title = labels.get('书名');
			newItem.extra = `original-title: ${ZU.capitalizeTitle(labels.get('英文名').replace(/（([^）]+)）/, '($1)'))}`;
			const abstract = labels.get('中文摘要', true);
			newItem.abstractNote = text(abstract, '.txt').replace(/\s*收起/, '') || text(abstract, '.text1');
			newItem.series = labels.get('丛书名');
			newItem.place = info.province;
			newItem.publisher = info.publishname;
			newItem.date = labels.get('出版时间');
			newItem.ISBN = labels.get('ISBN');
			let authorGroup = [];
			let role;
			doc.querySelectorAll('.author-list > a').forEach((elm) => {
				const elmCopy = elm.cloneNode(true);
				role = elmCopy.querySelector('.author-role');
				if (role) {
					elmCopy.removeChild(role);
					authorGroup.push(elmCopy.textContent);
					if (/著/.test(role.textContent)) {
						authorGroup.forEach(name => newItem.creators.push(cleanAuthor(name, 'author')));
					}
					else if (/编/.test(role.textContent)) {
						authorGroup.forEach(name => newItem.creators.push(cleanAuthor(name, 'editor')));
					}
					else if (/译/.test(role.textContent)) {
						authorGroup.forEach(name => newItem.creators.push(cleanAuthor(name, 'translator')));
					}
					authorGroup = [];
				}
				else {
					authorGroup.push(elm.textContent);
				}
			});
			if (authorGroup.length && !role) {
				authorGroup.forEach(name => newItem.creators.push(cleanAuthor(name, 'author')));
			}
			labels.get('关键词', true).querySelectorAll('a').forEach((elm) => {
				newItem.tags.push(elm.textContent);
			});
			break;
		}
		case 'bookSection': {
			const labels = new Labels(doc, '.con > span');
			const bookLink = attr(labels.get('所属图书', true), 'a', 'href');
			let bookItem = new Z.Item('book');
			try {
				bookItem = await scrape(await requestDocument(bookLink));
				bookItem.creators.forEach((creator) => {
					if (creator.creatorType == 'author') {
						creator.creatorType = 'bookAuthor';
					}
				});
				delete bookItem.itemType;
				delete bookItem.url;
				newItem = Object.assign(newItem, bookItem);
				newItem.bookTitle = bookItem.title;
			}
			catch (error) {
				Z.debug(error);
				newItem.bookTitle = labels.get('所属图书');
				newItem.series = labels.get('丛书名');
				newItem.place = info.province;
				newItem.publisher = info.publishname;
				newItem.date = labels.get('出版时间');
				if (info.bookauthor) {
					info.bookauthor.split(',').forEach(name => newItem.creators.push(cleanAuthor(name, 'bookAuthor')));
				}
			}
			newItem.title = text(doc, '.info > h1');
			newItem.abstractNote = text(doc, '.txt').replace(/\s*收起/, '') || text(doc, '.text1');
			newItem.pages = info.ebookNumber;
			newItem.creators = info.author.split(' ')
				.map(name => cleanAuthor(name, 'author'))
				.concat(newItem.creators);
			newItem.tags = Array.from(doc.querySelectorAll('.keywords > a')).map(elm => elm.textContent);
			break;
		}
	}
	return newItem;
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				const elmCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elmCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elmCopy.removeChild(elmCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elmCopy.childNodes.length > 1) {
					const key = elmCopy.removeChild(elmCopy.firstChild).textContent.replace(/\s/g, '');
					this.data.push([key, elmCopy]);
				}
				else {
					const text = ZU.trimInternal(elmCopy.textContent);
					const key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elmCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.data.push([key, elmCopy]);
				}
			});
	}

	get(label, element = false) {
		if (Array.isArray(label)) {
			const results = label
				.map(aLabel => this.get(aLabel, element));
			const keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElm
					: '';
		}
		const pattern = new RegExp(label, 'i');
		const keyVal = this.data.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElm
				: '';
	}
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	if (match && match[index]) {
		return match[index];
	}
	return '';
}

function cleanAuthor(creator, creatorType = 'author') {
	creator = ZU.cleanAuthor(creator, creatorType);
	if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
		creator.fieldMode = 1;
	}
	return creator;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.ydylcn.com/skwx_ydyl/bookdetail?SiteID=1&ID=11626340",
		"items": [
			{
				"itemType": "book",
				"title": "世界能源发展报告（2023）",
				"creators": [
					{
						"firstName": "",
						"lastName": "中国社会科学院大学（研究生院）国际能源安全研究中心",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "黄晓勇",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈卫东",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王永中",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王炜",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2023-09",
				"ISBN": "9787522825625",
				"abstractNote": "《世界能源发展报告（2023）》聚焦2022年世界石油、天然气、煤炭、电力市场和可再生能源的整体发展情况，着重对其发展过程中呈现的特点，从影响因素、各相关表现和未来变化趋势等方面进行梳理，并对影响能源市场发展的重要事件和区域进行了深入探究和分析，在此基础上对2023年世界能源供需和价格走势进行预测，同时对中国能源发展现状进行分析，对中国能源各领域的发展战略提出有针对性的建议。回顾2022年，全球新冠疫情反复、俄乌冲突爆发、中美关系更加错综复杂、能源绿色低碳转型进程提速等事件或因素对全球能源市场都有重大影响，能源商品的政治属性进一步凸显。数十年以来形成的全球能源生产和消费格局、市场供需形势和价格、贸易走向和渠道受到前所未有的冲击。欧美制裁导致俄罗斯国内石油和天然气供应下降，大量外资企业撤资，石油和天然气外输通道受阻，区域性油气供需失衡，并进一步拉高了国际油气价格。同时，欧洲从全球其他地区“寻油找气”打破了能源市场既有的平衡，欧盟对俄罗斯的油气限价扭曲了市场机制，地缘政治局势的持续演进将推动全球油气格局进入深度调整期。2022年3月布伦特油价冲高至123美元/桶。从全年平均收盘价格看，2022年布伦特原油期货均价为98.86美元/桶，WTI原油期货均价为94.33美元/桶，分别比2021年的70.95美元/桶和68.01美元/桶高27.91美元/桶和26.32美元/桶，涨幅近40%。俄乌冲突对全球能源市场造成很大冲击，欧洲天然气市场首当其冲。欧洲对俄罗斯管道天然气的高度依赖、西方对俄能源制裁和俄罗斯的反制措施，使欧洲天然气供给严重短缺，2022年8月26日欧洲TTF天然气价格冲高至339欧元/兆瓦时（约100美元/百万英热单位）的历史高点。总体上看，相对于区域化的天然气和煤炭市场，全球化、金融化程度更高的国际原油市场贸易流向调整相对容易，这使国际原油价格虽出现较大波动，但涨幅远小于天然气、煤炭。2022年部分国家鼓励重返煤炭利用。受风力发电不足、核电机组关闭、天然气价格暴涨等因素影响，全球煤炭价格持续上涨，不断创出新的纪录，并全年维持在高位。2022年，全球煤炭消费量增长1.2%，年度消费量首次超过80亿吨，全球煤炭产量增长至83.18亿吨，同比增长1.77%。全球电力需求在2020年经历小幅下降之后，呈现连续两年恢复态势。2022年全球电力需求同比增长约2%，与新冠疫情前5年平均增长率（2.4%）基本持平，但明显低于2021年的增长率（6%）。2022年可再生能源发电仍以创纪录的水平增长。截至2022年底，全球可再生能源总发电装机容量达到3372吉瓦，较上年增加295吉瓦，增幅达9.6%。其中，2022年新增发电装机容量的83%来自可再生能源，高于2021年的78%，可再生能源装机容量占总发电装机的比例由2021年的38.3%提升至40.2%。除风电和光伏等可再生能源快速发展外，全球核电也迎来了新的发展期。部分国家鼓励核能启用与新建，欧盟不仅重新将核能定义为清洁能源，而且认为核能将作为一种稳定型的能源长期存在。展望2023年，俄乌冲突导致世界各国对能源安全的关注度进一步提高，不少国家通过采取提高能源自给率和推动能源结构绿色低碳转型的方式保障能源供给安全，从而减弱了世界进口石油和天然气的需求。俄乌冲突对全球能源供应的影响正不断递减，全球能源市场波动将逐步缓和。国际能源署的预测认为，2023年全球石油需求将增加200万桶/日，升至创纪录的10190万桶/日，其中中国等发展中国家将贡献90%的增长份额，发达国家的石油需求将因制造业疲软而下降，而OPEC+的额外自动减产计划预计导致2023年全球原油产量比上年下降40万桶/日。欧洲冬季天然气和能源供应脆弱性大，不排除天然气供应短缺会导致国际油价上涨。总体上看，在2023年下半年至2024年，国际原油价格将总体上维持波动行情，中枢价格将维持在80美元/桶左右。全球LNG供应短缺状态将继续维持，欧洲天然气价格将显著低于2022年水平，但仍高位波动，且欧洲的LNG价格将有可能继续高于亚洲，但价差将大幅缩窄。国际能源署预计，2023年煤炭需求仍将保持强劲，全球煤炭产量将达到峰值。电力方面，随着以中国、印度和东南亚国家为首的新兴市场和发展中经济体电力消费的增加，2023年全球电力需求将加速增长，年增幅预计3%。在全球能源危机、化石燃料价格飙升、气候目标提高的大背景下，核能迎来了复兴的机会。国际能源署预测，至少有30个国家将扩大核能的使用。随着可再生能源在成本方面竞争力的提高，以及鼓励能源绿色低碳转型政策的普及，可再生能源规模迅速扩大，其在全球一次能源中的占比从2019年10%左右提升至2050年的35%～65%。2022年中国能源行业发展取得了积极成效。2019年正式实施油气增储上产“七年行动计划”以来，中国油气企业持续加大勘探开发资金和科技投入力度，高质量完成各年度计划目标，增储上产成果密集显现，持续助力中国油气对外依存度的降低。在化石能源安全保障水平稳步提高的同时，我国可再生能源发展取得举世瞩目的成就。一是非化石能源发电装机占总装机容量的比重接近50%。2022年，全国新增发电装机容量2.0亿千瓦，其中新增非化石能源发电装机容量1.6亿千瓦，均创历史新高。截至2022年底，全国全口径发电装机容量25.6亿千瓦，其中非化石能源发电装机容量12.7亿千瓦，同比增长13.8%，占总装机容量的比重上升至49.6%，同比提高2.6个百分点，电力发展延续绿色低碳转型趋势。二是可再生能源发电量达2.7万亿千瓦时，占全国总发电量的31.3%；可再生能源新增发电量占全国新增发电量的81%，已成为我国新增发电量的主要来源。其中，风电、光伏发电量达到1.19万亿千瓦时。热点篇深入阐述和分析了亚太地区能源转型所需关键矿物供应链的现状及各国制定的相关战略，以及人民币油气贸易的发展。前沿篇聚焦能源行业前瞻性问题，从多个维度深入分析了可再生能源比例上升对电力系统稳定性的影响、世界储能技术和节能市场的现状与发展前景、世界锂市场的现状等可再生能源发展的行业热点问题。前沿篇还对中国新型能源体系的政策内涵与构建路径、“十四五”时期中国天然气市场发展趋势、中国城市碳达峰指数与市场动量进行了独到的分析，对中国区域发展与能源消费转型体系进行了深入研究。",
				"extra": "original-title: ANNUAL DEVELOPMENT REPORT ON WORLD ENERGY (2023)",
				"language": "zh-CN",
				"libraryCatalog": "“一带一路”数据库",
				"place": "北京",
				"publisher": "社会科学文献出版社",
				"series": "世界能源蓝皮书",
				"url": "https://www.ydylcn.com/skwx_ydyl/bookdetail?SiteID=1&ID=11626340",
				"attachments": [],
				"tags": [
					{
						"tag": "世界"
					},
					{
						"tag": "研究报告"
					},
					{
						"tag": "能源工业"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ydylcn.com/skwx_ydyl/initDatabaseDetail?siteId=1&contentId=11626398&contentType=literature",
		"items": [
			{
				"itemType": "bookSection",
				"title": "2022年能源安全新挑战背景下的全球核电复兴",
				"creators": [
					{
						"firstName": "",
						"lastName": "尹向勇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "周杰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "尹智鹏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "尹舒引",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "中国社会科学院大学（研究生院）国际能源安全研究中心",
						"creatorType": "bookAuthor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "黄晓勇",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈卫东",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王永中",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王炜",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2023-09",
				"ISBN": "9787522825625",
				"abstractNote": "文章摘要：2022年，俄乌冲突加剧了国际局势的紧张和对立，地缘政治成为影响国际能源市场和各国能源战略调整的重要因素。为应对大国军事冲突引发的能源危机和重构能源安全环境，各国和地区纷纷进行了能源战略调整。从供给侧来说，核电不仅能凭借其高能量密度和高可靠性确保安全稳定出力，而且可以通过核燃料循环实现铀资源高效利用，特别是在储运环节，还可发挥燃料战略储备的安全保障优势，又可避免海上通道运输风险；从需求侧来说，核电与火电、可再生能源发电相比具有明显的经济性...  展开",
				"bookTitle": "世界能源发展报告（2023）",
				"extra": "original-title: ANNUAL DEVELOPMENT REPORT ON WORLD ENERGY (2023)",
				"language": "zh-CN",
				"libraryCatalog": "“一带一路”数据库",
				"pages": "93-114",
				"place": "北京",
				"publisher": "社会科学文献出版社",
				"series": "世界能源蓝皮书",
				"url": "https://www.ydylcn.com/skwx_ydyl/expertsDetail?authorID=",
				"attachments": [],
				"tags": [
					{
						"tag": "Energy Strategy"
					},
					{
						"tag": "Geopolitics"
					},
					{
						"tag": "Nuclear Power"
					},
					{
						"tag": "Security"
					},
					{
						"tag": "地缘政治"
					},
					{
						"tag": "核能"
					},
					{
						"tag": "能源安全"
					},
					{
						"tag": "能源战略"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ydylcn.com/skwx_ydyl/search?query=%25E5%25B9%25BF%25E8%25A5%25BF&resourceType=Book,Literature,ImageTable,News&field=All&search=1&SiteID=1",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.ydylcn.com/skwx_ydyl/competitiveReportDetail?SiteID=1&contentId=10273944&contentType=literature&subLibID=8730&mediaID=10576885",
		"items": [
			{
				"itemType": "book",
				"title": "“一带一路”建设发展报告（2020）",
				"creators": [
					{
						"firstName": "",
						"lastName": "柴瑜",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王晓泉",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "任晶晶",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王晨星",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2020-08",
				"ISBN": "9787520168847",
				"abstractNote": "《“一带一路”建设发展报告（2020）》分为总报告、分报告、国际合作篇、国内区域篇、专题篇五部分。总报告指出，共建“一带一路”以开放为导向，以推动共建国家经济发展为目标。“一带一路”倡议不同于既有的国际经贸合作机制，其开放性是加强参与国家经贸联系、推动国际经济合作与发展的基本力量。“一带一路”的开放性有助于参与地区和国家的经济发展，满足经济发展的差异化需求，促进经济的内生性发展，实现互利共赢的目标，对推动经济全球化、构建开放型世界经济具有重要意义，并为高质量共建“一带一路”提供了新的路径模式。分报告重点介绍和分析了中国与“一带一路”共建国家在贸易、投资、产能、科技、安全等领域的合作。在贸易合作领域，中国与共建国家的贸易规模不断扩大，区域贸易结构得到进一步优化，以自贸区建设为基础的贸易便利化水平持续提升。在投资合作领域，中国在共建国家投资规模整体呈增长趋势，投资地区分布邻近化特征明显，且分布较为集中，投资行业结构进一步优化。在产能合作领域，中国与共建国家产能合作在地域上越来越广，境外经贸合作区稳步推进，第三方合作伙伴进一步增多，产能合作政策环境进一步优化。在科技合作领域，中国加强与各国在科技创新领域的务实合作，推动共建“一带一路”创新共同体，不断提升各国发展动力与活力，逐渐形成区域创新发展合作新格局。在安全合作领域，中国与“一带一路”共建国家安全合作不断充实，共同、综合、合作、可持续的新安全观得到越来越多国家的认同，中国在维护国际安全中发挥的积极作用得到越来越多国家的认可。国际合作篇介绍和分析了中国与俄罗斯、中亚、西亚、南亚、非洲及日本等国家和地区在“一带一路”建设中的合作现状。六年来，中俄两国在经贸、能源、金融、地方、航空航天、互联互通、人文等领域的合作取得了丰硕成果，积极推动欧亚区域一体化进程，促进了区域经济融合发展。中国与中亚国家在“一带一路”框架下的合作有序推进，金融合作实现突破，经贸合作稳步发展，民心相通继续推进。中国与西亚国家在“一带一路”建设中的合作平台愈加成熟完善，平台运转更加流畅高效。中国在南亚地区推进“一带一路”建设取得重要进展，但风险与挑战依然存在。中非合作共建“一带一路”进入绘制“工笔画”新阶段，取得了一系列重要成果，成为“一带一路”国际合作的新亮点。中日两国在“一带一路”建设框架下积极开展第三方市场合作，共同推进高质量、高标准、高水平基础设施建设，在推动实现多方共赢的同时也促进了双边关系的改善与发展。国内区域篇着重介绍和分析了广东、吉林、辽宁、安徽四省参与“一带一路”建设规划和实施的情况。广东省立足自身优势领域，紧密围绕将粤港澳大湾区打造成为“一带一路”建设重要支撑区的要求，制定有关实施行动方案，推动各领域重点工作取得实质性进展。作为“一带一路”建设向北开放的重要窗口，吉林省对外合作稳步推进，在对外通道、合作平台、先行先试等方面取得显著成效，规划实施了“一主、六双”产业空间布局，推动“一带一路”建设取得了积极成果。辽宁省在全国率先提出在省级层面探索全域创建“一带一路”综合试验区，构建“一体两翼”对外开放新格局，聚焦五大重点领域，推动“一带一路”国际合作在具体化、项目化上取得新突破。安徽省针对自身基础设施薄弱、外向型经济总体规模偏小等实际情况，结合本省若干重要部署，提出并实施了完善交通运输基础设施建设、拓宽“一带一路”国际通道等若干举措，在积极打造内陆开放新高地上取得了新进展。专题篇研究了中国与“一带一路”共建国家在重大规划及项目风险、国际舆情等领域的合作现状与未来前景。资金融通是“一带一路”建设的重要支撑和保障，中国与共建国家通过开展资金融通开发，能够便利贸易结算和降低汇率风险，推动人民币国际化，助力中国企业海外资产配置，推动“一带一路”共建国家经济增长。要构建多元主体参与的风险防控体系，解决“一带一路”重大规划及项目投资面临的风险。应推动“一带一路”民心工程建设，继续夯实政治互信、做实媒体影响、积极引导文化旅游，为更广泛的人文交流创造条件。近年来，“一带一路”建设的国际舆论环境明显改善。第二届“一带一路”国际合作高峰论坛的成功举办获得国际舆论广泛赞誉，使“一带一路”国际舆论环境出现稳中向好的积极变化，国际社会对继续推进和加强“一带一路”国际合作普遍抱以更高期待，希望实现更好愿景。",
				"extra": "original-title: ANNUAL REPORT ON DEVELOPMENT OF “THE BELT AND ROAD” CONSTRUCTION (2020)",
				"language": "zh-CN",
				"libraryCatalog": "“一带一路”数据库",
				"place": "北京",
				"publisher": "社会科学文献出版社",
				"series": "“一带一路”蓝皮书",
				"url": "https://www.ydylcn.com/skwx_ydyl/competitiveReportDetail?SiteID=1&contentId=10273944&contentType=literature&subLibID=8730&mediaID=10576885",
				"attachments": [],
				"tags": [
					{
						"tag": "“一带一路”"
					},
					{
						"tag": "国际合作"
					},
					{
						"tag": "国际经济合作"
					},
					{
						"tag": "经贸合作"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
