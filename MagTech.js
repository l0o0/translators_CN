{
	"translatorID": "69614630-f9e8-440d-9a7c-1f4fd7edf191",
	"label": "MagTech",
	"creator": "jiaojiaodubai",
	"target": "",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 200,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-06-03 01:54:17"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2025 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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

const itemPages = {
	accordion: '#accordion',
	modal: '#magModal',
	tab: '#container ul.tabs-nav'
};

function detectWeb(doc, _url) {
	const isTypical = Object.keys(itemPages).some(page => doc.querySelector(itemPages[page]));
	const hasTitle = doc.querySelector('meta[name="citation_title"], meta[name="dc.title"], meta[name="dc.title"]');
	const inSite = doc.querySelector('a[href*="magtech.com"], [class^="mag-"]');
	if (hasTitle && (isTypical || inSite)) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	// Covered most cases
	// e.g. .j-title > a, http://www.cjn.org.cn/CN/home
	// e.g. .title > a, http://www.zgyxcx.com/CN/volumn/home.shtml
	// e.g. a.txt_biaoti, a.biaoti, http://www.zgswfz.com.cn/CN/2095-039X/home.shtml
	// e.g. .biaoti > a, https://www.ams.org.cn/CN/0412-1961/home.shtml
	const rows = doc.querySelectorAll(':where([class$="title"], .biaoti) > a, a[class$="biaoti"]');
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
		const items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	function getEnMeta(name) {
		return attr(doc, `meta[name="${name}"][xml\\:lang="en"]`);
	}

	const translator = Zotero.loadTranslator('web');
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);
	
	translator.setHandler('itemDone', (_obj, item) => {
		item.abstractNote = text(doc, '[name="#abstract"] .panel-body> p:first-child').replace(/^摘要：/, '')
			|| text(doc, '.zhaiyaojs > .main_content_center_left_zhengwen:first-child')
			|| text(doc, 'span.J_zhaiyao')
			|| item.abstractNote;

		if (item.language) {
			item.language = ['zh', 'cn', 'zh-cn', 'chi'].includes(item.language) ? 'zh-CN' : 'en-US';
		}

		if (!item.url) {
			item.url = url;
		}

		if (!item.extra) {
			item.extra = '';
		}
		else {
			item.extra = item.extra.replace(/\n$/, '');
		}
		function addExtra(field, value) {
			if (value) {
				item.extra += `\n${field}: ${value}`;
			}
		}

		addExtra('original-title', ZU.capitalizeTitle(getEnMeta('citation_title')));
		addExtra('original-container-title', ZU.capitalizeTitle(getEnMeta('citation_journal_title')));

		for (const metaName of [
			'citation_author',
			'citation_authors',
			'dc.creator',
			'DC.Contributor',
			'authors'
		]) {
			const zhNodes = doc.querySelectorAll(`meta[name="${metaName}"]:where([xml\\:lang="zh"], [xml\\:lang="cn"], :not([xml\\:lang]))`);
			if (zhNodes.length) {
				const enNodes = doc.querySelectorAll(`meta[name="${metaName}"]:where([xml\\:lang="en"])`);
				const creatorsExt = [];
				const zhNames = Array.from(zhNodes).flatMap(elm => elm.getAttribute('content').split(/[,;，；、]\s?/));
				const enNames = Array.from(enNodes).flatMap(elm => elm.getAttribute('content').split(/[,;，；、]\s?/));
				item.creators = [];
				zhNames.forEach((name, index) => {
					const zhCreator = cleanAuthor(name);
					item.creators.push(zhCreator);
					const enName = enNames[index];
					if (enName) {
						const enCreator = cleanAuthor(enName);
						const enCreatorStr = `${enCreator.lastName} || ${enCreator.firstName}`;
						creatorsExt.push({
							...zhCreator,
							original: enCreatorStr
						});
						addExtra('original-author', enCreatorStr);
					}
				});
				if (creatorsExt.some(creator => creator.original)) {
					addExtra('creatorsExt', JSON.stringify(creatorsExt));
				}
				break;
			}
		}

		if (!item.attachments.length) {
			item.attachments.push({
				title: 'Snapshot',
				document: doc
			});
		}

		item.complete();
	});

	await translator.translate();
}

function cleanAuthor(name) {
	return /\p{Unified_Ideograph}/u.test(name)
		? {
			firstName: '',
			lastName: name,
			creatorType: 'author',
			fieldMode: 1
		}
		: ZU.cleanAuthor(ZU.capitalizeName(name.replace(/^([A-Z]+) ([A-Za-z\s-]+)/, '$2 $1')), 'author');
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.xdfyjs.cn/CN/1009-086X/home.shtml",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.zgswfz.com.cn/CN/10.16409/j.cnki.2095-039x.2018.01.002",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "植食性害虫食诱剂的研究与应用",
				"creators": [
					{
						"firstName": "",
						"lastName": "蔡晓明",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李兆群",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "潘洪生",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陆宴辉",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018-02-08",
				"DOI": "10.16409/j.cnki.2095-039x.2018.01.002",
				"ISSN": "2095-039X",
				"abstractNote": "植食性害虫主要取食植物的茎叶、果实、花蜜等，并且常对某些食物表现出明显的偏好性。植物挥发物在害虫食物偏好选择行为中发挥着重要作用。基于害虫偏好食源或其挥发物研制的食诱剂（也称\"植物源引诱剂\"），是一类重要的害虫绿色防控产品。20世纪初人们就开始利用发酵糖水、糖醋酒液等传统食诱剂进行害虫诱集防治。随着对害虫食源挥发物中信息物质认识的不断深入，通过组配天然提取或人工合成的挥发物组分，先后研制出实蝇、夜蛾、蓟马、甲虫等多类害虫的新型食诱剂。这些食诱剂大多对雌、雄害虫均有效，已在橘小实蝇Bactrocera dorsalis、地中海实蝇Ceratitis capitata、棉铃虫Helicoverpa armigera、苹果蠹蛾Cydia pomonella、西花蓟马Frankliniella occidentalis、西方玉米根萤叶甲Diabrotica virgifera virgifera、纵坑切梢小蠹Tomicus piniperda等重要害虫的监测和防治中发挥了重要作用。本文总结了已有食诱剂研发与应用过程中的经验和教训，并对今后食诱剂的发展方向与重点方面进行了分析和展望，以期促进植食性害虫食诱剂及其田间使用技术的创新发展。",
				"extra": "original-author: Cai || Xiaoming\noriginal-author: Li || Zhaoqun\noriginal-author: Pan || Hongsheng\noriginal-author: Lu || Yanhui\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"蔡晓明\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Cai || Xiaoming\"},{\"firstName\":\"\",\"lastName\":\"李兆群\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Li || Zhaoqun\"},{\"firstName\":\"\",\"lastName\":\"潘洪生\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Pan || Hongsheng\"},{\"firstName\":\"\",\"lastName\":\"陆宴辉\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Lu || Yanhui\"}]",
				"issue": "1",
				"language": "zh-CN",
				"libraryCatalog": "www.zgswfz.com.cn",
				"pages": "8",
				"publicationTitle": "中国生物防治学报",
				"url": "http://www.zgswfz.com.cn/CN/10.16409/j.cnki.2095-039x.2018.01.002",
				"volume": "34",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "behavioural manipulation"
					},
					{
						"tag": "green pest control"
					},
					{
						"tag": "host plant"
					},
					{
						"tag": "plant volatiles"
					},
					{
						"tag": "preference"
					},
					{
						"tag": "偏好选择"
					},
					{
						"tag": "寄主植物"
					},
					{
						"tag": "挥发物"
					},
					{
						"tag": "绿色防控"
					},
					{
						"tag": "行为调控"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://jst.tsinghuajournals.com/CN/Y2015/V55/I1/50",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "施工粉尘健康损害量化评价",
				"creators": [
					{
						"firstName": "",
						"lastName": "李小冬",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "苏舒",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "黄天健",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-01-20",
				"ISSN": "1000-0054",
				"abstractNote": "为了完善建筑工程健康损害评价体系,提升施工人员职业健康水平,该文基于健康风险评价法和健康损害量化评价,建立施工粉尘健康损害评价框架。针对不同施工阶段不同工种进行粉尘损害评价,并用社会意愿支付法货币化损害结果。结合实际工程,将评价模型运用于某住宅项目主体结构施工阶段,得到各工种的粉尘健康损害值,并进行对比分析。结果表明: 评价模型可以用于施工粉尘的健康损害评价; 不同工种的粉尘健康损害存在明显差异; 在主体结构阶段,木工受到的粉尘污染最为严重。",
				"extra": "original-author: Li || Xiaodong\noriginal-author: Su || Shu\noriginal-author: Huang || Tianjian\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"李小冬\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Li || Xiaodong\"},{\"firstName\":\"\",\"lastName\":\"苏舒\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Su || Shu\"},{\"firstName\":\"\",\"lastName\":\"黄天健\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Huang || Tianjian\"}]",
				"issue": "1",
				"journalAbbreviation": "清华大学学报（自然科学版）",
				"language": "zh-CN",
				"libraryCatalog": "jst.tsinghuajournals.com",
				"pages": "50-55",
				"publicationTitle": "清华大学学报（自然科学版）",
				"url": "http://jst.tsinghuajournals.com/CN/abstract/abstract148365.shtml",
				"volume": "55",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "健康损害"
					},
					{
						"tag": "施工粉尘"
					},
					{
						"tag": "环境影响评价"
					},
					{
						"tag": "量化评价"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.zgyj.ac.cn/gyby/zgyj/CN/10.13228/j.boyuan.issn1006-9356.20190429",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "高钛型高炉渣钛提取工艺研究现状及发展展望",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘帅",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张宗旺",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张建良",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王振阳",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020/03/15",
				"DOI": "10.13228/j.boyuan.issn1006-9356.20190429",
				"ISSN": "1006-9356",
				"abstractNote": "含钛高炉渣可直接用于制作混凝土、渣棉和混凝土砌块等原材料,但其钒、钛有价资源得不到有效利用。中国含钛高炉渣储量大,且每年仍以较快速度增长。因而含钛高炉渣钛资源提取问题成为研究热点。通过对含钛高炉渣钛提取技术的相关研究进行回顾,分别从钛铁合金、钛白和四氯化钛等不同富集形式,对含钛高炉渣钛提取工艺的过程以及优缺点进行综述,并分析探讨各工艺可行性,期望可以促进钛资源可持续健康发展,达到资源综合利用目的。",
				"issue": "3",
				"language": "zh-CN",
				"libraryCatalog": "www.zgyj.ac.cn",
				"pages": "1-7",
				"publicationTitle": "中国冶金",
				"url": "http://www.zgyj.ac.cn/gyby/zgyj/CN/10.13228/j.boyuan.issn1006-9356.20190429",
				"volume": "30",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "资源利用"
					},
					{
						"tag": "钛提取工艺"
					},
					{
						"tag": "钛铁合金"
					},
					{
						"tag": "高炉渣"
					},
					{
						"tag": "高钛渣"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.zgxdyyzz.com.cn/CN/10.3969/j.issn.1672-9463.2022.03.019",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "糖尿病患者检测血清CA125、CEA的临床意义",
				"creators": [
					{
						"firstName": "",
						"lastName": "亢贞",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"DOI": "10.3969/j.issn.1672-9463.2022.03.019",
				"ISSN": "1672-9463",
				"abstractNote": "目的 探讨糖尿病患者血清糖类抗原125（CA125）、癌胚抗原（CEA）水平及意义。方法 选取2017年1月~2018年12月在我院治疗的2型糖尿病患者142例（糖尿病组）,同时选取健康体检者140例作为对照组,检测两组血清CA125、CEA、空腹血糖（FPG）和糖化血红蛋白（HbA1c）水平。结果 糖尿病组血清CA125、CEA、FPG和HbA1c水平明显高于对照组（P<0.05）;糖尿病组有并发症患者血清CA125、CEA水平明显高于无并发症患者（P<0.05）;CEA与FPG、HbA1c呈正相关（r=0.329、0.394,P<0.05）。结论 糖尿病患者血清CA125、CEA升高,尤其合并并发症患者升高更明显,而且CEA与患者FPG、HbA1c水平呈正相关。",
				"issue": "3",
				"language": "zh-CN",
				"libraryCatalog": "www.zgxdyyzz.com.cn",
				"pages": "82-84",
				"publicationTitle": "中国现代医药杂志",
				"url": "http://www.zgxdyyzz.com.cn/CN/10.3969/j.issn.1672-9463.2022.03.019",
				"volume": "24",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "癌胚抗原"
					},
					{
						"tag": "空腹血糖"
					},
					{
						"tag": "糖化血红蛋白"
					},
					{
						"tag": "糖尿病"
					},
					{
						"tag": "糖类抗原125"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
