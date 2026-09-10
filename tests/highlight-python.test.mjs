import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightPython } from '../src/highlight-python.js';
import { libraryTopics } from '../src/content.js';

function plainText(markup) {
  return markup.replace(/<span class="syntax-[a-z]+">|<\/span>/g, '')
    .replaceAll('&#039;', "'").replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
}

test('highlighting preserves every library code example, including whitespace', () => {
  let examples = 0;
  for (const topic of libraryTopics) {
    for (const section of topic.sections) {
      for (const variant of section.variants) {
        for (const content of variant.content ?? []) {
          if (content.type !== 'code') continue;
          assert.equal(plainText(highlightPython(content.text)), content.text, topic.id);
          examples++;
        }
      }
    }
  }
  assert.ok(examples > 0);
});

test('strings and comments stay intact and code cannot inject HTML', () => {
  const source = '# if True <img src=x onerror=alert(1)>\r\nprint("<script>if 42</script> & \\\"quoted\\\"")\n';
  const markup = highlightPython(source);
  assert.equal(plainText(markup), source);
  assert.ok(!markup.includes('<img'));
  assert.ok(!markup.includes('<script>'));
  assert.deepEqual([...markup.matchAll(/<span class="syntax-keyword">(.*?)<\/span>/g)].map(match => match[1]), ['print']);
  assert.ok(!markup.includes('syntax-number'));
  assert.ok(markup.includes('syntax-comment'));
  assert.ok(markup.includes('syntax-string'));
});

test('Python teaching constructs receive distinct token types', () => {
  const markup = highlightPython('while True:\n    motor.run(50) # Kør\n    print("Hej")');
  for (const type of ['keyword', 'bracket', 'number', 'comment', 'string']) {
    assert.ok(markup.includes(`syntax-${type}`), type);
  }
  assert.ok(markup.includes('<span class="syntax-keyword">True</span>'));
  assert.ok(markup.includes('<span class="syntax-keyword">print</span>'));
  assert.ok(markup.includes('motor.run<span class="syntax-bracket">(</span>'));
});
