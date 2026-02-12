import { Injectable, Logger } from '@nestjs/common';

export interface CollegeInsight {
  name: string;
  rank: number;
  section: string;
  context: string;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  sourceCited: string;
  signalScore?: number; // NEW: Computed trust score
}

export interface ParsedResponse {
  collegesFound: CollegeInsight[];
  totalColleges: number;
  sourcesCited: string[];
  rankingFactors: string[];
}

@Injectable()
export class ResponseParserService {
  private readonly logger = new Logger(ResponseParserService.name);

  parseResponse(
    response: string,
    clientCollegeName: string,
    competitorNames: string[],
  ): ParsedResponse {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 PARSING AI RESPONSE');
    console.log('='.repeat(80));
    console.log('🎓 YOUR COLLEGE:', clientCollegeName);
    console.log('🎯 COMPETITORS:', competitorNames.join(', '));
    console.log('='.repeat(80) + '\n');

    const allKnownColleges = [clientCollegeName, ...competitorNames];
    const collegesFound: CollegeInsight[] = [];

    // Split response into lines
    const lines = response.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Match numbered items: "1. **College Name**:" or "1. College Name:"
      const numberMatch = line.match(/^(\d+)\.\s+\*?\*?(.+?)(?:\*\*)?:/);
      
      if (numberMatch) {
        const rank = parseInt(numberMatch[1]);
        const collegeName = numberMatch[2]
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .trim();
        
        console.log(`\n📍 Found #${rank}: "${collegeName}"`);
        
        // Collect full context for this college
        let context = line;
        let j = i + 1;
        
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (nextLine.match(/^\d+\.\s+/)) break;
          context += '\n' + nextLine;
          j++;
          if (j - i > 15) break;
        }
        
        console.log(`📄 Context length: ${context.length} chars`);
        
        // Match to known colleges
        const matchedCollege = this.findBestMatch(collegeName, allKnownColleges);
        
        if (matchedCollege) {
          console.log(`✅ MATCHED: "${collegeName}" → "${matchedCollege}"`);
          
          // Extract deterministic signals (NO LLM hallucination)
          const quantitativeSignals = this.extractQuantitativeSignals(context);
          const narrativeSignals = this.extractNarrativeSignals(context);
          const authoritySignals = this.extractAuthoritySignals(context);
          
          const allSignals = [
            ...quantitativeSignals,
            ...narrativeSignals,
            ...authoritySignals,
          ];
          
          // Extract weaknesses (gaps in data)
          const weaknesses = this.extractWeaknessSignals(context);
          
          // Extract reasoning (first meaningful sentence)
          const reasoning = this.extractReasoning(context);
          
          // Find cited source
          const source = this.findSource(context);
          
          // Determine section
          const section = this.findSection(response, i);
          
          // Calculate signal score
          const signalScore = this.calculateSignalScore(
            quantitativeSignals,
            narrativeSignals,
            authoritySignals,
          );
          
          console.log(`   📊 Signals extracted:`);
          console.log(`      🔢 Quantitative: ${quantitativeSignals.length}`);
          console.log(`      📝 Narrative: ${narrativeSignals.length}`);
          console.log(`      ⭐ Authority: ${authoritySignals.length}`);
          console.log(`      🏆 Signal Score: ${signalScore}`);
          
          collegesFound.push({
            name: matchedCollege,
            rank,
            section,
            context: context.substring(0, 1000),
            reasoning: reasoning.substring(0, 500),
            strengths: allSignals.slice(0, 10), // Store all signals
            weaknesses: weaknesses.slice(0, 3),
            sourceCited: source,
            signalScore,
          });
        } else {
          console.log(`❌ NOT MATCHED: "${collegeName}"`);
        }
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ PARSING COMPLETE: ${collegesFound.length} colleges`);
    console.log(`${'='.repeat(80)}\n`);

    return {
      collegesFound,
      totalColleges: collegesFound.length,
      sourcesCited: this.extractAllSources(response),
      rankingFactors: this.extractFactors(response),
    };
  }

  /**
   * Extract quantitative signals (placement %, packages, rankings)
   */
  private extractQuantitativeSignals(text: string): string[] {
    const signals: string[] = [];
    
    const patterns = [
      { 
        regex: /placement[s]?\s+rate[^.]*?(\d+)%/gi, 
        label: 'Placement Rate',
        extract: (match: RegExpMatchArray) => `Placement Rate: ${match[1]}%`
      },
      { 
        regex: /(\d+)%\s+placement/gi, 
        label: 'Placement Rate',
        extract: (match: RegExpMatchArray) => `Placement Rate: ${match[1]}%`
      },
      { 
        regex: /average\s+package[^.]*?₹\s*(\d+(?:\.\d+)?)\s*(lpa|lakhs?)/gi, 
        label: 'Average Package',
        extract: (match: RegExpMatchArray) => `Average Package: ₹${match[1]} ${match[2]}`
      },
      { 
        regex: /highest\s+package[^.]*?₹\s*(\d+(?:\.\d+)?)\s*(lpa|lakhs?)/gi, 
        label: 'Highest Package',
        extract: (match: RegExpMatchArray) => `Highest Package: ₹${match[1]} ${match[2]}`
      },
      { 
        regex: /nirf\s+rank[^.]*?#?(\d+)/gi, 
        label: 'NIRF Rank',
        extract: (match: RegExpMatchArray) => `NIRF Rank: #${match[1]}`
      },
      { 
        regex: /(\d+)\+?\s+companies/gi, 
        label: 'Company Partners',
        extract: (match: RegExpMatchArray) => `${match[1]}+ Company Partners`
      },
    ];

    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      
      while ((match = regex.exec(text)) !== null) {
        signals.push(pattern.extract(match));
      }
    }

    return [...new Set(signals)]; // Remove duplicates
  }

  /**
   * Extract narrative signals (adjectives indicating quality)
   */
  private extractNarrativeSignals(text: string): string[] {
    const signals: string[] = [];
    
    const narrativeWords = [
      { word: 'strong', label: 'Strong reputation mentioned' },
      { word: 'excellent', label: 'Excellent quality mentioned' },
      { word: 'top', label: 'Top-tier positioning mentioned' },
      { word: 'leading', label: 'Leading institution mentioned' },
      { word: 'renowned', label: 'Renowned status mentioned' },
      { word: 'well-known', label: 'Well-known reputation mentioned' },
      { word: 'prestigious', label: 'Prestigious status mentioned' },
      { word: 'reputed', label: 'Reputed institution mentioned' },
      { word: 'reputable', label: 'Reputable institution mentioned' },
      { word: 'well-established', label: 'Well-established presence mentioned' },
      { word: 'state-of-the-art', label: 'State-of-the-art facilities mentioned' },
      { word: 'modern', label: 'Modern infrastructure mentioned' },
    ];

    const lower = text.toLowerCase();

    for (const item of narrativeWords) {
      if (lower.includes(item.word)) {
        signals.push(item.label);
      }
    }

    return [...new Set(signals)];
  }

  /**
   * Extract authority signals (accreditations, rankings, recognitions)
   */
  private extractAuthoritySignals(text: string): string[] {
    const signals: string[] = [];
    
    const authorityPatterns = [
      { regex: /naac\s+[a-z]\+?/gi, label: 'NAAC accredited' },
      { regex: /naac/gi, label: 'NAAC mentioned' },
      { regex: /nba\s+accredit/gi, label: 'NBA accredited' },
      { regex: /aicte\s+approv/gi, label: 'AICTE approved' },
      { regex: /ugc\s+recogni/gi, label: 'UGC recognized' },
      { regex: /accredit(ed|ation)/gi, label: 'Accreditation mentioned' },
      { regex: /industry\s+(connections|collaboration|partnerships)/gi, label: 'Industry partnerships mentioned' },
      { regex: /research/gi, label: 'Research focus mentioned' },
      { regex: /tie-?ups?\s+with/gi, label: 'Institutional tie-ups mentioned' },
    ];

    for (const pattern of authorityPatterns) {
      if (pattern.regex.test(text)) {
        signals.push(pattern.label);
      }
    }

    return [...new Set(signals)];
  }

  /**
   * Extract weakness signals (data gaps, limitations)
   */
  private extractWeaknessSignals(text: string): string[] {
    const signals: string[] = [];
    
    const weaknessPatterns = [
      { regex: /however/gi, label: 'Caveat mentioned' },
      { regex: /limited/gi, label: 'Limitation noted' },
      { regex: /no data/gi, label: 'Data unavailable' },
      { regex: /not available/gi, label: 'Information unavailable' },
      { regex: /worth noting/gi, label: 'Note of caution' },
      { regex: /important to/gi, label: 'Important consideration' },
      { regex: /recommend.*research/gi, label: 'Additional research recommended' },
    ];

    for (const pattern of weaknessPatterns) {
      if (pattern.regex.test(text)) {
        signals.push(pattern.label);
      }
    }

    return [...new Set(signals)];
  }

  /**
   * Calculate signal score (for ranking credibility)
   */
  private calculateSignalScore(
    quantitative: string[],
    narrative: string[],
    authority: string[],
  ): number {
    let score = 0;
    
    // Quantitative signals are most valuable
    score += quantitative.length * 3;
    
    // Authority signals are moderately valuable
    score += authority.length * 2;
    
    // Narrative signals are least valuable (subjective)
    score += narrative.length * 1;
    
    return score;
  }

  /**
   * Extract reasoning (first meaningful sentence)
   */
  private extractReasoning(text: string): string {
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);
    
    return sentences.length > 0 ? sentences[0] : text.substring(0, 200);
  }

  /**
   * Find best matching college name
   */
  private findBestMatch(aiName: string, knownColleges: string[]): string | null {
    const cleanAiName = this.cleanName(aiName);
    
    for (const knownCollege of knownColleges) {
      const cleanKnown = this.cleanName(knownCollege);
      
      // Exact match
      if (cleanAiName === cleanKnown) return knownCollege;
      
      // Subset matches
      if (cleanKnown.includes(cleanAiName)) return knownCollege;
      if (cleanAiName.includes(cleanKnown)) return knownCollege;
      
      // Word overlap
      const aiWords = cleanAiName.split(/\s+/).filter(w => w.length > 2);
      const knownWords = cleanKnown.split(/\s+/).filter(w => w.length > 2);
      
      if (aiWords.length > 0 && knownWords.length > 0) {
        const matchedWords = aiWords.filter(aiWord =>
          knownWords.some(knownWord => 
            aiWord === knownWord || 
            aiWord.includes(knownWord) || 
            knownWord.includes(aiWord)
          )
        );
        
        const matchRatio = matchedWords.length / Math.max(aiWords.length, knownWords.length);
        if (matchRatio >= 0.6) return knownCollege;
      }
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

  private findSource(text: string): string {
    const sources = ['nirf', 'shiksha', 'collegedunia', 'careers360', 'naac'];
    const lower = text.toLowerCase();
    
    for (const source of sources) {
      if (lower.includes(source)) return source;
    }
    
    return '';
  }

  private findSection(response: string, lineIndex: number): string {
    const lines = response.split('\n');
    
    for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 10); i--) {
      const line = lines[i].trim();
      
      if (line.match(/^#{1,3}\s+/) || line.match(/^\*\*[^*]+\*\*$/)) {
        return line.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '');
      }
    }
    
    return 'General';
  }

  private extractAllSources(response: string): string[] {
    const sources = ['nirf', 'shiksha', 'collegedunia', 'careers360'];
    const found: string[] = [];
    const lower = response.toLowerCase();
    
    for (const source of sources) {
      if (lower.includes(source)) found.push(source);
    }
    
    return found;
  }

  private extractFactors(response: string): string[] {
    const factors = ['placement', 'package', 'infrastructure', 'faculty', 'fees'];
    const found: string[] = [];
    const lower = response.toLowerCase();
    
    for (const factor of factors) {
      if (lower.includes(factor)) found.push(factor);
    }
    
    return found;
  }
}