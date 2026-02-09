import { Injectable, Logger } from '@nestjs/common';

interface CollegeInsight {
  name: string;
  rank: number;
  context: string;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
}

interface ParsedResponse {
  collegesFound: CollegeInsight[];
  totalColleges: number;
  sourcesCited: string[];
  rankingFactors: string[];
}

@Injectable()
export class ResponseParserService {
  private readonly logger = new Logger(ResponseParserService.name);

  // Known sources that AI might cite
  private readonly knownSources = [
    'nirf', 'shiksha', 'collegedunia', 'careers360', 'wikipedia',
    'times of india', 'hindustan times', 'official website', 
    'placement report', 'annual report', 'naac', 'aicte', 'ugc',
    'quora', 'linkedin', 'glassdoor', 'ambitionbox', 'naukri'
  ];

  // Common ranking factors
  private readonly rankingFactorKeywords = [
    'placement', 'package', 'salary', 'lpa', 'recruitment', 'recruiters',
    'nirf rank', 'ranking', 'infrastructure', 'campus', 'faculty',
    'research', 'industry', 'connections', 'tie-ups', 'collaborations',
    'accreditation', 'naac', 'nba', 'fees', 'affordable', 'hostel',
    'location', 'alumni', 'internship', 'curriculum', 'program'
  ];

  // Weakness indicator phrases
  private readonly weaknessIndicators = [
    'however', 'but', 'although', 'lacks', 'missing', 'not available',
    'limited', 'no data', 'unclear', 'outdated', 'weak', 'poor',
    'could improve', 'needs improvement', 'not published', 'unavailable',
    'lower than', 'behind', 'less than', 'fewer', 'not as good'
  ];

  // Strength indicator phrases
  private readonly strengthIndicators = [
    'excellent', 'outstanding', 'top', 'best', 'leading', 'renowned',
    'strong', 'high', 'impressive', 'notable', 'exceptional', 'superior',
    'well-known', 'reputed', 'established', 'recognized', 'acclaimed',
    'consistently', 'robust', 'comprehensive', 'extensive'
  ];

  parseResponse(response: string, knownColleges: string[]): ParsedResponse {
    this.logger.log('Parsing AI response for college mentions and insights...');

    const collegesFound: CollegeInsight[] = [];
    const lines = response.split('\n');

    // Pattern for numbered lists with structured format
    const numberedPattern = /^\s*(\d+)\.\s*\[?([^\]\n]+)\]?/;
    
    let currentCollege: Partial<CollegeInsight> | null = null;
    let currentRank = 0;
    let currentSection = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (!trimmedLine) continue;

      // Check for new college entry
      const numberedMatch = trimmedLine.match(numberedPattern);
      if (numberedMatch) {
        // Save previous college if exists
        if (currentCollege && currentCollege.name) {
          collegesFound.push(this.finalizeCollegeInsight(currentCollege, knownColleges));
        }

        currentRank = parseInt(numberedMatch[1]);
        const collegeName = this.extractCollegeName(numberedMatch[2], knownColleges);

        currentCollege = {
          name: collegeName || numberedMatch[2].replace(/[*_`\[\]]/g, '').trim(),
          rank: currentRank,
          context: '',
          reasoning: '',
          strengths: [],
          weaknesses: [],
        };
        currentSection = 'context';
        continue;
      }

      // If we have a current college, parse its details
      if (currentCollege) {
        const lowerLine = trimmedLine.toLowerCase();

        // Detect section headers
        if (lowerLine.includes('rank reason') || lowerLine.includes('why:')) {
          currentSection = 'reasoning';
          const reasonText = trimmedLine.split(':').slice(1).join(':').trim();
          if (reasonText) currentCollege.reasoning = reasonText;
          continue;
        }
        if (lowerLine.includes('strength')) {
          currentSection = 'strengths';
          continue;
        }
        if (lowerLine.includes('weakness') || lowerLine.includes('limitation')) {
          currentSection = 'weaknesses';
          continue;
        }
        if (lowerLine.includes('key stats') || lowerLine.includes('statistics')) {
          currentSection = 'stats';
          continue;
        }

        // Add content to appropriate section
        const cleanedLine = trimmedLine.replace(/^[-•*]\s*/, '').trim();
        if (cleanedLine) {
          switch (currentSection) {
            case 'reasoning':
              currentCollege.reasoning += ' ' + cleanedLine;
              break;
            case 'strengths':
              currentCollege.strengths.push(cleanedLine);
              break;
            case 'weaknesses':
              currentCollege.weaknesses.push(cleanedLine);
              break;
            default:
              currentCollege.context += ' ' + cleanedLine;
              // Also extract inline strengths/weaknesses
              this.extractInlineInsights(cleanedLine, currentCollege);
          }
        }
      }
    }

    // Don't forget the last college
    if (currentCollege && currentCollege.name) {
      collegesFound.push(this.finalizeCollegeInsight(currentCollege, knownColleges));
    }

    // If structured parsing failed, fallback to basic extraction
    if (collegesFound.length === 0) {
      collegesFound.push(...this.fallbackExtraction(response, knownColleges));
    }

    // Extract sources and ranking factors from full response
    const sourcesCited = this.extractSources(response);
    const rankingFactors = this.extractRankingFactors(response);

    this.logger.log(`Found ${collegesFound.length} colleges with insights`);

    return {
      collegesFound,
      totalColleges: collegesFound.length,
      sourcesCited,
      rankingFactors,
    };
  }

  private extractInlineInsights(text: string, college: Partial<CollegeInsight>): void {
    const lowerText = text.toLowerCase();

    // Check for weakness indicators
    for (const indicator of this.weaknessIndicators) {
      if (lowerText.includes(indicator)) {
        // Extract the phrase containing the weakness
        const sentences = text.split(/[.!?]/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(indicator)) {
            const weakness = sentence.trim();
            if (weakness && !college.weaknesses.includes(weakness)) {
              college.weaknesses.push(weakness);
            }
          }
        }
      }
    }

    // Check for strength indicators
    for (const indicator of this.strengthIndicators) {
      if (lowerText.includes(indicator)) {
        const sentences = text.split(/[.!?]/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(indicator) && 
              !this.weaknessIndicators.some(w => sentence.toLowerCase().includes(w))) {
            const strength = sentence.trim();
            if (strength && !college.strengths.includes(strength)) {
              college.strengths.push(strength);
            }
          }
        }
      }
    }
  }

  private finalizeCollegeInsight(college: Partial<CollegeInsight>, knownColleges: string[]): CollegeInsight {
    // Try to match to known college name
    const matchedName = this.extractCollegeName(college.name, knownColleges) || college.name;

    return {
      name: matchedName,
      rank: college.rank || 0,
      context: (college.context || '').trim().substring(0, 500),
      reasoning: (college.reasoning || '').trim().substring(0, 500),
      strengths: college.strengths || [],
      weaknesses: college.weaknesses || [],
    };
  }

  private extractCollegeName(text: string, knownColleges: string[]): string | null {
    const cleanText = text
      .replace(/[*_`\[\]]/g, '')
      .replace(/\([^)]*\)/g, '')
      .trim();

    for (const college of knownColleges) {
      if (cleanText.toLowerCase().includes(college.toLowerCase())) {
        return college;
      }

      // Partial match
      const collegeWords = college.toLowerCase().split(' ');
      const textLower = cleanText.toLowerCase();

      const matchCount = collegeWords.filter(
        word => word.length > 3 && textLower.includes(word)
      ).length;

      if (matchCount >= 2 || (matchCount === 1 && collegeWords.length <= 2)) {
        return college;
      }
    }

    return null;
  }

  private extractSources(response: string): string[] {
    const sources: string[] = [];
    const lowerResponse = response.toLowerCase();

    for (const source of this.knownSources) {
      if (lowerResponse.includes(source)) {
        sources.push(source);
      }
    }

    // Also look for "according to", "based on", "source:" patterns
    const sourcePatterns = [
      /according to ([^,.\n]+)/gi,
      /based on ([^,.\n]+)/gi,
      /source:\s*([^,.\n]+)/gi,
      /as per ([^,.\n]+)/gi,
      /data from ([^,.\n]+)/gi,
    ];

    for (const pattern of sourcePatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        const source = match[1].trim().toLowerCase();
        if (source.length > 2 && source.length < 50 && !sources.includes(source)) {
          sources.push(source);
        }
      }
    }

    return [...new Set(sources)];
  }

  private extractRankingFactors(response: string): string[] {
    const factors: string[] = [];
    const lowerResponse = response.toLowerCase();

    for (const factor of this.rankingFactorKeywords) {
      if (lowerResponse.includes(factor)) {
        factors.push(factor);
      }
    }

    return [...new Set(factors)];
  }

  private fallbackExtraction(response: string, knownColleges: string[]): CollegeInsight[] {
    const found: CollegeInsight[] = [];
    const responseLower = response.toLowerCase();

    knownColleges.forEach((college, index) => {
      if (responseLower.includes(college.toLowerCase())) {
        const position = responseLower.indexOf(college.toLowerCase());
        const contextStart = Math.max(0, position - 50);
        const contextEnd = Math.min(response.length, position + 300);
        const context = response.substring(contextStart, contextEnd);

        // Extract inline insights from context
        const insight: Partial<CollegeInsight> = {
          name: college,
          rank: index + 1,
          context: context.trim(),
          reasoning: '',
          strengths: [],
          weaknesses: [],
        };

        this.extractInlineInsights(context, insight);

        found.push(this.finalizeCollegeInsight(insight, knownColleges));
      }
    });

    return found;
  }
}
