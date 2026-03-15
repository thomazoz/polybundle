# PolyBundle

PolyBundle is an AI-driven platform that helps users hedge real-world
risks using prediction markets.

Instead of treating prediction markets as speculative bets, PolyBundle
converts them into **structured hedge portfolios**. Users describe a
concern (inflation, geopolitical conflict, regulation, commodity
shocks), and the platform finds relevant prediction markets and bundles
them into a hedge strategy.

------------------------------------------------------------------------

# Features

## Natural Language Risk Input

Users describe a real-world concern such as:

-   "I'm worried about oil prices rising due to Middle East tensions"
-   "How can I hedge against inflation returning?"
-   "What happens if AI regulation hits tech stocks?"

The system converts this input into structured risk signals.

------------------------------------------------------------------------

## Prediction Market Discovery

The system scans prediction markets and identifies relevant contracts
tied to the risk.

Example markets might include:

-   geopolitical conflict events
-   commodity price thresholds
-   macroeconomic outcomes
-   regulatory decisions

------------------------------------------------------------------------

## Hedge Portfolio Bundles

Instead of presenting individual markets, PolyBundle constructs
**bundles of contracts** that collectively hedge a scenario.

This behaves similarly to:

-   options strategies
-   structured derivatives
-   insurance portfolios

------------------------------------------------------------------------

## Simulation Mode

Users can simulate hedge strategies before executing trades.

------------------------------------------------------------------------

## Polymarket Integration

The backend integrates with the Polymarket CLOB client, allowing the app
to:

-   fetch prediction markets
-   monitor probabilities
-   prepare trades

------------------------------------------------------------------------

# Tech Stack

Frontend - React - Vite - TailwindCSS - Framer Motion

Backend - Node.js - Express

Blockchain / APIs - Polymarket CLOB Client - Ethers.js

------------------------------------------------------------------------

# Project Structure

    polybundle
    │
    ├── server.js
    ├── test-clob.js
    │
    ├── src/
    │   ├── App.jsx
    │   ├── HedgeBot.jsx
    │   ├── services/
    │   │   ├── polymarket.js
    │   │   └── trading.js
    │   │
    │   └── assets/
    │
    ├── public/
    ├── package.json
    └── .env.example

------------------------------------------------------------------------

# Installation

## 1. Install Node.js

Install Node.js version 18 or newer.

Verify installation:

    node -v
    npm -v

------------------------------------------------------------------------

## 2. Clone the Repository

    git clone https://github.com/yourusername/polybundle.git
    cd polybundle

Or download the ZIP and extract it.

------------------------------------------------------------------------

## 3. Install Dependencies

    npm install

------------------------------------------------------------------------

## 4. Setup Environment Variables

Copy the environment example file:

    cp .env.example .env

Then edit `.env` and add values such as:

    POLYMARKET_API_KEY=
    PRIVATE_KEY=
    RPC_URL=
    PORT=3001

------------------------------------------------------------------------

# Running the App

Start the development servers:

    npm run dev

Default URLs:

Frontend:

    http://localhost:5173

Backend API:

    http://localhost:3001

------------------------------------------------------------------------

# Testing Polymarket Integration

Run the test script:

    node test-clob.js

------------------------------------------------------------------------

# Example Workflow

1.  Start the app

```{=html}
<!-- -->
```
    npm run dev

2.  Open the frontend

```{=html}
<!-- -->
```
    http://localhost:5173

3.  Enter a risk scenario such as:

```{=html}
<!-- -->
```
    Oil prices spike because of Middle East conflict

4.  The system:

-   parses the risk
-   finds relevant prediction markets
-   builds a hedge bundle

------------------------------------------------------------------------

# Use Cases

-   Macro risk hedging
-   Commodity price exposure
-   Geopolitical risk protection
-   Policy / regulation risk
-   Financial education

------------------------------------------------------------------------

# Vision

Prediction markets contain probability signals about future events.

PolyBundle transforms those signals into **structured risk management
tools**, similar to how options and futures evolved into core financial
infrastructure.

The goal is to create a **real-time risk intelligence platform** that
allows users to understand and hedge global risks using market
probabilities.
