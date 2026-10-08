# MatchDay Social Improvements

Brainstorm notes for making MatchDay feel like a social app that friends and football lovers actually use — not a lonely betting form.

Companion to `social.md`. Where that doc focused on top-down strategy and external distribution, this doc focuses on **what the inside of the app should feel like**, how it reaches people through the platforms they already use, and where AI can carry real weight.

Assume: no Towns integration, no investor budget, standalone web app, small team. Distribution happens through Telegram, X/Twitter, Farcaster, and WhatsApp. The app itself has to feel inhabited the moment someone opens it.

---

## 1. The core problem

A user opens MatchDay, picks a match, places a bet, closes the app. Nothing on screen tells them another human exists.

Every surface should answer three questions:

1. Who else is here?
2. What did they do?
3. What can I say back?

Betting without those answers is a lonely form. With them, it's a room.

---

## 2. In-app social features

### 2.1 Live pick feed on every match page

A stream of the most recent picks for that match:

> **@tobi** backed Arsenal · 2 min ago
> **@ada** backed draw · 5 min ago · *"draw merchants assemble"*
> **@kola** backed Chelsea · 8 min ago

Not a chat — a stream. Co-presence beats conversation. An optional short caption per pick (≤60 chars) adds personality without opening a moderation surface.

### 2.2 Reactions on picks

One-tap emoji reactions on any pick: 🔥 😂 🤔 💀. No threads, no replies. Reactions aggregate on the pick card. Low moderation cost, high dopamine. Turns picks into mini posts without building a feed product.

### 2.3 The pool as a visible crowd

Show the pool split with avatars, not just percentages:

> **Home** · 68% · [avatar][avatar][avatar][avatar] +243
> **Draw** · 12% · [avatar][avatar] +41
> **Away** · 20% · [avatar][avatar][avatar] +67

Clicking an outcome reveals who's there. The pool stops being a number and becomes a crowd you can scan for familiar faces.

### 2.4 Head-to-head records

Every profile shows "vs @tobi · 7–4 · you lead" against any user you've both predicted alongside. Click → every match you both called and who was right.

Converts strangers into rivals. Rivalries are the stickiest social primitive football has.

### 2.5 "Picks like yours" after lock-in

Immediately after a pick is placed, show 3–5 other users who picked the same thing, with form:

> You and 847 others backed Arsenal.
> **@sade** · 8/10 last week · also on Arsenal
> **@femi** · underdog specialist · also on Arsenal

Follow button next to each. Converts the lonely post-pick moment into a discovery moment. Builds a follow graph without ever asking "find your friends."

### 2.6 Ephemeral match-page chat

A thin chat tab on each match page that opens 2 hours before kickoff and closes 2 hours after. No history, no DMs, no persistence — just banter around the live match.

Ephemerality kills the moderation burden; the time window creates urgency; the match context keeps conversation on-rails. Think Twitch chat for a specific fixture, not a Discord server.

### 2.7 Reactions on results

When a match resolves, every user who predicted sees a result card and can one-tap react — "called it 😤" / "robbed 😭" / "my captain 💀". Reactions accumulate into a public match-reactions wall.

Post-match catharsis is where football social energy actually peaks. Most apps miss this entirely.

### 2.8 Profiles as character sheets, not stat dumps

A profile should read like a football identity, not an accounting ledger:

- Signature teams (most-backed)
- Prediction style, auto-derived ("Draw merchant," "Underdog hunter," "Chalk picker")
- Hot/cold streak indicator
- Rivalries (users with close H2H)
- Last 10 picks with results

A profile should be worth visiting even for strangers.

### 2.9 Groups

A user creates a named group ("The Lagos Office"), invites via link. Each group gets its own leaderboard, persistent chat, and the option to pool bets collectively against the global pool.

Individual leaderboards are vanity; group leaderboards are weekly obligations. This is the retention primitive — but only pays off *after* the app feels inhabited. Build after sections 2.1–2.3 ship.

### 2.10 The "others also noticed" nudge

Passive social proof baked into UI copy:

> "This fixture has moved 11% toward the draw in the last hour."
> "3 of your rivals have locked in."
> "@tobi, who beat you last week, picked Home."

Generated, not user-written. Zero moderation, infinite freshness. Makes the app feel like it's watching the room.

### 2.11 Shareable moments at peak emotion

When something notable happens — win streak, big payout, called the upset — the app surfaces a modal: "You just hit 5 in a row. Share?" One tap to external destinations.

Catching users at peak emotion is the single highest-converting share mechanic. The trigger lives in-app; the share goes out.

### 2.12 A visible global pulse

Somewhere persistent (header, home): "1,247 fans online · 83 picks in the last minute · biggest pool: Barça–Real ₦412k." A heartbeat.

Works even at low scale — "23 fans online" is still better than silence.

---

## 3. Distribution: the Recap Bot as a public character

Without a built-in social graph, the chat platforms *are* the distribution. The recap bot is MatchDay's personality on those platforms — the thing people subscribe to even if they never place a bet.

### 3.1 Where it posts

- **Telegram channel + X thread + Farcaster cast**
- Future: Telegram Mini App so the bot is also a surface, not just a broadcaster

### 3.2 Post types

- **Friday Picks Open** — fixtures + one-tap prediction links
- **Pre-kickoff pulse** (30 min out, big matches) — pool split, pool size, lock-in CTA
- **Post-match stingers** — "Only 11 people called this. 3 of them are from Lagos."
- **Monday Recap** — biggest upset, best picker, worst take, funniest miss, pool of the week
- **Named callouts** (opt-in) — "@tobi just hit 7 of his last 9. He's picking Chelsea tonight."

### 3.3 Why it works

People follow accounts, not apps. The bot becomes a sports media account that happens to be a product. Zero paid distribution. Every post is content + conversion funnel.

---

## 4. Where AI genuinely helps

AI is only worth adding where it does something a template or rule can't do cheaply. Here are the places that qualify:

### 4.1 The recap bot's voice

Hand-written weekly recaps don't scale. Template recaps feel robotic. An LLM with a strong system prompt (tone, catchphrases, running jokes about repeat offenders) is the sweet spot. The bot gets a consistent personality that evolves — this quarter it's grumpy about chalk-pickers; next quarter it's obsessed with underdogs.

### 4.2 Cold-start pundit personas

New users have no rivals, no followers, no feed. An **explicitly labeled** AI persona ("The Oracle," "Coach") makes its own picks and leaves reactions on the live feed. Users can even follow it, challenge it, and build a H2H record against it.

Rule: never fake humanity. The AI is a character, like a Twitch chatbot or a Twitter persona account. If users can tell it apart from humans at a glance, trust holds.

### 4.3 Smarter passive social proof

- Template: "This fixture moved 11% toward the draw"
- LLM over match + pool data: "Chelsea fans are quietly backing a draw tonight — first time in 4 weeks"

The second is a mini-story. These lines are expensive to hand-write and trivial to generate.

### 4.4 Identity labels

Rules give you "Draw merchant." An LLM over the user's full history gives you "Chalk picker who flinches on derbies" or "Backs home favorites except when Arsenal plays." Specific labels get screenshotted and shared.

### 4.5 Match previews on empty pages

Low-pool matches look dead. A 2-sentence AI preview per match gives every page a pulse without hiring writers.

### 4.6 Personalized post-match one-liners

When a user takes a bad L, the recap bot DMs a personalized roast or eulogy. Converts loss-pain into shared comedy. When a user wins, a personalized shoutout.

Needs light guardrails — never mock stake size, financial loss, or anything that could read as predatory.

### 4.7 Group-chat banter prompts

Groups go quiet mid-week. An AI "quiz question" or "would-you-rather" dropped in by the bot ("Choose: Haaland hat-trick or Arsenal 1-0?") revives dormant group chats without manual admin work.

### 4.8 Where NOT to use AI

- **Fake users in the live pick feed.** Users will sniff it out and trust collapses. Only clearly-labeled AI personas, never shadow bots.
- **Chat moderation.** Keyword lists + human escalation is cheaper and more predictable at this scale.
- **Picking recommendations.** Regulatory and trust nightmare. Never.
- **Any AI output presented as a human user's words.** Hard line.

---

## 5. What to deprioritize from `social.md`

- **"10 league captains" seeding** — managing 10 humans is a part-time job for a small team. Prefer the groups feature (self-serve invite links) + the recap bot (self-serve distribution).
- **Pidgin phrases as the cultural hook** — reads as pandering, and the Nigerian audience is heterogeneous. Localize the *mechanics* (voice notes, group rivalry, tipster behavior), not the vocabulary.
- **Global weekly MatchDay Cup as a flagship** — vanity leaderboard, matters only to the top 1%. The Monday Recap post *is* the cup, and it names winners publicly. Status without infrastructure.
- **Branded auto-generated result graphics (no remix affordance)** — finished art dies, remixable templates travel. Add a caption slot the user fills in before sharing.
- **Private challenge-a-friend as DM/link flow** — make challenges public in-app by default. Private is a transaction; public is spectator content.
- **Creator leagues as an early bet** — until there are 10k+ WAU, this is cold-call sales disguised as a feature. Earn it later; organic creator-ish behavior will emerge from a follow-feed first.
- **Dedicated referral codes** — overhead. Let group invites and win-receipt shares *be* the referral graph.

---

## 6. Recommended build order

### Phase 1 — Make the app feel inhabited (highest priority)

1. Live pick feed on match pages (§2.1)
2. Reactions on picks (§2.2)
3. Pool as a visible crowd (§2.3)
4. Global pulse indicator (§2.12)
5. Smarter social-proof copy, LLM-generated (§2.10, §4.3)

### Phase 2 — Give users identity and rivalry

6. Profiles as character sheets (§2.8)
7. Head-to-head records (§2.4)
8. "Picks like yours" post-lock-in (§2.5)
9. Reactions on results (§2.7)
10. AI identity labels (§4.4)

### Phase 3 — Open the social surface

11. Ephemeral match-page chat (§2.6)
12. Groups with invite links (§2.9)
13. Shareable moment modals (§2.11)
14. AI banter prompts in group chats (§4.7)

### Phase 4 — Scale distribution

15. Recap bot on Telegram (§3) — can ship earlier if cheap
16. Expand recap bot to X and Farcaster
17. Cold-start AI pundit personas (§4.2)
18. Personalized post-match one-liners (§4.6)

---

## 7. The three bets if forced to pick

If only three things can ship this quarter:

1. **Live pick feed + reactions** (§2.1, §2.2) — fixes the empty-room problem that currently kills every other social feature's upside.
2. **Head-to-head records + rivalries** (§2.4) — cheapest way to convert strangers into recurring opponents, which is the actual retention mechanism.
3. **Recap bot on Telegram + X** (§3) — the distribution engine and the personality layer in one. Needed to bring new users *to* the social surface being built in #1 and #2.

AI is woven through all three (recap voice, social-proof copy, identity labels) but isn't itself the bet — it's the force multiplier that keeps the surface fresh without a content team.
