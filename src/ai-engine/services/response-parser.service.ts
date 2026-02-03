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

    const collegesFound: Array<{ name: string; rank: number; context: string }> =
      [];
    const lines = response.split('\n');

    // Pattern 1: Numbered lists (1. College Name, 2. College Name)
    const numberedPattern = /^\s*(\d+)\.\s*(.+)/;

    // Pattern 2: Bullet points (- College Name, • College Name)
    const bulletPattern = /^\s*[-•]\s*(.+)/;

    let currentRank = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine) continue;

      // Check numbered pattern
      const numberedMatch = trimmedLine.match(numberedPattern);
      if (numberedMatch) {
        currentRank = parseInt(numberedMatch[1]);
        const collegeName = this.extractCollegeName(
          numberedMatch[2],
          knownColleges,
        );

        if (collegeName) {
          collegesFound.push({
            name: collegeName,
            rank: currentRank,
            context: this.extractContext(line, lines),
          });
        }
        continue;
      }

      // Check bullet pattern
      const bulletMatch = trimmedLine.match(bulletPattern);
      if (bulletMatch) {
        currentRank++;
        const collegeName = this.extractCollegeName(
          bulletMatch[1],
          knownColleges,
        );

        if (collegeName) {
          collegesFound.push({
            name: collegeName,
            rank: currentRank,
            context: this.extractContext(line, lines),
          });
        }
      }
    }

    // If no structured list found, search for college names in text
    if (collegesFound.length === 0) {
      collegesFound.push(...this.fallbackExtraction(response, knownColleges));
    }

    this.logger.log(`Found ${collegesFound.length} colleges in response`);

    return {
      collegesFound,
      totalColleges: collegesFound.length,
    };
  }

  private extractCollegeName(text: string, knownColleges: string[]): string | null {
    // Clean text
    const cleanText = text
      .replace(/[*_`]/g, '') // Remove markdown
      .replace(/\([^)]*\)/g, '') // Remove parentheses content
      .trim();

    // Check if any known college name appears in text
    for (const college of knownColleges) {
      if (cleanText.toLowerCase().includes(college.toLowerCase())) {
        return college;
      }

      // Check for partial matches (e.g., "Amity" matches "Amity University Gurugram")
      const collegeWords = college.toLowerCase().split(' ');
      const textLower = cleanText.toLowerCase();

      if (
        collegeWords.some((word) => word.length > 3 && textLower.includes(word))
      ) {
        return college;
      }
    }

    return null;
  }

  private extractContext(line: string, allLines: string[]): string {
    const lineIndex = allLines.indexOf(line);

    // Get current line + next 2 lines as context
    const contextLines = allLines.slice(lineIndex, lineIndex + 3);

    return contextLines
      .join(' ')
      .replace(/[*_`]/g, '')
      .trim()
      .substring(0, 500); // Limit to 500 chars
  }

  private fallbackExtraction(
    response: string,
    knownColleges: string[],
  ): Array<{ name: string; rank: number; context: string }> {
    const found: Array<{ name: string; rank: number; context: string }> = [];
    const responseLower = response.toLowerCase();

    knownColleges.forEach((college, index) => {
      if (responseLower.includes(college.toLowerCase())) {
        // Find position in text
        const position = responseLower.indexOf(college.toLowerCase());
        const context = response.substring(
          Math.max(0, position - 100),
          Math.min(response.length, position + 200),
        );

        found.push({
          name: college,
          rank: index + 1,
          context: context.trim(),
        });
      }
    });

    return found;
  }
}
