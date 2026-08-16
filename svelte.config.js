import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Site 100 % statique : le produit EST une URL (cf. design doc, Distribution Plan)
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;
