{
	"translatorID": "e034d9be-c420-42cf-8311-23bca5735a32",
	"label": "百度学术",
	"creator": "l0o0<linxzh1989@gmail.com>",
	"target": "^https?://(www\\.)?xueshu\\.baidu\\.com/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2021-12-28 04:27:11"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2017 Philipp Zumstein

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



function getRefByIDs(ids, onDataAvailable) {
	if (!ids.length) return;
	let {url, paper} = ids.shift();
	let refUrl = `https://xueshu.baidu.com/u/citation?type=bib&paperid=${paper}`;
	ZU.doGet(refUrl, function(text) {
		// Z.debug(text);
		onDataAvailable(text, url);
		if (ids.length) {
			getRefByIDs(ids, onDataAvailable);
		}
	});
}


function getIDFromUrl(url) {
	let search = url.match(/paperid=(\w+)/);
	if (search) return {url: url, paper: search[1]};
	return false;
}

function detectWeb(doc, url) {
	if (url.includes('paperid=')) {
		return "journalArticle";
	}
	else if (getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('h3>a[href*="show?paperid="]');
	for (var i = 0; i < rows.length; i++) {
		var href = rows[i].href;
		var title = ZU.trimInternal(rows[i].textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}


function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		let ids = [];
		Zotero.selectItems(getSearchResults(doc, false, ids), function (items) {
			if (!items) {
				return;
			}
			var articles = [];
			for (var i in items) {
				ids.push(getIDFromUrl(i));
				articles.push(i);
			}
			scrape(doc, ids);
		});
	}
	else {
		scrape(doc, [getIDFromUrl(url)]);
	}
}


function scrape(doc, ids) {
	getRefByIDs(ids, function(text, url) {
		let translator = Z.loadTranslator("import");
		translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");  // Bible format
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, newItem) {
			newItem.url = url;
			if (doc.querySelector("p.abstract")) newItem.abstractNote = doc.querySelector("p.abstract").innerText.trim();
			if (doc.querySelector("p.kw_main")) {
				newItem.tags = doc.querySelector("p.kw_main").innerText.split("；");
			}
			Z.debug(newItem.abstractNote);
			Z.debug(newItem.tags);
			newItem.complete();
		});
		translator.translate();
	});
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://xueshu.baidu.com/s?wd=paperuri%3A%28b3ab239032d44d951d8eee26d7bc44bf%29&filter=sc_long_sign&sc_ks_para=q%3DZotero%3A%20information%20management%20software%202.0&sc_us=11047153676455408520&tn=SE_baiduxueshu_c1gjeupa&ie=utf-8",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Zotero: information management software 2.0",
				"creators": [
					{
						"lastName": "Fernandez",
						"firstName": "Peter",
						"creatorType": "author"
					}
				],
				"date": "2011",
				"abstractNote": "Purpose – The purpose of this paper is to highlight how the open-source bibliographic management program Zotero harnesses Web 2.0 features to make library resources more accessible to casual users without sacrificing advanced features. This reduces the barriers understanding library resources and provides additional functionality when organizing information resources. Design/methodology/approach – The paper reviews select aspects of the program to illustrate how it can be used by patrons and information professionals, and why information professionals should be aware of it. Findings – Zotero has some limitations, but succeeds in meeting the information management needs of a wide variety of users, particularly users who use online resources. Originality/value – This paper is of interest to information professionals seeking free software that can make managing bibliographic information easier for themselves and their patrons.",
				"issue": "4",
				"libraryCatalog": "Baidu Scholar",
				"pages": "5-7",
				"publicationTitle": "Library Hi Tech News",
				"shortTitle": "Zotero",
				"url": "http://www.emeraldinsight.com/doi/full/10.1108/07419051111154758",
				"volume": "28",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [
					{
						"tag": "Citation management"
					},
					{
						"tag": "Internet"
					},
					{
						"tag": "Library services"
					},
					{
						"tag": "Open source"
					},
					{
						"tag": "Reference management"
					},
					{
						"tag": "Technology"
					}
				],
				"notes": [],
				"seeAlso": [],
				"DOI": "10.1108/07419051111154758"
			}
		]
	},
	{
		"type": "web",
		"url": "http://xueshu.baidu.com/s?wd=paperuri%3A%2829fcf50a863692823c3f336a9ee1efea%29&filter=sc_long_sign&sc_ks_para=q%3DComparativo%20dos%20softwares%20de%20gerenciamento%20de%20refer%C3%AAncias%20bibliogr%C3%A1ficas%3A%20Mendeley%2C%20EndNote%20e%20Zotero&sc_us=1497086148200551335&tn=SE_baiduxueshu_c1gjeupa&ie=utf-8",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Comparativo dos softwares de gerenciamento de referências bibliográficas: Mendeley, EndNote e Zotero",
				"creators": [
					{
						"lastName": "Yamakawa",
						"firstName": "Eduardo Kazumi",
						"creatorType": "author"
					},
					{
						"lastName": "Kubota",
						"firstName": "Flávio Issao",
						"creatorType": "author"
					},
					{
						"lastName": "Beuren",
						"firstName": "Fernanda Hansch",
						"creatorType": "author"
					}
				],
				"date": "2014",
				"DOI": "10.1590/0103-37862014000200006",
				"abstractNote": "A elaboração de uma revisão bibliográfica confiável, a partir de trabalhos relevantes publicados anteriormente, é fundamental para evidenciar a originalidade e a contribuição científica dos trabalhos de pesquisa. Devido à grande quantidade de bases de dados e de publicações disponíveis, torna-se necessário utilizar ferramentas que auxiliem na gestão das referências bibliográficas de uma maneira fácil e padronizada. O objetivo deste artigo é examinar três de gerenciamento bibliográfico utilizados com frequência por pesquisadores acadêmicos, são eles: , e . Nesse sentido, buscou-se, em primeiro lugar, evidenciar seus principais benefícios e as possíveis dificuldades de utilização. Em segundo lugar, procurou-se comparar suas principais características por meio de uma pesquisa teórico-conceitual baseada em literatura especializada, o que permitiu utilizá-los e analisá-los de maneira crítica. Assim sendo, evidenciou-se as principais particularidades de cada e foi elaborado um quadro comparativo entre os mesmos. Considerando as características analisadas nos três , concluiu-se que todos, ao mesmo tempo em que facilitam o trabalho dos pesquisadores, possuem ferramentas que facilitam as buscas, a organização e a análise dos artigos.",
				"libraryCatalog": "Baidu Scholar",
				"publicationTitle": "Transinformação",
				"shortTitle": "Comparativo dos softwares de gerenciamento de referências bibliográficas",
				"url": "http://www.scielo.br/scielo.php?script=sci_arttext&amp;pid=S0103-37862014000200167&amp;lng=pt&amp;nrm=is",
				"attachments": [
					{
						"title": "Snapshot"
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
		"url": "http://xueshu.baidu.com/s?wd=zotero&rsv_bp=0&tn=SE_baiduxueshu_c1gjeupa&rsv_spt=3&ie=utf-8&f=8&rsv_sug2=0&sc_f_para=sc_tasktype%3D%7BfirstSimpleSearch%7D",
		"items": "multiple"
	}
]
/** END TEST CASES **/
