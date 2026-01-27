# 🏓 Ping Pong Tracker - Rule Book

## Overview
A competitive ping pong tracking app with an ELO-based ranking system. Track matches, view leaderboards, and compete with friends!

---

## 🎯 Rating System (ELO)

### Starting Rating
- **New players start at 800 ELO**

### Star Tiers
| ELO Range | Stars |
|-----------|-------|
| 1600+ | ⭐⭐⭐⭐⭐ |
| 1400-1599 | ⭐⭐⭐⭐ |
| 1200-1399 | ⭐⭐⭐ |
| 1000-1199 | ⭐⭐ |
| 800-999 | ⭐ |
| Below 800 | ☆ |

### How ELO Changes

#### 1. Base Calculation
- Beating a higher-rated player = more points gained
- Beating a lower-rated player = fewer points gained
- Losing to a lower-rated player = more points lost

#### 2. Experience Factor (K-Factor)
Your rating volatility depends on how many games you've played:

| Games Played | K-Factor | Meaning |
|--------------|----------|---------|
| 0-9 games | 40 | High volatility (new player) |
| 10-29 games | 32 | Standard volatility |
| 30+ games | 24 | Stable rating (experienced) |

#### 3. Score Margin Bonus
Winning by more points gives a bonus multiplier:

| Point Difference | Multiplier |
|------------------|------------|
| Win by 2 | 1.0x (no bonus) |
| Win by 4 | 1.1x |
| Win by 6 | 1.2x |
| Win by 8 | 1.3x |
| Win by 10 | 1.4x |
| Win by 11 (11-0) | 1.45x |

#### Example Calculations
- Two equal 800-rated new players, close game (11-9): Winner gets **+20**, Loser gets **-20**
- Two equal 800-rated new players, dominant win (11-1): Winner gets **+29**, Loser gets **-29**
- Experienced player (30+ games) beats similar-rated player: Winner gets **~12-17** points

---

## 📊 Provisional Status

### What is Provisional?
Players with **fewer than 5 games** are considered "Provisional":

- They appear at the **bottom** of the leaderboard
- They have a **"Provisional" badge** next to their name
- Their rank shows as **"-"** instead of a number
- Their name appears **grayed out**

### Why?
This prevents new players from immediately topping the leaderboard after just 1-2 lucky wins. Once you play 5 games, your rating becomes "established" and you're ranked normally.

---

## 😴 Inactivity Rules

### Grace Period
- **14 days** - You can be inactive for up to 14 days with no penalty

### After 14 Days
- You are **hidden** from the leaderboard
- Your data is **still saved** in the database
- You can return at any time

### Return Penalty
When you play your first match after being inactive:
- **-7 ELO per day** of total inactivity (counted from day 1)
- Minimum ELO is capped at 100

| Days Inactive | Penalty | Hidden from Leaderboard? |
|---------------|---------|--------------------------|
| 7 days | -49 ELO | No |
| 14 days | -98 ELO | No |
| 15 days | -105 ELO | Yes |
| 21 days | -147 ELO | Yes |
| 30 days | -210 ELO | Yes |

**Example:** If you're at 1200 ELO and don't play for 31 days, when you return and play a match, you'll first lose 217 ELO (7 × 31), dropping to 983, then the match result is applied.

---

## 🎮 Match Rules

### Valid Scores
- Games are played to **11 points** (standard ping pong rules)
- You must **win by 2** (minimum winning score difference)

### Recording a Match
1. Select two different players
2. Enter the final scores
3. The system automatically determines the winner
4. ELO is calculated and applied to both players

### Deleting a Match
- Requires **admin password**
- When deleted, all ELO changes from that match are **reversed**
- Win/loss counts are adjusted accordingly

---

## 👤 Player Management

### Adding a Player
- Enter a unique display name
- Player starts at 800 ELO with 0 wins, 0 losses
- Immediately enters "Provisional" status

### Deleting a Player
- Requires **admin password**
- All matches involving that player are deleted
- Other players' stats from those matches are reverted

---

## 📈 Head-to-Head

View match history between any two players:
- See all matches played between them
- View who won each match and by how much
- Track your rivalry with specific opponents

---

## 🏆 Leaderboard

### Ranking Order
1. **Established players** (5+ games) - sorted by ELO, highest first
2. **Provisional players** (<5 games) - sorted by ELO, shown at bottom
3. **Inactive players** (14+ days) - hidden from view

### What's Displayed
- Rank badge (👑 for #1, medals for #2-3)
- Player name
- Star rating
- Win/Loss record
- Current ELO

---

## 🔐 Admin Functions

The following actions require the admin password:
- Deleting players
- Deleting matches

---

*Keep playing, keep improving, and climb that leaderboard!* 🏓
