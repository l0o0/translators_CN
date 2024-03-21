{
	"translatorID": "56702e37-439e-4bd4-aee3-af0540792599",
	"label": "NDLTD",
	"creator": "jiaojiaodubai",
	"target": "^https?://ndltd.ncl.edu.tw",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-03-21 06:39:21"
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


function detectWeb(doc, _url) {
	if (doc.querySelector('input#fe_text1')) {
		return 'thesis';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('a.slink');
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
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		Z.debug(items);
		if (!items) return;
		for (let url of Object.keys(items)) {
			// 需要瀏覽器環境
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc);
	}
}

async function scrape(doc) {
	Z.debug(doc.body.innerText);
	let labels = new LabelsX(doc, '#aa:first-child > #format0_disparea > tbody > tr');
	let extra = new Extra();
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	let newIetm = new Z.Item('thesis');
	newIetm.title = labels.getWith('論文名稱');
	newIetm.abstractNote = text(doc, '#aa:nth-child(2) > #format0_disparea').replace(/\s{2,}/g, '\n');
	newIetm.thesisType = labels.getWith('學位類別') + '學位論文';
	newIetm.university = labels.getWith('校院名稱');
	newIetm.date = labels.getWith('論文出版年');
	newIetm.numPages = labels.getWith('論文頁數');
	newIetm.language = 'zh-TW';
	newIetm.url = attr(doc, 'input#fe_text1', 'value');
	newIetm.libraryCatalog = '臺灣博碩士論文知識加值系統';
	extra.set('major', labels.getWith('學類').slice(0, -1));
	let creators = [];
	creators.push({
		firstName: '',
		lastName: labels.getWith('研究生'),
		creatorType: 'author',
		fieldMode: 1,
		original: ZU.capitalizeName(labels.getWith('研究生\\(外文\\)'))
	});
	let supervisorsZh = labels.getWith('指導教授').split(/[;，；、]\s*/);
	let supervisorsEn = labels.getWith('指導教授\\(外文\\)').split(/[;，；、]\s*/);
	supervisorsZh.forEach((supervisor, index) => {
		creators.push({
			firstName: '',
			lastName: supervisor,
			creatorType: 'contributor',
			fieldMode: 1,
			original: ZU.capitalizeName(supervisorsEn[index] || '')
		});
	});
	if (creators.some(creator => creator.original)) {
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	creators.forEach((creator) => {
		extra.push('original-author', creator.original, true);
		delete creator.original;
		newIetm.creators.push(creator);
	});
	newIetm.tags = `${labels.getWith('中文關鍵詞')}、${labels.getWith('外文關鍵詞')}`.split('、');
	newIetm.extra = extra.toString(labels.getWith('相關次數')
		.replace('被引用:', 'citation: ')
		.replace('點閱:', '\nview: ')
		.replace('評分:', '\nrating: ')
		.replace('下載:', '\ndownload')
		.replace('書目收藏:', '\nfavorite')
	);
	newIetm.complete();
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://ndltd.ncl.edu.tw/cgi-bin/gs32/gsweb.cgi?o=dnclcdr&s=id=%22078NTU02022007%22.&searchmode=basic",
		"items": [
			{
				"itemType": "thesis",
				"title": "梅雨鋒面的中尺度天气特徵TAME-IOP-13個案分析",
				"creators": [
					{
						"firstName": "",
						"lastName": "林清財",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "周仲島",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "1990",
				"abstractNote": "本文分析1987年6 月24-25 日梅雨鋒面南下伴隨的中尺度天氣特征,重要的結果包括:\n1.鋒面通過福建省武夷山與臺灣省中央山脈造成兩次斷裂, 且鋒面在各區的移動速度\n顯著不同.\n2.鋒面南下在武夷山東側造成一明顯類似冷空氣堤現象(cold-air damming)。\n3.西南氣流受鋒面與地形共同運作影響，在海峽兩岸形成顯著不同結構造成比地區的\n降水具有明顯的區域性特質。\n4.帶狀對流多至臺灣北部時，位於雷達東北的對流消散，西南則繼續發展，且此帶狀\n對流降水具有相當的區域性。\n由中尺度天氣特征的分析，結合綜觀環境條件，發現即使對流處於500 mb槽后不利上\n升運動的環境條件下，仍可在較深厚的西南氣流里發展，再從中層由北方乾空氣平流\n而來所造成的潛在不穩定層得到能量、配合高層的輻散風場，而發展為強烈的中尺度\n對流系統。",
				"extra": "original-author: Lin,Ging-Cai\noriginal-author: Zhou,Zhong-Dao\ncitation: 0\nview: 112\nrating: \ndownload0\nfavorite0\nmajor: 大氣科學學\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"林清財\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Lin,Ging-Cai\"},{\"firstName\":\"\",\"lastName\":\"周仲島\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"original\":\"Zhou,Zhong-Dao\"}]",
				"language": "zh-TW",
				"libraryCatalog": "臺灣博碩士論文知識加值系統",
				"numPages": "71",
				"thesisType": "碩士學位論文",
				"university": "國立臺灣大學",
				"url": "https://hdl.handle.net/11296/k7sa56",
				"attachments": [],
				"tags": [
					{
						"tag": "COLD-ARI-DAMMING"
					},
					{
						"tag": "TAME-IOP-B"
					},
					{
						"tag": "中尺度"
					},
					{
						"tag": "個案分析"
					},
					{
						"tag": "冷空气堤現象"
					},
					{
						"tag": "區域性"
					},
					{
						"tag": "天气特徵"
					},
					{
						"tag": "帶狀對流"
					},
					{
						"tag": "梅雨鋒面"
					},
					{
						"tag": "輻射風場"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://ndltd.ncl.edu.tw/cgi-bin/gs32/gsweb.cgi?o=dnclcdr&s=id=%22090NCHU0366004%22.&searchmode=basic",
		"items": [
			{
				"itemType": "thesis",
				"title": "特有植物臺灣粗榧保育之研究：以族群遺傳變異及生態生理特性之觀點",
				"creators": [
					{
						"firstName": "",
						"lastName": "黃士元",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "翁仁憲",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "蕭如英",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"abstractNote": "為保育瀕臨絕滅的台灣粗榧，本研究從分布和族群結構、族群之遺傳變異、生態生理特性、繁殖機制及保育評估利用等進行探討，並提出保育之策略及措施。\n調查得文獻分布紀錄47處；標本採集紀錄75處；實地調查57處。分布北從宜蘭礁溪沿中央山脈兩側南行迄屏東大武山。海拔從650至2,800 m，主要集中在1,800至2,300 m間的針闊葉混合林或針葉林，以極為零星的方式散生，雖可緩慢天然更新，但種子苗少見。其族群構造以反J型為多，顯示係較為耐陰性的樹種。但部分族群組成不完整，其開花結實不良，繁殖力低，傳播的效率又不佳，隱藏著導致瀕臨絕滅的潛在危機。但對於環境仍有相當的適應性，以增加族群生育地的空間和多樣性。\n應用RAPD方法研究11個族群248個個體的遺傳變異。以POPGENE分析得台灣粗榧基因流傳值(Nm)為2.4486，遺傳分化係數(Gst)為0.1696，其族群間之基因流傳尚稱順暢。遺傳變異上，以Shannon,s資訊指數分析得族群內之遺傳變異值佔84.61 ﹪，以Nei遺傳歧異度分析得族群內歧異度值占84.02 ﹪。以AMOVA分析得族群內個體間變方成分85.56 ﹪，族群間占14.44 ﹪。顯示台灣粗榧的遺傳變異主要存於族群內，有利於在多樣性環境中適應生存。\n光度對台灣粗榧苗木生長及形質有相當之影響，遮光有助於苗高伸長，但不利於地際直徑之增長，而全光下對兩者皆不利。過度或過低的光量對苗木乾物累積不利。低光下莖根率較大，而強光下莖根率則大幅下降且差異顯著。低光下，藉由增加側枝數、葉片總長及總葉面積以爭取光能；而在強光或全光下為防止傷害，則改變形態縮小葉面積、加厚葉片並增加單位氣孔帶上之氣孔數，，以適應光量變化。葉綠素含量在弱光下較高，光強度增加則含量降低。強光下其類胡蘿蔔素 / 總葉綠素的比值增加且差異顯著。光飽和點以相對光度47 ﹪最高，與在此一光度下具有最高之可溶性蛋白質含量及總乾物量的結果一致。且與在全光下生長者，其光合成曲線約在400－600μmol m-2 s-1的光量子密度下即趨光飽和來看，其苗木具有相當的耐陰性。\n野外雄雌性植株比例為1：1.41極為接近。自然發芽期在3至7月，以5月份最多。低溫層積對種子發芽有所助益。有性生殖週期長，種子具休眠，發芽期極長，對繁殖不利。肉質假種皮含有發芽抑制物質，可能為其繁殖的重要障礙，去除假種皮有利其種子發芽。\n台灣粗榧正因生育地環境迭遭破壞威脅其生存，再保育評估認為保護等級仍應維持列屬瀕臨絕滅(endangered)級，並積極保護其棲地及擴大族群以維繫生機。另台灣粗榧富含的生物鹼類及雙黃酮類化合物，證實具有抗癌症細胞的效果。極具藥用及園藝植物資源開發潛力。",
				"extra": "original-author: Shy--Yuan Hwang\noriginal-author: Jen--Hsien Weng\noriginal-author: Ju--Ying Hsiao\ncitation: 6\nview: 13677\nrating: \ndownload0\nfavorite15\nmajor: 生物學\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"黃士元\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Shy--Yuan Hwang\"},{\"firstName\":\"\",\"lastName\":\"翁仁憲\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"original\":\"Jen--Hsien Weng\"},{\"firstName\":\"\",\"lastName\":\"蕭如英\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"original\":\"Ju--Ying Hsiao\"}]",
				"language": "zh-TW",
				"libraryCatalog": "臺灣博碩士論文知識加值系統",
				"numPages": "260",
				"thesisType": "博士學位論文",
				"university": "國立中興大學",
				"url": "https://hdl.handle.net/11296/p7t42q",
				"attachments": [],
				"tags": [
					{
						"tag": "Cephalotaxaceae"
					},
					{
						"tag": "Cephalotaxus wilsoniana Hay."
					},
					{
						"tag": "RAPD"
					},
					{
						"tag": "conservation"
					},
					{
						"tag": "distribution"
					},
					{
						"tag": "ecophysiology"
					},
					{
						"tag": "endangered species"
					},
					{
						"tag": "population genetic variation"
					},
					{
						"tag": "三尖杉科"
					},
					{
						"tag": "保育"
					},
					{
						"tag": "分布"
					},
					{
						"tag": "台灣粗榧"
					},
					{
						"tag": "族群遺傳變異"
					},
					{
						"tag": "瀕臨絕滅種"
					},
					{
						"tag": "生態生理"
					},
					{
						"tag": "隨機增殖多型性核酸"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
