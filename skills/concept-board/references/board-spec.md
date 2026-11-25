# Board spec format

One JSON object with `"kind": "board"`. Semantics only: any coordinate, size, colour, font or style field is rejected (the board preset owns them). The engine validates and reports every problem at once (exit 2).

```json
{
  "kind": "board",
  "title": "Copilot capabilities: 4 categories",
  "subtitle": "Source: GitHub Docs, “How Copilot works”",
  "preset": "clean",
  "columns": 2,
  "numbered": true,
  "sections": [
    {
      "id": "assistive", "title": "Assistive", "tone": "blue",
      "summary": "Copilot responds while you work.",
      "fields": [{ "label": "Includes", "text": "Code suggestions · Q&A · explaining code" }],
      "takeaway": "You review and apply each suggestion."
    },
    {
      "id": "ideas", "title": "Ideas", "tone": "yellow",
      "items": [{ "id": "i1", "text": "dark mode" }, { "id": "i2", "text": "offline editing", "tone": "pink" }]
    }
  ]
}
```

## Top level

| Field | Values | Notes |
|---|---|---|
| `kind` | `board` | required; without it the spec is an architecture graph |
| `title` | string, 40 chars or fewer | wraps to the board width |
| `subtitle` | string, 80 chars or fewer | source or one-line context, under the title |
| `type` | `board` `concept` `categories` `comparison` `summary` `pattern` (clean); `brainstorm` `brainwriting` `whiteboard` `informal` (sketch) | picks the default preset |
| `preset` | `clean` or `sketch` (`concept` is accepted as `clean`) | omit to use the type default; persisted after the first build |
| `displayWidth` | px, default 800 (the Roam main column) | text must stay >= 11px there; never raise it to make a board pass |
| `arrangement` | `grid` (default) | `rows` and `radial` are not supported yet |
| `columns` | 1 to 3; default 1 for 1 section, 2 for 2 or 4, else 3 | 1 column gives stacked rows |
| `numbered` | `true` / `false` (default) | prefixes each section title with its position: "1  Assistive" |

## Sections

The unit of layout, filled left to right, top to bottom. `id` and `title` (32 chars or fewer) required, plus **at least one** of:

- `summary`: one or two sentences, 120 chars or fewer.
- `fields`: up to 4 `{ "label", "text" }` pairs. Label 24 chars or fewer (drawn small and grey: "Includes", "Owner", "When"), text 120 or fewer. Separate list entries with ` · `; the engine never starts a line with a separator.
- `takeaway`: the one-line consequence, 120 chars or fewer, drawn with a leading arrow at the bottom of the card.
- `items`: up to 8 sticky notes `{ "id", "text" }`, text 40 chars or fewer, optional `tone`.

A section with only `items` is a sticky-note section; with `summary`/`fields`/`takeaway` it is a card. They mix freely. In the sketch preset, a board whose sections are **all** sticky-note sections is drawn as a dotted brainwriting grid instead of cards.

`tone`: `neutral` `blue` `green` `yellow` `orange` `purple` `pink` `teal`. Omit to cycle blue, green, orange, purple, pink, teal, yellow, neutral. Pick by meaning and keep it consistent across related boards.

Not supported yet (rejected with a clear error): `links`, `center`, `rank`, `icon`, emoji in any text.

## Layout rules (engine-owned)

- Columns share the display width evenly. Each grid row is as tall as its tallest section; summaries, fields and takeaways line up across a row.
- Text wraps in the real font. Hard newlines (`\n`) are kept.
- A word too long for its column widens the column; if the board then no longer fits at `displayWidth`, readability fails and the warning says how many columns fit. A word too wide for even one full-width column is a spec error.

## Gates

- Hard: dropped sections or items, overlapping sections, notes or text, text outside its card or note, off-preset colours, fonts or sizes.
- Readability: every text >= 11px at `displayWidth`, and 14 lines or fewer per section.
- Advisory: sections in the same row more than 2x different in natural height (balance), aspect ratio.

## Budgets

12 sections or fewer per board, 8 items per section. Past that, or when a section needs more than 14 lines, split into two boards.
