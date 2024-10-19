{
	"translatorID": "50ba44ce-c737-4fa9-824c-f7d94c7b9e77",
	"label": "Founder",
	"creator": "jiaojiaodubai",
	"target": "/thesisDetails[#?]|/article/(doi/)?",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-10-11 09:16:17"
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
	const hasScript = doc.querySelector('script[src*="portal.founderss.cn"]');
	if (!hasScript) return false;
	return 'journalArticle';
}

async function doWeb(doc, url) {
	try {
		await scrapeAPI(doc, url);
	}
	catch (error) {
		await scrapeDoc(doc);
	}
}

async function scrapeAPI(doc, url) {
	const doi = tryMatch(url, /\/thesisDetails#([^&]+)&?/i, 1) || tryMatch(url, /\/doi\/([^/]+\/?[^/]*)\//i, 1);
	const columnId = tryMatch(url, /\/thesisDetails\?columnId=([^&]+)/i, 1) || tryMatch(url, /\/article\/([^/]+)/i, 1);
	let respond;
	if (doi) {
		respond = await requestJSON(`/rc-pub/front/front-article/getArticleByDoi?doi=${doi}&timestamps=${Date.now()}`);
	}
	else if (columnId) {
		respond = await requestJSON(`/rc-pub/front/front-article/${columnId}?timestamps=${Date.now()}`);
	}
	if (!respond) throw new Error('no respond');
	const handler = {
		get(target, prop) {
			const value = target[prop];
			return value === null
				? ''
				: value;
		},
	};
	const proxy = new Proxy(respond.data, handler);
	const extra = new Extra();
	const newItem = new Z.Item('journalArticle');
	newItem.title = proxy.resName;
	extra.set('original-title', ZU.capitalizeTitle(proxy.enResName), true);
	newItem.abstractNote = proxy.summary;
	newItem.publicationTitle = proxy.publicationName || proxy.sourcePublicationName;
	extra.set('original-container-title', ZU.capitalizeTitle(proxy.enPublicationName || proxy.enSourcePublicationName));
	newItem.volume = proxy.volume;
	newItem.issue = proxy.issue;
	newItem.pages = proxy.firstPageNum == proxy.lastPageNum
		? proxy.firstPageNum
		: `${proxy.firstPageNum}-${proxy.lastPageNum}`;
	newItem.date = ZU.strToISO(proxy.ppubDate || proxy.publishDate);
	newItem.language = proxy.language;
	newItem.DOI = proxy.doi;
	newItem.ISSN = attr(doc, 'meta[name="citation_issn"]', 'content');
	newItem.url = url;
	const creatorsZh = proxy.authors.split(';');
	const creatorsEn = proxy.enAuthors.split(';');
	newItem.creators = creatorsZh.map(name => cleanAuthor(name));
	if (creatorsEn.length) {
		const creators = [];
		for (let i = 0; i < creatorsZh.length; i++) {
			const creatorZh = cleanAuthor(creatorsZh[i]);
			if (creatorsEn[i]) {
				const creatorEn = ZU.capitalizeName(creatorsEn[i]);
				creatorZh.original = creatorEn;
				extra.push('original-author', creatorEn, true);
			}
			creators.push(creatorZh);
		}
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	newItem.attachments.push({
		title: 'Full Text PDF',
		mimeType: 'application/pdf',
		url: `/rc-pub/front/front-article/download?id=${proxy.id}&attachType=lowqualitypdf&token=&language=zh`
	});
	newItem.tags = proxy.keyword.split(';');
	if (doc) {
		newItem.attachments.push({
			title: 'Snapshot',
			document: doc
		});
	}
	newItem.extra = extra.toString();
	newItem.complete();
}

async function scrapeDoc(doc) {
	const translator = Zotero.loadTranslator('web');
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);
	translator.setHandler('itemDone', (_obj, item) => {
		item.title = attr(doc, 'meta[name="title"]', 'content');
		delete item.publisher;
		item.creators.forEach((creator) => {
			if (/\u4e00-\u9fff/.test(creator.lastName)) {
				creator.fieldMode = 1;
			}
		});
		item.attachments.push({
			title: 'Snapshot',
			document: doc
		});
		item.complete();
	});
	await translator.translate();
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function cleanAuthor(name) {
	const creator = ZU.cleanAuthor(name, 'author');
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	return creator;
}

class Extra {
	constructor() {
		this.fields = [];
	}

	push(key, val, csl = false) {
		this.fields.push({ key: key, val: val, csl: csl });
	}

	set(key, val, csl = false) {
		const target = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		if (target) {
			target.val = val;
		}
		else {
			this.push(key, val, csl);
		}
	}

	get(key) {
		const result = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		return result
			? result.val
			: '';
	}

	toString(history = '') {
		this.fields = this.fields.filter(obj => obj.val);
		return [
			this.fields.filter(obj => obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n'),
			history,
			this.fields.filter(obj => !obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n')
		].filter(obj => obj).join('\n');
	}
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://kfxb.publish.founderss.cn/thesisDetails#10.3724/SP.J.1329.2022.02013&lang=zh",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "太极拳训练脑效应机制研究进展",
				"creators": [
					{
						"firstName": "",
						"lastName": "王雅君",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "徐姝蕊",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘娇",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-04-20",
				"DOI": "10.3724/SP.J.1329.2022.02013",
				"ISSN": "2095-1531",
				"abstractNote": "太极拳作为我国传统运动康复疗法，可提高神经系统的兴奋性和对脑功能活动调节能力。文章总结归纳太极拳训练对脑效应机制的国内外研究现状，主要从脑电、超声多普勒、近红外线、磁共振成像等多种技术探索太极拳对脑电波信号特征、事件相关电位（P300/N400等）、脑血流、脑血氧含量和脑结构及功能网络影响，为太极拳的脑效应机制提供初步证据。太极拳训练过程中对注意力控制的改善可能与调节大脑皮层α波的节律和活动有关；太极拳训练后P300、N400潜伏期缩短，改善资源分配、信息处理和词语加工能力，提高大脑感知信息容量与资源。太极拳训练可能通过改善神经内分泌调节功能，促进代谢酶的活性，降低血脂而改善脑血流速度。基于静息态功能核磁成像的横断面研究显示，长期太极拳训练调节大脑功能网络，且与训练的经验、对认知功能的保护显著相关；太极拳对认知功能的改善与其调节相关认知神经环路结构和功能有关。任务态功能核磁研究显示，太极拳训练对记忆、执行功能加工相关脑区和网络具有调控作用。此外，长期太极拳训练对脑灰质体积和白质形态结构具有可塑性改变。然而，目前研究中也存在着一定的问题，如样本量偏小、以单模态脑影像为主、缺少纵向研究和长期随访、缺乏剂量-效应关系研究等。下一步研究还需开展多中心、大样本、多模态联合、不同训练剂量对比等高质量研究，以更深入探索太极拳的脑效应相关机制。",
				"extra": "original-title: Research Progress on the Brain Effect Mechanism of Tai Chi Chuan Training\noriginal-author: Wang Yajun\noriginal-author: Xu Shurui\noriginal-author: Liu Jiao\noriginal-container-title: Rehabilitation Medicine\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"王雅君\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Wang Yajun\"},{\"firstName\":\"\",\"lastName\":\"徐姝蕊\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Xu Shurui\"},{\"firstName\":\"\",\"lastName\":\"刘娇\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Liu Jiao\"}]",
				"issue": "2",
				"language": "zh",
				"libraryCatalog": "Founder",
				"pages": "177-182",
				"publicationTitle": "康复学报",
				"url": "https://kfxb.publish.founderss.cn/thesisDetails#10.3724/SP.J.1329.2022.02013&lang=zh",
				"volume": "32",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "功能近红外光谱"
					},
					{
						"tag": "太极拳"
					},
					{
						"tag": "磁共振成像"
					},
					{
						"tag": "脑效应"
					},
					{
						"tag": "脑电"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://fjzyy.publish.founderss.cn/thesisDetails?columnId=29860022&lang=zh",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "论中医“三焦”的宏观和微观实质",
				"creators": [
					{
						"firstName": "",
						"lastName": "郑敏麟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "阮杏林",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "黄浩龙",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-07-28",
				"ISSN": "2095-1531",
				"abstractNote": "上篇通过对《黄帝内经》《难经》和历代文献对三焦的论述进行归纳后认为，三焦充塞整个躯体，包容五脏六腑，大而无形；是五脏、六腑、四肢百骸等器官之间诸气、水液运行和代谢物质交换的通道。下篇以上篇为基础，并结合2002年来所研究的中医藏象实质的系列成果，认为三焦的形态学实质，在细胞的微观的层次是细胞质，在人体的宏观层次是细胞间隙。",
				"extra": "original-title: Discussion on Microscopic and Macroscopic Substance of Triple Energizerin Traditional Chinese Medicine\noriginal-author: Minlin Zhang\noriginal-author: Xinglin Ruan\noriginal-author: Haolong Huang\noriginal-container-title: FUJIAN JOURNAL OF TRADITIONAL CHINESE MEDICINE\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"郑敏麟\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Minlin Zhang\"},{\"firstName\":\"\",\"lastName\":\"阮杏林\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Xinglin Ruan\"},{\"firstName\":\"\",\"lastName\":\"黄浩龙\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Haolong Huang\"}]",
				"issue": "7",
				"language": "zh",
				"libraryCatalog": "Founder",
				"pages": "30-34",
				"publicationTitle": "福建中医药",
				"url": "https://fjzyy.publish.founderss.cn/thesisDetails?columnId=29860022&lang=zh",
				"volume": "53",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "三焦"
					},
					{
						"tag": "五脏"
					},
					{
						"tag": "细胞质"
					},
					{
						"tag": "细胞间隙"
					},
					{
						"tag": "藏象实质"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://xuebaoyx.sysu.edu.cn/zh/article/doi/10.13471/j.cnki.j.sun.yat-sen.univ(med.sci).20240004.017/",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "死后生物化学分析在法医学死因鉴定中的研究进展",
				"creators": [
					{
						"firstName": "",
						"lastName": "马星宇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "赵东",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-01-20",
				"DOI": "10.13471/j.cnki.j.sun.yat-sen.univ(med.sci).20240004.017",
				"ISSN": "1672-3554",
				"abstractNote": "死因鉴定是法医实践中的重要内容。死后生物化学分析现已成为法医学死因鉴定的重要辅助分析手段，具有操作简便、检验效率高、便于了解死亡机制等优势。本文就死后生物化学分析方法的发展现状、自身优势及存在问题进行综述，并通过提出可行的解决办法，探讨死后生物化学分析方法在法医学死因鉴定研究中的应用前景，以期为该问题的解决提供新的研究思路。",
				"extra": "original-title: The Progression of Postmortem Biochemistry Analysis in Forensic Discrimination of Cause of Death\noriginal-author: Ma Xingyu\noriginal-author: Zhao Dong\noriginal-container-title: Journal of Sun Yat-sen University (Medical Sciences)\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"马星宇\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Ma Xingyu\"},{\"firstName\":\"\",\"lastName\":\"赵东\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Zhao Dong\"}]",
				"issue": "1",
				"language": "zh",
				"libraryCatalog": "Founder",
				"pages": "13-20",
				"publicationTitle": "中山大学学报（医学科学版）",
				"url": "https://xuebaoyx.sysu.edu.cn/zh/article/doi/10.13471/j.cnki.j.sun.yat-sen.univ(med.sci).20240004.017/",
				"volume": "45",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "应用前景"
					},
					{
						"tag": "死亡原因"
					},
					{
						"tag": "死后生物化学"
					},
					{
						"tag": "法医学"
					},
					{
						"tag": "研究进展"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.fs.sinap.ac.cn/zh/article/36361855/",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "几种国产透明塑料薄膜（片）对<sup>60</sup>Coγ射线剂量响应的若干特性研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "吴智力",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈新薇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张加山",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-04-23",
				"ISSN": "1000-3436",
				"abstractNote": "本工作研究了目前国内市场上有商品可供应的特种有机玻璃、三醋酸纤维素、聚苯乙烯、聚乙烯醇、聚碳酸酯和涤纶等六种透明塑料薄膜（片）对<sup>60</sup>Coγ射线的剂量响应特性和用于测量吸收剂量的精密度以及这些塑料薄膜（片）照射以后光密度的稳定性和环境条件对剂量响应的影响。结果表明，通过仔细地选择薄膜（片）及检测厚度和本底光密度，并对每一批号的薄膜（片）在使用条件（例如剂量率，温度、湿度……）下做刻度曲线，除了聚乙烯醇薄膜外，其它五种透明塑料薄膜（片）还是能够满足辐射工艺过程中日常剂量测量的要求。其中以特种有机玻璃、三醋酸纤维素、聚碳酸酯和涤纶等薄膜（片）更为合适。为测量1×10<sup>5</sup>rad到10<sup>8</sup>rad剂量，可以采用不同厚度的前二种薄膜（片），测量10<sup>8</sup>rad以上剂量，可以选用后二者。",
				"extra": "original-title: INVESTIGATION OF THE DOSE RESPONSE CHARACTERISTICS OF SEVERAL CLEAR PLASTIC FILMS (OR PIECE) FOR <sup>60</sup>Coγ-RAYS\noriginal-author: Wu Zhili\noriginal-author: Chen Xinwei\noriginal-author: Zhang Jiashan\noriginal-container-title: Journal of Radiation Research and Radiation Processing\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"吴智力\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Wu Zhili\"},{\"firstName\":\"\",\"lastName\":\"陈新薇\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Chen Xinwei\"},{\"firstName\":\"\",\"lastName\":\"张加山\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Zhang Jiashan\"}]",
				"issue": "4",
				"language": "zh",
				"libraryCatalog": "Founder",
				"pages": "11-19",
				"publicationTitle": "辐射研究与辐射工艺学报",
				"url": "https://www.fs.sinap.ac.cn/zh/article/36361855/",
				"volume": "2",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "剂量响应特性"
					},
					{
						"tag": "环境因素影响"
					},
					{
						"tag": "辐照后效应"
					},
					{
						"tag": "透明塑料薄膜(片）剂量计"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
