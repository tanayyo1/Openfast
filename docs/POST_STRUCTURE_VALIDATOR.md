# Post Structure Validator (RED-63)

Ensures drafted posts follow the **Headline → Value → Product** structure that converts on Reddit. Based on Diego (17K MRR, 1M Reddit reach): posts that mention the product too early get ignored or downvoted.

## Winning structure

1. **Catchy headline** — No product or link. Outcome, tip, or story hook.
2. **Value first** — Case study, insight, or tips (real content before any promo).
3. **Product/link later** — Mention or link naturally after 50%+ of the post.

## Good vs bad examples

### Good

- **Headline:** "3 things that 10x'd our conversion rate"
- **Body:** Several sentences of real value (what you did, what worked, numbers or tips). Then: "We use [Tool] for this—link below if you want to try it."
- **Result:** Headline has no product; value dominates; link is at the end.

### Bad

- **Headline:** "Check out our new [Product]!"
- **Body:** Link in the first line; little or no value before the CTA.
- **Result:** Product in headline and link too early → often downvoted or ignored.

## How it works

- **Headline:** Checked for product/link and length (roughly 4–15 words for “catchy”).
- **Value section:** Words before first product mention; we expect ≥40% value before product.
- **Product position:** First product mention should be after 50% of the post (warning if before 30%).
- **Link placement:** Link in the last 30% is “natural”; earlier is “salesy.”

## API

- **Validate a draft:** `POST /api/drafts/:id/validate-structure`  
  Optional body: `{ title?, body?, subredditStrict?, productCategory? }`  
  Returns full structure result (grade, warnings, rewrite suggestions, A/B ideas).

- **Get draft with structure:** `GET /api/drafts/:id?includeStructure=1`  
  Returns draft plus computed `structure` (same shape as validate-structure).

- **Scheduling:** `POST /api/scheduled-posts`  
  Response includes `structure: { grade, score, warnings, rewriteSuggestions }` for the scheduled draft so the UI can warn if needed.

### Sample request/response

**GET /api/drafts/:id?includeStructure=1**

Response (200):

```json
{
  "draft": {
    "id": "...",
    "title": "3 things that 10x'd our conversion rate",
    "body": "We tried ten different approaches...",
    "status": "DRAFT",
    "riskScore": 12,
    "structureValidation": null
  },
  "structure": {
    "grade": "A",
    "score": 90,
    "headlineAnalysis": {
      "isCatchy": true,
      "productInHeadline": false,
      "feedback": "..."
    },
    "valueSection": {
      "percentValueBeforeProduct": 85,
      "hasSubstantiveValue": true,
      "feedback": "..."
    },
    "productMention": {
      "percentThroughPost": 88,
      "tooEarly": false,
      "feedback": "..."
    },
    "linkPlacement": { "isNatural": true, "feedback": "..." },
    "warnings": [],
    "rewriteSuggestions": [],
    "abTestSuggestions": [
      { "angle": "Question hook", "exampleHeadline": "..." }
    ],
    "goodBadExamples": {
      "good": "Good: \"3 things...\" → ...",
      "bad": "Bad: \"Check out...\" → ..."
    }
  }
}
```

**Good structure payload** (from code: `GOOD_BAD_STRUCTURE_EXAMPLES.good`): title and body that yield high score, no error-level warnings. **Bad structure payload** (`GOOD_BAD_STRUCTURE_EXAMPLES.bad`): product in headline, link early → grade F and rewrite suggestions.

## Integration with RED-40

When the content worker generates draft variants (RED-40), it runs the structure validator on the primary variant and stores `structureValidation` on the draft (grade, score, warnings, rewrite suggestions). GET draft returns `structureValidation` when present.

## UI

The draft editor shows a **Post structure (conversion)** panel that updates as the user edits title/body: grade (A–F), score, warnings, rewrite suggestions, A/B headline ideas, and strict-subreddit tips. Good/bad structure examples are shown in the panel.
