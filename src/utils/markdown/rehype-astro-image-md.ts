import { Root, Element } from "hast";
import { Plugin } from "unified";

import { h } from "hastscript";
import { visit } from "unist-util-visit";

import path from "path";

/**
 * They need to be the same `getImage` with the same `globalThis` instance, thanks to the "hack" workaround.
 */
import { getPicture } from "./get-picture-hack";
import { getImageSize } from "../get-image-size";
import { fileURLToPath } from "url";
import { getFullRelativePath } from "../url-paths";
import { getLargestSourceSetSrc } from "../get-largest-source-set-src";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAX_WIDTH = 768;
const MAX_HEIGHT = 768;

/**
 * parse a height/width attribute value (e.g. "20px" or "20") and
 * return the value in pixel units, or undefined if it cannot be
 * parsed.
 */
function getPixelValue(attr: unknown): number | undefined {
	const [, pxValue] = /^([0-9]+)(px)?$/.exec(attr + "") || [];
	return typeof pxValue !== "undefined" ? Number(pxValue) : undefined;
}

export const rehypeAstroImageMd: Plugin<[], Root> = () => {
	return async (tree, file) => {
		const imgNodes: Element[] = [];
		visit(tree, (node: Element) => {
			if (node.tagName === "img") {
				imgNodes.push(node);
			}
		});

		await Promise.all(
			imgNodes.map(async (node) => {
				const splitFilePath = path.dirname(file.path).split(path.sep);
				const slug = splitFilePath.at(-1);
				// "collections" | "blog"
				const parentFolder = splitFilePath.at(-2);

				const filePathDir = path.resolve(
					__dirname,
					`../../../public/content/${parentFolder}`,
					slug,
				);

				const rootFileDir = path.resolve(__dirname, `../../../public/`);

				const nodeSrc = node.properties.src as string;
				const nodeAlt = node.properties.alt as string;

				let src: string;
				if (nodeSrc.startsWith("/")) {
					src = nodeSrc;
				} else {
					src = getFullRelativePath(
						`/content/${parentFolder}/${slug}/`,
						nodeSrc,
					);
				}

				if (src.endsWith(".svg") || src.endsWith(".gif")) {
					node.properties.src = src;
					return;
				}

				// TODO: How should remote images be handled?
				const srcSize = getImageSize(nodeSrc, filePathDir, rootFileDir) || {
					height: undefined,
					width: undefined,
				};

				// TODO: Remote images?
				if (!srcSize.height || !srcSize.width) return;

				const imageRatio = srcSize.width / srcSize.height;

				const nodeWidth = getPixelValue(node.properties.width);
				const nodeHeight = getPixelValue(node.properties.height);

				const dimensions = { ...srcSize };
				if (nodeHeight) {
					dimensions.height = nodeHeight;
					dimensions.width = Math.floor(nodeHeight * imageRatio);
				} else if (nodeWidth) {
					dimensions.width = nodeWidth;
					dimensions.height = Math.floor(nodeWidth / imageRatio);
				}

				if (dimensions.height > MAX_HEIGHT) {
					dimensions.height = MAX_HEIGHT;
					dimensions.width = Math.floor(MAX_HEIGHT * imageRatio);
				}

				if (dimensions.width > MAX_WIDTH) {
					dimensions.width = MAX_WIDTH;
					dimensions.height = Math.floor(MAX_WIDTH / imageRatio);
				}

				const pictureResult = await getPicture({
					src: src,
					widths: [dimensions.width],
					formats: ["avif", "webp", "png"],
					aspectRatio: imageRatio,
					alt: nodeAlt || "",
				});

				let pngSource = {
					src: src,
					size: srcSize.width,
				};

				if (
					!(
						src.endsWith(".png") ||
						src.endsWith(".jpg") ||
						src.endsWith(".jpeg")
					)
				) {
					const originalPictureResult = await getPicture({
						src: src,
						widths: [srcSize.width],
						formats: ["png"],
						aspectRatio: imageRatio,
						alt: nodeAlt || "",
					});

					pngSource = originalPictureResult.sources.reduce(
						(prev, source) => {
							const largestSrc = getLargestSourceSetSrc(source.srcset);
							// select first option
							if (!prev) return largestSrc;
							// SVG first
							if (prev.src.endsWith(".svg")) return prev;
							if (largestSrc.src.endsWith(".svg")) return prev;
							// Prefer `w`
							if (prev.sizeType === "w" && largestSrc.sizeType === "x")
								return prev;
							if (largestSrc.sizeType === "w" && prev.sizeType === "x")
								return largestSrc;
							// Get the bigger of the two
							if (largestSrc.size > prev.size) return largestSrc;
							// Prefer PNG and JPG
							if (largestSrc.size === prev.size) {
								if (
									prev.src.endsWith(".webp") &&
									(largestSrc.src.endsWith(".png") ||
										largestSrc.src.endsWith(".jpg") ||
										largestSrc.src.endsWith(".jpeg"))
								)
									return largestSrc;
							}
							return prev;
						},
						null as ReturnType<typeof getLargestSourceSetSrc>,
					);
				}

				const sources = pictureResult.sources.map((attrs) => {
					return h("source", attrs);
				});

				const {
					height: _height,
					width: _width,
					src: _src,
					alt: _alt,
					["data-zoom-src"]: _dataZoomSrc,
					...rest
				} = node.properties;

				Object.assign(
					node,
					h("picture", {}, [
						...sources,
						h("img", {
							alt: node.properties.alt,
							loading: "lazy",
							decoding: "async",
							"data-zoom-src": pngSource.src,
							width: pictureResult.image.width,
							height: pictureResult.image.height,
							...rest,
						}),
					]),
				);
			}),
		);
	};
};
