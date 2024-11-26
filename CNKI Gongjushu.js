{
	"translatorID": "bbb26e13-c5b1-4164-8fc7-4b6bf9e62d57",
	"label": "CNKI Gongjushu",
	"creator": "jiaojiaodubai",
	"target": "^https?://gongjushu\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-13 09:14:00"
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


function detectWeb(_doc, url) {
	if (url.includes('/detail?')) {
		return 'encyclopediaArticle';
	}
	else if (url.includes('/bookdetail?')) {
		return 'book';
	}
	return false;
}

async function doWeb(doc, url) {
	const extra = new Extra();
	const newItem = new Z.Item(detectWeb(doc, url));
	const creatorsExt = [];
	function processNames(names, role = '') {
		let creatorType = 'author';
		if (role.endsWith('编')) {
			creatorType = 'editor';
		}
		else if (role.endsWith('译')) {
			creatorType = 'translator';
		}
		names.forEach((name) => {
			const country = tryMatch(name, /^\[(.+?)\]/, 1);
			const original = tryMatch(name, /[(（](.+?)[）)]$/, 1).replace('，', ' ');
			if (original) {
				const originalCreator = cleanAuthor(ZU.capitalizeName(original), creatorType);
				extra.set('original-author', `${originalCreator.firstName ? originalCreator.firstName + ' || ' : ''}${originalCreator.lastName}`, true);
			}
			const creator = cleanAuthor(name.replace(/^\[.+?\]/, '').replace(/[(（].+?[）)]$/, ''), creatorType);
			newItem.creators.push(JSON.parse(JSON.stringify(creator)));
			newItem.country = country;
			newItem.original = original;
			creatorsExt.push(creator);
		});
	}
	switch (newItem.itemType) {
		case 'encyclopediaArticle': {
			newItem.title = text(doc, '.detailDesc  > h3 > .navi-search');
			extra.set('original-title', text(doc, '.detailDesc  > h3 > :last-child'), true);
			newItem.abstractNote = ZU.trimInternal(text(doc, '.detailDesc .image_box'));
			const bookTitle = text(doc, '.el-tooltip', 1);
			const pubInfoText = text(doc, '.descBox > .descDiv:last-child').substring(6);
			const pubInfoList = tryMatch(pubInfoText, new RegExp(`${bookTitle}\\.(.+)`), 1).split('.');
			newItem.encyclopediaTitle = bookTitle;
			newItem.place = tryMatch(pubInfoList[0], /^(.+):/, 1);
			newItem.publisher = tryMatch(pubInfoList[0], /:(.+)$/, 1);
			newItem.date = pubInfoList[1];
			newItem.pages = tryMatch(pubInfoList[2], /第([\d,+-]+)页/, 1);
			tryMatch(pubInfoText, new RegExp(`^(.+)\\.${bookTitle}`), 1).split(';').forEach((group) => {
				processNames(group.replace(/等?副?[总主参]?[编著]?$|翻?译$/g, '').split(','), tryMatch(group, /副?[总主参]?[编著]?$|翻?译$/));
			});
			break;
		}
		case 'book': {
			const more = doc.querySelector('.leftBox > .moreBtn');
			if (more) {
				more.click();
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
			const labels = new Labels(doc, '.left_content > span,.moreMsg > span');
			newItem.title = text(doc, '.rightTop > .left');
			extra.set('original-author', ZU.capitalizeTitle(labels.get('并列正书名')));
			newItem.abstractNote = labels.get('书目简介');
			newItem.series = labels.get('分辑名');
			newItem.place = labels.get('出版地');
			newItem.publisher = labels.get('出版者');
			newItem.date = labels.get('出版时间');
			newItem.numPages = tryMatch(labels.get('页码'), /\d+$/);
			const roles = labels.get('责任方式').split(';');
			labels.get('主要责任者').split(';').forEach((group, index) => {
				processNames(group.replace(/等$/, '').split(','), roles[index]);
			});
			if (creatorsExt.some(creator => creator.country || creator.original)) {
				extra.set('creatorsExt', JSON.stringify(creatorsExt));
			}
			break;
		}
	}
	newItem.language = 'zh-CN';
	newItem.url = url;
	newItem.extra = extra.toString();
	newItem.complete();
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

class Extra {
	constructor() {
		this.fields = [];
	}

	push(key, val, csl = false) {
		this.fields.push({ key: key, val: val, csl: csl });
	}

	set(key, val, csl = false) {
		let target = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		if (target) {
			target.val = val;
		}
		else {
			this.push(key, val, csl);
		}
	}

	get(key) {
		let result = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		return result
			? result.val
			: undefined;
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

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function cleanAuthor(name, creatorType = 'author') {
	const creator = ZU.cleanAuthor(name, creatorType);
	creator.lastName = creator.lastName.replace(/\.\s*/g, '. ');
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.fieldMode = 1;
	}
	return creator;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://gongjushu.cnki.net/rbook/detail?invoice=GQlTLRpYUvBa40JLJtsXlB0Y5cKcOK2V9Qqz8THdK4iUPPXlKvxjE6W9GdsY8Gk%2F5Z57%2FpZ1cFI0PqqUsAp6rWzxB%2Fs8oNerVj1cbtAiKj9XuHK3IKnLM3kSp5Ucl4jxmZdA5ggDEO6vMKiq8PAJ%2BDaP%2BYYh1TLJjSdavSPnySY%3D&platform=NRBOOK&product=CRFD&filename=R2006073210001119&tablename=crfd2008&type=REFBOOK&scope=download&cflag=overlay&dflag=%E8%AF%8D%E6%9D%A1&pages=&language=CHS&nonce=35D731350F744DCA9AB690F0A6D31ED8",
		"items": [
			{
				"itemType": "encyclopediaArticle",
				"title": "剩余价值",
				"creators": [
					{
						"firstName": "",
						"lastName": "卢之超",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "赵穗明",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1993",
				"abstractNote": "被资本家无偿占有、雇佣工人在生产过程中所创造的、超过劳动力价值以上的那部分价值。它体现了资本家对雇佣工人的剥削关系。 任何一个资本家,在开始进行剩余价值生产之前,都必须先掌握一定数量的货币。因此,货币是资本的最初表现形式。资本的流通公式是:G—W—G′(货币—商品—货币′)。其中,G′等于原来垫付的货币额G,再加上一个增殖额△G,即剩余价值。因此,资本流通的目的,是带来剩余价值。 剩余价值不能在流通中产生。因为,无论在购买(G—W),还是在销售(W—G′)阶段,通行的都是等价交换原则。即使是贱买贵卖,那也只是一部分资本家的所得,等于另一部分资本家的所失,剩余价值总量不会改变。因此,剩余价值不来自流通领域。 但是,剩余价值的产生又不能离开流通领域。离开了流通,资本家既不购买,又不销售,无从带来剩余价值。 剩余价值只能来自生产过程。资本家在市场上购买了生产资料和劳动力以后,进入生产过程。在生产过程中,劳动力被消费,原料被加工,结果,生产出一定数量的商品。这个商品的价值已发生增殖,其中,包含着工人所创造的剩余价值。这是因为,在生产过程中,工人的劳动时间分为必要劳动时间和剩余劳动时间。前者用来补偿再生产劳动力的价值。后者用来为资本家生产剩余价值。假定,纱厂资本家雇佣工人一天需支付劳动力价值为5元,这5元价值,工人用6小时劳动就能创造出来。又假定,工人纺6小时纱要消耗10斤棉花,价值10元;还要消耗1个纱锭,价值2元。这样,工人经过6小时劳动之后,10斤棉花变成10斤棉纱。10斤棉纱的价值等于10斤棉花和1个纱锭转移过来的总价值12元,再加上工人所创造的价值5元,共计17元。但是,资本家购买的是工人一天的劳动,他不会只让工人劳动6小时,假定让工人劳动12小时。那么,工人12小时劳动的成果是20斤棉纱,其价值等于消耗的20斤棉花的价值20元,加上2个纱锭的价值4元,再加上工人12小时中所创造的价值10元,共计34元。这34元价值中,有24元是生产资料转移的价值,5元是工人的工资,还剩下5元就是工人所创造的剩余价值,被资本家无偿占有。剩余价值就是这样被生产出来的。 生产剩余价值的方法有两种:绝对剩余价值生产和相对剩余价值生产。在必要劳动时间不变条件下,由于延长劳动日的绝对长度,而生产的剩余价值,叫做绝对剩余价值。在劳动日长度不变条件下,由于必要劳动时间缩短,使剩余劳动时间相对延长,而生产的剩余价值,叫做相对剩余价值生产。绝对剩余价值生产,是相对剩余价值生产的基础和前提。随着资本主义机器大工业和科学技术的发展,相对剩余价值生产日益具有重要意义。 在资本主义社会,剩余价值转化为利润。利润是剩余价值的表现形态。利润被进一步分割为产业利润、商业利润、借贷利息、资本主义地租等形态,体现了资产阶级共同剥削产业工人的关系。 剩余价值的存在,以雇佣劳动的存在,即劳动力成为商品为前提。因此,剩余价值是资本主义特有的历史范畴,是资本主义生产关系的本质体现。 剩余价值理论,是马克思的两个伟大发现之一,是马克思主义经济理论的基石。在此基础上,马克思说明了资本主义积累的一般规律,从而揭示了资本主义发生、发展和灭亡的必然性。",
				"encyclopediaTitle": "马克思主义大辞典",
				"libraryCatalog": "CNKI Gongjushu",
				"pages": "735-736",
				"place": "北京",
				"publisher": "中国和平出版社",
				"url": "https://gongjushu.cnki.net/rbook/detail?invoice=GQlTLRpYUvBa40JLJtsXlB0Y5cKcOK2V9Qqz8THdK4iUPPXlKvxjE6W9GdsY8Gk%2F5Z57%2FpZ1cFI0PqqUsAp6rWzxB%2Fs8oNerVj1cbtAiKj9XuHK3IKnLM3kSp5Ucl4jxmZdA5ggDEO6vMKiq8PAJ%2BDaP%2BYYh1TLJjSdavSPnySY%3D&platform=NRBOOK&product=CRFD&filename=R2006073210001119&tablename=crfd2008&type=REFBOOK&scope=download&cflag=overlay&dflag=%E8%AF%8D%E6%9D%A1&pages=&language=CHS&nonce=35D731350F744DCA9AB690F0A6D31ED8",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
