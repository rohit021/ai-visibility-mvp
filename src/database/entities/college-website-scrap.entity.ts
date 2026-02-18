import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { College } from './college.entity';

// ─────────────────────────────────────────────────────────────────────────────
// TYPED INTERFACE — matches the 20 fields from Layer 3
// ─────────────────────────────────────────────────────────────────────────────

export interface ScrapedDataLocations {
  placementRate?: string;      // URL where this was found
  averagePackage?: string;
  highestPackage?: string;
  topRecruiters?: string;
  batchYear?: string;
  btechAnnual?: string;
  hostel?: string;
  totalProgram?: string;
  naacGrade?: string;
  nirfRank?: string;
  nbaAccredited?: string;
  ugcRecognized?: string;
  totalFaculty?: string;
  phdPercentage?: string;
  studentFacultyRatio?: string;
  campusSize?: string;
  facilities?: string;
  hostelAvailable?: string;
  overallSentiment?: string;
  averageRating?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY — college_website_scrapes
//
// PURPOSE:
//   Stores raw data extracted from a college's own website. This is the "ground
//   truth" — what the college actually published. Compare this to Layer 3 data
//   to find gaps: "You published 85% placement rate, but AI doesn't know it."
//
// WHY THIS TABLE EXISTS:
//   Without scraping the website, you can only tell colleges "AI knows X% about
//   you" but not WHY. With this table, you can say "AI is missing your placement
//   rate even though it's on your website — here's how to make it AI-readable."
//
// WHO WRITES TO IT:
//   WebsiteScraperService.scrapeCollegeWebsite() — triggered manually by client
//   or on a monthly schedule. Appends a new row each time (not upserted).
// ─────────────────────────────────────────────────────────────────────────────

@Entity('college_website_scrapes')
export class CollegeWebsiteScrape {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Foreign Key ───────────────────────────────────────────────────────────

  @Index()
  @Column({ name: 'college_id' })
  collegeId: number;

  // ── Scrape Metadata ───────────────────────────────────────────────────────

  @Index()
  @CreateDateColumn({ name: 'scraped_at' })
  scrapedAt: Date;

  // Which pages were visited during this scrape?
  // e.g. ["https://amity.edu/placements", "https://amity.edu/nirf"]
  @Column({ name: 'pages_scraped', type: 'json', nullable: true })
  pagesScraped: string[] | null;

  // How many pages succeeded vs failed?
  @Column({ name: 'pages_success_count', type: 'tinyint', default: 0 })
  pagesSuccessCount: number;

  @Column({ name: 'pages_failed_count', type: 'tinyint', default: 0 })
  pagesFailedCount: number;

  // Total time taken to scrape all pages
  @Column({ name: 'scrape_duration_ms', nullable: true })
  scrapeDurationMs: number | null;

  // ── Scraped Data (Flat Fields) ────────────────────────────────────────────
  // Same 20 fields as Layer 3, but these are from the WEBSITE, not from AI.

  // Placements (5 fields)
  @Column({ name: 'found_placement_rate', length: 50, nullable: true })
  foundPlacementRate: string | null;

  @Column({ name: 'found_average_package', length: 50, nullable: true })
  foundAveragePackage: string | null;

  @Column({ name: 'found_highest_package', length: 50, nullable: true })
  foundHighestPackage: string | null;

  @Column({ name: 'found_top_recruiters', type: 'json', nullable: true })
  foundTopRecruiters: string[] | null;

  @Column({ name: 'found_batch_year', length: 10, nullable: true })
  foundBatchYear: string | null;

  // Fees (3 fields)
  @Column({ name: 'found_btech_annual', length: 50, nullable: true })
  foundBtechAnnual: string | null;

  @Column({ name: 'found_hostel', length: 50, nullable: true })
  foundHostel: string | null;

  @Column({ name: 'found_total_program', length: 50, nullable: true })
  foundTotalProgram: string | null;

  // Accreditation (4 fields)
  @Column({ name: 'found_naac_grade', length: 10, nullable: true })
  foundNaacGrade: string | null;

  @Column({ name: 'found_nirf_rank', length: 50, nullable: true })
  foundNirfRank: string | null;

  @Column({ name: 'found_nba_accredited', nullable: true })
  foundNbaAccredited: boolean | null;

  @Column({ name: 'found_ugc_recognized', nullable: true })
  foundUgcRecognized: boolean | null;

  // Faculty (3 fields)
  @Column({ name: 'found_total_faculty', length: 50, nullable: true })
  foundTotalFaculty: string | null;

  @Column({ name: 'found_phd_percentage', length: 50, nullable: true })
  foundPhdPercentage: string | null;

  @Column({ name: 'found_student_faculty_ratio', length: 50, nullable: true })
  foundStudentFacultyRatio: string | null;

  // Infrastructure (3 fields)
  @Column({ name: 'found_campus_size', length: 50, nullable: true })
  foundCampusSize: string | null;

  @Column({ name: 'found_facilities', type: 'json', nullable: true })
  foundFacilities: string[] | null;

  @Column({ name: 'found_hostel_available', nullable: true })
  foundHostelAvailable: boolean | null;

  // Reviews (2 fields)
  @Column({ name: 'found_overall_sentiment', length: 20, nullable: true })
  foundOverallSentiment: 'positive' | 'negative' | 'mixed' | null;

  @Column({ name: 'found_average_rating', length: 10, nullable: true })
  foundAverageRating: string | null;

  // ── Data Locations (Where Each Field Was Found) ──────────────────────────
  // Maps field name → URL where it was extracted
  // Example: {"placementRate": "https://amity.edu/placements", "naacGrade": "https://amity.edu/about"}
  @Column({ name: 'data_locations', type: 'json', nullable: true })
  dataLocations: ScrapedDataLocations | null;

  // ── Completeness Metrics ──────────────────────────────────────────────────

  @Column({ name: 'fields_found', type: 'tinyint', default: 0 })
  fieldsFound: number;  // out of 20

  @Column({ name: 'website_completeness_score', type: 'tinyint', default: 0 })
  websiteCompletenessScore: number;  // 0–100: (fieldsFound / 20) * 100

  // Which fields are missing from the website itself?
  // If this is empty, the website has all 20 data points published.
  @Column({ name: 'missing_from_website', type: 'json', nullable: true })
  missingFromWebsite: string[] | null;

  // ── Status & Errors ───────────────────────────────────────────────────────

  @Column({
    name: 'scrape_status',
    type: 'enum',
    enum: ['success', 'partial', 'failed'],
    default: 'success',
  })
  scrapeStatus: 'success' | 'partial' | 'failed';

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  // ── Relations ─────────────────────────────────────────────────────────────

  @ManyToOne(() => College, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'college_id' })
  college: College;
}