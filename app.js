const PIECES = {
  P: "♙",
  R: "♖",
  N: "♘",
  B: "♗",
  Q: "♕",
  K: "♔",
  p: "♟",
  r: "♜",
  n: "♞",
  b: "♝",
  q: "♛",
  k: "♚",
};

const START = [
  ["r", "n", "b", "q", "k", "b", "n", "r"],
  ["p", "p", "p", "p", "p", "p", "p", "p"],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["P", "P", "P", "P", "P", "P", "P", "P"],
  ["R", "N", "B", "Q", "K", "B", "N", "R"],
];

let board = [];
let turn = "w";
let selected = null;
let legalMoves = [];
let moveHistory = [];
let capturedWhite = [],
  capturedBlack = [];

const boardEl = document.getElementById("board");
const turnLabel = document.getElementById("turnLabel");
const moveListEl = document.getElementById("moveList");
const capturedWhiteEl = document.getElementById("capturedWhite");
const capturedBlackEl = document.getElementById("capturedBlack");
const restartBtn = document.getElementById("restartBtn");
const undoBtn = document.getElementById("undoBtn");

function cloneStart() {
  return START.map((r) => r.slice());
}

function init() {
  board = cloneStart();
  turn = "w";
  selected = null;
  legalMoves = [];
  moveHistory = [];
  capturedWhite = [];
  capturedBlack = [];
  updateUI();
  renderBoard();
}

function updateUI() {
  turnLabel.textContent = turn === "w" ? "Weiß" : "Schwarz";
  renderCaptured();
  renderMoveList();
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}
function isEmpty(r, c) {
  return board[r][c] === "" || board[r][c] === undefined;
}
function isWhite(p) {
  return p && p === p.toUpperCase();
}
function isBlack(p) {
  return p && p === p.toLowerCase();
}
function sideOf(p) {
  if (!p) return null;
  return isWhite(p) ? "w" : "b";
}
function opponent(s) {
  return s === "w" ? "b" : "w";
}

function genPseudoMoves(r, c) {
  const p = board[r][c];
  if (!p) return [];
  const side = sideOf(p);
  const piece = p.toLowerCase();
  const moves = [];
  const addIf = (rr, cc) => {
    if (!inBounds(rr, cc)) return;
    const t = board[rr][cc];
    if (t === "" || sideOf(t) !== side) {
      moves.push({ r: rr, c: cc, capture: t !== "" });
    }
  };

  if (piece === "p") {
    const dir = isWhite(p) ? -1 : 1;

    if (inBounds(r + dir, c) && board[r + dir][c] === "")
      moves.push({ r: r + dir, c: c, capture: false });

    const startRow = isWhite(p) ? 6 : 1;
    if (
      r === startRow &&
      board[r + dir][c] === "" &&
      board[r + dir * 2][c] === ""
    )
      moves.push({ r: r + dir * 2, c: c, capture: false });

    for (let dc of [-1, 1]) {
      const rr = r + dir,
        cc = c + dc;
      if (
        inBounds(rr, cc) &&
        board[rr][cc] !== "" &&
        sideOf(board[rr][cc]) !== side
      ) {
        moves.push({ r: rr, c: cc, capture: true });
      }
    }
  } else if (piece === "n") {
    const deltas = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    deltas.forEach((d) => addIf(r + d[0], c + d[1]));
  } else if (piece === "b" || piece === "r" || piece === "q") {
    let dirs = [];
    if (piece === "b" || piece === "q")
      dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    if (piece === "r" || piece === "q")
      dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    for (const d of dirs) {
      let rr = r + d[0],
        cc = c + d[1];
      while (inBounds(rr, cc)) {
        if (board[rr][cc] === "") moves.push({ r: rr, c: cc, capture: false });
        else {
          if (sideOf(board[rr][cc]) !== side)
            moves.push({ r: rr, c: cc, capture: true });
          break;
        }
        rr += d[0];
        cc += d[1];
      }
    }
  } else if (piece === "k") {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        addIf(r + dr, c + dc);
      }
    }
  }

  return moves;
}

function cloneAndMove(from, to) {
  const b = board.map((row) => row.slice());
  const piece = b[from.r][from.c];
  const captured = b[to.r][to.c];
  b[to.r][to.c] = piece;
  b[from.r][from.c] = "";

  if (piece && piece.toLowerCase() === "p") {
    if ((isWhite(piece) && to.r === 0) || (isBlack(piece) && to.r === 7)) {
      b[to.r][to.c] = isWhite(piece) ? "Q" : "q";
    }
  }
  return { board: b, captured };
}

function kingInCheckForBoard(bd, side) {
  let kr = -1,
    kc = -1;
  const kingChar = side === "w" ? "K" : "k";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (bd[r][c] === kingChar) {
        kr = r;
        kc = c;
        break;
      }
    }
    if (kr !== -1) break;
  }
  if (kr === -1) return true;

  const opp = opponent(side);

  const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  const pawnDir = opp === "w" ? -1 : 1;
  const pawnRows = [
    { r: kr - pawnDir, c: kc - 1 },
    { r: kr - pawnDir, c: kc + 1 },
  ];
  for (const pr of pawnRows) {
    if (
      inB(pr.r, pr.c) &&
      bd[pr.r][pr.c] &&
      sideOf(bd[pr.r][pr.c]) === opp &&
      bd[pr.r][pr.c].toLowerCase() === "p"
    )
      return true;
  }

  const knightD = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  for (const d of knightD) {
    const rr = kr + d[0],
      cc = kc + d[1];
    if (
      inB(rr, cc) &&
      bd[rr][cc] &&
      sideOf(bd[rr][cc]) === opp &&
      bd[rr][cc].toLowerCase() === "n"
    )
      return true;
  }

  const diagDirs = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const d of diagDirs) {
    let rr = kr + d[0],
      cc = kc + d[1];
    while (inB(rr, cc)) {
      if (bd[rr][cc]) {
        if (sideOf(bd[rr][cc]) === opp) {
          const t = bd[rr][cc].toLowerCase();
          if (t === "b" || t === "q") return true;
        }
        break;
      }
      rr += d[0];
      cc += d[1];
    }
  }

  const ortDirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const d of ortDirs) {
    let rr = kr + d[0],
      cc = kc + d[1];
    while (inB(rr, cc)) {
      if (bd[rr][cc]) {
        if (sideOf(bd[rr][cc]) === opp) {
          const t = bd[rr][cc].toLowerCase();
          if (t === "r" || t === "q") return true;
        }
        break;
      }
      rr += d[0];
      cc += d[1];
    }
  }

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = kr + dr,
        cc = kc + dc;
      if (
        inB(rr, cc) &&
        bd[rr][cc] &&
        sideOf(bd[rr][cc]) === opp &&
        bd[rr][cc].toLowerCase() === "k"
      )
        return true;
    }
  }

  return false;
}

function genLegalMoves(r, c) {
  const pseudo = genPseudoMoves(r, c);
  const piece = board[r][c];
  const side = sideOf(piece);
  const legal = [];
  for (const mv of pseudo) {
    const dest = { r: mv.r, c: mv.c };

    const copy = board.map((rr) => rr.slice());
    const savedFrom = copy[r][c];
    const savedTo = copy[dest.r][dest.c];
    copy[dest.r][dest.c] = savedFrom;
    copy[r][c] = "";

    if (savedFrom && savedFrom.toLowerCase() === "p") {
      if (
        (isWhite(savedFrom) && dest.r === 0) ||
        (isBlack(savedFrom) && dest.r === 7)
      ) {
        copy[dest.r][dest.c] = isWhite(savedFrom) ? "Q" : "q";
      }
    }

    if (!kingInCheckForBoard(copy, side)) {
      legal.push(mv);
    }
  }
  return legal;
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement("div");
      const light = (r + c) % 2 === 0;
      sq.className = "square " + (light ? "light" : "dark");
      sq.dataset.r = r;
      sq.dataset.c = c;
      const piece = board[r][c];
      if (piece) {
        const p = document.createElement("div");
        p.className = "piece";
        p.textContent = PIECES[piece];
        sq.appendChild(p);
      }
      const coord = document.createElement("div");
      coord.className = "coord";
      coord.textContent = `${String.fromCharCode(97 + c)}${8 - r}`;
      sq.appendChild(coord);

      sq.addEventListener("click", onSquareClick);
      boardEl.appendChild(sq);
    }
  }
  highlight();
}

function clearHighlights() {
  document
    .querySelectorAll(".square")
    .forEach((s) =>
      s.classList.remove("selected", "move-target", "capture-target")
    );
}

function highlight() {
  clearHighlights();
  if (selected) {
    const selEl = document.querySelector(
      `.square[data-r="${selected.r}"][data-c="${selected.c}"]`
    );
    if (selEl) selEl.classList.add("selected");

    legalMoves.forEach((m) => {
      const el = document.querySelector(
        `.square[data-r="${m.r}"][data-c="${m.c}"]`
      );
      if (!el) return;
      if (m.capture) el.classList.add("capture-target");
      else el.classList.add("move-target");
    });
  }
}

// Klick-Handler
function onSquareClick(e) {
  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  const piece = board[r][c];

  if (selected) {
    const mv = legalMoves.find((m) => m.r === r && m.c === c);
    if (mv) {
      doMove(selected, { r, c });
      selected = null;
      legalMoves = [];
      renderBoard();
      updateUI();
      return;
    }
  }

  if (piece && sideOf(piece) === turn) {
    selected = { r, c };
    legalMoves = genLegalMoves(r, c);
    renderBoard();
  } else {
    selected = null;
    legalMoves = [];
    renderBoard();
  }
}

function doMove(from, to) {
  const piece = board[from.r][from.c];
  const target = board[to.r][to.c];

  if (target) {
    if (isWhite(target)) capturedWhite.push(target);
    else capturedBlack.push(target);
  }

  board[to.r][to.c] = piece;
  board[from.r][from.c] = "";

  if (piece.toLowerCase() === "p") {
    if ((isWhite(piece) && to.r === 0) || (isBlack(piece) && to.r === 7)) {
      board[to.r][to.c] = isWhite(piece) ? "Q" : "q";
    }
  }

  const fromSq = `${String.fromCharCode(97 + from.c)}${8 - from.r}`;
  const toSq = `${String.fromCharCode(97 + to.c)}${8 - to.r}`;
  const text = `${PIECES[piece] || piece} ${fromSq}→${toSq}`;
  moveHistory.push({
    from,
    to,
    piece,
    captured: target || "",
    text,
    side: turn,
  });

  turn = opponent(turn);
}

function renderCaptured() {
  capturedWhiteEl.textContent = capturedWhite.map((x) => PIECES[x]).join(" ");
  capturedBlackEl.textContent = capturedBlack.map((x) => PIECES[x]).join(" ");
}

function renderMoveList() {
  moveListEl.innerHTML = "";
  moveHistory.forEach((m, idx) => {
    const li = document.createElement("li");
    const who = m.side === "w" ? "W" : "B";
    li.textContent = `${idx + 1}. (${who}) ${m.text}`;
    moveListEl.appendChild(li);
  });
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

function undo() {
  if (moveHistory.length === 0) return;
  const last = moveHistory.pop();

  board[last.from.r][last.from.c] = last.piece;
  board[last.to.r][last.to.c] = last.captured || "";

  if (last.captured) {
    if (isWhite(last.captured)) {
      const idx = capturedWhite.lastIndexOf(last.captured);
      if (idx >= 0) capturedWhite.splice(idx, 1);
    } else {
      const idx = capturedBlack.lastIndexOf(last.captured);
      if (idx >= 0) capturedBlack.splice(idx, 1);
    }
  }

  selected = null;
  legalMoves = [];
  renderBoard();
  updateUI();
}

restartBtn.addEventListener("click", init);
undoBtn.addEventListener("click", undo);

init();
