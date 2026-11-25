# Happy Voyage: Seven Seas Domination | Gameplay Rules

[简体中文](GAMEPLAY.md) · English

The [Chinese gameplay document](GAMEPLAY.md) is the single source of truth for the rules. If the two versions differ, the Chinese version takes precedence. Whenever the Chinese document changes, update this English version in the same PR. In-game help and the README are guides, not separate sources of rules. This document describes the rules in effect in the current version.

## 1. Setup and victory

The values below are this version's defaults. The desktop edition can override values for local matches and campaigns using `config.json` next to the app; see the [Chinese configuration guide](配置说明.md). Online rooms are unaffected.

Fleet capacity can be set to 2–40 ships. You may start with just one ship, but capacity cannot be set to 1: you cannot dock your last ship or board another without an open slot.

Lowering the auto-resolve hit chance also reduces estimated cannon damage in auto-resolve forecasts. At a 0% hit chance those forecasts deal no cannon damage. This setting does not affect Command forecasts or cannonball impacts; actual auto-resolve battles still roll for each ship's hit independently.

- **Local match**: There are 2–10 nations, with 4 by default. Up to 6 people (and at least 1, but no more than the total number of seats) can take turns on one device; the computer controls the remaining seats. Players choose distinct nations and start at their respective home ports. Human seats go first in join order, followed by the computer seats in a fixed order. The defaults are Classic conquest, Normal difficulty, and Command for naval battles.
- **Background music**: With sound enabled, the music starts automatically after the first click, tap, or keypress that the browser accepts for playback. There is no need to toggle sound.
- **Standard match starting resources**: Each navigator starts as an Ensign with 3,200 gold, 8 ships at full durability (4 Warships, 1 Cargo Ship, and 3 Explorers), and 3 random, distinct Strategy cards. The navigator's signature ship replaces one ship of the same type. All new continents start neutral. Campaign starting gold and other settings are listed in Section 9; the starting fleet is the same.

| Mode | Territory victory | Round limit |
| --- | --- | --- |
| Classic conquest | Hold all 40 new continents at once | Unlimited |
| Quick match | Hold 10 new continents at once | 50 rounds |
| Sprint | Hold 6 new continents at once | 20 rounds |

At the end of a turn, check for a territory victory first, then check whether only one navigator remains. If a match with a round limit has not ended early, finish the entire last round. The active navigator with the highest net worth then wins; ties go to the earlier seat. Net worth is cash plus 75% of each colony's valuation (rounded down individually) plus 75% of the total amount spent on buildings in each colony (also rounded down per colony). Ships, cargo, and stockpiled goods do not count.

A navigator goes bankrupt only when a deduction takes their gold below zero; exactly zero is allowed. On bankruptcy, their gold resets to zero. Failing to pay foreign tax in full or losing the entire fleet to tax seizures also causes bankruptcy. A navigator is eliminated if their sailing fleet loses all its ships, even if ships are still docked at other colonies. An eliminated navigator's colonies revert to neutral, their buildings, stockpiles, and docked ships are cleared, and their seat is skipped thereafter. If no one survives and any navigator was eliminated for losing their fleet, there is no winner. If everyone was eliminated solely by bankruptcy, the first seat wins.

## 2. Chart, rounds, and sailing

- The standard chart has 143 spaces: 10 national ports, 40 new continents, 7 special islands, 13 event spaces (9 Open sea event spaces, 2 treasure spaces, 1 storm space, and 1 trade wind space), and 73 blank sea spaces. Blank sea spaces are evenly spaced within each main-route stretch, with more on longer stretches, so about half of ordinary compass moves end on blank sea. Blank sea spaces count as sailing steps but contain no ports or islands. Only new continents can be claimed.
- In each round, every active seat gets one turn in fixed seat order. At the end of the round, colonies produce goods, market stock moves back toward its starting level, and roaming units move. Blockade makes the affected seat skip its next turn.
- Each turn begins with the option to use a Strategy card or **Return to a colony**, then to spin the compass (sailing directly replaces the spin). A normal spin moves the fleet 2–12 spaces with respective weights of 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1 (36 total, with 7 spaces most likely). After moving, resolve home-port salary along the route first, then any en-route encounter, then the landing itself. If the landing offers a choice, finish it or leave its screen before passing the turn.
- The forward route has 9 forks. North, east, south, and west winds steer the fleet toward the exit most aligned with the wind. At a fork, blank sea spaces still count as sailing steps, but do not affect how the wind compares the main route with the shortcut. If neither is downwind, the fleet follows the main route. Reverse Course goes backward along the main route. The initial wind is random; it changes to another direction every 2–4 player turns thereafter. Ship speed does not increase the number of spaces moved on a compass spin.
- **Return to a colony** lets you sail directly to any of your colonies other than your current location before spinning the compass, without spending a card. It becomes available again 12 rounds later: use it in round 2 and it returns in round 14. As with Navigate and Recall, you skip intervening spaces and collect no salary en route, but still resolve the destination.
- Drag to pan the chart and use the scroll wheel or pinch to zoom. Use **Fit chart** or **Follow ship** to adjust the view. Open **Fleet** to see ships, captains, cargo, and durability; ★ marks the signature ship. The top player bar shows each navigator’s gold, sailing ships, colonies, and strategy cards. Changing game speed or skipping animations does not affect sailing or its outcomes.

## 3. Colonies, fleets, and trade

### Claiming land, production, and docking

- Landing on an unclaimed new continent automatically plants your flag for free. The price shown on the chart is its **valuation** (100–350 gold), not a claim fee. Number the new continents 1–40 in the main-route order below. Continent `n` is valued at `100 + (n − 1) × 250 ÷ 39`, rounded to the nearest 5. The base toll is 35% of its valuation, rounded to the nearest whole gold. Specialties cycle through Wine, Sugar, Cotton, Timber, Cocoa, Tobacco, Silver, Spices, Silk, and Tea. Base iron yields repeat 1, 2, 3.

| Port order | Following new continents (excluding special islands, event spaces, and blank sea spaces) |
| --- | --- |
| Spain | Madeira, Canary Isles, Cape Verde, Azores |
| Netherlands | Hispaniola, Cuba, Yucatan, Veracruz |
| England | Cartagena, Guiana, Pernambuco, Bahia |
| Portugal | Rio de Janeiro, Patagonia, Tierra del Fuego, Valparaiso |
| China | Callao, Panama, Gold Coast, Benin |
| France | Luanda, Cape of Good Hope, Mozambique, Zanzibar |
| Japan | Sofala, Madagascar, Socotra, Muscat |
| Germany | Goa, Calicut, Ceylon, Malacca |
| Italy | Sumatra, Java, Borneo, Moluccas |
| Korea | Luzon, Formosa, Ryukyu, Hokkaido |

- When landing at a rival colony, you can pay the toll, start a naval battle, or use an available Strategy card. The actual toll is the base toll × (1 + total building levels × 25%), rounded down. If you cannot afford it, the full amount is still deducted and you go bankrupt, but the owner receives only what you could pay.
- Claiming an unoccupied new continent, capturing a colony in battle, or returning to your own colony immediately opens the construction screen that turn. You can build, upgrade, construct ships, buy or sell used ships, or open **Ships & cargo transfer** to dock or retrieve ships and load or unload cargo. Leave the screen manually when done. Docked ships leave the sailing fleet, keep their cargo, and defend the island if attacked. You cannot dock your fleet's last ship. Cargo moves in whole units between a chosen ship in your sailing fleet and the local stockpile, subject to cargo space and stock. Auto-loading takes specialties only, not lumber or iron.

| Building | Gold cost by level | Effect |
| --- | --- | --- |
| Lumber mill | 60 / 120 / 180 | Produces 1 lumber per level each round |
| Iron mine | 80 / 160 / 240 | Produces the local base yield (1–3 iron) per level each round |
| Shipyard | 120 / 240 / 360 | Unlocks local shipbuilding; higher levels unlock more ship types. Repairs docked ships for free starting at level 1 |
| Repair yard | 80 (level 1 only) | Repairs docked ships for free without a shipyard |
| Collection field | 60 / 120 / 180 | Produces 1 unit of the local specialty per level each round |

**Building income**: At the end of each round, the current owner receives one quarter of the total cost of all completed building levels on that island, rounded down, even if no rival lands or pays a toll. Each level pays back in four rounds as long as you hold the colony. For example, a level-one lumber mill, iron mine, and shipyard cost 260 gold together and pay 65 gold per round. Tolls and material production are separate.

**Dockside repairs**: Ships & cargo transfer shows current/max durability for every ship in your sailing fleet and every ship docked at the colony. It also tells you whether the colony offers automatic repairs. A colony with either a Shipyard or a Repair yard fully repairs all ships docked there for free at the start of its owner's turn. Ships are not repaired immediately upon landing or docking, and ships still in the sailing fleet are not repaired. Repaired ships can rejoin the fleet on the next visit.

### Ships

| Ship type | Max durability | Firepower | Cargo capacity | Speed | Crew capacity | Shipyard level / Lumber / Iron | Used purchase price |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Explorer | 80 | 12 | 40 | 7 | 25 | 1 / 2 / 1 | 180 |
| Cargo Ship | 100 | 8 | 120 | 3 | 30 | 2 / 4 / 2 | 300 |
| Warship | 120 | 30 | 25 | 4 | 60 | 3 / 6 / 4 | 450 |

Shipbuilding uses only materials from the local stockpile. New ships start at full durability. On each visit to Skeleton Island or one of your colonies, one used ship of each type is available for purchase. Purchased ships come with 60% of max durability, rounded down. You may sell any ship in your sailing fleet with an empty hold as long as at least one ship remains. Its sale price is 50% of the used purchase price for that type, multiplied by its current fraction of max durability and rounded down. Selling does not replenish stock for that visit.

Each navigator's sailing fleet holds at most **20 ships**. Newly acquired or returning ships fill open fleet slots first. Excess ships keep their durability and cargo and are left at the docks in your current colony; if you are not at one of your colonies, they go to your first colony in chart order. Docks do not require a Shipyard and do not count toward the fleet limit. If you own no colonies, excess ships are held until you acquire one, then sent to its docks. Use **Ships & cargo transfer** at your colony to retrieve ships. If the fleet is full, dock a ship from the fleet first.

| Nation / Navigator | Flagship | Bonuses over the base ship type |
| --- | --- | --- |
| Spain / Columbus | Santa María (Cargo Ship) | Durability +20, cargo capacity +20 |
| Netherlands / Juliana | Halve Maen (Cargo Ship) | Cargo capacity +40 |
| England / Cook | Endeavour (Explorer) | Durability +20, speed +1 |
| Portugal / Magellan | Victoria (Explorer) | Speed +2 |
| China / Zheng He | Treasure Ship (Cargo Ship) | Cargo capacity +30, crew capacity +20 |
| France / Morgan | Satisfaction (Warship) | Firepower +10 |
| Japan / Hasekura | San Juan Bautista (Warship) | Durability +20, firepower +5 |
| Germany / Behaim | Adler von Lübeck (Warship) | Durability +40 |
| Italy / Verrazzano | La Dauphine (Explorer) | Speed +1, cargo capacity +20 |
| Korea / Yi Sun-sin | Turtle Ship (Warship) | Durability +30, firepower +8 |

### Nightless Island market and goods

The 24-hour market on Nightless Island trades lumber, iron, and specialties. Each order uses one specified ship in your fleet. Purchases require enough gold, market stock, and cargo space; sales cannot exceed what the ship carries. Each good starts with 16 units of market stock and moves back toward 16 by up to 2 units per round. Prices are calculated per unit, so splitting an order does not change the total:

1. The stock adjustment is `16 − stock`, with a minimum of minus half the base price (round the half down before negating it) and a maximum of the base price.
2. The round's featured good costs 3 more. Featured goods cycle in the order below, with Wine featured in round 1. During a storm's round and the next round, lumber and iron each cost an additional 4.
3. When buying, calculate the price using stock **before** removing the unit, then add the base price divided by 4, rounded up. When selling, use stock **after** adding the unit, without that markup.

| Good (featured rotation order) | Nightless Island base price | Barter valuation / Merchant ship base price |
| --- | ---: | ---: |
| Lumber | 10 | 10 |
| Iron | 14 | 20 |
| Wine | 18 | 40 |
| Sugar | 13 | 35 |
| Cotton | 12 | 25 |
| Timber | 15 | 30 |
| Cocoa | 16 | 45 |
| Tobacco | 17 | 50 |
| Silver | 24 | 100 |
| Spices | 22 | 75 |
| Silk | 21 | 90 |
| Tea | 19 | 60 |

## 4. Ports, salary, and rank

Each time you pass through or land at your home port along the sailing route, collect 400 gold in base salary (see Section 9 for Campaign values), plus the salary bonus for your current rank. Landing at your home port also grants an audience with the King. Each colony you currently hold is worth 100 merit, plus 25 per existing building level. If you meet the next rank's threshold, advance only one rank per audience and collect the promotion bonus. Otherwise, earn 2 gold for each point by which your merit exceeds your previous best from all audiences. Losing colonies does not reduce your rank.

| Rank | Merit needed for promotion | Salary bonus | Foreign tax discount | Promotion bonus |
| --- | ---: | ---: | ---: | ---: |
| Ensign | 0 | 0 | 0% | 0 |
| Lieutenant (Junior Grade) | 100 | 50 | 10% | 200 |
| Lieutenant | 250 | 100 | 20% | 350 |
| Lieutenant Commander | 450 | 175 | 30% | 500 |
| Commander | 700 | 250 | 40% | 700 |
| Captain | 1,000 | 350 | 50% | 1,000 |

Foreign tax is due only when you **land at** a foreign port: 40 gold × (1 − your current tax discount), rounded up. The gold goes to the active navigator who owns the port, or to the Crown if the port has no owner or its owner has been eliminated. If you are short on cash, ships are seized to cover the tax in order of lowest used sale price first, with ties going to the lowest ship ID. Seized ships fill open slots in the host's sailing fleet (up to 20 ships), with excess ships going to their colony docks as described in Section 3. If there is no host, the Crown takes the ships. No change is given. You go bankrupt if you still owe tax after the seizures or have no ships left.

## 5. Naval battles

At a rival colony, defenders deploy from the docked ships if there are any. Otherwise, they deploy from the colony owner's sailing fleet, wherever it is on the chart.

- **Battle deployment**: Each side can deploy up to 4 ships with positive durability. In local and online play, humans can choose which ships to send before attacking a colony. Default selections, defenders, computers, and the player fleet in pirate encounters prioritize warships, then higher firepower, higher current durability, and lower ship ID. Cargo ships stay out by default; if no other ships can fight, the default picks one cargo ship. Ships held back take no battle damage and do not replace losses mid-battle. Only deployed ships count toward automatic withdrawal and flagship selection.

- **Port and starboard batteries (Command)**: Each ship's port and starboard batteries reload independently. Reload times per side are 3 seconds for a Warship, 3 for a Cargo Ship, and 2 for an Explorer. Each simulation step checks port before starboard. Each ready battery fires at one target on its side within range and within its broadside firing arc. It favors the target specified by an attack order; otherwise, it picks the nearest enemy ship, breaking ties by ship ID. Both sides can fire in the same step. Each uses the ship's full firepower and the existing random damage formula; firepower is not split. A battery with no target stays ready without affecting the other side's reload. Muzzle flashes and smoke appear on the side that fires, and the ship details show port and starboard status separately. Auto-resolve still uses the existing volley-per-round rules; separate batteries do not double the damage.

- **Persistent formations (Command)**: Issuing a move, attack, or fire-at-will order to two or more ships groups them in formation. The group uses the selected Column, Line, or Spread formation, or that side's last formation if none is specified. The initial formation is Line. The group leader is chosen by priority: signature ship, then highest max durability, then lowest ship ID. In Column, ships line up behind the lead ship; in Line, they fan out on either side; in Spread, they form a grid. Slots rotate with the formation's heading. The leader's slot is fixed, and other ships are assigned slots in order of their lateral position, with ties broken by ship ID, to reduce crossing paths. When moving or attacking, the group advances at the slowest ship's speed; other members can sail straight toward their slots at their own speed. The leader initially waits for the group to assemble. A member that has not closed in on its slot for 2 seconds stops holding up the leader, but keeps trying to catch up. If the group is still not assembled 3 seconds after it aligns its heading, it advances at half formation speed while members keep catching up, so it cannot get stuck indefinitely. Ships in the same group do not separate on collision and can pass through one another while assembling. Collision separation still applies between groups, ungrouped ships, and enemies. The formation turns first if not yet assembled. Once assembled, it turns at a rate the outer ships can keep up with. For move orders, the heading is set from the direction clicked before the destination is adjusted to fit within the boundaries. The group keeps its final heading on arrival. On attack, the formation approaches to 80% of the shortest firing range in the group, then turns broadside. Other members hold their slots and fire independently at targets within their range and firing arc. If the designated target sinks, the group holds formation in place rather than chasing other ships; fire-at-will also holds formation in place. Computer fleets form groups too: Easy opponents still charge, while Hard opponents can still send damaged ships and Cargo Ships away from combat or surrender altogether. Giving one ship an individual order removes it from the group; the others remain in formation. If a ship sinks or leaves, the leader and slots are reassigned; groups with fewer than two ships disband. Select a whole group and change its formation to keep its existing move, attack, or fire-at-will order. Near the battlefield edge, the formation shifts so all slots are within navigable bounds. If full spacing does not fit, it adds rows and columns and skips grid points that do not fit, rather than squeezing ships closer together.

- **Auto-resolve** (online rooms, computer versus computer, or when selected for local play): The two sides exchange up to 3 volleys. Both sides fire simultaneously each round. Each ship has an independent 85% chance to hit, regardless of fleet size. A hit deals damage equal to its firepower × a random multiplier (from 0.75 inclusive to 1.25 exclusive; multiply by 1.25 again if using Inspire), rounded to the nearest integer. Ambush halves defending ships' damage in the first volley. The total damage hits the deployed ship with the lowest durability first, with any overflow applied to the next ship.
- **Shot spread (Command)**: Beyond half a battery's range, longer shots have more spread. A shot still must land on a ship's hull to hit, regardless of fleet size.
- **Command**: Local colony battles involving a human, or pirate battles involving a human, take place on a real-time battlefield. A human attacker commands the attacking fleet; otherwise, the human commands the defenders. The computer commands the other side, even when two humans sharing one device fight each other. The battlefield is 2400 × 1350, with the sides starting at 10% and 90% of its width and ships initially spaced 174 units apart in rows and columns. Click or drag a box to select ships, then right-click to move or attack. On a touchscreen, tap the water or an enemy ship. You can select the entire fleet, pause, or change formation between Column, Line, and Spread. Ships automatically fire at enemies in range on their broadside. Shots must travel to their destination and hit to deal damage. Warships, Cargo Ships, and Explorers have ranges of 640, 440, and 520 and reload in 3, 3, and 2 seconds, respectively. A ship moves at its speed stat × 16, and shots travel at 800 battlefield units per second. In a normal approach, a ship stops at 80% of its range and turns to fire broadside. Easy computer opponents still charge. Either side can retreat at any time, which counts as defeat rather than a draw; the computer can also concede and retreat. The battle is a draw if neither side has won after 90 seconds.
- **Automatic withdrawal and sinking cap**: These rules apply to Command, battle replays, and Auto-resolve (including computer-only and online battles). Each human can choose **Auto-withdraw after losing** only at the pre-battle prompt: **1/4, Half, 3/4, or Fight to the last ship**. The default is Half, including for older saves without a setting. Computer players and pirates always use Half. Colony defenders use the owner's setting, whether they are docked ships or the sailing fleet. For the first three choices, let `n` be the number of ships eligible to fight at the start of battle and calculate `k = max(1, ceil(n × f))`, with `f = 0.25 / 0.5 / 0.75`. A side that begins with `n ≥ 2` ships automatically withdraws and loses when it has lost `k` ships or its flagship falls to **25% or less** of its max durability. The gold-bordered signature ship is the flagship. If there is none, use the ship with the highest max durability, breaking ties by lowest ship ID. At most `k` ships on that side can sink in a battle. Auto-resolve checks for withdrawal after each volley, sinking ships in the usual damage order up to the cap. Any further lethal damage in that volley leaves the affected ships at 1 durability. Real-time battles apply the cap on each hit and resolve withdrawal in that simulation step. With **Fight to the last ship**, the cap is `n`, and automatic withdrawal from ship losses or flagship damage is disabled. The entire fleet can sink; it does not retreat upon being reduced to one ship. You can still concede manually. The setting persists until you next change it. The battlefield displays the current loss cap but offers no way to change it. Pirate encounters or defensive battles without a pre-battle prompt use the existing setting. If both sides meet a defeat condition in the same volley or simulation step, the attacker loses.
- **Single-ship exception**: If a side starts with just one ship, no automatic withdrawal from ship losses or flagship damage applies, regardless of the setting. Even a lone flagship fights on and can be sunk. Current pirate encounters feature just one pirate ship, so the pirates also qualify for this exception.
- **Colony battle outcomes**: Sunk ships and their cargo are permanently removed. Survivors, including those that retreated manually or automatically, retain their post-battle durability. If the defenders lose or withdraw, the attacker captures the island and takes its buildings and stockpile. If the attacker loses or withdraws, they pay double the toll. Elimination for fleet loss happens only if the sailing fleet actually loses every ship. On a timeout draw, the attacker returns to their home port, and the defenders return to theirs if they fielded their sailing fleet. These returns grant neither salary nor a royal audience. If docked ships defended, the defending sailing fleet stays where it is. If the pirates withdraw, the player wins. If the player withdraws, it counts as losing to pirates; the rewards and penalties in the next section still apply, including the existing protection that keeps the last ship at 1 durability.

Docked defenders that withdraw rejoin their original owner's sailing fleet. They do not stay at the captured colony or become the attacker's ships.

Only ships above 0 durability at the start of battle count toward the starting ship total, and only those ships are eligible to be flagship. Ships already at 0 durability from a prior storm or another event do not participate or count as battle losses. They are not repaired or removed, and remain unchanged after the battle. The selected sinking cap and single-ship exception both use this starting count. A side with no eligible ships loses; if neither side has eligible ships, the attacker loses.

## 6. Sea encounters

Two roaming pirate groups and one roaming Small sea monster move 1–3 spaces each round along the route, forward or backward, without passing through ports or special islands. A roaming unit triggers an encounter only when a fleet lands on its space (passing through does not trigger it), then relocates to an empty space. If no roaming unit is at the landing space, landing on an Open sea event space always triggers a random encounter. Any other non-port landing, including a blank sea space, has a 20% chance to trigger a random encounter before resolving the landing itself. Blank sea spaces have no other landing action, but add sunken treasure salvage to the encounter table below at weight 14 (114 total on blank sea spaces only). Fixed treasure, storm, and trade wind spaces resolve their own events separately. Escort blocks the next harmful event: Storm, Pirates, either size of sea monster, Destructive sea turtle, or Bermuda whirlpool.

| Encounter | Random weight (100 total) | Effect |
| --- | ---: | --- |
| Pirates | 18 | Fight one pirate ship with 90 durability and 24 firepower. Gain 140 gold for a win, or lose 80 for a defeat or draw. Sunk ships are removed as usual, but if the pirates sink the entire fleet, the last ship sunk, in actual sinking order, is kept at 1 durability along with its cargo. This applies in both Command and Auto-resolve. |
| Small sea monster | 16 | One random ship loses up to 12 durability, and you lose 30 gold. |
| Bermuda whirlpool | 12 | There is a 33% chance each ship loses up to 10 durability and you lose 60 gold. Otherwise, move 4 spaces forward or backward at random along the route, then resolve any salary en route and the new landing. |
| Message bottle | 14 | There is an independent 50% chance of receiving a random Strategy card. In addition, there is a 10% chance of earning 600 gold, a 30% chance of fully repairing the sailing fleet, or a 60% chance of earning 70 gold. |
| Floating cargo | 14 | There is a 50% chance of gaining 100 gold. Otherwise, try to pick up 4 units of a random specialty. Take what fits if cargo space is limited; if none fits, gain 100 gold instead. |
| Merchant ship | 14 | The merchant buys up to 5 units of the first specialty your fleet carries, in the order of the goods table in Section 3. Multiply the quantity by the base price and by 1.5, then round the total to the nearest whole gold. The merchant also stocks 5 units of one random specialty and sells them at 0.8 times the base price per unit, rounded to the nearest whole gold. You can buy, sell, or skip; then proceed with the landing. |
| Wyvern | 4 | Choose any destination, fly there, and resolve the new landing. A direct flight to your home port also counts as a visit and pays salary. |
| Large sea monster | 4 | Each ship loses up to 55 durability and you lose 110 gold. There is also a 35% chance one random ship sinks, but it will not sink your last ship. |
| Destructive sea turtle | 4 | Sinks one random ship. If there is only one ship, it loses up to 70 durability instead. |

Sea monster and turtle damage cannot reduce positive durability below 1. Storms and whirlpools can reduce it to 0 but do not remove ships. Whirlpools and wyverns can change the destination at most 4 times combined per voyage.

- **Sunken treasure**: Find 50, 100, 150, or 200 gold with equal probability. A separate buried hoard lies in a random treasure space; digging it up yields an additional 200 gold. It is then reburied in another treasure space and every player's existing clues are invalidated.
- **Storm**: Each ship loses up to 10 durability, and you lose 50, 75, or 100 gold at random. Demand for lumber and iron increases on Nightless Island.
- **Trade winds**: Gain 50 gold plus 30 per colony you own. Nightless Island gains 3 units of stock for every good.

## 7. Special islands

| Special island | What happens on landing |
| --- | --- |
| Skeleton Island | Buy and sell used ships. See Section 3 for prices and restrictions. |
| Treasure Island | In 20 seconds, choose up to 5 distinct numbers from 1 to 20 at 40 gold each. You can draw early or buy no numbers. Five numbers are drawn without replacement. Matching 0, 1, 2, 3, 4, or 5 wins 0, 80, 240, 720, 2,400, or 8,000 gold, respectively. If you cannot afford one number, leave immediately. |
| Mist Island | You may skip the challenge. If you choose a hermit, start with 12 tokens. You go first, and each side takes 1–3 tokens in turn. Whoever takes the last token loses. A win pays 130 gold and grants that hermit's Strategy card. The Brook Hermit (Gentle) takes 1 each time and awards Navigate. The Pine Hermit (Bold) takes 3 when possible but leaves 1 if able, and awards Locate. The Summit Hermit (Expert) tries to leave a count that has a remainder of 1 when divided by 4, or takes 1 when that is not possible, and awards Inspire. |
| Revival Island | Automatically repairs the sailing fleet at 2 gold per durability point. If gold is limited, ships are repaired in fleet order until you cannot afford the next point, so repairs may be partial. A fully intact fleet pays nothing. There is no Escort and sunk ships are not revived. |
| Nightless Island | Buy and sell resources and specialties. See Section 3. |
| Wind Island | Barter with up to 3 random offers. Decline them or make one trade before leaving. Trade a good carried by your fleet with a unit valuation of 50 or less for a more valuable good. Each offer asks for a random 1–5 units, not exceeding what you carry. You receive the lesser of the quantity you give and the total valuation of the goods you give divided by the incoming good's unit valuation, rounded down and then increased by 1. Cargo capacity still applies. Without suitable goods, there is no trade. |
| Dragon Snake Island | Get up to 3 random choices from captains whose minimum rank you meet and whom you have not hired before. If you cannot afford any, leave. You may decline, or hire up to one per visit and up to 3 per navigator in total. Recruited captains bring ships at full durability, distributed under the fleet limit in Section 3. Captains grant no additional salary or tax discount. |

| Captain | Minimum rank | Fee | Ships brought |
| --- | --- | ---: | --- |
| Ines Tidewalker | Ensign | 180 | Explorer |
| Rui of the Reefs | Ensign | 300 | Cargo Ship |
| Mei Starwatcher | Ensign | 450 | Warship |
| Gaspar Silverquill | Lieutenant (Junior Grade) | 480 | Explorer, Cargo Ship |
| Amara Stormglass | Lieutenant | 480 | Explorer, Cargo Ship |
| Lin of the Silk Sails | Lieutenant | 750 | Cargo Ship, Warship |
| Duarte Red Compass | Lieutenant Commander | 750 | Cargo Ship, Warship |
| Zahra Dawnseeker | Commander | 900 | 2 Warships |
| Leonor Golden Horizon | Captain | 900 | 2 Warships |

## 8. Strategy cards

You can hold at most 5 cards. If your hand is full, discard any new card immediately. You may play at most one per turn, and it is consumed on use. Besides the starting hand, cards can come from a Message bottle or from winning a duel on Mist Island. Only opponents still in the match may be targeted. In the table, “during negotiations” means after arriving at a rival colony but before paying the toll or starting the battle.

| Strategy | When to play | Effect |
| --- | --- | --- |
| Navigate | Before spinning | Go directly to any space on the chart without spinning the compass. |
| Inspire | Before spinning / during negotiations | Boost your side's attacking firepower by 25% this turn, including against pirates. The bonus expires as soon as a real-time pirate battle ends. |
| Mislead | Before spinning / during negotiations | Deal up to 40 durability damage to a random ship in the rival's sailing fleet, or to the lead defender if played during negotiations. Positive durability cannot drop below 1. |
| Locate | Before spinning | Reveal the location of the buried hoard until it is dug up. |
| Betray | Before spinning / during negotiations | The lowest-firepower ship from a rival fleet or defending force defects to your side, subject to Section 3's fleet limit. At least one ship must remain in a rival's sailing fleet. |
| Tailwind | Before spinning | Double the compass result. |
| Reverse Course | Before spinning | Keep the compass result, but sail backward along the main route. |
| Blockade | Before spinning | A chosen rival skips their next turn. |
| Plunder | Before spinning | Take 10% of a rival's gold, rounded down and capped at 150. |
| Call the Gale | Before spinning | Each ship in a rival's sailing fleet loses up to 15 durability, but positive durability cannot drop below 1. |
| Escort | Before spinning | Block your next harmful sea encounter. Protection persists across turns until used. |
| Toll Exemption | During negotiations | Waive this colony toll and end your turn. Does not waive foreign tax. |
| Surprise Attack | During negotiations | In an auto-resolved colony battle, defenders deal half firepower in the first round. In a real-time battle, defenders cannot fire for the first 4 seconds. |
| Incite Revolt | Before spinning | Return an undeveloped rival colony (no docked ships and no buildings) to neutral, clearing its stockpile. |
| Harvest | Before spinning | All your colonies immediately produce an extra round of goods. |
| Trade Charter | Before spinning | Gain 40 gold per colony you own, up to 300 total. |
| Emergency Repairs | Before spinning | Restore up to 30 durability to each ship in the sailing fleet for free (up to max durability). |
| Recall | Before spinning | Go directly to your home port for a royal audience without collecting salary en route. |
| Exchange Positions | Before spinning | Swap fleet positions with a chosen rival without resolving either landing. You still have to spin the compass. |
| Burn Stores | Before spinning | Destroy half of a chosen rival colony's stockpile (rounded up per resource) without destroying buildings or ships. |

## 9. King's Campaign

The three stages are independent and can be played in any order. Each is a local single-player game. Choose a nation and face the number and difficulty of computer opponents set for that stage. Your 3 starting cards always include Navigate. Each mission pays its reward immediately when first met, and once completed it stays completed. To clear a stage, complete both missions without being eliminated. Standard match victories based on territory or net worth do not apply. Bankruptcy, losing your entire sailing fleet, or exceeding the round limit results in failure.

| Stage | Opponents / Round limit | Starting gold / Base salary | Missions (individual rewards) |
| --- | --- | --- | --- |
| First Voyage | 1 Easy; no round limit | 1,400 / 400 | Found a colony on an unclaimed new continent (150); land at your home port while you own a colony (250). |
| The Merchant Charter | 2 Normal; 28 rounds | 1,600 / 400 | Sell a total of 3 units of specialties on Nightless Island (200); build a Collection field in one of your colonies (250). |
| Crown of the Seas | 3 Hard; 20 rounds | 1,200 / 300 | Own 2 colonies at once (250); capture a rival colony by winning a naval battle (400). |

## 10. Computer opponents and online rooms

- **Computer opponents**: Easy, Normal, and Hard change decisions only, not starting resources, compass odds, or ship stats. The computer follows the same rules for claiming land, paying tolls, fighting, building, trading, repairing, and using Strategy cards. When transferring ships at a colony that can repair them, it leaves damaged docked ships there until they are fixed. All difficulties invest when they claim or visit their own colonies: with enough rounds left to recover the cost, they build lumber mills, iron mines, and collection fields where there is a local specialty, while keeping cash in reserve. Easy opponents tend to save cash and upgrade less. Normal opponents weigh the returns from trade, tolls, and construction. Hard opponents also use the compass distribution to estimate the next move, choose safer opportunities to attack, and prioritize replenishing their fleets. The computer buys at most 3 numbers on Treasure Island and will not let its gold fall below 600 by buying them. Hard opponents choose the Brook Hermit on Mist Island and calculate how many tokens to take.
- **Online rooms**: Choose **Host online room**, set the standard match mode and computer difficulty, and send the invite link to the other players. Each room supports 2–6 humans, with distinct nations; the computer fills the remaining nations to make 10 seats. The host can start when at least two humans are present and all humans are online. No one can join after the match starts. Naval battles always auto-resolve, and campaigns are unavailable.
- **Disconnects and whose turn it is**: Refreshing or reopening the invite in the same tab reconnects you using the seat token stored in that tab. Before a match starts, a disconnected seat is freed after about 30 seconds; leaving voluntarily frees it immediately. If the host leaves, the first remaining seat becomes host. During a match, disconnected players keep their seats. The match only stalls when one of them needs to act; the computer does not take over. Movement and lottery countdowns already in progress can still resolve. A match is cleared after all humans have been offline for about an hour. Rooms exist only in server memory and do not survive a restart.
