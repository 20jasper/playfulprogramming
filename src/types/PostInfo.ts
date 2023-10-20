import { Languages } from "types/index";

export interface RawPostInfo {
	title: string;
	published: string;
	authors?: string[];
	tags?: string[];
	license?: string;
	description?: string;
	edited?: string;
	collection?: string;
	order?: number;
	originalLink?: string;
	noindex?: boolean;
}

export interface PostInfo extends RawPostInfo {
	slug: string;
	authors: string[];
	tags: string[];
	path: string;
	locales: Languages[];
	locale: Languages;
	publishedMeta: string;
	editedMeta?: string;
	socialImg: string;
	bannerImg?: string;
	wordCount: number;
}

export interface PostHeadingInfo {
	// Title value
	value: string;
	// ID
	slug: string;
	depth: number;
}
