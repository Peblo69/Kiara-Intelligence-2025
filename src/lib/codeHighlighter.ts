import Prism from 'prismjs';

// Import language support
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-css';

const languageMap: Record<string, string> = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'sh': 'bash',
  'html': 'markup',
  'md': 'markdown',
  'css': 'css',
  'sql': 'sql',
  'json': 'json',
  'jsx': 'jsx',
  'tsx': 'tsx',
  'bash': 'bash',
  'text': 'text'
};

export function highlightCode(code: string, language: string): string {
  try {
    const normalizedLang = languageMap[language.toLowerCase()] || 'text';

    // If language is supported, use Prism
    if (Prism.languages[normalizedLang]) {
      return Prism.highlight(
        code,
        Prism.languages[normalizedLang],
        normalizedLang
      );
    }

    // Fallback to plain text with HTML escaping
    return code.replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char] || char));
  } catch (error) {
    console.warn(`Failed to highlight code for language ${language}:`, error);
    return code;
  }
}