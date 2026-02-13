import { Injectable, Logger } from '@nestjs/common';

// ============================================================
// INTERFACES
// ============================================================

export interface CollegeInsight {
  name: string;
  rank: number;
  section: string;
  sectionTier: SectionTier;
  context: string;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  sourcesCited: string[];       // Changed: array of sources, not single string
  signalScore: number;
  responseRichnessScore: number; // NEW: how much AI "knows" about this college
}

export interface ParsedResponse {
  collegesFound: CollegeInsight[];
  totalColleges: number;
  sourcesCited: string[];
  rankingFactors: string[];
}

export type SectionTier =
  | 'best_overall'
  | 'strong_private'
  | 'universities_with_engineering'
  | 'other_options'
  | 'not_mentioned'
  | 'unknown';

// Internal: raw extracted college block before matching
interface RawCollegeBlock {
  name: string;
  position: number;       // order of appearance (1-based)
  lineIndex: number;      // line number in response
  context: string;        // full text block for this college
  section: string;        // raw section header text
  sectionTier: SectionTier;
}

// ============================================================
// PARSER SERVICE
// ============================================================

@Injectable()
export class ResponseParserService {
  private readonly logger = new Logger(ResponseParserService.name);

  // -----------------------------------------------------------
  // Section tier keywords → enum mapping
  // -----------------------------------------------------------
  private readonly SECTION_TIER_MAP: Array<{
    keywords: string[];
    tier: SectionTier;
  }> = [
    {
      keywords: [
        'best overall',
        'top overall',
        'top-tier',
        'top tier',
        'well-known',
        'well known',
        'ranked',
        'premier',
        'best engineering',
        'top engineering',
        'top colleges',
        'best colleges',
      ],
      tier: 'best_overall',
    },
    {
      keywords: [
        'strong private',
        'good private',
        'good placements',
        'good roi',
        'decent',
        'notable private',
        'popular',
        'reputed private',
      ],
      tier: 'strong_private',
    },
    {
      keywords: [
        'universities with',
        'university',
        'multi-disciplinary',
        'multi disciplinary',
        'engineering programs',
        'engineering programme',
      ],
      tier: 'universities_with_engineering',
    },
    {
      keywords: [
        'other',
        'notable option',
        'additional',
        'emerging',
        'budget',
        'affordable option',
        'worth considering',
        'honorable mention',
      ],
      tier: 'other_options',
    },
  ];

  // -----------------------------------------------------------
  // College line detection patterns
  // Handles: numbered lists, bullet points, emojis, dashes
  // -----------------------------------------------------------
  private readonly COLLEGE_LINE_PATTERNS: RegExp[] = [
    // "1. **College Name**: description" or "1. **College Name** – description"
    /^(\d+)\.\s+\*{0,2}([^*:–\-\n]+?)\*{0,2}\s*[:–\-]\s*/,

    // "* **College Name**: description" or "- **College Name** – description"
    /^[*\-•]\s+\*{0,2}([^*:–\-\n]+?)\*{0,2}\s*[:–\-]\s*/,

    // "1. College Name – description" (no bold)
    /^(\d+)\.\s+([A-Z][^:–\-\n]{5,60}?)\s*[:–\-]\s*/,

    // "* College Name – description" (no bold, bullet)
    /^[*\-•]\s+([A-Z][^:–\-\n]{5,60}?)\s*[:–\-]\s*/,
  ];

  // -----------------------------------------------------------
  // Source detection patterns (parenthetical citations)
  // -----------------------------------------------------------
  private readonly KNOWN_SOURCES: Record<string, string> = {
    'shiksha': 'Shiksha',
    'collegedunia': 'CollegeDunia',
    'careers360': 'Careers360',
    'nirf': 'NIRF',
    'naac': 'NAAC',
    'gn group': 'GN Group',
    'getmyuni': 'GetMyUni',
    'india today': 'India Today',
    'outlook': 'Outlook',
    'the week': 'The Week',
    'nba': 'NBA',
    'aicte': 'AICTE',
    'ugc': 'UGC',
  };

  // ============================================================
  // MAIN PARSE METHOD
  // ============================================================

  parseResponse(
    response: string,
    clientCollegeName: string,
    competitorNames: string[],
  ): ParsedResponse {
    this.logger.log('='.repeat(70));
    this.logger.log('🔍 PARSING AI RESPONSE');
    this.logger.log(`🎓 Client: ${clientCollegeName}`);
    this.logger.log(`🎯 Competitors: ${competitorNames.join(', ')}`);
    this.logger.log('='.repeat(70));

    const allKnownColleges = [clientCollegeName, ...competitorNames];

    // STEP 1: Detect all section headers and their line positions
    const sections = this.detectSections(response);
    this.logger.log(`📂 Detected ${sections.length} sections`);

    // STEP 2: Extract all college blocks from the response
    const rawBlocks = this.extractCollegeBlocks(response, sections);
    this.logger.log(`📦 Extracted ${rawBlocks.length} college blocks`);

    // STEP 3: Match each block to known colleges and build insights
    const collegesFound: CollegeInsight[] = [];

    for (const block of rawBlocks) {
      const matchedName = this.findBestMatch(block.name, allKnownColleges);

      if (matchedName) {
        this.logger.log(
          `  ✅ MATCHED: "${block.name}" → "${matchedName}" (position #${block.position})`,
        );

        const insight = this.buildInsight(block, matchedName);
        collegesFound.push(insight);

        this.logger.log(
          `     📊 Signal: ${insight.signalScore} | Richness: ${insight.responseRichnessScore} | Tier: ${insight.sectionTier}`,
        );
      } else {
        this.logger.log(`  ⬜ UNMATCHED: "${block.name}" (#${block.position})`);
      }
    }

    this.logger.log('='.repeat(70));
    this.logger.log(
      `✅ PARSE COMPLETE: ${collegesFound.length} matched out of ${rawBlocks.length} total`,
    );
    this.logger.log('='.repeat(70));

    return {
      collegesFound,
      totalColleges: rawBlocks.length,
      sourcesCited: this.extractAllSources(response),
      rankingFactors: this.extractFactors(response),
    };
  }

  // ============================================================
  // STEP 1: SECTION DETECTION
  // ============================================================

  private detectSections(
    response: string,
  ): Array<{ lineIndex: number; raw: string; tier: SectionTier }> {
    const lines = response.split('\n');
    const sections: Array<{ lineIndex: number; raw: string; tier: SectionTier }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip lines that look like college entries
      if (/^\d+\.\s+/.test(line)) continue;
      if (/^[*\-•]\s+[A-Z]/.test(line) && line.includes(':')) continue;

      // Check if this line is a section header
      const isHeader =
        // Markdown headers: ## Section Name or ### Section Name
        /^#{1,4}\s+/.test(line) ||
        // Bold-only line: **Section Name**
        /^\*\*[^*]+\*\*$/.test(line) ||
        // Emoji-prefixed header: ⭐ Best Overall or 🎓 Universities
        /^[^\w\s]\s+.{5,}/.test(line) && !line.includes(':') ||
        // ALL CAPS short line
        (/^[A-Z\s&()]{8,}$/.test(line) && line.length < 60);

      if (isHeader) {
        const cleanHeader = line
          .replace(/^#{1,4}\s+/, '')
          .replace(/\*\*/g, '')
          .replace(/^[^\w\s]+\s*/, '') // Remove leading emojis
          .trim();

        const tier = this.classifySectionTier(cleanHeader);

        sections.push({ lineIndex: i, raw: cleanHeader, tier });
        this.logger.log(`  📂 Section [line ${i}]: "${cleanHeader}" → ${tier}`);
      }
    }

    return sections;
  }

  private classifySectionTier(headerText: string): SectionTier {
    const lower = headerText.toLowerCase();

    for (const mapping of this.SECTION_TIER_MAP) {
      for (const keyword of mapping.keywords) {
        if (lower.includes(keyword)) {
          return mapping.tier;
        }
      }
    }

    return 'unknown';
  }

  // ============================================================
  // STEP 2: EXTRACT COLLEGE BLOCKS
  // ============================================================

  private extractCollegeBlocks(
    response: string,
    sections: Array<{ lineIndex: number; raw: string; tier: SectionTier }>,
  ): RawCollegeBlock[] {
    const lines = response.split('\n');
    const blocks: RawCollegeBlock[] = [];
    let globalPosition = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const collegeName = this.tryExtractCollegeName(line);

      if (collegeName) {
        globalPosition++;

        // Collect context: this line + following lines until next college or section
        let context = line;
        let j = i + 1;

        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (!nextLine) { j++; continue; }

          // Stop if next line is another college entry
          if (this.tryExtractCollegeName(nextLine)) break;

          // Stop if next line is a section header (but not a sub-point)
          if (
            /^#{1,4}\s+/.test(nextLine) ||
            /^\*\*[^*]+\*\*$/.test(nextLine)
          ) break;

          context += '\n' + nextLine;
          j++;

          // Safety: max 20 lines of context
          if (j - i > 20) break;
        }

        // Determine which section this college belongs to
        const { section, tier } = this.findSectionForLine(i, sections);

        // Check if a numbered position exists in the line
        const numberMatch = line.match(/^(\d+)\./);
        const position = numberMatch
          ? parseInt(numberMatch[1])
          : globalPosition;

        blocks.push({
          name: collegeName,
          position,
          lineIndex: i,
          context,
          section,
          sectionTier: tier,
        });
      }
    }

    return blocks;
  }

  /**
   * Try to extract a college name from a line.
   * Returns clean name or null if this line is not a college entry.
   */
  private tryExtractCollegeName(line: string): string | null {
    for (const pattern of this.COLLEGE_LINE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        // For numbered patterns, name is in group 2; for bullet patterns, group 1
        const rawName = match[2] || match[1];
        const cleaned = this.cleanCollegeName(rawName);

        // Validate: must look like a college/university name
        if (this.looksLikeCollegeName(cleaned)) {
          return cleaned;
        }
      }
    }

    return null;
  }

  /**
   * Clean extracted college name
   */
  private cleanCollegeName(raw: string): string {
    return raw
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/^[*\-•]\s*/, '')
      .replace(/^[^\w\s]+\s*/, '') // Leading emojis
      .replace(/\s*\([^)]*\)\s*$/, '') // Trailing parenthetical like (Shiksha)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Validate that a string looks like a college/university name
   */
  private looksLikeCollegeName(name: string): boolean {
    if (!name || name.length < 3 || name.length > 120) return false;

    // Must start with uppercase letter
    if (!/^[A-Z]/.test(name)) return false;

    // Should contain college-related words OR be a proper noun phrase
    const collegeWords = [
      'university', 'college', 'institute', 'institution',
      'school', 'academy', 'faculty', 'engineering',
      'technology', 'management', 'polytechnic',
    ];

    const lower = name.toLowerCase();

    // If it contains a college word, definitely valid
    if (collegeWords.some((w) => lower.includes(w))) return true;

    // If it contains common abbreviations
    if (/\b(IIT|NIT|IIIT|BIT|SRM|VIT|MIT|KIIT|LPU|BITS)\b/.test(name)) {
      return true;
    }

    // If it's a multi-word proper noun (at least 2 words starting with caps)
    const words = name.split(/\s+/);
    const capitalWords = words.filter((w) => /^[A-Z]/.test(w));
    if (capitalWords.length >= 2) return true;

    return false;
  }

  /**
   * Find which section a college line belongs to
   */
  private findSectionForLine(
    lineIndex: number,
    sections: Array<{ lineIndex: number; raw: string; tier: SectionTier }>,
  ): { section: string; tier: SectionTier } {
    // Find the closest section header ABOVE this line
    let closestSection = { section: 'General', tier: 'unknown' as SectionTier };

    for (const sec of sections) {
      if (sec.lineIndex < lineIndex) {
        closestSection = { section: sec.raw, tier: sec.tier };
      } else {
        break;
      }
    }

    return closestSection;
  }

  // ============================================================
  // STEP 3: BUILD INSIGHT FROM RAW BLOCK
  // ============================================================

  private buildInsight(
    block: RawCollegeBlock,
    matchedName: string,
  ): CollegeInsight {
    const ctx = block.context;

    // Extract all signal types
    const quantitativeSignals = this.extractQuantitativeSignals(ctx);
    const narrativeSignals = this.extractNarrativeSignals(ctx);
    const authoritySignals = this.extractAuthoritySignals(ctx);
    const weaknesses = this.extractWeaknessSignals(ctx);
    const sources = this.extractSourcesFromContext(ctx);
    const reasoning = this.extractReasoning(ctx);

    const allStrengths = [
      ...quantitativeSignals,
      ...authoritySignals,
      ...narrativeSignals,
    ];

    const signalScore = this.calculateSignalScore(
      quantitativeSignals,
      narrativeSignals,
      authoritySignals,
    );

    const responseRichnessScore = this.calculateRichnessScore(ctx, quantitativeSignals);

    return {
      name: matchedName,
      rank: block.position,
      section: block.section,
      sectionTier: block.sectionTier,
      context: ctx.substring(0, 1000),
      reasoning: reasoning.substring(0, 500),
      strengths: allStrengths.slice(0, 15),
      weaknesses: weaknesses.slice(0, 5),
      sourcesCited: sources,
      signalScore,
      responseRichnessScore,
    };
  }

  // ============================================================
  // SIGNAL EXTRACTION
  // ============================================================

  /**
   * Quantitative signals: specific numbers and data points
   */
  private extractQuantitativeSignals(text: string): string[] {
    const signals: string[] = [];

    const patterns: Array<{
      regex: RegExp;
      extract: (m: RegExpMatchArray) => string;
    }> = [
      // Placement rate: "85% placement" or "placement rate of 85%"
      {
        regex: /(?:placement[s]?\s+rate[^.]*?(\d{2,3})%|(\d{2,3})%\s+placement)/gi,
        extract: (m) => `Placement Rate: ${m[1] || m[2]}%`,
      },
      // Average package: "average package of ₹6.2 LPA" or "avg CTC 6.2 LPA"
      {
        regex: /(?:average|avg|mean)\s+(?:package|ctc|salary)[^.]*?(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lakh)/gi,
        extract: (m) => `Average Package: ₹${m[1]} ${m[2].toUpperCase()}`,
      },
      // Average package without currency: "average package of 6.2 LPA"
      {
        regex: /(?:average|avg|mean)\s+(?:package|ctc|salary)[^.]*?(\d+(?:\.\d+)?)\s*(lpa|lakhs?)/gi,
        extract: (m) => `Average Package: ₹${m[1]} ${m[2].toUpperCase()}`,
      },
      // Highest package
      {
        regex: /(?:highest|top|max|maximum)\s+(?:package|ctc|salary)[^.]*?(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lakh|cr|crore)/gi,
        extract: (m) => `Highest Package: ₹${m[1]} ${m[2].toUpperCase()}`,
      },
      // NIRF rank: "NIRF rank #45" or "ranked 45 in NIRF" or "NIRF ranking: 45"
      {
        regex: /nirf[^.]*?(?:rank|#|ranking)[^.]*?#?(\d{1,4})/gi,
        extract: (m) => `NIRF Rank: #${m[1]}`,
      },
      // Reverse NIRF: "ranked #45 by NIRF"
      {
        regex: /rank(?:ed|ing)?\s*#?(\d{1,4})[^.]*?nirf/gi,
        extract: (m) => `NIRF Rank: #${m[1]}`,
      },
      // Companies recruiting: "200+ companies" or "recruited by 150 companies"
      {
        regex: /(\d{2,4})\+?\s*(?:companies|recruiters|corporates)/gi,
        extract: (m) => `${m[1]}+ Recruiting Companies`,
      },
      // Fee: "fee of ₹5.5 lakhs" or "fees: 3.5L per year"
      {
        regex: /(?:fee|fees|tuition)[^.]*?(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lakh|l|k)/gi,
        extract: (m) => `Fee: ₹${m[1]} ${m[2].toUpperCase()}`,
      },
      // Student intake: "intake of 500 students"
      {
        regex: /(?:intake|seats?)[^.]*?(\d{2,5})\s*(?:students?|seats?)?/gi,
        extract: (m) => `Student Intake: ${m[1]}`,
      },
    ];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const signal = pattern.extract(match);
        if (!signals.includes(signal)) {
          signals.push(signal);
        }
      }
    }

    return signals;
  }

  /**
   * Narrative signals: quality-indicating adjectives
   */
  private extractNarrativeSignals(text: string): string[] {
    const signals: string[] = [];
    const lower = text.toLowerCase();

    const narrativeWords: Array<{ word: string; label: string }> = [
      { word: 'strong', label: 'Strong reputation mentioned' },
      { word: 'excellent', label: 'Excellent quality mentioned' },
      { word: 'leading', label: 'Leading institution mentioned' },
      { word: 'renowned', label: 'Renowned status mentioned' },
      { word: 'well-known', label: 'Well-known reputation mentioned' },
      { word: 'well known', label: 'Well-known reputation mentioned' },
      { word: 'prestigious', label: 'Prestigious status mentioned' },
      { word: 'reputed', label: 'Reputed institution mentioned' },
      { word: 'reputable', label: 'Reputable institution mentioned' },
      { word: 'well-established', label: 'Well-established presence mentioned' },
      { word: 'well established', label: 'Well-established presence mentioned' },
      { word: 'state-of-the-art', label: 'State-of-the-art facilities mentioned' },
      { word: 'modern', label: 'Modern infrastructure mentioned' },
      { word: 'growing reputation', label: 'Growing reputation mentioned' },
      { word: 'emerging', label: 'Emerging institution mentioned' },
      { word: 'good track record', label: 'Good track record mentioned' },
      { word: 'decent', label: 'Decent quality mentioned' },
    ];

    for (const item of narrativeWords) {
      if (lower.includes(item.word) && !signals.includes(item.label)) {
        signals.push(item.label);
      }
    }

    return signals;
  }

  /**
   * Authority signals: accreditations, official recognitions
   */
  private extractAuthoritySignals(text: string): string[] {
    const signals: string[] = [];

    // NOTE: Each regex is created fresh inside the loop to avoid
    // the lastIndex stale state bug with RegExp.test() and /g flag
    const patterns: Array<{ pattern: string; flags: string; label: string }> = [
      { pattern: 'naac\\s+[\'"]?[a-z]\\+{0,2}[\'"]?', flags: 'i', label: 'NAAC accredited' },
      { pattern: 'naac\\s+(?:grade|accredit)', flags: 'i', label: 'NAAC accredited' },
      { pattern: '\\bnaac\\b', flags: 'i', label: 'NAAC mentioned' },
      { pattern: 'nba\\s+accredit', flags: 'i', label: 'NBA accredited' },
      { pattern: 'aicte\\s+approv', flags: 'i', label: 'AICTE approved' },
      { pattern: 'ugc\\s+recogni', flags: 'i', label: 'UGC recognized' },
      { pattern: 'accredit(?:ed|ation)', flags: 'i', label: 'Accreditation mentioned' },
      { pattern: 'industry\\s+(?:connections?|collaborations?|partnerships?|tie-?ups?)', flags: 'i', label: 'Industry partnerships mentioned' },
      { pattern: '\\bresearch\\b', flags: 'i', label: 'Research focus mentioned' },
      { pattern: 'tie-?ups?\\s+with', flags: 'i', label: 'Institutional tie-ups mentioned' },
      { pattern: 'nirf[\\s-]+rank', flags: 'i', label: 'NIRF ranked' },
      { pattern: 'autonomous', flags: 'i', label: 'Autonomous status mentioned' },
    ];

    for (const p of patterns) {
      const regex = new RegExp(p.pattern, p.flags);
      if (regex.test(text) && !signals.includes(p.label)) {
        signals.push(p.label);
      }
    }

    return signals;
  }

  /**
   * Weakness signals: caveats, limitations, data gaps
   */
  private extractWeaknessSignals(text: string): string[] {
    const signals: string[] = [];

    const patterns: Array<{ pattern: string; flags: string; label: string }> = [
      { pattern: '\\bhowever\\b', flags: 'i', label: 'Caveat mentioned' },
      { pattern: '\\blimited\\b', flags: 'i', label: 'Limitation noted' },
      { pattern: 'no data', flags: 'i', label: 'Data unavailable' },
      { pattern: 'not available', flags: 'i', label: 'Information unavailable' },
      { pattern: 'worth noting', flags: 'i', label: 'Note of caution' },
      { pattern: 'important to', flags: 'i', label: 'Important consideration' },
      { pattern: 'recommend.*research', flags: 'i', label: 'Additional research recommended' },
      { pattern: 'verify', flags: 'i', label: 'Verification suggested' },
      { pattern: 'check.*official', flags: 'i', label: 'Official verification suggested' },
      { pattern: 'not.*rank', flags: 'i', label: 'Not ranked' },
    ];

    for (const p of patterns) {
      const regex = new RegExp(p.pattern, p.flags);
      if (regex.test(text) && !signals.includes(p.label)) {
        signals.push(p.label);
      }
    }

    return signals;
  }

  // ============================================================
  // SOURCE EXTRACTION
  // ============================================================

  /**
   * Extract parenthetical source citations from a college's context.
   * Matches: (Shiksha), (NIRF), (CollegeDunia), (GN Group), etc.
   */
  // private extractSourcesFromContext(text: string): string[] {
  //   const sources: string[] = [];

  //   // Pattern 1: Parenthetical citations like (Shiksha), (NIRF 2024)
  //   const parenMatches = text.matchAll(/\(([^)]{2,30})\)/g);
  //   console.log("parenMatches", [...parenMatches]);
  //   for (const match of parenMatches) {
  //     const inner = match[1].trim().toLowerCase();

  //     for (const [key, displayName] of Object.entries(this.KNOWN_SOURCES)) {
  //       if (inner.includes(key) && !sources.includes(displayName)) {
  //         sources.push(displayName);
  //       }
  //     }
  //   }

  //   // Pattern 2: Inline mentions like "according to Shiksha" or "as per NIRF"
  //   const lower = text.toLowerCase();
  //   for (const [key, displayName] of Object.entries(this.KNOWN_SOURCES)) {
  //     if (lower.includes(key) && !sources.includes(displayName)) {
  //       sources.push(displayName);
  //     }
  //   }

  //   return sources;
  // }


  private extractSourcesFromContext(text: string): string[] {
  const sources: string[] = [];

  // ✅ STEP 1: Extract all URLs
  const urlMatches = text.match(/https?:\/\/[^\s)]+/g);

  console.log("urlMatches", urlMatches);
    
  if (urlMatches) {
    for (const rawUrl of urlMatches) {
      try {
        const url = new URL(rawUrl);
        const hostname = url.hostname.replace('www.', '').toLowerCase();

        for (const [key, displayName] of Object.entries(this.KNOWN_SOURCES)) {
          if (hostname.includes(key) && !sources.includes(displayName)) {
            sources.push(displayName);
          }
        }

      } catch (err) {
        console.warn('Invalid URL detected:', rawUrl);
      }
    }
  }

  console.log("sources for now", sources);

  // ✅ STEP 2: Fallback to parenthetical short citations (e.g., (Shiksha), (NIRF 2024))
  const parenMatches = text.matchAll(/\(([^)]{2,50})\)/g);

  for (const match of parenMatches) {
    const inner = match[1].trim().toLowerCase();

    // Skip if it looks like markdown link text
    if (inner.includes('http')) continue;

    for (const [key, displayName] of Object.entries(this.KNOWN_SOURCES)) {
      if (inner.includes(key) && !sources.includes(displayName)) {
        sources.push(displayName);
      }
    }
  }

  // ✅ STEP 3: Inline mentions (last fallback)
  const lower = text.toLowerCase();
  for (const [key, displayName] of Object.entries(this.KNOWN_SOURCES)) {
    if (lower.includes(key) && !sources.includes(displayName)) {
      sources.push(displayName);
    }
  }

  console.log("return sources", sources);

  return sources;
}

  /**
   * Extract all sources mentioned anywhere in the full response
   */
  private extractAllSources(response: string): string[] {
    const sources: string[] = [];
    const lower = response.toLowerCase();

    for (const [key, displayName] of Object.entries(this.KNOWN_SOURCES)) {
      if (lower.includes(key) && !sources.includes(displayName)) {
        sources.push(displayName);
      }
    }

    return sources;
  }

  // ============================================================
  // SCORING
  // ============================================================

  /**
   * Signal score: weighted sum of extracted signals
   */
  private calculateSignalScore(
    quantitative: string[],
    narrative: string[],
    authority: string[],
  ): number {
    return (
      quantitative.length * 3 +
      authority.length * 2 +
      narrative.length * 1
    );
  }

  /**
   * Response richness score (0-10): how much AI actually "knows"
   *
   * 0-2: AI knows almost nothing (generic description)
   * 3-5: AI knows some facts (accreditation, general reputation)
   * 6-8: AI knows specific data (placement %, packages)
   * 9-10: AI has comprehensive data (all key metrics)
   */
  private calculateRichnessScore(
    context: string,
    quantitativeSignals: string[],
  ): number {
    let score = 0;

    // Length-based: longer description = more data
    const wordCount = context.split(/\s+/).length;
    if (wordCount > 15) score += 1;
    if (wordCount > 30) score += 1;
    if (wordCount > 60) score += 1;

    // Has specific quantitative data
    score += Math.min(quantitativeSignals.length, 4); // Max 4 points for data

    // Has specific data types
    const lower = context.toLowerCase();
    if (/\d+%/.test(context)) score += 1;                          // Any percentage
    if (/₹|rs\.?|inr|lpa|lakhs?/i.test(context)) score += 1;     // Any monetary value
    if (/nirf|naac|nba|aicte/i.test(context)) score += 1;         // Any authority mention

    // Check for generic-only description (penalty)
    const genericPhrases = [
      'offers btech',
      'offers b.tech',
      'engineering college with',
      'private college',
      'multi-disciplinary',
    ];
    const isGenericOnly =
      genericPhrases.some((p) => lower.includes(p)) &&
      quantitativeSignals.length === 0;

    if (isGenericOnly) {
      score = Math.min(score, 2); // Cap at 2 for generic-only
    }

    return Math.min(score, 10); // Cap at 10
  }

  // ============================================================
  // REASONING EXTRACTION
  // ============================================================

  private extractReasoning(text: string): string {
    // Get the first meaningful sentence (over 20 chars, not a header)
    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.replace(/^[\s*\-•#]+/, '').trim())
      .filter((s) => s.length > 20 && !/^\d+$/.test(s));

    return sentences.length > 0 ? sentences[0] : text.substring(0, 200);
  }

  // ============================================================
  // RANKING FACTORS
  // ============================================================

  private extractFactors(response: string): string[] {
    const factors = [
      'placement',
      'package',
      'infrastructure',
      'faculty',
      'fees',
      'campus',
      'hostel',
      'research',
      'accreditation',
      'ranking',
      'scholarship',
      'internship',
      'industry',
    ];
    const found: string[] = [];
    const lower = response.toLowerCase();

    for (const factor of factors) {
      if (lower.includes(factor)) found.push(factor);
    }

    return found;
  }

  // ============================================================
  // COLLEGE NAME MATCHING
  // ============================================================

  /**
   * Find the best matching known college for an AI-given name.
   *
   * Matching strategy (in order of priority):
   * 1. Exact match (after cleaning)
   * 2. Substring containment
   * 3. Acronym matching (DPGITM → DPG Institute...)
   * 4. Word overlap (≥60% of significant words match)
   */
  findBestMatch(aiName: string, knownColleges: string[]): string | null {
    const cleanAi = this.cleanName(aiName);

    if (!cleanAi || cleanAi.length < 3) return null;

    // Pass 1: Exact match
    for (const known of knownColleges) {
      if (this.cleanName(known) === cleanAi) return known;
    }

    // Pass 2: Substring containment
    for (const known of knownColleges) {
      const cleanKnown = this.cleanName(known);
      if (cleanKnown.includes(cleanAi) || cleanAi.includes(cleanKnown)) {
        return known;
      }
    }

    // Pass 3: Acronym matching
    for (const known of knownColleges) {
      const knownAcronym = this.extractAcronym(known);
      const aiAcronym = this.extractAcronym(aiName);

      if (
        knownAcronym &&
        aiAcronym &&
        knownAcronym.length >= 2 &&
        (knownAcronym === aiAcronym ||
          cleanAi.includes(knownAcronym.toLowerCase()) ||
          this.cleanName(known).includes(aiAcronym.toLowerCase()))
      ) {
        return known;
      }
    }

    // Pass 4: Word overlap
    const aiWords = cleanAi
      .split(/\s+/)
      .filter((w) => w.length > 2 && !this.isStopWord(w));

    for (const known of knownColleges) {
      const knownWords = this.cleanName(known)
        .split(/\s+/)
        .filter((w) => w.length > 2 && !this.isStopWord(w));

      if (aiWords.length === 0 || knownWords.length === 0) continue;

      const matchedWords = aiWords.filter((aiWord) =>
        knownWords.some(
          (knownWord) =>
            aiWord === knownWord ||
            aiWord.includes(knownWord) ||
            knownWord.includes(aiWord),
        ),
      );

      const matchRatio =
        matchedWords.length / Math.max(aiWords.length, knownWords.length);

      if (matchRatio >= 0.5) return known;
    }

    return null;
  }

  private cleanName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractAcronym(name: string): string {
    // Extract uppercase letters that form acronyms: "BML Munjal" → "BML"
    const acronymMatch = name.match(/\b[A-Z]{2,}\b/g);
    if (acronymMatch) return acronymMatch[0];

    // Build acronym from first letters: "Indian Institute of Technology" → "IIT"
    const words = name.split(/\s+/).filter((w) => /^[A-Z]/.test(w) && w.length > 1);
    if (words.length >= 2) {
      return words.map((w) => w[0]).join('');
    }

    return '';
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'of', 'and', 'for', 'in', 'at', 'to',
      'college', 'university', 'institute', 'institution',
      'engineering', 'technology', 'management', 'faculty',
    ]);
    return stopWords.has(word);
  }
}