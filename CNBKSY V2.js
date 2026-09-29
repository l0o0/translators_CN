{
	"translatorID": "a3b4c5d6-e7f8-4a90-bcde-f12345678901",
	"label": "CNBKSY V2",
	"creator": "Daxoel",
	"target": "^https?://(www\\.)?cnbksy\\.com/v2",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 90,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-08-18 10:53:57"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 4965898

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
	// 详情页：期刊文章 / 报纸文章
	if (url.includes('/v2/search/detail')) {
		if (doc.querySelector('.root_detail .line_data')) {
			// 区分期刊与报纸：报纸有"标题1"字段，期刊有"题名"字段
			let dts = doc.querySelectorAll('.line_data dt.lefttitle');
			for (let dt of dts) {
				if (/标题1/.test(dt.textContent)) {
					return 'newspaperArticle';
				}
			}
			return 'journalArticle';
		}
		// SPA 未渲染完，监控 DOM 变化
		Z.monitorDOMChanges(doc.body, { childList: true, subtree: true });
		return false;
	}
	// 搜索结果页
	else if (url.match(/\/v2\/search(\/ordinary)?(\?|$)/)) {
		if (doc.querySelector('tr.ant-table-row[data-row-key]')) {
			return 'multiple';
		}
		Z.monitorDOMChanges(doc.body, { childList: true, subtree: true });
		return false;
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('tr.ant-table-row[data-row-key]');
	for (const row of rows) {
		const id = row.getAttribute('data-row-key');
		const titleEl = row.querySelector('.titleBox a.cpHover');
		if (!id || !titleEl) continue;
		// textContent 自动忽略 <font class="highLight"> 标签，拼接出纯文本标题
		const title = ZU.trimInternal(titleEl.textContent);
		if (!title) continue;
		if (checkOnly) return true;
		found = true;
		// 用 data-row-key 作为 key（scrapeFromSearch 会用 id 反查 row）
		items[id] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		// SPA 页面 requestDocument 会拿到未渲染的外壳，改为直接从搜索结果页 DOM 提取元数据
		for (let id of Object.keys(items)) {
			scrapeFromSearch(doc, id);
		}
	}
	else {
		await scrape(doc, url);
	}
}

// 从搜索结果页 DOM 直接提取单条元数据（避免 SPA 外壳问题）
function scrapeFromSearch(doc, id) {
	const row = doc.querySelector(`tr.ant-table-row[data-row-key="${id}"]`);
	if (!row) return;
	const timeBox = row.querySelector('.timeBox');
	if (!timeBox) return;
	// timeBox 文本格式：
	//   期刊："作者 《刊名》 1922 年 [ 第1卷 第3期 ，1-2页 ]"
	//   报纸："作者 《报名》 1945 年 10 月 9 日 [0004版]"
	const timeText = ZU.trimInternal(timeBox.textContent);
	const bracket = tryMatch(timeText, /\[([^\]]*)\]/);

	let type;
	if (/卷.*期/.test(bracket)) {
		type = 'journalArticle';
	}
	else if (/版/.test(bracket)) {
		type = 'newspaperArticle';
	}
	else {
		// 默认按期刊处理
		type = 'journalArticle';
	}

	const newItem = new Z.Item(type);
	// 标题
	newItem.title = ZU.trimInternal(row.querySelector('.titleBox a.cpHover').textContent);
	// 作者与文献来源：遍历 .timeBox 内所有 cpHover 链接
	//   含《》的是文献来源
	//   含"卷/期/版/页"的是卷期信息，跳过
	//   其余是作者（多作者时第二个作者可能没有 authorMarginR class）
	//   若一个链接文本含空格分隔的多个名字，按空格拆分（需 DOM 确认）
	const cpHoverLinks = row.querySelectorAll('.timeBox a.cpHover');
	for (const link of cpHoverLinks) {
		const text = ZU.trimInternal(link.textContent);
		if (/[《》]/.test(text)) {
			// 文献来源
			newItem.publicationTitle = text.replace(/^《|》$/g, '').trim();
		}
		else if (/卷|期|版|页/.test(text)) {
			// 卷期信息，跳过
			continue;
		}
		else {
			// 作者（cleanAuthorElm 会处理后缀"译/记"等角色标记）
			newItem.creators.push(cleanAuthorElm(link));
		}
	}
	// 日期
	newItem.date = ZU.strToISO(tryMatch(timeText, /(\d{4}\s*年(\s*\d+\s*月(\s*\d+\s*日)?)?)/));

	if (type === 'journalArticle') {
		newItem.volume = tryMatch(bracket, /第?0*(\d+)卷/, 1);
		newItem.issue = tryMatch(bracket, /第?0*(\d+)期/, 1);
		newItem.pages = tryMatch(bracket, /([\d-.+]*)页/, 1).replace(/[+.]\s?/g, ', ');
	}
	else {
		// 版次格式："0004版" → "4"
		newItem.pages = tryMatch(bracket, /0*(\d+)版/, 1);
	}
	// PDF 附件：根据文章类型推断 lcPieceTypeId（期刊=7，报纸=12）
	// activeId 用 undefined（之前详情页测试确认非必需）
	const lcPieceTypeId = (type === 'journalArticle') ? '7' : '12';
	const pdfUrl = `https://${doc.location.host}/api/v2/literature/download?downloadSource=GENERALSEARCH&source=DOWNLOAD&lcPieceTypeId=${lcPieceTypeId}&pieceId=${id}&activeId=undefined`;
	newItem.attachments.push({
		title: 'Full Text PDF',
		mimeType: 'application/pdf',
		url: pdfUrl
	});
	newItem.url = `https://${doc.location.host}/v2/search/detail?Id=${id}`;
	newItem.complete();
}

async function scrape(doc, url = doc.location.href) {
	const labels = new Labels(doc, '.line_data');
	const type = detectWeb(doc, url);
	const newItem = new Z.Item(type);
	switch (type) {
		case 'journalArticle': {
			newItem.title = labels.get('题名');
			labels.get('作者', true).querySelectorAll('a.router_link').forEach((elm) => {
				newItem.creators.push(cleanAuthorElm(elm));
			});
			newItem.publicationTitle = labels.get('文献来源').replace(/^《|》$/g, '').trim();
			newItem.date = ZU.strToISO(labels.get('出版时间'));
			// 卷期格式："第1卷 第3期 ，1-2页"
			let volIssue = labels.get('卷期');
			newItem.volume = tryMatch(volIssue, /第?0*(\d+)卷/, 1);
			newItem.issue = tryMatch(volIssue, /第?0*(\d+)期/, 1);
			newItem.pages = tryMatch(volIssue, /([\d-.+]*)页/, 1).replace(/[+.]\s?/g, ', ');
			newItem.abstractNote = labels.get('摘要');
			let subjects = labels.get('主题词');
			if (subjects) {
				newItem.tags = subjects.slice(1, -1).split(/[,;，；]/)
					.map(element => ({ tag: element.trim() }))
					.filter(t => t.tag);
			}
			break;
		}
		case 'newspaperArticle': {
			newItem.title = labels.get('标题1');
			newItem.shortTitle = labels.get('标题2');
			newItem.publicationTitle = labels.get('文献来源').replace(/^《|》$/g, '').trim();
			newItem.date = ZU.strToISO(labels.get('出版时间'));
			// 版次格式："0002" → "2"
			newItem.pages = labels.get('版次').replace(/^0*/, '');
			labels.get('作者', true).querySelectorAll('a.router_link').forEach((elm) => {
				newItem.creators.push(cleanAuthorElm(elm));
			});
			break;
		}
	}
	// 详情页 URL 含完整参数，可构建 PDF 下载链接
	addAttachment(doc, newItem, url);
	newItem.url = url;
	newItem.complete();
}


// 从详情页 URL 构建 PDF 下载链接
// 详情页 URL: /v2/search/detail?Id={pieceId}&activeId={activeId}&LiteratureCategoryPieceTypeId={lcPieceTypeId}&...
// 下载 API:  /api/v2/literature/download?downloadSource=GENERALSEARCH&source=DOWNLOAD&lcPieceTypeId={...}&pieceId={...}&activeId={...}
function addAttachment(doc, item, url) {
	try {
		let u = new URL(url);
		let pieceId = u.searchParams.get('Id');
		let activeId = u.searchParams.get('activeId') || 'undefined';
		let lcPieceTypeId = u.searchParams.get('LiteratureCategoryPieceTypeId');
		if (!pieceId || !lcPieceTypeId) return;
		let pdfUrl = `https://${u.host}/api/v2/literature/download?downloadSource=GENERALSEARCH&source=DOWNLOAD&lcPieceTypeId=${lcPieceTypeId}&pieceId=${pieceId}&activeId=${activeId}`;
		item.attachments.push({
			title: 'Full Text PDF',
			mimeType: 'application/pdf',
			url: pdfUrl
		});
	}
	catch (e) {
		// URL 解析失败，忽略附件
	}
}


function cleanAuthorElm(elm) {
	// 作者链接文本可能含 &nbsp;，ZU.cleanAuthor 会处理
	// 后继文本节点可能标记角色：译→译者，记→ contributor
	let creatorType = 'author';
	if (elm.nextSibling && elm.nextSibling.nodeName == '#text') {
		let suffix = elm.nextSibling.textContent.trim();
		if (/^[译譯]$/.test(suffix)) {
			creatorType = 'translator';
		}
		else if (/^[记記]$/.test(suffix)) {
			creatorType = 'contributor';
		}
	}
	const creator = ZU.cleanAuthor(elm.textContent, creatorType);
	// 中文姓名不拆分姓/名
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.fieldMode = 1;
	}
	return creator;
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

// V2 字段解析：.line_data > dt.lefttitle + dd.right_content
class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		const nodes = doc.querySelectorAll(selector);
		for (const node of nodes) {
			const dt = node.querySelector('dt.lefttitle');
			const dd = node.querySelector('dd.right_content');
			if (!dt || !dd) continue;
			// 去除标签末尾的冒号（全角/半角）
			const key = dt.textContent.replace(/[：:]/g, '').trim();
			this.data.push([key, dd]);
		}
	}

	get(label, element = false) {
		if (Array.isArray(label)) {
			const results = label.map(aLabel => this.get(aLabel, element));
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

/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/
