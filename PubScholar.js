{
	"translatorID": "58df4473-a324-4fb5-8a8f-25d1e1897c73",
	"label": "PubScholar",
	"creator": "l0o0, jiaojiaodubai",
	"target": "https?://pubscholar\\.cn/",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-02-10 11:40:01"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2023 l0o0

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

var zhTagMap = {
	期刊论文: 'journalArticle',
	预印本论文: 'preprint',
	学位论文: 'thesis',
	专利: 'patent',
	图书: 'book'
};

var urlMap = {
	'/books/': 'book',
	'/articles/': 'journalArticle',
	'/patents/': 'patent'
};

function detectWeb(doc, url) {
	let app = doc.querySelector('#app');
	if (app) {
		Z.monitorDOMChanges(app, { childList: true, subtree: true });
	}
	let tagKey = text(doc, '[class*="titleLabel"] > span').slice(1, -1);
	let urlKey = Object.keys(urlMap).find(key => url.includes(key));
	if (tagKey) {
		return zhTagMap[tagKey];
	}
	else if (urlKey) {
		return urlMap[urlKey];
	}
	return false;
}

async function doWeb(doc, url) {
	let citeAs = text(doc, '.QuoteListItem__content').replace(/\.$/, '').split('.');
	citeAs = citeAs[citeAs.length - 1];
	Z.debug(citeAs);
	var labels = new LabelsX(doc, '[class$="Analytics__item"]');
	var newItem = new Z.Item(detectWeb(doc, url));
	newItem.title = text(doc, 'span[class$="__titleText"]');
	newItem.language = /[\u4e00-\u9fff]/.test(newItem.title)
		? 'zh-CN'
		: 'en-US';
	await clickMore(doc.querySelector('[class*="abstracts"] .base-button'), () => {
		newItem.abstractNote = text(doc, '[class*="abstracts"]').replace(/\s*收起$/, '');
	});
	await clickMore(doc.querySelector('AuthorInfo__extra'), () => { });
	switch (newItem.itemType) {
		case 'journalArticle': {
			let labels = new LabelsX(doc, '.JournalContent__meta');
			newItem.date = tryMatch(citeAs, /\d{4}/, 0);
			newItem.pages = tryMatch(citeAs, /:([\d+-]*)$/, 1);
			newItem.publicationTitle = ZU.capitalizeTitle(text(doc, '.JournalContent__title'));
			newItem.volume = tryMatch(citeAs, /\d{4},\s?(\d*)\(?/, 1);
			newItem.issue = tryMatch(citeAs, /\((\d*)\)/, 1);
			newItem.ISSN = labels.getWith('ISSN');
			doc.querySelectorAll('.AuthorInfo__nameText > span').forEach((element) => {
				newItem.creators.push(cleanName(ZU.trimInternal(element.textContent), 'author'));
			});
			extra.add('IF', labels.getWith('影响因子'));
			break;
		}
		case 'thesis': {
			let labels = new LabelsX(doc, '.ArticleInfo__sourceTitle > span:not([class$="comma"])');
			newItem.thesisType = newItem.language == 'zh-CN'
				? /硕士/.test(text(doc, '.AuthorInfo__nameText.is-disabled'))
					? '硕士学位论文'
					: '博士学位论文'
				: /Doctor/i.test(text(doc, '.AuthorInfo__nameText.is-disabled'))
					? 'Doctoral dissertation'
					: 'Master thesis';
			newItem.university = labels.getWith('授予单位');
			newItem.date = labels.getWith('授予时间');
			newItem.creators.push(cleanName(text(doc, '.AuthorInfo__name:not(.AuthorInfo__name--light)  > .AuthorInfo__nameText'), 'author'));
			text(doc, '.AuthorInfo__name.AuthorInfo__name--light > span > .AuthorInfo__nameText').split(/[;，；、]/).forEach((string) => {
				newItem.creators.push(cleanName(string, 'contributor'));
			});
			break;
		}
		case 'preprint':
			newItem.repository = text(doc, '.ArticleInfo__metaSource');
			newItem.date = text(doc, '.ArticleInfo__sourceTitle > span:last-child');
			break;
		case 'patent': {
			let labels = new LabelsX(doc, '.AuthorInfo__content');
			newItem.abstractNote = text(doc, '.FullAbstracts');
			newItem.filingDate = next(doc, 'span[class$="__label"]', '申请日');
			newItem.applicationNumber = next(doc, 'span[class$="__label"]', '申请号');
			newItem.issueDate = next(doc, 'span[class$="__label"]', '公开日');
			newItem.rights = text(doc, '.FullTextContent', 1);
			labels.getWith('发明人', true).querySelectorAll('span.AuthorInfo__nameText').forEach((element) => {
				newItem.creators.push(cleanName(ZU.trimInternal(element.textContent), 'inventor'));
			});
			extra.add('Genre', text(doc, '.ArticleInfo__titleLabel').slice(1, -1), true);
			break;
		}
		case 'book': {
			let labels = new LabelsX(doc, '.AuthorInfo > div, .ArticleInfo__source > span');
			newItem.date = citeAs;
			newItem.publisher = labels.getWith('出版社');
			newItem.ISBN = labels.getWith('ISBN');
			extra.add('subject', labels.getWith('学科分类'));
			labels.getWith('作者').split(/[;，；、]/).forEach((creator) => {
				let creatorType = /译$/.test(creator)
					? 'translator'
					: 'author';
				newItem.creators.push(cleanName(creator.replace(/[等主编译\s]*$/g, ''), creatorType));
			});
			break;
		}
	}
	doc.querySelectorAll('div[class$="__keywords"] > [class$="__keyword"]').forEach((element) => {
		newItem.tags.push(ZU.trimInternal(element.textContent));
	});
	extra.add('view', labels.getWith('浏览'));
	extra.add('download', labels.getWith('下载'));
	extra.add('like', labels.getWith('推荐'));
	if (url) newItem.url = url;
	newItem.extra = extra.toString();
	newItem.complete();
}


class LabelsX {
	constructor(doc, selector) {
		this.innerData = [];
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				// avoid empty text
				while (!elementCopy.firstChild.textContent.replace(/\s/g, '')) {
					// Z.debug(elementCopy.firstChild.textContent);
					elementCopy.removeChild(elementCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elementCopy.childNodes.length > 1) {
					let key = elementCopy.removeChild(elementCopy.firstChild).textContent.replace(/\s/g, '');
					this.innerData.push([key, elementCopy]);
				}
				else {
					let text = ZU.trimInternal(elementCopy.textContent);
					let key = tryMatch(text, /^[[【]?[\s\S]+?[】\]:：]/).replace(/\s/g, '');
					elementCopy.textContent = tryMatch(text, /^[[【]?[\s\S]+?[】\]:：]\s*(.+)/, 1);
					this.innerData.push([key, elementCopy]);
				}
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.getWith(aLabel, element))
				.filter(element => element);
			result = element
				? result.find(element => element.childNodes.length)
				: result.find(element => element);
			return result
				? result
				: element
					? document.createElement('div')
					: '';
		}
		let pattern = new RegExp(label, 'i');
		let keyValPair = this.innerData.find(element => pattern.test(element[0]));
		if (element) return keyValPair ? keyValPair[1] : document.createElement('div');
		return keyValPair
			? ZU.trimInternal(keyValPair[1].textContent)
			: '';
	}
}

function next(node, selector, string, element = false) {
	try {
		let nextElement = Array.from(node.querySelectorAll(selector)).find(
			element => new RegExp(string).test(element.innerText)
		).nextElementSibling;
		return element
			? nextElement
			: ZU.trimInternal(nextElement.innerText);
	}
	catch (error) {
		return element
			? document.createElement('div')
			: '';
	}
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
	toString: function (original) {
		return original
			? [
				...this.clsFields.map(entry => `${entry[0]}: ${entry[1]}`),
				original.replace(/^\n|\n$/g, ''),
				...this.elseFields.map(entry => `${entry[0]}: ${entry[1]}`)
			].join('\n')
			: [...this.clsFields, ...this.elseFields]
				.map(entry => `${entry[0]}: ${entry[1]}`)
				.join('\n');
	}
};

async function clickMore(button, callback) {
	if (button) {
		if (/展开|更多|\.\.\.|…/.test(button.textContent)) {
			await button.click();
			callback();
		}
		else {
			callback();
		}
	}
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function cleanName(string, creatorType) {
	if (!string) return {};
	return /[\u4e00-\u9fff]/.test(string)
		? {
			firstName: '',
			lastName: string.replace(/\s/g, ''),
			creatorType: creatorType,
			fieldMode: 1
		}
		: ZU.cleanAuthor(ZU.capitalizeName(string), creatorType);
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://pubscholar.cn/articles/f5e7f9f34377b9eccc279eb384c77dd1ed9b35dbb882da9b3ebd569a2c3927ff3bda5cc968b1fc5e85b6be9af7a0f557",
		"items": [
			{
				"itemType": "thesis",
				"title": "草鱼胚胎甲基化组初探及生长相关性状QTL分析",
				"creators": [
					{
						"firstName": "",
						"lastName": "蒋艳鑫",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "夏晓勤",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2018",
				"abstractNote": "DNA甲基化是目前研究最为成熟的一种表观遗传修饰，影响着多种生物学过程，包括动物的生长发育和疾病的形成发展等。草鱼耐粗饲、生长速度快，是亚洲重要的淡水经济鱼种，但对其胚胎发育的表观遗传研究至今未见报道。对草鱼的DNA甲基化进行研究有助于解析水产动物复杂的生物学特征及对环境适应性的调理机制。本研究针对草鱼早期发育过程开展了DNA甲基化的基础研究，同时对其生长相关性状进行初步的QTL定位。主要研究内容及结果如下：    首次克隆获得了草鱼7个DNA甲基转移酶（DNMTs）的cDNA全长序列，并通过荧光定量PCR对其在草鱼胚胎发育时期的表达模式进行了分析，并以此为依据将7个DNMTs分为了三类：DNMT1和DNMT5的表达模式一致，在胚胎发育前期表达较高；DNMT3、DNMT4和DNMT7共享一种表达模式，其表达量在囊胚期和原肠胚期较高；而DNMT6和DNMT8主要在胚胎发育后期表达。根据DNA甲基转移酶基因的表达特点，我们选择了草鱼不同发育阶段的胚胎进行了全基因组DNA甲基化测序和重测序。结果显示，草鱼基因组DNA胞嘧啶平均甲基化水平为5 %左右，甲基化主要方式为mCpG。针对18~19肌节期及出膜5天的仔鱼期进行甲基化差异分析，共鉴定出差异甲基化区域（DMRs）2108个，覆盖到942个差异甲基化基因（DMGs）。经GO和Pathway功能富集分析，共有60个DMGs显著富集（P <； 0.01）于血管生成、成肌细胞分化、肢体发育、转化生长因子β受体信号通路调控等生物过程，涉及到MYOD1、GDF9、TGFB21和MYOF等已知的与生长发育相关的基因。通过整合DMGs甲基化数据与转录组数据进行分析，发现DNA甲基化与基因表达并不是单一的负调控关系，对于某些基因，存在除DNA甲基化以外的其他因素调控其转录过程。    此外，本研究以黄晓丽的工作为基础，对两个远缘亲本及其100个F1子代的2b-RAD测序数据的分析方法进行了优化，用最大似然法构建了由6，429个SNP标记组成的草鱼高密度遗传连锁图谱，该图谱和草鱼基因组草图以及斑马鱼基因组都有良好的共线性关系，初步组装了74.39%的supercontigs至染色体水平，可有效辅助草鱼基因组染色体的搭建。另外针对草鱼的生长性状（体重、体长、体高和全长），共鉴定出生长相关的QTL位点30个，分布于5个连锁群的16个区域上。单个QTL的可解释的表型变化在13.4%~21.6%。结合亲本的全基因组重测序分析以及体重差别的草鱼幼鱼表达谱分析，获得候选基因18个，为草鱼遗传育种提供了较好的素材。",
				"extra": "view: 4\nlike: 0",
				"language": "zh-CN",
				"libraryCatalog": "PubScholar",
				"thesisType": "博士学位论文",
				"university": "中国科学院大学",
				"url": "https://pubscholar.cn/articles/f5e7f9f34377b9eccc279eb384c77dd1ed9b35dbb882da9b3ebd569a2c3927ff3bda5cc968b1fc5e85b6be9af7a0f557",
				"attachments": [],
				"tags": [
					{
						"tag": "DNA甲基化"
					},
					{
						"tag": "QTL"
					},
					{
						"tag": "SNP"
					},
					{
						"tag": "草鱼"
					},
					{
						"tag": "遗传连锁图谱"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://pubscholar.cn/articles/656ef23fb7c7102a0785c59494004e7d97ea90bfb81eec6e25e65c17f2ab63eddce7de1ef7c0de56ab558f34701acd08",
		"items": [
			{
				"itemType": "thesis",
				"title": "卷鞘鸢尾参考转录组的组装方法评估及应用",
				"creators": [
					{
						"firstName": "",
						"lastName": "朱张士昌",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "段元文",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2022",
				"abstractNote": "非模式生物具有更高的多样性，但缺乏组学数据阻碍了对其多样性形成机制的深入研究。第二代转录组测序数据能为大量非模式生物提供组学资源，已有转录组从头组装评价方法在指标选取上不够全面且缺少整合，缺乏组装个体数评价，且评价类群主要为模式生物，无法充分指导从头组装。本论文以非模式生物卷鞘鸢尾（Iris potaninii）为对象，共测序了12个种群76个个体的转录组数据，评价了转录组从头组装软件和个体数的组装效果，确定了该物种的最优组装参数。基于最优参数组装了参考转录组，开展群体转录组分析，探讨了青藏高原地区卷鞘鸢尾的群体遗传多样性。主要结果与结论如下：1.     参考转录组组装方法评估本论文从卷鞘鸢尾10个种群中随机挑选了10个个体的转录组数据，全面选取了17项组装质量指标（涵盖碱基、reads、contigs至转录组层面）与2项计算资源消耗指标（最大内存占用与运行时间），基于（0，1）归一化方法整合指标并构建评价体系，评价了rnaSPAdes、Trinity、Trans-ABySS、SOAPdenovo-Trans与Bridger等软件。结果表明，rnaSPAdes是卷鞘鸢尾的最优组装软件，其组装质量明显优于其余软件，且运行耗时较短。此外，基于参考基因组覆盖度评价了不同个体数的组装效果。结果表明，组装质量与计算资源消耗均随个体数增加而增加。当个体数达到30时，组装质量随个体数的增长开始放缓，且内存等计算资源消耗即将超出限制。最终确定卷鞘鸢尾的最优组装个体数为30。以上结果表明，应优先考虑组装质量，而计算资源可能是组装最优个体数的限制因素。2.     参考转录组及其应用基于组装方法评价部分的最优转录组，从基因差异表达划分的4类个体中随机挑选了30个个体进行参考转录组组装。利用转录组数据，共获得了143，317条序列（unigene）与752，870个高质量SNP。卷鞘鸢尾种内遗传多样性较低（π = 1.739e-3），种群间遗传分化较低（FST = 0.101），种内变异主要集中于个体间（分子方差分析，占物种总变异的86.830%），种群遗传与地理距离无显著相关性（Mantel检验）。Stairway plot分析表明，该物种从1Mya至今的3次主要瓶颈事件分别对应希夏邦马冰期、古乡冰期与新冰期。所有个体分为4组（遗传结构、ML树与主成分分析），但4组缺乏明显的地理结构。在所有种群中，青海果洛的种群（I12）具有较高遗传多样性（π = 1.767e-3， Ho = 0.088， He = 0.077），包含4个组所有的遗传成分，并与I4、I5、I13与I14等种群存在历史基因流（Nm、ABBA-BABA检验与treemix分析）。综合以上结果，较为合理的解释是种群I12是卷鞘鸢尾在青藏高原的冰期避难所。冰期时种群收缩导致了种群间的基因交流，而伴随冰期-间冰期循环发生了多次种群迁移，两者促进该种形成了如今的遗传多样性格局。此外，环境关联分析（bayenv与lfmm）与基因功能注释（GO与KEGG）的结果表明，25个SNP及其所在基因（共23个）具有响应环境压力与DNA修复等功能，可能体现了对强紫外线、极端低温与干旱等高原恶劣环境的适应性。综上所述，本论文构建了较为通用的转录组组装评价体系，有助于指导从头组装高质量非模式生物转录组。此外，利用最优的组装结果，揭示了卷鞘鸢尾的遗传多样性与遗传结构，为种质资源进一步开发利用提供了依据。",
				"extra": "view: 549\ndownload: 101\nlike: 0",
				"language": "zh-CN",
				"libraryCatalog": "PubScholar",
				"thesisType": "硕士学位论文",
				"university": "中国科学院大学",
				"url": "https://pubscholar.cn/articles/656ef23fb7c7102a0785c59494004e7d97ea90bfb81eec6e25e65c17f2ab63eddce7de1ef7c0de56ab558f34701acd08",
				"attachments": [],
				"tags": [
					{
						"tag": "Non-Model Organism,RNA-Seq,Germplasm Resource,Iris,Population Genetics"
					},
					{
						"tag": "种质资源"
					},
					{
						"tag": "群体遗传"
					},
					{
						"tag": "转录组测序"
					},
					{
						"tag": "非模式生物"
					},
					{
						"tag": "鸢尾属"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://pubscholar.cn/articles/3c9b1ffd2848ebedb60f220461178c361bbe3e43934eaea9546e3fbac10ced2f0ad59b1f00a83155bd2a31da806d3178",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "基因编辑技术在油菜中的应用",
				"creators": [
					{
						"firstName": "",
						"lastName": "杨文文",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "聂甲玥",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "樊红霞",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴德伟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王幼平",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"ISSN": "1672-416X",
				"abstractNote": "油菜作为世界主要油料作物之一，在农业生产中占有重要地位。长期以来，油菜育种家致力于利用杂交、人工诱变、细胞工程等多种技术，培育优良油菜品种，提质增效。近年来，以CRISPR为代表的基因编辑技术突飞猛进，为油菜育种提供了新的方法和思路，并已被成功用于改变油菜的菜籽产量、油脂品质、抗病性、开花时间、花色、除草剂抗性等性状，展现了巨大的应用潜力。本研究对基因编辑技术在油菜中的应用实例进行了全面总结，并对尚待解决的一些技术问题和未来可能的发展方向进行了探讨，为相关学者提供参考。",
				"extra": "IF: 0.935\nview: 47\nlike: 0",
				"issue": "7",
				"language": "zh-CN",
				"libraryCatalog": "PubScholar",
				"pages": "2253-2261",
				"publicationTitle": "分子植物育种",
				"url": "https://pubscholar.cn/articles/3c9b1ffd2848ebedb60f220461178c361bbe3e43934eaea9546e3fbac10ced2f0ad59b1f00a83155bd2a31da806d3178",
				"volume": "21",
				"attachments": [],
				"tags": [
					{
						"tag": "CRISPR"
					},
					{
						"tag": "基因编辑"
					},
					{
						"tag": "甘蓝型油菜"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://pubscholar.cn/articles/c808a69bcb097527d273c2beb513a4ee8eb6ba052d1fa2a04f8b6b001a3ccb6becb2c25d64d16ab9aa3c34af35db4a79",
		"items": [
			{
				"itemType": "thesis",
				"title": "Implementation of genomics and bioinformatics approaches for identification and characterization of tomato ripening-related genes",
				"creators": [
					{
						"firstName": "Fei",
						"lastName": "Zhangjun",
						"creatorType": "author"
					},
					{
						"firstName": "Giovannoni, James",
						"lastName": "J",
						"creatorType": "contributor"
					},
					{
						"firstName": "Binzel, Marla",
						"lastName": "L",
						"creatorType": "contributor"
					}
				],
				"date": "2003",
				"abstractNote": "Initial activities were focused on isolation and characterization of fruit ripening-related genes from tomato. Screening of four tomato cDNA libraries at low stringency with 10 fruit development and ripening-related genes yielded ∼3000 positives clones. Microarray expression analysis of half of these positives in mature green and breaker stage fruits resulted in eight ripening-induced genes. RNA gel-blot analysis and previously published data confirmed expression for seven of the eight. One novel gene, designated LeEREBP1, was chosen for further characterization. LeEREBP1 encodes an AP2/ERF-domain transcription factor and is ethylene inducible. The expression profiles of LeEREBP1 parallel previously characterized ripening-related genes from tomato. Transgenic plants with increased and decreased expression of LeEREBP1 were generated and are currently being characterized to define the function of LeEREBP1. A large public tomato EST dataset was mined to gain insight into the tomato transcriptome. By clustering genes according to the respective expression profiles of individual tissues, tissue and developmental expression patterns were generated and genes with similar functions grouped together. Tissues effectively clustered for relatedness according to their profiles confirming the integrity of the approach used to calculate gene expression. Statistical analysis of EST prevalence in fruit and pathogenesis-related libraries resulted in 333 genes being classified as fruit ripening-induced, 185 as fruit ripening-repressed, and 169 as pathogenesis-related. We performed a parallel analysis on public EST data for grape and compared the results for ripening-induced genes to tomato to identify similar and distinct ripening factors in addition to candidates for conserved regulators of fruit ripening. An online interactive database for tomato gene expression data—Tomato Expression Database (TED) was implemented. TED contains normalized expression data for approximately 12,000 ESTs over ten time points during fruit development. It also contains comprehensive annotation of each EST. Through TED, we provide multiple approaches to pursue analysis of specific genes of interest and/or access the larger microarray dataset to identify sets of genes that may behave in a pattern of interest. In addition, a set of useful data mining and data visualization tools were developed and are under continuing expansion.",
				"extra": "view: 3\nlike: 0",
				"language": "en-US",
				"libraryCatalog": "PubScholar",
				"thesisType": "Doctoral dissertation",
				"university": "Texas A&M University",
				"url": "https://pubscholar.cn/articles/c808a69bcb097527d273c2beb513a4ee8eb6ba052d1fa2a04f8b6b001a3ccb6becb2c25d64d16ab9aa3c34af35db4a79",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://pubscholar.cn/books/e4a5804428c6b5e93293f8c4ddd63a66d58a750f1abb13c6bfaacec097f5c64322091ecd0d4ce09303f0e1625267ddad",
		"items": [
			{
				"itemType": "book",
				"title": "人类基因组编辑：科学、伦理和监管（中文翻译版）",
				"creators": [
					{
						"firstName": "",
						"lastName": "美国国家科学院",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "马慧",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "2019-01",
				"ISBN": "9787030600479",
				"extra": "subject: 生物学\nview: 22\nlike: 0",
				"language": "zh-CN",
				"libraryCatalog": "PubScholar",
				"publisher": "科学出版社",
				"url": "https://pubscholar.cn/books/e4a5804428c6b5e93293f8c4ddd63a66d58a750f1abb13c6bfaacec097f5c64322091ecd0d4ce09303f0e1625267ddad",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://pubscholar.cn/patents/d1067ea442b3b43a3a301abc252eb139a0fbe21d5ec4e8bb250fde14e9c6a173880526c9b4434ff87754e650b78fecac/0",
		"items": [
			{
				"itemType": "patent",
				"title": "基因编辑构建体及其应用",
				"creators": [
					{
						"firstName": "",
						"lastName": "梁德生",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "胡志青",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "唐齐玉",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "邬玲仟",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2023-08-22",
				"abstractNote": "本公开提供一种基因编辑构建体及其应用，所述基因编辑构建体用于将外源基因定点整合入基因组的核糖体DNA(rDNA)区，并能高效地表达其携带的外源基因。",
				"applicationNumber": "CN202310645338.1",
				"extra": "Genre: 发明专利\nview: 34\nlike: 0",
				"filingDate": "2023-06-01",
				"language": "zh-CN",
				"url": "https://pubscholar.cn/patents/d1067ea442b3b43a3a301abc252eb139a0fbe21d5ec4e8bb250fde14e9c6a173880526c9b4434ff87754e650b78fecac/0",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]

/** END TEST CASES **/
