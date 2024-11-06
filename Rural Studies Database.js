{
	"translatorID": "abb8e571-6776-474e-82fe-8133b22de997",
	"label": "Rural Studies Database",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.ruralchina\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-05 15:11:47"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmial.com>

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
	if (url.includes('BookDetail?')) {
		return 'book';
	}
	else if (url.includes('/XCReport/')) {
		return 'bookSection';
	}
	else if (url.includes('XCImageDetail?')) {
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
	const rows = Array.from(doc.querySelectorAll('#resultList h4 > a')).filter(elm => /\/XCReport\/|(XCImage|Book)Detail\?/i.test(elm.href));
	for (let row of rows) {
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
		if (url.includes('XCImageDetail?')) {
			doc = await requestDocument(attr(doc, '.txt a[href*="XCBookDetail?"]', 'href'));
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
	newItem.libraryCatalog = '乡村研究数据库';
	switch (newItem.itemType) {
		case 'book': {
			const labels = new Labels(doc, '.s4 > p');
			newItem.title = text(doc, '.ts-detail .s1');
			newItem.abstractNote = text(doc, '.z-desc');
			newItem.series = labels.get('丛书名');
			newItem.place = info.province;
			newItem.publisher = info.publishname;
			newItem.date = ZU.strToISO(labels.get('出版时间'));
			newItem.ISBN = ZU.cleanISBN(labels.get('ISBN'));
			newItem.extra = `original-title: ${ZU.capitalizeTitle(text(doc, '.ts-detail .s2').replace(/（([^）]+)）/, '($1)'))}`;
			doc.querySelectorAll('.s3 > *').forEach((elm) => {
				newItem.creators.push(cleanAuthor(elm.textContent, 'author'));
			});
			break;
		}
		case 'bookSection': {
			const labels = new Labels(doc, '.s2 > .item > p');
			const bookLink = attr(labels.get('所属图书', true), 'a', 'href');
			let bookItem = new Z.Item('book');
			try {
				const bookDoc = await requestDocument(bookLink);
				bookItem = await scrape(bookDoc);
				bookItem.creators.forEach((creator) => {
					if (creator.creatorType == 'author') {
						creator.creatorType = 'bookAuthor';
					}
				});
				delete bookItem.itemType;
				delete bookItem.url;
				newItem = Object.assign(newItem, bookItem);
				newItem.bookTitle = bookItem.title;
				const id = tryMatch(url, /\bID=\w+/);
				const pageRanges = bookDoc.querySelectorAll('.wz-box+.s2');
				for (const pages of pageRanges) {
					if (pages.previousElementSibling.querySelector(`a[href*="${id}"]`)) {
						newItem.pages = tryMatch(ZU.trimInternal(pages.textContent), /pp\. (.+)\(/, 1);
						break;
					}
				}
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
			newItem.title = text(doc, '.s1');
			newItem.abstractNote = text(doc, '.sd-row2').replace(/^摘要：\s/, '');
			newItem.creators = Array.from(labels.get('作者', true).querySelectorAll('a'))
				.map(elm => cleanAuthor(elm.textContent, 'author'))
				.concat(newItem.creators);
			newItem.tags = Array.from(doc.querySelectorAll('.sd-row4 a.tag')).map(elm => elm.textContent);
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
		"url": "https://www.ruralchina.cn/xcyj/XCBookDetail?SubLibID=89&SiteID=18&ID=5051494",
		"items": [
			{
				"itemType": "book",
				"title": "中国民族发展报告（2017）",
				"creators": [
					{
						"firstName": "",
						"lastName": "王延中",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "方勇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "尹虎彬",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈建樾",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2017-12-01",
				"ISBN": "9787520118637",
				"abstractNote": "党的十八大以来，我国民族地区认真贯彻落实五大发展理念，全面推进“五位一体”总体布局和“四个全面”战略布局，五大文明建设取得重大进展。但是，民族地区内生发展动力仍然不足、农村居民增收难度很大、扶持项目对劳动力的技能培训不足、城镇化进程阻力因素多、精准扶贫项目的效率有待持续增强、社会治理能力和治理效果相对薄弱、生态环境保护综合效果仍需改进、中华民族共有精神家园建设有待加强，民族地区人民日益增长的美好生活需要和不平衡不充分的发展之间的矛盾依然亟待解决。党的十九大报告提出要团结带领全国各族人民决胜全面建成小康社会。为更好推动各族人民的全面发展、民族地区的全面进步，本书提出如下建议：加强劳动力技能培训、加强民族地区职业教育、进一步加强城乡基本公共服务均等化建设、加大深度贫困地区的精准扶贫与脱贫、构建多元主体供给的公共文化服务体系、兼顾民族因素和地区因素提升民族政策的公平性、妥善处理好民族地区生态保护与经济发展的关系。",
				"extra": "original-title: ANNUAL REPORT ON THE DEVELOPMENT OF ETHNIC IN CHINA (2017)",
				"language": "zh-CN",
				"libraryCatalog": "乡村研究数据库",
				"place": "北京",
				"publisher": "社会科学文献出版社",
				"series": "民族发展蓝皮书",
				"url": "https://www.ruralchina.cn/xcyj/XCBookDetail?SubLibID=89&SiteID=18&ID=5051494",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ruralchina.cn/xcyj/XCReport/previewPage?SiteID=18&ID=7929211",
		"items": [
			{
				"itemType": "bookSection",
				"title": "2023年新疆“三农”舆情分析",
				"creators": [
					{
						"firstName": "",
						"lastName": "百扎提·包加克",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "蔡灿",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "虎啸飞",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "农业农村部信息中心",
						"creatorType": "bookAuthor",
						"fieldMode": 1
					}
				],
				"date": "2024-09-01",
				"ISBN": "9787522841519",
				"abstractNote": "摘要：2023年，新疆交出农业农村高质量发展亮眼成绩单，涉农舆论环境积极向好。新疆粮食产量再创新高，重要农产品供给能力稳步提升，巩固拓展脱贫攻坚成果、全面推进乡村振兴取得新进展，数字乡村建设和智慧农业发展引领农业生产经营方式革新，品牌建设与市场拓展提升“疆品”竞争力，深化农业农村改革增添动能，乡村建设绘就美丽新画卷等受到舆论广泛关注与认可。",
				"bookTitle": "中国“三农”网络舆情报告（2024）",
				"extra": "original-title: THE REPORT ON ONLINE PUBLIC OPINIONS ON CHINA’S AGRICULTURE，RURAL AREAS AND FARMERS (2024)",
				"language": "zh-CN",
				"libraryCatalog": "乡村研究数据库",
				"pages": "297-311",
				"place": "北京",
				"publisher": "社会科学文献出版社",
				"series": "“三农”舆情蓝皮书",
				"url": "https://www.ruralchina.cn/xcyj/XCReport/previewPage?SiteID=18&ID=7929211",
				"attachments": [],
				"tags": [
					{
						"tag": "新疆“三农”舆情"
					},
					{
						"tag": "粮食安全"
					},
					{
						"tag": "防止返贫监测"
					},
					{
						"tag": "高标准农田"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ruralchina.cn/xcyj/XCImageDetail?SiteID=18&type=ImageTable&ID=5533794",
		"items": [
			{
				"itemType": "book",
				"title": "中国农村经济形势分析与预测（2023～2024）",
				"creators": [
					{
						"firstName": "",
						"lastName": "王贵荣",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张海鹏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "韩磊",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-04-01",
				"ISBN": "9787522835105",
				"abstractNote": "2023年农业农村经济保持良好发展态势，对国民经济稳健运行发挥了“压舱石”作用。全年第一产业增加值89755亿元，比上年实际增长4.05%，第一产业增加值在GDP中的占比为7.12%，与上年基本持平。第一产业对GDP实际增长的贡献率为5.94%，拉动GDP实际增长0.31%。农林牧渔业固定资产投资增长1.2%，农副食品加工业和食品制造业固定资产投资分别增长7.7%和12.5%，农业农村经济结构进一步优化升级。乡村社会消费品零售总额64004.9亿元，比上年增长8.0%，在全社会消费品零售总额中的占比上升到13.6%。2023年粮食总产量69541万吨，比上年增长1.3%，再创历史新高。粮食播种面积11897万公顷，增长0.5%，粮食单产5845公斤/公顷，增长0.8%。其中，玉米产量涨幅最大，产量达到28884万吨，增长4.2%。大豆扩面积、提单产取得明显成效，全年大豆种植面积1047万公顷，增长2.2%，大豆产量2084万吨，增长2.8%。小麦产量13659万吨，减少0.8%；稻谷产量20660万吨，减少0.9%。粮食主产区对保障国家粮食安全的贡献进一步凸显。主产区粮食产量占粮食总产量的77.9%，对2023年粮食增产的贡献率达到51.0%。2023年肉、禽、蛋、奶和水产品产量继续保持稳定增长，油、棉、糖生产结构持续优化。全年猪牛羊禽肉产量9641万吨，增长4.5%。其中，猪肉产量5794万吨，增长4.6%；牛肉产量753万吨，增长4.8%；羊肉产量531万吨，增长1.3%；禽肉产量2563万吨，增长4.9%。禽蛋产量3563万吨，增长3.1%。牛奶产量4197万吨，增长6.7%。水产品产量7100万吨，增长3.4%。2023年油料作物种植面积迈上2亿亩台阶，油料总产量3864万吨，增长5.7%。糖料产量11376万吨，增长1.2%。茶叶产量355万吨，增长6.1%。棉花产量561.8万吨，减少6.1%。2023年农产品贸易逆差收窄，主要农产品进口结构性增长。全年农产品进口额2341.1亿美元，下降0.3%；出口额989.3亿美元，增长0.9%；贸易逆差1351.8亿美元，同比收窄1.2%。2023年粮食进口大幅上涨，进口16196万吨，增长11.7%。其中，小麦进口1210万吨，增长21.5%；玉米进口2713万吨，增长31.6%；大豆进口9941万吨，增长11.4%；稻米进口263万吨，下降57.5%。食用植物油进口981万吨，增长51.4%。食糖进口397万吨，下降24.7%。猪肉进口155万吨，下降11.7%；牛肉、羊肉和禽肉进口有不同程度增长。水产品进口501万吨，增长10.6%。2023年农产品与食品价格整体稳中有降。全年农产品生产者价格比上年下降2.3%，是近6年来最大降幅；食品类消费价格下降0.3%，是2010年以来最小降幅。畜牧业产品和蔬菜价格降幅较大，是推动全年农产品与食品价格下降的主要原因。猪、牛、羊价格整体下降，生猪生产者价格降幅最大，达到14%，推动畜肉消费价格下降7.3%。受产量与进口量增长叠加影响，玉米和大豆第四季度生产者价格有较大幅度下降。2023年居民人均食品烟酒支出7983元，增长6.7%，增速不及人均消费支出，带动恩格尔系数下降。2023年全国居民恩格尔系数为29.79%，比上年下降0.7个百分点；城镇居民和农村居民恩格尔系数分别为28.78%和32.35%。2023年涉农工业呈现低速增长态势，涉农服务业发展全面恢复。全年农副食品加工业、食品制造业增加值分别增长0.2%、3.3%。纺织业、木材加工业、医药制造业增加值分别下降0.6%、2.8%、5.8%，造纸业增加值增长3.1%。涉农工业产能利用率整体在75%警戒线附近。预制菜产业发展势头较好，市场规模进一步扩大，但存在市场监管不足和生产标准不统一问题。2023年，冷链物流需求总量为3.5亿吨，增长6.1%，但农产品产区冷链物流基础设施存在明显短板。食物流通渠道进一步多元化，全国农产品网络零售额5870.3亿元，增长12.5%。全国餐饮收入52890亿元，增长20.4%，首次突破5万亿元水平。2023年农村居民收入较快增长。全年农村居民人均可支配收入21691元，实际增长7.6%，涨幅比上年提高3.4个百分点。农村居民人均可支配收入实际增速比城镇居民高2.8个百分点，城乡居民收入比缩小到2.39，比上年下降0.06。工资性收入仍然是农村居民收入的最主要来源；农村居民财产净收入仍然偏低。农村高收入组家庭收入增长8.8%，低收入组家庭收入提升4.8%，收入分配不均衡状况加剧。2023年农民工总量29753万人，较上年增加191万人，增长0.6%；农民工月均收入4780元，增长3.6%。虽然农村劳动务工有序恢复，但农民工规模和收入增速尚未恢复到疫情前水平。2023年农村居民人均消费支出18175元，实际增长9.2%。农村居民消费领域不断拓展，食品烟酒、衣着、居住等生存型消费支出比重下降，交通通信、教育文化娱乐、医疗保健等发展型消费支出比重上升。展望2024年，国民经济回升向好面临有效需求不足、社会预期偏弱、外部环境复杂严峻等困难和挑战，给农业农村经济发展带来一定压力。但是，国家坚持农业农村优先发展，以加快建设农业强国、推进乡村全面振兴为主线，聚焦“两确保、三提升、两强化”方向重点，农业农村经济发展面临的有利条件仍然较为充足。农林牧渔业发展总体保持良好态势，第一产业投资有望恢复增长，乡村消费扩容升级，农产品和食品价格保持基本稳定，涉农产业延续恢复性增长态势，对国民经济稳健运行和高质量发展继续发挥支撑作用。粮食与重要农产品保持稳定安全供给，预计粮食总产量突破7亿吨。畜产品、水产品和蔬菜供应充足，预计全年生猪供应量整体有所下降，但仍高于正常保有量。农产品贸易规模基本持平，继续发挥保障供给和调剂余缺的功能。肉类、乳品、水产品和水果等高价值农产品进口增加，大豆进口增长速度放缓。重要农产品与食品价格在总体稳定的基础上发生结构性波动。全年大豆价格保持低位运行，玉米、猪肉价格有望在下半年企稳回升。食品制造业、冷链物流业、餐饮业等涉农产业规模继续扩大，但国内外市场需求恢复仍不及预期，整体将延续低速增长态势。在多项强化收入举措下，预计农村居民人均可支配收入继续增长，2024年农村居民人均可支配收入增加到2.3万元左右，城乡居民收入比进一步下降到2.35左右。",
				"extra": "original-title: ANALYSIS AND FORECAST ON CHINA’S RURAL ECONOMY (2023-2024)",
				"language": "zh-CN",
				"libraryCatalog": "乡村研究数据库",
				"place": "北京",
				"publisher": "社会科学文献出版社",
				"series": "农村绿皮书",
				"url": "https://www.ruralchina.cn/xcyj/XCImageDetail?SiteID=18&type=ImageTable&ID=5533794",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ruralchina.cn/xcyj/XCRetrievalResult/view?query=%25E7%258E%25B0%25E4%25BB%25A3%25E5%258C%2596&resourceType=all&field=All&search=1&SiteID=18",
		"items": "multiple"
	}
]
/** END TEST CASES **/
