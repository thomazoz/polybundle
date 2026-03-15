import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ethers } from "ethers";
import { searchPolymarket, fetchTopMarkets } from "./services/polymarket";
import { initClobClientFromCreds, executeMarketOrder } from "./services/trading";
const SYSTEM_PROMPT = `You are Polybundle, an expert prediction market strategist specializing in Polymarket. Your role is to help users hedge against global events by constructing optimal bundles of prediction market contracts.

You will be given a list of REAL live Polymarket markets. You MUST only use contracts from that list — never invent markets that are not in the list.

CRITICAL: Respond ONLY in valid JSON with this exact structure (no markdown, no backticks, no preamble):
{
  "decomposition": {
    "primary": "string describing the primary event",
    "leading_indicators": ["string array of 2-3 leading indicators"],
    "downstream": ["string array of 1-2 downstream consequences"]
  },
  "contracts": [
    {
      "market_name": "exact question from the real market list",
      "polymarket_url": "exact URL from the real market list",
      "live_yes_price": number (exact value from the real market list),
      "live_no_price": number (exact value from the real market list),
      "direction": "BUY YES" or "BUY NO",
      "allocation_pct": number (0-100, integers only),
      "rationale": "string — why this market hedges the event"
    }
  ],
  "strategy_type": "Direct" or "Proxy" or "Barbell" or "Layered" or "Contrarian",
  "scenarios": {
    "bull": { "description": "string", "estimated_return_pct": number },
    "base": { "description": "string", "estimated_return_pct": number },
    "bear": { "description": "string", "estimated_return_pct": number }
  }
}

Rules:
- ONLY use markets from the provided AVAILABLE MARKETS list
- Contract allocations must sum to exactly 100
- Minimum 2, maximum 5 contracts
- No single contract over 50%
- Copy market_name, polymarket_url, live_yes_price, live_no_price exactly from the list
- Choose direction based on which side hedges the user's event exposure`;

const FONT_URL = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap";

function LoadFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = FONT_URL;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);
  return null;
}

const POPULAR_BUNDLES = [
  { id: "recession", title: "US Recession", event: "US economy enters a recession by end of 2026", color: "bg-red-50 text-red-700 border-red-200" },
  { id: "taiwan", title: "Taiwan Conflict", event: "China initiates military action against Taiwan in 2026", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { id: "ai", title: "AI Disruption", event: "AI industry experiences a significant downturn or consolidation in 2026", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "crypto", title: "Crypto Bull Run", event: "Bitcoin and Ethereum reach major new price milestones in 2026", color: "bg-purple-50 text-purple-700 border-purple-200" },
];

const SAMPLE_BUNDLES_DATA = [
  {
    id: "recession",
    title: "US Recession 2026",
    subtitle: "Economic downturn hedge",
    accentColor: "border-red-400/40",
    badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
    event: "US economy enters a recession by end of 2026",
    timeHorizon: "end of 2026",
    riskTolerance: "moderate",
    result: {
      strategy_type: "Layered",
      decomposition: {
        primary: "US GDP contracts for two consecutive quarters in 2026, marking the first official recession since COVID-19.",
        leading_indicators: [
          "Inverted yield curve (2Y/10Y spread) sustained below -50 bps",
          "ISM Manufacturing PMI below 45 for three consecutive months",
          "Initial jobless claims trending above 300K weekly",
          "Conference Board Leading Economic Index declining for 6+ months"
        ],
        downstream: [
          "Federal Reserve forced into emergency rate cuts — 75bps+ reduction by year end",
          "Gold and Treasury bonds surge as safe-haven flows dominate"
        ],
        geopolitical: [
          "Trade war tariffs accelerating import prices while crushing export demand — stagflationary pressure",
          "Dollar strength paradox: USD rallies as global risk-off despite domestic weakness"
        ]
      },
      contracts: [
        {
          market_name: "US recession by end of 2026?",
          direction: "BUY YES",
          allocation_pct: 40,
          estimated_price_low: 0.28,
          estimated_price_high: 0.40,
          max_payout_per_dollar: 2.9,
          rationale: "Direct recession hedge. The market prices a 34% chance — below many economist estimates of 40-45%. If tariff escalation continues and consumer spending cracks, this is the primary payout vehicle.",
          correlation: "Strong positive",
          liquidity_flag: null,
          verify_search: "US recession 2026",
          polymarket_url: "https://polymarket.com/event/us-recession-by-end-of-2026",
          live_yes_price: 0.34,
          live_no_price: 0.66,
          live_liquidity: 108127
        },
        {
          market_name: "Fed rate cut by June 2026 meeting?",
          direction: "BUY YES",
          allocation_pct: 25,
          estimated_price_low: 0.25,
          estimated_price_high: 0.38,
          max_payout_per_dollar: 3.1,
          rationale: "The Fed pivot is the key policy signal of economic weakness. A cut by June means the Fed has seen enough deterioration to act — which historically coincides with recession onset. Captures the policy response rather than the recession itself.",
          correlation: "Strong positive",
          liquidity_flag: null,
          verify_search: "Fed rate cut June 2026",
          polymarket_url: "https://polymarket.com/event/fed-rate-cut-by-629",
          live_yes_price: 0.32,
          live_no_price: 0.68,
          live_liquidity: 34136
        },
        {
          market_name: "Will Gold have the best performance in 2026?",
          direction: "BUY YES",
          allocation_pct: 35,
          estimated_price_low: 0.55,
          estimated_price_high: 0.68,
          max_payout_per_dollar: 1.6,
          rationale: "Gold is the consensus safe-haven in recessions. The market already prices gold as the frontrunner at 61% — validating the thesis. This anchors the bundle with relatively high-probability returns and hedges even if the recession is shallow.",
          correlation: "Moderate positive",
          liquidity_flag: null,
          verify_search: "Gold best performance 2026 bitcoin",
          polymarket_url: "https://polymarket.com/event/bitcoin-vs-gold-vs-sp-500-in-2026",
          live_yes_price: 0.61,
          live_no_price: 0.39,
          live_liquidity: 23683
        }
      ],
      scenarios: {
        bull: { description: "GDP contracts 1.5% in H2. Fed cuts 3 times by year end. Gold surges as safe haven. All 3 contracts resolve YES.", estimated_return_pct: 135 },
        base: { description: "GDP stagnates near 0%. Gold outperforms. Fed cuts once by June. 2 of 3 legs resolve YES.", estimated_return_pct: 28 },
        bear: { description: "Economy re-accelerates. Fed stays put. Gold lags crypto and equities. All positions expire worthless.", estimated_return_pct: -71 }
      },
      risk_warnings: [
        "NBER recession dating is typically announced 6-12 months after the fact — market may not resolve until late 2027",
        "Fed rate cuts could occur for financial stability reasons unrelated to recession — creating false correlation",
        "Gold performance contract competes against Bitcoin and S&P 500 — any BTC surge could resolve it NO",
        "Trade tariff resolution could quickly reverse recessionary trends"
      ],
      next_steps: [
        "Monitor Atlanta Fed GDPNow forecast — sub-1% is the warning zone",
        "Watch weekly initial jobless claims — three consecutive prints above 250K signal labor stress",
        "Verify recession contract resolution criteria on Polymarket (NBER declaration vs. two negative GDP quarters)",
        "Check resolution source for the gold performance contract to understand the 2026 year-end benchmark"
      ],
      ev_analysis: "At a ~43¢ weighted average entry, the gold leg (61¢, 35%) anchors the bundle with high-probability returns while the recession and Fed cut legs provide asymmetric upside at 34¢ and 32¢. Even in the base scenario the bundle has positive EV if gold outperforms. Full recession delivers 135%+ on total capital."
    }
  },
  {
    id: "taiwan",
    title: "Taiwan Strait Crisis",
    subtitle: "Geopolitical tail-risk hedge",
    accentColor: "border-orange-400/40",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    event: "China initiates military action against Taiwan in 2026",
    timeHorizon: "end of 2026",
    riskTolerance: "aggressive",
    result: {
      strategy_type: "Layered",
      decomposition: {
        primary: "PLA initiates a formal naval blockade or amphibious assault on Taiwan — the most consequential geopolitical event since WWII.",
        leading_indicators: [
          "PLA naval exercises in the Taiwan Strait exceeding 2022 Pelosi-visit scale",
          "Taiwan Strait shipping insurance rates spiking above 5% premium",
          "Xi Jinping public statements shifting from 'peaceful reunification' rhetoric",
          "Unusual PLA air force sorties surpassing 50 aircraft per incident"
        ],
        downstream: [
          "Global semiconductor supply chain collapse — Taiwan produces 90% of advanced chips below 7nm",
          "Japan forced into historic military mobilization — Article 9 reinterpretation"
        ],
        geopolitical: [
          "Japan–US Mutual Defense Treaty activated — direct Japan-China confrontation triggered",
          "China threatens dollar-denominated Treasury dumping — global financial stress"
        ]
      },
      contracts: [
        {
          market_name: "Will China invade Taiwan by end of 2026?",
          direction: "BUY YES",
          allocation_pct: 45,
          estimated_price_low: 0.07,
          estimated_price_high: 0.14,
          max_payout_per_dollar: 10.0,
          rationale: "The core tail-risk contract with the most liquidity ($537K) on Polymarket. At 10 cents, you get a 10x payout for one of the most catastrophic scenarios of the decade. Even a small position provides massive portfolio protection if it materializes.",
          correlation: "Strong positive",
          liquidity_flag: null,
          verify_search: "China invade Taiwan 2026",
          polymarket_url: "https://polymarket.com/event/will-china-invade-taiwan-before-2027",
          live_yes_price: 0.10,
          live_no_price: 0.90,
          live_liquidity: 536916
        },
        {
          market_name: "Will China blockade Taiwan by June 30?",
          direction: "BUY YES",
          allocation_pct: 30,
          estimated_price_low: 0.04,
          estimated_price_high: 0.10,
          max_payout_per_dollar: 14.3,
          rationale: "A blockade is the most operationally plausible PLA action short of invasion. This shorter-horizon contract (7¢) captures early escalation. $70K in liquidity makes it tradeable. Would likely resolve YES before any invasion contract.",
          correlation: "Strong positive",
          liquidity_flag: null,
          verify_search: "China blockade Taiwan June 2026",
          polymarket_url: "https://polymarket.com/event/will-china-blockade-taiwan-by-june-30",
          live_yes_price: 0.07,
          live_no_price: 0.93,
          live_liquidity: 70371
        },
        {
          market_name: "China x Japan military clash before 2027?",
          direction: "BUY YES",
          allocation_pct: 25,
          estimated_price_low: 0.10,
          estimated_price_high: 0.18,
          max_payout_per_dollar: 7.1,
          rationale: "Japan controls key maritime chokepoints around Taiwan. A China-Japan clash in the East China Sea would be the most direct escalation indicator — and likely occurs before or during any Taiwan operation. Diversifies the bundle beyond the Taiwan Strait itself.",
          correlation: "Moderate positive",
          liquidity_flag: null,
          verify_search: "China Japan military clash 2026",
          polymarket_url: "https://polymarket.com/event/china-x-japan-military-clash-before-2027",
          live_yes_price: 0.14,
          live_no_price: 0.86,
          live_liquidity: 70191
        }
      ],
      scenarios: {
        bull: { description: "PLA blockade declared by June; Japan-China clash in the Senkakus. All 3 contracts resolve YES. Bundle pays 8-14x on each leg.", estimated_return_pct: 587 },
        base: { description: "Elevated PLA exercises; China/Japan clash occurs. Two legs resolve YES. Net positive despite invasion contract expiring.", estimated_return_pct: -42 },
        bear: { description: "Xi-Trump diplomatic channel opens; tensions de-escalate. All legs expire worthless. Real-world risk also contained.", estimated_return_pct: -84 }
      },
      risk_warnings: [
        "This is a low-probability, high-impact tail hedge — expect the bundle to expire worthless most of the time",
        "Polymarket resolution requires definitive military action, not just exercises — read criteria carefully",
        "June 30 blockade contract has a hard deadline — if no blockade by June 30, it expires regardless of later events",
        "Thin bid-ask spreads possible on low-price contracts — use limit orders near current market price"
      ],
      next_steps: [
        "Monitor INDOPACOM press releases and Taiwan Strait Watch for PLA exercise announcements",
        "Track Taiwan Strait shipping rates via Clarksons or Baltic Exchange as an early warning indicator",
        "Size positions conservatively — treat as portfolio insurance at 1-3% of total allocation",
        "Review Polymarket resolution criteria for each contract — especially what constitutes 'invasion' vs 'blockade'"
      ],
      ev_analysis: "At a ~10¢ weighted average entry, this is one of the cheapest tail hedges available. If the scenario materializes the bundle returns 5-10x. The 10x+ max payouts mean even a 10% probability of one contract resolving YES makes this EV-positive. For anyone with significant semiconductor, TSMC, or Asia-Pacific portfolio exposure, this costs less than typical options insurance with dramatically more upside."
    }
  },
  {
    id: "ai",
    title: "AI Industry Disruption",
    subtitle: "Tech bubble hedge",
    accentColor: "border-blue-400/40",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    event: "AI industry experiences a significant downturn or consolidation in 2026",
    timeHorizon: "end of 2026",
    riskTolerance: "moderate",
    result: {
      strategy_type: "Proxy",
      decomposition: {
        primary: "The AI industry undergoes a significant correction — through reduced enterprise spending, a safety incident, regulatory crackdown, or competitive disruption from open-source models.",
        leading_indicators: [
          "Hyperscaler capex guidance cuts (Microsoft, Amazon, Google pulling back on GPU orders)",
          "Nvidia earnings miss on data center revenue — the primary AI spend indicator",
          "Open-source model (Llama, DeepSeek) achieving parity with frontier closed models",
          "Enterprise AI ROI studies showing negative returns, reducing adoption rates"
        ],
        downstream: [
          "AI lab funding dries up — Series B/C rounds at significantly lower valuations",
          "Google and Microsoft forced to write down AI infrastructure investments"
        ],
        geopolitical: [
          "US-China AI compute war intensifies — export controls on H100/H200 GPUs create two separate AI ecosystems",
          "EU AI Act enforcement creates compliance cost crisis for US labs operating in Europe"
        ]
      },
      contracts: [
        {
          market_name: "AI Industry Downturn by December 31, 2026?",
          direction: "BUY YES",
          allocation_pct: 40,
          estimated_price_low: 0.12,
          estimated_price_high: 0.24,
          max_payout_per_dollar: 5.6,
          rationale: "The direct AI bubble hedge. Priced at 18¢ — meaningful but not dominant probability of a significant industry correction. If hyperscaler capex cuts materialize or a major safety incident occurs, this contract pays out at $1/share from an 18¢ entry.",
          correlation: "Strong positive",
          liquidity_flag: null,
          verify_search: "AI bubble burst downturn 2026",
          polymarket_url: "https://polymarket.com/event/ai-bubble-burst-by",
          live_yes_price: 0.18,
          live_no_price: 0.82,
          live_liquidity: 12949
        },
        {
          market_name: "Will OpenAI IPO by December 31 2026?",
          direction: "BUY YES",
          allocation_pct: 30,
          estimated_price_low: 0.28,
          estimated_price_high: 0.44,
          max_payout_per_dollar: 2.8,
          rationale: "An OpenAI IPO in 2026 would be a landmark AI industry inflection point — signaling either peak exuberance or desperate need for public capital. This contract provides exposure to the AI narrative's most consequential event at 36¢.",
          correlation: "Moderate positive",
          liquidity_flag: null,
          verify_search: "OpenAI IPO 2026",
          polymarket_url: "https://polymarket.com/event/openai-ipo-by",
          live_yes_price: 0.36,
          live_no_price: 0.64,
          live_liquidity: 7678
        },
        {
          market_name: "Will Google have the best AI model at end of June 2026?",
          direction: "BUY YES",
          allocation_pct: 30,
          estimated_price_low: 0.24,
          estimated_price_high: 0.38,
          max_payout_per_dollar: 3.2,
          rationale: "If Google displaces OpenAI at the frontier by June, it signals a fundamental competitive shift — reshuffling enterprise contracts, API revenue, and VC funding across the AI stack. Priced at 31¢, significant upside if Gemini Ultra executes on its roadmap.",
          correlation: "Moderate positive",
          liquidity_flag: null,
          verify_search: "best AI model Google June 2026",
          polymarket_url: "https://polymarket.com/event/which-company-has-best-ai-model-end-of-june",
          live_yes_price: 0.31,
          live_no_price: 0.69,
          live_liquidity: 21465
        }
      ],
      scenarios: {
        bull: { description: "Hyperscaler capex cuts announced Q2. OpenAI IPOs. Google takes AI leadership. All 3 contracts resolve YES.", estimated_return_pct: 184 },
        base: { description: "No formal downturn but growth decelerates. OpenAI delays IPO. AI landscape fragments. 1-2 contracts resolve.", estimated_return_pct: -18 },
        bear: { description: "AI spending accelerates. OpenAI raises private at $500B+. Nvidia beats again. All legs expire worthless.", estimated_return_pct: -72 }
      },
      risk_warnings: [
        "AI downturn contract resolution definition is critical — what counts as downturn? Verify on Polymarket before trading",
        "OpenAI IPO and AI downturn may be inversely correlated — a successful IPO could signal bubble peak, not correction",
        "Google AI leadership is subject to benchmark gaming — resolution source matters enormously",
        "Low liquidity on OpenAI IPO market ($7.6K) — use limit orders and verify bid/ask spread before entry"
      ],
      next_steps: [
        "Monitor Nvidia quarterly earnings for data center revenue guidance — the primary AI spend indicator",
        "Track OpenAI public statements about IPO timeline and funding rounds as leading signals",
        "Follow LMSYS Chatbot Arena rankings monthly as the primary frontier model benchmark source",
        "Verify Polymarket resolution criteria for AI downturn — confirm whether defined by revenue metrics or stock prices"
      ],
      ev_analysis: "At a ~27¢ weighted average entry, the OpenAI IPO (36¢) and Google AI leadership (31¢) legs provide reasonable probability of resolving YES even without a full downturn. The AI downturn leg (18¢, 5.6x payout) provides the asymmetric upside. Total EV is positive if at least one leg resolves YES."
    }
  },
  {
    id: "crypto",
    title: "Crypto Bull Run",
    subtitle: "Digital asset upside hedge",
    accentColor: "border-purple-400/40",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    event: "Bitcoin and Ethereum reach major new price milestones in 2026",
    timeHorizon: "end of 2026",
    riskTolerance: "aggressive",
    result: {
      strategy_type: "Barbell",
      decomposition: {
        primary: "Bitcoin and Ethereum both reach significant milestones in 2026, driven by spot ETF inflows, institutional adoption, and halving cycle tailwinds.",
        leading_indicators: [
          "Bitcoin spot ETF net inflows exceeding $500M per week for 4+ consecutive weeks",
          "Ethereum staking yield rising above 6% (indicating demand exceeding supply)",
          "Stablecoin market cap crossing $400B (capital waiting to be deployed)",
          "Coinbase institutional trading volume 3x quarterly growth year-over-year"
        ],
        downstream: [
          "Stablecoin supply explodes to $500B+ as capital inflows require settlement rails",
          "DeFi TVL surpasses $200B as ETH price rise amplifies liquidity pools"
        ],
        geopolitical: [
          "US stablecoin legislation passed — regulatory clarity accelerates institutional adoption",
          "China softens crypto stance — digital yuan competition drives political reconsideration"
        ]
      },
      contracts: [
        {
          market_name: "Will Bitcoin reach $200,000 by December 31, 2026?",
          direction: "BUY YES",
          allocation_pct: 35,
          estimated_price_low: 0.03,
          estimated_price_high: 0.07,
          max_payout_per_dollar: 20.0,
          rationale: "The ultra-high payout leg. At 5¢, you get 20x exposure to a Bitcoin all-time high scenario. Spot ETF inflows, halving cycle tailwinds, and institutional adoption make $200K plausible in a bull cycle — even if not the base case.",
          correlation: "Strong positive",
          liquidity_flag: null,
          verify_search: "Bitcoin 200000 price 2026",
          polymarket_url: "https://polymarket.com/event/what-price-will-bitcoin-hit-before-2027",
          live_yes_price: 0.05,
          live_no_price: 0.95,
          live_liquidity: 86234
        },
        {
          market_name: "Will Ethereum reach $10,000 by December 31, 2026?",
          direction: "BUY YES",
          allocation_pct: 30,
          estimated_price_low: 0.02,
          estimated_price_high: 0.06,
          max_payout_per_dollar: 25.0,
          rationale: "Ethereum tends to outperform Bitcoin in mid-to-late bull cycles as DeFi and NFT activity resurges. At 4¢, this offers the highest maximum payout in the bundle (25x). The post-merge, post-Pectra upgrade trajectory makes $10K plausible in a risk-on environment.",
          correlation: "Strong positive",
          liquidity_flag: null,
          verify_search: "Ethereum 10000 price 2026",
          polymarket_url: "https://polymarket.com/event/what-price-will-ethereum-hit-before-2027",
          live_yes_price: 0.04,
          live_no_price: 0.96,
          live_liquidity: 120412
        },
        {
          market_name: "Will stablecoins hit $500B before 2027?",
          direction: "BUY YES",
          allocation_pct: 35,
          estimated_price_low: 0.22,
          estimated_price_high: 0.32,
          max_payout_per_dollar: 3.7,
          rationale: "Stablecoin supply is the most reliable leading indicator of a crypto bull cycle — it represents capital staged for deployment. $500B (from ~$230B today) requires 2x growth, consistent with a major bull run. At 27¢, this anchors the bundle with the highest probability leg.",
          correlation: "Moderate positive",
          liquidity_flag: null,
          verify_search: "stablecoin 500 billion 2027",
          polymarket_url: "https://polymarket.com/event/will-stablecoins-hit-500b-before-2027",
          live_yes_price: 0.27,
          live_no_price: 0.73,
          live_liquidity: 15478
        }
      ],
      scenarios: {
        bull: { description: "Bitcoin hits $200K in Q4. Ethereum reaches $10K. Stablecoin supply at $520B. All 3 contracts resolve YES.", estimated_return_pct: 842 },
        base: { description: "Stablecoins hit $500B by Q3. Bitcoin reaches $150K but not $200K. Ethereum hits $7K. Only stablecoin leg resolves.", estimated_return_pct: -46 },
        bear: { description: "Macro risk-off, crypto winter continues. Bitcoin stays below $90K. All 3 legs expire worthless.", estimated_return_pct: -88 }
      },
      risk_warnings: [
        "This is a high-risk speculative bundle — expect it to expire worthless more often than not",
        "Bitcoin and Ethereum price contracts are highly correlated — a bear market hits both legs simultaneously",
        "Stablecoin growth could happen for non-bull reasons (e.g., flight to safety from altcoins) — verify resolution criteria",
        "Low absolute liquidity on the stablecoin contract ($15K) means large orders will move price significantly"
      ],
      next_steps: [
        "Track Bitcoin spot ETF flows daily at farside.co.uk/bitcoin-etf-flow — net positive weeks sustain bull momentum",
        "Monitor Ethereum staking rate on beaconcha.in — validator queue indicates demand for ETH exposure",
        "Check stablecoin supply weekly at DefiLlama — current total and growth rate",
        "Verify price milestone contracts resolve based on daily close, not intraday — check Polymarket resolution criteria"
      ],
      ev_analysis: "At a ~12¢ weighted average entry, this is a high-variance, high-upside bundle. The stablecoin leg (27¢, 35%) anchors with moderate probability. Bitcoin ($200K, 5¢) and Ethereum ($10K, 4¢) provide 20-25x lottery-ticket exposure. In a full bull cycle a $1,000 investment could return $8,000-$10,000. Downside is limited to initial investment."
    }
  }
];

export default function HedgeBot() {
  // App state
  const [phase, setPhase] = useState("intake");
  const [walletAddress, setWalletAddress] = useState(null);
  const [clobClient, setClobClient] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [aiHistory, setAiHistory] = useState([]);
  const aiChatRef = useRef(null);
  const [form, setForm] = useState({
    event: "",
    timeHorizon: "3 months",
    exposure: "",
    riskTolerance: "moderate",
    budget: 1000,
    view: "uncertain",
    preference: "pure_hedge",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const resultRef = useRef(null);

  const loadingSteps = [
    "Fetching live Polymarket markets…",
    "Analyzing event impact…",
    "Identifying relevant markets…",
    "Building optimal hedge bundle…",
    "Finalizing strategy…",
  ];

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % loadingSteps.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [loading]);

  const connectWithCreds = async ({ privateKey, apiKey, apiSecret, apiPassphrase }) => {
    const wallet = new ethers.Wallet(privateKey);
    const creds = { key: apiKey, secret: apiSecret, passphrase: apiPassphrase };
    const client = initClobClientFromCreds(wallet, creds);
    setWalletAddress(wallet.address);
    setClobClient(client);
  };

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setLoadingStep(0);
    setResult(null);
    setPhase("loading");

    try {
      const eventText = form.event.trim();

      // ── Fetch ALL top active Polymarket markets by volume ──
      setLoadingStep(0);
      const allMarkets = await fetchTopMarkets(200);

      if (allMarkets.length === 0) {
        throw new Error("Could not reach Polymarket API. Check your connection.");
      }

      setLoadingStep(1);

      // ── Ask AI to pick the most relevant markets from the real list ──
      const marketList = JSON.stringify(
        allMarkets.slice(0, 80).map((m, i) => ({
          id: i,
          question: m.question,
          yes_price: parseFloat(m.prices[0]).toFixed(2),
          liquidity: Math.round(m.liquidity),
        })),
        null, 2
      );

      const pickRes = await fetch("/api/groq/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are a prediction market analyst. Given an event and a list of real live Polymarket markets (with their IDs), select the 3–6 most relevant markets for hedging against that event. Think about direct exposure, correlated assets, leading indicators, and downstream effects. Output ONLY a JSON array of the selected market IDs (integers). Example: [0, 5, 12, 23]`,
          messages: [{ role: "user", content: `EVENT: ${eventText}

AVAILABLE MARKETS:
${marketList}` }],
        }),
      });
      const pickData = await pickRes.json();
      const pickRaw = pickData.choices?.[0]?.message?.content || "[]";
      let selectedIds = [];
      try {
        selectedIds = JSON.parse(pickRaw.replace(/\`\`\`json|\`\`\`/g, "").trim());
        if (!Array.isArray(selectedIds)) selectedIds = [];
      } catch { selectedIds = []; }

      // Map selected IDs back to real market objects
      let selectedMarkets = selectedIds
        .filter(id => Number.isInteger(id) && id >= 0 && id < allMarkets.length)
        .map(id => allMarkets[id]);

      // If AI selected fewer than 3, fall back to top markets by liquidity
      if (selectedMarkets.length < 3) {
        const extra = allMarkets
          .filter(m => !selectedMarkets.includes(m))
          .slice(0, 3 - selectedMarkets.length);
        selectedMarkets = [...selectedMarkets, ...extra];
      }

      setLoadingStep(3);

      // ── Build bundle from the selected real markets ──
      const marketsJson = JSON.stringify(
        selectedMarkets.map(m => ({
          market_name: m.question,
          polymarket_url: m.url,
          live_yes_price: parseFloat(m.prices[0]),
          live_no_price: parseFloat(m.prices[1]),
          liquidity_usd: Math.round(m.liquidity),
        })),
        null, 2
      );

      const userMessage = `EVENT: ${eventText}
RISK TOLERANCE: ${form.riskTolerance}
DIRECTIONAL VIEW: ${form.view === "more_likely" ? "MORE likely than market prices" : form.view === "less_likely" ? "LESS likely than market prices" : "Uncertain"}

AVAILABLE MARKETS — copy market_name / polymarket_url / live_yes_price / live_no_price exactly:
${marketsJson}`;

      const bundleRes = await fetch("/api/groq/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: SYSTEM_PROMPT, messages: [{ role: "user", content: userMessage }] }),
      });

      const bundleData = await bundleRes.json();
      if (!bundleRes.ok) throw new Error(bundleData.error || "Analysis failed");

      setLoadingStep(4);
      const text = bundleData.choices[0]?.message?.content || "";
      const parsed = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, "").trim());

      // Attach clobTokenIds from real market objects
      const marketByUrl = Object.fromEntries(allMarkets.map(m => [m.url, m]));
      parsed.contracts = (parsed.contracts || []).map(c => {
        const live = marketByUrl[c.polymarket_url];
        return live ? { ...c, clobTokenIds: live.clobTokenIds } : c;
      });

      setResult(parsed);
      setPhase("result");
      setAiHistory(prev => [{ id: Date.now(), event: form.event, result: parsed, timestamp: new Date() }, ...prev]);
    } catch (err) {
      console.error(err);
      setError(err.message || "Analysis failed. Please try again.");
      setPhase("intake");
    } finally {
      setLoading(false);
    }
  }

  const deleteBundle = (id) => {
    setAiHistory(prev => prev.filter(item => item.id !== id));
    if (result && aiHistory.find(i => i.id === id)?.result === result) {
      setResult(null);
      setPhase("intake");
    }
  };

  const canSubmit = form.event.trim().length > 10;


  const handleLoadBundle = (bundle) => {
    setForm(prev => ({
      ...prev,
      event: bundle.event,
      timeHorizon: bundle.timeHorizon,
      riskTolerance: bundle.riskTolerance,
    }));
    setResult(bundle.result);
    setPhase("result");
    setActiveTab("ai");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  return (
    <div
      className="min-h-screen text-white font-sans selection:bg-blue-500/30 selection:text-white"
      style={{ backgroundImage: "url('/bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
    >
      <LoadFonts />

      {/* Header + Tabs combined */}
      <header className="sticky top-0 z-50 w-full bg-black/20 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2 min-w-[140px]">
            <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-500 text-white font-bold text-sm shadow-[0_0_15px_rgba(59,130,246,0.5)]">P</div>
            <span className="font-bold text-xl tracking-tight text-white">Polybundle</span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/70 text-[10px] font-mono tracking-widest font-semibold ml-1">ALPHA</span>
          </div>

          {/* Tabs centered */}
          <TabBar active={activeTab} onChange={setActiveTab} />

          {/* Profile */}
          <div className="min-w-[140px] flex justify-end">
            <ProfileButton walletAddress={walletAddress} clobClient={clobClient} onConnect={connectWithCreds} onDisconnect={() => { setWalletAddress(null); setClobClient(null); }} />
          </div>
        </div>
      </header>

      {/* ── TAB: HOME ── */}
      <div className={`${activeTab === "home" ? "block" : "hidden"}`}>
        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-24">
          {/* Hero */}
          <div className="text-center mb-14">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight drop-shadow-sm">
              Hedge against the <br /><span className="text-blue-300 drop-shadow-[0_0_15px_rgba(147,197,253,0.3)]">unexpected.</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto drop-shadow-sm">
              Tell us what geopolitical or macroeconomic event keeps you up at night.
              Polybundle uses AI to instantly construct an optimal combination of Polymarket contracts to protect your portfolio.
            </p>
          </div>

          {/* Quick search */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-2 mb-12 flex focus-within:bg-white/15 focus-within:border-white/30 transition-all">
            <input
              type="text"
              className="w-full bg-transparent border-none text-xl md:text-2xl font-light text-white placeholder:text-white/50 py-4 px-6 focus:outline-none focus:ring-0"
              placeholder="e.g. US enters a recession in 2026..."
              value={form.event}
              onChange={e => setForm({ ...form, event: e.target.value })}
              onKeyDown={e => { if (e.key === "Enter" && canSubmit) { setActiveTab("ai"); runAnalysis(); } }}
            />
            <button
              className={`py-3 px-8 rounded-xl font-medium text-white transition-all whitespace-nowrap ${canSubmit ? "bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)]" : "bg-white/5 text-white/30 cursor-not-allowed border border-white/5"}`}
              onClick={() => { if (canSubmit) { setActiveTab("ai"); runAnalysis(); } }}
              disabled={!canSubmit}
            >
              Hedge →
            </button>
          </div>

          {/* Popular quick-picks */}
          <div className="mb-14">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 px-1">Popular Events</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POPULAR_BUNDLES.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setForm(prev => ({ ...prev, event: b.event })); setActiveTab("ai"); }}
                  className="flex flex-col text-left p-4 rounded-xl border bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md group transition-all hover:-translate-y-0.5"
                >
                  <span className="font-semibold mb-1 text-white group-hover:text-blue-300 transition-colors">{b.title}</span>
                  <span className="text-xs text-white/60 leading-relaxed line-clamp-2">{b.event}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Featured bundles preview */}
          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Live Market Bundles</h3>
              <button onClick={() => setActiveTab("bundles")} className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
                View all →
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {SAMPLE_BUNDLES_DATA.slice(0, 2).map(bundle => (
                <FeaturedBundleCard key={bundle.id} bundle={bundle} onLoad={handleLoadBundle} walletAddress={walletAddress} clobClient={clobClient} />
              ))}
            </div>
            <button
              onClick={() => setActiveTab("bundles")}
              className="mt-4 w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/8 text-sm font-medium transition-all"
            >
              See all {SAMPLE_BUNDLES_DATA.length} bundles →
            </button>
          </div>
        </main>
      </div>

      {/* ── TAB: BUNDLES ── */}
      <div className={`${activeTab === "bundles" ? "block" : "hidden"}`}>
        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-24">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-1">Market Bundles</h2>
            <p className="text-sm text-white/50">Pre-built hedging bundles with real Polymarket prices. Click Explore to see full analysis.</p>
          </div>

          {/* Group by category */}
          {Object.entries(
            SAMPLE_BUNDLES_DATA.reduce((acc, b) => {
              const cat = TAB_CATEGORIES[b.id] || "Other";
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(b);
              return acc;
            }, {})
          ).map(([category, bundles]) => (
            <div key={category} className="mb-12">
              <div className="flex items-center gap-3 mb-5">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">{category}</h3>
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[10px] text-white/25 font-mono">{bundles.length} bundle{bundles.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex flex-col gap-4">
                {bundles.map(bundle => (
                  <FeaturedBundleCard key={bundle.id} bundle={bundle} onLoad={handleLoadBundle} walletAddress={walletAddress} clobClient={clobClient} />
                ))}
              </div>
            </div>
          ))}
        </main>
      </div>

      {/* ── TAB: AI CREATOR ── */}
      <div className={`${activeTab === "ai" ? "flex" : "hidden"} min-h-[calc(100vh-65px)] overflow-hidden bg-black/40 backdrop-blur-sm`}>
        
        {/* Sidebar for Past Bundles */}
        <aside className="w-80 border-r border-white/10 flex flex-col hidden lg:flex shrink-0">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">History</h3>
            <span className="text-[10px] text-white/20 font-mono bg-white/5 px-1.5 py-0.5 rounded">{aiHistory.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {aiHistory.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-xs text-white/20 italic">No history yet</p>
              </div>
            ) : (
              aiHistory.map((item) => (
                <div key={item.id} className="relative group/item">
                  <button
                    onClick={() => { 
                      setResult(item.result); 
                      setForm(prev => ({ ...prev, event: item.event })); 
                      setPhase("result");
                      if (aiChatRef.current) aiChatRef.current.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
                      result === item.result 
                        ? "bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20" 
                        : "bg-white/5 border-white/5 hover:bg-white/8 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] text-white/30 font-mono uppercase tracking-tighter">
                        {item.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className={`w-1.5 h-1.5 rounded-full ${result === item.result ? "bg-blue-400 animate-pulse" : "bg-white/10 group-hover:bg-white/20"}`} />
                    </div>
                    <h4 className={`text-xs font-medium leading-relaxed line-clamp-2 ${result === item.result ? "text-blue-200" : "text-white/60 group-hover:text-white/80"}`}>
                      {item.event}
                    </h4>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-white/40 font-mono capitalize">
                        {item.result.strategy_type}
                      </span>
                      <span className="text-[10px] text-white/30">
                        {item.result.contracts?.length || 0} contracts
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteBundle(item.id); }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-white/20 hover:text-red-400 hover:bg-black/60 opacity-0 group-hover/item:opacity-100 transition-all duration-200 backdrop-blur-sm border border-white/5"
                    title="Delete Analysis"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-white/5 bg-black/20">
            <button 
              onClick={() => { setPhase("intake"); setResult(null); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Analysis
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div ref={aiChatRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-40">

            {/* Empty state */}
            {phase === "intake" && aiHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center select-none">
                <div className="relative mb-8">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.15)]">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1H1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><circle cx="7.5" cy="14.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="14.5" r="1.5" fill="currentColor"/></svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">AI Bundle Creator</h2>
                <p className="text-white/40 text-sm max-w-sm leading-relaxed">Describe any geopolitical or macro scenario and AI will instantly build an optimal Polymarket hedge bundle for you.</p>
                <div className="mt-8 flex flex-wrap gap-2 justify-center">
                  {["US recession 2026", "Taiwan strait crisis", "AI bubble burst", "Fed rate cuts"].map(s => (
                    <button key={s} onClick={() => setForm(f => ({ ...f, event: s }))}
                      className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 hover:text-white/80 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading state */}
            {phase === "loading" && (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="relative mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
                  </div>
                </div>
                <p className="text-white/70 font-medium mb-6 text-sm">{loadingSteps[loadingStep]}</p>
                <div className="w-64 h-[3px] bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Current result */}
            {phase === "result" && result && (
              <div ref={resultRef} className="mb-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center text-blue-400">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1H1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/></svg>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-0.5">AI Analysis Result</p>
                      <h2 className="text-white text-lg font-bold line-clamp-1">{form.event}</h2>
                    </div>
                  </div>
                  <div className="lg:hidden">
                    <HistoryDropdown aiHistory={aiHistory} setResult={setResult} setForm={setForm} setPhase={setPhase} onDelete={deleteBundle} />
                  </div>
                </div>
                <AiBundleCard result={result} eventLabel={form.event} walletAddress={walletAddress} clobClient={clobClient} />
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-500/8 border border-red-500/20 rounded-2xl text-red-300/80 text-sm text-center">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Sticky input bar - now absolute to content area, not screen */}
        <div className="absolute bottom-0 left-0 right-0 z-30 px-4 sm:px-6 pb-6 pt-4"
          style={{ background: "linear-gradient(to top, #08090e 80%, transparent)" }}>
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-center rounded-2xl border border-white/10 bg-[#13141f] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden focus-within:border-blue-500/40 focus-within:shadow-[0_8px_40px_rgba(99,102,241,0.15)] transition-all duration-300">
              <input
                type="text"
                className="w-full bg-transparent border-none text-base font-light text-white placeholder:text-white/30 py-4 pl-6 pr-4 focus:outline-none focus:ring-0"
                placeholder="Describe an event to hedge against…"
                value={form.event}
                onChange={e => setForm({ ...form, event: e.target.value })}
                onKeyDown={e => e.key === "Enter" && canSubmit && runAnalysis()}
                disabled={phase === "loading"}
              />
              <div className="pr-2">
                <button
                  className={`flex items-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-sm transition-all duration-200 whitespace-nowrap ${
                    canSubmit && phase !== "loading"
                      ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_28px_rgba(99,102,241,0.5)] hover:opacity-90"
                      : "bg-white/5 text-white/20 cursor-not-allowed"
                  }`}
                  onClick={runAnalysis}
                  disabled={!canSubmit || phase === "loading"}
                >
                  {phase === "loading" ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      Hedge
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}


const TAB_CATEGORIES = {
  recession: "Macroeconomic",
  taiwan: "Geopolitical",
  ai: "Technology",
  crypto: "Crypto & DeFi",
};

function TabBar({ active, onChange }) {
  const tabs = [
    { id: "home", label: "Home", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { id: "bundles", label: "Bundles", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="6" height="6"/><rect x="9" y="3" width="6" height="6"/><rect x="16" y="3" width="6" height="6"/><rect x="2" y="10" width="6" height="6"/><rect x="9" y="10" width="6" height="6"/><rect x="16" y="10" width="6" height="6"/></svg> },
    { id: "ai", label: "AI Creator", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1H1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><circle cx="7.5" cy="14.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="14.5" r="1.5" fill="currentColor"/></svg> },
  ];
  return (
    <div className="flex items-center gap-2">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            active === tab.id
              ? "bg-white text-black shadow-lg"
              : "bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/80"
          }`}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ProfileButton({ walletAddress, clobClient, onConnect, onDisconnect }) {
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState({ privateKey: "", apiKey: "", apiSecret: "", apiPassphrase: "" });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [trades, setTrades] = useState(null);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  // Close on outside click — check both button and portal panel
  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch trades when panel opens and connected
  useEffect(() => {
    if (!open || !clobClient || trades !== null) return;
    setLoadingTrades(true);
    clobClient.getTrades().then(t => { setTrades(t || []); setLoadingTrades(false); }).catch(() => { setTrades([]); setLoadingTrades(false); });
  }, [open, clobClient]);

  const handleConnect = async () => {
    setConnecting(true);
    setError("");
    try {
      await onConnect(creds);
      setCreds({ privateKey: "", apiKey: "", apiSecret: "", apiPassphrase: "" });
    } catch (err) {
      setError(err.message?.slice(0, 80) || "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  // Stats derived from trades
  const stats = trades ? (() => {
    const buys = trades.filter(t => t.side === "BUY");
    const sells = trades.filter(t => t.side === "SELL");
    const totalSpent = buys.reduce((s, t) => s + parseFloat(t.size) * parseFloat(t.price), 0);
    const totalReceived = sells.reduce((s, t) => s + parseFloat(t.size) * parseFloat(t.price), 0);
    return { count: trades.length, totalSpent, totalReceived, pnl: totalReceived - totalSpent };
  })() : null;

  const rect = btnRef.current?.getBoundingClientRect();

  return (
    <div ref={btnRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm font-medium ${
          walletAddress
            ? "bg-blue-500/15 border-blue-500/30 text-blue-200 hover:bg-blue-500/25"
            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        {walletAddress ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
            <span className="font-mono text-xs">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Connect
          </>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: (rect?.bottom ?? 60) + 8, right: window.innerWidth - (rect?.right ?? 0) }}
          className="w-96 bg-[#0d0f17] border border-white/10 rounded-2xl shadow-2xl z-[200] overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-white/8 flex items-center justify-between shrink-0">
            <div>
              <div className="text-sm font-bold text-white">Polymarket Account</div>
              <div className="text-[11px] text-white/40 mt-0.5">
                {walletAddress ? <span className="font-mono">{walletAddress}</span> : "Connect to enable trading"}
              </div>
            </div>
            {walletAddress && (
              <button
                onClick={() => { onDisconnect(); setOpen(false); setTrades(null); }}
                className="text-[11px] text-white/30 hover:text-red-400 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-red-500/10"
              >
                Disconnect
              </button>
            )}
          </div>

          {walletAddress ? (
            <div className="overflow-y-auto flex-1">
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/8">
                {[
                  { label: "Trades", value: stats ? stats.count : "—" },
                  { label: "Volume", value: stats ? `$${stats.totalSpent.toFixed(0)}` : "—" },
                  {
                    label: "All-time P&L",
                    value: stats ? `${stats.pnl >= 0 ? "+" : ""}$${stats.pnl.toFixed(2)}` : "—",
                    color: stats ? (stats.pnl >= 0 ? "text-green-400" : "text-red-400") : "text-white/60",
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-4 py-4 bg-[#0d0f17]">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1">{label}</div>
                    <div className={`text-lg font-bold font-mono ${color ?? "text-white"}`}>
                      {loadingTrades ? <span className="opacity-30 animate-pulse">…</span> : value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Trade history */}
              <div className="px-5 pt-4 pb-2">
                <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-3">Trade History</div>
              </div>
              <div className="px-5 pb-5 space-y-2">
                {loadingTrades ? (
                  <div className="text-center py-8 text-white/20 text-sm">Loading trades…</div>
                ) : !trades || trades.length === 0 ? (
                  <div className="text-center py-8 text-white/20 text-sm">No trades yet</div>
                ) : (
                  trades.slice(0, 20).map((t, i) => {
                    const spent = parseFloat(t.size) * parseFloat(t.price);
                    const date = new Date(parseFloat(t.match_time) * 1000);
                    const isBuy = t.side === "BUY";
                    return (
                      <div key={i} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                        <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase border ${isBuy ? "bg-green-500/15 text-green-300 border-green-500/20" : "bg-red-500/15 text-red-300 border-red-500/20"}`}>
                          {t.side}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white/70 truncate">{t.outcome || t.asset_id?.slice(0, 16) + "…"}</div>
                          <div className="text-[10px] text-white/30 mt-0.5 font-mono">
                            {parseFloat(t.size).toFixed(2)} shares @ ¢{(parseFloat(t.price) * 100).toFixed(1)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold text-white">${spent.toFixed(2)}</div>
                          <div className="text-[10px] text-white/30">{date.toLocaleDateString()}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-3">
              {[
                { key: "privateKey", label: "Private Key", placeholder: "0x…" },
                { key: "apiKey", label: "API Key", placeholder: "polymarket.com → Profile → API Keys" },
                { key: "apiSecret", label: "API Secret", placeholder: "" },
                { key: "apiPassphrase", label: "API Passphrase", placeholder: "" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold block mb-1">{label}</label>
                  <input
                    type="password"
                    placeholder={placeholder}
                    value={creds[key]}
                    onChange={e => setCreds(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-white/20"
                  />
                </div>
              ))}
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                onClick={handleConnect}
                disabled={connecting || !creds.privateKey || !creds.apiKey || !creds.apiSecret || !creds.apiPassphrase}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {connecting
                  ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Connecting…</>
                  : "Connect"
                }
              </button>
              <p className="text-[10px] text-white/25 text-center leading-relaxed">
                Credentials stay in your browser and are only sent to Polymarket's API
              </p>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function CheckoutModal({ contracts, bundleTitle, walletAddress, clobClient, onClose }) {
  const [phase, setPhase] = useState("review"); // review | trading | done
  const [progress, setProgress] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [budget, setBudget] = useState(1000);
  const [budgetInput, setBudgetInput] = useState("1000");

  const totalUsdc = contracts.reduce((sum, c) => sum + (c.allocation_pct / 100) * budget, 0);
  const aggregatedPrice = contracts.reduce((sum, c) => sum + (c.live_yes_price ?? 0.5) * (c.allocation_pct / 100), 0);


  const handleExecute = async () => {
    try {
      setPhase("trading");
      setProgress(contracts.map(c => ({ name: c.market_name, usdc: ((c.allocation_pct / 100) * budget).toFixed(0), status: "pending" })));


      for (let i = 0; i < contracts.length; i++) {
        const c = contracts[i];
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: "active" } : p));
        try {
          const live = await searchPolymarket(c.verify_search);
          const isYes = c.direction?.includes("YES");
          const tokenId = live?.clobTokenIds?.[isYes ? 0 : 1];
          if (!tokenId) throw new Error("no token");
          await executeMarketOrder(clobClient, tokenId, parseFloat(((c.allocation_pct / 100) * budget).toFixed(2)));
          setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: "done" } : p));
        } catch {
          setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: "failed" } : p));
        }
      }
      setPhase("done");
    } catch (err) {
      setErrorMsg(err.message?.slice(0, 60) || "Transaction failed");
      setPhase("review");
    }
  };

  const Spinner = ({ cls }) => (
    <svg className={`animate-spin ${cls}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#08090e] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-white/8">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Order Summary</h2>
            <p className="text-sm text-white/40 mt-0.5 leading-snug line-clamp-1">{bundleTitle}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors mt-0.5 p-1 -mr-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

          {/* Budget input */}
          {phase !== "trading" && phase !== "done" && (
            <div className="px-6 pt-5 pb-3 border-b border-white/8">
              <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-2">Investment Amount</div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-blue-500/50 transition-colors">
                <span className="text-white/40 font-mono text-sm">$</span>
                <input
                  type="number"
                  value={budgetInput}
                  onChange={e => {
                    setBudgetInput(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) setBudget(v);
                  }}
                  className="flex-1 bg-transparent text-white font-mono text-2xl font-bold focus:outline-none min-w-0"
                  min={10}
                  step={50}
                  placeholder="1000"
                />
                <span className="text-white/30 text-xs font-mono shrink-0">USDC</span>
              </div>
              <div className="flex gap-2 mt-2">
                {[100, 500, 1000, 5000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => { setBudget(amt); setBudgetInput(String(amt)); }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${budget === amt ? "bg-blue-600/30 border border-blue-500/40 text-blue-300" : "bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"}`}
                  >
                    ${amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Order rows */}
        {phase !== "trading" && phase !== "done" && (
          <div className="px-6 py-4 space-y-2 max-h-56 overflow-y-auto">
            {contracts.map((c, i) => {
              const isYes = c.direction?.includes("YES");
              const usdcAmt = ((c.allocation_pct / 100) * budget).toFixed(0);
              return (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border ${isYes ? "bg-green-500/15 text-green-300 border-green-500/20" : "bg-red-500/15 text-red-300 border-red-500/20"}`}>
                    {isYes ? "YES" : "NO"}
                  </span>
                  <span className="text-sm text-white/75 truncate flex-1 min-w-0">{c.market_name}</span>
                  <span className="font-mono text-sm text-white shrink-0">${usdcAmt}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Execution progress */}
        {(phase === "trading" || phase === "done") && (
          <div className="px-6 py-4 space-y-2.5 max-h-56 overflow-y-auto">
            {progress.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="shrink-0 w-5 flex justify-center">
                  {p.status === "active" ? <Spinner cls="h-4 w-4 text-blue-400" />
                    : p.status === "done" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-400"><polyline points="20 6 9 17 4 12"/></svg>
                    : p.status === "failed" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    : <span className="w-3 h-3 rounded-full bg-white/15 inline-block" />}
                </span>
                <span className={`text-sm truncate flex-1 ${p.status === "done" ? "text-green-300" : p.status === "failed" ? "text-red-300 line-through opacity-60" : p.status === "active" ? "text-white" : "text-white/30"}`}>
                  {p.name}
                </span>
                <span className={`font-mono text-sm shrink-0 ${p.status === "done" ? "text-green-300" : "text-white/40"}`}>${p.usdc}</span>
              </div>
            ))}
          </div>
        )}

        {/* Totals bar */}
        <div className="mx-6 mb-4 grid grid-cols-2 gap-3 p-4 bg-white/4 border border-white/8 rounded-xl">
          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1">Total Cost</div>
            <div className="text-2xl font-bold font-mono text-white">${totalUsdc.toFixed(0)} <span className="text-sm text-white/40 font-normal">USDC</span></div>
          </div>
          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1">Avg Bundle Price</div>
            <div className="text-2xl font-bold font-mono text-white">¢{(aggregatedPrice * 100).toFixed(1)}</div>
          </div>
        </div>

        {/* Action area */}
        <div className="px-6 pb-6">
          {phase === "done" ? (
            <button onClick={onClose} className="w-full py-3.5 rounded-xl bg-green-600/20 border border-green-500/30 text-green-300 font-bold flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              All orders submitted — close
            </button>
          ) : !walletAddress ? (
            <div className="text-center py-2 space-y-2">
              <p className="text-white/40 text-sm">Connect your Polymarket account first</p>
              <p className="text-white/25 text-xs">Use the <strong className="text-white/40">Connect</strong> button in the top right</p>
            </div>
          ) : (
            <div className="space-y-3">
              {errorMsg && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}
              <div className="flex items-center justify-between text-xs text-white/40 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />
                  {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
                </span>
                <span className="font-mono">{contracts.length} orders · ${totalUsdc.toFixed(0)} USDC</span>
              </div>
              <button
                onClick={handleExecute}
                disabled={phase === "trading"}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-60 disabled:cursor-wait text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(34,197,94,0.35)]"
              >
                {phase === "trading" ? <><Spinner cls="h-4 w-4" /> Placing orders…</> : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                    Execute Bundle
                  </>
                )}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}

function BundleTradeButton({ contracts, bundleTitle, walletAddress, clobClient, compact = false }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_12px_rgba(34,197,94,0.25)] hover:shadow-[0_0_18px_rgba(34,197,94,0.45)] whitespace-nowrap"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
        {compact ? "Buy" : "Buy Bundle"}
      </button>
      {isOpen && (
        <CheckoutModal
          contracts={contracts}
          bundleTitle={bundleTitle}
          walletAddress={walletAddress}
          clobClient={clobClient}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

function AiBundleCard({ result, eventLabel, walletAddress, clobClient }) {
  const contracts = result.contracts || [];
  const aggregatedPrice = contracts.reduce((sum, c) => sum + ((c.live_yes_price ?? 0.5) * c.allocation_pct) / 100, 0);
  const liveCount = contracts.filter(c => c.polymarket_url).length;
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-bold text-white text-base leading-snug">{eventLabel}</h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-500/30 bg-blue-500/10 text-blue-300">
              {result.strategy_type}
            </span>
          </div>
          <p className="text-xs text-white/40 line-clamp-1">{result.decomposition?.primary || ""}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-0.5">Bundle Price</div>
          <div className="font-mono text-xl font-bold text-white">¢{(aggregatedPrice * 100).toFixed(1)}</div>
          {aggregatedPrice > 0 && (
            <div className="text-[10px] text-white/30 font-mono">max {(1 / aggregatedPrice).toFixed(1)}x</div>
          )}
        </div>
      </div>

      {/* Contract rows */}
      <div className="flex flex-col gap-1.5 mb-4">
        {contracts.map((c, i) => {
          const isYes = c.direction?.includes("YES");
          const price = isYes ? (c.live_yes_price ?? 0.5) : (c.live_no_price ?? 0.5);
          return (
            <div key={i} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-black/20 border border-white/5">
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase border ${isYes ? "bg-green-500/15 text-green-300 border-green-500/20" : "bg-red-500/15 text-red-300 border-red-500/20"}`}>
                {isYes ? "YES" : "NO"}
              </span>
              <span className="text-xs text-white/70 truncate flex-1 min-w-0">{c.market_name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {(
                  <span className="font-mono text-xs text-blue-300 font-semibold">¢{(price * 100).toFixed(0)}</span>
                )}
                <span className="text-[10px] text-white/40 font-mono w-8 text-right">{c.allocation_pct}%</span>
                {c.polymarket_url ? (
                  <a href={c.polymarket_url} target="_blank" rel="noreferrer"
                    className="text-white/30 hover:text-blue-400 transition-colors" title="View on Polymarket">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                ) : <div className="w-[11px]" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scenario row */}
      {result.scenarios && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Bull", data: result.scenarios.bull, color: "text-green-400", bg: "bg-green-500/8 border-green-500/15" },
            { label: "Base", data: result.scenarios.base, color: "text-yellow-400", bg: "bg-yellow-500/8 border-yellow-500/15" },
            { label: "Bear", data: result.scenarios.bear, color: "text-red-400",   bg: "bg-red-500/8 border-red-500/15" },
          ].map(({ label, data, color, bg }) => (
            <div key={label} className={`rounded-xl border px-3 py-2 ${bg}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${color}`}>{label}</div>
              <div className={`font-mono text-sm font-bold ${color}`}>
                {data?.estimated_return_pct != null ? `${data.estimated_return_pct > 0 ? "+" : ""}${data.estimated_return_pct}%` : "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
          {`${liveCount}/${contracts.length} live markets`}
        </div>
        <BundleTradeButton
          contracts={contracts}
          bundleTitle={eventLabel}
          walletAddress={walletAddress}
          clobClient={clobClient}
          compact
        />
      </div>
    </div>
  );
}

function FeaturedBundleCard({ bundle, onLoad, walletAddress, clobClient }) {
  const contracts = bundle.result.contracts;

  // Weighted average YES price across all contracts
  const aggregatedPrice = contracts.reduce((sum, c) => {
    return sum + (c.live_yes_price * c.allocation_pct) / 100;
  }, 0);

  // Max payout if all YES contracts resolve correctly
  const maxPayout = (1 / aggregatedPrice).toFixed(2);

  return (
    <div className={`bg-white/5 border border-white/10 ${bundle.accentColor} rounded-2xl p-5 hover:bg-white/8 hover:border-white/20 transition-all backdrop-blur-md group`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-white text-base group-hover:text-blue-100 transition-colors">{bundle.title}</h4>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${bundle.badgeColor}`}>
              {bundle.result.strategy_type}
            </span>
          </div>
          <p className="text-xs text-white/50 leading-relaxed line-clamp-1">{bundle.event}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-white/40 uppercase tracking-wider font-bold mb-0.5">Bundle Price</div>
          <div className="font-mono text-xl font-bold text-white">¢{(aggregatedPrice * 100).toFixed(1)}</div>
          <div className="text-[10px] text-white/40 font-mono">max {maxPayout}x</div>
        </div>
      </div>

      {/* Contract list */}
      <div className="flex flex-col gap-1.5 mb-4">
        {contracts.map((c, i) => {
          const isYes = c.direction?.includes("YES");
          const priceDisplay = isYes ? c.live_yes_price : c.live_no_price;
          return (
            <div key={i} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-black/20 border border-white/5">
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase border ${isYes ? "bg-green-500/15 text-green-300 border-green-500/20" : "bg-red-500/15 text-red-300 border-red-500/20"}`}>
                {isYes ? "YES" : "NO"}
              </span>
              <span className="text-xs text-white/70 truncate flex-1 min-w-0">{c.market_name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs text-blue-300 font-semibold">¢{(priceDisplay * 100).toFixed(0)}</span>
                <span className="text-[10px] text-white/40 font-mono w-8 text-right">{c.allocation_pct}%</span>
                {c.polymarket_url && (
                  <a
                    href={c.polymarket_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-white/30 hover:text-blue-400 transition-colors"
                    title="View on Polymarket"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-[10px] text-white/40 font-mono uppercase tracking-wider">
          <span>{contracts.length} contracts</span>
          <span>{bundle.timeHorizon}</span>
          <span>{bundle.riskTolerance}</span>
        </div>
        <div className="flex items-center gap-2">
          <BundleTradeButton contracts={contracts} bundleTitle={bundle.title} walletAddress={walletAddress} clobClient={clobClient} compact />
          <button
            onClick={() => onLoad(bundle)}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
          >
            Explore →
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryDropdown({ aiHistory, setResult, setForm, setPhase, onDelete }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (aiHistory.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all text-xs font-medium"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-9-9 8.97 8.97 0 0 1 7.4 3.9L21 8"/></svg>
        History
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-[#1a1c29] border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden flex flex-col max-h-[60vh]">
          <div className="p-3 border-b border-white/5 bg-black/20 text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Recent Analyses
          </div>
          <div className="overflow-y-auto p-2 space-y-1">
            {aiHistory.map((item) => (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => {
                    setResult(item.result);
                    setForm(prev => ({ ...prev, event: item.event }));
                    setPhase("result");
                    setOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <p className="text-[10px] text-white/25 font-mono mb-1">
                    {item.timestamp.toLocaleDateString()} · {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <h4 className="text-xs text-white/70 group-hover:text-white leading-snug line-clamp-2 pr-6">
                    {item.event}
                  </h4>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                  className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-lg text-white/10 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Inject keyframes
const styleSheet = document.createElement("style");
styleSheet.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleSheet);
