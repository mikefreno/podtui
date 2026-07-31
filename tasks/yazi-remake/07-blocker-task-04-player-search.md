# 07-blocker — Task 04 (Search + Player) never converted to YaziPaneRow

meta:
  id: yazi-remake-07-blocker
  feature: yazi-remake
  priority: P0
  blocks: [yazi-remake-07]
  blocked_by: [yazi-remake-04]
  tags: [blocker, verification, tasks-required]

## Problem

Task 04 (`04-fit-search-and-player-panes.md`) is marked complete, but its
core deliverable was never implemented:

> - `src/pages/Player/PlayerPage.tsx` — rendered through `<YaziPaneRow>`
> - `src/pages/Search/SearchPage.tsx` — rendered through `<YaziPaneRow>`

`grep -rn "YaziPaneRow" src/pages/Search src/pages/Player` → **0 files**.

## Evidence (from task 07 harness walk-through, 100×30)

### Player ❌

`src/pages/Player/PlayerPage.tsx` renders a single full-width
`<scrollbox>` (now-playing transport + controls). No parent pane, no preview
pane. Frame `.harness/player-current.txt`:

```
│ Now Playing                                                  0:00 / 0:00 (0%) │
...
│ │ │[Prev]│ │[Play]│ │[Next]│   Vol 70%  Speed 1x  ... │ │
```

Expected (task 04 + feature exit criteria): `blank | transport | notes` at
1/7 : 3/7 : 3/7.

### Search ⚠️ ratio wrong

`src/pages/Search/SearchPage.tsx` renders three custom `<box flexGrow={
PANE_RATIO.* }>` columns but **omits `flexBasis={0}`**, so Yoga distributes
space by natural content width (the input box is `width={28}`). Measured
column widths at 100 cols: **31 / 32 / 31** (equal thirds), NOT the target
**~14 / 43 / 43** (1:3:3).

`<YaziPaneRow>` exists precisely to set `flexBasis={0}` per column and force
the exact 1:3:3 ratio regardless of content (see its header comment). Routing
Search through it fixes the ratio for free.

## Why not patched in task 07

Task 07 is explicitly the verification gate. Its notes:

> - This is the gate for the whole feature — do not mark done if any criterion
>   fails; open a blocker task instead
> - If the harness reveals a visual regression (e.g. parent collapses, ratios
>   off), file it against the responsible task (02 or 03) rather than
>   patching here

This is a missing implementation in task 04, not a regression in 02/03, so the
responsible task is 04. Patches belong there.

## Failing exit criteria

- "All tabs render three stable columns at 1/7 : 3/7 : 3/7" — Player fails
  (not 3 columns); Search fails (wrong ratio).
- "`5` → Player: blank|transport|notes at 1:3:3" — fails.
- "`4` → Search: query|results|detail at 1:3:3" — 3 columns yes, ratio wrong.

## Fix plan (task 04 do-over)

1. `src/pages/Player/PlayerPage.tsx` — wrap the existing transport JSX in a
   `<YaziPaneRow current={transport} parent={undefined} preview={notes} />`.
   Parent should fall through to the primitive's muted `—` placeholder (it
   already keeps its 1/7 slot when blank). Preview = episode description /
   waveform (currently inline under "Now Playing"). Keep `PlayerPaneCount=1`
   (the visible columns are a render concern; only current=0 is focusable).
2. `src/pages/Search/SearchPage.tsx` — replace the three custom `<box
   flexGrow={PANE_RATIO.*}>` columns with a single `<YaziPaneRow
   parent={queryInput+recent} current={resultsList} preview={detail}
   focused={!inputFocused() ? /* results */ : false} />`. Keep the
   `inputFocused` effect so the Shell yields keys to the native `<input>`
   when the query pane is focused — note `inputFocused` is a Search-owned
   signal; YaziPaneRow's `focused` prop only drives the accent ring + scroll
   focus, which for Search can stay on the current (results) column.
3. Remove the now-dead custom ratio code from both files after the swap.
4. Re-run: `grep -rn YaziPaneRow src/pages/Search src/pages/Player` → 2 files;
   `bun run build`; `bun test`; harness walk-through: Player shows 3 cols,
   Search cols measure ~14/43/43.

## Verification gates (re-run task 07 after fix)

- `bun run build` → "Build complete"
- `bun test` → 0 fail
- harness:
  - Player frame has 3 bordered columns (parent `—`, current transport,
    preview notes/placeholder) at 1:3:3
  - Search frame columns measure ~14/43/43
