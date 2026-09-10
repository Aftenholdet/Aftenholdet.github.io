# Code editor theme references

Checked on 2026-09-10. The code help uses platform-specific syntax colors. The SPIKE code background is intentionally light gray (`#f3f4f5`) with a darker label strip (`#e7e9ec`) to distinguish it from the white page.

## SPIKE Education

The exact token colors come from `spike-theme` in the [public LEGO SPIKE app bundle](https://spike.legoeducation.com/static/js/index.dbbcd12a.js). LEGO's [Python help](https://spike.legoeducation.com/prime/modal/help/lls-help-python) also describes the keyword, string, number, and comment colors.

| Token | Color |
| --- | --- |
| Keywords, built-ins, booleans | `#0078cc` |
| Strings | `#d8009b` |
| Numbers | `#ff7d00` |
| Comments | `#00963e` |
| Parentheses and brackets | `#00877b` |
| Identifiers | `#000000` |

## MINDSTORMS Robot Inventor

The public LEGO product page and [LEGO's app listing](https://play.google.com/store/apps/details?id=com.lego.retail.mindstorms) were checked, but did not expose the Python theme definition. These colors are recovered from the original, platform-specific formatted text in this project's teaching sources, rather than claimed as an independently verified current app theme:

- `Old Solution (Google Drive)/Differentieret Læring/Bibliotek/Afstandssensor.pptx`, slide 6: imports, comments, strings, identifiers, parentheses.
- `Motor.pptx` and `Gentag.pptx` in the same directory: numbers, built-ins (`range`, `print`), and booleans (`True`).

| Token | Color |
| --- | --- |
| Keywords, built-ins, booleans | `#cc7833` |
| Strings | `#66cc33` |
| Numbers | `#b5cea8` |
| Comments | `#9933cc` |
| Parentheses and brackets | `#dcdcdc` |
| Identifiers | `#d4d4d4` |

The existing dark code background (`#1e1e1e`) is retained. Function names, module names, and all-capital identifiers stay neutral. The highlighter preserves the original code text, indentation, and line breaks.
