{
	"translatorID": "9e61ab04-34ab-4db9-8292-429f70b32883",
	"label": "CNKI Law",
	"creator": "jiaojiaodubai",
	"target": "^https?://law(new)?\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-02-25 17:21:32"
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
	let main = doc.querySelector('.sh_mid');
	if (main) {
		Z.monitorDOMChanges(main, { childList: true, subtree: true });
	}
	let dbcode = tryMatch(url, /dbcode=([^&#/]+)/i, 1);
	Z.debug(dbcode);
	if (dbcode) {
		return {
			// Cina Law Knowledge, Journal
			CLKJ: 'journalArticle',
			// Cina Law Knowledge, Master
			CLKM: 'thesis',
			CLKB: 'thesis',
			CLKP: 'conferencePaper',
			CLKN: 'newspaperArticle',
			CLKL: 'statute',
			CLKC: 'case'
		}[dbcode];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	// 在Scaffold中无效
	var rows = doc.querySelectorAll('.GridTableContent td:nth-child(2) > a');
	Z.debug(rows.length);
	for (let row of rows) {
		row = row.cloneNode(true);
		while (row.querySelector('script')) {
			row.removeChild(row.querySelector('script'));
		}
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
		if (!items) return;
		for (let url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	let itemType = detectWeb(doc, url);
	if (['statute'].includes(itemType)) {
		await scrapeDoc(doc, url);
	}
	else {
		await scrapeAPI(doc, url);
	}
}

async function scrapeAPI(doc, url = doc.location.href) {
	let dbname = tryMatch(url, /dbname=([^&#/]+)/i, 1);
	Z.debug(`dbname: ${dbname}`);
	let filename = tryMatch(url, /filename=([^&#/]+)/i, 1);
	Z.debug(`filename: ${filename}`);
	let labels = new Labels(doc, '[class*="summary"] > p, [class*="summary"] > ul > li');
	Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	let extra = new Extra();
	let referDoc = await requestDocument(
		'https://lawnew.cnki.net/kns/ViewPage/viewsave.aspx?TablePre=SCDB&displayMode=EndNote',
		{
			method: 'POST',
			body: 'hid_KLogin_HFUrl=/KLogin/Request/GetKHF.ashx%3Fcallback%3D%3F'
				+ '&IsMirror=0'
				+ '&IsOpenInternet=1'
				+ '&IsLaw=1'
				+ '&PLatFormHomeLink=/KNS/brief/result.aspx%3FdbPrefix%3DCLKD'
				+ '&PLatFormHomeLinkM=/KNS/law/default.html'
				+ '&clearall='
				+ '&IsPrev='
				+ '&TablePre='
				+ '&QueryID='
				+ '&CookieName=FileNameS'
				+ '&displayMode=Refer'
				+ '&FileOpen=NO'
				+ '&FieldMaxLength=300'
				+ '&FileDisplayMode=REFER'
				+ '&FileSaveMode=REFER'
				+ '&CurSaveModeType=REFER'
				+ '&displayMode=new'
				+ '&displayMode=newdefine'
				+ '&displayMode=elearning'
				+ '&displayMode=pdl'
				+ '&displayMode=Refworks'
				+ '&displayMode=EndNote'
				+ '&displayMode=NoteExpress'
				+ '&displayMode=NodeFirst'
				+ '&displayMode=selfDefine'
				+ `&formfilenames=${dbname}!${filename}!1!0`,
			headers: { Refer: 'https://lawnew.cnki.net/kns/ViewPage/viewsave.aspx?TablePre=SCDB' }
		}
	);
	if (detectWeb(doc, url) == 'case') {
		let referText = referDoc.querySelector('.mainTable tbody > tr > td').innerHTML.replace(/<br>/g, '\n');
		let caseItem = new Z.Item('case');
		caseItem.caseName = text(doc, '#title > h1');
		caseItem.abstractNote = labels.get('本案争议焦点');
		caseItem.court = tryMatch(referText, /^%S (.*)/m, 1);
		caseItem.dateDecided = labels.get('审理年度');
		caseItem.url = 'https://lawnew.cnki.net/kcms/detail/detail.aspx?'
			+ `dbcode=${tryMatch(url, /dbcode=([^&#/]+)/i, 1)}`
			+ `&dbname=${tryMatch(url, /dbname=([^&#/]+)/i, 1)}`
			+ `&filename=${tryMatch(url, /filename=([^&#/]+)/i, 1)}`;
		caseItem.attachments.push({
			title: 'Snapshot',
			document: doc
		});
		doc.querySelectorAll('.keywords a').forEach(element => caseItem.tags.push(ZU.trimInternal(element.textContent)));
		fixItem(caseItem, extra, doc, url);
		caseItem.extra = extra.toString();
		caseItem.complete();
	}
	else {
		let referText = referDoc.querySelector('.mainTable tbody > tr > td').innerHTML.replace(/<br>/g, '\n');
		Z.debug(referText);
		let translator = Zotero.loadTranslator('import');
		translator.setTranslator('7b6b135a-ed39-4d90-8e38-65516671c5bc');
		translator.setString(referText);
		translator.setHandler('itemDone', (_obj, item) => {
			switch (item.itemType) {
				case 'journalArticle':
					extra.set('original-container-title', text(doc, 'a[onclick*="getKns"]', 1));
					break;
				case 'conferencePaper':
					item.proceedingsTitle = labels.get('会议录名称');
					extra.set('organizer', labels.get('机构').replace(/；$/, ''));
					break;
				case 'newspaperArticle':
					item.abstractNote = labels.get('正文快照');
					break;
			}
			fixItem(item, extra, doc, url);
			item.extra = extra.toString(item.extra);
			item.complete();
		});
		await translator.translate();
	}
}

async function scrapeDoc(doc, url = doc.location.href) {
	let labels = new Labels(doc, '[class*="summary"] > p, .summary > div > p');
	Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	let extra = new Extra();
	var newItem = new Z.Item(detectWeb(doc, url));
	let title = text(doc, '#title > h1');
	if (title.startsWith('中华人民共和国')) {
		newItem.shortTitle = title.substring(7);
	}
	newItem.abstractNote = labels.get('正文快照');
	switch (newItem.itemType) {
		case 'statute': {
			newItem.nameOfAct = title;
			newItem.publicLawNumber = labels.get('发文字号');
			newItem.dateEnacted = labels.get('发布日期');
			if (labels.get('时效性') == '已失效') {
				extra.set('Status', '已废止', true);
			}
			let rank = labels.get('效力级别');
			if (!rank.includes('法律')) {
				extra.set('Type', extra.get('Type') || 'regulation', true);
			}
			doc.querySelectorAll('.author a').forEach(element => newItem.creators.push(processName(element.textContent)));
			break;
		}
	}
	doc.querySelectorAll('.keywords a').forEach(element => newItem.tags.push(ZU.trimInternal(element.textContent)));
	fixItem(newItem, extra, doc, url);
	newItem.extra = extra.toString();
	newItem.complete();
}

function fixItem(item, extra, doc, url) {
	item.language = 'zh-CN';
	let labels = new Labels(doc, '[class*="summary"] > p, .summary > div > p');
	item.url = 'https://lawnew.cnki.net/kcms/detail/detail.aspx?'
		+ `dbcode=${tryMatch(url, /dbcode=([^&#/]+)/i, 1)}`
		+ `&dbname=${tryMatch(url, /dbname=([^&#/]+)/i, 1)}`
		+ `&filename=${tryMatch(url, /filename=([^&#/]+)/i, 1)}`;
	extra.set('applyDate', labels.get('实施日期'));
	extra.set('download', labels.get('下载频次'));
	extra.set('CNKICite', text(doc, '#rc3').slice(1, -1));
	let attachLink = doc.querySelector('[class*="pdf"] > a') || doc.querySelector('[class*="caj"] > a') || doc.querySelector('[class*="whole"] > a');
	if (attachLink) {
		let ext = attachLink.href.includes('pdfdown') ? 'PDF' : 'CAJ';
		item.attachments.push({
			url: attachLink.href,
			title: `Full Text ${ext}`,
			mimeType: `application/${ext.toLowerCase()}`
		});
	}
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

function processName(creator, creatorType = 'author') {
	return {
		firstName: '',
		lastName: creator,
		creatorType: creatorType,
		fieldMode: 1
	};
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://lawnew.cnki.net/KCMS/detail/detail.aspx?QueryID=28&CurRec=10&recid=&filename=ZGFX199301009&dbname=CLKJLAST&dbcode=CLKJ&pr=&urlid=&yx=&uid=WEEvREcwSlJHSldSdmVqeVpQRlVoK0VleDhxbTVFVHMrSS92T0crSTM3Yz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!&v=MTcyMjJyTmRyS3hGOUxNcm85RmJZUjhlWDFMdXhZUzdEaDFUM3FUcldNMUZyQ1VSNzZmWmVScEZpbmhXN3ZPUHk=",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "现代行政法的理论基础——论行政机关与相对一方的权利义务平衡",
				"creators": [
					{
						"firstName": "",
						"lastName": "罗豪才",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "袁曙宏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李文栋",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1993",
				"ISSN": "1003-1707",
				"abstractNote": "本文认为:行政法的全部发展过程就是行政机关与相对一方的权利义务从不平衡到平衡的过程。现代行政法不应是管理法、控权法,而应是“平衡法”,其存在的理论基础则应当是“平衡论”:即在行政机关与相对一方的权利义务关系中,权利与义务在总体上应当平衡。它既表现为行政机关与相对一方的权利和义务分别平衡,也表现为行政机关与相对一方各自权利义务的自我平衡。“平衡论”是以各种现实的法律手段作为存在基础和实现保障的。建立“平衡论”的理论范畴,对于推动行政法制建设沿着正确轨道发展,促进对于社会主义市场经济体制的形成,对于实现民主与效率的有机统一,对于建立具有中国特色的现代行政法学体系,都有着十分重要的意义。",
				"extra": "original-container-title: Chinese Legal Science\nCNKICite: 634",
				"issue": "1",
				"language": "zh-CN",
				"libraryCatalog": "CNKI Law",
				"pages": "52-59",
				"publicationTitle": "中国法学",
				"url": "https://lawnew.cnki.net/kcms/detail/detail.aspx?dbcode=CLKJ&dbname=CLKJLAST&filename=ZGFX199301009",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "古代行政法"
					},
					{
						"tag": "平衡论"
					},
					{
						"tag": "控权论"
					},
					{
						"tag": "权利义务"
					},
					{
						"tag": "权利义务平衡"
					},
					{
						"tag": "现代行政法"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://lawnew.cnki.net/KCMS/detail/detail.aspx?QueryID=35&CurRec=1&recid=&filename=1017175998.nh&dbname=CLKMLAST&dbcode=CLKM&pr=&urlid=&yx=&uid=WEEvREcwSlJHSldSdmVqeVpQRlVoK0VleDhxbTVFVHMrSS92T0crSTM3Yz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!&v=MTE3NTZVcnZMVkYyNkdiSy9HOWpGcDVFYlBJUjhlWDFMdXhZUzdEaDFUM3FUcldNMUZyQ1VSNzZmWmVScEZpams=",
		"items": [
			{
				"itemType": "thesis",
				"title": "德性的宪法实践",
				"creators": [
					{
						"firstName": "",
						"lastName": "许天问",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "汪太贤",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2017",
				"abstractNote": "“法律是什么”的追问贯穿德沃金法哲学的始终,宪法道德解读亦不例外,它诉诸“整全法”概念观指引下的建构性诠释,将美国宪法,尤其它的权利法案,诠释为政治道德原则的表达。但道德解读并非只是从政治道德的角度界定了自由和平等这样的政治权利。相反,道德解读主张宪法实践有其内在的善,即公民在政治共同体之中的“好好生活”与“良善生活”。“整全法”则要求宪法实践的参与者将宪法不是视为分立的规则,而是视为原则上融贯的、朝向公民好好生活与良善生活之伦理理想的叙事统一。道德解读这两方面的特质,共同决定了自由和平等的“政治德性”身份。易言之,自由与平等不是义务论框架下的权利,而是实践宪法的共同体为获取宪法实践内在善而必...",
				"extra": "CNKICite: 3",
				"language": "zh-CN",
				"libraryCatalog": "CNKI Law",
				"thesisType": "硕士学位论文",
				"university": "西南政法大学",
				"url": "https://lawnew.cnki.net/kcms/detail/detail.aspx?dbcode=CLKM&dbname=CLKMLAST&filename=1017175998.nh",
				"attachments": [
					{
						"title": "Full Text CAJ",
						"mimeType": "application/caj"
					}
				],
				"tags": [
					{
						"tag": "反思性实践"
					},
					{
						"tag": "存在论诠释"
					},
					{
						"tag": "政治德性"
					},
					{
						"tag": "整全法"
					},
					{
						"tag": "美国宪法"
					},
					{
						"tag": "道德解读"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://lawnew.cnki.net/KCMS/detail/detail.aspx?QueryID=42&CurRec=1&recid=&filename=1021525514.nh&dbname=CLKBLAST&dbcode=CLKB&pr=&urlid=&yx=&uid=WEEvREcwSlJHSldSdmVqeVpQRlVoK0VleDhxbTVFVHMrSS92T0crSTM3Yz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!&v=MDA1NjBlWDFMdXhZUzdEaDFUM3FUcldNMUZyQ1VSNzZmWmVScEZpamtVN3pNVkYyNUg3YTZHOVROcTVFYlBJUjg=",
		"items": [
			{
				"itemType": "thesis",
				"title": "公民不服从与美国宪法权利内容演进的逻辑",
				"creators": [
					{
						"firstName": "",
						"lastName": "阮文杰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张明军",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2020",
				"abstractNote": "公民不服从是一种合乎法律原则和法律精神的社会行动,它至少包含三个构成要素,即公民不服从的路径选择、公民不服从的合法性依据、公民不服从的正当性理由。其中,公民不服从的路径选择主要用于解决公民行动的手段和方式问题,公民不服从的合法性依据主要用于解决社会行动与宪法及其法律体系之间的关系问题,公民不服从的正当性理由主要用于解决公民行动的社会基础问题。公民不服从与美国宪法权利内容演进的研究,主要考察作为一种游走于法律边缘的公民权利行动,如何参与到美国宪法修正的实践过程中。根据近代以来西方政治理论及其实践,相比于封建社会,近代国家将自身的合法性建构于公民同意基础之上,这区别于之前的神学合法性,使得公民不同...",
				"extra": "CNKICite: 0",
				"language": "zh-CN",
				"libraryCatalog": "CNKI Law",
				"thesisType": "博士学位论文",
				"university": "华东政法大学",
				"url": "https://lawnew.cnki.net/kcms/detail/detail.aspx?dbcode=CLKB&dbname=CLKBLAST&filename=1021525514.nh",
				"attachments": [
					{
						"title": "Full Text CAJ",
						"mimeType": "application/caj"
					}
				],
				"tags": [
					{
						"tag": "公民不服从"
					},
					{
						"tag": "宪法"
					},
					{
						"tag": "权利条款"
					},
					{
						"tag": "演进"
					},
					{
						"tag": "美国"
					},
					{
						"tag": "运动"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://lawnew.cnki.net/KCMS/detail/detail.aspx?QueryID=49&CurRec=1&recid=&filename=SHFX201906001007&dbname=CLKPLAST&dbcode=CLKP&pr=&urlid=&yx=&uid=WEEvREcwSlJHSldSdmVqeVpQRlVoK0VleDhxbTVFVHMrSS92T0crSTM3Yz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!&v=MDg4MTVmWmVKdkZDdmlVci9KSTE4UU5pWE5kckc0SDlqTXFZOUZaZXNQQ3hOS3VoZGhuajk4VG5qcXF4ZEVlTU9VS3Jp",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "正当防卫限度的判断规则",
				"creators": [
					{
						"firstName": "",
						"lastName": "吴允锋",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019",
				"abstractNote": "重视法益均衡的司法实践,忽视了实施正当防卫不需要满足法益均衡性和补充性。优越利益说和法益欠缺说,不能为防卫行为不需要法益均衡性和补充性提供充足理由。明确正当防卫限度的前提是,区分利益评价基准和利益评价对象。应从正当防卫的制度目是权利保护和公力救济例外的角度,说明作为权利行使行为的正当防卫的内在限度。对于不具有可恢复性或者恢复原状困难的法益,只要是为保护法益所必需的行为,无需进行利益衡量;对于超出必要限度造成损害,可以根据利益衡量的原理,权衡是否应将之评价为防卫过当。在现实的损害结果确定之际,如果能假定在应然的\"必要限度\"内的防卫措施造成的损害越轻,该现实的防卫行为趋向于被评价为\"明显\"超过必要...",
				"extra": "organizer: 华东政法大学文伯书院\nCNKICite: 5",
				"language": "zh-CN",
				"libraryCatalog": "CNKI Law",
				"pages": "17",
				"proceedingsTitle": "《上海法学研究》集刊（2019年第3卷 总第3卷）",
				"url": "https://lawnew.cnki.net/kcms/detail/detail.aspx?dbcode=CLKP&dbname=CLKPLAST&filename=SHFX201906001007",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "判断规则"
					},
					{
						"tag": "利益衡量"
					},
					{
						"tag": "制度目的"
					},
					{
						"tag": "权利行使"
					},
					{
						"tag": "防卫限度"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://lawnew.cnki.net/KCMS/detail/detail.aspx?QueryID=56&CurRec=1&recid=&filename=RMRB201608310180&dbname=CLKNLAST&dbcode=CLKN&pr=&urlid=&yx=&uid=WEEvREcwSlJHSldSdmVqeVpQRlVoK0VleDhxbTVFVHMrSS92T0crSTM3Yz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!&v=MjMwMDB1aGRobmo5OFRuanFxeGRFZU1PVUtyaWZaZUp2RkN2aVVyL0pJMXdTTnlEWmJMRzRIOWZNcDR4RVpPb0hEQk5L",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "判决书上网带来了什么",
				"creators": [
					{
						"firstName": "",
						"lastName": "本报记者徐隽",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2016-08-31",
				"abstractNote": "2013年11月28日，最高人民法院出台《关于人民法院在互联网公布裁判文书的规定》，拉开了全国法院裁判文书上网公开的序幕。$$“把所有裁判文书在网上全文公开，这在世界范围看，也是独一家。目前，中国裁判文书网已经成为全球最大的裁判文书公开网，成为国内外研究中国司法",
				"language": "zh-CN",
				"libraryCatalog": "CNKI Law",
				"pages": "18",
				"publicationTitle": "人民日报",
				"url": "https://lawnew.cnki.net/kcms/detail/detail.aspx?dbcode=CLKN&dbname=CLKNLAST&filename=RMRB201608310180",
				"attachments": [
					{
						"title": "Full Text PDF",
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
		"url": "https://lawnew.cnki.net/KCMS/detail/detail.aspx?QueryID=70&CurRec=1&dbcode=CLKL&dbname=CLKL0817&filename=la201703160033&urlid=&yx=&uid=WEEvREcwSlJHSldSdmVqeVpQRlVoK0VleDhxbTVFVHMrSS92T0crSTM3Yz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!&v=MTM5MTk2UUhqbjNSTkVlZDJXUmJpYlorUnRFQ25sVXIzTUpBPT1DUXk1SHJLL0h0TE5xWTlGWitoZ2Z3azR2V0lUNnps",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中华人民共和国民法总则",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国人民代表大会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2017-03-15",
				"abstractNote": "第一章 基本规定 第一条 为了保护民事主体的合法权益，调整民事关系，维护社会和经济秩序，适应中国特色社会主义发展要求，弘扬社会主义核心价值观，根据宪法，制定本法。 第二条 民法调整平等主体的自然人、法人和非法人组织之间的人身关系和财产关系。 第三条 民?",
				"extra": "Status: 已废止\napplyDate: 2017-10-01",
				"language": "zh-CN",
				"publicLawNumber": "中华人民共和国主席令第六十六号",
				"shortTitle": "民法总则",
				"url": "https://lawnew.cnki.net/kcms/detail/detail.aspx?dbcode=CLKL&dbname=CLKL0817&filename=la201703160033",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "民法总则"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://lawnew.cnki.net/KCMS/detail/detail.aspx?QueryID=78&CurRec=4&dbcode=CLKL&dbname=CLKL0817&filename=la20071207001838&urlid=&yx=&uid=WEEvREcwSlJHSldSdmVqeVpQRlVoK0VleDhxbTVFVHMrSS92T0crSTM3Yz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!&v=MjM3NjZOS3VoZGhuajk4VG5qcXF4ZEVlTU9VS3JpZlplSnZGQ3ZpVXIvSkpWd1VDUXk1SHJPL0g5UE1xSTlGWmVNTUJC",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "国务院关于在全国建立农村最低生活保障制度的通知",
				"creators": [
					{
						"firstName": "",
						"lastName": "国务院",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2007-07-11",
				"abstractNote": "各省、自治区、直辖市人民政府，国务院各部委、各直属机构：为贯彻落实党的十六届六中全会精神，切实解决农村贫困人口的生活困难，国务院决定，2007年在全国建立农村最低生活保障制度。现就有关问题通知如下：一、充分认识建立农村最低生活保障制度的重要意义改?",
				"extra": "Type: regulation\napplyDate: 2007-07-11",
				"language": "zh-CN",
				"publicLawNumber": "国发[2007]19号",
				"url": "https://lawnew.cnki.net/kcms/detail/detail.aspx?dbcode=CLKL&dbname=CLKL0817&filename=la20071207001838",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "农村最低生活保障"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://lawnew.cnki.net/KCMS/detail/detail.aspx?QueryID=86&CurRec=1&dbcode=CLKL&dbname=CLKL0817&filename=la20071213000480&urlid=&yx=&uid=WEEvREcwSlJHSldSdmVqeVpQRlVoK0VleDhxbTVFVHMrSS92T0crSTM3Yz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!&v=MTg1MjluanFxeGRFZU1PVUtyaWZaZUp2RkN2aVVyL0pKMTBSQ1F5NUhyTy9IOVBOckk5RlpPOEhEQk5LdWhkaG5qOThU",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "最高人民法院、最高人民检查院关于依法严惩破坏计划生育犯罪活动的通知",
				"creators": [
					{
						"firstName": "",
						"lastName": "最高人民法院",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "最高人民检察院",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "1993-11-12",
				"abstractNote": "各省、自治区、直辖市高级人民法院、人民检察院，解放军军事法院、军事检察院：实行计划生育是我国的一项基本国策。它关系到民族的昌盛、子孙后代的幸福。对少数人以各种手段破坏计划生育工作的行为，除进行必要的教育外，对那些伪造计划生育证明出售牟利，多次为他人做",
				"extra": "Status: 已废止\nType: regulation\napplyDate: 1993-11-12",
				"language": "zh-CN",
				"publicLawNumber": "法发[1993]36号",
				"url": "https://lawnew.cnki.net/kcms/detail/detail.aspx?dbcode=CLKL&dbname=CLKL0817&filename=la20071213000480",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "犯罪活动"
					},
					{
						"tag": "计划生育"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://lawnew.cnki.net/KCMS/detail/detail.aspx?QueryID=102&CurRec=1&dbcode=CLKL&dbname=CLKL0817&filename=la201711060039&urlid=&yx=&uid=WEEvREcwSlJHSldSdmVqeVpQRlVoK0VleDhxbTVFVHMrSS92T0crSTM3Yz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!&v=MTQyOTU0dldJVDZ6bDZRSGpuM1JORWVkMldSYmliWitSdEVDbmxVcm5KSVE9PUNReTVIcksvSDlETXFZOUZaK0pnZndr",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中华人民共和国刑法修正案(十)",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国人民代表大会常务委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2017-11-04",
				"abstractNote": "为了惩治侮辱国歌的犯罪行为，切实维护国歌奏唱、使用的严肃性和国家尊严，在刑法第二百九十九条中增加一款作为第二款，将该条修改为： “在公共场合，故意以焚烧、毁损、涂划、玷污、践踏等方式侮辱中华人民共和国国旗、国徽的，处三年以下有期徒刑、拘役、管制或者剥夺?",
				"extra": "applyDate: 2017-11-04",
				"language": "zh-CN",
				"publicLawNumber": "中华人民共和国主席令第八十号",
				"shortTitle": "刑法修正案(十)",
				"url": "https://lawnew.cnki.net/kcms/detail/detail.aspx?dbcode=CLKL&dbname=CLKL0817&filename=la201711060039",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "刑十"
					},
					{
						"tag": "刑法"
					},
					{
						"tag": "刑法修正案"
					},
					{
						"tag": "刑法修正案十"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://lawnew.cnki.net/KCMS/detail/detail.aspx?QueryID=112&CurRec=1&dbcode=CLKC&dbname=CLKCPREP202306&filename=cap230715m0000086&urlid=&yx=&uid=WEEvREcwSlJHSldSdmVqeVpQRlVoK0VleDhxbTVFVHMrSS92T0crSTM3Yz0=$9A4hF_YAuvQ5obgVAqNKPCYcEjKensW4IQMovwHtwkF4VYPoHbKxJw!!&v=MDU4NjdQQkhwV3ZHTVNtRXQ5U1hubHBCVXdDTFBsUmRXZForUnJGaXZtVkw3SUlWZ1Jhdz09Qmd6N0hMQzRHZERKOG85RlpPcw==",
		"items": [
			{
				"itemType": "case",
				"caseName": "某保险销售服务(北京)股份有限公司与北京新致某信息技术有限公司计算机软件开发合同纠纷上诉案",
				"creators": [],
				"court": "某高级人民法院",
				"language": "zh-CN",
				"url": "https://lawnew.cnki.net/kcms/detail/detail.aspx?dbcode=CLKC&dbname=CLKCPREP202306&filename=cap230715m0000086",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Full Text CAJ",
						"mimeType": "application/caj"
					}
				],
				"tags": [
					{
						"tag": "计算机软件开发合同"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
