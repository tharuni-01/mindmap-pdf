import type { MindMapResult } from "@/types/mindmap";

// Hardcoded sample used by the landing-page "Try with sample data" button
// and as a fallback when ANTHROPIC_API_KEY is not configured. Delete this
// file once a real LLM backend is wired up.
export const SAMPLE_MINDMAP: MindMapResult = {
  summary:
    "A Series A term sheet sets the headline economic and governance terms for an early-stage venture financing. It is non-binding except for confidentiality and exclusivity, but in practice it locks in the deal shape that downstream definitive documents implement.",
  meta: {
    pages: 0,
    chars: 0,
    chunks: 0,
    model: "demo",
  },
  mindmap: {
    title: "Anatomy of a Series A Term Sheet",
    children: [
      {
        title: "Economics",
        children: [
          {
            title: "Valuation",
            children: [
              { title: "Pre-money valuation" },
              { title: "Post-money valuation" },
              { title: "Option pool top-up (pre- or post-)" },
            ],
          },
          {
            title: "Investment amount",
            children: [
              { title: "Lead investor commitment" },
              { title: "Co-investor allocations" },
              { title: "Tranches and milestones" },
            ],
          },
          {
            title: "Liquidation preference",
            children: [
              { title: "1x non-participating (standard)" },
              { title: "Participating preferred" },
              { title: "Caps on participation" },
            ],
          },
          {
            title: "Anti-dilution",
            children: [
              { title: "Broad-based weighted average" },
              { title: "Narrow-based weighted average" },
              { title: "Full ratchet" },
            ],
          },
        ],
      },
      {
        title: "Governance",
        children: [
          {
            title: "Board composition",
            children: [
              { title: "Common directors" },
              { title: "Preferred directors" },
              { title: "Independent director" },
            ],
          },
          {
            title: "Protective provisions",
            children: [
              { title: "Sale of company" },
              { title: "Amend charter / bylaws" },
              { title: "Issue senior securities" },
              { title: "Increase option pool" },
            ],
          },
          {
            title: "Information rights",
            children: [
              { title: "Annual / quarterly financials" },
              { title: "Budget and operating plan" },
              { title: "Inspection rights" },
            ],
          },
        ],
      },
      {
        title: "Investor rights",
        children: [
          {
            title: "Pro-rata rights",
            children: [
              { title: "Major investor threshold" },
              { title: "Super pro-rata" },
            ],
          },
          { title: "Right of first refusal" },
          { title: "Co-sale / tag-along rights" },
          { title: "Drag-along rights" },
          {
            title: "Registration rights",
            children: [
              { title: "Demand registration" },
              { title: "Piggyback registration" },
              { title: "S-3 registration" },
            ],
          },
        ],
      },
      {
        title: "Founder & employee terms",
        children: [
          {
            title: "Vesting",
            children: [
              { title: "4-year schedule" },
              { title: "1-year cliff" },
              { title: "Acceleration on termination" },
            ],
          },
          {
            title: "Acceleration",
            children: [
              { title: "Single-trigger" },
              { title: "Double-trigger" },
            ],
          },
          { title: "Founder restricted stock" },
          { title: "Confidentiality & IP assignment" },
          { title: "Non-compete and non-solicit" },
        ],
      },
      {
        title: "Closing mechanics",
        children: [
          {
            title: "Conditions to closing",
            children: [
              { title: "Definitive documents executed" },
              { title: "Diligence complete" },
              { title: "Board and stockholder approvals" },
            ],
          },
          {
            title: "Exclusivity / no-shop",
            children: [
              { title: "30-60 day window" },
              { title: "Notice obligations" },
            ],
          },
          { title: "Confidentiality" },
          { title: "Expense reimbursement cap" },
          { title: "Counsel and closing costs" },
        ],
      },
    ],
  },
};
