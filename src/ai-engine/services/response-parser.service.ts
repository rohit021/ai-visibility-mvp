import { Injectable, Logger } from '@nestjs/common';

interface ParsedResponse {
  collegesFound: Array<{
    name: string;
    rank: number;
    context: string;
  }>;
  totalColleges: number;
}

@Injectable()
export class ResponseParserService {
  private readonly logger = new Logger(ResponseParserService.name);

  parseResponse(response: string, knownColleges: string[]): ParsedResponse {
    this.logger.log('Parsing AI response for college mentions...');
    console.log('\n🔍 PARSING RESPONSE FOR COLLEGES:', knownColleges);
    console.log('\n📄 RESPONSE TO PARSE:\n', response.substring(0, 500));

    const collegesFound: Array<{ name: string; rank: number; context: string }> = [];
    
    // Split response into lines
    const lines = response.split('\n').filter(line => line.trim().length > 0);

    // Pattern to match numbered lists: "1. College Name" or "1) College Name"
    const numberedPattern = /^\s*(\d+)[\.\)]\s*\*?\*?(.+?)(?:\*\*)?[\s:-]/;

    let currentRank = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines or section headers
      if (!line || line.match(/^[*#_-]+/) || line.length < 10) {
        continue;
      }

      // Try to match numbered pattern
      const match = line.match(numberedPattern);
      
      if (match) {
        currentRank = parseInt(match[1]);
        const collegeLine = match[2].trim();
        
        // Clean up the college name (remove markdown, special chars)
        const cleanedName = this.cleanCollegeName(collegeLine);
        
        console.log(`\n✓ Found ranked entry #${currentRank}: "${cleanedName}"`);
        
        // Check if this matches any known college
        const matchedCollege = this.findMatchingCollege(cleanedName, knownColleges);
        
        if (matchedCollege) {
          // Get context (current line + next line)
          const context = this.extractContext(i, lines);
          
          // Check if we already added this college
          const alreadyAdded = collegesFound.find(c => 
            c.name.toLowerCase() === matchedCollege.toLowerCase()
          );
          
          if (!alreadyAdded) {
            console.log(`   ✅ MATCHED to known college: "${matchedCollege}"`);
            collegesFound.push({
              name: matchedCollege,
              rank: currentRank,
              context: context,
            });
          } else {
            console.log(`   ⚠️  Already added, skipping duplicate`);
          }
        } else {
          console.log(`   ❌ No match in known colleges list`);
        }
      }
    }

    // If no structured matches found, try fallback search
    if (collegesFound.length === 0) {
      console.log('\n⚠️  No structured matches found. Trying fallback search...');
      collegesFound.push(...this.fallbackExtraction(response, knownColleges));
    }

    console.log(`\n✅ FINAL RESULT: Found ${collegesFound.length} colleges`);
    collegesFound.forEach(c => console.log(`   - ${c.name} (Rank: ${c.rank})`));

    return {
      collegesFound,
      totalColleges: collegesFound.length,
    };
  }

  private cleanCollegeName(text: string): string {
    return text
      .replace(/\*\*/g, '') // Remove bold markdown
      .replace(/\*/g, '')   // Remove italic markdown
      .replace(/\[|\]/g, '') // Remove brackets
      .replace(/\(.*?\)/g, '') // Remove content in parentheses
      .split('-')[0]  // Take only text before dash
      .split('–')[0]  // Take only text before en-dash
      .split(':')[0]  // Take only text before colon
      .trim();
  }

  private findMatchingCollege(text: string, knownColleges: string[]): string | null {
    const textLower = text.toLowerCase();
    
    // First, try exact match
    for (const college of knownColleges) {
      if (textLower === college.toLowerCase()) {
        return college;
      }
    }
    
    // Then try if the text contains the full college name
    for (const college of knownColleges) {
      if (textLower.includes(college.toLowerCase())) {
        return college;
      }
    }
    
    // Then try if college name contains the text
    for (const college of knownColleges) {
      if (college.toLowerCase().includes(textLower)) {
        return college;
      }
    }
    
    // Finally, try partial word matching (at least 2 significant words match)
    for (const college of knownColleges) {
      const collegeWords = college.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const textWords = textLower.split(/\s+/).filter(w => w.length > 3);
      
      let matchCount = 0;
      for (const word of collegeWords) {
        if (textWords.some(tw => tw.includes(word) || word.includes(tw))) {
          matchCount++;
        }
      }
      
      // If at least 2 significant words match, consider it a match
      if (matchCount >= 2) {
        return college;
      }
    }
    
    return null;
  }

  private extractContext(currentIndex: number, lines: string[]): string {
    // Get current line and next 2 lines as context
    const contextLines = lines.slice(currentIndex, currentIndex + 3);
    
    return contextLines
      .join(' ')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim()
      .substring(0, 300); // Limit to 300 chars
  }

  private fallbackExtraction(
    response: string,
    knownColleges: string[],
  ): Array<{ name: string; rank: number; context: string }> {
    console.log('\n🔍 FALLBACK EXTRACTION - Searching entire text');
    
    const found: Array<{ name: string; rank: number; context: string }> = [];
    const responseLower = response.toLowerCase();

    for (const college of knownColleges) {
      const collegeLower = college.toLowerCase();
      
      // Check if college name appears in response
      if (responseLower.includes(collegeLower)) {
        const position = responseLower.indexOf(collegeLower);
        const context = response.substring(
          Math.max(0, position - 100),
          Math.min(response.length, position + 200),
        );

        console.log(`   ✓ Found "${college}" in text`);

        found.push({
          name: college,
          rank: found.length + 1,
          context: context.trim(),
        });
      }
    }

    return found;
  }
}