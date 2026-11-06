import {pvpFleetVerifier} from './pvp-fleet-verification.js';
import {isPokerGame} from './games/poker-family.js';
import { casinoView, pokerView } from "./table-views.js";
import { extraView } from "./extra-views.js";
import { symbols, rankLabel } from "./games/common.js";
import { pieceSvg, pieceNames } from "./chess/pieces.js";
import { fleetFor } from "./games/battleship.js";
import { values } from "./games/words.js";
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (["disabled", "checked", "value", "hidden"].includes(key))
      node[key] = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  }
  return node;
}
export const button = (label, onclick, disabled = false, cls = "") =>
  h("button", { type: "button", onclick, disabled, class: cls }, label);
export function card(
  c,
  { onclick, disabled = false, selected = false, legal = false } = {},
) {
  return h(
    "button",
    {
      type: "button",
      class: `playing-card ${["H", "D"].includes(c.s) ? "red" : ""} ${selected ? "selected" : ""} ${legal ? "legal" : ""}`,
      disabled,
      onclick,
      "aria-label": `${rankLabel(c.r)} ${symbols[c.s]}`,
    },
    h("span", {}, rankLabel(c.r)),
    h("span", { class: "suit" }, symbols[c.s]),
  );
}
export function tile(t, opts = {}) {
  return h(
    "button",
    {
      type: "button",
      class: "domino" + (opts.selected ? " selected" : ""),
      disabled: opts.disabled,
      onclick: opts.onclick,
      "aria-label": `${t[0]} | ${t[1]}`,
    },
    h("span", {}, ["○", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][t[0]]),
    h("span", {}, ["○", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][t[1]]),
  );
}
function svgPiece(p) {
  const wrap = h("span", { class: "piece-wrap" });
  wrap.style.display = "contents";
  wrap.innerHTML = pieceSvg(p.type, p.color);
  return wrap;
}
export function gameView(room, ui, send, refresh) {
  const s = room.state,
    me = room.seat,
    own = me >= 0 && s.turn === me && !s.over && !ui.busy,
    hand = s.hands?.[me] || [],
    seatName = (p) => room.seats[p]?.name || `Seat ${p + 1}`;
  const out = h("div", {});
  const label = s.over
    ? "MATCH COMPLETE"
    : s.phase === "round"
      ? "HAND COMPLETE"
      : me < 0
        ? "SPECTATING"
        : own ||
            (s.phase === "pass" && !s.passed?.[me]) ||
            (s.phase === "placement" && !s.ready?.[me])
          ? "YOUR MOVE"
          : "AT THE TABLE";
  out.append(
    h(
      "div",
      { class: "status-strip" },
      h(
        "div",
        {},
        h(
          "strong",
          {},
          s.over
            ? s.message
            : s.phase === "round"
              ? "Hand complete"
              : `${seatName(s.turn)} · ${phaseLabel(s.phase,room.game)}`,
        ),
        h("small", {}, s.message),
      ),
      h("span", { class: "turn-badge" }, label),
    ),
  );
  if (
    s.scores?.length &&
    !isPokerGame(room.game) &&
    !["chess", "checkers", "battleship", "battleship6", "connectfour", "gomoku"].includes(
      room.game,
    )
  ) {
    const teamGame = ["euchre", "pinochle", "spades"].includes(room.game);
    out.append(
      h(
        "div",
        { class: "scoreline" },
        s.scores.map((score, p) =>
          h(
            "span",
            { class: "score" },
            teamGame
              ? p === 0
                ? "South + North"
                : "West + East"
              : seatName(p),
            h("b", {}, score),
          ),
        ),
      ),
    );
  }
  const act = (label, action, disabled = !own, cls = "") =>
    button(label, () => send(action), disabled || ui.busy, cls);
  if (isPokerGame(room.game)) {
    out.append(pokerView(room,ui,send,{h,button,card}));
  } else if (["blackjack","roulette","craps","baccarat"].includes(room.game)) {
    out.append(casinoView(room,ui,send,{h,button,card}));
  } else if (["connectfour", "backgammon", "reversi", "gomoku"].includes(room.game)) {
    out.append(extraView(room, ui, send, refresh, { h, button }));
  } else if (room.game === "chess") {
    const from = ui.chessFrom,
      possible = s.legal?.filter((m) => m.from === from) || [];
    const board = h("div", {
      class: "board",
      role: "group",
      "aria-label": "Chess board",
    });
    for (let index = 0; index < 64; index++) {
      const row = Math.floor(index / 8),
        col = index % 8,
        square = "abcdefgh"[col] + (8 - row),
        p = s.board[index];
      const options = possible.filter((m) => m.to === square);
      const last = s.last && (s.last.from === square || s.last.to === square);
      const b = button(
        "",
        () => {
          if (!own) return;
          if (ui.chessFrom && options.length) {
            if (options.some((m) => m.promotion)) {
              ui.promote({ from: ui.chessFrom, to: square });
              return;
            }
            send({ type: "play", from: ui.chessFrom, to: square });
          } else {
            ui.chessFrom = p?.color === (me === 0 ? "w" : "b") ? square : null;
            refresh();
          }
        },
        false,
        `board-square ${(row + col) % 2 ? "dark" : ""} ${from === square ? "chosen" : ""} ${last ? "last" : ""}`,
      );
      b.setAttribute(
        "aria-label",
        `${square}${p ? " " + (p.color === "w" ? "White" : "Black") + " " + pieceNames[p.type] : ""}${options.length ? " legal destination" : ""}`,
      );
      if (p) b.append(svgPiece(p));
      if (own && options.length) b.append(h("span", { class: "legal-dot" }));
      b.append(h("span", { class: "coordinate" }, square));
      board.append(b);
    }
    out.append(
      board,
      h(
        "p",
        { class: "helper" },
        "Select a piece, then a highlighted destination. White moves first. Rooms are untimed local practice.",
      ),
    );
    if (own) out.append(act("Resign game", { type: "resign" }));
  } else if (room.game === "checkers") {
    if (s.forced !== null && own) ui.checkFrom = s.forced;
    const legal = s.legalMoves || [],
      selected = ui.checkFrom;
    const board = h("div", {
      class: "board",
      role: "group",
      "aria-label": "Checkers board",
    });
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8),
        c = i % 8,
        p = s.board[i],
        dest = legal.some((m) => m.from === selected && m.to === i);
      const b = button(
        "",
        () => {
          if (!own) return;
          if (dest) send({ type: "move", from: selected, to: i });
          else if (p?.player === me) {
            ui.checkFrom = i;
            refresh();
          }
        },
        false,
        `board-square ${(r + c) % 2 ? "dark" : ""} ${selected === i ? "chosen" : ""}`,
      );
      b.setAttribute(
        "aria-label",
        `Square ${i + 1}${p ? " " + (p.player === 0 ? "Red" : "Ivory") + (p.king ? " king" : " man") : ""}${dest ? " legal destination" : ""}`,
      );
      if (p)
        b.append(
          h(
            "span",
            { class: "checker" + (p.player === 1 ? " ivory" : "") },
            p.king ? "♛" : "",
          ),
        );
      if (own && dest) b.append(h("span", { class: "legal-dot" }));
      board.append(b);
    }
    out.append(
      board,
      h(
        "p",
        { class: "helper" },
        "Red moves first. Captures are compulsory. Continue a multiple jump with the same piece.",
      ),
    );
  } else if (room.game === "dominoes") {
    out.append(
      h(
        "div",
        { class: "table-summary" },
        h("span", {}, "Boneyard ", h("b", {}, s.stockCount)),
        h(
          "span",
          {},
          "Other hand ",
          h("b", {}, me >= 0 ? s.handCounts[1 - me] : "hidden"),
        ),
      ),
    );
    out.append(
      h(
        "div",
        { class: "domino-chain" },
        s.chain.length
          ? s.chain.map((t) => tile(t, { disabled: true }))
          : h(
              "p",
              { class: "helper" },
              `Opening tile: ${s.opening.join(" | ")}`,
            ),
      ),
    );
    if (me >= 0) {
      out.append(
        h(
          "div",
          { class: "hand" },
          hand.map((t, i) =>
            tile(t, {
              selected: ui.domino === i,
              onclick: () => {
                ui.domino = i;
                refresh();
              },
            }),
          ),
        ),
      );
      const moves = s.legalMoves || [];
      out.append(
        h(
          "div",
          { class: "button-row" },
          act(
            "Play left",
            { type: "play", index: ui.domino, side: "left" },
            !own ||
              !moves.some((m) => m.index === ui.domino && m.side === "left"),
          ),
          act(
            "Play right",
            { type: "play", index: ui.domino, side: "right" },
            !own ||
              !moves.some((m) => m.index === ui.domino && m.side === "right"),
          ),
          act(
            "Draw a tile",
            { type: "draw" },
            !own || moves.length > 0 || !s.stockCount,
          ),
          act(
            "Pass",
            { type: "pass" },
            !own || moves.length > 0 || s.stockCount > 0,
          ),
        ),
      );
    }
  } else if (["rummy", "rummy6"].includes(room.game)) {
    const chosen = ui.cards,
      ids = [...chosen].filter((id) => hand.some((c) => c.id === id));
    out.append(
      h(
        "div",
        { class: "pile" },
        h("div", { class: "card-back" }, s.stockCount),
        s.discard.length
          ? card(s.discard.at(-1), { disabled: true })
          : h("p", { class: "helper" }, "No discard"),
      ),
    );
    out.append(
      h(
        "div",
        { class: "button-row" },
        act(
          "Draw from stock",
          { type: "draw", source: "stock" },
          !own || s.phase !== "draw" || !s.stockCount,
        ),
        act(
          "Take discard",
          { type: "draw", source: "discard" },
          !own || s.phase !== "draw" || !s.discard.length,
        ),
      ),
    );
    out.append(
      h(
        "div",
        { class: "meld-grid" },
        s.melds.map((m, index) =>
          h(
            "div",
            { class: "meld" },
            h("small", {}, `Meld ${index + 1} · ${seatName(m.owner)}`),
            h(
              "div",
              { class: "hand" },
              m.cards.map((c) => card(c, { disabled: true })),
            ),
            act(
              "Lay off selected card",
              { type: "layoff", id: ids[0], meld: index },
              !own || s.phase !== "meld" || ids.length !== 1,
            ),
          ),
        ),
      ),
    );
    if (me >= 0)
      out.append(
        h(
          "p",
          { class: "helper" },
          `Your hand · ${hand.length} cards. Select cards to meld; select one to discard or lay off.`,
        ),
        h(
          "div",
          { class: "hand" },
          hand.map((c) =>
            card(c, {
              selected: chosen.has(c.id),
              onclick: () => {
                chosen.has(c.id) ? chosen.delete(c.id) : chosen.add(c.id);
                refresh();
              },
            }),
          ),
        ),
        h(
          "div",
          { class: "button-row" },
          act(
            "Lay down selected meld",
            { type: "meld", ids },
            !own || s.phase !== "meld" || s.melded || ids.length < 3,
          ),
          act(
            "Discard selected card",
            { type: "discard", id: ids[0] },
            !own ||
              s.phase !== "meld" ||
              ids.length !== 1 ||
              ids[0] === s.picked,
          ),
        ),
      );
  } else if (["euchre", "hearts", "pinochle", "spades"].includes(room.game)) {
    out.append(
      h(
        "div",
        { class: "table-summary" },
        room.seats.map((seat, p) =>
          h(
            "span",
            {},
            seat.name,
            " · ",
            h("b", {}, `${s.handCounts[p]} cards / ${s.taken[p]} tricks`),
          ),
        ),
      ),
    );
    if (s.trump)
      out.append(
        h(
          "p",
          { class: "helper" },
          `Trump: ${symbols[s.trump]}${room.game === "pinochle" ? ` · Contract ${s.bid} · Meld ${s.meld.join(" / ")}` : ""}`,
        ),
      );
    if (room.game === "euchre" && s.phase === "bid") {
      out.append(
        h(
          "div",
          { class: "pile" },
          s.upcard
            ? card(s.upcard, { disabled: true })
            : h("span", { class: "card-back" }, "♜"),
          h(
            "p",
            { class: "helper" },
            `Bidding round ${s.bidRound}. ${s.bidRound === 1 ? "Order the upcard’s suit." : "Name a different suit. Dealer must choose."}`,
          ),
        ),
      );
      if (own) {
        const alone = h("input", {
          type: "checkbox",
          id: "alone",
          checked: ui.alone,
          onchange: (e) => {
            ui.alone = e.target.checked;
            refresh();
          },
        });
        out.append(
          h("label", { class: "helper" }, alone, " Go alone"),
          h(
            "div",
            { class: "button-row" },
            (s.bidOptions || []).map((suit) =>
              act(
                `Call ${symbols[suit]}`,
                { type: "bid", suit, alone: ui.alone },
                false,
              ),
            ),
            act(
              "Pass",
              { type: "bid", suit: null },
              s.bidRound === 2 && s.turn === s.dealer,
            ),
          ),
        );
      }
    }
    if (room.game === "spades") {
      out.append(
        h(
          "p",
          { class: "helper" },
          `Bids: ${s.bids.map((bid, p) => seatName(p) + ": " + (bid === null ? "—" : bid === 0 ? "nil" : bid)).join(" · ")} | Team bags: ${s.bags.join(" / ")}`,
        ),
      );
      if (s.phase === "bid" && own) {
        const input = h("input", {
          type: "number",
          min: 0,
          max: 13,
          step: 1,
          value: 4,
          "aria-label": "Spades bid",
        });
        out.append(
          h(
            "div",
            { class: "button-row" },
            input,
            button(
              "Bid tricks",
              () => send({ type: "bid", amount: Number(input.value) }),
              ui.busy,
            ),
            act("Bid nil", { type: "bid", amount: 0 }),
          ),
          h(
            "p",
            { class: "helper" },
            "Nil: take zero tricks for +100, or lose 100 if you take any.",
          ),
        );
      }
    }
    if (room.game === "pinochle" && s.phase === "bid") {
      out.append(
        h(
          "p",
          { class: "helper" },
          `Current bid ${s.bidder === null ? "none (minimum 25)" : s.bid + " by " + seatName(s.bidder)}. Passed players leave this auction.`,
        ),
      );
      if (own) {
        const input = h("input", {
          type: "number",
          min: Math.max(25, s.bid + 1),
          max: 250,
          step: 1,
          value: Math.max(25, s.bid + 1),
          "aria-label": "Pinochle bid",
        });
        out.append(
          h(
            "div",
            { class: "button-row" },
            input,
            button(
              "Raise bid",
              () => send({ type: "bid", amount: Number(input.value) }),
              ui.busy,
            ),
            act("Pass", { type: "bid", amount: null }),
          ),
        );
      }
    }
    if (room.game === "pinochle" && s.phase === "trump" && own)
      out.append(
        h(
          "div",
          { class: "button-row" },
          ["C", "D", "H", "S"].map((suit) =>
            act(`Trump ${symbols[suit]}`, { type: "trump", suit }, false),
          ),
        ),
      );
    if (s.phase === "play" || s.phase === "round" || s.over)
      out.append(
        h(
          "p",
          { class: "helper" },
          s.trick.length
            ? "Current trick"
            : s.lastTrick.length
              ? "Previous trick"
              : "The table is clear",
        ),
        h(
          "div",
          { class: "trick" },
          (s.trick.length ? s.trick : s.lastTrick).map((x) =>
            h(
              "div",
              { class: "trick-item" },
              card(x.card, { disabled: true }),
              h("small", {}, seatName(x.player)),
            ),
          ),
        ),
      );
    if (room.game === "hearts" && s.phase === "pass" && me >= 0) {
      const passed = s.passed[me];
      out.append(
        h(
          "p",
          { class: "helper" },
          passed
            ? "Your cards are chosen. Waiting for the other seats."
            : `Choose three cards to pass ${["", "left", "across", "right"][s.passDirection]}.`,
        ),
        act(
          "Pass three selected cards",
          { type: "pass", ids: [...ui.cards] },
          passed || ui.cards.size !== 3 || ui.busy,
        ),
      );
    }
    if (me >= 0) {
      const cards = hand.map((c) => {
        const passing =
          room.game === "hearts" && s.phase === "pass" && !s.passed[me];
        const discarding =
          room.game === "euchre" && s.phase === "discard" && own;
        const legal =
          own && s.phase === "play" && (s.legalCards || []).includes(c.id);
        return card(c, {
          selected: ui.cards.has(c.id),
          legal,
          disabled: ui.busy || !(passing || discarding || legal),
          onclick: () => {
            if (passing) {
              ui.cards.has(c.id) ? ui.cards.delete(c.id) : ui.cards.add(c.id);
              refresh();
            } else send({ type: discarding ? "discard" : "play", id: c.id });
          },
        });
      });
      out.append(
        h(
          "p",
          { class: "helper" },
          `Your hand${s.sittingOut === me ? " · sitting out your partner’s loner" : ""}`,
        ),
        h("div", { class: "hand" }, cards),
      );
    }
  } else if (room.game.startsWith("battleship")) {
    const p = me >= 0 ? me : 0,
      op = 1 - p,
      ship = s.ships[p]?.[s.ships[p]?.length];
    if (s.phase === "placement" && me >= 0 && !s.ready[me]) {
      const next = fleetFor(s.fleetSize ?? 5)[s.ships[me].length];
      out.append(
        h(
          "p",
          { class: "helper" },
          next
            ? `Place your ${next.name} (${next.length} cells). Click a starting square on your fleet grid.`
            : `All ${s.fleetSize ?? 5} ships placed. Deploy when ready.`,
        ),
        h(
          "label",
          { class: "helper" },
          h("input", {
            type: "checkbox",
            checked: ui.vertical,
            onchange: (e) => {
              ui.vertical = e.target.checked;
            },
          }),
          " Vertical placement",
        ),
        h(
          "div",
          { class: "button-row" },
          act("Auto-arrange fleet", { type: "auto" }, false),
          act("Clear fleet", { type: "clear" }, false),
          act(
            "Deploy fleet",
            { type: "ready" },
            s.ships[me].length !== (s.fleetSize ?? 5),
            false,
          ),
        ),
      );
    }
    out.append(h("p", {class:"helper"}, `${s.fleetSize ?? 5} ships per fleet · Enemy ships sunk: ${s.sunk?.[op]?.length ?? 0}/${s.fleetSize ?? 5} · Your ships sunk: ${s.sunk?.[p]?.length ?? 0}/${s.fleetSize ?? 5}`));
    if(s.fleetProofs?.some(Boolean)){
      const proofBox=h("details",{class:"fleet-proof"},h("summary",{},"Fleet deployment commitments"));
      s.fleetProofs.forEach((proof,index)=>{if(proof)proofBox.append(h("p",{},`${index===0?'South':'North'} · SHA-256 ${proof.commitment}`));});
      if(s.over){
        const result=h("p",{role:"status"});
        proofBox.append(button("Verify deployed fleets",async()=>{
          try{result.textContent=await pvpFleetVerifier.verify(room);}catch(e){result.textContent=e.message;}
        }),result);
      }
      out.append(proofBox);
    }
    const ownGrid = h("div", {
        class: "fleet-grid",
        role: "group",
        "aria-label": "Your fleet",
      }),
      targetGrid = h("div", {
        class: "fleet-grid",
        role: "group",
        "aria-label": "Enemy waters",
      });
    for (let i = 0; i < 100; i++) {
      const coord =
          String.fromCharCode(65 + Math.floor(i / 10)) + ((i % 10) + 1),
        hit = s.shots[op][i],
        occupied = s.ships[p].some((ship) => ship.cells.includes(i));
      const b = button(
        hit === "hit" ? "×" : hit === "miss" ? "•" : occupied ? "▪" : coord,
        () => send({ type: "place", index: i, vertical: ui.vertical }),
        ui.busy ||
          me < 0 ||
          s.phase !== "placement" ||
          s.ready[me] ||
          s.ships[me].length >= (s.fleetSize ?? 5),
        `sea-cell ${occupied ? "ship" : ""} ${hit || ""}`,
      );
      b.setAttribute(
        "aria-label",
        `Your fleet ${coord}${occupied ? " occupied" : ""}${hit ? " " + hit : ""}`,
      );
      ownGrid.append(b);
      const shot = s.shots[p][i],
        revealed = s.over && s.ships[op].some((ship) => ship.cells.includes(i));
      const t = button(
        shot === "hit" ? "×" : shot === "miss" ? "•" : revealed ? "▪" : coord,
        () => send({ type: "fire", index: i }),
        !own || s.phase !== "play" || !!shot,
        `sea-cell ${shot || ""} ${revealed ? "ship" : ""}`,
      );
      t.setAttribute("aria-label", `Enemy ${coord}${shot ? " " + shot : ""}`);
      targetGrid.append(t);
    }
    out.append(
      h(
        "div",
        { class: "fleet-grids" },
        h(
          "section",
          {},
          h("h3", {}, me < 0 ? "Fleet positions hidden" : "Your fleet"),
          ownGrid,
        ),
        h("section", {}, h("h3", {}, "Enemy waters"), targetGrid),
      ),
      h(
        "p",
        { class: "helper" },
        "One shot per turn. × hit · • miss. Unsunk enemy positions stay hidden until the match ends.",
      ),
    );
  } else if (room.game === "words") {
    const used = new Set(ui.draft.map((p) => p.rack)),
      board = h("div", {
        class: "word-board",
        role: "group",
        "aria-label": "Word tile board",
      });
    for (let i = 0; i < 121; i++) {
      const draft = ui.draft.find((p) => p.index === i),
        letter = s.board[i] || draft?.letter;
      const b = button(
        "",
        () => {
          if (!own) return;
          if (draft) {
            ui.draft = ui.draft.filter((p) => p.index !== i);
            refresh();
            return;
          }
          if (s.board[i]) return;
          const rack = [...ui.rack].filter((index) => !used.has(index)).at(-1);
          if (rack === undefined) return;
          ui.draft.push({ index: i, letter: hand[rack], rack });
          ui.rack.delete(rack);
          refresh();
        },
        false,
        `word-cell ${i === 60 ? "star" : ""} ${s.board[i] ? "filled" : ""} ${draft ? "draft" : ""}`,
      );
      b.setAttribute(
        "aria-label",
        `Word square ${Math.floor(i / 11) + 1}, ${(i % 11) + 1}${letter ? " " + letter : i === 60 ? " center" : ""}`,
      );
      if (letter) b.append(letter, h("sub", {}, values[letter]));
      else if (i === 60) b.append("☆");
      board.append(b);
    }
    out.append(
      board,
      h(
        "p",
        { class: "helper" },
        `Bag: ${s.bagCount} tiles · ${s.passes} consecutive scoreless turns. Choose a rack tile, then an empty square. Click a staged tile to recall it.`,
      ),
    );
    if (me >= 0)
      out.append(
        h(
          "div",
          { class: "hand" },
          hand.map((letter, index) => {
            const b = button(
              "",
              () => {
                ui.rack.has(index) ? ui.rack.delete(index) : ui.rack.add(index);
                refresh();
              },
              !own || used.has(index),
              `rack-tile ${ui.rack.has(index) ? "selected" : ""} ${used.has(index) ? "used" : ""}`,
            );
            b.setAttribute("aria-label", `Rack tile ${index + 1} ${letter}`);
            b.append(letter, h("sub", {}, values[letter]));
            return b;
          }),
        ),
        h(
          "div",
          { class: "button-row" },
          act(
            "Play word",
            {
              type: "play",
              placements: ui.draft.map(({ index, letter }) => ({
                index,
                letter,
              })),
            },
            !own || !ui.draft.length,
            "primary",
          ),
          button(
            "Recall tiles",
            () => {
              ui.draft = [];
              ui.rack.clear();
              refresh();
            },
            !ui.draft.length,
          ),
          act(
            "Exchange selected",
            { type: "exchange", indices: [...ui.rack] },
            !own || !ui.rack.size || s.bagCount < 7 || ui.draft.length > 0,
          ),
          act("Pass", { type: "pass" }, !own),
        ),
      );
  }
  if (s.phase === "round")
    out.append(
      h(
        "div",
        { class: "button-row" },
        act("Deal next hand", { type: "next" }, me < 0 || room.readOnly, "primary"),
      ),
    );
  if (me < 0)
    out.append(
      h(
        "p",
        { class: "helper" },
        room.readOnly ? "You are watching a recorded tournament hand. Use replay to review the action." : "You are watching this table. Take an available bot seat to join the game.",
      ),
    );
  return out;
}
export const phaseLabel = (phase,game) =>
 isPokerGame(game)?({opening:'qualifying opening bet',discard:'choose one card to discard',draw:'choose cards to replace',postdraw:game==='triple27'?'betting after draw':'final betting round',stud2:'second street',stud3:'third street',stud4:'fourth street',stud5:'fifth street',round:'hand complete',finished:'table complete',preflop:['draw5','progressive5','triple27'].includes(game)?'first betting round':'preflop'})[phase]||phase:
  ({
    bid: "bidding",
    trump: "choosing trump",
    discard: "dealer discard",
    pass: "passing cards",
    draw: "draw a card",
    meld: "meld or discard",
    placement: "fleet placement",
    move: "play the dice",
    roll: "roll dice",
    play: "to move",
    round: "hand complete",
    finished: "match complete",
  })[phase] || phase;
