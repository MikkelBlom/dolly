# Storyboard JSON

Review structure before motion. `dolly storyboard check storyboard.json` validates it (every problem with a JSON path); `dolly storyboard schema` prints the JSON Schema; `dolly new <dir> --storyboard storyboard.json` scaffolds one scene file per storyboard scene, laid out left to right in the world with whip-pans between them.

```json
{
  "title": "Price Peek",
  "purpose": "Chrome Web Store promo, YouTube",
  "aspect": "16:9",
  "fps": 60,
  "bpm": 120,
  "scenes": [
    { "name": "hook", "duration": 3, "idea": "Prices abroad are in currencies you can't read", "text": ["Shopping |abroad?|"], "transition": "pull-back", "visual": "₩1,500,000 close-up, other price chips fly in" },
    { "name": "promise", "duration": 4, "idea": "Every price shows in your currency", "text": ["Every price, in |your| currency."], "vo": "Price Peek shows every price in your own currency, right on the price.", "beats": { "badges": 0.5 } },
    { "name": "local", "duration": 6, "idea": "It reads local formats", "text": ["Reads prices the |local| way."], "transition": "whip" },
    { "name": "end", "duration": 4.5, "idea": "Name and promise", "text": ["Price Peek", "Any price, in |your| currency."], "transition": "zoom-into" }
  ]
}
```

Fields per scene: `name` (kebab-case, unique), `duration` (s), `idea` (what the viewer takes away — required), `text` (on-screen lines; `|word|` = accent), `vo` (voice-over line), `transition` (`cut | whip | pull-back | push | dolly-through | zoom-into | match-cut | reel | continuity`), `visual` (hero element), `beats` (named times from the scene start), optional `start` (otherwise scenes are laid end to end).

Checks: headline ≤ 9 words (warn); text needs `0.5 s + words/3` to read — error if the scene is shorter; VO at 150 wpm must fit the scene; first scene (hook) ≤ 3 s (warn); total 15–60 s (warn above 60).

Writing a good storyboard from a brief:
1. One sentence: who is it for and what should they feel/do after?
2. Pick 4–6 beats: hook (the problem as a question or a striking detail), promise with proof (show it working on real data), differentiator, control/customisation, second capability, end card.
3. Each beat: one idea, one hero element, one headline. Put the proof on screen, not in words.
4. Plan the camera: where in the world each scene lives and how the camera gets there (whip right for "next topic", down for "next item", dolly-through for "go deeper", zoom-into for the end card).
5. Time it on a 120 BPM grid (0.5 s beats).
