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
      
      // Check if line starts with "1." or "2." etc.
      const numberMatch = line.match(/^(\d+)\.\s+\*?\*?(.+?)(?:\*\*)?:/);
      
      if (numberMatch) {
        const rank = parseInt(numberMatch[1]);
        const collegeName = numberMatch[2]
          .replace(/\*\*/g, '')  // Remove bold markers
          .replace(/\*/g, '')    // Remove italic markers
          .trim();
        
        console.log(`\n📍 Found #${rank}: "${collegeName}"`);
        
        // Collect full context for this college
        let context = line;
        let j = i + 1;
        
        // Keep adding lines until we hit the next numbered item or end
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (nextLine.match(/^\d+\.\s+/)) {
            break; // Found next college
          }
          context += '\n' + nextLine;
          j++;
          
          // Safety: don't go more than 15 lines
          if (j - i > 15) break;
        }
        
        console.log(`📄 Context: ${context.substring(0, 100)}...`);
        
        // Try to match to known colleges
        const matchedCollege = this.findBestMatch(collegeName, allKnownColleges);
        
        if (matchedCollege) {
          console.log(`✅ MATCHED: "${collegeName}" → "${matchedCollege}"`);
          
          // Extract data
          const reasoning = this.extractReasoning(context);
          const strengths = this.extractStrengths(context);
          const weaknesses = this.extractWeaknesses(context);
          const source = this.findSource(context);
          const section = this.findSection(response, i);
          
          collegesFound.push({
            name: matchedCollege,
            rank,
            section,
            context: context.substring(0, 1000),
            reasoning: reasoning.substring(0, 500),
            strengths: strengths.slice(0, 5),
            weaknesses: weaknesses.slice(0, 3),
            sourceCited: source,
          });
        } else {
          console.log(`❌ NOT MATCHED: "${collegeName}" (not in tracked colleges)`);
        }
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ TOTAL COLLEGES PARSED: ${collegesFound.length}`);
    console.log(`='.repeat(80)}\n`);

    return {
      collegesFound,
      totalColleges: collegesFound.length,
      sourcesCited: this.extractAllSources(response),
      rankingFactors: this.extractFactors(response),
    };
  }

  /**
   * Find best matching college name
   */
  private findBestMatch(aiName: string, knownColleges: string[]): string | null {
    const cleanAiName = this.cleanName(aiName);
    
    for (const knownCollege of knownColleges) {
      const cleanKnown = this.cleanName(knownCollege);
      
      // Exact match
      if (cleanAiName === cleanKnown) {
        return knownCollege;
      }
      
      // AI name contains DB name (e.g., "Amity University" contains "Amity")
      if (cleanAiName.includes(cleanKnown)) {
        return knownCollege;
      }
      
      // DB name contains AI name (e.g., "Amity University Gurugram" contains "Amity University")
      if (cleanKnown.includes(cleanAiName)) {
        return knownCollege;
      }
      
      // Word overlap matching
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
        
        // At least 60% word match
        if (matchRatio >= 0.6) {
          return knownCollege;
        }
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

  private extractReasoning(text: string): string {
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);
    
    return sentences.length > 0 ? sentences[0] : text.substring(0, 200);
  }

  private extractStrengths(text: string): string[] {
    const keywords = [
      'offers', 'provides', 'has', 'features', 'known for', 'reputable',
      'excellent', 'strong', 'good', 'top', 'best', 'private university',
      'range of', 'various', 'well-established'
    ];
    
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 15 && s.length <= 300);
    
    const strengths: string[] = [];
    
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (keywords.some(k => lower.includes(k))) {
        strengths.push(sentence);
        if (strengths.length >= 5) break;
      }
    }
    
    return strengths;
  }

  private extractWeaknesses(text: string): string[] {
    const keywords = [
      'however', 'but', 'although', 'worth', 'recommend', 'should',
      'important', 'note', 'consider', 'research', 'check'
    ];
    
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 15 && s.length <= 300);
    
    const weaknesses: string[] = [];
    
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (keywords.some(k => lower.includes(k))) {
        weaknesses.push(sentence);
        if (weaknesses.length >= 3) break;
      }
    }
    
    return weaknesses;
  }

  private findSource(text: string): string {
    const sources = ['nirf', 'shiksha', 'collegedunia', 'careers360'];
    const lower = text.toLowerCase();
    
    for (const source of sources) {
      if (lower.includes(source)) {
        return source;
      }
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
      if (lower.includes(source)) {
        found.push(source);
      }
    }
    
    return found;
  }

  private extractFactors(response: string): string[] {
    const factors = ['placement', 'package', 'infrastructure', 'faculty', 'fees'];
    const found: string[] = [];
    const lower = response.toLowerCase();
    
    for (const factor of factors) {
      if (lower.includes(factor)) {
        found.push(factor);
      }
    }
    
    return found;
  }
}