// Highlight the teaching examples without changing their text or indentation.
// Strings and comments are consumed first so their contents never become markup.
const keywords = new Set('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '));
const builtins = new Set('abs bool dict enumerate float int len list max min print range round set str sum tuple zip'.split(' '));
const tokens = /#[^\r\n]*|(?:[rRuUbBfF]{1,2})?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*')|\b\d+(?:\.\d+)?\b|[\p{L}_][\p{L}\p{N}_]*|[()[\]{}]/gu;

export function highlightPython(source) {
  let output = '';
  let end = 0;
  for (const match of source.matchAll(tokens)) {
    const word = match[0];
    let type = '';
    if (word.startsWith('#')) type = 'comment';
    else if (/^[rRuUbBfF]{0,2}["']/.test(word)) type = 'string';
    else if (/^\d/.test(word)) type = 'number';
    else if (keywords.has(word) || builtins.has(word) || ['True', 'False', 'None'].includes(word)) type = 'keyword';
    else if (/^[()[\]{}]$/.test(word)) type = 'bracket';
    output += escapeCode(source.slice(end, match.index));
    output += type ? `<span class="syntax-${type}">${escapeCode(word)}</span>` : escapeCode(word);
    end = match.index + word.length;
  }
  return output + escapeCode(source.slice(end));
}

function escapeCode(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
