import { generateHTML } from '@tiptap/html';
import type { Editor } from '@tiptap/react';
import { getEditorExtensions } from './extensions';
import type { ProseMirrorJSON } from './persistence';

/**
 * Converts ProseMirror JSON to HTML string
 * Used when saving content to the API
 */
export function convertJSONToHTML(json: ProseMirrorJSON): string {
  const extensions = getEditorExtensions();
  return generateHTML(json, extensions);
}

/**
 * Checks if editor content is empty
 * Returns true if editor has no meaningful content
 */
export function hasTextContent(editor: Editor): boolean {
  const json = editor.getJSON();

  function checkNode(node: ProseMirrorJSON): boolean {
    if (
      node.type === 'text' &&
      node.text &&
      (node.text as string).trim().length > 0
    ) {
      return true;
    }
    if (node.content && Array.isArray(node.content)) {
      return node.content.some((child) => checkNode(child));
    }
    return false;
  }

  return checkNode(json);
}

export function hasMeaningfulContent(
  content: ProseMirrorJSON | null | undefined,
): boolean {
  if (!content) {
    return false;
  }

  if (
    content.type === 'text' &&
    content.text &&
    (content.text as string).trim().length > 0
  ) {
    return true;
  }

  if (content.type === 'image') {
    return true;
  }

  if (content.content && Array.isArray(content.content)) {
    return content.content.some((child) => hasMeaningfulContent(child));
  }

  return content.type !== 'doc' && content.type !== 'paragraph';
}

export function isEditorEmpty(editor: Editor): boolean {
  return !hasMeaningfulContent(editor.getJSON());
}

/**
 * Gets both HTML and JSON content from editor
 * Used when saving posts to API
 */
export function getContentFromEditor(editor: Editor): {
  contentHtml: string;
  contentJson: ProseMirrorJSON;
} {
  const contentJson = editor.getJSON();
  const contentHtml = convertJSONToHTML(contentJson);

  return {
    contentHtml,
    contentJson,
  };
}
