// Shared constants for Zotero translator CI and CLI tools.
// Used by .ci/pull-request-check/ and .bin/

// Public key used to derive the stable Chrome extension ID during development builds.
export const CHROME_EXTENSION_KEY = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDllBS5q+Z9T9tPgYwRN+/8T9wzyjo9tRo03Wy8zP2DQ5Iy+3q0Tjq2vKXGiMCxC/ZVuEMC68Ekv+jNT43VxPbEXI4dzpK1GMBqPJpAcEOB8B1ROBouQMbGGTG7fOdQVlmpdTTPVndVwysJ02CrDMn96IG2ytOq2PO7GR2xleCudQIDAQAB';

// The extension ID derived from the key above.
export const EXTENSION_ID = 'ekhagklcjbdpajgpjgmbionohlpdbjgc';

// Translator server URL used during connector builds and tests.
export const TRANSLATOR_SERVER_URL = 'http://localhost:8085/';

// Environment variables to set before building the connector.
export const CONNECTOR_BUILD_ENV = {
	ZOTERO_REPOSITORY_URL: TRANSLATOR_SERVER_URL,
	ZOTERO_ALWAYS_FETCH_FROM_REPOSITORY: '1',
	CHROME_EXTENSION_KEY,
};
