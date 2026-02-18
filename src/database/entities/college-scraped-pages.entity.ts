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
import { CollegeWebsiteScrape } from './college-website-scrap.entity';

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY — college_scraped_pages
//
// PURPOSE:
//   Stores the raw HTML from each individual page scraped from a college website.
//   This is the "evidence" layer — if you need to debug why a field wasn't
//   extracted or re-parse the HTML later, you have the source material.
//
// WHY THIS TABLE EXISTS:
//   The parent table (college_website_scrapes) stores parsed/extracted data.
//   This table stores the raw HTML before parsing. Useful for:
//     1. Debugging: "Why didn't we find the placement rate?"
//     2. Re-parsing: AI models improve — re-extract without re-scraping
//     3. Evidence: Show the client "here's the exact HTML we found"
//
// WHO WRITES TO IT:
//   WebsiteScraperService.scrapePage() — one row per page per scrape run.
//   Example: If you scrape 5 pages, you get 5 rows here + 1 parent row above.
// ─────────────────────────────────────────────────────────────────────────────

@Entity('college_scraped_pages')
export class CollegeScrapedPage {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Foreign Keys ──────────────────────────────────────────────────────────

  @Index()
  @Column({ name: 'college_id' })
  collegeId: number;

  // Links to the parent scrape run — all pages from one run share the same scrape_id
  @Index()
  @Column({ name: 'scrape_id' })
  scrapeId: number;

  // ── Page Metadata ─────────────────────────────────────────────────────────

  // Full URL that was scraped
  @Index()
  @Column({ name: 'page_url', length: 500 })
  pageUrl: string;

  // Normalized/categorized page type for quick filtering
  // e.g. "placements", "admissions", "about", "nirf", "faculty", "infrastructure"
  @Index()
  @Column({ name: 'page_type', length: 50, nullable: true })
  pageType: string | null;

  @CreateDateColumn({ name: 'scraped_at' })
  scrapedAt: Date;

  // HTTP status code from the request
  @Column({ name: 'http_status_code', type: 'smallint', nullable: true })
  httpStatusCode: number | null;  // 200, 404, 500, etc.

  // How long did this specific page take to load?
  @Column({ name: 'load_time_ms', nullable: true })
  loadTimeMs: number | null;

  // ── Raw Content ───────────────────────────────────────────────────────────

  // Full HTML source after JavaScript execution (if using Puppeteer)
  @Column({ name: 'raw_html', type: 'longtext', nullable: true })
  rawHtml: string | null;

  // Plaintext extracted from HTML (stripped of tags) — easier for LLM parsing later
  @Column({ name: 'plaintext', type: 'longtext', nullable: true })
  plaintext: string | null;

  // Size of the HTML in bytes
  @Column({ name: 'content_length', nullable: true })
  contentLength: number | null;

  // ── Extracted Metadata ────────────────────────────────────────────────────

  // Page title from <title> tag
  @Column({ name: 'page_title', length: 255, nullable: true })
  pageTitle: string | null;

  // Meta description (useful for understanding page intent)
  @Column({ name: 'meta_description', type: 'text', nullable: true })
  metaDescription: string | null;

  // Any structured data found (JSON-LD, Open Graph, etc.)
  @Column({ name: 'structured_data', type: 'json', nullable: true })
  structuredData: Record<string, any> | null;

  // ── Parse Results ─────────────────────────────────────────────────────────

  // Did we successfully extract any of the 20 target fields from this page?
  @Column({ name: 'fields_extracted', type: 'json', nullable: true })
  fieldsExtracted: string[] | null;  // e.g. ["placementRate", "naacGrade"]

  @Column({ name: 'fields_extracted_count', type: 'tinyint', default: 0 })
  fieldsExtractedCount: number;

  // ── Status & Errors ───────────────────────────────────────────────────────

  @Column({
    name: 'scrape_status',
    type: 'enum',
    enum: ['success', 'failed', 'timeout', 'blocked'],
    default: 'success',
  })
  scrapeStatus: 'success' | 'failed' | 'timeout' | 'blocked';

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  // ── Relations ─────────────────────────────────────────────────────────────

  @ManyToOne(() => College, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'college_id' })
  college: College;

  @ManyToOne(() => CollegeWebsiteScrape, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scrape_id' })
  scrape: CollegeWebsiteScrape;
}