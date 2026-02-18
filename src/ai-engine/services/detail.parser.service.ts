import { Injectable, Logger } from '@nestjs/common';
import {
  PlacementsData,
  FeesData,
  AccreditationData,
  FacultyData,
  InfrastructureData,
  ReviewsData,
} from '../../database/entities/college-ai-profiles.entity';

// ─────────────────────────────────────────────────────────────────────────────
// What this service returns after parsing one GPT response
// ─────────────────────────────────────────────────────────────────────────────
export interface ParsedDetailProfile {
  collegeName: string;
  placementsData: PlacementsData | null;
  feesData: FeesData | null;
  accreditationData: AccreditationData | null;
  facultyData: FacultyData | null;
  infrastructureData: InfrastructureData | null;
  reviewsData: ReviewsData | null;
  sources: string[];
  dataCompletenessScore: number;  // 0–100
  fieldsPopulated: number;        // out of 20
  fieldsTotal: number;            // always 20
  missingFields: string[];        // e.g. ["placementRate", "nirfRank"]
}

@Injectable()
export class DetailParserService {
  private readonly logger = new Logger(DetailParserService.name);

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN ENTRY POINT
  // Called by QueryExecutorService after getting a raw response from OpenAI
  // ─────────────────────────────────────────────────────────────────────────
  parseDetailResponse(rawResponse: string, collegeName: string): ParsedDetailProfile {
    this.logger.log(`🔍 Parsing detail response for: ${collegeName}`);

    // Step 1: Extract JSON from the raw GPT response
    const jsonData = this.extractJson(rawResponse);

    if (!jsonData) {
      this.logger.warn(`⚠️ Could not extract JSON for ${collegeName} — returning empty profile`);
      return this.emptyProfile(collegeName);
    }

    // Step 2: Parse each section safely
    const placementsData   = this.parsePlacements(jsonData.placements);
    const feesData         = this.parseFees(jsonData.fees);
    const accreditationData = this.parseAccreditation(jsonData.accreditation);
    const facultyData      = this.parseFaculty(jsonData.faculty);
    const infrastructureData = this.parseInfrastructure(jsonData.infrastructure);
    const reviewsData      = this.parseReviews(jsonData.reviews);
    const sources          = this.parseSources(jsonData.sources);

    // Step 3: Calculate completeness score
    const { score, populated, missing } = this.calculateCompleteness({
      placementsData,
      feesData,
      accreditationData,
      facultyData,
      infrastructureData,
      reviewsData,
    });

    this.logger.log(
      `📊 ${collegeName}: ${populated}/20 fields populated (${score}% complete) | Missing: [${missing.join(', ')}]`,
    );

    return {
      collegeName: jsonData.collegeName || collegeName,
      placementsData,
      feesData,
      accreditationData,
      facultyData,
      infrastructureData,
      reviewsData,
      sources,
      dataCompletenessScore: score,
      fieldsPopulated: populated,
      fieldsTotal: 20,
      missingFields: missing,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXTRACT JSON
  // GPT sometimes wraps JSON in ```json ... ``` fences — strip those out
  // ─────────────────────────────────────────────────────────────────────────
  private extractJson(rawResponse: string): Record<string, any> | null {
    try {
      // Try direct parse first
      return JSON.parse(rawResponse);
    } catch {
      // Strip markdown fences and try again
      const fenceMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        try {
          return JSON.parse(fenceMatch[1].trim());
        } catch {
          this.logger.warn('⚠️ Could not parse JSON even after stripping fences');
        }
      }

      // Last resort: find first { ... } block
      const braceMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]);
        } catch {
          this.logger.warn('⚠️ Could not parse JSON from brace extraction');
        }
      }

      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION PARSERS
  // Each method safely reads its section and returns typed data or null
  // ─────────────────────────────────────────────────────────────────────────

  private parsePlacements(raw: any): PlacementsData | null {
    if (!raw || typeof raw !== 'object') return null;

    return {
      placementRate:   this.str(raw.placementRate),
      averagePackage:  this.str(raw.averagePackage),
      highestPackage:  this.str(raw.highestPackage),
      topRecruiters:   this.strArray(raw.topRecruiters),
      batchYear:       this.str(raw.batchYear),
    };
  }

  private parseFees(raw: any): FeesData | null {
    if (!raw || typeof raw !== 'object') return null;

    return {
      btechAnnual:  this.str(raw.btechAnnual),
      hostel:       this.str(raw.hostel),
      totalProgram: this.str(raw.totalProgram),
    };
  }

  private parseAccreditation(raw: any): AccreditationData | null {
    if (!raw || typeof raw !== 'object') return null;

    return {
      naacGrade:     this.str(raw.naacGrade),
      nirfRank:      this.str(raw.nirfRank),
      nbaAccredited: this.bool(raw.nbaAccredited),
      ugcRecognized: this.bool(raw.ugcRecognized),
    };
  }

  private parseFaculty(raw: any): FacultyData | null {
    if (!raw || typeof raw !== 'object') return null;

    return {
      totalFaculty:        this.str(raw.totalFaculty),
      phdPercentage:       this.str(raw.phdPercentage),
      studentFacultyRatio: this.str(raw.studentFacultyRatio),
    };
  }

  private parseInfrastructure(raw: any): InfrastructureData | null {
    if (!raw || typeof raw !== 'object') return null;

    return {
      campusSize:      this.str(raw.campusSize),
      facilities:      this.strArray(raw.facilities),
      hostelAvailable: this.bool(raw.hostelAvailable),
    };
  }

  private parseReviews(raw: any): ReviewsData | null {
    if (!raw || typeof raw !== 'object') return null;

    const sentiment = raw.overallSentiment;
    const validSentiments = ['positive', 'negative', 'mixed'];

    return {
      overallSentiment: validSentiments.includes(sentiment) ? sentiment : null,
      commonPraises:    this.strArray(raw.commonPraises),
      commonComplaints: this.strArray(raw.commonComplaints),
      averageRating:    this.str(raw.averageRating),
    };
  }

  private parseSources(raw: any): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((s) => typeof s === 'string' && s.startsWith('http'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLETENESS SCORE
  // 20 total fields tracked across all 6 sections
  // Score = (fieldsPopulated / 20) * 100
  // ─────────────────────────────────────────────────────────────────────────
  private calculateCompleteness(data: {
    placementsData: PlacementsData | null;
    feesData: FeesData | null;
    accreditationData: AccreditationData | null;
    facultyData: FacultyData | null;
    infrastructureData: InfrastructureData | null;
    reviewsData: ReviewsData | null;
  }): { score: number; populated: number; missing: string[] } {
    const missing: string[] = [];
    let populated = 0;

    // ── Placements (5 fields) ──
    const p = data.placementsData;
    this.check(p?.placementRate,   'placementRate',   populated, missing) && populated++;
    this.check(p?.averagePackage,  'averagePackage',  populated, missing) && populated++;
    this.check(p?.highestPackage,  'highestPackage',  populated, missing) && populated++;
    this.check(p?.topRecruiters,   'topRecruiters',   populated, missing) && populated++;
    this.check(p?.batchYear,       'batchYear',       populated, missing) && populated++;

    // ── Fees (3 fields) ──
    const f = data.feesData;
    this.check(f?.btechAnnual,  'btechAnnual',  populated, missing) && populated++;
    this.check(f?.hostel,       'hostel',       populated, missing) && populated++;
    this.check(f?.totalProgram, 'totalProgram', populated, missing) && populated++;

    // ── Accreditation (4 fields) ──
    const a = data.accreditationData;
    this.check(a?.naacGrade,     'naacGrade',     populated, missing) && populated++;
    this.check(a?.nirfRank,      'nirfRank',      populated, missing) && populated++;
    this.check(a?.nbaAccredited, 'nbaAccredited', populated, missing) && populated++;
    this.check(a?.ugcRecognized, 'ugcRecognized', populated, missing) && populated++;

    // ── Faculty (3 fields) ──
    const fc = data.facultyData;
    this.check(fc?.totalFaculty,        'totalFaculty',        populated, missing) && populated++;
    this.check(fc?.phdPercentage,       'phdPercentage',       populated, missing) && populated++;
    this.check(fc?.studentFacultyRatio, 'studentFacultyRatio', populated, missing) && populated++;

    // ── Infrastructure (3 fields) ──
    const i = data.infrastructureData;
    this.check(i?.campusSize,      'campusSize',      populated, missing) && populated++;
    this.check(i?.facilities,      'facilities',      populated, missing) && populated++;
    this.check(i?.hostelAvailable, 'hostelAvailable', populated, missing) && populated++;

    // ── Reviews (2 fields) ──
    const r = data.reviewsData;
    this.check(r?.overallSentiment, 'overallSentiment', populated, missing) && populated++;
    this.check(r?.averageRating,    'averageRating',    populated, missing) && populated++;

    const score = Math.round((populated / 20) * 100);

    return { score, populated, missing };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TINY HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  // Returns true if value is present (populated), false if missing
  // Pushes field name into missing[] array if absent
  private check(
    value: any,
    fieldName: string,
    _populated: number,  // unused — here for signature clarity
    missing: string[],
  ): boolean {
    const isPresent = this.hasValue(value);
    if (!isPresent) missing.push(fieldName);
    return isPresent;
  }

  // A value is "present" if it's not null/undefined/empty string/empty array
  private hasValue(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return true; // false is still a valid data point
    return false;
  }

  // Safely extract string — returns null if missing/empty
  private str(value: any): string | null {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    const empties = ['null', 'n/a', 'not available', 'not specified', 'unknown', '-', ''];
    return empties.includes(s.toLowerCase()) ? null : s;
  }

  // Safely extract string array — returns null if empty
  private strArray(value: any): string[] | null {
    if (!Array.isArray(value)) return null;
    const filtered = value.filter((v) => typeof v === 'string' && v.trim().length > 0);
    return filtered.length > 0 ? filtered : null;
  }

  // Safely extract boolean — returns null if not a boolean
  private bool(value: any): boolean | null {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  }

  // Returns an empty profile when JSON parsing completely fails
  private emptyProfile(collegeName: string): ParsedDetailProfile {
    return {
      collegeName,
      placementsData: null,
      feesData: null,
      accreditationData: null,
      facultyData: null,
      infrastructureData: null,
      reviewsData: null,
      sources: [],
      dataCompletenessScore: 0,
      fieldsPopulated: 0,
      fieldsTotal: 20,
      missingFields: [
        'placementRate', 'averagePackage', 'highestPackage', 'topRecruiters', 'batchYear',
        'btechAnnual', 'hostel', 'totalProgram',
        'naacGrade', 'nirfRank', 'nbaAccredited', 'ugcRecognized',
        'totalFaculty', 'phdPercentage', 'studentFacultyRatio',
        'campusSize', 'facilities', 'hostelAvailable',
        'overallSentiment', 'averageRating',
      ],
    };
  }
}