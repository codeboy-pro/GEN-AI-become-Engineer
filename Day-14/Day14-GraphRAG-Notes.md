# Day 14 — GraphRAG & Graph Databases
### Zero → Hero Notes (with worked examples)

---

## 📑 Table of Contents

1. [The Core Problem: Why Normal RAG Fails](#1-the-core-problem-why-normal-rag-fails)
2. [Why Agentic RAG Also Struggles](#2-why-agentic-rag-also-struggles)
3. [GraphRAG — The Solution](#3-graphrag--the-solution)
4. [Worked Example 1 — E-commerce Product Catalog](#4-worked-example-1--e-commerce-product-catalog)
5. [Worked Example 2 — Actors & Oscar-Winning Directors](#5-worked-example-2--actors--oscar-winning-directors)
6. [Worked Example 3 — Criminal Investigation](#6-worked-example-3--criminal-investigation)
7. [Worked Example 4 — Project Alpha (Employees × Marketing Budgets)](#7-worked-example-4--project-alpha-employees--marketing-budgets)
8. [Worked Example 5 — Bank Fraud Detection](#8-worked-example-5--bank-fraud-detection)
9. [How Graph Databases Actually Work Internally](#9-how-graph-databases-actually-work-internally)
10. [Cypher Query Language Basics](#10-cypher-query-language-basics)
11. [When to Use Graph DB vs Relational DB](#11-when-to-use-graph-db-vs-relational-db)
12. [Cheat Sheet / Summary](#12-cheat-sheet--summary)

---

## 1. The Core Problem: Why Normal RAG Fails

### 1.1 How Normal RAG works (quick recap)

```
User Query
   ↓
Convert query → embedding vector
   ↓
Compare against embeddings of all chunks in Vector DB (cosine similarity)
   ↓
Retrieve top-k most SIMILAR chunks
   ↓
Stuff them into LLM prompt
   ↓
LLM generates answer
```

Normal RAG makes one core assumption:

> **"The chunk that contains the answer will also be semantically similar to the question."**

This assumption holds for simple, single-hop questions ("What is the capital of France?"). It **breaks down** for **multi-hop questions** — questions that require chaining several *separate* facts together, where each individual fact, on its own, does not resemble the original question at all.

### 1.2 The general failure pattern

Every example in this lecture follows the exact same shape:

| Step | What happens |
|---|---|
| 1 | The query implies a **chain of 3–5 logical hops** (A → B → C → D → E) |
| 2 | Only the chunks near the **start** of the chain (or the ones using the query's exact keywords) get high similarity scores |
| 3 | The chunks that complete the chain — often the **most important ones** — use completely different vocabulary and get **low similarity scores** |
| 4 | Top-k retrieval **never pulls in** those low-similarity-but-essential chunks |
| 5 | The LLM answers with a *plausible-sounding but incomplete or wrong* answer |

**The key insight to memorize:**

> Your answer depends on chunks that individually don't resemble your query at all.
> Semantic similarity finds chunks *about the same topic* — not chunks that are *logically connected* to each other.

---

## 2. Why Agentic RAG Also Struggles

Agentic RAG tries to patch this by having the LLM **break the query into sub-queries** and run them one after another (multi-step retrieval), instead of a single vector search.

```
Query
  ↓
Sub-query 1 → vector search → partial answer
  ↓
Sub-query 2 (uses result of 1) → vector search → partial answer
  ↓
Sub-query 3 (uses result of 2) → vector search → partial answer
  ↓
...
  ↓
Final synthesis
```

This is **better**, but it has 4 structural weaknesses:

| # | Problem | Why it happens |
|---|---|---|
| 1 | **Accumulating errors** | Each hop has some chance of missing the right chunk. Over 5 hops: `0.9^5 ≈ 59%` accuracy even if each step is 90% reliable |
| 2 | **Combinatorial explosion** | 3 sellers × 3 brands × 10 products × 20 customers × 5 products each = an explosion of searches / LLM calls |
| 3 | **No guarantee of connection** | A chunk can mention the right keywords ("Samsung Galaxy S24 is popular...") without actually answering *who bought it* |
| 4 | **No entity resolution** | "Rahul" in one chunk and "Mr. Sharma" in another might be the same person — Agentic RAG has no way to know that |

**Bottom line:** Agentic RAG is *sequential guessing with vector search at each step*. It's more thorough than plain RAG, but still relies on semantic similarity at every hop — so it can still silently drop the one chunk that matters.

---

## 3. GraphRAG — The Solution

### 3.1 The core idea

Instead of treating your corpus as a pile of independent chunks to be *searched*, GraphRAG converts it into a **knowledge graph** — a structure that can be *traversed* using logical rules instead of similarity scores.

```
   TRADITIONAL RAG                    GRAPHRAG
  ┌────────────────┐            ┌───────────────────────┐
  │  Chunk 1        │            │   (Entity A)          │
  │  Chunk 2        │  ──────>   │      │  relationship   │
  │  Chunk 3        │  build     │      ▼                 │
  │  Chunk 4        │  graph     │   (Entity B)──rel──►(C)│
  │  ...            │            │      │                 │
  │  Chunk N        │            │      ▼                 │
  └────────────────┘            │   (Entity D)            │
   "search by similarity"        └───────────────────────┘
                                  "traverse by connection"
```

### 3.2 The GraphRAG pipeline (ingestion time)

```
Raw text chunks
     ↓
① ENTITY EXTRACTION      → LLM pulls out People, Products, Companies, Locations, etc.
     ↓
② ENTITY RESOLUTION      → Merge duplicates ("Rahul" == "Rahul Sharma" == "Mr. Sharma")
     ↓
③ RELATIONSHIP EXTRACTION → LLM pulls out (source) -[relationship]-> (target), with properties
     ↓
④ GRAPH CONSTRUCTION      → Store nodes + edges in a graph database (e.g. Neo4j)
     ↓
⑤ (Optional) COMMUNITY DETECTION → Cluster densely-connected nodes into "communities"
     ↓
⑥ (Optional) COMMUNITY SUMMARIZATION → LLM writes a plain-English summary per community
     ↓
     Vector DB (still keeps raw chunks — used for detail / grounding)
```

### 3.3 The GraphRAG pipeline (query time)

```
User Query
     ↓
① Identify starting entity/entities in the query
     ↓
② TRAVERSE the graph (follow edges, N hops) — not a similarity search!
     ↓
③ Apply filters/conditions at each hop (e.g. "rating > 4.5", "genre different")
     ↓
④ (Optional) Generate sub-queries per relationship, then do a
    TARGETED vector search filtered to only the discovered entities
     ↓
⑤ LLM synthesizes final answer from: graph structure + retrieved chunk text
```

### 3.4 Why this fixes everything

| Failure in Normal/Agentic RAG | How GraphRAG fixes it |
|---|---|
| Low-similarity-but-essential chunks get dropped | Graph traversal doesn't care about similarity — it follows explicit edges |
| No entity resolution | Step ② (Entity Resolution) explicitly merges duplicate mentions |
| Errors compound over multi-hop chains | Traversal is deterministic graph-walking, not repeated fuzzy search |
| Can't discover "indirect" connections (e.g. friend-of-a-friend) | This is *exactly* what graph traversal is built for |

> **One-line summary:** Normal RAG asks *"which chunks look like my question?"* GraphRAG asks *"which chunks are connected to my question?"* — and those are very different sets.

---

## 4. Worked Example 1 — E-commerce Product Catalog

**Query:** *"Show me products bought by customers who also bought items from brands that our top-reviewed sellers carry."*

This requires a **5-hop chain**:

```
Top-rated sellers → brands they carry → products of those brands →
customers who bought those products → ALL other products those customers bought
```

### Why normal RAG fails
The chunk that says *"Priya also bought AirPods Pro, MacBook Air, and Samsung Galaxy Buds"* has **zero overlap** with words like "top-reviewed," "seller," or "brand." Its similarity score to the query is low (~0.3) — it never makes it into top-k, even though it's essential.

### GraphRAG solution

**Entities extracted:** Customers (Rahul, Sneha, Priya, Amit), Products, Brands (Apple, Samsung, Sony, OnePlus), Sellers (QuickCart, MobileHub, TechZone)

**Relationships:**
```
(Customer) -[purchased]-> (Product)
(Product)  -[manufactured_by]-> (Brand)
(Seller)   -[sells]-> (Product)
(Seller)   -[carries]-> (Brand)
(Seller)   -[has_rating]-> (number)
```

**Traversal:**
```
Step 1: Sellers with rating > 4.5      → QuickCart (4.9), TechZone (4.8)
Step 2: Brands they carry              → Apple, Samsung, Sony
Step 3: Products of those brands       → iPhone 15 Pro, AirPods Pro, MacBook Air,
                                          Galaxy S24, Galaxy Buds, Sony WH-1000XM5
Step 4: Customers who bought those     → Rahul, Priya, Sneha, Amit
Step 5: ALL products these customers bought (including unrelated ones!)
```

**Final answer includes:** iPhone 15 Pro, AirPods Pro, MacBook Air, Galaxy S24, Galaxy Buds, Sony WH-1000XM5, **and OnePlus 12**.

### 🔑 The "aha" moment
OnePlus 12 is **not** sold by any top-rated seller. It got included because:
```
QuickCart (top seller) → carries → Samsung → Galaxy Buds → bought by → Amit → also bought → OnePlus 12
```
No single chunk ever states this connection. It only emerges by **walking the graph**. This is the whole point of GraphRAG — surfacing answers that no individual document contains.

---

## 5. Worked Example 2 — Actors & Oscar-Winning Directors

**Query:** *"Find actors who worked with directors who later won Oscars for films in a different genre."*

### Why normal RAG fails
High-similarity chunks all contain the word "Oscar"/"Academy Award" (e.g. *Oppenheimer won Best Picture*). But the actual **answer** — actors like Christian Bale, Tom Hardy — live in chunks about *The Dark Knight* and *Inception*, which never mention Oscars at all. Those chunks score low and get excluded.

### GraphRAG traversal

```
Step 1: Films that won an Oscar          → Oppenheimer, Birdman, The Departed
Step 2: Directors of those films          → Nolan, Iñárritu, Scorsese
Step 3: Genre of the Oscar-winning film   → Bio-Drama, Dark Comedy, Crime Thriller
Step 4: OTHER films by same directors     → Dark Knight, Inception, Revenant, Wolf of Wall St, Killers of Flower Moon
Step 5: Keep only films with a DIFFERENT genre than the Oscar film
Step 6: List the actors in those films
```

**Final answer:** Christian Bale, Heath Ledger, Leonardo DiCaprio, Tom Hardy, Margot Robbie, Robert De Niro.

### 🔑 Key lesson
This query has a **conditional filter mid-chain** ("...in a different genre"). Graph traversal can apply this filter *at the node/edge level* as it walks — something a single-shot similarity search structurally cannot do.

---

## 6. Worked Example 3 — Criminal Investigation

**Query:** *"Find all suspects who were present at locations visited by the victim in the 48 hours before the incident and who have connections to people with prior records."*

This is the **hardest** example because it needs a chain across **completely unrelated topic clusters**: locations → presence → family relationships → criminal records.

### Why both Normal and Agentic RAG fail
- Chunk *"Raj Thakur is the brother of Deepak Thakur"* → no crime keywords, low similarity.
- Chunk *"Deepak Thakur was convicted of assault"* → no mention of Raj, no mention of "suspect" or "location."
- Neither chunk alone answers anything, and no query wording connects them semantically.
- Agentic RAG's sub-query *"Does Raj Thakur have connections to people with prior records?"* also fails — no chunk contains both "Raj" and "criminal record" together.

### GraphRAG traversal

```
Step 1: Incident window = 48 hrs before death (March 12 10PM → March 14 midnight)
Step 2: Victim's locations in that window → Sunrise Cafe, Hotel Grand Plaza, Riverside Park
Step 3: Who else was present at those locations (with overlapping time)?
        → Raj Thakur (Cafe + Park), Vikram Malhotra, Sanjay Mehta, Anita Desai (Hotel)
Step 4: For each person, check "connections → prior records":
        Raj    → brother_of → Deepak → has_record: Assault(2019)  ✅ MATCH
        Vikram → has_record: Fraud(2022) himself                   ✅ MATCH
        Sanjay → investigated_for: Theft(2020, dismissed)          ✅ MATCH (borderline)
        Anita  → no record, no connections                         ❌ no match
```

**Final suspects:** Raj Thakur, Vikram Malhotra, Sanjay Mehta.

### 🔑 Bonus insight only a graph reveals
Raj Thakur appears at **two** of the victim's locations (the café *and* the park near time of death). This pattern is invisible when chunks are retrieved independently — it only becomes obvious once you look at **all of Raj's `present_at` edges together**.

---

## 7. Worked Example 4 — Project Alpha (Employees × Marketing Budgets)

**Query:** *"Which employees who worked on Project Alpha have also collaborated with the marketing team on campaigns that exceeded their budget?"*

### The full GraphRAG pipeline shown end-to-end

**① Entity Extraction (per chunk, LLM outputs JSON):**
```json
{"entities": [
  {"name": "Priya", "type": "Employee"},
  {"name": "Marketing Team", "type": "Team"},
  {"name": "Q3 Campaign", "type": "Campaign"}
]}
```

**② Entity Resolution** — "Priya" mentioned in chunks 1, 2, 10 → merged into ONE node.

**③ Relationships extracted:**
```
(Amit)  -[works_on]->        (Project Alpha)
(Priya) -[works_on]->        (Project Alpha)
(Raj)   -[works_on]->        (Project Alpha)
(Priya) -[collaborated_with]-> (Marketing Team)
(Raj)   -[collaborated_with]-> (Marketing Team)
(Amit)  -[collaborated_with]-> (Sales Team)          ← NOT marketing!
(Priya) -[worked_on]->       (Q3 Campaign)
(Raj)   -[worked_on]->       (Q1 Campaign)
(Q1 Campaign) -[budget_status]-> exceeded (₹3L budget, ₹4.2L spent)
(Q3 Campaign) -[budget_status]-> exceeded (₹5L budget, ₹7.2L spent)
(Q4 Campaign) -[budget_status]-> under   (₹8L budget, ₹6.5L spent)
```

**④ Traversal:**
```
Start → Project Alpha → employees: {Amit, Priya, Raj}
   Filter: collaborated_with → Marketing Team?
        Amit  → Sales Team only        → ❌ OUT
        Priya → Marketing Team ✓        → keep
        Raj   → Marketing Team ✓        → keep
   Find campaigns worked on:
        Priya → Q3 Campaign
        Raj   → Q1 Campaign
   Check budget_status:
        Q3 → exceeded ✓
        Q1 → exceeded ✓
```

**Final answer: Priya and Raj** (with exact ₹ overage figures pulled straight from node properties).

**Excluded, and why (important for understanding filters):**
- **Amit** — on Project Alpha, but collaborated with Sales, not Marketing.
- **Suresh** — collaborated with Marketing on an over-budget campaign, but never worked on Project Alpha.
- **Neha** — same reason as Suresh.

### 🔑 Community Detection (bonus concept introduced here)
Graph algorithms can auto-cluster nodes into **communities** of densely connected entities:
- *Community 1:* Amit, Priya, Raj, Project Alpha, Marketing Team, Q1/Q3 Campaigns, Suresh
- *Community 2:* Neha, Suresh, Vikram, Project Beta, Priya
- *Community 3:* Amit, Sales Team

An LLM can then write a **plain-English summary per community** — this is what powers "global" questions like *"summarize everything about Project Alpha's marketing involvement"* without re-reading every chunk.

---

## 8. Worked Example 5 — Bank Fraud Detection

**Query:** *"Is RohitKumar's account involved in suspicious activity?"*

### Why Normal RAG fails badly here
| Chunk | Mentions "RohitKumar"? | Similarity | Retrieved? |
|---|---|---|---|
| Rohit → $5000 → ShellCompany | ✅ | 0.85 | ✅ |
| Laptop_Mumbai → login → Rohit | ✅ | 0.72 | ✅ |
| Laptop_Mumbai → also logs into **PriyaSharma** | ❌ | 0.35 | ❌ **MISSED** |
| PriyaSharma → $3000 → ShellCompany | ❌ | 0.28 | ❌ **MISSED** |
| ShellCompany flagged in 2023 money-laundering case | ❌ | 0.40 | ❌ **MISSED** |

The LLM only sees 2 of 5 chunks and gives a wishy-washy "hard to tell" answer — **completely missing the fraud ring.**

### GraphRAG solution

**Graph built:**
```
[RohitKumar] --accessed_from--> [Laptop_Mumbai] <--accessed_from-- [PriyaSharma]

[RohitKumar] --transacted_with($5000)--> [ShellCompany LLC] --flagged_in--> [MoneyLaunderingCase2023]
                                                 ▲
[PriyaSharma] --transacted_with($3000)----------┘
```

**Traversal (Cypher-style, 1–3 hops from RohitKumar):**
```cypher
MATCH path = (start:Account {name: "RohitKumar"})-[*1..3]-(connected)
RETURN DISTINCT connected.name, labels(connected)
```
→ discovers: Laptop_Mumbai, PriyaSharma, ShellCompany LLC, MoneyLaunderingCase2023

**Then**, for precision, the LLM generates **one sub-query per discovered relationship** and runs a vector search *filtered to just those entities* — this pulls back **all 5 chunks** (vs. only 2 in normal RAG), because retrieval is now anchored by graph-discovered entities, not raw query similarity.

**LLM's final synthesized answer flags three red flags:**
1. **Device sharing** — same laptop accessed two different accounts (classic account-takeover / mule-network signature).
2. **Common merchant** — both accounts sent money to the same ShellCompany LLC.
3. **Merchant fraud history** — ShellCompany LLC was already flagged in a real money-laundering case.

→ Recommends freezing both accounts and auditing everyone who ever touched Laptop_Mumbai.

### 🔑 Pattern to remember: "Graph-Guided RAG"
```
Query → Graph Traversal (find WHAT entities matter, structurally)
      → Sub-query generation (one per discovered relationship)
      → Vector search filtered to those entities (get the DETAIL text)
      → LLM synthesis over (graph structure + chunk text)
```
This hybrid — **graph for structure, vectors for detail** — is the production-grade GraphRAG pattern used across all 5 examples above.

---

## 9. How Graph Databases Actually Work Internally

### 9.1 The motivating pain (relational DB world)

Imagine building LinkedIn with tables: `users`, `friendships`, `companies`, `skills`, plus junction tables. A simple query...

> *"Friends of friends of friends who work at Google and know React"*

...needs **7 JOINs**:

```sql
SELECT DISTINCT u.name
FROM users u
JOIN friendships f3 ON u.id = f3.friend_id
JOIN friendships f2 ON f3.user_id = f2.friend_id
JOIN friendships f1 ON f2.user_id = f1.friend_id
JOIN employment e   ON u.id = e.user_id
JOIN companies c    ON e.company_id = c.id
JOIN user_skills us ON u.id = us.user_id
JOIN skills s        ON us.skill_id = s.id
WHERE f1.user_id = 1 AND c.name = 'Google' AND s.name = 'React'
```

### 9.2 Why JOINs get expensive

> **Core insight:** In a relational database, relationships don't physically exist. They are *recomputed* at query time by matching foreign keys.

Each JOIN = scan/index-lookup + fetch, repeated for every row. As hop-depth grows, cost **multiplies**:

| Depth | Relational Cost | Graph DB Cost |
|---|---|---|
| 1 hop | 1 table scan | pointer jump |
| 2 hops | 2 table scans | pointer jump |
| 5 hops | 5 table scans | pointer jump |
| 10 hops | timeout risk | pointer jump |

**Graph DB cost per hop is constant. Relational DB cost multiplies with depth.** This is called **"index-free adjacency."**

### 9.3 The First-Principles Fix: store relationships as physical pointers

```
[User A] ---friend---> [User B] ---friend---> [User C]
                                 ---friend---> [User D]
```
`User B` doesn't just sit as a row waiting to be joined — it **physically holds a pointer** to its friends. Traversal = "walking" from node to node, no table scans, no JOINs.

### 9.4 Relationships are first-class citizens (they carry data too)

```
[User A] --friend {since: 2019, strength: "close"}--> [User B]
```
The edge itself is an object with its own properties — not just a dumb arrow.

**Complete anatomy of a Graph DB:**
1. **Nodes** — entities (User, Company, Skill)
2. **Relationships** — directional, typed, physical connections
3. **Properties** — key/value data on *both* nodes and relationships

### 9.5 Physical storage model — the linked-list trick

Each node stores **only one pointer**: to the *first* relationship in its chain. Each relationship stores a pointer to the *next* relationship.

```
Node Record (Rohit):
  id: 1
  first_outgoing_relationship: 5001   ← byte address on disk

Relationship @5001:
  type: "friend", from: 1, to: 2 (Amit)
  next_outgoing_for_Rohit: 5002

Relationship @5002:
  type: "friend", from: 1, to: 3 (Priya)
  next_outgoing_for_Rohit: NULL
```

**Query "Rohit's friends":**
```
Rohit.first_outgoing → 5001 (Amit) → next → 5002 (Priya) → next → NULL
```
No scanning. Just following addresses = **O(1) per hop**.

### 9.6 Incoming relationships (reverse traversal)

To answer *"Who considers Amit their friend?"* each relationship record keeps **two** chains simultaneously:

```
R1: Rohit → Amit   | next_outgoing_for_Rohit: R2 | next_incoming_for_Amit: R3
R3: Aman  → Amit   | next_incoming_for_Amit: R4
R4: Priya → Amit   | next_incoming_for_Amit: NULL
```
Same walking pattern, just following the "incoming" chain instead of "outgoing."

### 9.7 Why fixed-size records matter

Every node record is the same byte size; every relationship record is the same byte size. So node #42 lives at:
```
offset = 42 × record_size
```
→ **direct disk jump, O(1)**, no searching needed to locate a node by ID.

Properties are variable-length (one user has 2 properties, another has 20) — so they're stored **separately** as their own linked list, keeping the fixed-size node/relationship records lean and fast.

### 9.8 Property lookups (when you don't have an ID)

*"Find user with email = rohit@gmail.com"* — you don't have an ID, so graph DBs fall back to a classic **B-tree index**:

```
Email Index (B-tree):
  "amit@gmail.com"  → Node ID 17
  "rohit@gmail.com" → Node ID 42
```
Lookup → get ID 42 → `offset = 42 × record_size` → jump straight to the node.

**Why B-tree and not a hash table?** Hash tables are O(1) for *exact* match only. B-trees preserve order, enabling range queries:
```sql
WHERE email > 'r'
WHERE age BETWEEN 25 AND 40
WHERE name STARTS WITH 'Ro'
```

### 9.9 Where Graph DB has NO advantage

*"Find all users who work at Google"* — this is a flat filter, no traversal. A relational DB with an index on `company` does this **just as fast**. Graph DB's superpower is specifically **multi-hop traversal**, not simple filtering or aggregation (`SUM`, `COUNT`, `GROUP BY` — relational still wins there).

---

## 10. Cypher Query Language Basics

Cypher lets you **draw the pattern** you want instead of writing JOINs.

| Goal | Cypher |
|---|---|
| Rohit's friends | `MATCH (r:User {name:"Rohit"})-[:friend]->(f) RETURN f.name` |
| Friends of friends | `MATCH (r:User {name:"Rohit"})-[:friend]->(f)-[:friend]->(fof) RETURN fof.name` |
| Friends-of-friends at Google who know React | `MATCH (r:User {name:"Rohit"})-[:friend]->(f)-[:friend]->(fof)-[:works_at]->(c:Company {name:"Google"}), (fof)-[:knows]->(s:Skill {name:"React"}) RETURN fof.name` |

Compare the last one to the **7-JOIN SQL** from section 9.1 — same result, dramatically more readable, and it executes via pointer-jumping instead of table scans.

**Creating data:**
```cypher
CREATE (r:Account {name: "RohitKumar"})
CREATE (s:Merchant {name: "ShellCompany LLC"})
MATCH (r:Account {name:"RohitKumar"}), (s:Merchant {name:"ShellCompany LLC"})
CREATE (r)-[:TRANSACTED_WITH {amount: 5000}]->(s)
```

---

## 11. When to Use Graph DB vs Relational DB

| Aspect | Relational DB | Graph DB |
|---|---|---|
| Relationships | Computed via JOINs at query time | Stored as physical pointers, ready to traverse |
| Deep/variable-depth traversals | Slow — cost multiplies with depth | Fast — constant cost per hop |
| Simple property lookup | Index (B-tree) — fast | Index (B-tree) — equally fast |
| Aggregations (SUM/COUNT/GROUP BY) | Optimized | Not optimized |
| Schema | Strict | Flexible |
| Query language | SQL | Cypher |

**✅ Use a Graph DB when:**
- Relationships *are* the query, not a side detail
- Traversal depth is unknown/variable ("how far can this connection go?")
- You're asking "how are things connected?" — social networks, recommendations, fraud detection, knowledge graphs, GraphRAG

**❌ Stick with Relational DB when:**
- Simple CRUD, few/no relationships
- Heavy aggregations over large tabular data
- Shallow, fixed, predictable relationships
- Strict schema + full ACID transaction requirements dominate

---

## 12. Cheat Sheet / Summary

```
┌──────────────────────────────────────────────────────────────────┐
│  NORMAL RAG        →  "which chunks look like my question?"       │
│  AGENTIC RAG       →  chains vector searches, still similarity-   │
│                        based at every hop → errors compound        │
│  GRAPHRAG          →  "which chunks are CONNECTED to my question?"│
│                        traversal, not similarity                   │
└──────────────────────────────────────────────────────────────────┘

GraphRAG Ingestion:
  chunks → entity extraction → entity resolution → relationship
  extraction → graph construction → (community detection + summaries)

GraphRAG Query:
  query → find start entity → traverse graph (apply filters per hop)
        → generate sub-queries per relationship → filtered vector
        search for supporting text → LLM synthesizes final answer

Graph DB internals:
  Node = fixed-size record + pointer to first relationship + pointer
  to first property
  Relationship = fixed-size record, TWO linked lists (outgoing chain
  for source node, incoming chain for target node) + own properties
  Property = separate variable-length linked list (keeps node/rel
  records fixed-size for O(1) disk offset lookups)

Golden rule:
  Graph DB wins on multi-hop TRAVERSAL.
  Relational DB wins (or ties) on flat FILTERS and AGGREGATIONS.
```

---

### 📌 Recap of all 5 worked examples

| # | Domain | The "hidden" multi-hop chain |
|---|---|---|
| 1 | E-commerce | top sellers → brands → products → customers → *other* products those customers bought |
| 2 | Movies/Oscars | Oscar film → director → their *other* films → genre filter → actors |
| 3 | Crime | victim's locations → who else was there → their relationships → prior criminal records |
| 4 | Corporate | Project team → marketing collaboration filter → campaign → budget-exceeded filter |
| 5 | Fraud | account → shared device → other account → shared merchant → merchant's fraud history |

Every single one follows the same shape: **a chain normal similarity search cannot see, but a graph traversal walks in a handful of deterministic hops.**
