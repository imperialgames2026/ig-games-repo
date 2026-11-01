const diceFace = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
export function extraView(room, ui, send, refresh, { h, button }) {
  const s = room.state,
    me = room.seat,
    own = me >= 0 && s.turn === me && !s.over && !ui.busy,
    out = h("div", {});
  if (room.game === "connectfour") {
    const columns = h("div", { class: "connect-columns" });
    for (let col = 0; col < 7; col++)
      columns.append(
        button(
          "↓ " + (col + 1),
          () => send({ type: "drop", column: col }),
          !own || s.board[col] !== null,
          "drop-column",
        ),
      );
    const board = h("div", {
      class: "connect-board",
      role: "group",
      "aria-label": "Connect Four board",
    });
    s.board.forEach((p, i) =>
      board.append(
        h("span", {
          class: `connect-hole ${p === 0 ? "disc-red" : p === 1 ? "disc-gold" : ""} ${s.winning.includes(i) ? "winning-disc" : ""} ${s.lastMove === i ? "last-disc" : ""}`,
          role: "img",
          "aria-label": `Row ${Math.floor(i / 7) + 1}, column ${(i % 7) + 1}: ${p === null ? "empty" : p === 0 ? "Red" : "Gold"}`,
        }),
      ),
    );
    out.append(
      columns,
      board,
      h(
        "p",
        { class: "helper" },
        "Choose a column above the board. Red starts; connect four in any direction.",
      ),
    );
  } else if (room.game === "reversi") {
    const legal = s.legalMoves || [],
      board = h("div", {
        class: "reversi-board",
        role: "group",
        "aria-label": "Reversi board",
      });
    s.board.forEach((p, index) => {
      const playable = legal.some((m) => m.index === index);
      const coord = "ABCDEFGH"[index % 8] + (Math.floor(index / 8) + 1);
      const b = button(
        "",
        () => send({ type: "place", index }),
        !own || !playable,
        "reversi-cell" + (s.lastMove === index ? " last-reversi" : ""),
      );
      b.setAttribute(
        "aria-label",
        `${coord} ${p === null ? (playable ? "legal move" : "empty") : p === 0 ? "Black" : "White"}`,
      );
      if (p !== null)
        b.append(
          h("span", {
            class: "flat-disc " + (p === 0 ? "black-stone" : "white-stone"),
          }),
        );
      else if (own && playable) b.append(h("span", { class: "legal-dot" }));
      board.append(b);
    });
    out.append(
      board,
      h(
        "div",
        { class: "button-row" },
        button(
          "Pass — no legal move",
          () => send({ type: "pass" }),
          !own || legal.length > 0,
        ),
      ),
      h(
        "p",
        { class: "helper" },
        "Black moves first. Place a disc on a highlighted square to flip every bracketed line. Pass only when you have no legal placement.",
      ),
    );
  } else if (room.game === "gomoku") {
    const board = h("div", {
      class: "gomoku-board",
      role: "group",
      "aria-label": "Gomoku board",
    });
    s.board.forEach((p, index) => {
      const coord =
          "ABCDEFGHIJKLMNO"[index % 15] + (Math.floor(index / 15) + 1),
        b = button(
          "",
          () => send({ type: "place", index }),
          !own || p !== null,
          `gomoku-cell ${s.winning.includes(index) ? "winning-stone" : ""}`,
        );
      b.setAttribute(
        "aria-label",
        `${coord} ${p === null ? "empty" : p === 0 ? "Black" : "White"}`,
      );
      if (p !== null)
        b.append(
          h("span", {
            class:
              "flat-disc " +
              (p === 0 ? "black-stone" : "white-stone") +
              (s.lastMove === index ? " last-stone" : ""),
          }),
        );
      else if ([48, 56, 112, 168, 176].includes(index))
        b.append(h("span", { class: "star-point" }));
      board.append(b);
    });
    out.append(
      board,
      h(
        "p",
        { class: "helper" },
        "Black starts. Make exactly five in a row. Overlines of six or more do not win.",
      ),
    );
  } else if (room.game === "backgammon") {
    const legal = s.legalMoves || [],
      p = me >= 0 ? me : s.turn,
      sg = p === 0 ? 1 : -1;
    if (own && s.bar[p] > 0) ui.bgFrom = "bar";
    if (!s.remaining.includes(ui.bgDie)) ui.bgDie = null;
    const available = legal.filter(
        (m) => ui.bgDie === null || m.die === ui.bgDie,
      ),
      destinations = available.filter((m) => m.from === ui.bgFrom);
    const dice = h("div", { class: "bg-dice" });
    for (const d of s.remaining.length ? s.remaining : s.dice) {
      const b = button(
        diceFace[d],
        () => {
          ui.bgDie = ui.bgDie === d ? null : d;
          refresh();
        },
        !own || s.phase !== "move",
        "die-button" + (ui.bgDie === d ? " selected-die" : ""),
      );
      b.setAttribute("aria-label", `Use die ${d}`);
      dice.append(b);
    }
    out.append(
      h(
        "div",
        { class: "table-summary" },
        h(
          "span",
          {},
          "Ivory bar ",
          h("b", {}, s.bar[0]),
          " · off ",
          h("b", {}, s.off[0]),
          "/15",
        ),
        h(
          "span",
          {},
          "Onyx bar ",
          h("b", {}, s.bar[1]),
          " · off ",
          h("b", {}, s.off[1]),
          "/15",
        ),
      ),
      dice,
      h(
        "div",
        { class: "button-row" },
        button(
          "Roll dice",
          () => send({ type: "roll" }),
          !own || s.phase !== "roll",
          "primary",
        ),
        button(
          `Enter from bar (${s.bar[p]})`,
          () => {
            ui.bgFrom = "bar";
            refresh();
          },
          !own || !s.bar[p],
        ),
        button(
          `Bear off (${s.off[p]}/15)`,
          () => {
            const move = destinations
              .filter((m) => m.to === "off")
              .sort((a, b) => b.die - a.die)[0];
            if (move) send(move);
          },
          !own || !destinations.some((m) => m.to === "off"),
        ),
        button(
          "Pass — no playable die",
          () => send({ type: "pass" }),
          !own || s.phase !== "move" || legal.length > 0,
        ),
      ),
    );
    const board = h("div", {
      class: "backgammon-board",
      role: "group",
      "aria-label": "Backgammon board",
    });
    for (const [row, indices] of [
      [0, Array.from({ length: 12 }, (_, i) => 12 + i)],
      [1, Array.from({ length: 12 }, (_, i) => 11 - i)],
    ]) {
      const points = h("div", {
        class: "bg-row " + (row === 0 ? "top-points" : "bottom-points"),
      });
      for (const index of indices) {
        const n = s.points[index],
          count = Math.abs(n),
          to = destinations.some((m) => m.to === index),
          source = n * sg > 0 && available.some((m) => m.from === index);
        const b = button(
          "",
          () => {
            if (!own || s.phase !== "move") return;
            const move = destinations.find((m) => m.to === index);
            if (move) {
              send(move);
              return;
            }
            if (source) {
              ui.bgFrom = index;
              refresh();
            }
          },
          !own || s.phase !== "move" || !(to || source),
          `bg-point ${index % 2 ? "gold-point" : "green-point"} ${ui.bgFrom === index ? "selected-point" : ""} ${to ? "legal-point" : ""}`,
        );
        b.setAttribute(
          "aria-label",
          `Point ${index + 1}, ${count} ${n > 0 ? "Ivory" : n < 0 ? "Onyx" : "checkers"}${to ? ", legal destination" : ""}`,
        );
        b.append(h("span", { class: "point-number" }, index + 1));
        const stack = h("span", { class: "checker-stack" });
        for (let i = 0; i < Math.min(5, count); i++)
          stack.append(
            h(
              "span",
              {
                class:
                  "bg-checker " + (n > 0 ? "ivory-checker" : "onyx-checker"),
              },
              i === 4 && count > 5 ? String(count) : "",
            ),
          );
        b.append(stack);
        if (to) b.append(h("span", { class: "bg-destination" }, "•"));
        points.append(b);
      }
      board.append(points);
    }
    out.append(
      board,
      h(
        "p",
        { class: "helper" },
        `Ivory moves 24 → 1; Onyx moves 1 → 24. Select a checker point, then a highlighted destination. You may select a die first. All playable dice are compulsory; blocked dice are passed automatically.`,
      ),
    );
  }
  return out;
}
