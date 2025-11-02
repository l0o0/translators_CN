{
	"translatorID": "eb876bd2-644c-458e-8d05-bf54b10176f3",
	"label": "Wanfang Data",
	"creator": "Ace Strong, rnicrosoft, Xingzhong Lin, jiaojiaodubai",
	"target": "^https?://(d|s|sns|c)\\.wanfangdata\\.com\\.cn",
	"minVersion": "2.0rc1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-11-02 09:14:00"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2014 jiaojiaodubai<jiaojiaodubai23@gmial.com>

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

const typeMap = {
	periodical: {
		attachmentType: 'perio',
		itemType: 'journalArticle'
	},
	thesis: {
		attachmentType: 'degree',
		itemType: 'thesis'
	},
	conference: {
		attachmentType: 'conference',
		itemType: 'conferencePaper'
	},
	patent: {
		attachmentType: 'patent',
		itemType: 'patent'
	},
	nstr: {
		// 不支持下载
		itemType: 'report'
	},
	cstad: {
		// 不支持下载
		itemType: 'report'
	},
	standard: {
		attachmentType: 'standard',
		itemType: 'standard'
	},
	claw: {
		attachmentType: 'legislations',
		itemType: 'statute'
	}
};

function detectWeb(doc, url) {
	const dynamic = doc.querySelector('#app, .container-flex, .periodical');
	if (dynamic) {
		Z.monitorDOMChanges(dynamic, { childList: true, subtree: true });
	}
	for (const key in typeMap) {
		if (new RegExp(`/${key}/`, 'i').test(url)) {
			return typeMap[key].itemType;
		}
	}
	if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	// search results
	if (doc.querySelector('.result-list-container')) {
		const rows = doc.querySelectorAll('div.normal-list');
		for (const row of rows) {
			const title = text(row, '.title');
			const hiddenId = text(row, 'span.title-id-hidden');
			const [type, id] = hiddenId.split('_');
			if (!title || !hiddenId) continue;
			if (checkOnly) return true;
			found = true;
			items[JSON.stringify({
				type,
				id
			})] = title;
		}
	}
	// journal navigation
	else if (doc.querySelector('wf-article-list')) {
		const rows = doc.querySelectorAll('wf-article-list > wf-article-item');
		for (const row of rows) {
			const title = attr(row, 'input', 'value');
			const id = attr(row, 'input', 'docuid');
			if (!title || !id) continue;
			if (checkOnly) return true;
			found = true;
			items[JSON.stringify({
				type: 'periodical',
				id
			})] = title;
		}
	}
	// cstr navigation
	else if (doc.querySelector('.ivu-table')) {
		const rows = doc.querySelectorAll('.ivu-table-row');
		for (const row of rows) {
			const title = text(row, '.title-link');
			const href = attr(row, '.title-link', 'href');
			const { id } = getUrlParam(href);
			if (!title || !id) continue;
			if (checkOnly) return true;
			found = true;
			items[JSON.stringify({
				type: 'nstr',
				id
			})] = title;
		}
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) === 'multiple') {
		const items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const key in items) {
			const { type, id } = JSON.parse(key);
			await scrapeExportApi(type, id);
		}
	}
	else {
		const pathParts = new URL(attr(doc, 'meta[property="og\\:url"]', 'content')).pathname.split('/');
		const type = pathParts[1].toLowerCase();
		const id = pathParts[2];
		try {
			// throw new Error('debug');
			if (type === 'standard') {
				throw new Error('for standard, it is better to scrape data from webpage');
			}
			await scrapeDetilApi(type, id);
		}
		catch (error) {
			Z.debug(error);
			await scrapePage(doc, type, id);
		}
	}
}

async function scrapePage(doc, type, id) {
	const data = getLabeledData(
		doc.querySelectorAll('.detailList .list'),
		row => text(row, '.item').slice(0, -1),
		row => row.querySelector('.item+*'),
		doc.createElement('div')
	);
	const extra = new Extra();
	const newItem = new Zotero.Item(typeMap[type].itemType);
	newItem.title = text(doc, '.detailTitleCN > :first-child > span:first-child,.detailTitleCN > span:first-child');
	extra.set('original-title', ZU.capitalizeTitle(text(doc, '.detailTitleEN')), true);
	newItem.abstractNote = ZU.trimInternal(text(doc, '.summary > .item+*'));
	doc.querySelectorAll('.author.detailTitle > .itemUrl > a').forEach((elm) => {
		newItem.creators.push(cleanAuthor(elm.innerText.replace(/[\s\d,]*$/, ''), 'author'));
	});
	newItem.language = {
		eng: 'en-US',
		chi: 'zh-CN'
	}[data('语种')] || 'zh-CN';
	switch (newItem.itemType) {
		case 'journalArticle': {
			const pubInfo = text(doc, '.publishData > .item+*');
			newItem.date = tryMatch(pubInfo, /^\d{4}/);
			newItem.volume = tryMatch(pubInfo, /,0*(\d+)\(/, 1);
			newItem.issue = tryMatch(pubInfo, /\((.+?)\)/, 1).replace(/0*(\d+)/, '$1');
			newItem.publicationTitle = text(doc, '.periodicalName').replace(/\(([^)]+)\)$/, '（$1）');
			newItem.pages = tryMatch(data('页数'), /\((.+)\)/, 1)
				.replace(/\b0*(\d+)/, '$1')
				.replace(/\+/g, ',')
				.replace(/~/g, '-');
			newItem.DOI = ZU.cleanDOI(text(doc, '.doiStyle > a'));
			newItem.ISSN = ZU.cleanISSN(text(doc, '.periodicalDataItem'));
			break;
		}
		case 'thesis':
			newItem.thesisType = `${text(doc, '.degree > .itemUrl')}学位论文`;
			newItem.university = text(doc, '.detailOrganization');
			doc.querySelectorAll('.tutor > .itemUrl > a').forEach((element) => {
				newItem.creators.push(cleanAuthor(element.innerText, 'contributor'));
			});
			newItem.date = tryMatch(text(doc, '.thesisYear'), /\d+/);
			extra.set('major', text(doc, '.major > .itemUrl'));
			break;
		case 'conferencePaper':
			newItem.date = text(doc, '.meetingDate > .itemUrl');
			newItem.proceedingsTitle = text(doc, '.mettingCorpus > .itemUrl');
			newItem.conferenceName = data('会议名称');
			newItem.place = text(doc, '.meetingArea > .itemUrl');
			newItem.pages = text(doc, '.pageNum > .itemUrl');
			extra.set('organizer', text(doc, '.sponsor > .itemUrl'), true);
			break;
		case 'patent':
			data('发明/设计人', true).querySelectorAll('a').forEach((elemant) => {
				newItem.creators.push(cleanAuthor(elemant.innerText, 'inventor'));
			});
			data('代理人', true).querySelectorAll('.multi-sep').forEach((elemant) => {
				newItem.creators.push(cleanAuthor(elemant.innerText, 'attorneyAgent'));
			});
			newItem.patentNumber = text(doc, '.publicationNo > .itemUrl a') || tryMatch(text(doc, '.publicationNo > .itemUrl'), /\w+/);
			newItem.applicationNumber = text(doc, '.patentCode > .itemUrl');
			newItem.country = newItem.place = patentCountry(newItem.patentNumber || newItem.applicationNumber);
			newItem.assignee = data('申请/专利权人');
			newItem.filingDate = data('申请日期');
			newItem.priorityNumbers = data('优先权');
			newItem.issueDate = data('公开/公告日');
			newItem.legalStatus = text(doc, '.periodicalContent .messageTime > span:last-child');
			newItem.rights = text(doc, '.signoryItem > .itemUrl');
			extra.set('genre', text(doc, '.patentType > .itemUrl'), true);
			break;
		case 'report':
			newItem.institution = text(doc, '.organization > .itemUrl');
			if (type === 'nstr') {
				newItem.reportType = {
					'en-US': 'Science and technology report',
					'zh-CN': '科技报告'
				}[newItem.language];
				newItem.date = text(doc, '.preparationTime > .itemUrl');
				newItem.archiveLocation = text(doc, '.libNum > .itemUrl');
			}
			else if (type === 'cstad') {
				newItem.abstractNote = text(doc, '.abstract > .itemUrl');
				newItem.reportType = {
					'en-US': 'Achievement report',
					'zh-CN': '成果报告'
				}[newItem.language];
				newItem.reportNumber = text(doc, '.id > .itemUrl');
				newItem.date = text(doc, '.publishYear > .itemUrl');
				extra.set('project', text(doc, '.projectName > .itemUrl'));
				doc.querySelectorAll('.creator.list .multi-sep').forEach((elm) => {
					newItem.creators.push(cleanAuthor(elm.innerText));
				});
			}
			break;
		case 'standard':
			newItem.title = text(doc, '.detailTitleCN').replace(/(\p{Unified_Ideograph})\s+(\p{Unified_Ideograph})/u, '$1　$2');
			newItem.number = text(doc, '.standardId > .itemUrl').replace('-', '—');
			newItem.date = text(doc, '.issueDate > .itemUrl');
			newItem.publisher = data('出版单位');
			newItem.status = text(doc, '.status > .itemUrl');
			extra.set('CCS', text(doc, '.ccsCode > .itemUrl'));
			extra.set('ICS', text(doc, '.ICSCode > .itemUrl'));
			extra.set('applyDate', text(doc, '.applyDate > .itemUrl'));
			extra.set('substitute', text(doc, '.newStandard > .itemUrl'));
			extra.set('reference', text(doc, '.citeStandard > .itemKeyword'));
			extra.set('adopted', text(doc, '.adoptStandard > .itemUrl'));
			newItem.creators.push(cleanAuthor(text(doc, '.technicalCommittee > .itemUrl').replace(/\(.+?\)$/, '')));
			break;
		case 'statute':
			if (/（\d{4}.*）$/.test(newItem.title)) {
				extra.set('edition', tryMatch(newItem.title, /（(\d{4}.*)）$/, 1), true);
				newItem.title = tryMatch(newItem.title, /(^.+)（.+?）$/, 1);
			}
			if (newItem.title.startsWith('中华人民共和国')) {
				newItem.shortTitle = newItem.title.substring(7);
			}
			newItem.publicLawNumber = text(doc, '.issueNumber > .itemUrl');
			newItem.dateEnacted = text(doc, '.issueDate > .itemUrl');
			if (!text(doc, '.effectLevel > .itemUrl').includes('法律')) {
				extra.set('type', 'regulation', true);
			}
			if (text(doc, '.effect > .itemUrl') === '失效') {
				extra.set('status', '已废止', true);
			}
			extra.set('applyDate', text(doc, '.applyDate > .itemUrl'));
			text(doc, '.issueUnit > .itemUrl').split(/[;，；、]\s?/).forEach(string => newItem.creators.push(cleanAuthor(string)));
			break;
	}
	newItem.url = `https://d.wanfangdata.com.cn/${type}/${id}`;
	extra.set('CLC', text(doc, '.classify > .itemUrl, .classCodeMapping > .itemUrl'));
	doc.querySelectorAll('.keyword > .item+* > a, .keywordEN > .item+* > a').forEach((elm) => {
		newItem.tags.push(elm.innerText);
	});
	const attachmentType = typeMap[type].attachmentType;
	if (attachmentType) {
		newItem.attachments.push({
			url: encodeURI('https://oss.wanfangdata.com.cn/www/'
				+ `${doc.title}.ashx?`
				+ `&type=${attachmentType}`
				+ `&resourceId=${id}`),
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	newItem.extra = extra.toString();
	newItem.complete();
}

function getLabeledData(rows, labelGetter, dataGetter, defaultElm) {
	const labeledElm = {};
	for (const row of rows) {
		labeledElm[labelGetter(row, rows)] = dataGetter(row, rows);
	}
	const data = (labels, element = false) => {
		if (Array.isArray(labels)) {
			for (const label of labels) {
				const result = data(label, element);
				if (
					(element && /\S/.test(result.textContent))
					|| (!element && /\S/.test(result))) {
					return result;
				}
			}
			return element ? defaultElm : '';
		}
		const targetElm = labeledElm[labels];
		return targetElm
			? element ? targetElm : ZU.trimInternal(targetElm.textContent)
			: element ? defaultElm : '';
	};
	return data;
}

async function scrapeDetilApi(type, id) {
	const reqMassage = DetailInfoRequest.create({
		resourcetype: type.charAt(0).toUpperCase() + type.substring(1),
		id: id
	});
	const decoder = new TextDecoder();
	const reqBuffer = prependHead(DetailInfoRequest.encode(reqMassage).finish());
	const respond = await request('/Detail.DetailService/getDetailInFormation', {
		method: 'POST',
		body: decoder.decode(reqBuffer),
		headers: {
			'Content-Type': 'application/grpc-web+proto',
			Referer: `https://d.wanfangdata.com.cn/${type}/${id}`
		},
		// responseType: 'arraybuffer',
		responseCharset: 'x-user-defined'
	});
	const headLength = 5;
	// https://groups.google.com/g/zotero-dev/c/gjfM2QK08p4
	const resBuffer = new Uint8Array(respond.body.length - headLength);
	for (let x = 0; x < respond.body.length; x++) {
		resBuffer[x] = respond.body.charCodeAt(x + headLength) & 0xff;
	}
	const resObject = DetailResponse.toObject(DetailResponse.decode(resBuffer), { defaults: true });
	parseJson(resObject.detail[0][type === 'cstad' ? 'cstadt' : type], type, id);
}

async function scrapeExportApi(type, id) {
	const reqMsg = ExportRequest.create({ hiddenid: `${type}_${id}` });
	const reqBuffer = prependHead(ExportRequest.encode(reqMsg).finish());
	const decoder = new TextDecoder('utf-8');
	const respond = await request('https://s.wanfangdata.com.cn/WwwService.ExportService/export', {
		method: 'POST',
		body: decoder.decode(reqBuffer),
		headers: {
			'Content-Type': 'application/grpc-web+proto'
		},
		responseCharset: 'x-user-defined'
	});
	// https://groups.google.com/g/zotero-dev/c/gjfM2QK08p4
	const resBuffer = new Uint8Array(respond.body.length);
	for (let i = 0; i < respond.body.length; i++) {
		resBuffer[i] = respond.body.charCodeAt(i) & 0xff;
	}
	const head = resBuffer.slice(0, 5);
	let hexStrHead = '';
	for (let i = 0; i < head.length; i++) {
		hexStrHead += head[i].toString(16).padStart(2, '0');
	}
	const pbLength = parseInt(hexStrHead, 16);
	const targetBuffer = resBuffer.slice(5, 5 + pbLength);
	const resObject = ExportResponse.toObject(ExportResponse.decode(targetBuffer), { defaults: true });
	parseJson(resObject.resourceList[0][type === 'cstad' ? 'cstadt' : type], type, id);
}

function prependHead(body) {
	let length = body.length;
	const head = new Uint8Array(5);
	for (let i = 0; i < 5; ++i) {
		head[4 - i] = length & 0xff;
		length >>= 8;
	}
	const fullBuffer = new Uint8Array(head.length + body.length);
	fullBuffer.set(head, 0);
	fullBuffer.set(body, head.length);
	return fullBuffer;
}

function parseJson(json, type, id) {
	const extra = new Extra();
	const newItem = new Z.Item(typeMap[type].itemType);
	newItem.title = json.titleList[0];
	extra.set('original-title', ZU.capitalizeTitle(json.titleList[1] || ''), true);
	newItem.abstractNote = ZU.trimInternal(json.abstractList[0] || '');
	newItem.language = {
		eng: 'en-US',
		chi: 'zh-CN'
	}[json.language] || 'zh-CN';
	switch (newItem.itemType) {
		case 'journalArticle': {
			newItem.publicationTitle = json.periodicaltitleList[0].replace(/\(([^)]+)\)$/, '（$1）');
			extra.set('original-container-title', json.periodicaltitleList[1], true);
			newItem.volume = json.volum;
			newItem.issue = json.issue;
			newItem.pages = json.page;
			newItem.date = ZU.strToISO(json.publishdate || '');
			newItem.ISSN = json.issn;
			extra.set('fund', json.fundList.join(', '));
			const creators = [];
			for (let i = 0; i < json.creatorList.length; i++) {
				const creator = cleanAuthor(json.creatorList[i]);
				newItem.creators.push(JSON.parse(JSON.stringify(creator)));
				if (json.foreigncreatorList[i]) {
					const enCreator = cleanAuthor(ZU.capitalizeName(json.foreigncreatorList[i]));
					const enCreatorStr = `${enCreator.firstName} || ${enCreator.lastName}`;
					creator.original = enCreatorStr;
					extra.push('original-creator', enCreatorStr, true);
				}
				creators.push(creator);
			}
			if (creators.some(creator => creator.original)) {
				extra.set('creatorsExt', JSON.stringify(creators));
			}
			break;
		}
		case 'thesis':
			newItem.thesisType = `${json.degree}学位论文`;
			newItem.date = ZU.strToISO(json.publishdate || '');
			newItem.university = json.organizationnewList[0];
			newItem.numPages = json.pageno;
			json.creatorList.forEach(name => newItem.creators.push(cleanAuthor(name)));
			json.tutorList.forEach(name => newItem.creators.push(cleanAuthor(name, 'contributor')));
			extra.set('major', json.major);
			break;
		case 'conferencePaper':
			newItem.date = ZU.strToISO(json.publishdate || '');
			newItem.proceedingsTitle = json.meetingcorpus;
			newItem.conferenceName = json.meetingtitleList[0];
			newItem.place = json.meetingarea;
			newItem.pages = json.page;
			json.creatorList.forEach(name => newItem.creators.push(cleanAuthor(name)));
			break;
		case 'patent':
			newItem.patentNumber = json.publicationno;
			newItem.applicationNumber = json.patentcode;
			newItem.place = newItem.country = patentCountry(newItem.patentNumber || newItem.applicationNumber);
			newItem.assignee = json.applicantList.join(', ');
			newItem.filingDate = ZU.strToISO(json.applicationdate);
			if (json.priorityList) {
				newItem.priorityNumbers = json.priorityList.join(', ');
			}
			newItem.issueDate = ZU.strToISO(json.publicationdate);
			newItem.legalStatus = json.legalstatus;
			extra.set('genre', json.patenttype, true);
			json.inventorList.forEach(name => newItem.creators.push(cleanAuthor(name, 'inventor')));
			json.agent.split('%').forEach(name => newItem.creators.push(cleanAuthor(name, 'attorneyAgent')));
			break;
		case 'report':
			if (type === 'nstr') {
				newItem.reportType = {
					'en-US': 'Science and technology report',
					'zh-CN': '科技报告'
				}[newItem.language];
				newItem.reportNumber = json.id;
				newItem.place = json.area;
				newItem.institution = json.organizationList.join(', ');
				newItem.date = ZU.strToISO(json.publishdate);
				extra.set('project', json.projectname);
				json.creatorList.forEach(name => newItem.creators.push(cleanAuthor(name)));
			}
			else if (type === 'cstad') {
				newItem.date = ZU.strToISO(json.publishdate);
				newItem.reportType = {
					'en-US': 'Achievement report',
					'zh-CN': '成果报告'
				}[newItem.language];
				extra.set('fund', json.page);
				json.creatorList.forEach(name => newItem.creators.push(cleanAuthor(name)));
			}
			break;
		case 'standard':
			newItem.title = json.titleList[0].replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/, '$1　$2');
			newItem.number = json.standardno;
			newItem.date = ZU.strToISO(json.publishdate);
			newItem.publisher = json.sourcedbList[0];
			newItem.status = json.status;
			extra.set('CCS', json.ccscodeList.at(-1));
			extra.set('CCS', json.icscodeList.at(-1));
			// Viewing paid fields requires sending a request with transaction information, but simulating transactions is difficult
			extra.set('applyDate', ZU.strToISO(json.applydate || ''));
			break;
		case 'statute':
			if (/（\d{4}.*）$/.test(newItem.title)) {
				extra.set('edition', tryMatch(newItem.title, /（(\d{4}.*)）$/, 1), true);
				newItem.title = tryMatch(newItem.title, /(^.+)（.+?）$/, 1);
			}
			if (newItem.title.startsWith('中华人民共和国')) {
				newItem.shortTitle = newItem.title.substring(7);
			}
			newItem.publicLawNumber = json.issuenumber;
			newItem.dateEnacted = ZU.strToISO(json.issuedate || '');
			if (json.effectlevel.includes('法律')) {
				extra.set('type', 'regulation', true);
			}
			if (json.effect === '失效') {
				extra.set('status', '已废止', true);
			}
			extra.set('applyDate', json.applydate);
			json.issueunitList.forEach(name => newItem.creators.push(cleanAuthor(name)));
			break;
	}
	if (ZU.fieldIsValidForType('DOI', newItem.itemType)) {
		newItem.DOI = json.doi;
	}
	else {
		extra.set('DOI', json.doi, true);
	}
	newItem.url = `https://d.wanfangdata.com.cn/${type}/${id}`;
	extra.set('citation', json.citedcount);
	json.classcodeList && extra.set('CLC', json.classcodeList.join(', '));
	newItem.tags = json.keywordsList;
	if (json.hasfulltext) {
		newItem.attachments.push({
			url: json.fulltextpath,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	newItem.extra = extra.toString();
	newItem.complete();
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
	let match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

function cleanAuthor(creator, creatorType = 'author') {
	creator = ZU.cleanAuthor(creator, creatorType);
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.fieldMode = 1;
	}
	return creator;
}

function patentCountry(idNumber) {
	return {
		AD: '安道尔', AE: '阿拉伯联合酋长国', AF: '阿富汗', AG: '安提瓜和巴布达', AI: '安圭拉', AL: '阿尔巴尼亚', AM: '亚美尼亚', AN: '菏属安的列斯群岛', AO: '安哥拉', AR: '阿根廷', AT: '奥地利', AU: '澳大利亚', AW: '阿鲁巴', AZ: '阿塞拜疆', BB: '巴巴多斯', BD: '孟加拉国', BE: '比利时', BF: '布莱基纳法索', BG: '保加利亚', BH: '巴林', BI: '布隆迪', BJ: '贝宁', BM: '百慕大', BN: '文莱', BO: '玻利维亚', BR: '巴西', BS: '巴哈马', BT: '不丹', BU: '缅甸', BW: '博茨瓦纳', BY: '白俄罗斯', BZ: '伯利兹', CA: '加拿大', CF: '中非共和国', CG: '刚果', CH: '瑞士', CI: '科特迪瓦', CL: '智利', CM: '喀麦隆', CN: '中国', CO: '哥伦比亚', CR: '哥斯达黎加', CS: '捷克斯洛伐克', CU: '古巴', CV: '怫得角', CY: '塞浦路斯',
		DE: '联邦德国', DJ: '吉布提', DK: '丹麦', DM: '多米尼加岛', DO: '多米尼加共和国', DZ: '阿尔及利亚', EC: '厄瓜多尔', EE: '爱沙尼亚', EG: '埃及', EP: '欧洲专利局', ES: '西班牙', ET: '埃塞俄比亚', FI: '芬兰', FJ: '斐济', FK: '马尔维纳斯群岛', FR: '法国',
		GA: '加蓬', GB: '英国', GD: '格林那达', GE: '格鲁吉亚', GH: '加纳', GI: '直布罗陀', GM: '冈比亚', GN: '几内亚', GQ: '赤道几内亚', GR: '希腊', GT: '危地马拉', GW: '几内亚比绍', GY: '圭亚那', HK: '香港', HN: '洪都拉斯', HR: '克罗地亚', HT: '海地', HU: '匈牙利', HV: '上沃尔特', ID: '印度尼西亚', IE: '爱尔兰', IL: '以色列', IN: '印度', IQ: '伊拉克', IR: '伊朗', IS: '冰岛', IT: '意大利',
		JE: '泽西岛', JM: '牙买加', JO: '约旦', JP: '日本', KE: '肯尼亚', KG: '吉尔吉斯', KH: '柬埔寨', KI: '吉尔伯特群岛', KM: '科摩罗', KN: '圣克里斯托夫岛', KP: '朝鲜', KR: '韩国', KW: '科威特', KY: '开曼群岛', KZ: '哈萨克', LA: '老挝', LB: '黎巴嫩', LC: '圣卢西亚岛', LI: '列支敦士登', LK: '斯里兰卡', LR: '利比里亚', LS: '莱索托', LT: '立陶宛', LU: '卢森堡', LV: '拉脱维亚', LY: '利比亚',
		MA: '摩洛哥', MC: '摩纳哥', MD: '莫尔多瓦', MG: '马达加斯加', ML: '马里', MN: '蒙古', MO: '澳门', MR: '毛里塔尼亚', MS: '蒙特塞拉特岛', MT: '马耳他', MU: '毛里求斯', MV: '马尔代夫', MW: '马拉维', MX: '墨西哥', MY: '马来西亚', MZ: '莫桑比克', NA: '纳米比亚', NE: '尼日尔', NG: '尼日利亚', NH: '新赫布里底', NI: '尼加拉瓜', NL: '荷兰', NO: '挪威', NP: '尼泊尔', NR: '瑙鲁', NZ: '新西兰', OA: '非洲知识产权组织', OM: '阿曼',
		PA: '巴拿马', PC: 'PCT', PE: '秘鲁', PG: '巴布亚新几内亚', PH: '菲律宾', PK: '巴基斯坦', PL: '波兰', PT: '葡萄牙', PY: '巴拉圭', QA: '卡塔尔', RO: '罗马尼亚', RU: '俄罗斯联邦', RW: '卢旺达',
		SA: '沙特阿拉伯', SB: '所罗门群岛', SC: '塞舌尔', SD: '苏丹', SE: '瑞典', SG: '新加坡', SH: '圣赫勒拿岛', SI: '斯洛文尼亚', SL: '塞拉利昂', SM: '圣马利诺', SN: '塞内加尔', SO: '索马里', SR: '苏里南', ST: '圣多美和普林西比岛', SU: '苏联', SV: '萨尔瓦多', SY: '叙利亚', SZ: '斯威士兰', TD: '乍得', TG: '多哥', TH: '泰国', TJ: '塔吉克', TM: '土库曼', TN: '突尼斯', TO: '汤加', TR: '土耳其', TT: '特立尼达和多巴哥', TV: '图瓦卢', TZ: '坦桑尼亚', UA: '乌克兰', UG: '乌干达', US: '美国', UY: '乌拉圭', UZ: '乌兹别克',
		VA: '梵蒂冈', VC: '圣文森特岛和格林纳达', VE: '委内瑞拉', VG: '维尔京群岛', VN: '越南', VU: '瓦努阿图', WO: '世界知识产权组织', WS: '萨摩亚', YD: '民主也门', YE: '也门', YU: '南斯拉夫', ZA: '南非', ZM: '赞比亚', ZR: '扎伊尔', ZW: '津巴布韦'
	}[idNumber.substring(0, 2).toUpperCase()] || '';
}

function getUrlParam(url) {
	const urlObj = new URL(url);
	const pathParts = urlObj.pathname.split('/');
	const deURI = decodeURIComponent(pathParts[2]);
	const deBase64 = atob(deURI);
	const encoder = new TextEncoder();
	const buffer = encoder.encode(deBase64);
	// make a cocy to avoid Error: Accessing TypedArray data over Xrays is slow, and forbidden in order to encourage performant code.
	const urlMsg = Url.decode(new Uint8Array(buffer));
	return Url.toObject(urlMsg);
}

/**
 * for visually viewing binary data during debugging
 */
// eslint-disable-next-line no-unused-vars
function bytesToHex(bytes) {
	const hex = [];
	for (let i = 0; i < bytes.length; i++) {
		hex.push((bytes[i] >>> 4).toString(16));
		hex.push((bytes[i] & 0xF).toString(16));
	}
	return hex.join('');
}

/* eslint-disable */

/*!
 * protobuf.js v7.4.0 (c) 2016, daniel wirtz
 * compiled thu, 22 aug 2024 20:30:39 utc
 * licensed under the bsd-3-clause license
 * see: https://github.com/dcodeio/protobuf.js for details
 */
!function(d){"use strict";!function(r,u,t){var n=function t(n){var i=u[n];return i||r[n][0].call(i=u[n]={exports:{}},t,i,i.exports),i.exports}(t[0]);n.util.global.protobuf=n,"function"==typeof define&&define.amd&&define(["long"],function(t){return t&&t.isLong&&(n.util.Long=t,n.configure()),n}),"object"==typeof module&&module&&module.exports&&(module.exports=n)}({1:[function(t,n,i){n.exports=function(t,n){var i=Array(arguments.length-1),e=0,r=2,s=!0;for(;r<arguments.length;)i[e++]=arguments[r++];return new Promise(function(r,u){i[e]=function(t){if(s)if(s=!1,t)u(t);else{for(var n=Array(arguments.length-1),i=0;i<n.length;)n[i++]=arguments[i];r.apply(null,n)}};try{t.apply(n||null,i)}catch(t){s&&(s=!1,u(t))}})}},{}],2:[function(t,n,i){i.length=function(t){var n=t.length;if(!n)return 0;for(var i=0;1<--n%4&&"="==(t[0|n]||"");)++i;return Math.ceil(3*t.length)/4-i};for(var f=Array(64),o=Array(123),r=0;r<64;)o[f[r]=r<26?r+65:r<52?r+71:r<62?r-4:r-59|43]=r++;i.encode=function(t,n,i){for(var r,u=null,e=[],s=0,h=0;n<i;){var o=t[n++];switch(h){case 0:e[s++]=f[o>>2],r=(3&o)<<4,h=1;break;case 1:e[s++]=f[r|o>>4],r=(15&o)<<2,h=2;break;case 2:e[s++]=f[r|o>>6],e[s++]=f[63&o],h=0}8191<s&&((u=u||[]).push(String.fromCharCode.apply(String,e)),s=0)}return h&&(e[s++]=f[r],e[s++]=61,1===h&&(e[s++]=61)),u?(s&&u.push(String.fromCharCode.apply(String,e.slice(0,s))),u.join("")):String.fromCharCode.apply(String,e.slice(0,s))};var c="invalid encoding";i.decode=function(t,n,i){for(var r,u=i,e=0,s=0;s<t.length;){var h=t.charCodeAt(s++);if(61==h&&1<e)break;if((h=o[h])===d)throw Error(c);switch(e){case 0:r=h,e=1;break;case 1:n[i++]=r<<2|(48&h)>>4,r=h,e=2;break;case 2:n[i++]=(15&r)<<4|(60&h)>>2,r=h,e=3;break;case 3:n[i++]=(3&r)<<6|h,e=0}}if(1===e)throw Error(c);return i-u},i.test=function(t){return/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(t)}},{}],3:[function(t,n,i){function r(){this.t={}}(n.exports=r).prototype.on=function(t,n,i){return(this.t[t]||(this.t[t]=[])).push({fn:n,ctx:i||this}),this},r.prototype.off=function(t,n){if(t===d)this.t={};else if(n===d)this.t[t]=[];else for(var i=this.t[t],r=0;r<i.length;)i[r].fn===n?i.splice(r,1):++r;return this},r.prototype.emit=function(t){var n=this.t[t];if(n){for(var i=[],r=1;r<arguments.length;)i.push(arguments[r++]);for(r=0;r<n.length;)n[r].fn.apply(n[r++].ctx,i)}return this}},{}],4:[function(t,n,i){function r(t){function n(t,n,i,r){var u=n<0?1:0;t(0===(n=u?-n:n)?0<1/n?0:2147483648:isNaN(n)?2143289344:34028234663852886e22<n?(u<<31|2139095040)>>>0:n<11754943508222875e-54?(u<<31|Math.round(n/1401298464324817e-60))>>>0:(u<<31|127+(t=Math.floor(Math.log(n)/Math.LN2))<<23|8388607&Math.round(n*Math.pow(2,-t)*8388608))>>>0,i,r)}function i(t,n,i){t=t(n,i),n=2*(t>>31)+1,i=t>>>23&255,t&=8388607;return 255==i?t?NaN:1/0*n:0==i?1401298464324817e-60*n*t:n*Math.pow(2,i-150)*(8388608+t)}function r(t,n,i){h[0]=t,n[i]=o[0],n[i+1]=o[1],n[i+2]=o[2],n[i+3]=o[3]}function u(t,n,i){h[0]=t,n[i]=o[3],n[i+1]=o[2],n[i+2]=o[1],n[i+3]=o[0]}function e(t,n){return o[0]=t[n],o[1]=t[n+1],o[2]=t[n+2],o[3]=t[n+3],h[0]}function s(t,n){return o[3]=t[n],o[2]=t[n+1],o[1]=t[n+2],o[0]=t[n+3],h[0]}var h,o,f,c,a;function l(t,n,i,r,u,e){var s,h=r<0?1:0;0===(r=h?-r:r)?(t(0,u,e+n),t(0<1/r?0:2147483648,u,e+i)):isNaN(r)?(t(0,u,e+n),t(2146959360,u,e+i)):17976931348623157e292<r?(t(0,u,e+n),t((h<<31|2146435072)>>>0,u,e+i)):r<22250738585072014e-324?(t((s=r/5e-324)>>>0,u,e+n),t((h<<31|s/4294967296)>>>0,u,e+i)):(t(4503599627370496*(s=r*Math.pow(2,-(r=1024===(r=Math.floor(Math.log(r)/Math.LN2))?1023:r)))>>>0,u,e+n),t((h<<31|r+1023<<20|1048576*s&1048575)>>>0,u,e+i))}function v(t,n,i,r,u){n=t(r,u+n),t=t(r,u+i),r=2*(t>>31)+1,u=t>>>20&2047,i=4294967296*(1048575&t)+n;return 2047==u?i?NaN:1/0*r:0==u?5e-324*r*i:r*Math.pow(2,u-1075)*(i+4503599627370496)}function w(t,n,i){f[0]=t,n[i]=c[0],n[i+1]=c[1],n[i+2]=c[2],n[i+3]=c[3],n[i+4]=c[4],n[i+5]=c[5],n[i+6]=c[6],n[i+7]=c[7]}function b(t,n,i){f[0]=t,n[i]=c[7],n[i+1]=c[6],n[i+2]=c[5],n[i+3]=c[4],n[i+4]=c[3],n[i+5]=c[2],n[i+6]=c[1],n[i+7]=c[0]}function y(t,n){return c[0]=t[n],c[1]=t[n+1],c[2]=t[n+2],c[3]=t[n+3],c[4]=t[n+4],c[5]=t[n+5],c[6]=t[n+6],c[7]=t[n+7],f[0]}function g(t,n){return c[7]=t[n],c[6]=t[n+1],c[5]=t[n+2],c[4]=t[n+3],c[3]=t[n+4],c[2]=t[n+5],c[1]=t[n+6],c[0]=t[n+7],f[0]}return"undefined"!=typeof Float32Array?(h=new Float32Array([-0]),o=new Uint8Array(h.buffer),a=128===o[3],t.writeFloatLE=a?r:u,t.writeFloatBE=a?u:r,t.readFloatLE=a?e:s,t.readFloatBE=a?s:e):(t.writeFloatLE=n.bind(null,d),t.writeFloatBE=n.bind(null,A),t.readFloatLE=i.bind(null,p),t.readFloatBE=i.bind(null,m)),"undefined"!=typeof Float64Array?(f=new Float64Array([-0]),c=new Uint8Array(f.buffer),a=128===c[7],t.writeDoubleLE=a?w:b,t.writeDoubleBE=a?b:w,t.readDoubleLE=a?y:g,t.readDoubleBE=a?g:y):(t.writeDoubleLE=l.bind(null,d,0,4),t.writeDoubleBE=l.bind(null,A,4,0),t.readDoubleLE=v.bind(null,p,0,4),t.readDoubleBE=v.bind(null,m,4,0)),t}function d(t,n,i){n[i]=255&t,n[i+1]=t>>>8&255,n[i+2]=t>>>16&255,n[i+3]=t>>>24}function A(t,n,i){n[i]=t>>>24,n[i+1]=t>>>16&255,n[i+2]=t>>>8&255,n[i+3]=255&t}function p(t,n){return(t[n]|t[n+1]<<8|t[n+2]<<16|t[n+3]<<24)>>>0}function m(t,n){return(t[n]<<24|t[n+1]<<16|t[n+2]<<8|t[n+3])>>>0}n.exports=r(r)},{}],5:[function(t,n,i){function r(t){try{var n=eval("require")(t);if(n&&(n.length||Object.keys(n).length))return n}catch(t){}return null}n.exports=r},{}],6:[function(t,n,i){n.exports=function(n,i,t){var r=t||8192,u=r>>>1,e=null,s=r;return function(t){if(t<1||u<t)return n(t);r<s+t&&(e=n(r),s=0);t=i.call(e,s,s+=t);return 7&s&&(s=1+(7|s)),t}}},{}],7:[function(t,n,i){i.length=function(t){for(var n,i=0,r=0;r<t.length;++r)(n=t.charCodeAt(r))<128?i+=1:n<2048?i+=2:55296==(64512&n)&&56320==(64512&t.charCodeAt(r+1))?(++r,i+=4):i+=3;return i},i.read=function(t,n,i){if(i-n<1)return"";for(var r,u=null,e=[],s=0;n<i;)(r=t[n++])<128?e[s++]=r:191<r&&r<224?e[s++]=(31&r)<<6|63&t[n++]:239<r&&r<365?(r=((7&r)<<18|(63&t[n++])<<12|(63&t[n++])<<6|63&t[n++])-65536,e[s++]=55296+(r>>10),e[s++]=56320+(1023&r)):e[s++]=(15&r)<<12|(63&t[n++])<<6|63&t[n++],8191<s&&((u=u||[]).push(String.fromCharCode.apply(String,e)),s=0);return u?(s&&u.push(String.fromCharCode.apply(String,e.slice(0,s))),u.join("")):String.fromCharCode.apply(String,e.slice(0,s))},i.write=function(t,n,i){for(var r,u,e=i,s=0;s<t.length;++s)(r=t.charCodeAt(s))<128?n[i++]=r:(r<2048?n[i++]=r>>6|192:(55296==(64512&r)&&56320==(64512&(u=t.charCodeAt(s+1)))?(++s,n[i++]=(r=65536+((1023&r)<<10)+(1023&u))>>18|240,n[i++]=r>>12&63|128):n[i++]=r>>12|224,n[i++]=r>>6&63|128),n[i++]=63&r|128);return i-e}},{}],8:[function(t,n,i){var r=i;function u(){r.util.n(),r.Writer.n(r.BufferWriter),r.Reader.n(r.BufferReader)}r.build="minimal",r.Writer=t(16),r.BufferWriter=t(17),r.Reader=t(9),r.BufferReader=t(10),r.util=t(15),r.rpc=t(12),r.roots=t(11),r.configure=u,u()},{10:10,11:11,12:12,15:15,16:16,17:17,9:9}],9:[function(t,n,i){n.exports=o;var r,u=t(15),e=u.LongBits,s=u.utf8;function h(t,n){return RangeError("index out of range: "+t.pos+" + "+(n||1)+" > "+t.len)}function o(t){this.buf=t,this.pos=0,this.len=t.length}function f(){return u.Buffer?function(t){return(o.create=function(t){return u.Buffer.isBuffer(t)?new r(t):a(t)})(t)}:a}var c,a="undefined"!=typeof Uint8Array?function(t){if(t instanceof Uint8Array||Array.isArray(t))return new o(t);throw Error("illegal buffer")}:function(t){if(Array.isArray(t))return new o(t);throw Error("illegal buffer")};function l(){var t=new e(0,0),n=0;if(!(4<this.len-this.pos)){for(;n<3;++n){if(this.pos>=this.len)throw h(this);if(t.lo=(t.lo|(127&this.buf[this.pos])<<7*n)>>>0,this.buf[this.pos++]<128)return t}return t.lo=(t.lo|(127&this.buf[this.pos++])<<7*n)>>>0,t}for(;n<4;++n)if(t.lo=(t.lo|(127&this.buf[this.pos])<<7*n)>>>0,this.buf[this.pos++]<128)return t;if(t.lo=(t.lo|(127&this.buf[this.pos])<<28)>>>0,t.hi=(t.hi|(127&this.buf[this.pos])>>4)>>>0,this.buf[this.pos++]<128)return t;if(n=0,4<this.len-this.pos){for(;n<5;++n)if(t.hi=(t.hi|(127&this.buf[this.pos])<<7*n+3)>>>0,this.buf[this.pos++]<128)return t}else for(;n<5;++n){if(this.pos>=this.len)throw h(this);if(t.hi=(t.hi|(127&this.buf[this.pos])<<7*n+3)>>>0,this.buf[this.pos++]<128)return t}throw Error("invalid varint encoding")}function v(t,n){return(t[n-4]|t[n-3]<<8|t[n-2]<<16|t[n-1]<<24)>>>0}function w(){if(this.pos+8>this.len)throw h(this,8);return new e(v(this.buf,this.pos+=4),v(this.buf,this.pos+=4))}o.create=f(),o.prototype.i=u.Array.prototype.subarray||u.Array.prototype.slice,o.prototype.uint32=(c=4294967295,function(){if(c=(127&this.buf[this.pos])>>>0,this.buf[this.pos++]<128||(c=(c|(127&this.buf[this.pos])<<7)>>>0,this.buf[this.pos++]<128||(c=(c|(127&this.buf[this.pos])<<14)>>>0,this.buf[this.pos++]<128||(c=(c|(127&this.buf[this.pos])<<21)>>>0,this.buf[this.pos++]<128||(c=(c|(15&this.buf[this.pos])<<28)>>>0,this.buf[this.pos++]<128||!((this.pos+=5)>this.len))))))return c;throw this.pos=this.len,h(this,10)}),o.prototype.int32=function(){return 0|this.uint32()},o.prototype.sint32=function(){var t=this.uint32();return t>>>1^-(1&t)|0},o.prototype.bool=function(){return 0!==this.uint32()},o.prototype.fixed32=function(){if(this.pos+4>this.len)throw h(this,4);return v(this.buf,this.pos+=4)},o.prototype.sfixed32=function(){if(this.pos+4>this.len)throw h(this,4);return 0|v(this.buf,this.pos+=4)},o.prototype.float=function(){if(this.pos+4>this.len)throw h(this,4);var t=u.float.readFloatLE(this.buf,this.pos);return this.pos+=4,t},o.prototype.double=function(){if(this.pos+8>this.len)throw h(this,4);var t=u.float.readDoubleLE(this.buf,this.pos);return this.pos+=8,t},o.prototype.bytes=function(){var t=this.uint32(),n=this.pos,i=this.pos+t;if(i>this.len)throw h(this,t);return this.pos+=t,Array.isArray(this.buf)?this.buf.slice(n,i):n===i?(t=u.Buffer)?t.alloc(0):new this.buf.constructor(0):this.i.call(this.buf,n,i)},o.prototype.string=function(){var t=this.bytes();return s.read(t,0,t.length)},o.prototype.skip=function(t){if("number"==typeof t){if(this.pos+t>this.len)throw h(this,t);this.pos+=t}else do{if(this.pos>=this.len)throw h(this)}while(128&this.buf[this.pos++]);return this},o.prototype.skipType=function(t){switch(t){case 0:this.skip();break;case 1:this.skip(8);break;case 2:this.skip(this.uint32());break;case 3:for(;4!=(t=7&this.uint32());)this.skipType(t);break;case 5:this.skip(4);break;default:throw Error("invalid wire type "+t+" at offset "+this.pos)}return this},o.n=function(t){r=t,o.create=f(),r.n();var n=u.Long?"toLong":"toNumber";u.merge(o.prototype,{int64:function(){return l.call(this)[n](!1)},uint64:function(){return l.call(this)[n](!0)},sint64:function(){return l.call(this).zzDecode()[n](!1)},fixed64:function(){return w.call(this)[n](!0)},sfixed64:function(){return w.call(this)[n](!1)}})}},{15:15}],10:[function(t,n,i){n.exports=e;var r=t(9),u=((e.prototype=Object.create(r.prototype)).constructor=e,t(15));function e(t){r.call(this,t)}e.n=function(){u.Buffer&&(e.prototype.i=u.Buffer.prototype.slice)},e.prototype.string=function(){var t=this.uint32();return this.buf.utf8Slice?this.buf.utf8Slice(this.pos,this.pos=Math.min(this.pos+t,this.len)):this.buf.toString("utf-8",this.pos,this.pos=Math.min(this.pos+t,this.len))},e.n()},{15:15,9:9}],11:[function(t,n,i){n.exports={}},{}],12:[function(t,n,i){i.Service=t(13)},{13:13}],13:[function(t,n,i){n.exports=r;var h=t(15);function r(t,n,i){if("function"!=typeof t)throw TypeError("rpcImpl must be a function");h.EventEmitter.call(this),this.rpcImpl=t,this.requestDelimited=!!n,this.responseDelimited=!!i}((r.prototype=Object.create(h.EventEmitter.prototype)).constructor=r).prototype.rpcCall=function t(i,n,r,u,e){if(!u)throw TypeError("request must be specified");var s=this;if(!e)return h.asPromise(t,s,i,n,r,u);if(!s.rpcImpl)return setTimeout(function(){e(Error("already ended"))},0),d;try{return s.rpcImpl(i,n[s.requestDelimited?"encodeDelimited":"encode"](u).finish(),function(t,n){if(t)return s.emit("error",t,i),e(t);if(null===n)return s.end(!0),d;if(!(n instanceof r))try{n=r[s.responseDelimited?"decodeDelimited":"decode"](n)}catch(t){return s.emit("error",t,i),e(t)}return s.emit("data",n,i),e(null,n)})}catch(t){return s.emit("error",t,i),setTimeout(function(){e(t)},0),d}},r.prototype.end=function(t){return this.rpcImpl&&(t||this.rpcImpl(null,null,null),this.rpcImpl=null,this.emit("end").off()),this}},{15:15}],14:[function(t,n,i){n.exports=u;var r=t(15);function u(t,n){this.lo=t>>>0,this.hi=n>>>0}var e=u.zero=new u(0,0),s=(e.toNumber=function(){return 0},e.zzEncode=e.zzDecode=function(){return this},e.length=function(){return 1},u.zeroHash="\0\0\0\0\0\0\0\0",u.fromNumber=function(t){var n,i;return 0===t?e:(i=(t=(n=t<0)?-t:t)>>>0,t=(t-i)/4294967296>>>0,n&&(t=~t>>>0,i=~i>>>0,4294967295<++i&&(i=0,4294967295<++t&&(t=0))),new u(i,t))},u.from=function(t){if("number"==typeof t)return u.fromNumber(t);if(r.isString(t)){if(!r.Long)return u.fromNumber(parseInt(t,10));t=r.Long.fromString(t)}return t.low||t.high?new u(t.low>>>0,t.high>>>0):e},u.prototype.toNumber=function(t){var n;return!t&&this.hi>>>31?(t=1+~this.lo>>>0,n=~this.hi>>>0,-(t+4294967296*(n=t?n:n+1>>>0))):this.lo+4294967296*this.hi},u.prototype.toLong=function(t){return r.Long?new r.Long(0|this.lo,0|this.hi,!!t):{low:0|this.lo,high:0|this.hi,unsigned:!!t}},String.prototype.charCodeAt);u.fromHash=function(t){return"\0\0\0\0\0\0\0\0"===t?e:new u((s.call(t,0)|s.call(t,1)<<8|s.call(t,2)<<16|s.call(t,3)<<24)>>>0,(s.call(t,4)|s.call(t,5)<<8|s.call(t,6)<<16|s.call(t,7)<<24)>>>0)},u.prototype.toHash=function(){return String.fromCharCode(255&this.lo,this.lo>>>8&255,this.lo>>>16&255,this.lo>>>24,255&this.hi,this.hi>>>8&255,this.hi>>>16&255,this.hi>>>24)},u.prototype.zzEncode=function(){var t=this.hi>>31;return this.hi=((this.hi<<1|this.lo>>>31)^t)>>>0,this.lo=(this.lo<<1^t)>>>0,this},u.prototype.zzDecode=function(){var t=-(1&this.lo);return this.lo=((this.lo>>>1|this.hi<<31)^t)>>>0,this.hi=(this.hi>>>1^t)>>>0,this},u.prototype.length=function(){var t=this.lo,n=(this.lo>>>28|this.hi<<4)>>>0,i=this.hi>>>24;return 0==i?0==n?t<16384?t<128?1:2:t<2097152?3:4:n<16384?n<128?5:6:n<2097152?7:8:i<128?9:10}},{15:15}],15:[function(t,n,i){var r=i;function u(t,n,i){for(var r=Object.keys(n),u=0;u<r.length;++u)t[r[u]]!==d&&i||(t[r[u]]=n[r[u]]);return t}function e(t){function i(t,n){if(!(this instanceof i))return new i(t,n);Object.defineProperty(this,"message",{get:function(){return t}}),Error.captureStackTrace?Error.captureStackTrace(this,i):Object.defineProperty(this,"stack",{value:Error().stack||""}),n&&u(this,n)}return i.prototype=Object.create(Error.prototype,{constructor:{value:i,writable:!0,enumerable:!1,configurable:!0},name:{get:function(){return t},set:d,enumerable:!1,configurable:!0},toString:{value:function(){return this.name+": "+this.message},writable:!0,enumerable:!1,configurable:!0}}),i}r.asPromise=t(1),r.base64=t(2),r.EventEmitter=t(3),r.float=t(4),r.inquire=t(5),r.utf8=t(7),r.pool=t(6),r.LongBits=t(14),r.isNode=!!("undefined"!=typeof global&&global&&global.process&&global.process.versions&&global.process.versions.node),r.global=r.isNode&&global||"undefined"!=typeof window&&window||"undefined"!=typeof self&&self||this,r.emptyArray=Object.freeze?Object.freeze([]):[],r.emptyObject=Object.freeze?Object.freeze({}):{},r.isInteger=Number.isInteger||function(t){return"number"==typeof t&&isFinite(t)&&Math.floor(t)===t},r.isString=function(t){return"string"==typeof t||t instanceof String},r.isObject=function(t){return t&&"object"==typeof t},r.isset=r.isSet=function(t,n){var i=t[n];return null!=i&&t.hasOwnProperty(n)&&("object"!=typeof i||0<(Array.isArray(i)?i:Object.keys(i)).length)},r.Buffer=function(){try{var t=r.inquire("buffer").Buffer;return t.prototype.utf8Write?t:null}catch(t){return null}}(),r.r=null,r.u=null,r.newBuffer=function(t){return"number"==typeof t?r.Buffer?r.u(t):new r.Array(t):r.Buffer?r.r(t):"undefined"==typeof Uint8Array?t:new Uint8Array(t)},r.Array="undefined"!=typeof Uint8Array?Uint8Array:Array,r.Long=r.global.dcodeIO&&r.global.dcodeIO.Long||r.global.Long||r.inquire("long"),r.key2Re=/^true|false|0|1$/,r.key32Re=/^-?(?:0|[1-9][0-9]*)$/,r.key64Re=/^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/,r.longToHash=function(t){return t?r.LongBits.from(t).toHash():r.LongBits.zeroHash},r.longFromHash=function(t,n){t=r.LongBits.fromHash(t);return r.Long?r.Long.fromBits(t.lo,t.hi,n):t.toNumber(!!n)},r.merge=u,r.lcFirst=function(t){return(t[0]||"").toLowerCase()+t.substring(1)},r.newError=e,r.ProtocolError=e("ProtocolError"),r.oneOfGetter=function(t){for(var i={},n=0;n<t.length;++n)i[t[n]]=1;return function(){for(var t=Object.keys(this),n=t.length-1;-1<n;--n)if(1===i[t[n]]&&this[t[n]]!==d&&null!==this[t[n]])return t[n]}},r.oneOfSetter=function(i){return function(t){for(var n=0;n<i.length;++n)i[n]!==t&&delete this[i[n]]}},r.toJSONOptions={longs:String,enums:String,bytes:String,json:!0},r.n=function(){var i=r.Buffer;i?(r.r=i.from!==Uint8Array.from&&i.from||function(t,n){return new i(t,n)},r.u=i.allocUnsafe||function(t){return new i(t)}):r.r=r.u=null}},{1:1,14:14,2:2,3:3,4:4,5:5,6:6,7:7}],16:[function(t,n,i){n.exports=a;var r,u=t(15),e=u.LongBits,s=u.base64,h=u.utf8;function o(t,n,i){this.fn=t,this.len=n,this.next=d,this.val=i}function f(){}function c(t){this.head=t.head,this.tail=t.tail,this.len=t.len,this.next=t.states}function a(){this.len=0,this.head=new o(f,0,0),this.tail=this.head,this.states=null}function l(){return u.Buffer?function(){return(a.create=function(){return new r})()}:function(){return new a}}function v(t,n,i){n[i]=255&t}function w(t,n){this.len=t,this.next=d,this.val=n}function b(t,n,i){for(;t.hi;)n[i++]=127&t.lo|128,t.lo=(t.lo>>>7|t.hi<<25)>>>0,t.hi>>>=7;for(;127<t.lo;)n[i++]=127&t.lo|128,t.lo=t.lo>>>7;n[i++]=t.lo}function y(t,n,i){n[i]=255&t,n[i+1]=t>>>8&255,n[i+2]=t>>>16&255,n[i+3]=t>>>24}a.create=l(),a.alloc=function(t){return new u.Array(t)},u.Array!==Array&&(a.alloc=u.pool(a.alloc,u.Array.prototype.subarray)),a.prototype.e=function(t,n,i){return this.tail=this.tail.next=new o(t,n,i),this.len+=n,this},(w.prototype=Object.create(o.prototype)).fn=function(t,n,i){for(;127<t;)n[i++]=127&t|128,t>>>=7;n[i]=t},a.prototype.uint32=function(t){return this.len+=(this.tail=this.tail.next=new w((t>>>=0)<128?1:t<16384?2:t<2097152?3:t<268435456?4:5,t)).len,this},a.prototype.int32=function(t){return t<0?this.e(b,10,e.fromNumber(t)):this.uint32(t)},a.prototype.sint32=function(t){return this.uint32((t<<1^t>>31)>>>0)},a.prototype.int64=a.prototype.uint64=function(t){t=e.from(t);return this.e(b,t.length(),t)},a.prototype.sint64=function(t){t=e.from(t).zzEncode();return this.e(b,t.length(),t)},a.prototype.bool=function(t){return this.e(v,1,t?1:0)},a.prototype.sfixed32=a.prototype.fixed32=function(t){return this.e(y,4,t>>>0)},a.prototype.sfixed64=a.prototype.fixed64=function(t){t=e.from(t);return this.e(y,4,t.lo).e(y,4,t.hi)},a.prototype.float=function(t){return this.e(u.float.writeFloatLE,4,t)},a.prototype.double=function(t){return this.e(u.float.writeDoubleLE,8,t)};var g=u.Array.prototype.set?function(t,n,i){n.set(t,i)}:function(t,n,i){for(var r=0;r<t.length;++r)n[i+r]=t[r]};a.prototype.bytes=function(t){var n,i=t.length>>>0;return i?(u.isString(t)&&(n=a.alloc(i=s.length(t)),s.decode(t,n,0),t=n),this.uint32(i).e(g,i,t)):this.e(v,1,0)},a.prototype.string=function(t){var n=h.length(t);return n?this.uint32(n).e(h.write,n,t):this.e(v,1,0)},a.prototype.fork=function(){return this.states=new c(this),this.head=this.tail=new o(f,0,0),this.len=0,this},a.prototype.reset=function(){return this.states?(this.head=this.states.head,this.tail=this.states.tail,this.len=this.states.len,this.states=this.states.next):(this.head=this.tail=new o(f,0,0),this.len=0),this},a.prototype.ldelim=function(){var t=this.head,n=this.tail,i=this.len;return this.reset().uint32(i),i&&(this.tail.next=t.next,this.tail=n,this.len+=i),this},a.prototype.finish=function(){for(var t=this.head.next,n=this.constructor.alloc(this.len),i=0;t;)t.fn(t.val,n,i),i+=t.len,t=t.next;return n},a.n=function(t){r=t,a.create=l(),r.n()}},{15:15}],17:[function(t,n,i){n.exports=e;var r=t(16),u=((e.prototype=Object.create(r.prototype)).constructor=e,t(15));function e(){r.call(this)}function s(t,n,i){t.length<40?u.utf8.write(t,n,i):n.utf8Write?n.utf8Write(t,i):n.write(t,i)}e.n=function(){e.alloc=u.u,e.writeBytesBuffer=u.Buffer&&u.Buffer.prototype instanceof Uint8Array&&"set"===u.Buffer.prototype.set.name?function(t,n,i){n.set(t,i)}:function(t,n,i){if(t.copy)t.copy(n,i,0,t.length);else for(var r=0;r<t.length;)n[i++]=t[r++]}},e.prototype.bytes=function(t){var n=(t=u.isString(t)?u.r(t,"base64"):t).length>>>0;return this.uint32(n),n&&this.e(e.writeBytesBuffer,n,t),this},e.prototype.string=function(t){var n=u.Buffer.byteLength(t);return this.uint32(n),n&&this.e(s,n,t),this},e.n()},{15:15,16:16}]},{},[8])}();
//# sourceMappingURL=protobuf.min.js.map

// Common aliases
const $Reader = protobuf.Reader, $util = protobuf.util, $Writer = protobuf.Writer;
const $root = protobuf.roots.default || (protobuf.roots.default = {});

/* below codes are generated by protobuf-cli */
const DetailInfoRequest = $root.DetailInfoRequest = (() => {

	function DetailInfoRequest(properties) {
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}

	DetailInfoRequest.prototype.resourcetype = "";
	DetailInfoRequest.prototype.id = "";
	DetailInfoRequest.prototype.referer = "";
	DetailInfoRequest.prototype.md5id = "";
	DetailInfoRequest.prototype.transaction = "";
	DetailInfoRequest.prototype.isFetchAccountField = false;

	DetailInfoRequest.create = function create(properties) {
		return new DetailInfoRequest(properties);
	};

	DetailInfoRequest.encode = function encode(message, writer) {
		if (!writer)
			writer = $Writer.create();
		if (message.resourcetype != null && Object.hasOwnProperty.call(message, "resourcetype"))
			writer.uint32(10).string(message.resourcetype);
		if (message.id != null && Object.hasOwnProperty.call(message, "id"))
			writer.uint32(18).string(message.id);
		if (message.referer != null && Object.hasOwnProperty.call(message, "referer"))
			writer.uint32(26).string(message.referer);
		if (message.md5id != null && Object.hasOwnProperty.call(message, "md5id"))
			writer.uint32(34).string(message.md5id);
		if (message.transaction != null && Object.hasOwnProperty.call(message, "transaction"))
			writer.uint32(42).string(message.transaction);
		if (message.isFetchAccountField != null && Object.hasOwnProperty.call(message, "isFetchAccountField"))
			writer.uint32(48).bool(message.isFetchAccountField);
		return writer;
	};

	return DetailInfoRequest;
})();
const DetailResponse = $root.DetailResponse = (() => {
	function DetailResponse(properties) {
		this.detail = [];
		this.extradataMap = {};
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}
	DetailResponse.prototype.detail = $util.emptyArray;
	DetailResponse.prototype.extradataMap = $util.emptyObject;
	DetailResponse.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.DetailResponse(), key, value;
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1:
				if (!(message.detail && message.detail.length))
					message.detail = [];
				message.detail.push($root.Resource.decode(reader, reader.uint32()));
				break;
			case 2:
				if (message.extradataMap === $util.emptyObject)
					message.extradataMap = {};
				let end2 = reader.uint32() + reader.pos;
				key = '';
				value = '';
				while (reader.pos < end2) {
					let tag2 = reader.uint32();
					switch (tag2 >>> 3) {
					case 1:
						key = reader.string();
						break;
					case 2:
						value = reader.string();
						break;
					default:
						reader.skipType(tag2 & 7);
						break;
					}
				}
				message.extradataMap[key] = value;
				break;
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};
	DetailResponse.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.arrays || options.defaults)
			object.detail = [];
		if (options.objects || options.defaults)
			object.extradataMap = {};
		if (message.detail && message.detail.length) {
			object.detail = [];
			for (let j = 0; j < message.detail.length; ++j)
				object.detail[j] = $root.Resource.toObject(message.detail[j], options);
		}
		let keys2;
		if (message.extradataMap && (keys2 = Object.keys(message.extradataMap)).length) {
			object.extradataMap = {};
			for (let j = 0; j < keys2.length; ++j)
				object.extradataMap[keys2[j]] = message.extradataMap[keys2[j]];
		}
		return object;
	};
	return DetailResponse;
})();
const Resource = $root.Resource = (() => {
	function Resource(properties) {
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}
	Resource.prototype.periodical = null;
	Resource.prototype.thesis = null;
	Resource.prototype.patent = null;
	Resource.prototype.conference = null;
	Resource.prototype.standard = null;
	Resource.prototype.nstr = null;
	Resource.prototype.cstadt = null;
	Resource.prototype.claw = null;
	Resource.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Resource();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 103:
				message.periodical = $root.Periodical.decode(reader, reader.uint32());
				break;
			case 104:
				message.thesis = $root.Thesis.decode(reader, reader.uint32());
				break;
			case 105:
				message.patent = $root.Patent.decode(reader, reader.uint32());
				break;
			case 109:
				message.conference = $root.Conference.decode(reader, reader.uint32());
				break;
			case 110:
				message.standard = $root.Standard.decode(reader, reader.uint32());
				break;
			case 111:
				message.nstr = $root.Nstr.decode(reader, reader.uint32());
				break;
			case 112:
				message.cstadt = $root.Cstad.decode(reader, reader.uint32());
				break;
			case 113:
				message.claw = $root.Claw.decode(reader, reader.uint32());
				break;
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};
	Resource.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.defaults) {
			object.periodical = null;
			object.thesis = null;
			object.patent = null;
			object.conference = null;
			object.standard = null;
			object.nstr = null;
			object.cstadt = null;
			object.claw = null;
		}
		if (message.periodical != null && message.hasOwnProperty('periodical'))
			object.periodical = $root.Periodical.toObject(message.periodical, options);
		if (message.thesis != null && message.hasOwnProperty('thesis'))
			object.thesis = $root.Thesis.toObject(message.thesis, options);
		if (message.patent != null && message.hasOwnProperty('patent'))
			object.patent = $root.Patent.toObject(message.patent, options);
		if (message.conference != null && message.hasOwnProperty('conference'))
			object.conference = $root.Conference.toObject(message.conference, options);
		if (message.standard != null && message.hasOwnProperty('standard'))
			object.standard = $root.Standard.toObject(message.standard, options);
		if (message.nstr != null && message.hasOwnProperty('nstr'))
			object.nstr = $root.Nstr.toObject(message.nstr, options);
		if (message.cstadt != null && message.hasOwnProperty('cstadt'))
			object.cstadt = $root.Cstad.toObject(message.cstadt, options);
		if (message.claw != null && message.hasOwnProperty('claw'))
			object.claw = $root.Claw.toObject(message.claw, options);
		return object;
	};
	return Resource;
})();

const ExportRequest = $root.ExportRequest = (() => {

	function ExportRequest(properties) {
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}

	ExportRequest.prototype.hiddenid = "";

	ExportRequest.create = function create(properties) {
		return new ExportRequest(properties);
	};

	ExportRequest.encode = function encode(message, writer) {
		if (!writer)
			writer = $Writer.create();
		if (message.hiddenid != null && Object.hasOwnProperty.call(message, "hiddenid"))
			writer.uint32(10).string(message.hiddenid);
		return writer;
	};

	return ExportRequest;
})();
const ExportResponse = $root.ExportResponse = (() => {

	function ExportResponse(properties) {
		this.resourceList = [];
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}

	ExportResponse.prototype.resourceList = $util.emptyArray;

	ExportResponse.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.ExportResponse();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1: {
					if (!(message.resourceList && message.resourceList.length))
						message.resourceList = [];
					message.resourceList.push($root.ExportResource.decode(reader, reader.uint32()));
					break;
				}
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};

	ExportResponse.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.arrays || options.defaults)
			object.resourceList = [];
		if (message.resourceList && message.resourceList.length) {
			object.resourceList = [];
			for (let j = 0; j < message.resourceList.length; ++j)
				object.resourceList[j] = $root.ExportResource.toObject(message.resourceList[j], options);
		}
		return object;
	};
	return ExportResponse;
})();
const ExportResource = $root.ExportResource = (() => {

	function ExportResource(properties) {
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}

	ExportResource.prototype.type = "";
	ExportResource.prototype.uid = "";
	ExportResource.prototype.periodical = null;
	ExportResource.prototype.thesis = null;
	ExportResource.prototype.conference = null;
	ExportResource.prototype.patent = null;
	ExportResource.prototype.standard = null;
	ExportResource.prototype.nstr = null;
	ExportResource.prototype.cstad = null;

	ExportResource.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.ExportResource();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1: {
					message.type = reader.string();
					break;
				}
			case 3: {
					message.uid = reader.string();
					break;
				}
			case 101: {
					message.periodical = $root.Periodical.decode(reader, reader.uint32());
					break;
				}
			case 102: {
					message.thesis = $root.Thesis.decode(reader, reader.uint32());
					break;
				}
			case 104: {
					message.conference = $root.Conference.decode(reader, reader.uint32());
					break;
				}
			case 119: {
					message.patent = $root.Patent.decode(reader, reader.uint32());
					break;
				}
			case 120: {
					message.standard = $root.Standard.decode(reader, reader.uint32());
					break;
				}
			case 121: {
					message.nstr = $root.Nstr.decode(reader, reader.uint32());
					break;
				}
			case 122: {
					message.cstad = $root.Cstad.decode(reader, reader.uint32());
					break;
				}
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};

	ExportResource.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.defaults) {
			object.type = "";
			object.uid = "";
			object.periodical = null;
			object.thesis = null;
			object.conference = null;
			object.patent = null;
			object.standard = null;
			object.nstr = null;
			object.cstad = null;
		}
		if (message.type != null && message.hasOwnProperty("type"))
			object.type = message.type;
		if (message.uid != null && message.hasOwnProperty("uid"))
			object.uid = message.uid;
		if (message.periodical != null && message.hasOwnProperty("periodical"))
			object.periodical = $root.Periodical.toObject(message.periodical, options);
		if (message.thesis != null && message.hasOwnProperty("thesis"))
			object.thesis = $root.Thesis.toObject(message.thesis, options);
		if (message.conference != null && message.hasOwnProperty("conference"))
			object.conference = $root.Conference.toObject(message.conference, options);
		if (message.patent != null && message.hasOwnProperty("patent"))
			object.patent = $root.Patent.toObject(message.patent, options);
		if (message.standard != null && message.hasOwnProperty("standard"))
			object.standard = $root.Standard.toObject(message.standard, options);
		if (message.nstr != null && message.hasOwnProperty("nstr"))
			object.nstr = $root.Nstr.toObject(message.nstr, options);
		if (message.cstad != null && message.hasOwnProperty("cstad"))
			object.cstad = $root.Cstad.toObject(message.cstad, options);
		return object;
	};

	return ExportResource;
})();

const Periodical = $root.Periodical = (() => {
	function Periodical(properties) {
		this.titleList = [];
		this.creatorList = [];
		this.foreigncreatorList = [];
		this.organizationnormList = [];
		this.originalorganizationList = [];
		this.originalclasscodeList = [];
		this.keywordsList = [];
		this.abstractList = [];
		this.periodicaltitleList = [];
		this.fundList = [];
		this.coreperiodicalList = [];
		this.leadtitleList = [];
		this.subtitleList = [];
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}
	Periodical.prototype.id = '';
	Periodical.prototype.titleList = $util.emptyArray;
	Periodical.prototype.creatorList = $util.emptyArray;
	Periodical.prototype.foreigncreatorList = $util.emptyArray;
	Periodical.prototype.organizationnormList = $util.emptyArray;
	Periodical.prototype.originalorganizationList = $util.emptyArray;
	Periodical.prototype.originalclasscodeList = $util.emptyArray;
	Periodical.prototype.keywordsList = $util.emptyArray;
	Periodical.prototype.abstractList = $util.emptyArray;
	Periodical.prototype.citedcount = 0;
	Periodical.prototype.periodicaltitleList = $util.emptyArray;
	Periodical.prototype.fundList = $util.emptyArray;
	Periodical.prototype.publishdate = '';
	Periodical.prototype.metadataonlinedate = '';
	Periodical.prototype.hasfulltext = false;
	Periodical.prototype.issue = '';
	Periodical.prototype.volum = '';
	Periodical.prototype.page = '';
	Periodical.prototype.coreperiodicalList = $util.emptyArray;
	Periodical.prototype.fulltextpath = '';
	Periodical.prototype.doi = '';
	Periodical.prototype.language = '';
	Periodical.prototype.issn = '';
	Periodical.prototype.metadataviewcount = 0;
	Periodical.prototype.downloadcount = 0;
	Periodical.prototype.prepublishversion = '';
	Periodical.prototype.publishstatus = '';
	Periodical.prototype.type = '';
	Periodical.prototype.leadtitleList = $util.emptyArray;
	Periodical.prototype.subtitleList = $util.emptyArray;
	Periodical.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Periodical();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1:
				message.id = reader.string();
				break;
			case 2:
				if (!(message.titleList && message.titleList.length))
					message.titleList = [];
				message.titleList.push(reader.string());
				break;
			case 3:
				if (!(message.creatorList && message.creatorList.length))
					message.creatorList = [];
				message.creatorList.push(reader.string());
				break;
			case 6:
				if (!(message.foreigncreatorList && message.foreigncreatorList.length))
					message.foreigncreatorList = [];
				message.foreigncreatorList.push(reader.string());
				break;
			case 8:
				if (!(message.organizationnormList && message.organizationnormList.length))
					message.organizationnormList = [];
				message.organizationnormList.push(reader.string());
				break;
			case 10:
				if (!(message.originalorganizationList && message.originalorganizationList.length))
					message.originalorganizationList = [];
				message.originalorganizationList.push(reader.string());
				break;
			case 12:
				if (!(message.originalclasscodeList && message.originalclasscodeList.length))
					message.originalclasscodeList = [];
				message.originalclasscodeList.push(reader.string());
				break;
			case 16:
				if (!(message.keywordsList && message.keywordsList.length))
					message.keywordsList = [];
				message.keywordsList.push(reader.string());
				break;
			case 20:
				if (!(message.abstractList && message.abstractList.length))
					message.abstractList = [];
				message.abstractList.push(reader.string());
				break;
			case 21:
				message.citedcount = reader.int32();
				break;
			case 24:
				if (!(message.periodicaltitleList && message.periodicaltitleList.length))
					message.periodicaltitleList = [];
				message.periodicaltitleList.push(reader.string());
				break;
			case 27:
				if (!(message.fundList && message.fundList.length))
					message.fundList = [];
				message.fundList.push(reader.string());
				break;
			case 28:
				message.publishdate = reader.string();
				break;
			case 29:
				message.metadataonlinedate = reader.string();
				break;
			case 32:
				message.hasfulltext = reader.bool();
				break;
			case 34:
				message.issue = reader.string();
				break;
			case 35:
				message.volum = reader.string();
				break;
			case 36:
				message.page = reader.string();
				break;
			case 39:
				if (!(message.coreperiodicalList && message.coreperiodicalList.length))
					message.coreperiodicalList = [];
				message.coreperiodicalList.push(reader.string());
				break;
			case 40:
				message.fulltextpath = reader.string();
				break;
			case 41:
				message.doi = reader.string();
				break;
			case 44:
				message.language = reader.string();
				break;
			case 45:
				message.issn = reader.string();
				break;
			case 48:
				message.metadataviewcount = reader.int32();
				break;
			case 50:
				message.downloadcount = reader.int32();
				break;
			case 51:
				message.prepublishversion = reader.string();
				break;
			case 53:
				message.publishstatus = reader.string();
				break;
			case 54:
				message.type = reader.string();
				break;
			case 76:
				if (!(message.leadtitleList && message.leadtitleList.length))
					message.leadtitleList = [];
				message.leadtitleList.push(reader.string());
				break;
			case 77:
				if (!(message.subtitleList && message.subtitleList.length))
					message.subtitleList = [];
				message.subtitleList.push(reader.string());
				break;
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};
	Periodical.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.arrays || options.defaults) {
			object.titleList = [];
			object.creatorList = [];
			object.foreigncreatorList = [];
			object.organizationnormList = [];
			object.originalorganizationList = [];
			object.originalclasscodeList = [];
			object.keywordsList = [];
			object.abstractList = [];
			object.periodicaltitleList = [];
			object.fundList = [];
			object.coreperiodicalList = [];
			object.leadtitleList = [];
			object.subtitleList = [];
		}
		if (options.defaults) {
			object.id = '';
			object.citedcount = 0;
			object.publishdate = '';
			object.metadataonlinedate = '';
			object.hasfulltext = false;
			object.issue = '';
			object.volum = '';
			object.page = '';
			object.fulltextpath = '';
			object.doi = '';
			object.language = '';
			object.issn = '';
			object.metadataviewcount = 0;
			object.downloadcount = 0;
			object.prepublishversion = '';
			object.publishstatus = '';
			object.type = '';
		}
		if (message.id != null && message.hasOwnProperty('id'))
			object.id = message.id;
		if (message.titleList && message.titleList.length) {
			object.titleList = [];
			for (let j = 0; j < message.titleList.length; ++j)
				object.titleList[j] = message.titleList[j];
		}
		if (message.creatorList && message.creatorList.length) {
			object.creatorList = [];
			for (let j = 0; j < message.creatorList.length; ++j)
				object.creatorList[j] = message.creatorList[j];
		}
		if (message.foreigncreatorList && message.foreigncreatorList.length) {
			object.foreigncreatorList = [];
			for (let j = 0; j < message.foreigncreatorList.length; ++j)
				object.foreigncreatorList[j] = message.foreigncreatorList[j];
		}
		if (message.organizationnormList && message.organizationnormList.length) {
			object.organizationnormList = [];
			for (let j = 0; j < message.organizationnormList.length; ++j)
				object.organizationnormList[j] = message.organizationnormList[j];
		}
		if (message.originalorganizationList && message.originalorganizationList.length) {
			object.originalorganizationList = [];
			for (let j = 0; j < message.originalorganizationList.length; ++j)
				object.originalorganizationList[j] = message.originalorganizationList[j];
		}
		if (message.originalclasscodeList && message.originalclasscodeList.length) {
			object.originalclasscodeList = [];
			for (let j = 0; j < message.originalclasscodeList.length; ++j)
				object.originalclasscodeList[j] = message.originalclasscodeList[j];
		}
		if (message.keywordsList && message.keywordsList.length) {
			object.keywordsList = [];
			for (let j = 0; j < message.keywordsList.length; ++j)
				object.keywordsList[j] = message.keywordsList[j];
		}
		if (message.abstractList && message.abstractList.length) {
			object.abstractList = [];
			for (let j = 0; j < message.abstractList.length; ++j)
				object.abstractList[j] = message.abstractList[j];
		}
		if (message.citedcount != null && message.hasOwnProperty('citedcount'))
			object.citedcount = message.citedcount;
		if (message.periodicaltitleList && message.periodicaltitleList.length) {
			object.periodicaltitleList = [];
			for (let j = 0; j < message.periodicaltitleList.length; ++j)
				object.periodicaltitleList[j] = message.periodicaltitleList[j];
		}
		if (message.fundList && message.fundList.length) {
			object.fundList = [];
			for (let j = 0; j < message.fundList.length; ++j)
				object.fundList[j] = message.fundList[j];
		}
		if (message.publishdate != null && message.hasOwnProperty('publishdate'))
			object.publishdate = message.publishdate;
		if (message.metadataonlinedate != null && message.hasOwnProperty('metadataonlinedate'))
			object.metadataonlinedate = message.metadataonlinedate;
		if (message.hasfulltext != null && message.hasOwnProperty('hasfulltext'))
			object.hasfulltext = message.hasfulltext;
		if (message.issue != null && message.hasOwnProperty('issue'))
			object.issue = message.issue;
		if (message.volum != null && message.hasOwnProperty('volum'))
			object.volum = message.volum;
		if (message.page != null && message.hasOwnProperty('page'))
			object.page = message.page;
		if (message.coreperiodicalList && message.coreperiodicalList.length) {
			object.coreperiodicalList = [];
			for (let j = 0; j < message.coreperiodicalList.length; ++j)
				object.coreperiodicalList[j] = message.coreperiodicalList[j];
		}
		if (message.fulltextpath != null && message.hasOwnProperty('fulltextpath'))
			object.fulltextpath = message.fulltextpath;
		if (message.doi != null && message.hasOwnProperty('doi'))
			object.doi = message.doi;
		if (message.language != null && message.hasOwnProperty('language'))
			object.language = message.language;
		if (message.issn != null && message.hasOwnProperty('issn'))
			object.issn = message.issn;
		if (message.metadataviewcount != null && message.hasOwnProperty('metadataviewcount'))
			object.metadataviewcount = message.metadataviewcount;
		if (message.downloadcount != null && message.hasOwnProperty('downloadcount'))
			object.downloadcount = message.downloadcount;
		if (message.prepublishversion != null && message.hasOwnProperty('prepublishversion'))
			object.prepublishversion = message.prepublishversion;
		if (message.publishstatus != null && message.hasOwnProperty('publishstatus'))
			object.publishstatus = message.publishstatus;
		if (message.type != null && message.hasOwnProperty('type'))
			object.type = message.type;
		if (message.leadtitleList && message.leadtitleList.length) {
			object.leadtitleList = [];
			for (let j = 0; j < message.leadtitleList.length; ++j)
				object.leadtitleList[j] = message.leadtitleList[j];
		}
		if (message.subtitleList && message.subtitleList.length) {
			object.subtitleList = [];
			for (let j = 0; j < message.subtitleList.length; ++j)
				object.subtitleList[j] = message.subtitleList[j];
		}
		return object;
	};
	return Periodical;
})();
const Thesis = $root.Thesis = (() => {
	function Thesis(properties) {
		this.titleList = [];
		this.creatorList = [];
		this.creatorforsearchList = [];
		this.organizationnewList = [];
		this.originalorganizationList = [];
		this.classcodeList = [];
		this.keywordsList = [];
		this.abstractList = [];
		this.tutorList = [];
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}
	Thesis.prototype.id = '';
	Thesis.prototype.type = '';
	Thesis.prototype.titleList = $util.emptyArray;
	Thesis.prototype.creatorList = $util.emptyArray;
	Thesis.prototype.creatorforsearchList = $util.emptyArray;
	Thesis.prototype.organizationnewList = $util.emptyArray;
	Thesis.prototype.originalorganizationList = $util.emptyArray;
	Thesis.prototype.classcodeList = $util.emptyArray;
	Thesis.prototype.keywordsList = $util.emptyArray;
	Thesis.prototype.abstractList = $util.emptyArray;
	Thesis.prototype.citedcount = 0;
	Thesis.prototype.publishdate = '';
	Thesis.prototype.metadataonlinedate = '';
	Thesis.prototype.hasfulltext = false;
	Thesis.prototype.pageno = '';
	Thesis.prototype.fulltextpath = '';
	Thesis.prototype.doi = '';
	Thesis.prototype.degree = '';
	Thesis.prototype.language = '';
	Thesis.prototype.major = '';
	Thesis.prototype.tutorList = $util.emptyArray;
	Thesis.prototype.metadataviewcount = 0;
	Thesis.prototype.downloadcount = 0;
	Thesis.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Thesis();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1:
				message.id = reader.string();
				break;
			case 2:
				message.type = reader.string();
				break;
			case 3:
				if (!(message.titleList && message.titleList.length))
					message.titleList = [];
				message.titleList.push(reader.string());
				break;
			case 4:
				if (!(message.creatorList && message.creatorList.length))
					message.creatorList = [];
				message.creatorList.push(reader.string());
				break;
			case 5:
				if (!(message.creatorforsearchList && message.creatorforsearchList.length))
					message.creatorforsearchList = [];
				message.creatorforsearchList.push(reader.string());
				break;
			case 7:
				if (!(message.organizationnewList && message.organizationnewList.length))
					message.organizationnewList = [];
				message.organizationnewList.push(reader.string());
				break;
			case 8:
				if (!(message.originalorganizationList && message.originalorganizationList.length))
					message.originalorganizationList = [];
				message.originalorganizationList.push(reader.string());
				break;
			case 10:
				if (!(message.classcodeList && message.classcodeList.length))
					message.classcodeList = [];
				message.classcodeList.push(reader.string());
				break;
			case 14:
				if (!(message.keywordsList && message.keywordsList.length))
					message.keywordsList = [];
				message.keywordsList.push(reader.string());
				break;
			case 18:
				if (!(message.abstractList && message.abstractList.length))
					message.abstractList = [];
				message.abstractList.push(reader.string());
				break;
			case 19:
				message.citedcount = reader.int32();
				break;
			case 21:
				message.publishdate = reader.string();
				break;
			case 22:
				message.metadataonlinedate = reader.string();
				break;
			case 25:
				message.hasfulltext = reader.bool();
				break;
			case 27:
				message.pageno = reader.string();
				break;
			case 28:
				message.fulltextpath = reader.string();
				break;
			case 29:
				message.doi = reader.string();
				break;
			case 30:
				message.degree = reader.string();
				break;
			case 31:
				message.language = reader.string();
				break;
			case 34:
				message.major = reader.string();
				break;
			case 36:
				if (!(message.tutorList && message.tutorList.length))
					message.tutorList = [];
				message.tutorList.push(reader.string());
				break;
			case 37:
				message.metadataviewcount = reader.int32();
				break;
			case 39:
				message.downloadcount = reader.int32();
				break;
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};
	Thesis.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.arrays || options.defaults) {
			object.titleList = [];
			object.creatorList = [];
			object.creatorforsearchList = [];
			object.organizationnewList = [];
			object.originalorganizationList = [];
			object.classcodeList = [];
			object.keywordsList = [];
			object.abstractList = [];
			object.tutorList = [];
		}
		if (options.defaults) {
			object.id = '';
			object.type = '';
			object.citedcount = 0;
			object.publishdate = '';
			object.metadataonlinedate = '';
			object.hasfulltext = false;
			object.pageno = '';
			object.fulltextpath = '';
			object.doi = '';
			object.degree = '';
			object.language = '';
			object.major = '';
			object.metadataviewcount = 0;
			object.downloadcount = 0;
		}
		if (message.id != null && message.hasOwnProperty('id'))
			object.id = message.id;
		if (message.type != null && message.hasOwnProperty('type'))
			object.type = message.type;
		if (message.titleList && message.titleList.length) {
			object.titleList = [];
			for (let j = 0; j < message.titleList.length; ++j)
				object.titleList[j] = message.titleList[j];
		}
		if (message.creatorList && message.creatorList.length) {
			object.creatorList = [];
			for (let j = 0; j < message.creatorList.length; ++j)
				object.creatorList[j] = message.creatorList[j];
		}
		if (message.creatorforsearchList && message.creatorforsearchList.length) {
			object.creatorforsearchList = [];
			for (let j = 0; j < message.creatorforsearchList.length; ++j)
				object.creatorforsearchList[j] = message.creatorforsearchList[j];
		}
		if (message.organizationnewList && message.organizationnewList.length) {
			object.organizationnewList = [];
			for (let j = 0; j < message.organizationnewList.length; ++j)
				object.organizationnewList[j] = message.organizationnewList[j];
		}
		if (message.originalorganizationList && message.originalorganizationList.length) {
			object.originalorganizationList = [];
			for (let j = 0; j < message.originalorganizationList.length; ++j)
				object.originalorganizationList[j] = message.originalorganizationList[j];
		}
		if (message.classcodeList && message.classcodeList.length) {
			object.classcodeList = [];
			for (let j = 0; j < message.classcodeList.length; ++j)
				object.classcodeList[j] = message.classcodeList[j];
		}
		if (message.keywordsList && message.keywordsList.length) {
			object.keywordsList = [];
			for (let j = 0; j < message.keywordsList.length; ++j)
				object.keywordsList[j] = message.keywordsList[j];
		}
		if (message.abstractList && message.abstractList.length) {
			object.abstractList = [];
			for (let j = 0; j < message.abstractList.length; ++j)
				object.abstractList[j] = message.abstractList[j];
		}
		if (message.citedcount != null && message.hasOwnProperty('citedcount'))
			object.citedcount = message.citedcount;
		if (message.publishdate != null && message.hasOwnProperty('publishdate'))
			object.publishdate = message.publishdate;
		if (message.metadataonlinedate != null && message.hasOwnProperty('metadataonlinedate'))
			object.metadataonlinedate = message.metadataonlinedate;
		if (message.hasfulltext != null && message.hasOwnProperty('hasfulltext'))
			object.hasfulltext = message.hasfulltext;
		if (message.pageno != null && message.hasOwnProperty('pageno'))
			object.pageno = message.pageno;
		if (message.fulltextpath != null && message.hasOwnProperty('fulltextpath'))
			object.fulltextpath = message.fulltextpath;
		if (message.doi != null && message.hasOwnProperty('doi'))
			object.doi = message.doi;
		if (message.degree != null && message.hasOwnProperty('degree'))
			object.degree = message.degree;
		if (message.language != null && message.hasOwnProperty('language'))
			object.language = message.language;
		if (message.major != null && message.hasOwnProperty('major'))
			object.major = message.major;
		if (message.tutorList && message.tutorList.length) {
			object.tutorList = [];
			for (let j = 0; j < message.tutorList.length; ++j)
				object.tutorList[j] = message.tutorList[j];
		}
		if (message.metadataviewcount != null && message.hasOwnProperty('metadataviewcount'))
			object.metadataviewcount = message.metadataviewcount;
		if (message.downloadcount != null && message.hasOwnProperty('downloadcount'))
			object.downloadcount = message.downloadcount;
		return object;
	};
	return Thesis;
})();
const Conference = $root.Conference = (() => {
	function Conference(properties) {
		this.titleList = [];
		this.creatorList = [];
		this.classcodeList = [];
		this.keywordsList = [];
		this.abstractList = [];
		this.meetingtitleList = [];
		this.sponsorList = [];
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}
	Conference.prototype.id = '';
	Conference.prototype.titleList = $util.emptyArray;
	Conference.prototype.creatorList = $util.emptyArray;
	Conference.prototype.classcodeList = $util.emptyArray;
	Conference.prototype.keywordsList = $util.emptyArray;
	Conference.prototype.abstractList = $util.emptyArray;
	Conference.prototype.citedcount = 0;
	Conference.prototype.publishdate = '';
	Conference.prototype.metadataonlinedate = '';
	Conference.prototype.hasfulltext = false;
	Conference.prototype.page = '';
	Conference.prototype.fulltextpath = '';
	Conference.prototype.doi = '';
	Conference.prototype.language = '';
	Conference.prototype.meetingtitleList = $util.emptyArray;
	Conference.prototype.meetingarea = '';
	Conference.prototype.meetingdate = '';
	Conference.prototype.sponsorList = $util.emptyArray;
	Conference.prototype.meetingcorpus = '';
	Conference.prototype.metadataviewcount = 0;
	Conference.prototype.downloadcount = 0;
	Conference.prototype.type = '';
	Conference.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Conference();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1:
				message.id = reader.string();
				break;
			case 3:
				if (!(message.titleList && message.titleList.length))
					message.titleList = [];
				message.titleList.push(reader.string());
				break;
			case 4:
				if (!(message.creatorList && message.creatorList.length))
					message.creatorList = [];
				message.creatorList.push(reader.string());
				break;
			case 12:
				if (!(message.classcodeList && message.classcodeList.length))
					message.classcodeList = [];
				message.classcodeList.push(reader.string());
				break;
			case 16:
				if (!(message.keywordsList && message.keywordsList.length))
					message.keywordsList = [];
				message.keywordsList.push(reader.string());
				break;
			case 20:
				if (!(message.abstractList && message.abstractList.length))
					message.abstractList = [];
				message.abstractList.push(reader.string());
				break;
			case 21:
				message.citedcount = reader.int32();
				break;
			case 23:
				message.publishdate = reader.string();
				break;
			case 24:
				message.metadataonlinedate = reader.string();
				break;
			case 27:
				message.hasfulltext = reader.bool();
				break;
			case 29:
				message.page = reader.string();
				break;
			case 31:
				message.fulltextpath = reader.string();
				break;
			case 32:
				message.doi = reader.string();
				break;
			case 35:
				message.language = reader.string();
				break;
			case 37:
				if (!(message.meetingtitleList && message.meetingtitleList.length))
					message.meetingtitleList = [];
				message.meetingtitleList.push(reader.string());
				break;
			case 38:
				message.meetingarea = reader.string();
				break;
			case 39:
				message.meetingdate = reader.string();
				break;
			case 41:
				if (!(message.sponsorList && message.sponsorList.length))
					message.sponsorList = [];
				message.sponsorList.push(reader.string());
				break;
			case 42:
				message.meetingcorpus = reader.string();
				break;
			case 43:
				message.metadataviewcount = reader.int32();
				break;
			case 45:
				message.downloadcount = reader.int32();
				break;
			case 2:
				message.type = reader.string();
				break;
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};
	Conference.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.arrays || options.defaults) {
			object.titleList = [];
			object.creatorList = [];
			object.classcodeList = [];
			object.keywordsList = [];
			object.abstractList = [];
			object.meetingtitleList = [];
			object.sponsorList = [];
		}
		if (options.defaults) {
			object.id = '';
			object.type = '';
			object.citedcount = 0;
			object.publishdate = '';
			object.metadataonlinedate = '';
			object.hasfulltext = false;
			object.page = '';
			object.fulltextpath = '';
			object.doi = '';
			object.language = '';
			object.meetingarea = '';
			object.meetingdate = '';
			object.meetingcorpus = '';
			object.metadataviewcount = 0;
			object.downloadcount = 0;
		}
		if (message.id != null && message.hasOwnProperty('id'))
			object.id = message.id;
		if (message.type != null && message.hasOwnProperty('type'))
			object.type = message.type;
		if (message.titleList && message.titleList.length) {
			object.titleList = [];
			for (let j = 0; j < message.titleList.length; ++j)
				object.titleList[j] = message.titleList[j];
		}
		if (message.creatorList && message.creatorList.length) {
			object.creatorList = [];
			for (let j = 0; j < message.creatorList.length; ++j)
				object.creatorList[j] = message.creatorList[j];
		}
		if (message.classcodeList && message.classcodeList.length) {
			object.classcodeList = [];
			for (let j = 0; j < message.classcodeList.length; ++j)
				object.classcodeList[j] = message.classcodeList[j];
		}
		if (message.keywordsList && message.keywordsList.length) {
			object.keywordsList = [];
			for (let j = 0; j < message.keywordsList.length; ++j)
				object.keywordsList[j] = message.keywordsList[j];
		}
		if (message.abstractList && message.abstractList.length) {
			object.abstractList = [];
			for (let j = 0; j < message.abstractList.length; ++j)
				object.abstractList[j] = message.abstractList[j];
		}
		if (message.citedcount != null && message.hasOwnProperty('citedcount'))
			object.citedcount = message.citedcount;
		if (message.publishdate != null && message.hasOwnProperty('publishdate'))
			object.publishdate = message.publishdate;
		if (message.metadataonlinedate != null && message.hasOwnProperty('metadataonlinedate'))
			object.metadataonlinedate = message.metadataonlinedate;
		if (message.hasfulltext != null && message.hasOwnProperty('hasfulltext'))
			object.hasfulltext = message.hasfulltext;
		if (message.page != null && message.hasOwnProperty('page'))
			object.page = message.page;
		if (message.fulltextpath != null && message.hasOwnProperty('fulltextpath'))
			object.fulltextpath = message.fulltextpath;
		if (message.doi != null && message.hasOwnProperty('doi'))
			object.doi = message.doi;
		if (message.language != null && message.hasOwnProperty('language'))
			object.language = message.language;
		if (message.meetingtitleList && message.meetingtitleList.length) {
			object.meetingtitleList = [];
			for (let j = 0; j < message.meetingtitleList.length; ++j)
				object.meetingtitleList[j] = message.meetingtitleList[j];
		}
		if (message.meetingarea != null && message.hasOwnProperty('meetingarea'))
			object.meetingarea = message.meetingarea;
		if (message.meetingdate != null && message.hasOwnProperty('meetingdate'))
			object.meetingdate = message.meetingdate;
		if (message.sponsorList && message.sponsorList.length) {
			object.sponsorList = [];
			for (let j = 0; j < message.sponsorList.length; ++j)
				object.sponsorList[j] = message.sponsorList[j];
		}
		if (message.meetingcorpus != null && message.hasOwnProperty('meetingcorpus'))
			object.meetingcorpus = message.meetingcorpus;
		if (message.metadataviewcount != null && message.hasOwnProperty('metadataviewcount'))
			object.metadataviewcount = message.metadataviewcount;
		if (message.downloadcount != null && message.hasOwnProperty('downloadcount'))
			object.downloadcount = message.downloadcount;
		return object;
	};
	return Conference;
})();
const Patent = $root.Patent = (() => {
	function Patent(properties) {
		this.titleList = [];
		this.inventorList = [];
		this.applicantList = [];
		this.classcodeList = [];
		this.abstractList = [];
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}
	Patent.prototype.id = '';
	Patent.prototype.titleList = $util.emptyArray;
	Patent.prototype.patentcode = '';
	Patent.prototype.publicationno = '';
	Patent.prototype.inventorList = $util.emptyArray;
	Patent.prototype.applicantList = $util.emptyArray;
	Patent.prototype.classcodeList = $util.emptyArray;
	Patent.prototype.abstractList = $util.emptyArray;
	Patent.prototype.patenttype = '';
	Patent.prototype.applicationdate = '';
	Patent.prototype.publicationdate = '';
	Patent.prototype.applicantarea = '';
	Patent.prototype.applicantaddress = '';
	Patent.prototype.agency = '';
	Patent.prototype.agent = '';
	Patent.prototype.signoryitem = '';
	Patent.prototype.legalstatus = '';
	Patent.prototype.validity = '';
	Patent.prototype.fulltextpath = '';
	Patent.prototype.hasfulltext = false;
	Patent.prototype.type = '';
	Patent.prototype.citedcount = '';
	Patent.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Patent();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1:
				message.id = reader.string();
				break;
			case 2:
				if (!(message.titleList && message.titleList.length))
					message.titleList = [];
				message.titleList.push(reader.string());
				break;
			case 3:
				message.patentcode = reader.string();
				break;
			case 4:
				message.publicationno = reader.string();
				break;
			case 5:
				if (!(message.inventorList && message.inventorList.length))
					message.inventorList = [];
				message.inventorList.push(reader.string());
				break;
			case 7:
				if (!(message.applicantList && message.applicantList.length))
					message.applicantList = [];
				message.applicantList.push(reader.string());
				break;
			case 10:
				if (!(message.classcodeList && message.classcodeList.length))
					message.classcodeList = [];
				message.classcodeList.push(reader.string());
				break;
			case 12:
				if (!(message.abstractList && message.abstractList.length))
					message.abstractList = [];
				message.abstractList.push(reader.string());
				break;
			case 13:
				message.patenttype = reader.string();
				break;
			case 15:
				message.applicationdate = reader.string();
				break;
			case 16:
				message.publicationdate = reader.string();
				break;
			case 18:
				message.applicantarea = reader.string();
				break;
			case 19:
				message.applicantaddress = reader.string();
				break;
			case 20:
				message.agency = reader.string();
				break;
			case 21:
				message.agent = reader.string();
				break;
			case 22:
				message.signoryitem = reader.string();
				break;
			case 23:
				message.legalstatus = reader.string();
				break;
			case 46:
				message.validity = reader.string();
				break;
			case 25:
				message.fulltextpath = reader.string();
				break;
			case 26:
				message.hasfulltext = reader.bool();
				break;
			case 27:
				message.type = reader.string();
				break;
			case 33:
				message.citedcount = reader.string();
				break;
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};
	Patent.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.arrays || options.defaults) {
			object.titleList = [];
			object.inventorList = [];
			object.applicantList = [];
			object.classcodeList = [];
			object.abstractList = [];
		}
		if (options.defaults) {
			object.id = '';
			object.patentcode = '';
			object.publicationno = '';
			object.patenttype = '';
			object.applicationdate = '';
			object.publicationdate = '';
			object.applicantarea = '';
			object.applicantaddress = '';
			object.agency = '';
			object.agent = '';
			object.signoryitem = '';
			object.legalstatus = '';
			object.fulltextpath = '';
			object.hasfulltext = false;
			object.type = '';
			object.citedcount = '';
			object.validity = '';
		}
		if (message.id != null && message.hasOwnProperty('id'))
			object.id = message.id;
		if (message.titleList && message.titleList.length) {
			object.titleList = [];
			for (let j = 0; j < message.titleList.length; ++j)
				object.titleList[j] = message.titleList[j];
		}
		if (message.patentcode != null && message.hasOwnProperty('patentcode'))
			object.patentcode = message.patentcode;
		if (message.publicationno != null && message.hasOwnProperty('publicationno'))
			object.publicationno = message.publicationno;
		if (message.inventorList && message.inventorList.length) {
			object.inventorList = [];
			for (let j = 0; j < message.inventorList.length; ++j)
				object.inventorList[j] = message.inventorList[j];
		}
		if (message.applicantList && message.applicantList.length) {
			object.applicantList = [];
			for (let j = 0; j < message.applicantList.length; ++j)
				object.applicantList[j] = message.applicantList[j];
		}
		if (message.classcodeList && message.classcodeList.length) {
			object.classcodeList = [];
			for (let j = 0; j < message.classcodeList.length; ++j)
				object.classcodeList[j] = message.classcodeList[j];
		}
		if (message.abstractList && message.abstractList.length) {
			object.abstractList = [];
			for (let j = 0; j < message.abstractList.length; ++j)
				object.abstractList[j] = message.abstractList[j];
		}
		if (message.patenttype != null && message.hasOwnProperty('patenttype'))
			object.patenttype = message.patenttype;
		if (message.applicationdate != null && message.hasOwnProperty('applicationdate'))
			object.applicationdate = message.applicationdate;
		if (message.publicationdate != null && message.hasOwnProperty('publicationdate'))
			object.publicationdate = message.publicationdate;
		if (message.applicantarea != null && message.hasOwnProperty('applicantarea'))
			object.applicantarea = message.applicantarea;
		if (message.applicantaddress != null && message.hasOwnProperty('applicantaddress'))
			object.applicantaddress = message.applicantaddress;
		if (message.agency != null && message.hasOwnProperty('agency'))
			object.agency = message.agency;
		if (message.agent != null && message.hasOwnProperty('agent'))
			object.agent = message.agent;
		if (message.signoryitem != null && message.hasOwnProperty('signoryitem'))
			object.signoryitem = message.signoryitem;
		if (message.legalstatus != null && message.hasOwnProperty('legalstatus'))
			object.legalstatus = message.legalstatus;
		if (message.fulltextpath != null && message.hasOwnProperty('fulltextpath'))
			object.fulltextpath = message.fulltextpath;
		if (message.hasfulltext != null && message.hasOwnProperty('hasfulltext'))
			object.hasfulltext = message.hasfulltext;
		if (message.type != null && message.hasOwnProperty('type'))
			object.type = message.type;
		if (message.citedcount != null && message.hasOwnProperty('citedcount'))
			object.citedcount = message.citedcount;
		if (message.validity != null && message.hasOwnProperty('validity'))
			object.validity = message.validity;
		return object;
	};
	return Patent;
})();
const Nstr = $root.Nstr = (() => {
	function Nstr(properties) {
		this.titleList = [];
		this.creatorList = [];
		this.organizationList = [];
		this.classcodeList = [];
		this.keywordsList = [];
		this.abstractList = [];
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}
	Nstr.prototype.id = '';
	Nstr.prototype.titleList = $util.emptyArray;
	Nstr.prototype.creatorList = $util.emptyArray;
	Nstr.prototype.organizationList = $util.emptyArray;
	Nstr.prototype.classcodeList = $util.emptyArray;
	Nstr.prototype.keywordsList = $util.emptyArray;
	Nstr.prototype.abstractList = $util.emptyArray;
	Nstr.prototype.planname = '';
	Nstr.prototype.projectname = '';
	Nstr.prototype.publishdate = '';
	Nstr.prototype.technicalfield = '';
	Nstr.prototype.pagenum = '';
	Nstr.prototype.language = '';
	Nstr.prototype.metadataviewcount = 0;
	Nstr.prototype.type = '';
	Nstr.prototype.area = '';
	Nstr.prototype.subject = '';
	Nstr.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Nstr();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1:
				message.id = reader.string();
				break;
			case 2:
				if (!(message.titleList && message.titleList.length))
					message.titleList = [];
				message.titleList.push(reader.string());
				break;
			case 3:
				if (!(message.creatorList && message.creatorList.length))
					message.creatorList = [];
				message.creatorList.push(reader.string());
				break;
			case 5:
				if (!(message.organizationList && message.organizationList.length))
					message.organizationList = [];
				message.organizationList.push(reader.string());
				break;
			case 7:
				if (!(message.classcodeList && message.classcodeList.length))
					message.classcodeList = [];
				message.classcodeList.push(reader.string());
				break;
			case 8:
				if (!(message.keywordsList && message.keywordsList.length))
					message.keywordsList = [];
				message.keywordsList.push(reader.string());
				break;
			case 11:
				if (!(message.abstractList && message.abstractList.length))
					message.abstractList = [];
				message.abstractList.push(reader.string());
				break;
			case 12:
				message.planname = reader.string();
				break;
			case 13:
				message.projectname = reader.string();
				break;
			case 33:
				message.publishdate = reader.string();
				break;
			case 35:
				message.technicalfield = reader.string();
				break;
			case 24:
				message.pagenum = reader.string();
				break;
			case 26:
				message.language = reader.string();
				break;
			case 29:
				message.metadataviewcount = reader.int32();
				break;
			case 31:
				message.type = reader.string();
				break;
			case 37:
				message.area = reader.string();
				break;
			case 38:
				message.subject = reader.string();
				break;
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};
	Nstr.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.arrays || options.defaults) {
			object.titleList = [];
			object.creatorList = [];
			object.organizationList = [];
			object.classcodeList = [];
			object.keywordsList = [];
			object.abstractList = [];
		}
		if (options.defaults) {
			object.id = '';
			object.planname = '';
			object.projectname = '';
			object.pagenum = '';
			object.language = '';
			object.metadataviewcount = 0;
			object.type = '';
			object.publishdate = '';
			object.technicalfield = '';
			object.area = '';
			object.subject = '';
		}
		if (message.id != null && message.hasOwnProperty('id'))
			object.id = message.id;
		if (message.titleList && message.titleList.length) {
			object.titleList = [];
			for (let j = 0; j < message.titleList.length; ++j)
				object.titleList[j] = message.titleList[j];
		}
		if (message.creatorList && message.creatorList.length) {
			object.creatorList = [];
			for (let j = 0; j < message.creatorList.length; ++j)
				object.creatorList[j] = message.creatorList[j];
		}
		if (message.organizationList && message.organizationList.length) {
			object.organizationList = [];
			for (let j = 0; j < message.organizationList.length; ++j)
				object.organizationList[j] = message.organizationList[j];
		}
		if (message.classcodeList && message.classcodeList.length) {
			object.classcodeList = [];
			for (let j = 0; j < message.classcodeList.length; ++j)
				object.classcodeList[j] = message.classcodeList[j];
		}
		if (message.keywordsList && message.keywordsList.length) {
			object.keywordsList = [];
			for (let j = 0; j < message.keywordsList.length; ++j)
				object.keywordsList[j] = message.keywordsList[j];
		}
		if (message.abstractList && message.abstractList.length) {
			object.abstractList = [];
			for (let j = 0; j < message.abstractList.length; ++j)
				object.abstractList[j] = message.abstractList[j];
		}
		if (message.planname != null && message.hasOwnProperty('planname'))
			object.planname = message.planname;
		if (message.projectname != null && message.hasOwnProperty('projectname'))
			object.projectname = message.projectname;
		if (message.pagenum != null && message.hasOwnProperty('pagenum'))
			object.pagenum = message.pagenum;
		if (message.language != null && message.hasOwnProperty('language'))
			object.language = message.language;
		if (message.metadataviewcount != null && message.hasOwnProperty('metadataviewcount'))
			object.metadataviewcount = message.metadataviewcount;
		if (message.type != null && message.hasOwnProperty('type'))
			object.type = message.type;
		if (message.publishdate != null && message.hasOwnProperty('publishdate'))
			object.publishdate = message.publishdate;
		if (message.technicalfield != null && message.hasOwnProperty('technicalfield'))
			object.technicalfield = message.technicalfield;
		if (message.area != null && message.hasOwnProperty('area'))
			object.area = message.area;
		if (message.subject != null && message.hasOwnProperty('subject'))
			object.subject = message.subject;
		return object;
	};
	return Nstr;
})();
const Standard = $root.Standard = (() => {
	function Standard(properties) {
		this.titleList = [];
		this.classcodeList = [];
		this.keywordsList = [];
		this.abstractList = [];
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}
	Standard.prototype.id = '';
	Standard.prototype.standardno = '';
	Standard.prototype.titleList = $util.emptyArray;
	Standard.prototype.publisher = '';
	Standard.prototype.status = '';
	Standard.prototype.classcodeList = $util.emptyArray;
	Standard.prototype.keywordsList = $util.emptyArray;
	Standard.prototype.abstractList = $util.emptyArray;
	Standard.prototype.citedcount = 0;
	Standard.prototype.singlesourcedb = '';
	Standard.prototype.issuedate = '';
	Standard.prototype.publishdate = '';
	Standard.prototype.fulltextpath = '';
	Standard.prototype.hasfulltext = false;
	Standard.prototype.language = '';
	Standard.prototype.technicalcommittee = '';
	Standard.prototype.citestandard = '';
	Standard.prototype.adoptstandard = '';
	Standard.prototype.oldstandard = '';
	Standard.prototype.newstandard = '';
	Standard.prototype.type = '';
	Standard.prototype.applydate = '';
	Standard.prototype.pageno = '';
	Standard.prototype.metadataviewcount = 0;
	Standard.prototype.downloadcount = 0;
	Standard.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Standard();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1:
				message.id = reader.string();
				break;
			case 45:
				message.standardno = reader.string();
				break;
			case 2:
				if (!(message.titleList && message.titleList.length))
					message.titleList = [];
				message.titleList.push(reader.string());
				break;
			case 46:
				message.publisher = reader.string();
				break;
			case 7:
				message.status = reader.string();
				break;
			case 8:
				if (!(message.classcodeList && message.classcodeList.length))
					message.classcodeList = [];
				message.classcodeList.push(reader.string());
				break;
			case 10:
				if (!(message.keywordsList && message.keywordsList.length))
					message.keywordsList = [];
				message.keywordsList.push(reader.string());
				break;
			case 13:
				if (!(message.abstractList && message.abstractList.length))
					message.abstractList = [];
				message.abstractList.push(reader.string());
				break;
			case 14:
				message.citedcount = reader.int32();
				break;
			case 35:
				message.singlesourcedb = reader.string();
				break;
			case 16:
				message.issuedate = reader.string();
				break;
			case 36:
				message.publishdate = reader.string();
				break;
			case 20:
				message.fulltextpath = reader.string();
				break;
			case 21:
				message.hasfulltext = reader.bool();
				break;
			case 23:
				message.language = reader.string();
				break;
			case 24:
				message.technicalcommittee = reader.string();
				break;
			case 25:
				message.citestandard = reader.string();
				break;
			case 26:
				message.adoptstandard = reader.string();
				break;
			case 27:
				message.oldstandard = reader.string();
				break;
			case 28:
				message.newstandard = reader.string();
				break;
			case 29:
				message.type = reader.string();
				break;
			case 33:
				message.applydate = reader.string();
				break;
			case 34:
				message.pageno = reader.string();
				break;
			case 38:
				message.metadataviewcount = reader.int32();
				break;
			case 39:
				message.downloadcount = reader.int32();
				break;
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};
	Standard.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.arrays || options.defaults) {
			object.titleList = [];
			object.classcodeList = [];
			object.keywordsList = [];
			object.abstractList = [];
		}
		if (options.defaults) {
			object.id = '';
			object.status = '';
			object.citedcount = 0;
			object.issuedate = '';
			object.fulltextpath = '';
			object.hasfulltext = false;
			object.language = '';
			object.technicalcommittee = '';
			object.citestandard = '';
			object.adoptstandard = '';
			object.oldstandard = '';
			object.newstandard = '';
			object.type = '';
			object.applydate = '';
			object.pageno = '';
			object.singlesourcedb = '';
			object.publishdate = '';
			object.metadataviewcount = 0;
			object.downloadcount = 0;
			object.standardno = '';
			object.publisher = '';
		}
		if (message.id != null && message.hasOwnProperty('id'))
			object.id = message.id;
		if (message.titleList && message.titleList.length) {
			object.titleList = [];
			for (let j = 0; j < message.titleList.length; ++j)
				object.titleList[j] = message.titleList[j];
		}
		if (message.status != null && message.hasOwnProperty('status'))
			object.status = message.status;
		if (message.classcodeList && message.classcodeList.length) {
			object.classcodeList = [];
			for (let j = 0; j < message.classcodeList.length; ++j)
				object.classcodeList[j] = message.classcodeList[j];
		}
		if (message.keywordsList && message.keywordsList.length) {
			object.keywordsList = [];
			for (let j = 0; j < message.keywordsList.length; ++j)
				object.keywordsList[j] = message.keywordsList[j];
		}
		if (message.abstractList && message.abstractList.length) {
			object.abstractList = [];
			for (let j = 0; j < message.abstractList.length; ++j)
				object.abstractList[j] = message.abstractList[j];
		}
		if (message.citedcount != null && message.hasOwnProperty('citedcount'))
			object.citedcount = message.citedcount;
		if (message.issuedate != null && message.hasOwnProperty('issuedate'))
			object.issuedate = message.issuedate;
		if (message.fulltextpath != null && message.hasOwnProperty('fulltextpath'))
			object.fulltextpath = message.fulltextpath;
		if (message.hasfulltext != null && message.hasOwnProperty('hasfulltext'))
			object.hasfulltext = message.hasfulltext;
		if (message.language != null && message.hasOwnProperty('language'))
			object.language = message.language;
		if (message.technicalcommittee != null && message.hasOwnProperty('technicalcommittee'))
			object.technicalcommittee = message.technicalcommittee;
		if (message.citestandard != null && message.hasOwnProperty('citestandard'))
			object.citestandard = message.citestandard;
		if (message.adoptstandard != null && message.hasOwnProperty('adoptstandard'))
			object.adoptstandard = message.adoptstandard;
		if (message.oldstandard != null && message.hasOwnProperty('oldstandard'))
			object.oldstandard = message.oldstandard;
		if (message.newstandard != null && message.hasOwnProperty('newstandard'))
			object.newstandard = message.newstandard;
		if (message.type != null && message.hasOwnProperty('type'))
			object.type = message.type;
		if (message.applydate != null && message.hasOwnProperty('applydate'))
			object.applydate = message.applydate;
		if (message.pageno != null && message.hasOwnProperty('pageno'))
			object.pageno = message.pageno;
		if (message.singlesourcedb != null && message.hasOwnProperty('singlesourcedb'))
			object.singlesourcedb = message.singlesourcedb;
		if (message.publishdate != null && message.hasOwnProperty('publishdate'))
			object.publishdate = message.publishdate;
		if (message.metadataviewcount != null && message.hasOwnProperty('metadataviewcount'))
			object.metadataviewcount = message.metadataviewcount;
		if (message.downloadcount != null && message.hasOwnProperty('downloadcount'))
			object.downloadcount = message.downloadcount;
		if (message.standardno != null && message.hasOwnProperty('standardno'))
			object.standardno = message.standardno;
		if (message.publisher != null && message.hasOwnProperty('publisher'))
			object.publisher = message.publisher;
		return object;
	};
	return Standard;
})();
const Cstad = $root.Cstad = (() => {
	function Cstad(properties) {
		this.titleList = [];
		this.creatorList = [];
		this.classcodeList = [];
		this.abstractList = [];
		this.keywordsList = [];
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}
	Cstad.prototype.id = '';
	Cstad.prototype.type = '';
	Cstad.prototype.titleList = $util.emptyArray;
	Cstad.prototype.creatorList = $util.emptyArray;
	Cstad.prototype.planname = '';
	Cstad.prototype.classcodeList = $util.emptyArray;
	Cstad.prototype.abstractList = $util.emptyArray;
	Cstad.prototype.keywordsList = $util.emptyArray;
	Cstad.prototype.publishdate = '';
	Cstad.prototype.page = '';
	Cstad.prototype.achievementtype = '';
	Cstad.prototype.achievementlevel = '';
	Cstad.prototype.province = '';
	Cstad.prototype.metadataviewcount = 0;
	Cstad.prototype.citedcount = 0;
	Cstad.prototype.metadataonlinedate = '';
	Cstad.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Cstad();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1:
				message.id = reader.string();
				break;
			case 2:
				message.type = reader.string();
				break;
			case 3:
				if (!(message.titleList && message.titleList.length))
					message.titleList = [];
				message.titleList.push(reader.string());
				break;
			case 4:
				if (!(message.creatorList && message.creatorList.length))
					message.creatorList = [];
				message.creatorList.push(reader.string());
				break;
			case 24:
				message.planname = reader.string();
				break;
			case 29:
				if (!(message.classcodeList && message.classcodeList.length))
					message.classcodeList = [];
				message.classcodeList.push(reader.string());
				break;
			case 32:
				if (!(message.abstractList && message.abstractList.length))
					message.abstractList = [];
				message.abstractList.push(reader.string());
				break;
			case 33:
				if (!(message.keywordsList && message.keywordsList.length))
					message.keywordsList = [];
				message.keywordsList.push(reader.string());
				break;
			case 67:
				message.publishdate = reader.string();
				break;
			case 36:
				message.page = reader.string();
				break;
			case 38:
				message.achievementtype = reader.string();
				break;
			case 39:
				message.achievementlevel = reader.string();
				break;
			case 46:
				message.province = reader.string();
				break;
			case 65:
				message.metadataviewcount = reader.int32();
				break;
			case 81:
				message.citedcount = reader.int32();
				break;
			case 74:
				message.metadataonlinedate = reader.string();
				break;
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};
	Cstad.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.arrays || options.defaults) {
			object.titleList = [];
			object.creatorList = [];
			object.classcodeList = [];
			object.abstractList = [];
			object.keywordsList = [];
		}
		if (options.defaults) {
			object.id = '';
			object.type = '';
			object.planname = '';
			object.page = '';
			object.achievementtype = '';
			object.achievementlevel = '';
			object.province = '';
			object.metadataviewcount = 0;
			object.publishdate = '';
			object.metadataonlinedate = '';
			object.citedcount = 0;
		}
		if (message.id != null && message.hasOwnProperty('id'))
			object.id = message.id;
		if (message.type != null && message.hasOwnProperty('type'))
			object.type = message.type;
		if (message.titleList && message.titleList.length) {
			object.titleList = [];
			for (let j = 0; j < message.titleList.length; ++j)
				object.titleList[j] = message.titleList[j];
		}
		if (message.creatorList && message.creatorList.length) {
			object.creatorList = [];
			for (let j = 0; j < message.creatorList.length; ++j)
				object.creatorList[j] = message.creatorList[j];
		}
		if (message.planname != null && message.hasOwnProperty('planname'))
			object.planname = message.planname;
		if (message.classcodeList && message.classcodeList.length) {
			object.classcodeList = [];
			for (let j = 0; j < message.classcodeList.length; ++j)
				object.classcodeList[j] = message.classcodeList[j];
		}
		if (message.abstractList && message.abstractList.length) {
			object.abstractList = [];
			for (let j = 0; j < message.abstractList.length; ++j)
				object.abstractList[j] = message.abstractList[j];
		}
		if (message.keywordsList && message.keywordsList.length) {
			object.keywordsList = [];
			for (let j = 0; j < message.keywordsList.length; ++j)
				object.keywordsList[j] = message.keywordsList[j];
		}
		if (message.page != null && message.hasOwnProperty('page'))
			object.page = message.page;
		if (message.achievementtype != null && message.hasOwnProperty('achievementtype'))
			object.achievementtype = message.achievementtype;
		if (message.achievementlevel != null && message.hasOwnProperty('achievementlevel'))
			object.achievementlevel = message.achievementlevel;
		if (message.province != null && message.hasOwnProperty('province'))
			object.province = message.province;
		if (message.metadataviewcount != null && message.hasOwnProperty('metadataviewcount'))
			object.metadataviewcount = message.metadataviewcount;
		if (message.publishdate != null && message.hasOwnProperty('publishdate'))
			object.publishdate = message.publishdate;
		if (message.metadataonlinedate != null && message.hasOwnProperty('metadataonlinedate'))
			object.metadataonlinedate = message.metadataonlinedate;
		if (message.citedcount != null && message.hasOwnProperty('citedcount'))
			object.citedcount = message.citedcount;
		return object;
	};
	return Cstad;
})();
const Claw = $root.Claw = (() => {
	function Claw(properties) {
		this.titleList = [];
		this.issueunitList = [];
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}
	Claw.prototype.id = '';
	Claw.prototype.type = '';
	Claw.prototype.titleList = $util.emptyArray;
	Claw.prototype.issueunitList = $util.emptyArray;
	Claw.prototype.issuenumber = '';
	Claw.prototype.finalcourt = '';
	Claw.prototype.effectlevel = '';
	Claw.prototype.effectcode = '';
	Claw.prototype.effect = '';
	Claw.prototype.issuedate = '';
	Claw.prototype.publishdate = '';
	Claw.prototype.applydate = '';
	Claw.prototype.pdfpath = '';
	Claw.prototype.hasfulltext = false;
	Claw.prototype.metadataviewcount = 0;
	Claw.prototype.downloadcount = 0;
	Claw.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Claw();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1:
				message.id = reader.string();
				break;
			case 2:
				message.type = reader.string();
				break;
			case 3:
				if (!(message.titleList && message.titleList.length))
					message.titleList = [];
				message.titleList.push(reader.string());
				break;
			case 4:
				if (!(message.issueunitList && message.issueunitList.length))
					message.issueunitList = [];
				message.issueunitList.push(reader.string());
				break;
			case 5:
				message.issuenumber = reader.string();
				break;
			case 10:
				message.finalcourt = reader.string();
				break;
			case 13:
				message.effectlevel = reader.string();
				break;
			case 14:
				message.effectcode = reader.string();
				break;
			case 15:
				message.effect = reader.string();
				break;
			case 18:
				message.issuedate = reader.string();
				break;
			case 30:
				message.publishdate = reader.string();
				break;
			case 19:
				message.applydate = reader.string();
				break;
			case 24:
				message.pdfpath = reader.string();
				break;
			case 25:
				message.hasfulltext = reader.bool();
				break;
			case 27:
				message.metadataviewcount = reader.int32();
				break;
			case 28:
				message.downloadcount = reader.int32();
				break;
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};
	Claw.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.arrays || options.defaults) {
			object.titleList = [];
			object.issueunitList = [];
		}
		if (options.defaults) {
			object.id = '';
			object.type = '';
			object.issuenumber = '';
			object.finalcourt = '';
			object.effectlevel = '';
			object.effectcode = '';
			object.effect = '';
			object.issuedate = '';
			object.applydate = '';
			object.pdfpath = '';
			object.hasfulltext = false;
			object.metadataviewcount = 0;
			object.downloadcount = 0;
			object.publishdate = '';
		}
		if (message.id != null && message.hasOwnProperty('id'))
			object.id = message.id;
		if (message.type != null && message.hasOwnProperty('type'))
			object.type = message.type;
		if (message.titleList && message.titleList.length) {
			object.titleList = [];
			for (let j = 0; j < message.titleList.length; ++j)
				object.titleList[j] = message.titleList[j];
		}
		if (message.issueunitList && message.issueunitList.length) {
			object.issueunitList = [];
			for (let j = 0; j < message.issueunitList.length; ++j)
				object.issueunitList[j] = message.issueunitList[j];
		}
		if (message.issuenumber != null && message.hasOwnProperty('issuenumber'))
			object.issuenumber = message.issuenumber;
		if (message.finalcourt != null && message.hasOwnProperty('finalcourt'))
			object.finalcourt = message.finalcourt;
		if (message.effectlevel != null && message.hasOwnProperty('effectlevel'))
			object.effectlevel = message.effectlevel;
		if (message.effectcode != null && message.hasOwnProperty('effectcode'))
			object.effectcode = message.effectcode;
		if (message.effect != null && message.hasOwnProperty('effect'))
			object.effect = message.effect;
		if (message.issuedate != null && message.hasOwnProperty('issuedate'))
			object.issuedate = message.issuedate;
		if (message.applydate != null && message.hasOwnProperty('applydate'))
			object.applydate = message.applydate;
		if (message.pdfpath != null && message.hasOwnProperty('pdfpath'))
			object.pdfpath = message.pdfpath;
		if (message.hasfulltext != null && message.hasOwnProperty('hasfulltext'))
			object.hasfulltext = message.hasfulltext;
		if (message.metadataviewcount != null && message.hasOwnProperty('metadataviewcount'))
			object.metadataviewcount = message.metadataviewcount;
		if (message.downloadcount != null && message.hasOwnProperty('downloadcount'))
			object.downloadcount = message.downloadcount;
		if (message.publishdate != null && message.hasOwnProperty('publishdate'))
			object.publishdate = message.publishdate;
		return object;
	};
	return Claw;
})();

const Url = $root.Url = (() => {

	function Url(properties) {
		if (properties)
			for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
				if (properties[keys[i]] != null)
					this[keys[i]] = properties[keys[i]];
	}

	Url.prototype.unknown1 = "";
	Url.prototype.id = "";
	Url.prototype.unknown3 = "";

	Url.decode = function decode(reader, length) {
		if (!(reader instanceof $Reader))
			reader = $Reader.create(reader);
		let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Url();
		while (reader.pos < end) {
			let tag = reader.uint32();
			switch (tag >>> 3) {
			case 1: {
					message.unknown1 = reader.string();
					break;
				}
			case 2: {
					message.id = reader.string();
					break;
				}
			case 3: {
					message.unknown3 = reader.string();
					break;
				}
			default:
				reader.skipType(tag & 7);
				break;
			}
		}
		return message;
	};

	Url.toObject = function toObject(message, options) {
		if (!options)
			options = {};
		let object = {};
		if (options.defaults) {
			object.unknown1 = "";
			object.id = "";
			object.unknown3 = "";
		}
		if (message.unknown1 != null && message.hasOwnProperty("unknown1"))
			object.unknown1 = message.unknown1;
		if (message.id != null && message.hasOwnProperty("id"))
			object.id = message.id;
		if (message.unknown3 != null && message.hasOwnProperty("unknown3"))
			object.unknown3 = message.unknown3;
		return object;
	};

	return Url;
})();

/* eslint-enable */

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/periodical/hgxb2019z1002",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "微波法制备生物柴油研究进展",
				"creators": [
					{
						"firstName": "",
						"lastName": "商辉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "丁禹",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张文慧",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019",
				"DOI": "10.11949/j.issn.0438?1157.20181400",
				"ISSN": "0438-1157",
				"abstractNote": "基于微波的选择性、瞬时性及体积性加热的特点,可以有效提高反应分子的平均能量、分子的碰撞频率,加快反应速率,采用微波辅助催化酯交换反应制备生物柴油近几年得到了国内外学者的广泛关注.将微波能应用于生物柴油制备过程具有显著的优势,与传统加热方式相比,采用微波辐射加热,反应时间明显缩短,产物组成也有所变化.因此主要从酸碱催化剂催化酯交换反应和酯化反应的角度,综述了国内外对微波辅助生物柴油制备的研究进展,并对微波优势及未来发展趋势进行了展望.",
				"extra": "CLC: TQ51(燃料化学工业（总论）)",
				"issue": "z1",
				"libraryCatalog": "Wanfang Data",
				"pages": "15-22",
				"publicationTitle": "化工学报",
				"url": "https://d.wanfangdata.com.cn/periodical/hgxb2019z1002",
				"volume": "70",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "催化剂"
					},
					{
						"tag": "微波"
					},
					{
						"tag": "生物柴油"
					},
					{
						"tag": "酯交换"
					},
					{
						"tag": "酯化"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/thesis/D01698671",
		"defer": true,
		"items": [
			{
				"itemType": "thesis",
				"title": "济南市生物多样性评价及与生物入侵关系研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "孟令玉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "曲爱军",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2019",
				"abstractNote": "生物多样性是我国生态环境的重要组成部分，也是生态文明建设的重要内容。如何更合理的建立评价生物多样性体系及确定威胁生物多样性相关因素，对政府科学制定生物多样性保护战略规划及行动计划极其重要，对生态文明建设具有重要意义。同时，生物多样性是一种资源，是生物资源的基础，具有多种多样的生态和环境服务功能。 通过济南市生物多样性现状评价，可明确济南市生物多样性现状、威胁因素和保护现状，有助于济南市资源有效利用与保护，以及相关政府部门科学的制定生物多样性保护战略与具体行动计划。本研究依据环保部生物多样性省域评价体系，组建了暖温带生物多样...",
				"extra": "major: 植物保护\nCLC: X176(环境生物学)",
				"libraryCatalog": "Wanfang Data",
				"thesisType": "硕士学位论文",
				"university": "山东农业大学",
				"url": "https://d.wanfangdata.com.cn/thesis/D01698671",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "生物入侵"
					},
					{
						"tag": "生物多样性"
					},
					{
						"tag": "评价指标体系"
					},
					{
						"tag": "资源利用"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/conference/9534067",
		"defer": true,
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "生物发酵提高芦笋汁生物利用率研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "吴晓春",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "黄惠华",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018-12-04",
				"abstractNote": "本研究在单因素试验的基础上通过响应面法优化安琪酵母发酵芦笋汁生产工艺,以芦笋汁中总皂苷元含量作为响应值,各影响因素为自变量,设计响应面实验方案.结果表明一次项X1(接种量)、X2(发酵温度)、X3(发酵时间)和所有因素的二次项都达到了极显著水平(P<0.01).并得到安琪酵母发酵芦笋汁的最优生产工艺条件:利用R2A琼脂作为基础培养基接种量0.2％、发酵温度30℃、发酵时间7天.在此条件下重复实验3次,整理结果可知芦笋总皂苷元含量可达到(361.68±8.62)μg.",
				"conferenceName": "2018年广东省食品学会年会",
				"extra": "organizer: 广东省食品学会\nCLC: TS275.5(食品工业)",
				"libraryCatalog": "Wanfang Data",
				"pages": "69-74",
				"place": "广州",
				"proceedingsTitle": "2018年广东省食品学会年会论文集",
				"url": "https://d.wanfangdata.com.cn/conference/9534067",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "总皂苷元含量"
					},
					{
						"tag": "生物利用率"
					},
					{
						"tag": "生物发酵"
					},
					{
						"tag": "芦笋汁"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/patent/CN201880013080.0",
		"defer": true,
		"items": [
			{
				"itemType": "patent",
				"title": "生物体签名系统及生物体签名方法",
				"creators": [
					{
						"firstName": "",
						"lastName": "加贺阳介",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "高桥健太",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "藤尾正和",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈伟",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "沈静",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					}
				],
				"issueDate": "2019-10-11",
				"abstractNote": "生物体签名系统保持将从用户的部位得到的第一生物体信息转换而得到的第一模板和通过单向性转换将从该用户的该部位得到的第二生物体信息进行转换而得到的第二模板，根据认证对象的第一生物体信息生成第一模板，对使用参数修正后的认证对象的第一模板与生物体签名系统保持的第一模板之间的相似度高的该参数进行特定，分别根据分别使用包括该特定出的参数在内的规定范围所包括的参数修正后的认证对象的第二生物体信息，生成第二模板，并将该生成的第二模板分别与生物体签名系统保持的第二模板进行比较来判定认证对象的认证成功与否。",
				"applicationNumber": "CN201880013080.0",
				"assignee": "株式会社日立制作所",
				"country": "中国",
				"extra": "genre: 发明专利\nCLC: H04L9/32(2006.01)G06F21/32(2013.01)H04L9/32G06F21/32",
				"filingDate": "2018-02-14",
				"legalStatus": "授权",
				"patentNumber": "CN110326254B",
				"place": "中国",
				"priorityNumbers": "2017-114023 2017.06.09 JP",
				"rights": "1.一种生物体签名系统，其特征在于， 包括处理器和存储器， 所述存储器保持第一模板和第二模板，该第一模板表示通过规定的转换将从用户的规定部位得到的第一生物体信息进行转换后的结果，该第二模板表示通过规定的单向性转换将从所述用户的所述规定部位得到的第二生物体信息进行转换后的结果， 所述处理器进行以下处理： 获取认证对象的所述第一生物体信息和所述第二生物体信息， 根据获取到的所述第一生物体信息生成所述认证对象的第一模板， 对使用参数修正后的所述认证对象的第一模板与所述存储器保持的第一模板之间的相似度比规定条件高的所述参数进行特定， 分别使用包括特定出的所述参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息， 分别根据修正后的所述第二生物体信息生成所述认证对象的第二模板， 将生成的所述第二模板分别与所述存储器保持的第二模板进行比较来判定所述认证对象的认证成功与否。 2.根据权利要求1所述的生物体签名系统，其特征在于， 所述处理器通过所述规定的转换对获取到的所述第一生物体信息进行转换而生成所述认证对象的第一模板。 3.根据权利要求1所述的生物体签名系统，其特征在于， 所述处理器通过所述规定的单向性转换对修正后的所述第二生物体信息分别进行转换而生成所述认证对象的第二模板。 4.根据权利要求1所述的生物体签名系统，其特征在于， 储存于所述存储器内的第一生物体信息与第二生物体信息的相关系数为规定值以下。 5.根据权利要求1所述的生物体签名系统，其特征在于， 所述参数包括所述第一模板及所述第二模板的修正中的、表示平行移动量的参数和表示旋转量的参数。 6.根据权利要求1所述的生物体签名系统，其特征在于， 所述存储器保持多个用户的第一模板和第二模板， 所述处理器进行以下处理： 对与所述存储器保持的多个第一模板中的、存在所述相似度比规定条件高的所述参数的第一模板对应的用户群进行特定， 关于特定出的所述用户群的每个用户，分别使用包括特定出的参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息并生成第二模板，并且将该生成的第二模板分别与该用户的第二模板进行比较， 基于分别针对特定出的所述用户群的比较结果来判定所述认证对象的认证成功与否。 7.一种生物体签名方法，由生物体签名系统进行生物体签名，其特征在于， 所述生物体签名系统保持第一模板和第二模板，该第一模板表示通过规定的转换将从用户的规定部位得到的第一生物体信息进行转换后的结果，该第二模板表示通过规定的单向性转换将从所述用户的所述规定部位得到的第二生物体信息进行转换后的结果， 在所述方法中，所述生物体签名系统进行以下处理： 获取认证对象的所述第一生物体信息和所述第二生物体信息， 根据获取到的所述第一生物体信息生成所述认证对象的第一模板， 对使用参数修正后的所述认证对象的第一模板与所述生物体签名系统保持的第一模板之间的相似度比规定条件高的所述参数进行特定， 分别使用包括特定出的所述参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息， 分别从修正后的所述第二生物体信息生成所述认证对象的第二模板， 将生成的所述第二模板分别与所述生物体签名系统保持的第二模板进行比较来判定所述认证对象的认证成功与否。 8.根据权利要求7所述的方法，其特征在于， 在所述方法中，所述生物体签名系统通过所述规定的转换对获取到的所述第一生物体信息进行转换而生成所述认证对象的第一模板。 9.根据权利要求7所述的方法，其特征在于， 在所述方法中，所述生物体签名系统通过所述规定的单向性转换对修正后的所述第二生物体信息分别进行转换而生成所述认证对象的第二模板。 10.根据权利要求7所述的方法，其特征在于， 储存于所述生物体签名系统内的第一生物体信息与第二生物体信息的相关系数为规定值以下。 11.根据权利要求7所述的方法，其特征在于， 所述参数包括所述第一模板及所述第二模板的修正中的、表示平行移动量的参数和表示旋转量的参数。 12.根据权利要求7所述的方法，其特征在于， 所述生物体签名系统保持多个用户的第一模板和第二模板， 在所述方法中，所述生物体签名系统进行以下处理： 对与所述生物体签名系统保持的多个第一模板中的、存在所述相似度比规定条件高的所述参数的第一模板对应的用户群进行特定， 关于特定出的所述用户群的每个用户，分别使用包括特定出的参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息并生成第二模板，并且将该生成的第二模板分别与该用户的第二模板进行比较， 基于分别针对特定出的所述用户群的比较结果来判定所述认证对象的认证成功与否。",
				"url": "https://d.wanfangdata.com.cn/patent/CN201880013080.0",
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
		"url": "https://d.wanfangdata.com.cn/nstr/09146D75-84AB-48CE-A321-369457FD6551",
		"defer": true,
		"items": [
			{
				"itemType": "report",
				"title": "人体安全重要技术标准研制最终报告",
				"creators": [
					{
						"firstName": "",
						"lastName": "汤万金",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨跃翔",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘文",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "郑建国",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王赟松",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2013-09-30",
				"abstractNote": "本研究通过制定我国人体安全急需的技术标准，解决影响我国人体安全的重点产品的技术标准缺失、滞后的问题，完善不安全产品召回制度相关管理标准，提高我国人体安全的整体水平，促进社会和谐稳定，促进企业技术创新和技术改造、实现产业结构调整、提高我国产品国际竞争力，保证经济健康持续发展。 1．从消费品安全的角度，构建了消费品安全标准体系，并制定了急需的消费品安全关键标准，满足有效控制消费品安全危害，提高产品安全水平，保障消费者健康和权益，推动产品行业持续健康发展。 2．通过电子电气产品中有毒有害物质的检测技术标准研究，结合之前完成的电子电气产...",
				"archiveLocation": "306--2013-007964",
				"extra": "project: 人体安全重要技术标准研制",
				"institution": "中国标准化研究院中国标准化研究院中国标准化研究院广东出入境检验检疫局中国标准化研究院",
				"language": "zh-CN",
				"libraryCatalog": "Wanfang Data",
				"reportType": "科技报告",
				"url": "https://d.wanfangdata.com.cn/nstr/09146D75-84AB-48CE-A321-369457FD6551",
				"attachments": [],
				"tags": [
					{
						"tag": "产品安全"
					},
					{
						"tag": "人身安全"
					},
					{
						"tag": "消费品"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/cstad/1500520180",
		"defer": true,
		"items": [
			{
				"itemType": "report",
				"title": "全钒液流电池储能技术及应用",
				"creators": [
					{
						"firstName": "",
						"lastName": "张华民",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "马相坤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李先锋",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘宗浩",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "高素军",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈剑",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015",
				"abstractNote": "该项目属于电化学储能技术领域。能源与环境是人类社会生存的两项基本要素。随着社会与经济的发展，人类对能源的需求量显著增加。化石能源的大量消耗，不仅造成了能源资源匮乏，还造成了严重的环境污染，也严重影响到了人们的身体健康。因此，普及应用可再生能源、提高其在能源消耗中的比重是实现社会可持续发展的必然选择。但是，风能、太阳能等可再生能源发电具有不稳定、不可控的特性，可再生能源大规模并入电网会给电网的安全稳定运行带来严重的冲击。大规模储能系统可有效实现可再生能源发电的调幅调频、平滑输出、跟踪计划发电，提高电网对可再生能源发电的消纳能力，解决弃风、弃光问题，因此是国家实现能源安全、经济可持续发展的重大需求。储能和大容量储能技术是国家《能源发展战略行动计划（2014-2020)》中的重点创新领域和重点创新方向之一。全钒液流电池储能技术具有储能系统的输出功率和储能容量相互独立、储能规模大、设计和安置灵活，使用寿命长，安全可靠，材料和部件可循环利用、环境友好等突出的优势，成为规模储能的首选技术之一。通过多年创新性的研究开发，在液流电池离子传导膜、电极双极板、电解液制造，大功率电堆设计集成，大规模储能系统集成控制等方面取得了一系列技术发明和创新，形成了具有完整自主知识产权体系的全钒液流电池储能技术。1.突破了液流电池关键材料包括非氟离子传导膜、液流电池双极板的制备技术，原创性的研制成功液流电池用高选择性、高传导性、高稳定性非氟多孔离子传导膜，高导电性、高稳定性碳素复合双极板材料。突破了关键材料的规模放大技术，实现了关键材料的工业生产。2.突破了全钒液流电池电堆的设计集成技术，发明了大功率、高功率密度电堆结构设计方法和制造技术，设计集成出32千瓦大功率液流电池单体电堆，突破了单体电堆工程化制造技术，实现了批量化生产，并向国外出口。3.突破了高功率、大容量、高集成度全钒液流电池储能系统设计方法及多体系耦合控制技术，发明了大规模储能系统控制管理策略，实施了迄今为止世界上最大规模的5MW/10MWh全钒液流电池储能系统的商业化应用工程，率先实现了液流电池储能技术的产业化。该项目共获授权发明专利28件，其中日本专利1件。2008年完成国内首套100kW系统的示范应用，2012年完成全球最大规模5MW/10MWh全钒液流电池商业化示范工程，技术指标和工业化进程均处于国际领先水平。已实施20余套应用示范项目。领军能源行业、国家及国际液流电池标准的制定，起草了3项行业标准，5项国家标准和1项国际标准。通过该技术成果的应用，2012年实现销售收入4613万元，2013年销售收入4249万元，2014年销售收入4369万元。对推进中国可再生能源发电的普及应用，实现节能减排重大国策具有十分重要的意义。",
				"extra": "CLC: TM911.3(独立电源技术（直接发电）)",
				"institution": "中国科学院大连化学物理研究所大连融科储能技术发展有限公司",
				"language": "zh-CN",
				"libraryCatalog": "Wanfang Data",
				"reportNumber": "1500520180",
				"reportType": "成果报告",
				"url": "https://d.wanfangdata.com.cn/cstad/1500520180",
				"attachments": [],
				"tags": [
					{
						"tag": "储能系统"
					},
					{
						"tag": "全钒液流电池"
					},
					{
						"tag": "单体电堆"
					},
					{
						"tag": "可再生能源发电"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/standard/ChRTdGFuZGFyZE5ld1MyMDI0MDMyMBIOR0IvVCA3NzE0LTIwMTUaCGZlYnc3YTd3?transaction=%7B%22id%22%3A%22%22,%22transferOutAccountsStatus%22%3A%5B%5D,%22transaction%22%3A%7B%22id%22%3A%221884571522132209664%22,%22status%22%3A1,%22createDateTime%22%3A1738151839179,%22payDateTime%22%3A1738151839179,%22authToken%22%3A%22TGT-339072-wK5gGSNT00XbAevIb7VfQcXiBKEAHShVXTklExGNX3OJ6SdBcb-auth-iploginservice-557b48647-sbpx7%22,%22user%22%3A%7B%22accountType%22%3A%22Group%22,%22key%22%3A%22Yikedaxue%22%7D,%22transferIn%22%3A%7B%22accountType%22%3A%22Income%22,%22key%22%3A%22StandardDigest%22%7D,%22transferOut%22%3A%7B%22GTimeLimit.Yikedaxue%22%3A1.0%7D,%22turnover%22%3A1.0,%22orderTurnover%22%3A1.0,%22productDetail%22%3A%22Standard_GB%2FT%207714-2015%22,%22productTitle%22%3A%22%E4%BF%A1%E6%81%AF%E4%B8%8E%E6%96%87%E7%8C%AE%20%20%E5%8F%82%E8%80%83%E6%96%87%E7%8C%AE%E8%91%97%E5%BD%95%E8%A7%84%E5%88%99%22,%22userIP%22%3A%22116.11.70.137%22,%22organName%22%3A%22%E7%A6%8F%E5%BB%BA%E5%8C%BB%E7%A7%91%E5%A4%A7%E5%AD%A6%22,%22memo%22%3A%22%7B%5C%22expired%5C%22%3A%5C%221800%5C%22%7D%22,%22orderUser%22%3A%22Yikedaxue%22,%22orderChannel%22%3A%22pc%22,%22payTag%22%3A%22Shibboleth%22,%22webTransactionRequest%22%3A%22%22,%22signature%22%3A%22VmfpcNDZ4%2FOJleFm6LQtSSdhjpOpjSI84hmJfCZKPOakLV6ueExBWnmut7khcDrPwtfbbHCVhNLE%5CnKKK9ZsnNSDTmm9kXoP2luwVSuQVP2HlZzo2B0XQNTdqVpXA5165fD7kIBX31UmWya3fxVUcziPSP%5CnDnLn%2BbRezOQxdXNvq58%3D%22%7D,%22isCache%22%3Afalse%7D",
		"defer": true,
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献　参考文献著录规则",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国信息与文献标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-05-15",
				"abstractNote": "本标准规定了各个学科、各种类型信息资源的参考文献的著录项目、著录顺序、著录用符号、著录用文字、各个著录项目的著录方法以及参考文献在正文中的标注法。 本标准适用于著者和编辑著录参考文献，而不是供图书馆员、文献目录编制者以及索引编辑者使用的文献著录规则。",
				"extra": "ICS: 0101.140.20\napplyDate: 2015-12-01\nsubstitute: 该标准替代了如下标准： GB/T 7714-2005;\nreference: GB/T 7408-2005GB/T 28039-2011ISO 4\nadopted: ISO 690:2010(E);",
				"libraryCatalog": "Wanfang Data",
				"number": "GB/T 7714—2015",
				"publisher": "质检出版社",
				"status": "现行",
				"url": "https://d.wanfangdata.com.cn/standard/GB/T 7714-2015",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "书目标准"
					},
					{
						"tag": "参考文献"
					},
					{
						"tag": "规则"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/claw/G001007091",
		"defer": true,
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中华人民共和国刑法修正案（十一）",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国人大常委会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2020-12-26",
				"extra": "applyDate: 2021-03-01",
				"publicLawNumber": "中华人民共和国主席令[2020]第66号",
				"shortTitle": "刑法修正案（十一）",
				"url": "https://d.wanfangdata.com.cn/claw/G001007091",
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
		"url": "https://d.wanfangdata.com.cn/claw/g100001548",
		"defer": true,
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "最高人民法院、最高人民检察院关于依法严惩破坏计划生育犯罪活动的通知",
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
				"extra": "type: regulation\nstatus: 已废止\napplyDate: 1993-11-12",
				"publicLawNumber": "法发[1993]第36号",
				"url": "https://d.wanfangdata.com.cn/claw/g100001548",
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
		"url": "https://d.wanfangdata.com.cn/claw/G000286112",
		"defer": true,
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中华人民共和国公司法",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国人民代表大会常务委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2018-10-26",
				"extra": "Edition: 2018修正\napplyDate: 2018-10-26",
				"publicLawNumber": "主席令[2018]第15号",
				"shortTitle": "公司法",
				"url": "https://d.wanfangdata.com.cn/claw/G000286112",
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
		"url": "https://s.wanfangdata.com.cn/paper?q=%E9%A3%8E%E6%B9%BF&p=1",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://sns.wanfangdata.com.cn/perio/gclx",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://c.wanfangdata.com.cn/nstr",
		"defer": true,
		"items": "multiple"
	}
]
/** END TEST CASES **/
