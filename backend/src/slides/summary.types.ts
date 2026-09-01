/**
 * Structured summary produced by the AI for a slide session.
 *
 * Design intent (per product spec):
 * - Definitions and technical content stay in ENGLISH.
 * - Important terms are annotated with a Vietnamese gloss (`glossVi`).
 * - High-level guidance/overview may be in Vietnamese so the student can
 *   navigate quickly, while the substance stays in English.
 */
export interface KeyTerm {
  term: string; // English term as it appears on the slides
  definitionEn: string; // definition kept in English
  glossVi: string; // short Vietnamese annotation / chú thích
}

export interface SummarySection {
  heading: string; // section / topic heading (English)
  headingVi?: string; // optional Vietnamese heading gloss
  points: string[]; // concise English bullet points
}

export interface SlideSummary {
  title: string; // English title of the material
  overviewVi: string; // 2-4 sentence overview in Vietnamese
  overviewEn: string; // 2-4 sentence overview in English
  sections: SummarySection[];
  keyTerms: KeyTerm[];
  formulas: string[]; // formulas / notation, verbatim where possible
  examTips: string[]; // likely exam focus points (Vietnamese guidance ok)
}
