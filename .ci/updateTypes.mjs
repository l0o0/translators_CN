#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';

const INDEX_D_TS_URL = new URL('../index.d.ts', import.meta.url);
const SCHEMA_JSON_URL = new URL('../../zotero-client/resource/schema/global/schema.json', import.meta.url);

const BEGIN_MARKER = '\t/* *** BEGIN GENERATED TYPES *** */';
const END_MARKER = '\t/* *** END GENERATED TYPES *** */';

async function updateIndexDTS() {
	let indexDTS = await readFile(INDEX_D_TS_URL, { encoding: 'utf8' });
	let schema = JSON.parse(await readFile(SCHEMA_JSON_URL));

	let typeItemTypes = '\ttype ItemTypes = {';
	let itemTypeTypes = '';
	let creatorTypes = new Set();

	for (let typeSchema of schema.itemTypes) {
		let itemType = typeSchema.itemType;
		if (['annotation', 'attachment', 'note'].includes(itemType)) {
			continue;
		}

		let itemTypeUppercase = itemType[0].toUpperCase() + itemType.substring(1) + 'Item';
		if (itemTypeUppercase == 'TvBroadcastItem') {
			itemTypeUppercase = 'TVBroadcastItem';
		}

		typeItemTypes += `\n\t\t"${itemType}": ${itemTypeUppercase},`;
		itemTypeTypes += `\n\n\ttype ${itemTypeUppercase} = {`;
		itemTypeTypes += `\n\t\titemType: "${itemType}";`;
		for (let { field } of typeSchema.fields) {
			itemTypeTypes += `\n\t\t${field}?: string;`
		}

		let creatorTypesJoined = typeSchema.creatorTypes.map(typeSchema => '"' + typeSchema.creatorType + '"').join(' | ');
		itemTypeTypes += `\n\n\t\tcreators: Creator<${creatorTypesJoined}>[];`;
		itemTypeTypes += '\n\t\tattachments: Attachment[];';
		itemTypeTypes += '\n\t\ttags: Tag[];';
		itemTypeTypes += '\n\t\tnotes: Note[];';
		itemTypeTypes += '\n\t\tseeAlso: string[];';
		itemTypeTypes += '\n\t\tcomplete(): void;';
		itemTypeTypes += '\n\n\t\t[key: string]: string;';
		itemTypeTypes += '\n\t};';

		for (let { creatorType } of typeSchema.creatorTypes) {
			creatorTypes.add(creatorType);
		}
	}
	typeItemTypes += '\n\t};'

	let typeCreatorType = '\n\ttype CreatorType =';
	for (let creatorType of Array.from(creatorTypes).sort()) {
		typeCreatorType += `\n\t\t| "${creatorType}"`;
	}
	typeCreatorType += ';';

	let beginIdx = indexDTS.indexOf(BEGIN_MARKER);
	let endIdx = indexDTS.indexOf(END_MARKER);
	if (beginIdx == -1 || endIdx == -1) {
		throw new Error('Could not find generated types section in index.d.ts');
	}

	indexDTS = indexDTS.substring(0, beginIdx) + BEGIN_MARKER + '\n'
		+ typeItemTypes
		+ itemTypeTypes
		+ '\n' + typeCreatorType
		+ '\n'
		+ indexDTS.substring(endIdx);

	await writeFile(INDEX_D_TS_URL, indexDTS);
}

updateIndexDTS();
