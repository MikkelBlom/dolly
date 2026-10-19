// Shared beat times and world positions (seconds / world px). Scenes read these; nothing here is stateful.
export const ARTICLE_X = 2048;            // world x of the article region
export const T = {
  pullBack: [0.2, 1.3],
  paste: 1.3,                             // pain: a 4th quote is pasted in
  whip: [3.0, 3.6],                       // pain -> article
  cursorIn: 3.7, dragStart: 4.3, dragEnd: 5.2,
  keyAlt: 5.45, keyN: 5.6, press: 6.0,     // Alt+N pressed
  cardOut: 6.05,                          // note card springs out of the selection
  toCard: [6.3, 7.1],                     // camera moves right to frame the card
  zoom: [10.0, 10.8],                     // dive into the card's logo -> end card
};
// note card geometry (world px)
export const CARD = { left: ARTICLE_X + 560, top: 150, width: 430 };
export const LOGO = { x: CARD.left + 26 + 16, y: CARD.top + 24 + 16 };   // centre of the green logo tile
// where the selected sentence sits in the world (approx centre), the card flies out from here
export const SELECTION = { x: ARTICLE_X + 90 + 52 + 230, y: 404 };
