// Word Guess (Wordle-style) core logic — no UI, fully testable.
//
// Difficulty controls WORD LENGTH (per the product decision):
//   EASY = 4 letters, MEDIUM = 5 (classic), HARD = 6, EXPERT = 7.
// Longer words get a couple of extra guesses so the curve stays fair.
//
// The answer pools below are hand-curated common English words. They are
// SANITIZED at module load (lowercase, a–z only, exact length, de-duplicated),
// so an accidental wrong-length token can never break gameplay — it is simply
// dropped. The pools double as the "known words" dictionary; guesses are
// accepted leniently (any real-length word) so players are never blocked by a
// small dictionary. Both can be expanded later without touching the UI.

import type { Difficulty } from '../../lib/difficulty';
import { makeRng } from '../../lib/daily';

export type LetterState = 'correct' | 'present' | 'absent';

export type DifficultyConfig = {
  /** Word length for this level. */
  length: number;
  /** Number of guesses allowed. */
  maxGuesses: number;
};

export const WORD_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { length: 4, maxGuesses: 6 },
  medium: { length: 5, maxGuesses: 6 },
  hard: { length: 6, maxGuesses: 7 },
  expert: { length: 7, maxGuesses: 7 },
};

// ---- Raw word pools (space-separated for compactness & readability) ----

const RAW_4 = `able acid also area army away baby back ball band bank base bath bear beat bell belt bird blue boat body bone book boot born both bowl bulk calm came camp card care cash cast cell chat city clay club coal coat code cold cook cool cope copy cord core corn cost crew crop dark data date dawn dead deal dear debt deep deer desk dial diet dirt dish dock dome done door dose down draw drew drop drug drum dual duck dust duty each earn ease east easy edge exam exit face fact fade fail fair fall farm fast fate fear feed feel feet fell file fill film find fine fire firm fish five flag flat flow fold folk food fool foot form fort four free frog from fuel full fund gain game gate gave gear gift girl give glad goal goat gold golf gone good gray grew grid grow gulf hair half hall hand hang hard harm hate have hawk head heal heap hear heat held hell help herb hero hide high hill hint hire hold hole holy home hope horn hose host hour huge hull hunt hurt icon idea inch iron item jail jazz join joke jump jury just keen keep kick kind king kiss knee knew knot know lack lady lake lamb lamp land lane last late lawn lead leaf lean leap left lend lens less life lift like limb lime line link lion list live load loan lock loft logo lone long look loop lord lose loss lost loud love luck lung made mail main make male mall many mark mask mass mate math meal mean meat meet melt menu mere mesh mild mile milk mill mind mine mint miss mist mode mold mole mood moon more moss most moth move much name navy near neat neck need nest news next nice nine node none noon nose note oath obey odds okay once only onto open oral oven over pace pack page paid pain pair pale palm park part pass past path peak pear peer pick pile pill pine pink pint pipe plan play plot plug plus poem poet poke pole poll pond pool poor pope pork port pose post pour pray prey pull pure push quit quiz race rack raft rage rail rain rank rare rate read real rear rely rent rest rice rich ride ring riot rise risk road roar robe rock role roll roof room root rope rose ruby rule rush rust sack safe sail sake sale salt sand save scan seal seat seed seek seem seen self sell semi send sent ship shoe shop shot show shut sick side sigh sign silk sing sink site size skin skip slip slot slow snap snow soap soft soil sold sole some song soon sort soul soup sour span spin spot star stay stem step stir stop such suit sure swap swim tail take tale talk tall tank tape task team tear tech teen tell tend tent term test text than that thaw them then thin this thus tide tied tile time tiny tips tire toad toll tomb tone tool torn tour town trap tray tree trim trip true tube tune turn twin type ugly unit upon urge used user vary vast veil vein very vest view vine void vote wade wage wait wake walk wall wand want ward warm warn wash wave weak wear week well went were west what when whip whom wide wife wild will wind wine wing wipe wire wise wish wolf wood wool word wore work worm worn wrap yard yarn yawn year your zero zone zoom`;

const RAW_5 = `about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along alter among anger angle angry apart apple apply arena argue arise array aside asset audio audit avoid award aware badly baker basic basis beach began begin begun being below bench black blame blank blast blind block blood board boast bonus boost booth bound brain brand brave bread break breed brick brief bring broad broke brown brush build built bunch burst buyer cabin cable candy cargo carry catch cause chain chair chaos charm chart chase cheap check chest chief child china chose civil claim class clean clear click cliff climb clock close cloth cloud coach coast could count court cover crack craft crash crazy cream crime cross crowd crown crude curve cycle daily dairy dance dated dealt death debut delay depth doing doubt dozen draft drama drank dream dress dried drink drive drove dying eager early earth eight elect elite empty enemy enjoy enter entry equal error event every exact exist extra faith false fault favor fence fiber field fifth fifty fight final first fixed flame flash fleet flesh float floor flour fluid focus force forth forty forum found frame frank fraud fresh front frost fruit fully funny ghost giant given glass globe glory going grace grade grain grand grant grass grave great green greet gross group grown guard guess guest guide happy harsh heart heavy hello hence honey honor horse hotel house human humor ideal image imply index inner input irony issue jeans joint judge juice knife knock known label labor large laser later laugh layer learn lease least leave legal lemon level light limit lined links liver lives local logic loose lower loyal lucky lunch lying magic major maker march match maybe mayor meant medal media metal meter micro might minor minus mixed model money month moral motor mount mouse mouth movie music naked nerve never newly night noble noise north noted novel nurse ocean offer often order other ought paint panel paper party peace penny phase phone photo piano piece pilot pitch place plain plane plant plate point pound power press price pride prime print prior prize proof proud prove queen quick quiet quite radio raise range rapid ratio reach react ready realm rebel refer relax reply rifle right rigid rival river roman rough round route royal rural scale scene scope score sense serve seven shade shake shall shame shape share sharp sheep sheet shelf shell shift shine shirt shock shoot shore short shown sight since sixth sixty sized skill sleep slept slice slide small smart smell smile smoke solid solve sorry sound south space spare speak speed spell spend spent spice spite split spoke sport spray squad staff stage stake stand stark start state steam steel steep steer stick still stock stone stood store storm story strip study stuff style sugar suite sunny super sweet swift swing sword table taken taste taxes teach teeth terms thank theft their theme there these thick thing think third those three threw throw tight timer tired title today token topic total touch tough tower towel trace track trade trail train treat trend trial tribe trick tried troop truck truly trust truth twice twist ultra uncle under union unite unity until upper upset urban usage usual valid value video virus visit vital vocal voice voter wagon waste watch water wheel where which while white whole whose woman world worry worse worst worth would wound write wrong wrote yield young youth`;

const RAW_6 = `abroad accept access across action active actual advice advise affect afford afraid agency agenda almost always amount animal annual answer anyone anyway appeal appear around arrive artist aspect assess assist assume attack attend author autumn avenue backup ballot banana banner barely barrel basket battle beauty became become before behalf behave behind belong beside better beyond bishop border bottle bottom bought branch breath bridge bright broken browse bubble budget bundle burden bureau button camera campus cancel cancer candle canvas carbon career castle casual caught cellar center chance change charge choice choose chosen church circle client closed closer coffee column combat coming common copper corner costly cotton county couple course cousin create credit crisis custom damage danger dealer debate decade decide defeat defend define degree demand depend deploy deputy desert design desire detail detect device differ dinner direct divide doctor dollar domain double driven driver during easily eating editor effect effort eighth either eleven emerge employ enable ending energy engage engine enough ensure entire entity equity escape estate ethnic exceed except excess expand expect expert export expose extend extent fabric factor failed fairly fallen family famous fasten father fellow female figure filing finger finish fiscal flight flower fluffy flying follow forced forest forget formal format former foster fought fourth freeze friend frozen future garage garden gather gender genius gentle global golden ground growth guilty handle happen hardly headed health heaven height hidden holder honest humble hunger hunter ignore impact import impose income indeed induce infant inform inject injury inside intend intent invest island itself jacket jersey jungle junior kindly kitten ladder latest latter launch lawyer leader league legacy length lesson letter likely linear liquid listen little lively living locate lonely longer lovely luxury makeup manage manner manual margin marine market master matter mature meadow medium member memory mental merely mighty minute mirror mobile modern modest modify moment monkey mostly mother motion murder museum mutual myself narrow nation native nature nearby nearly nicely notice notion number object obtain occupy office offset online option orange origin output oxygen packet palace parade parent partly patent patrol pencil people period permit person phrase picked picnic pillow planet plenty pocket poetry police policy poorly prefer pretty prince prison profit proper proven public pursue puzzle ragged random rarely rather rating reader really reason recall recent recipe record reduce refuse regard regime region relate relief remain remind remote remove render repair repeat report rescue resort result retail retain retire return reveal reward ribbon riddle rocket ruling runner safety salary salmon sample saving scream screen script search season second secret sector secure select seller senior sensor series server settle severe shadow shabby should shrink signal silent silver simple simply single sister sketch slight smooth social soccer soften softly solver sought source soviet speech spider spirit spoken spread spring square stable stairs status steady stolen stones strain stream street stress strict strike string stripe strive strong struck studio submit subtle suburb sudden suffer summer summit supply surely survey switch symbol system tablet tackle talent target taught temple tenant tender tennis thanks theory thirty though thread threat thrive throat thrown ticket timber timely tissue toilet tomato tongue toward travel treaty tribal tricky trophy tunnel twelve twenty unable unfair unique united unless unlike update useful valley vendor verbal versus vessel viewer virtue vision visual volume voyage waited wallet wander wealth weapon weekly weight wheels widely window winner winter within wonder wooden worker writer yellow`;

const RAW_7 = `ability absence academy account accused achieve acquire address advance adverse advised adviser against airline airport alcohol already amazing analyst ancient another anxiety anybody applied arrange arrival article assault assumed assured attempt attract auction average backing balance banking barrier battery bearing because bedroom believe beneath benefit between billion binding brother builder burning cabinet capable capital captain capture careful carrier ceiling central century certain chamber channel chapter charity charter checked chicken citizen classic climate closing closure clothes collect college combine comfort command comment compact company compare compete complex concept concern concert conduct confirm connect consist contact contain content contest context control convert correct costume cottage council counsel counter country courage crucial crystal culture current customs damaged dealing decline default defence deficit deliver density deposit desktop despite destroy develop diamond digital dignity dilemma dioxide display distant diverse divided divorce drawing dynamic eastern economy edition elderly element embrace emotion engaged english enhance enjoyed episode equally evening exactly examine example excited exclude exhibit expense explain explore express extreme factory faculty failing falling fashion feature federal feeling fiction fifteen finance finding focused foreign forever formula fortune forward founder freedom gallery gateway general genuine gesture getting greater grocery growing habitat hanging harvest heading healthy hearing heavily helpful herself highway history holiday holding hopeful hostile housing however hundred husband illegal illness imagine improve include initial inquiry insight install instant instead intense interim involve isolate journal journey justice justify keeping kitchen knowing landing largely lasting leading learned leather lecture leisure liberal liberty library license limited listing logical loyalty machine manager married massive maximum meaning measure medical meeting mention message mineral mistake mixture monitor monthly morning musical mystery natural neither nervous network neutral nothing nowhere nuclear nursing obvious offence officer ongoing opening operate opinion optical organic outcome outdoor outlook overall package painful painter partner passage passion patient pattern payment penalty pending pension percent perfect perform perhaps picture pioneer plastic pointed popular portion poverty precise predict premier prepare present prevent primary printer privacy private problem proceed process produce product profile program project promise promote propose protect protein protest provide publish purpose pursuit qualify quality quarter radical reading realize receive recover reflect regular related release remains removal replace request require reserve resolve respect respond restore retired revenue reverse routine satisfy science section segment serious service session setting several shelter shorten similar sitting society soldier somehow someone speaker special species sponsor station storage strange stretch student subject succeed success suggest summary support suppose supreme surface surplus survive suspect sustain teacher terrain theater thereby thought through tonight totally tourism tourist towards traffic tragedy trainer transit trouble trustee typical unaware uniform unknown unusual upgrade utility variety various vehicle venture version veteran victory village vintage virtual visible visitor vitamin waiting walking wanting warning warrior weather website wedding weekend welcome welfare western whereas whether willing winning witness working writing written`;

/** lowercase, a–z only, exact length, de-duplicated. Order preserved. */
function sanitize(raw: string, length: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of raw.toLowerCase().split(/\s+/)) {
    if (w.length === length && /^[a-z]+$/.test(w) && !seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

/** Answer pools by word length. */
export const POOLS: Record<number, string[]> = {
  4: sanitize(RAW_4, 4),
  5: sanitize(RAW_5, 5),
  6: sanitize(RAW_6, 6),
  7: sanitize(RAW_7, 7),
};

/** Fast membership lookup for "is this a known word" (used for hints, not gating). */
const POOL_SETS: Record<number, Set<string>> = {
  4: new Set(POOLS[4]),
  5: new Set(POOLS[5]),
  6: new Set(POOLS[6]),
  7: new Set(POOLS[7]),
};

/** Is `word` an acceptable guess? Lenient: any real-length alphabetic word. */
export function isValidGuess(word: string, length: number): boolean {
  return word.length === length && /^[a-z]+$/.test(word.toLowerCase());
}

/** Is `word` in our curated dictionary (a "real" common word)? */
export function isKnownWord(word: string, length: number): boolean {
  return POOL_SETS[length]?.has(word.toLowerCase()) ?? false;
}

/** Deterministically pick an answer for a length using a seeded RNG. */
export function pickWord(length: number, rng: () => number): string {
  const pool = POOLS[length];
  return pool[Math.floor(rng() * pool.length)];
}

/** Random answer (practice mode). */
export function randomWord(length: number): string {
  return pickWord(length, makeRng((Math.random() * 0xffffffff) >>> 0));
}

/**
 * Score a guess against the answer with correct duplicate-letter handling:
 * greens are assigned first and consume a letter from the answer's pool, so a
 * repeated guess letter only shows yellow if the answer still has that letter
 * "left over". This matches Wordle exactly.
 */
export function evaluate(guess: string, answer: string): LetterState[] {
  const n = answer.length;
  const res: LetterState[] = new Array(n).fill('absent');
  const counts: Record<string, number> = {};
  for (const ch of answer) counts[ch] = (counts[ch] ?? 0) + 1;

  // Pass 1: exact positions.
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      res[i] = 'correct';
      counts[guess[i]]--;
    }
  }
  // Pass 2: present-but-misplaced, only while letters remain.
  for (let i = 0; i < n; i++) {
    if (res[i] === 'correct') continue;
    const ch = guess[i];
    if (counts[ch] > 0) {
      res[i] = 'present';
      counts[ch]--;
    }
  }
  return res;
}

/** Emoji square for a letter state (Wordle-style share grid). */
export function stateEmoji(s: LetterState): string {
  return s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛';
}

/**
 * Merge a letter's state into the running "best known" state for the keyboard.
 * correct > present > absent; never downgrade.
 */
export function bestState(prev: LetterState | undefined, next: LetterState): LetterState {
  if (prev === 'correct') return 'correct';
  if (prev === 'present') return next === 'correct' ? 'correct' : 'present';
  return next;
}
