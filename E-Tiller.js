/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai23@gmail.com

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

const WEBTYPE = [
	{
		name: 'table_richsapn',
		pagekey: 'table.front_table #Author',
		issingle: true
	},
	// 缺失关键信息，无法解析
	// {
	// 	name: 'table_lessspan',
	// 	pagekey: '#QueryUI td > table td > table:nth-child(1) td > table tr:nth-child(4) > td > table #FileTitle',
	// 	issingle: true
	// },
	{
		name: 'exportable',
		pagekey: '#ExportUrl',
		issingle: true
	},
	{
		name: 'view_abstract',
		pagekey: 'a[href*="reader/view_abstract.aspx?file_no="]',
		issingle: false
	},
	{
		name: 'artical_abstract',
		pagekey: 'a[href*="/article/abstract/"]',
		issingle: false
	}
];

function detectWeb(doc, _url) {
	var atts = [
		'class',
		'id'
	];
	let insite = atts.some((element) => {
		let foots = Array.from(doc.querySelectorAll(`div[${element}*="foot"]`));
		return foots.some(foot => (foot.innerText.match(/(技术支持)?.*北京勤云科技发展有限公司/)));
	});
	if (!insite) return false;
	let validtype = WEBTYPE.find(element => (
		doc.querySelector(element.pagekey)
	));
	// Z.debug(`detect type as\n${JSON.stringify(validtype)}`);
	if (!validtype) return false;
	if (validtype.issingle) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, validtype, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, type, checkOnly) {
	var items = {};
	var found = false;
	let tempRows = Array.from(doc.querySelectorAll(type.pagekey));
	var rows = tempRows.filter(element => (!(element.textContent.startsWith('摘要'))));
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
		// Z.debug(`add\n${href}\n${title}\nas item`);
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	let validtype = WEBTYPE.find(element => (
		doc.querySelector(element.pagekey)
	));
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, validtype, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			await doWeb(await requestDocument(url), url);
		}
	}
	else {
		switch (validtype.name) {
			case 'table_richsapn':
				await scrapeElement(doc, url);
				break;
			case 'exportable':
				await scrapeRis(doc, url);
				break;
			default:
				break;
		}
	}
}

const TABLEIDMAP = {
	title: { path: '#FileTitle' },
	titleTranslation: { path: '#EnTitle' },
	abstractNote: { path: '#Abstract' },
	abstractTranslation: { path: '#EnAbstract' },
	publicationTitle: {
		path: '#ReferenceText',
		callback: function (text) {
			text = text.split('.').split(',')[0];
			return text;
		}
	},
	volume: {
		path: '#ReferenceText',
		callback: function (text) {
			text = text.split('.')
			.pop().split(',')
			.pop();
			return text.match(/\d+(?=())/)[0];
		}
	},
	issue: {
		path: '#ReferenceText',
		callback: function (text) {
			text = text.split('.').pop().split(',')
			.pop();
			return text.match(/\(\d+\)/)[0].slice(1, -1);
		}
	},
	pages: {
		path: '#ReferenceText',
		callback: function (text) {
			return text.split(':').pop();
		}
	},
	date: {
		path: '#ReferenceText',
		callback: function (text) {
			return text.split('.').pop().split(',')[0];
		}
	},
	DOI: { path: '#DOI' },
	creators: {
		path: '#Author > table tr td:first-of-type',
		multiple: true,
		callback: function (arr) {
			if (arr[0] == '作者') arr.shift();
			arr = arr.map(element => (element.replace(/\d/g, '')));
			arr = cleanArr(arr);
			arr = arr.filter(element => (element.length > 1));
			return arr.map(element => (matchCreator(element)));
		}
	},
	tags: {
		path: '#KeyWord a',
		multiple: true,
		callback: function (arr) {
			arr = cleanArr(arr);
			return arr.map(keyword => (
				{ tag: keyword }
			));
		}
	}
};

function cleanArr(arr) {
	let seprator = /[,，；;]\s?/;
	if (arr.length == 1 && arr[0].match(seprator)) {
		arr = arr[0].split(seprator);
	}
	return arr;
}

function matchCreator(creator) {
	// Z.debug(creators);
	if (/[A-Za-z]/.test(creator)) {
		creator = ZU.cleanAuthor(creator, "author");
	}
	else {
		creator = creator.replace(/\s/g, '');
		creator = {
			lastName: creator,
			creatorType: "author",
			fieldMode: 1
		};
	}
	return creator;
}

async function scrapeElement(doc, url = doc.location.href) {
	var newItem = new Z.Item('journalArticle');
	for (const field in TABLEIDMAP) {
		const recipe = TABLEIDMAP[field];
		// Z.debug(`for ${field}, use selector path ${recipe.path}`);
		var result;
		try {
			if (recipe.multiple) {
				result = Array.from(doc.querySelectorAll(recipe.path)).map(
					element => (element.innerText)
				);
			}
			else {
				result = doc.querySelector(recipe.path);
				result = result.innerText;
			}
			if (recipe.callback) {
				result = recipe.callback(result);
			}
			// Z.debug(`return result:`);
			// Z.debug(result);
		}
		catch (error) {
			result = "";
		}
		newItem[field] = result;
	}
	// 有些网页加载异常就会获取不到标题，只能用英文标题暂替
	if (newItem.title == '') newItem.title = newItem.titleTranslation;
	var pdfURL = doc.querySelector('#URL').href;
	newItem.attachments.push({
		url: pdfURL,
		title: 'Full Text PDF',
		mimeType: 'application/pdf'
	});
	newItem.attachments.push({
		url: url,
		title: 'Snapshot',
		mimeType: 'text/html'
	});
	newItem.complete();
}

const METAMAP = {
	volume: {
		tag: 'name',
		value: 'citation_volume'
	},
	issue: {
		tag: 'name',
		value: 'citation_issue'
	},
	date: {
		tag: 'name',
		value: 'citation_date'
	},
	journalAbbreviation: {
		tag: 'name',
		value: 'citation_journal_abbrev'
	},
	language: {
		tag: 'http-equiv',
		value: 'Content-Language'
	},
	ISSN: {
		tag: 'name',
		value: 'citation_issn'
	},
	firstpage: {
		tag: 'name',
		value: 'citation_firstpage'
	},
	lastpage: {
		tag: 'name',
		value: 'citation_lastpage'
	}
};

async function scrapeRis(doc, url = doc.location.href) {
	var risURL = doc.querySelector('#ExportUrl').href.split('/');
	let id = risURL.pop();
	risURL = risURL.join('/');
	// Z.debug(risURL);
	let pdfURL = doc.querySelector('#PdfUrl').href;
	// Z.debug(pdfURL);
	let risText = await requestText(
		risURL,
		{
			method: 'POST',
			body: `export_type=ris&include_content=2&article_list=${id}&action_type=export`
		});
	let translator = Zotero.loadTranslator('import');
	translator.setTranslator('32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7'); // RIS
	translator.setString(risText);
	translator.setHandler('itemDone', (_obj, item) => {
		for (const field in METAMAP) {
			const recipe = METAMAP[field];
			let result;
			try {
				result = doc.querySelector(`head > meta[${recipe.tag}="${recipe.value}"]`).content;
			}
			catch (error) {
				result = '';
			}
			// Z.debug(`in field ${field},`)
			// Z.debug(`we already have:\n${item[field]}`);
			// Z.debug(`and now we get from meta:\n${result}`);
			if (!item[field] && result) {
				item[field] = result;
			}
		}
		item.creators = item.creators.map((creator) => {
			if (!/[A-Za-z]/.test((creator).lastName)) {
				return matchCreator((creator).lastName);
			}
			return (creator);
		});
		item.pages = (function () {
			let firstpage = item.firstpage;
			let lastpage = item.lastpage;
			delete item.firstpage;
			delete item.lastpage;
			if (firstpage && lastpage) {
				return `${firstpage}-${lastpage}`;
			}
			else if (firstpage || lastpage) {
				return [firstpage, lastpage].find(page => (page));
			}
			else {
				return '';
			}
		})();
		item.language = (['zh', 'zh-cn'].includes(item.language)) ? 'zh-CN' : 'en-US';
		item.attachments.push({
			url: pdfURL,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
		item.attachments.push({
			url: url,
			title: 'Snapshot',
			mimeType: 'text/html'
		});
		item.complete();
	});
	await translator.translate();
}


