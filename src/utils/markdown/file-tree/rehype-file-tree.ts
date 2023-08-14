/**
 * This was taken from Astro docs:
 * https://github.com/withastro/docs/blob/83e4e7946933b468f857c76f8d4f9861e37d7059/src/components/internal/rehype-file-tree.ts
 *
 * But modified such that:
 * - It works with HTML comments
 * - You can attach metadata to files and folders
 * - It is required to use inline code blocks for files and folders names
 */
/**
 * Usage:
 * <!-- filetree:start -->
 * - `somedir/`
 * - `otherdir/`
 * 	   - `index.ts`
 * - `src/{open: false}`
 *     - `index.html`
 * - `index.css`
 * <!-- filetree:end -->
 */
import { toString } from "hast-util-to-string";
import type { Child as HChild } from "hastscript";
import { Element } from "hast";
import { visit } from "unist-util-visit";
import replaceAllBetween from "unist-util-replace-all-between";
import { Node } from "unist";
import JSON5 from "json5";
import { FileList, Directory, File } from "./file-list";
import { fromHtml } from "hast-util-from-html";

interface DirectoryMetadata {
	open?: boolean;
}

interface FileMetadata {}

export const rehypeFileTree = () => {
	return (tree) => {
		function replaceFiletreeNodes(nodes: Node[]) {
			const items: Array<Directory | File> = [];

			const isNodeElement = (node: unknown): node is Element =>
				typeof node === "object" && node["type"] === "element";

			function traverseUl(listNode: Element, listItems: typeof items) {
				if (listNode.children.length === 0) return;

				for (const listItem of listNode.children) {
					// Filter out `\n` text nodes
					if (!(isNodeElement(listItem) && listItem.tagName === "li")) continue;

					// Strip nodes that only contain newlines
					listItem.children = listItem.children.filter(
						(child) =>
							child.type === "comment" ||
							child.type !== "text" ||
							!/^\n+$/.test(child.value),
					);

					const [firstChild, ...otherChildren] = listItem.children;

					/**
					 * If a file or folder has an object at the end, assume it's a metadata object
					 * that we want to associate with the file or folder.
					 *
					 *  @eg: `folder/ {open: false}`
					 */
					let metadata: DirectoryMetadata & FileMetadata = {};

					visit({ type: "root", children: [firstChild] }, "text", (node) => {
						const match = node.value.match(/(.*)\s*({.*})\s*$/);
						if (match) {
							node.value = match[1];
							metadata = JSON5.parse(match[2]);
						}
					});

					const comment: HChild[] = [];
					if (firstChild.type === "text") {
						const [filename, ...fragments] = firstChild.value.split(" ");
						firstChild.value = filename;
						comment.push(fragments.join(" "));
					}
					const subTreeIndex = otherChildren.findIndex(
						(child) => child.type === "element" && child.tagName === "ul",
					);
					const commentNodes =
						subTreeIndex > -1
							? otherChildren.slice(0, subTreeIndex)
							: [...otherChildren];
					otherChildren.splice(
						0,
						subTreeIndex > -1 ? subTreeIndex : otherChildren.length,
					);
					comment.push(...commentNodes);

					const firstChildTextContent = toString(firstChild as never);

					// Decide a node is a directory if it ends in a `/` or contains another list.
					const directoryNode = otherChildren.find(
						(child) => child.type === "element" && child.tagName === "ul",
					);

					const isDirectory =
						/\/\s*$/.test(firstChildTextContent) || directoryNode;

					const isPlaceholder = /^\s*(\.{3}|…)\s*$/.test(firstChildTextContent);

					const isHighlighted =
						firstChild.type === "element" && firstChild.tagName === "strong";
					const hasContents = otherChildren.length > 0;

					const fileExtension = directoryNode
						? "dir"
						: firstChildTextContent.trim().split(".").pop() || "";

					// It's a file, there's no sub-tree
					if (!isDirectory) {
						listItems.push({
							isDirectory: false,
							name: firstChild,
							filetype: fileExtension,
							comment,
							isHighlighted,
							isPlaceholder,
							...(metadata as {}),
						});
						continue;
					}

					const dirItems: Array<File | Directory> = [];
					listItems.push({
						isDirectory: true,
						name: firstChild,
						isHighlighted,
						items: dirItems,
						comment,
						// Overwritten by `metadata.openByDefault` if it exists
						openByDefault: metadata?.open ?? hasContents,
					});

					if (!hasContents) {
						dirItems.push({
							isDirectory: false,
							name: fromHtml("..."),
							filetype: "",
							isHighlighted: false,
							isPlaceholder: true,
						});
					}

					if (!isNodeElement(directoryNode)) continue;
					traverseUl(directoryNode, dirItems);
				}
			}

			const list = nodes.find(
				(node) => isNodeElement(node) && node.tagName === "ul",
			) as Element;

			if (!list) throw "No list found in filetree";

			traverseUl(list, items);

			return [FileList({ items })];
		}

		replaceAllBetween(
			tree,
			{ type: "raw", value: "<!-- filetree:start -->" } as never,
			{ type: "raw", value: "<!-- filetree:end -->" } as never,
			replaceFiletreeNodes,
		);
		replaceAllBetween(
			tree,
			{ type: "comment", value: " filetree:start " } as never,
			{ type: "comment", value: " filetree:end " } as never,
			replaceFiletreeNodes,
		);
	};
};
