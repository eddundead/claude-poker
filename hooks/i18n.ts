import type { Act, Entry, Game, Lang, Level, Street } from '../types'
import { RANKS, cardText, category, ranksOf } from './engine'

type N = string

export type Dict = {
  name: string
  flag: string
  levels: Record<Level, string>
  bots: string[]
  you: string
  hint: string
  setup: string
  nameLabel: string
  namePlaceholder: string
  buyIn: string
  stakes: string
  odds: (pct: number, opponents: number) => string
  suited: string
  offsuit: string
  choose: string
  stats: string
  howMany: string
  level: string
  back: string
  language: string
  hand: string
  blinds: string
  yourTurn: string
  toCall: string
  turnOf: (name: string) => string
  waiting: string
  handOver: string
  gameOver: string
  fold: string
  check: string
  call: string
  allIn: string
  raise: string
  betTo: string
  halfPot: string
  potButton: string
  next: string
  newGame: string
  menu: string
  quit: string
  quitAsk: string
  yes: string
  no: string
  streets: Record<Street, string>
  showdown: string
  pot: string
  thinking: string
  yourTurnSeat: string
  folded: string
  out: string
  youTake: (n: N) => string
  takes: (name: string, n: N) => string
  split: (n: N) => string
  othersFolded: string
  lostAll: (hand: number) => string
  champion: (stack: N) => string
  won: (delta: N, stack: N) => string
  foldLoss: (delta: N) => string
  foldedYou: string
  even: string
  lost: (delta: N, stack: N) => string
  acts: Record<'fold' | 'check' | 'call' | 'allin' | 'bet' | 'raise', string>
  logHand: (n: number) => string
  logBlinds: (sb: number, bb: number) => string
  logOut: (name: string) => string
  logOver: (isWon: boolean) => string
  logTakes: (name: string, n: number) => string
  logWins: (name: string, n: number) => string
  hands: {
    high: (r: N) => string
    pair: (r: N) => string
    two: (a: N, b: N) => string
    trips: (r: N) => string
    straight: (r: N) => string
    flush: (r: N) => string
    full: (a: N, b: N) => string
    quads: (r: N) => string
    straightFlush: (r: N) => string
  }
  opened: string
  description: string
}

const en: Dict = {
  name: 'English',
  flag: '🇬🇧',
  levels: { novice: 'Beginner', medium: 'Intermediate', pro: 'Pro' },
  bots: ['Bob', 'Eve', 'Max', 'Lisa', 'Leo', 'Nika'],
  you: 'You',
  hint: 'Your hand',
  setup: 'Table setup',
  nameLabel: 'Your name',
  namePlaceholder: 'type and press Enter',
  buyIn: 'Buy-in',
  stakes: 'Stakes',
  odds: (p, n) => `win ${p}% vs ${n}`,
  suited: 'suited',
  offsuit: 'offsuit',
  choose: "Texas Hold'em · pick your opponents' level:",
  stats: 'Stats (games · wins · hands won · best stack):',
  howMany: 'how many opponents?',
  level: 'Level',
  back: 'Back',
  language: 'Language',
  hand: 'hand',
  blinds: 'blinds',
  yourTurn: 'Your move',
  toCall: 'to call',
  turnOf: n => `${n} is thinking…`,
  waiting: 'waiting for opponents…',
  handOver: 'Hand over',
  gameOver: 'Game over',
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  allIn: 'All-in',
  raise: 'Raise',
  betTo: 'Raise to',
  halfPot: '½ pot',
  potButton: 'Pot',
  next: 'Next',
  newGame: 'New game',
  menu: 'Menu',
  quit: 'Quit',
  quitAsk: 'Quit to the menu? This game will end.',
  yes: 'Yes',
  no: 'No',
  streets: { preflop: 'PRE-FLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', done: 'HAND OVER' },
  showdown: 'SHOWDOWN',
  pot: 'POT',
  thinking: 'thinks…',
  yourTurnSeat: 'your move',
  folded: 'fold',
  out: 'busted',
  youTake: n => `You take ${n}`,
  takes: (a, n) => `${a} takes ${n}`,
  split: n => `Pot ${n} split`,
  othersFolded: 'everyone else folded',
  lostAll: h => `Out of chips on hand #${h}`,
  champion: s => `Every opponent is broke · stack ${s}`,
  won: (d, s) => `You won ${d} · stack ${s}`,
  foldLoss: d => `Folded · lost ${d}`,
  foldedYou: 'You folded',
  even: 'Pot split — you broke even',
  lost: (d, s) => `You lost ${d} · stack ${s}`,
  acts: { fold: 'fold', check: 'check', call: 'call', allin: 'all-in', bet: 'bet', raise: 'raise to' },
  logHand: n => `— Hand #${n} —`,
  logBlinds: (a, b) => `Blinds up: ${a}/${b}`,
  logOut: n => `${n} is out`,
  logOver: w => (w ? 'Every opponent is broke — you win!' : 'Out of chips — game over'),
  logTakes: (a, n) => `${a} takes the pot ${n}`,
  logWins: (a, n) => `${a} wins ${n}`,
  hands: {
    high: r => `High card ${r}`,
    pair: r => `Pair of ${r}`,
    two: (a, b) => `Two pair ${a} & ${b}`,
    trips: r => `Trips ${r}`,
    straight: r => `Straight to ${r}`,
    flush: r => `Flush, ${r} high`,
    full: (a, b) => `Full house ${a} over ${b}`,
    quads: r => `Quads ${r}`,
    straightFlush: r => `Straight flush to ${r}`,
  },
  opened: 'Poker is open in the pane. ctrl+x tab — focus the pane, Esc — back to the prompt.',
  description: "Claude Poker · Texas Hold'em in a pane: play while Claude works",
}

const zh: Dict = {
  name: '中文',
  flag: '🇨🇳',
  levels: { novice: '新手', medium: '中级', pro: '高手' },
  bots: ['小明', '小红', '阿强', '丽丽', '大伟', '娜娜'],
  you: '你',
  hint: '你的手牌',
  setup: '牌桌设置',
  nameLabel: '你的名字',
  namePlaceholder: '输入后按 Enter',
  buyIn: '买入',
  stakes: '级别',
  odds: (p, n) => `胜率 ${p}%（对 ${n} 人）`,
  suited: '同花',
  offsuit: '杂色',
  choose: '德州扑克 · 选择对手水平：',
  stats: '统计（局数 · 胜局 · 赢下手数 · 最高筹码）：',
  howMany: '几位对手？',
  level: '水平',
  back: '返回',
  language: '语言',
  hand: '手牌',
  blinds: '盲注',
  yourTurn: '轮到你',
  toCall: '需跟',
  turnOf: n => `${n} 思考中…`,
  waiting: '等待对手…',
  handOver: '本手结束',
  gameOver: '游戏结束',
  fold: '弃牌',
  check: '过牌',
  call: '跟注',
  allIn: '全下',
  raise: '加注',
  betTo: '加注到',
  halfPot: '半池',
  potButton: '满池',
  next: '继续',
  newGame: '新游戏',
  menu: '菜单',
  quit: '退出',
  quitAsk: '退出到菜单？本局游戏将结束。',
  yes: '是',
  no: '否',
  streets: { preflop: '翻牌前', flop: '翻牌', turn: '转牌', river: '河牌', done: '本手结束' },
  showdown: '摊牌',
  pot: '底池',
  thinking: '思考中…',
  yourTurnSeat: '轮到你',
  folded: '弃牌',
  out: '出局',
  youTake: n => `你赢得 ${n}`,
  takes: (a, n) => `${a} 赢得 ${n}`,
  split: n => `底池 ${n} 平分`,
  othersFolded: '其他人都弃牌了',
  lostAll: h => `第 ${h} 手筹码输光`,
  champion: s => `所有对手破产 · 筹码 ${s}`,
  won: (d, s) => `你赢了 ${d} · 筹码 ${s}`,
  foldLoss: d => `弃牌 · 损失 ${d}`,
  foldedYou: '你弃牌了',
  even: '平分底池 — 不输不赢',
  lost: (d, s) => `你输了 ${d} · 筹码 ${s}`,
  acts: { fold: '弃牌', check: '过牌', call: '跟注', allin: '全下', bet: '下注', raise: '加注到' },
  logHand: n => `— 第 ${n} 手 —`,
  logBlinds: (a, b) => `盲注升至 ${a}/${b}`,
  logOut: n => `${n} 出局`,
  logOver: w => (w ? '所有对手破产 — 你赢了！' : '筹码输光 — 游戏结束'),
  logTakes: (a, n) => `${a} 拿下底池 ${n}`,
  logWins: (a, n) => `${a} 赢得 ${n}`,
  hands: {
    high: r => `高牌 ${r}`,
    pair: r => `一对 ${r}`,
    two: (a, b) => `两对 ${a} 和 ${b}`,
    trips: r => `三条 ${r}`,
    straight: r => `顺子（${r} 高）`,
    flush: r => `同花（${r} 高）`,
    full: (a, b) => `葫芦 ${a} 带 ${b}`,
    quads: r => `四条 ${r}`,
    straightFlush: r => `同花顺（${r} 高）`,
  },
  opened: '扑克已在面板中打开。ctrl+x tab 切换到面板，Esc 返回输入框。',
  description: 'Claude Poker · 面板里的德州扑克：边等 Claude 边玩',
}

const es: Dict = {
  name: 'Español',
  flag: '🇪🇸',
  levels: { novice: 'Principiante', medium: 'Intermedio', pro: 'Pro' },
  bots: ['Pablo', 'Lucía', 'Diego', 'Sofía', 'Javi', 'Elena'],
  you: 'Tú',
  hint: 'Tu mano',
  setup: 'Configuración de la mesa',
  nameLabel: 'Tu nombre',
  namePlaceholder: 'escribe y pulsa Enter',
  buyIn: 'Buy-in',
  stakes: 'Ciegas',
  odds: (p, n) => `${p}% de ganar contra ${n}`,
  suited: 'del mismo palo',
  offsuit: 'de distinto palo',
  choose: "Texas Hold'em · elige el nivel de los rivales:",
  stats: 'Estadísticas (partidas · victorias · manos ganadas · mejor pila):',
  howMany: '¿cuántos rivales?',
  level: 'Nivel',
  back: 'Atrás',
  language: 'Idioma',
  hand: 'mano',
  blinds: 'ciegas',
  yourTurn: 'Tu turno',
  toCall: 'para igualar',
  turnOf: n => `${n} está pensando…`,
  waiting: 'esperando a los rivales…',
  handOver: 'Mano terminada',
  gameOver: 'Fin de la partida',
  fold: 'Retirarse',
  check: 'Pasar',
  call: 'Igualar',
  allIn: 'All-in',
  raise: 'Subir',
  betTo: 'Subir a',
  halfPot: '½ bote',
  potButton: 'Bote',
  next: 'Siguiente',
  newGame: 'Nueva partida',
  menu: 'Menú',
  quit: 'Salir',
  quitAsk: '¿Salir al menú? La partida terminará.',
  yes: 'Sí',
  no: 'No',
  streets: { preflop: 'PREFLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', done: 'FIN DE MANO' },
  showdown: 'SHOWDOWN',
  pot: 'BOTE',
  thinking: 'piensa…',
  yourTurnSeat: 'tu turno',
  folded: 'retirado',
  out: 'eliminado',
  youTake: n => `Te llevas ${n}`,
  takes: (a, n) => `${a} se lleva ${n}`,
  split: n => `Bote ${n} repartido`,
  othersFolded: 'los demás se retiraron',
  lostAll: h => `Sin fichas en la mano #${h}`,
  champion: s => `Todos los rivales en bancarrota · pila ${s}`,
  won: (d, s) => `Ganaste ${d} · pila ${s}`,
  foldLoss: d => `Te retiraste · perdiste ${d}`,
  foldedYou: 'Te retiraste',
  even: 'Bote repartido — quedas igual',
  lost: (d, s) => `Perdiste ${d} · pila ${s}`,
  acts: { fold: 'se retira', check: 'pasa', call: 'iguala', allin: 'all-in', bet: 'apuesta', raise: 'sube a' },
  logHand: n => `— Mano #${n} —`,
  logBlinds: (a, b) => `Suben las ciegas: ${a}/${b}`,
  logOut: n => `${n} queda eliminado`,
  logOver: w => (w ? '¡Todos los rivales en bancarrota — ganaste!' : 'Sin fichas — fin de la partida'),
  logTakes: (a, n) => `${a} se lleva el bote ${n}`,
  logWins: (a, n) => `${a} gana ${n}`,
  hands: {
    high: r => `Carta alta ${r}`,
    pair: r => `Pareja de ${r}`,
    two: (a, b) => `Doble pareja ${a} y ${b}`,
    trips: r => `Trío de ${r}`,
    straight: r => `Escalera al ${r}`,
    flush: r => `Color, ${r} alta`,
    full: (a, b) => `Full ${a} con ${b}`,
    quads: r => `Póker de ${r}`,
    straightFlush: r => `Escalera de color al ${r}`,
  },
  opened: 'El póker está abierto en el panel. ctrl+x tab — ir al panel, Esc — volver al prompt.',
  description: "Claude Poker · Texas Hold'em en un panel: juega mientras Claude trabaja",
}

const fr: Dict = {
  name: 'Français',
  flag: '🇫🇷',
  levels: { novice: 'Débutant', medium: 'Intermédiaire', pro: 'Pro' },
  bots: ['Louis', 'Chloé', 'Hugo', 'Léa', 'Théo', 'Manon'],
  you: 'Vous',
  hint: 'Votre main',
  setup: 'Réglages de la table',
  nameLabel: 'Votre nom',
  namePlaceholder: 'tapez puis Entrée',
  buyIn: 'Cave',
  stakes: 'Blindes',
  odds: (p, n) => `${p}% de gagner contre ${n}`,
  suited: 'assorties',
  offsuit: 'dépareillées',
  choose: "Texas Hold'em · choisissez le niveau des adversaires :",
  stats: 'Stats (parties · victoires · mains gagnées · meilleur tapis) :',
  howMany: "combien d'adversaires ?",
  level: 'Niveau',
  back: 'Retour',
  language: 'Langue',
  hand: 'main',
  blinds: 'blindes',
  yourTurn: 'À vous',
  toCall: 'à suivre',
  turnOf: n => `${n} réfléchit…`,
  waiting: 'les adversaires jouent…',
  handOver: 'Main terminée',
  gameOver: 'Partie terminée',
  fold: 'Se coucher',
  check: 'Checker',
  call: 'Suivre',
  allIn: 'Tapis',
  raise: 'Relancer',
  betTo: 'Relancer à',
  halfPot: '½ pot',
  potButton: 'Pot',
  next: 'Suivant',
  newGame: 'Nouvelle partie',
  menu: 'Menu',
  quit: 'Quitter',
  quitAsk: 'Revenir au menu ? La partie sera terminée.',
  yes: 'Oui',
  no: 'Non',
  streets: { preflop: 'PRÉFLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVIÈRE', done: 'MAIN TERMINÉE' },
  showdown: 'ABATTAGE',
  pot: 'POT',
  thinking: 'pense…',
  yourTurnSeat: 'à vous',
  folded: 'couché',
  out: 'éliminé',
  youTake: n => `Vous remportez ${n}`,
  takes: (a, n) => `${a} remporte ${n}`,
  split: n => `Pot ${n} partagé`,
  othersFolded: 'les autres se sont couchés',
  lostAll: h => `Plus de jetons à la main #${h}`,
  champion: s => `Tous les adversaires ruinés · tapis ${s}`,
  won: (d, s) => `Vous gagnez ${d} · tapis ${s}`,
  foldLoss: d => `Couché · perdu ${d}`,
  foldedYou: 'Vous vous êtes couché',
  even: 'Pot partagé — à l’équilibre',
  lost: (d, s) => `Vous perdez ${d} · tapis ${s}`,
  acts: { fold: 'se couche', check: 'check', call: 'suit', allin: 'tapis', bet: 'mise', raise: 'relance à' },
  logHand: n => `— Main #${n} —`,
  logBlinds: (a, b) => `Les blindes montent : ${a}/${b}`,
  logOut: n => `${n} est éliminé`,
  logOver: w => (w ? 'Tous les adversaires sont ruinés — victoire !' : 'Plus de jetons — partie terminée'),
  logTakes: (a, n) => `${a} remporte le pot ${n}`,
  logWins: (a, n) => `${a} gagne ${n}`,
  hands: {
    high: r => `Hauteur ${r}`,
    pair: r => `Paire de ${r}`,
    two: (a, b) => `Double paire ${a} et ${b}`,
    trips: r => `Brelan de ${r}`,
    straight: r => `Quinte au ${r}`,
    flush: r => `Couleur, ${r} haute`,
    full: (a, b) => `Full ${a} par ${b}`,
    quads: r => `Carré de ${r}`,
    straightFlush: r => `Quinte flush au ${r}`,
  },
  opened: 'Le poker est ouvert dans le panneau. ctrl+x tab — aller au panneau, Échap — revenir au prompt.',
  description: "Claude Poker · Texas Hold'em dans un panneau : jouez pendant que Claude travaille",
}

const de: Dict = {
  name: 'Deutsch',
  flag: '🇩🇪',
  levels: { novice: 'Anfänger', medium: 'Fortgeschritten', pro: 'Profi' },
  bots: ['Lukas', 'Mia', 'Paul', 'Lena', 'Finn', 'Emma'],
  you: 'Du',
  hint: 'Deine Hand',
  setup: 'Tisch-Einstellungen',
  nameLabel: 'Dein Name',
  namePlaceholder: 'tippen und Enter drücken',
  buyIn: 'Buy-in',
  stakes: 'Blinds',
  odds: (p, n) => `${p}% Gewinnchance gegen ${n}`,
  suited: 'suited',
  offsuit: 'offsuit',
  choose: "Texas Hold'em · wähle die Stärke der Gegner:",
  stats: 'Statistik (Partien · Siege · gewonnene Hände · bester Stack):',
  howMany: 'wie viele Gegner?',
  level: 'Stufe',
  back: 'Zurück',
  language: 'Sprache',
  hand: 'Hand',
  blinds: 'Blinds',
  yourTurn: 'Du bist dran',
  toCall: 'zum Callen',
  turnOf: n => `${n} überlegt…`,
  waiting: 'Gegner sind dran…',
  handOver: 'Hand vorbei',
  gameOver: 'Spiel vorbei',
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  allIn: 'All-in',
  raise: 'Raise',
  betTo: 'Erhöhen auf',
  halfPot: '½ Pot',
  potButton: 'Pot',
  next: 'Weiter',
  newGame: 'Neues Spiel',
  menu: 'Menü',
  quit: 'Beenden',
  quitAsk: 'Zurück zum Menü? Das Spiel wird beendet.',
  yes: 'Ja',
  no: 'Nein',
  streets: { preflop: 'PREFLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', done: 'HAND VORBEI' },
  showdown: 'SHOWDOWN',
  pot: 'POT',
  thinking: 'denkt…',
  yourTurnSeat: 'dran',
  folded: 'gefoldet',
  out: 'raus',
  youTake: n => `Du gewinnst ${n}`,
  takes: (a, n) => `${a} gewinnt ${n}`,
  split: n => `Pot ${n} geteilt`,
  othersFolded: 'alle anderen haben gefoldet',
  lostAll: h => `Keine Chips mehr in Hand #${h}`,
  champion: s => `Alle Gegner pleite · Stack ${s}`,
  won: (d, s) => `Du gewinnst ${d} · Stack ${s}`,
  foldLoss: d => `Gefoldet · minus ${d}`,
  foldedYou: 'Du hast gefoldet',
  even: 'Pot geteilt — plus minus null',
  lost: (d, s) => `Du verlierst ${d} · Stack ${s}`,
  acts: { fold: 'fold', check: 'check', call: 'call', allin: 'all-in', bet: 'bet', raise: 'raise auf' },
  logHand: n => `— Hand #${n} —`,
  logBlinds: (a, b) => `Blinds steigen: ${a}/${b}`,
  logOut: n => `${n} ist raus`,
  logOver: w => (w ? 'Alle Gegner pleite — du gewinnst!' : 'Keine Chips mehr — Spiel vorbei'),
  logTakes: (a, n) => `${a} nimmt den Pot ${n}`,
  logWins: (a, n) => `${a} gewinnt ${n}`,
  hands: {
    high: r => `High Card ${r}`,
    pair: r => `Paar ${r}`,
    two: (a, b) => `Zwei Paare ${a} und ${b}`,
    trips: r => `Drilling ${r}`,
    straight: r => `Straße bis ${r}`,
    flush: r => `Flush, ${r} hoch`,
    full: (a, b) => `Full House ${a} über ${b}`,
    quads: r => `Vierling ${r}`,
    straightFlush: r => `Straight Flush bis ${r}`,
  },
  opened: 'Poker ist im Panel geöffnet. ctrl+x tab — zum Panel, Esc — zurück zum Prompt.',
  description: "Claude Poker · Texas Hold'em im Panel: spielen, während Claude arbeitet",
}

const ja: Dict = {
  name: '日本語',
  flag: '🇯🇵',
  levels: { novice: '初心者', medium: '中級', pro: 'プロ' },
  bots: ['タロウ', 'ハナ', 'ケン', 'ユキ', 'ソラ', 'ミオ'],
  you: 'あなた',
  hint: 'あなたの手',
  setup: 'テーブル設定',
  nameLabel: '名前',
  namePlaceholder: '入力して Enter',
  buyIn: 'バイイン',
  stakes: 'ステークス',
  odds: (p, n) => `勝率 ${p}%（相手 ${n} 人）`,
  suited: 'スーテッド',
  offsuit: 'オフスート',
  choose: 'テキサスホールデム · 対戦相手のレベルを選択：',
  stats: '成績（ゲーム · 勝利 · 勝ったハンド · 最高スタック）：',
  howMany: '対戦相手の人数は？',
  level: 'レベル',
  back: '戻る',
  language: '言語',
  hand: 'ハンド',
  blinds: 'ブラインド',
  yourTurn: 'あなたの番',
  toCall: 'コール額',
  turnOf: n => `${n} が考え中…`,
  waiting: '相手の番…',
  handOver: 'ハンド終了',
  gameOver: 'ゲーム終了',
  fold: 'フォールド',
  check: 'チェック',
  call: 'コール',
  allIn: 'オールイン',
  raise: 'レイズ',
  betTo: 'レイズ額',
  halfPot: '½ポット',
  potButton: 'ポット',
  next: '次へ',
  newGame: '新しいゲーム',
  menu: 'メニュー',
  quit: '終了',
  quitAsk: 'メニューに戻りますか？このゲームは終了します。',
  yes: 'はい',
  no: 'いいえ',
  streets: { preflop: 'プリフロップ', flop: 'フロップ', turn: 'ターン', river: 'リバー', done: 'ハンド終了' },
  showdown: 'ショーダウン',
  pot: 'ポット',
  thinking: '考え中…',
  yourTurnSeat: '手番',
  folded: 'フォールド',
  out: '脱落',
  youTake: n => `${n} を獲得`,
  takes: (a, n) => `${a} が ${n} を獲得`,
  split: n => `ポット ${n} を分配`,
  othersFolded: '他の全員がフォールド',
  lostAll: h => `ハンド #${h} でチップが尽きた`,
  champion: s => `全員破産 · スタック ${s}`,
  won: (d, s) => `${d} 勝ち · スタック ${s}`,
  foldLoss: d => `フォールド · ${d} 負け`,
  foldedYou: 'フォールドしました',
  even: 'ポット分配 — 損得なし',
  lost: (d, s) => `${d} 負け · スタック ${s}`,
  acts: { fold: 'フォールド', check: 'チェック', call: 'コール', allin: 'オールイン', bet: 'ベット', raise: 'レイズ' },
  logHand: n => `— ハンド #${n} —`,
  logBlinds: (a, b) => `ブラインド上昇：${a}/${b}`,
  logOut: n => `${n} が脱落`,
  logOver: w => (w ? '全員破産 — あなたの勝ち！' : 'チップが尽きた — ゲーム終了'),
  logTakes: (a, n) => `${a} がポット ${n} を獲得`,
  logWins: (a, n) => `${a} が ${n} 勝ち`,
  hands: {
    high: r => `ハイカード ${r}`,
    pair: r => `ワンペア ${r}`,
    two: (a, b) => `ツーペア ${a} と ${b}`,
    trips: r => `スリーカード ${r}`,
    straight: r => `ストレート（${r} ハイ）`,
    flush: r => `フラッシュ（${r} ハイ）`,
    full: (a, b) => `フルハウス ${a} と ${b}`,
    quads: r => `フォーカード ${r}`,
    straightFlush: r => `ストレートフラッシュ（${r} ハイ）`,
  },
  opened: 'ポーカーをパネルで開きました。ctrl+x tab でパネルへ、Esc でプロンプトに戻ります。',
  description: 'Claude Poker · パネルでテキサスホールデム：Claude の作業中に遊べます',
}

const pt: Dict = {
  name: 'Português',
  flag: '🇵🇹',
  levels: { novice: 'Iniciante', medium: 'Intermediário', pro: 'Pro' },
  bots: ['João', 'Ana', 'Pedro', 'Bia', 'Rafa', 'Luísa'],
  you: 'Você',
  hint: 'Sua mão',
  setup: 'Configuração da mesa',
  nameLabel: 'Seu nome',
  namePlaceholder: 'digite e tecle Enter',
  buyIn: 'Buy-in',
  stakes: 'Blinds',
  odds: (p, n) => `${p}% de vitória contra ${n}`,
  suited: 'do mesmo naipe',
  offsuit: 'naipes diferentes',
  choose: "Texas Hold'em · escolha o nível dos adversários:",
  stats: 'Estatísticas (partidas · vitórias · mãos ganhas · maior pilha):',
  howMany: 'quantos adversários?',
  level: 'Nível',
  back: 'Voltar',
  language: 'Idioma',
  hand: 'mão',
  blinds: 'blinds',
  yourTurn: 'Sua vez',
  toCall: 'para pagar',
  turnOf: n => `${n} está pensando…`,
  waiting: 'aguardando adversários…',
  handOver: 'Mão encerrada',
  gameOver: 'Fim de jogo',
  fold: 'Desistir',
  check: 'Passar',
  call: 'Pagar',
  allIn: 'All-in',
  raise: 'Aumentar',
  betTo: 'Aumentar para',
  halfPot: '½ pote',
  potButton: 'Pote',
  next: 'Próxima',
  newGame: 'Novo jogo',
  menu: 'Menu',
  quit: 'Sair',
  quitAsk: 'Sair para o menu? O jogo será encerrado.',
  yes: 'Sim',
  no: 'Não',
  streets: { preflop: 'PRÉ-FLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', done: 'FIM DA MÃO' },
  showdown: 'SHOWDOWN',
  pot: 'POTE',
  thinking: 'pensa…',
  yourTurnSeat: 'sua vez',
  folded: 'desistiu',
  out: 'eliminado',
  youTake: n => `Você leva ${n}`,
  takes: (a, n) => `${a} leva ${n}`,
  split: n => `Pote ${n} dividido`,
  othersFolded: 'os outros desistiram',
  lostAll: h => `Sem fichas na mão #${h}`,
  champion: s => `Todos os adversários falidos · pilha ${s}`,
  won: (d, s) => `Você ganhou ${d} · pilha ${s}`,
  foldLoss: d => `Desistiu · perdeu ${d}`,
  foldedYou: 'Você desistiu',
  even: 'Pote dividido — empatou',
  lost: (d, s) => `Você perdeu ${d} · pilha ${s}`,
  acts: { fold: 'desiste', check: 'passa', call: 'paga', allin: 'all-in', bet: 'aposta', raise: 'aumenta para' },
  logHand: n => `— Mão #${n} —`,
  logBlinds: (a, b) => `Blinds sobem: ${a}/${b}`,
  logOut: n => `${n} foi eliminado`,
  logOver: w => (w ? 'Todos os adversários falidos — você venceu!' : 'Sem fichas — fim de jogo'),
  logTakes: (a, n) => `${a} leva o pote ${n}`,
  logWins: (a, n) => `${a} ganha ${n}`,
  hands: {
    high: r => `Carta alta ${r}`,
    pair: r => `Par de ${r}`,
    two: (a, b) => `Dois pares ${a} e ${b}`,
    trips: r => `Trinca de ${r}`,
    straight: r => `Sequência até ${r}`,
    flush: r => `Flush, ${r} alto`,
    full: (a, b) => `Full house ${a} com ${b}`,
    quads: r => `Quadra de ${r}`,
    straightFlush: r => `Straight flush até ${r}`,
  },
  opened: 'O pôquer está aberto no painel. ctrl+x tab — ir ao painel, Esc — voltar ao prompt.',
  description: "Claude Poker · Texas Hold'em num painel: jogue enquanto o Claude trabalha",
}

const ru: Dict = {
  name: 'Русский',
  flag: '🇷🇺',
  levels: { novice: 'Новичок', medium: 'Средний', pro: 'Профи' },
  bots: ['Боб', 'Ева', 'Макс', 'Лиза', 'Гоша', 'Ника'],
  you: 'Вы',
  hint: 'Ваша рука',
  setup: 'Настройки стола',
  nameLabel: 'Ваше имя',
  namePlaceholder: 'введите и нажмите Enter',
  buyIn: 'Бай-ин',
  stakes: 'Ставки',
  odds: (p, n) => `шанс победы ${p}% против ${n}`,
  suited: 'одномастные',
  offsuit: 'разномастные',
  choose: 'Техасский холдем · выберите уровень соперников:',
  stats: 'Статистика (партии · победы · раздачи · лучший стек):',
  howMany: 'сколько соперников за столом?',
  level: 'Уровень',
  back: 'Назад',
  language: 'Язык',
  hand: 'раздача',
  blinds: 'блайнды',
  yourTurn: 'Ваш ход',
  toCall: 'к коллу',
  turnOf: n => `Ходит ${n}…`,
  waiting: 'ждём соперников…',
  handOver: 'Раздача окончена',
  gameOver: 'Партия окончена',
  fold: 'Фолд',
  check: 'Чек',
  call: 'Колл',
  allIn: 'Олл-ин',
  raise: 'Рейз',
  betTo: 'Ставка до',
  halfPot: '½ банка',
  potButton: 'Банк',
  next: 'Дальше',
  newGame: 'Новая игра',
  menu: 'Меню',
  quit: 'Выйти',
  quitAsk: 'Выйти в меню? Партия будет окончена.',
  yes: 'Да',
  no: 'Нет',
  streets: { preflop: 'ПРЕФЛОП', flop: 'ФЛОП', turn: 'ТЁРН', river: 'РИВЕР', done: 'КОНЕЦ РАЗДАЧИ' },
  showdown: 'ВСКРЫТИЕ',
  pot: 'БАНК',
  thinking: 'думает…',
  yourTurnSeat: 'ваш ход',
  folded: 'фолд',
  out: 'выбыл',
  youTake: n => `Вы забираете ${n}`,
  takes: (a, n) => `${a} забирает ${n}`,
  split: n => `Банк ${n} поделён`,
  othersFolded: 'остальные сбросили',
  lostAll: h => `Фишки закончились на раздаче #${h}`,
  champion: s => `Все соперники разорены · стек ${s}`,
  won: (d, s) => `Вы выиграли ${d} · стек ${s}`,
  foldLoss: d => `Сброс · минус ${d}`,
  foldedYou: 'Вы сбросили карты',
  even: 'Банк поделён — вы при своих',
  lost: (d, s) => `Вы проиграли ${d} · стек ${s}`,
  acts: { fold: 'фолд', check: 'чек', call: 'колл', allin: 'олл-ин', bet: 'бет', raise: 'рейз до' },
  logHand: n => `— Раздача #${n} —`,
  logBlinds: (a, b) => `Блайнды растут: ${a}/${b}`,
  logOut: n => `${n} выбывает`,
  logOver: w => (w ? 'Все соперники разорены — победа!' : 'Фишки закончились — игра окончена'),
  logTakes: (a, n) => `${a} забирает банк ${n}`,
  logWins: (a, n) => `${a} выигрывает ${n}`,
  hands: {
    high: r => `Старшая карта ${r}`,
    pair: r => `Пара ${r}`,
    two: (a, b) => `Две пары ${a} и ${b}`,
    trips: r => `Сет ${r}`,
    straight: r => `Стрит до ${r}`,
    flush: r => `Флеш, старшая ${r}`,
    full: (a, b) => `Фулл-хаус ${a} на ${b}`,
    quads: r => `Каре ${r}`,
    straightFlush: r => `Стрит-флеш до ${r}`,
  },
  opened: 'Покер открыт в панели. ctrl+x tab — переключиться в панель, Esc — вернуться к промпту.',
  description: 'Claude Poker · Техасский холдем в панели: играйте, пока Claude работает',
}

const ko: Dict = {
  name: '한국어',
  flag: '🇰🇷',
  levels: { novice: '초보', medium: '중수', pro: '프로' },
  bots: ['민수', '지은', '철수', '영희', '준호', '하나'],
  you: '나',
  hint: '내 패',
  setup: '테이블 설정',
  nameLabel: '이름',
  namePlaceholder: '입력 후 Enter',
  buyIn: '바이인',
  stakes: '블라인드',
  odds: (p, n) => `승률 ${p}% (상대 ${n}명)`,
  suited: '수티드',
  offsuit: '오프수트',
  choose: '텍사스 홀덤 · 상대 난이도를 고르세요:',
  stats: '통계 (게임 · 승리 · 이긴 핸드 · 최고 스택):',
  howMany: '상대는 몇 명?',
  level: '난이도',
  back: '뒤로',
  language: '언어',
  hand: '핸드',
  blinds: '블라인드',
  yourTurn: '내 차례',
  toCall: '콜 금액',
  turnOf: n => `${n} 고민 중…`,
  waiting: '상대 차례…',
  handOver: '핸드 종료',
  gameOver: '게임 종료',
  fold: '폴드',
  check: '체크',
  call: '콜',
  allIn: '올인',
  raise: '레이즈',
  betTo: '레이즈 금액',
  halfPot: '½ 팟',
  potButton: '팟',
  next: '다음',
  newGame: '새 게임',
  menu: '메뉴',
  quit: '나가기',
  quitAsk: '메뉴로 나갈까요? 이 게임은 끝납니다.',
  yes: '예',
  no: '아니요',
  streets: { preflop: '프리플롭', flop: '플롭', turn: '턴', river: '리버', done: '핸드 종료' },
  showdown: '쇼다운',
  pot: '팟',
  thinking: '고민 중…',
  yourTurnSeat: '내 차례',
  folded: '폴드',
  out: '탈락',
  youTake: n => `${n} 획득`,
  takes: (a, n) => `${a} ${n} 획득`,
  split: n => `팟 ${n} 분배`,
  othersFolded: '나머지 모두 폴드',
  lostAll: h => `핸드 #${h}에서 칩 소진`,
  champion: s => `모든 상대 파산 · 스택 ${s}`,
  won: (d, s) => `${d} 승리 · 스택 ${s}`,
  foldLoss: d => `폴드 · ${d} 손해`,
  foldedYou: '폴드했습니다',
  even: '팟 분배 — 본전',
  lost: (d, s) => `${d} 패배 · 스택 ${s}`,
  acts: { fold: '폴드', check: '체크', call: '콜', allin: '올인', bet: '벳', raise: '레이즈' },
  logHand: n => `— 핸드 #${n} —`,
  logBlinds: (a, b) => `블라인드 상승: ${a}/${b}`,
  logOut: n => `${n} 탈락`,
  logOver: w => (w ? '모든 상대 파산 — 승리!' : '칩 소진 — 게임 종료'),
  logTakes: (a, n) => `${a} 팟 ${n} 획득`,
  logWins: (a, n) => `${a} ${n} 승리`,
  hands: {
    high: r => `하이카드 ${r}`,
    pair: r => `원페어 ${r}`,
    two: (a, b) => `투페어 ${a}, ${b}`,
    trips: r => `트리플 ${r}`,
    straight: r => `스트레이트 (${r} 하이)`,
    flush: r => `플러시 (${r} 하이)`,
    full: (a, b) => `풀하우스 ${a}, ${b}`,
    quads: r => `포카드 ${r}`,
    straightFlush: r => `스트레이트 플러시 (${r} 하이)`,
  },
  opened: '포커가 패널에서 열렸습니다. ctrl+x tab — 패널로, Esc — 프롬프트로.',
  description: 'Claude Poker · 패널에서 텍사스 홀덤: Claude가 일하는 동안 플레이',
}

const it: Dict = {
  name: 'Italiano',
  flag: '🇮🇹',
  levels: { novice: 'Principiante', medium: 'Intermedio', pro: 'Pro' },
  bots: ['Marco', 'Giulia', 'Luca', 'Sara', 'Matteo', 'Chiara'],
  you: 'Tu',
  hint: 'La tua mano',
  setup: 'Impostazioni del tavolo',
  nameLabel: 'Il tuo nome',
  namePlaceholder: 'scrivi e premi Invio',
  buyIn: 'Buy-in',
  stakes: 'Bui',
  odds: (p, n) => `${p}% di vincere contro ${n}`,
  suited: 'dello stesso seme',
  offsuit: 'di semi diversi',
  choose: "Texas Hold'em · scegli il livello degli avversari:",
  stats: 'Statistiche (partite · vittorie · mani vinte · stack migliore):',
  howMany: 'quanti avversari?',
  level: 'Livello',
  back: 'Indietro',
  language: 'Lingua',
  hand: 'mano',
  blinds: 'bui',
  yourTurn: 'Tocca a te',
  toCall: 'per chiamare',
  turnOf: n => `${n} sta pensando…`,
  waiting: 'tocca agli avversari…',
  handOver: 'Mano finita',
  gameOver: 'Partita finita',
  fold: 'Passa',
  check: 'Check',
  call: 'Chiama',
  allIn: 'All-in',
  raise: 'Rilancia',
  betTo: 'Rilancia a',
  halfPot: '½ piatto',
  potButton: 'Piatto',
  next: 'Avanti',
  newGame: 'Nuova partita',
  menu: 'Menu',
  quit: 'Esci',
  quitAsk: 'Tornare al menu? La partita finirà.',
  yes: 'Sì',
  no: 'No',
  streets: { preflop: 'PREFLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', done: 'MANO FINITA' },
  showdown: 'SHOWDOWN',
  pot: 'PIATTO',
  thinking: 'pensa…',
  yourTurnSeat: 'a te',
  folded: 'passato',
  out: 'eliminato',
  youTake: n => `Vinci ${n}`,
  takes: (a, n) => `${a} vince ${n}`,
  split: n => `Piatto ${n} diviso`,
  othersFolded: 'gli altri hanno passato',
  lostAll: h => `Fiches finite alla mano #${h}`,
  champion: s => `Tutti gli avversari al verde · stack ${s}`,
  won: (d, s) => `Hai vinto ${d} · stack ${s}`,
  foldLoss: d => `Passato · perso ${d}`,
  foldedYou: 'Hai passato',
  even: 'Piatto diviso — in pari',
  lost: (d, s) => `Hai perso ${d} · stack ${s}`,
  acts: { fold: 'passa', check: 'check', call: 'chiama', allin: 'all-in', bet: 'punta', raise: 'rilancia a' },
  logHand: n => `— Mano #${n} —`,
  logBlinds: (a, b) => `I bui salgono: ${a}/${b}`,
  logOut: n => `${n} è eliminato`,
  logOver: w => (w ? 'Tutti gli avversari al verde — hai vinto!' : 'Fiches finite — partita finita'),
  logTakes: (a, n) => `${a} prende il piatto ${n}`,
  logWins: (a, n) => `${a} vince ${n}`,
  hands: {
    high: r => `Carta alta ${r}`,
    pair: r => `Coppia di ${r}`,
    two: (a, b) => `Doppia coppia ${a} e ${b}`,
    trips: r => `Tris di ${r}`,
    straight: r => `Scala al ${r}`,
    flush: r => `Colore, ${r} alta`,
    full: (a, b) => `Full ${a} e ${b}`,
    quads: r => `Poker di ${r}`,
    straightFlush: r => `Scala colore al ${r}`,
  },
  opened: 'Il poker è aperto nel pannello. ctrl+x tab — vai al pannello, Esc — torna al prompt.',
  description: "Claude Poker · Texas Hold'em in un pannello: gioca mentre Claude lavora",
}

export const DICTS: Record<Lang, Dict> = { en, zh, es, fr, de, ja, pt, ru, ko, it }
export const LANGS = Object.keys(DICTS) as Lang[]

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && value in DICTS
}

/** The language a locale string such as `ru_RU.UTF-8` or `pt-BR` names, if it is one of ours. */
export function langOf(locale: string | undefined): Lang | undefined {
  const code = locale?.toLowerCase().slice(0, 2)
  return isLang(code) ? code : undefined
}

const rank = (r: number) => (RANKS[r] === 'T' ? '10' : RANKS[r]!)

export function describe(t: Dict, value: number): string {
  const [a, b] = ranksOf(value).map(rank) as [string, string]
  const h = t.hands
  switch (category(value)) {
    case 0:
      return h.high(a)
    case 1:
      return h.pair(a)
    case 2:
      return h.two(a, b)
    case 3:
      return h.trips(a)
    case 4:
      return h.straight(a)
    case 5:
      return h.flush(a)
    case 6:
      return h.full(a, b)
    case 7:
      return h.quads(a)
    default:
      return h.straightFlush(a)
  }
}

export function actText(t: Dict, act: Act | null | undefined): string {
  if (!act) return ''
  switch (act.k) {
    case 'fold':
    case 'check':
      return t.acts[act.k]
    case 'sb':
      return `SB ${act.n}`
    case 'bb':
      return `BB ${act.n}`
    default:
      return `${t.acts[act.k]} ${act.n}`
  }
}

export function seatName(t: Dict, g: Game, seat: number): string {
  const s = g.seats[seat]
  return !s ? '?' : s.isHuman ? s.name || t.you : s.name
}

export function entryText(t: Dict, g: Game, e: Entry): string {
  const who = (seat: number) => seatName(t, g, seat)
  switch (e.k) {
    case 'hand':
      return t.logHand(e.n)
    case 'blinds':
      return t.logBlinds(e.sb, e.bb)
    case 'street':
      return `${t.streets[e.street]}: ${e.cards.map(c => cardText(c).replace('T', '10')).join(' ')}`
    case 'act':
      return `${who(e.seat)}: ${actText(t, e.act)}`
    case 'takes':
      return t.logTakes(who(e.seat), e.n)
    case 'wins':
      return t.logWins(who(e.seat), e.n)
    case 'shows': {
      const cards = (e.cards ?? g.seats[e.seat]?.hand ?? []).map(c => cardText(c).replace('T', '10')).join(' ')
      return `${who(e.seat)}: ${cards} — ${describe(t, e.value)}`
    }
    case 'out':
      return t.logOut(who(e.seat))
    case 'over':
      return t.logOver(e.isWon)
  }
}

/** The hint's name for the person's holding: the made hand once there is a board, the two cards before. */
export function holding(t: Dict, hand: number[], board: number[], evaluate: (cards: number[]) => number): string {
  if (board.length > 0) return describe(t, evaluate(hand.concat(board)))
  const [a, b] = hand as [number, number]
  const [hi, lo] = (a >> 2) >= (b >> 2) ? [a, b] : [b, a]
  if (hi >> 2 === lo >> 2) return t.hands.pair(rank(hi >> 2))
  return `${rank(hi >> 2)} ${rank(lo >> 2)} ${(hi & 3) === (lo & 3) ? t.suited : t.offsuit}`
}
