// import { Injectable, Logger } from '@nestjs/common';

// export interface FeatureBattle {
//   featureName: string;
//   winner: 'client' | 'competitor' | 'neutral' | 'unclear';
//   confidenceLevel: 'strong' | 'moderate' | 'weak';
//   clientReasoning: string;
//   competitorReasoning: string;
//   clientDataPoints: Record<string, any>;
//   competitorDataPoints: Record<string, any>;
//   sources: string[];
//   dataGapIdentified: string | null;
// }

// export interface ComparisonAnalysis {
//   features: FeatureBattle[];
//   overallWinner: 'client' | 'competitor' | 'neutral' | 'unclear';
//   summary: string;
// }

// @Injectable()
// export class ComparisonParserService {
//   private readonly logger = new Logger(ComparisonParserService.name);

//   // FIXED: Confidence multipliers for weighted scoring
//   private readonly CONFIDENCE_MULTIPLIERS = {
//     strong: 1.0,
//     moderate: 0.6,
//     weak: 0.3,
//   };


//   private computeDataGaps(features: FeatureBattle[]): FeatureBattle[] {
//   return features.map(feature => {
//     const clientKeys = Object.entries(feature.clientDataPoints)
//       .filter(([_, v]) => v && v !== 'Not specified' && v !== 'N/A')
//       .map(([k]) => k);
    
//     const competitorKeys = Object.entries(feature.competitorDataPoints)
//       .filter(([_, v]) => v && v !== 'Not specified' && v !== 'N/A')
//       .map(([k]) => k);

//     // Find what competitor has that client doesn't
//     const clientMissing = competitorKeys.filter(k => !clientKeys.includes(k));
//     const competitorMissing = clientKeys.filter(k => !competitorKeys.includes(k));

//     if (clientMissing.length > 0) {
//       feature.dataGapIdentified = `Client missing: ${clientMissing.join(', ')}`;
//     } else if (competitorMissing.length > 0) {
//       feature.dataGapIdentified = `Competitor missing: ${competitorMissing.join(', ')}`;
//     } else if (clientKeys.length === 0 && competitorKeys.length === 0) {
//       feature.dataGapIdentified = `No structured data available for either college`;
//     } else {
//       feature.dataGapIdentified = null;
//     }

//     return feature;
//   });
// }

//   parseComparisonResponse(
//     response: string,
//     clientCollegeName: string,
//     competitorCollegeName: string,
//   ): ComparisonAnalysis {
//     this.logger.log(`📊 Parsing comparison with deterministic scoring`);

//     try {
//       const jsonStr = this.extractJSON(response);
//       // const parsed = JSON.parse(jsonStr);
//       let parsed;

//     try {
//       parsed = JSON.parse(jsonStr);
//     } catch {
//       this.logger.warn('Attempting JSON repair...');
//       const repaired = jsonStr
//         .replace(/,\s*}/g, '}')
//         .replace(/,\s*]/g, ']');
//       parsed = JSON.parse(repaired);
//     }
//       this.validateStructure(parsed);

//       // Normalize field names before scoring
//       const normalized = this.normalizeFieldNames(parsed.features);

//       // Apply deterministic scoring
//       const enhancedFeatures = this.applyDeterministicScoring(normalized);


//       const withGaps = this.computeDataGaps(enhancedFeatures);

//       // Calculate weighted winner with confidence multipliers
//       const overallWinner = this.calculateWeightedWinner(enhancedFeatures);

//       this.logger.log(`✅ Parsed ${enhancedFeatures.length} features`);
//       this.logWinnerBreakdown(enhancedFeatures);

//       return {
//         features: enhancedFeatures,
//         overallWinner,
//         summary: this.generateDetailedSummary(enhancedFeatures, overallWinner),
//       };

//     } catch (error) {
//       this.logger.error(`JSON parsing failed: ${error.message}`);
//       return this.fallbackTextParsing(response, clientCollegeName, competitorCollegeName);
//     }
//   }

//   /**
//    * FIXED: Normalize field names
//    * Handles variations like "NAAC" vs "naacGrade"
//    */
//   private normalizeFieldNames(features: FeatureBattle[]): FeatureBattle[] {
//     return features.map(feature => {
//       const normalizeData = (data: Record<string, any>): Record<string, any> => {
//         const normalized: Record<string, any> = {};

//         // Copy all existing fields
//         Object.assign(normalized, data);

//         // Normalize NAAC field
//         if (data.NAAC && !data.naacGrade) {
//           // Extract grade from "Grade 'A+'" or "'A+'" or "A+"
//           const match = data.NAAC.match(/['"]?([A-Z]\+*)['"]?/);
//           normalized.naacGrade = match ? match[1] : data.NAAC;
//         }

//         // Normalize NIRF field
//         if (data.NIRF && !data.nirfRank) {
//           normalized.nirfRank = data.NIRF;
//         }

//         return normalized;
//       };

//       return {
//         ...feature,
//         clientDataPoints: normalizeData(feature.clientDataPoints),
//         competitorDataPoints: normalizeData(feature.competitorDataPoints),
//       };
//     });
//   }

//   /**
//    * Apply deterministic scoring
//    */
//   private applyDeterministicScoring(features: FeatureBattle[]): FeatureBattle[] {
//     return features.map(feature => {
//       const clientData = feature.clientDataPoints;
//       const competitorData = feature.competitorDataPoints;

//       let result: { winner: 'client' | 'competitor' | 'neutral'; confidence: 'strong' | 'moderate' | 'weak' } | null = null;

//       switch (feature.featureName.toLowerCase()) {
//         case 'placements':
//           result = this.scorePlacements(clientData, competitorData);
//           break;
        
//         case 'fees':
//           result = this.scoreFees(clientData, competitorData);
//           break;
        
//         case 'faculty':
//           result = this.scoreFaculty(
//           clientData,
//           competitorData,
//           feature.clientReasoning,
//           feature.competitorReasoning
//         );
//           break;
        
//         case 'infrastructure':
//           result = this.scoreInfrastructure(clientData, competitorData);
//           break;
        
//         case 'accreditation':
//           result = this.scoreAccreditation(clientData, competitorData);
//           break;
        
//         case 'location':
//           result = this.scoreLocation(clientData, competitorData);
//           break;
        
//         case 'industry exposure':
//         case 'industry_exposure':
//           result = this.scoreIndustryExposure(clientData, competitorData);
//           break;
//       }

//       if (result) {
//         feature.winner = result.winner;
//         feature.confidenceLevel = result.confidence;
//         this.logger.debug(`${feature.featureName}: ${result.winner} (${result.confidence})`);
//       }

//       return feature;
//     });
//   }

//   /**
//    * FIXED: Placements scoring with proper salary priority
//    * Priority: Average > Median > Highest
//    */
//   // private scorePlacements(
//   //   clientData: Record<string, any>,
//   //   competitorData: Record<string, any>,
//   // ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'strong' | 'moderate' | 'weak' } {
    
//   //   // 1. FIXED: Compare salaries with proper priority
//   //   const salaryResult = this.compareRepresentativeSalary(clientData, competitorData);
//   //   if (salaryResult && salaryResult.percentDiff > 15) {
//   //     return {
//   //       winner: salaryResult.winner,
//   //       confidence: salaryResult.percentDiff > 30 ? 'strong' : 'moderate',
//   //     };
//   //   }

//   //   // 2. Compare placement rates
//   //   const rateResult = this.comparePlacementRates(clientData, competitorData);
//   //   if (rateResult && rateResult.percentDiff > 5) {
//   //     return {
//   //       winner: rateResult.winner,
//   //       confidence: rateResult.percentDiff > 15 ? 'strong' : 'moderate',
//   //     };
//   //   }

//   //   // 3. Compare recruiter quality
//   //   const recruiterResult = this.compareRecruiters(clientData, competitorData);
//   //   if (recruiterResult) {
//   //     return recruiterResult;
//   //   }

//   //   // If truly similar
//   //   if (salaryResult && rateResult) {
//   //     return { winner: 'neutral', confidence: 'moderate' };
//   //   }

//   //   // Data gap
//   //   if (Object.keys(competitorData).length > Object.keys(clientData).length) {
//   //     return { winner: 'competitor', confidence: 'weak' };
//   //   }
//   //   if (Object.keys(clientData).length > Object.keys(competitorData).length) {
//   //     return { winner: 'client', confidence: 'weak' };
//   //   }

//   //   return { winner: 'neutral', confidence: 'weak' };
//   // }

//   private scorePlacements(
//   clientData: Record<string, any>,
//   competitorData: Record<string, any>,
// ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'strong' | 'moderate' | 'weak' } {

//   let clientScore = 0;
//   let competitorScore = 0;

//   // 1️⃣ Salary (Weight 3)
//   const salaryResult = this.compareRepresentativeSalary(clientData, competitorData);
//   if (salaryResult) {
//     if (salaryResult.winner === 'client') clientScore += 3;
//     else competitorScore += 3;
//   }

//   // 2️⃣ Placement Rate (Weight 4 - most important)
//   const rateResult = this.comparePlacementRates(clientData, competitorData);
//   if (rateResult) {
//     if (rateResult.winner === 'client') clientScore += 4;
//     else competitorScore += 4;
//   }

//   // 3️⃣ Highest Package Bonus (Weight 1)
//   const clientHighest = this.parseAmount(clientData.highestPackage || '');
//   const competitorHighest = this.parseAmount(competitorData.highestPackage || '');

//   if (clientHighest && competitorHighest) {
//     if (clientHighest > competitorHighest) clientScore += 1;
//     else competitorScore += 1;
//   } else if (clientHighest) {
//     clientScore += 1;
//   } else if (competitorHighest) {
//     competitorScore += 1;
//   }

//   // 4️⃣ Recruiter Quality (Weight 1)
//   const recruiterResult = this.compareRecruiters(clientData, competitorData);
//   if (recruiterResult) {
//     if (recruiterResult.winner === 'client') clientScore += 1;
//     else if (recruiterResult.winner === 'competitor') competitorScore += 1;
//   }

//   const diff = Math.abs(clientScore - competitorScore);

//   if (diff === 0) {
//     return { winner: 'neutral', confidence: 'moderate' };
//   }

//   return {
//     winner: clientScore > competitorScore ? 'client' : 'competitor',
//     confidence: diff >= 5 ? 'strong' : 'moderate',
//   };
// }

//   /**
//    * FIXED: Compare representative salary
//    * Priority: Average > Median > Highest (not max!)
//    */
//   private compareRepresentativeSalary(
//     clientData: Record<string, any>,
//     competitorData: Record<string, any>,
//   ): { winner: 'client' | 'competitor'; percentDiff: number } | null {
    
//     /**
//      * Get most representative salary
//      * Priority: 1. Average  2. Median  3. Highest
//      */
//     const getRepresentativeSalary = (data: Record<string, any>): number => {
//       // Priority 1: Average package (most representative)
//       if (data.averagePackage) {
//         const value = this.parseAmount(data.averagePackage);
//         if (value) return value;
//       }

//       // Priority 2: Median salary (second best)
//       if (data.medianSalary) {
//         const value = this.parseAmount(data.medianSalary);
//         if (value) return value;
//       }

//       // Priority 3: Highest package (least reliable - marketing number)
//       if (data.highestPackage) {
//         const value = this.parseAmount(data.highestPackage);
//         if (value) return value;
//       }

//       return 0;
//     };

//     const clientSalary = getRepresentativeSalary(clientData);
//     const competitorSalary = getRepresentativeSalary(competitorData);

//     if (clientSalary === 0 && competitorSalary === 0) return null;
//     if (clientSalary === 0) return { winner: 'competitor', percentDiff: 100 };
//     if (competitorSalary === 0) return { winner: 'client', percentDiff: 100 };

//     const diff = Math.abs(clientSalary - competitorSalary);
//     const percentDiff = (diff / ((clientSalary + competitorSalary) / 2)) * 100;

//     return {
//       winner: clientSalary > competitorSalary ? 'client' : 'competitor',
//       percentDiff,
//     };
//   }

//   /**
//    * FIXED: Compare placement rates with proper range handling
//    * Takes average of ranges like "90-95%" → 92.5%
//    */
//   private comparePlacementRates(
//     clientData: Record<string, any>,
//     competitorData: Record<string, any>,
//   ): { winner: 'client' | 'competitor'; percentDiff: number } | null {
    
//     /**
//      * FIXED: Parse rate handling ranges properly
//      */
//     const parseRate = (rate: string | undefined): number => {
//       if (!rate) return 0;
      
//       // Handle ranges like "90-95%"
//       const rangeMatch = rate.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
//       if (rangeMatch) {
//         // Take average of range
//         const low = parseFloat(rangeMatch[1]);
//         const high = parseFloat(rangeMatch[2]);
//         return (low + high) / 2;
//       }

//       // Single value
//       const match = rate.match(/(\d+(?:\.\d+)?)/);
//       return match ? parseFloat(match[1]) : 0;
//     };

//     const clientRate = parseRate(clientData.placementRate);
//     const competitorRate = parseRate(competitorData.placementRate);

//     if (clientRate === 0 && competitorRate === 0) return null;
//     if (clientRate === 0) return { winner: 'competitor', percentDiff: 100 };
//     if (competitorRate === 0) return { winner: 'client', percentDiff: 100 };

//     const diff = Math.abs(clientRate - competitorRate);

//     return {
//       winner: clientRate > competitorRate ? 'client' : 'competitor',
//       percentDiff: diff,
//     };
//   }

//   /**
//    * Compare recruiter quality
//    */
//   private compareRecruiters(
//     clientData: Record<string, any>,
//     competitorData: Record<string, any>,
//   ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'weak' } | null {
    
//     const topTierCompanies = ['Google', 'Microsoft', 'Amazon', 'Apple', 'Meta', 'Goldman Sachs', 'Morgan Stanley'];
    
//     const countTopTier = (recruiters: string[] | undefined): number => {
//       if (!recruiters) return 0;
//       return recruiters.filter(r => 
//         topTierCompanies.some(top => r.toLowerCase().includes(top.toLowerCase()))
//       ).length;
//     };

//     const clientTopTier = countTopTier(clientData.topRecruiters);
//     const competitorTopTier = countTopTier(competitorData.topRecruiters);

//     if (clientTopTier === 0 && competitorTopTier === 0) return null;

//     if (clientTopTier > competitorTopTier) {
//       return { winner: 'client', confidence: 'weak' };
//     }
//     if (competitorTopTier > clientTopTier) {
//       return { winner: 'competitor', confidence: 'weak' };
//     }

//     return { winner: 'neutral', confidence: 'weak' };
//   }

//   /**
//    * Fees scoring
//    */
//   private scoreFees(
//     clientData: Record<string, any>,
//     competitorData: Record<string, any>,
//   ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'strong' | 'moderate' | 'weak' } {
    
//     const getMinFee = (data: Record<string, any>): number => {
//       if (data.feeRange) {
//         const match = data.feeRange.match(/₹([0-9.]+)/);
//         return match ? parseFloat(match[1]) : 0;
//       }
//       if (data.annualFees) {
//         return this.parseAmount(data.annualFees) || 0;
//       }
//       return 0;
//     };

//     const clientFee = getMinFee(clientData);
//     const competitorFee = getMinFee(competitorData);

//     if (clientFee === 0 && competitorFee === 0) {
//       return { winner: 'neutral', confidence: 'weak' };
//     }

//     if (clientFee === 0) return { winner: 'competitor', confidence: 'weak' };
//     if (competitorFee === 0) return { winner: 'client', confidence: 'weak' };

//     const diff = Math.abs(clientFee - competitorFee);
//     const percentDiff = (diff / Math.max(clientFee, competitorFee)) * 100;

//     if (percentDiff < 10) {
//       return { winner: 'neutral', confidence: 'moderate' };
//     }

//     return {
//       winner: clientFee < competitorFee ? 'client' : 'competitor',
//       confidence: percentDiff > 25 ? 'strong' : 'moderate',
//     };
//   }

//   /**
//    * Accreditation scoring
//    */
//   private scoreAccreditation(
//     clientData: Record<string, any>,
//     competitorData: Record<string, any>,
//   ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'strong' | 'moderate' | 'weak' } {
    
//     const naacResult = this.compareNAAC(clientData, competitorData);
//     const nirfResult = this.compareNIRF(clientData, competitorData);

//     if (naacResult?.winner === 'neutral' && nirfResult?.winner === 'neutral') {
//       return { winner: 'neutral', confidence: 'strong' };
//     }

//     if (naacResult && naacResult.scoreDiff > 1) {
//       return { winner: naacResult.winner, confidence: 'strong' };
//     }

//     if (nirfResult && nirfResult.rankDiff > 50) {
//       return { winner: nirfResult.winner, confidence: 'strong' };
//     }

//     if (naacResult && naacResult.winner !== 'neutral') {
//       return { winner: naacResult.winner, confidence: 'moderate' };
//     }

//     if (nirfResult && nirfResult.winner !== 'neutral') {
//       return { winner: nirfResult.winner, confidence: 'moderate' };
//     }

//     return { winner: 'neutral', confidence: 'moderate' };
//   }

//   /**
//    * Compare NAAC grades
//    */
//   private compareNAAC(
//     clientData: Record<string, any>,
//     competitorData: Record<string, any>,
//   ): { winner: 'client' | 'competitor' | 'neutral'; scoreDiff: number } | null {
    
//     const gradeMap: Record<string, number> = {
//       'A++': 7,
//       'A+': 6,
//       'A': 5,
//       'B++': 4,
//       'B+': 3,
//       'B': 2,
//       'C': 1,
//     };

//     const normalizeGrade = (grade: string | undefined): string => {
//       if (!grade) return '';
//       return grade.replace(/['"]/g, '').trim().toUpperCase();
//     };

//     const clientGrade = normalizeGrade(clientData.naacGrade);
//     const competitorGrade = normalizeGrade(competitorData.naacGrade);

//     if (!clientGrade || !competitorGrade) return null;

//     const clientScore = gradeMap[clientGrade] || 0;
//     const competitorScore = gradeMap[competitorGrade] || 0;

//     if (clientScore === 0 && competitorScore === 0) return null;

//     const scoreDiff = Math.abs(clientScore - competitorScore);

//     if (scoreDiff === 0) {
//       return { winner: 'neutral', scoreDiff: 0 };
//     }

//     return {
//       winner: clientScore > competitorScore ? 'client' : 'competitor',
//       scoreDiff,
//     };
//   }

//   /**
//    * Compare NIRF ranks
//    */
//   private compareNIRF(
//     clientData: Record<string, any>,
//     competitorData: Record<string, any>,
//   ): { winner: 'client' | 'competitor' | 'neutral'; rankDiff: number } | null {
    
//     const parseRank = (rank: string | undefined): number => {
//       if (!rank) return 999;
//       const match = rank.match(/(\d+)/);
//       return match ? parseInt(match[1]) : 999;
//     };

//     const clientRank = parseRank(clientData.nirfRank);
//     const competitorRank = parseRank(competitorData.nirfRank);

//     if (clientRank === 999 && competitorRank === 999) return null;

//     const rankDiff = Math.abs(clientRank - competitorRank);

//     if (rankDiff < 10) {
//       return { winner: 'neutral', rankDiff };
//     }

//     return {
//       winner: clientRank < competitorRank ? 'client' : 'competitor',
//       rankDiff,
//     };
//   }

//   /**
//    * FIXED: Faculty scoring with better text analysis
//    * Looks for PhD counts, IIT mentions, ratios in reasoning text
//    */
//  private scoreFaculty(
//   clientData: Record<string, any>,
//   competitorData: Record<string, any>,
//   clientReasoning: string,
//   competitorReasoning: string,
// ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'weak' } {
    
//     /**
//      * Score faculty quality from data + reasoning text
//      */
//     const scoreFacultyQuality = (data: Record<string, any>, reasoning: string): number => {
//       let score = 0;

//       // Check data fields
//       if (data.quality) score += 1;
//       if (data.qualifications) score += 1;
//       if (data.industryExperience) score += 1;

//       // FIXED: Also check reasoning text
//       const lowerReasoning = reasoning.toLowerCase();

//       if (lowerReasoning.includes('phd')) score += 1;
//       if (lowerReasoning.includes('iit') || lowerReasoning.includes('nit')) score += 1;
//       if (lowerReasoning.includes('experienced')) score += 0.5;
//       if (lowerReasoning.includes('qualified')) score += 0.5;
//       if (lowerReasoning.includes('industry experience')) score += 1;

//       return score;
//     };

//     // Need to access reasoning from parent - for now use data only
//     // In real implementation, pass reasoning as parameter
//     const clientScore = scoreFacultyQuality(clientData, clientReasoning);
//     const competitorScore = scoreFacultyQuality(competitorData, competitorReasoning);
//     // const clientScore = (clientData.quality ? 1 : 0) + 
//     //                    (clientData.qualifications ? 1 : 0) + 
//     //                    (clientData.industryExperience ? 1 : 0);
    
//     // const competitorScore = (competitorData.quality ? 1 : 0) + 
//     //                        (competitorData.qualifications ? 1 : 0) + 
//     //                        (competitorData.industryExperience ? 1 : 0);

//     if (clientScore > competitorScore) return { winner: 'client', confidence: 'weak' };
//     if (competitorScore > clientScore) return { winner: 'competitor', confidence: 'weak' };
//     return { winner: 'neutral', confidence: 'weak' };
//   }

//   /**
//    * Infrastructure scoring
//    */
//   private scoreInfrastructure(
//     clientData: Record<string, any>,
//     competitorData: Record<string, any>,
//   ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'weak' } {
    
//     const clientFacilities = (clientData.facilities as string[] | undefined)?.length || 0;
//     const competitorFacilities = (competitorData.facilities as string[] | undefined)?.length || 0;

//     if (clientFacilities > competitorFacilities) return { winner: 'client', confidence: 'weak' };
//     if (competitorFacilities > clientFacilities) return { winner: 'competitor', confidence: 'weak' };
//     return { winner: 'neutral', confidence: 'weak' };
//   }

//   /**
//    * Location scoring
//    */
//   private scoreLocation(
//     clientData: Record<string, any>,
//     competitorData: Record<string, any>,
//   ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'weak' } {
    
//     if (clientData.connectivity && competitorData.connectivity) {
//       return { winner: 'neutral', confidence: 'weak' };
//     }

//     if (clientData.connectivity) return { winner: 'client', confidence: 'weak' };
//     if (competitorData.connectivity) return { winner: 'competitor', confidence: 'weak' };

//     return { winner: 'neutral', confidence: 'weak' };
//   }

//   /**
//    * Industry exposure scoring
//    */
//   private scoreIndustryExposure(
//     clientData: Record<string, any>,
//     competitorData: Record<string, any>,
//   ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'weak' } {
    
//     const clientScore = (clientData.internships ? 1 : 0) + (clientData.partnerships ? 1 : 0) + (clientData.liveProjects ? 1 : 0);
//     const competitorScore = (competitorData.internships ? 1 : 0) + (competitorData.partnerships ? 1 : 0) + (competitorData.liveProjects ? 1 : 0);

//     if (clientScore > competitorScore) return { winner: 'client', confidence: 'weak' };
//     if (competitorScore > clientScore) return { winner: 'competitor', confidence: 'weak' };
//     return { winner: 'neutral', confidence: 'weak' };
//   }

//   /**
//    * FIXED: Weighted winner with confidence multipliers
//    * Weak confidence = 0.3x weight, not 1.0x
//    */
//   // private calculateWeightedWinner(features: FeatureBattle[]): 'client' | 'competitor' | 'neutral' {
//   //   const weights: Record<string, number> = {
//   //     placements: 30,
//   //     fees: 20,
//   //     accreditation: 15,
//   //     faculty: 15,
//   //     infrastructure: 10,
//   //     'industry exposure': 5,
//   //     'industry_exposure': 5,
//   //     location: 5,
//   //   };

//   //   let clientScore = 0;
//   //   let competitorScore = 0;

//   //   for (const feature of features) {
//   //     const key = 
//   //     const baseWeight = weights[feature.featureName] || 10;
      
//   //     // FIXED: Apply confidence multiplier
//   //     const multiplier = this.CONFIDENCE_MULTIPLIERS[feature.confidenceLevel];
//   //     const effectiveWeight = baseWeight * multiplier;

//   //     if (feature.winner === 'client') {
//   //       clientScore += effectiveWeight;
//   //     } else if (feature.winner === 'competitor') {
//   //       competitorScore += effectiveWeight;
//   //     }
//   //   }

//   //   this.logger.log(`Weighted scores (with confidence) - Client: ${clientScore.toFixed(1)}, Competitor: ${competitorScore.toFixed(1)}`);

//   //   const diff = Math.abs(clientScore - competitorScore);

//   //   // If difference is less than 5 points, it's neutral
//   //   if (diff < 5) {
//   //     return 'neutral';
//   //   }

//   //   return clientScore > competitorScore ? 'client' : 'competitor';
//   // }

//   private calculateWeightedWinner(features: FeatureBattle[]): 'client' | 'competitor' | 'neutral' {
//   const weights: Record<string, number> = {
//     placements: 30,
//     fees: 20,
//     accreditation: 15,
//     faculty: 15,
//     infrastructure: 10,
//     'industry exposure': 5,
//     'industry_exposure': 5,
//     location: 5,
//   };

//   let clientScore = 0;
//   let competitorScore = 0;

//   for (const feature of features) {
//     const key = feature.featureName.toLowerCase().trim();   // ✅ FIX
//     const baseWeight = weights[key] || 10;

//     const multiplier = this.CONFIDENCE_MULTIPLIERS[feature.confidenceLevel] || 0.3;
//     const effectiveWeight = baseWeight * multiplier;

//     if (feature.winner === 'client') {
//       clientScore += effectiveWeight;
//     } else if (feature.winner === 'competitor') {
//       competitorScore += effectiveWeight;
//     }
//   }

//   if (Math.abs(clientScore - competitorScore) < 5) {
//     return 'neutral';
//   }

//   return clientScore > competitorScore ? 'client' : 'competitor';
// }
//   /**
//    * Parse amount from string
//    */
//   private parseAmount(str: string): number | null {
//   if (!str) return null;

//   const lower = str.toLowerCase();

//   const lakhMatch = lower.match(/([0-9.]+)\s*(lpa|lakh)/);
//   if (lakhMatch) {
//     return parseFloat(lakhMatch[1]);
//   }

//   const numericMatch = lower.match(/([0-9,]+)/);
//   if (numericMatch) {
//     const value = parseFloat(numericMatch[1].replace(/,/g, ''));
//     return value / 100000;
//   }

//   return null;
// }
//   // private parseAmount(str: string): number | null {
//   //   if (!str) return null;

//   //   let cleaned = str.replace(/[₹,\s]/g, '');

//   //   if (cleaned.toLowerCase().includes('lpa') || cleaned.toLowerCase().includes('lakh')) {
//   //     const match = cleaned.match(/([0-9.]+)/);
//   //     return match ? parseFloat(match[1]) : null;
//   //   }

//   //   const match = cleaned.match(/([0-9.]+)/);
//   //   return match ? parseFloat(match[1]) / 100000 : null;
//   // }

//   /**
//    * Extract JSON
//    */
//   private extractJSON(response: string): string {
//     let cleaned = response.trim();
    
//     if (cleaned.startsWith('```json')) {
//       cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
//     } else if (cleaned.startsWith('```')) {
//       cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
//     }

//     const jsonStart = cleaned.indexOf('{');
//     const jsonEnd = cleaned.lastIndexOf('}');

//     if (jsonStart === -1 || jsonEnd === -1) {
//       throw new Error('No JSON found');
//     }

//     return cleaned.substring(jsonStart, jsonEnd + 1);
//   }

//   /**
//    * Validate structure
//    */
//   private validateStructure(parsed: any): void {
//     if (!parsed.features || !Array.isArray(parsed.features)) {
//       throw new Error('Invalid structure');
//     }

//     for (const feature of parsed.features) {
//       feature.clientReasoning = feature.clientReasoning || 'No reasoning';
//       feature.competitorReasoning = feature.competitorReasoning || 'No reasoning';
//       feature.clientDataPoints = feature.clientDataPoints || {};
//       feature.competitorDataPoints = feature.competitorDataPoints || {};
//       feature.sources = feature.sources || [];
//       feature.dataGapIdentified = feature.dataGapIdentified || null;
//     }
//   }

//   /**
//    * Log winner breakdown
//    */
//   private logWinnerBreakdown(features: FeatureBattle[]): void {
//     const clientWins = features.filter(f => f.winner === 'client').length;
//     const compWins = features.filter(f => f.winner === 'competitor').length;
//     const neutral = features.filter(f => f.winner === 'neutral').length;

//     this.logger.log(`Winners - Client: ${clientWins}, Competitor: ${compWins}, Neutral: ${neutral}`);
//   }

//   /**
//    * Generate detailed summary
//    */
//   private generateDetailedSummary(features: FeatureBattle[], overallWinner: string): string {
//     const clientWins = features.filter(f => f.winner === 'client').map(f => f.featureName);
//     const compWins = features.filter(f => f.winner === 'competitor').map(f => f.featureName);

//     if (overallWinner === 'client') {
//       return `Client wins overall. Strengths: ${clientWins.join(', ')}`;
//     } else if (overallWinner === 'competitor') {
//       return `Competitor wins overall. Strengths: ${compWins.join(', ')}`;
//     }

//     return `Highly competitive. Client: ${clientWins.join(', ')}. Competitor: ${compWins.join(', ')}`;
//   }

//   /**
//    * Fallback parser
//    */
//   private fallbackTextParsing(response: string, clientName: string, competitorName: string): ComparisonAnalysis {
//     this.logger.warn('Using fallback parsing');
//     return {
//       features: [],
//       overallWinner: 'unclear',
//       summary: 'Fallback used',
//     };
//   }
// }





import { Injectable, Logger } from '@nestjs/common';

export interface FeatureBattle {
  featureName: string;
  winner: 'client' | 'competitor' | 'neutral' | 'unclear';
  confidenceLevel: 'strong' | 'moderate' | 'weak';
  clientReasoning: string;
  competitorReasoning: string;
  clientDataPoints: Record<string, any>;
  competitorDataPoints: Record<string, any>;
  sources: string[];
  dataGapIdentified: string | null;
}

export interface ComparisonAnalysis {
  features: FeatureBattle[];
  overallWinner: 'client' | 'competitor' | 'neutral' | 'unclear';
  summary: string;
}

@Injectable()
export class ComparisonParserService {
  private readonly logger = new Logger(ComparisonParserService.name);

  private readonly CONFIDENCE_MULTIPLIERS = {
    strong: 1.0,
    moderate: 0.6,
    weak: 0.3,
  };

  // ============================================================
  // MAIN PARSE METHOD
  // ============================================================

  parseComparisonResponse(
    response: string,
    clientCollegeName: string,
    competitorCollegeName: string,
  ): ComparisonAnalysis {
    this.logger.log(`📊 Parsing comparison: ${clientCollegeName} vs ${competitorCollegeName}`);

    try {
      const jsonStr = this.extractJSON(response);

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        this.logger.warn('Attempting JSON repair...');
        const repaired = jsonStr
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/'/g, '"'); // Single quotes to double
        parsed = JSON.parse(repaired);
      }

      this.validateStructure(parsed);

      // Step 1: Normalize field names (NAAC → naacGrade, etc.)
      const normalized = this.normalizeFieldNames(parsed.features);

      // Step 2: Apply deterministic scoring (overrides AI's winner decisions)
      const scored = this.applyDeterministicScoring(normalized);

      // Step 3: Compute data gaps (what client is missing vs competitor)
      const withGaps = this.computeDataGaps(scored);

      // Step 4: Calculate weighted overall winner
      const overallWinner = this.calculateWeightedWinner(withGaps);

      this.logger.log(`✅ Parsed ${withGaps.length} features`);
      this.logWinnerBreakdown(withGaps);

      return {
        features: withGaps,
        overallWinner,
        summary: this.generateDetailedSummary(withGaps, overallWinner),
      };
    } catch (error) {
      this.logger.error(`JSON parsing failed: ${error.message}`);
      return this.fallbackTextParsing(response, clientCollegeName, competitorCollegeName);
    }
  }

  // ============================================================
  // CLEAN DATA VALUE — treats "Not specified", "N/A", etc. as null
  // ============================================================

  private cleanDataValue(value: any): any {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (
        lower === 'not specified' ||
        lower === 'n/a' ||
        lower === 'not available' ||
        lower === 'not provided' ||
        lower === 'na' ||
        lower === 'unknown' ||
        lower === 'not mentioned' ||
        lower === '' ||
        lower === '-'
      ) {
        return null;
      }
    }

    // Arrays: filter out empty/not-specified values
    if (Array.isArray(value)) {
      const cleaned = value.filter((v) => this.cleanDataValue(v) !== null);
      return cleaned.length > 0 ? cleaned : null;
    }

    return value;
  }

  // ============================================================
  // COMPUTE DATA GAPS
  // ============================================================

  private computeDataGaps(features: FeatureBattle[]): FeatureBattle[] {
    return features.map((feature) => {
      const clientKeys = Object.entries(feature.clientDataPoints)
        .filter(([_, v]) => this.cleanDataValue(v) !== null)
        .map(([k]) => k);

      const competitorKeys = Object.entries(feature.competitorDataPoints)
        .filter(([_, v]) => this.cleanDataValue(v) !== null)
        .map(([k]) => k);

      // What does competitor have that client doesn't?
      const clientMissing = competitorKeys.filter((k) => !clientKeys.includes(k));
      const competitorMissing = clientKeys.filter((k) => !competitorKeys.includes(k));

      if (clientMissing.length > 0 && competitorMissing.length > 0) {
        feature.dataGapIdentified = `Client missing: ${clientMissing.join(', ')}. Competitor missing: ${competitorMissing.join(', ')}`;
      } else if (clientMissing.length > 0) {
        feature.dataGapIdentified = `Client missing: ${clientMissing.join(', ')}`;
      } else if (competitorMissing.length > 0) {
        feature.dataGapIdentified = `Competitor missing: ${competitorMissing.join(', ')}`;
      } else if (clientKeys.length === 0 && competitorKeys.length === 0) {
        feature.dataGapIdentified = 'No structured data available for either college';
      } else {
        feature.dataGapIdentified = null;
      }

      return feature;
    });
  }

  // ============================================================
  // NORMALIZE FIELD NAMES
  // ============================================================

  private normalizeFieldNames(features: FeatureBattle[]): FeatureBattle[] {
    return features.map((feature) => {
      const normalizeData = (data: Record<string, any>): Record<string, any> => {
        const normalized: Record<string, any> = {};
        Object.assign(normalized, data);

        // NAAC → naacGrade
        if (data.NAAC && !data.naacGrade) {
          const match = data.NAAC.match(/['"]?([A-Z]\+{0,2})['"]?/);
          normalized.naacGrade = match ? match[1] : data.NAAC;
        }

        // NIRF → nirfRank
        if (data.NIRF && !data.nirfRank) {
          normalized.nirfRank = data.NIRF;
        }

        return normalized;
      };

      return {
        ...feature,
        clientDataPoints: normalizeData(feature.clientDataPoints),
        competitorDataPoints: normalizeData(feature.competitorDataPoints),
      };
    });
  }

  // ============================================================
  // DETERMINISTIC SCORING
  // ============================================================

  private applyDeterministicScoring(features: FeatureBattle[]): FeatureBattle[] {
    return features.map((feature) => {
      const clientData = feature.clientDataPoints;
      const competitorData = feature.competitorDataPoints;

      let result: {
        winner: 'client' | 'competitor' | 'neutral';
        confidence: 'strong' | 'moderate' | 'weak';
      } | null = null;
      const featureKey = feature.featureName.toLowerCase().trim().replace(/\s+/g, '_');
      switch (featureKey) {
        case 'placements':
          result = this.scorePlacements(clientData, competitorData);
          break;

        case 'fees':
          result = this.scoreFees(clientData, competitorData);
          break;

        case 'faculty':
          result = this.scoreFaculty(
            clientData,
            competitorData,
            feature.clientReasoning,
            feature.competitorReasoning,
          );
          break;

        case 'infrastructure':
          result = this.scoreInfrastructure(clientData, competitorData);
          break;

        case 'accreditation':
          result = this.scoreAccreditation(clientData, competitorData);
          break;

        case 'location':
          result = this.scoreLocation(clientData, competitorData);
          break;

        case 'industry exposure':
        case 'industryExposure':
        case 'industry_exposure':
          result = this.scoreIndustryExposure(
            clientData,
            competitorData,
            feature.clientReasoning,
            feature.competitorReasoning,
          );
          break;
      }

      if (result) {
        feature.winner = result.winner;
        feature.confidenceLevel = result.confidence;
        this.logger.debug(
          `  📊 ${feature.featureName}: ${result.winner} (${result.confidence})`,
        );
      }

      return feature;
    });
  }

  // ============================================================
  // PLACEMENTS SCORING
  // ============================================================

  private scorePlacements(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
  ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'strong' | 'moderate' | 'weak' } {
    let clientScore = 0;
    let competitorScore = 0;

    // 1. Placement Rate (Weight 4 — most important)
    const rateResult = this.comparePlacementRates(clientData, competitorData);
    if (rateResult) {
      if (rateResult.winner === 'client') clientScore += 4;
      else competitorScore += 4;
    }

    // 2. Average/Median Salary (Weight 3)
    const salaryResult = this.compareRepresentativeSalary(clientData, competitorData);
    if (salaryResult) {
      if (salaryResult.winner === 'client') clientScore += 3;
      else competitorScore += 3;
    }

    // 3. Highest Package Bonus (Weight 1)
    const clientHighest = this.parseAmount(
      this.cleanDataValue(clientData.highestPackage) || '',
    );
    const competitorHighest = this.parseAmount(
      this.cleanDataValue(competitorData.highestPackage) || '',
    );

    if (clientHighest && competitorHighest) {
      if (clientHighest > competitorHighest) clientScore += 1;
      else if (competitorHighest > clientHighest) competitorScore += 1;
    } else if (clientHighest) {
      clientScore += 1;
    } else if (competitorHighest) {
      competitorScore += 1;
    }

    // 4. Recruiter Quality (Weight 1)
    const recruiterResult = this.compareRecruiters(clientData, competitorData);
    if (recruiterResult) {
      if (recruiterResult.winner === 'client') clientScore += 1;
      else if (recruiterResult.winner === 'competitor') competitorScore += 1;
    }

    const diff = Math.abs(clientScore - competitorScore);

    if (diff === 0) {
      return { winner: 'neutral', confidence: 'moderate' };
    }

    return {
      winner: clientScore > competitorScore ? 'client' : 'competitor',
      confidence: diff >= 5 ? 'strong' : 'moderate',
    };
  }

  private compareRepresentativeSalary(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
  ): { winner: 'client' | 'competitor'; percentDiff: number } | null {
    const getSalary = (data: Record<string, any>): number => {
      const avg = this.parseAmount(this.cleanDataValue(data.averagePackage) || '');
      if (avg) return avg;

      const med = this.parseAmount(this.cleanDataValue(data.medianSalary) || '');
      if (med) return med;

      const high = this.parseAmount(this.cleanDataValue(data.highestPackage) || '');
      if (high) return high;

      return 0;
    };

    const clientSalary = getSalary(clientData);
    const competitorSalary = getSalary(competitorData);

    if (clientSalary === 0 && competitorSalary === 0) return null;
    if (clientSalary === 0) return { winner: 'competitor', percentDiff: 100 };
    if (competitorSalary === 0) return { winner: 'client', percentDiff: 100 };

    const diff = Math.abs(clientSalary - competitorSalary);
    const percentDiff = (diff / ((clientSalary + competitorSalary) / 2)) * 100;

    return {
      winner: clientSalary > competitorSalary ? 'client' : 'competitor',
      percentDiff,
    };
  }

  private comparePlacementRates(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
  ): { winner: 'client' | 'competitor'; percentDiff: number } | null {
    const parseRate = (rate: any): number => {
      const cleaned = this.cleanDataValue(rate);
      if (!cleaned) return 0;

      const str = String(cleaned);

      // Handle ranges: "90-95%"
      const rangeMatch = str.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
      if (rangeMatch) {
        return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
      }

      // Single value
      const match = str.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };

    const clientRate = parseRate(clientData.placementRate);
    const competitorRate = parseRate(competitorData.placementRate);

    if (clientRate === 0 && competitorRate === 0) return null;
    if (clientRate === 0) return { winner: 'competitor', percentDiff: 100 };
    if (competitorRate === 0) return { winner: 'client', percentDiff: 100 };

    const diff = Math.abs(clientRate - competitorRate);

    return {
      winner: clientRate > competitorRate ? 'client' : 'competitor',
      percentDiff: diff,
    };
  }

  private compareRecruiters(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
  ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'weak' } | null {
    const topTierCompanies = [
      'google', 'microsoft', 'amazon', 'apple', 'meta', 'facebook',
      'goldman sachs', 'morgan stanley', 'jpmorgan', 'deloitte',
      'mckinsey', 'bcg', 'bain', 'adobe', 'samsung', 'intel',
      'nvidia', 'oracle', 'salesforce', 'servicenow',
    ];

    const countTopTier = (recruiters: any): number => {
      const cleaned = this.cleanDataValue(recruiters);
      if (!Array.isArray(cleaned)) return 0;

      return cleaned.filter((r: string) =>
        topTierCompanies.some((top) => r.toLowerCase().includes(top)),
      ).length;
    };

    const clientTopTier = countTopTier(clientData.topRecruiters);
    const competitorTopTier = countTopTier(competitorData.topRecruiters);

    if (clientTopTier === 0 && competitorTopTier === 0) return null;
    if (clientTopTier > competitorTopTier) return { winner: 'client', confidence: 'weak' };
    if (competitorTopTier > clientTopTier) return { winner: 'competitor', confidence: 'weak' };
    return { winner: 'neutral', confidence: 'weak' };
  }

  // ============================================================
  // FEES SCORING — Fixed: "Not specified" = neutral, not a loss
  // ============================================================

  private scoreFees(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
  ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'strong' | 'moderate' | 'weak' } {
    const getFee = (data: Record<string, any>): number | null => {
      const feeRange = this.cleanDataValue(data.feeRange);
      if (feeRange) {
        const amount = this.parseAmount(String(feeRange));
        if (amount) return amount;
      }

      const annualFees = this.cleanDataValue(data.annualFees);
      if (annualFees) {
        const amount = this.parseAmount(String(annualFees));
        if (amount) return amount;
      }

      return null;
    };

    const clientFee = getFee(clientData);
    const competitorFee = getFee(competitorData);

    // If either side has no data, it's neutral — not a win for whoever has data
    if (clientFee === null || competitorFee === null) {
      return { winner: 'neutral', confidence: 'weak' };
    }

    const diff = Math.abs(clientFee - competitorFee);
    const percentDiff = (diff / Math.max(clientFee, competitorFee)) * 100;

    if (percentDiff < 10) {
      return { winner: 'neutral', confidence: 'moderate' };
    }

    // Lower fee wins
    return {
      winner: clientFee < competitorFee ? 'client' : 'competitor',
      confidence: percentDiff > 25 ? 'strong' : 'moderate',
    };
  }

  // ============================================================
  // ACCREDITATION SCORING
  // ============================================================

  private scoreAccreditation(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
  ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'strong' | 'moderate' | 'weak' } {
    const naacResult = this.compareNAAC(clientData, competitorData);
    const nirfResult = this.compareNIRF(clientData, competitorData);

    // Both have same accreditation
    if (naacResult?.winner === 'neutral' && nirfResult?.winner === 'neutral') {
      return { winner: 'neutral', confidence: 'strong' };
    }

    // NAAC is strong signal
    if (naacResult && naacResult.scoreDiff > 1) {
      return { winner: naacResult.winner, confidence: 'strong' };
    }

    // NIRF rank difference > 50 is strong
    if (nirfResult && nirfResult.rankDiff > 50) {
      return { winner: nirfResult.winner, confidence: 'strong' };
    }

    // One has NAAC, other doesn't
    if (naacResult && naacResult.winner !== 'neutral') {
      return { winner: naacResult.winner, confidence: 'moderate' };
    }

    // One has NIRF, other doesn't
    if (nirfResult && nirfResult.winner !== 'neutral') {
      return { winner: nirfResult.winner, confidence: 'moderate' };
    }

    return { winner: 'neutral', confidence: 'moderate' };
  }

  private compareNAAC(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
  ): { winner: 'client' | 'competitor' | 'neutral'; scoreDiff: number } | null {
    const gradeMap: Record<string, number> = {
      'A++': 7, 'A+': 6, 'A': 5, 'B++': 4, 'B+': 3, 'B': 2, 'C': 1,
    };

    const getGrade = (data: Record<string, any>): string => {
      const raw = this.cleanDataValue(data.naacGrade);
      if (!raw) return '';
      return String(raw).replace(/['"]/g, '').trim().toUpperCase();
    };

    const clientGrade = getGrade(clientData);
    const competitorGrade = getGrade(competitorData);

    if (!clientGrade && !competitorGrade) return null;

    // One has NAAC, other doesn't
    if (clientGrade && !competitorGrade) {
      return { winner: 'client', scoreDiff: gradeMap[clientGrade] || 3 };
    }
    if (!clientGrade && competitorGrade) {
      return { winner: 'competitor', scoreDiff: gradeMap[competitorGrade] || 3 };
    }

    const clientScore = gradeMap[clientGrade] || 0;
    const competitorScore = gradeMap[competitorGrade] || 0;

    if (clientScore === 0 && competitorScore === 0) return null;

    const scoreDiff = Math.abs(clientScore - competitorScore);

    if (scoreDiff === 0) {
      return { winner: 'neutral', scoreDiff: 0 };
    }

    return {
      winner: clientScore > competitorScore ? 'client' : 'competitor',
      scoreDiff,
    };
  }

  private compareNIRF(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
  ): { winner: 'client' | 'competitor' | 'neutral'; rankDiff: number } | null {
    const parseRank = (data: Record<string, any>): number | null => {
      const raw = this.cleanDataValue(data.nirfRank);
      if (!raw) return null;

      const str = String(raw);

      // Handle ranges: "201-300"
      const rangeMatch = str.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (rangeMatch) {
        return (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2;
      }

      const match = str.match(/(\d+)/);
      return match ? parseInt(match[1]) : null;
    };

    const clientRank = parseRank(clientData);
    const competitorRank = parseRank(competitorData);

    if (clientRank === null && competitorRank === null) return null;

    // One has NIRF, other doesn't
    if (clientRank !== null && competitorRank === null) {
      return { winner: 'client', rankDiff: 100 };
    }
    if (clientRank === null && competitorRank !== null) {
      return { winner: 'competitor', rankDiff: 100 };
    }

    const rankDiff = Math.abs(clientRank - competitorRank);

    if (rankDiff < 10) {
      return { winner: 'neutral', rankDiff };
    }

    // Lower rank = better
    return {
      winner: clientRank < competitorRank ? 'client' : 'competitor',
      rankDiff,
    };
  }

  // ============================================================
  // FACULTY SCORING — uses reasoning text as fallback
  // ============================================================

  private scoreFaculty(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
    clientReasoning: string,
    competitorReasoning: string,
  ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'weak' } {
    const scoreFacultyQuality = (
      data: Record<string, any>,
      reasoning: string,
    ): number => {
      let score = 0;

      // Structured data
      if (this.cleanDataValue(data.quality)) score += 1;
      if (this.cleanDataValue(data.qualifications)) score += 1;
      if (this.cleanDataValue(data.industryExperience)) score += 1;

      // Reasoning text analysis
      const lower = (reasoning || '').toLowerCase();
      if (/\d+%?\s*(?:phd|doctorate)/i.test(lower)) score += 2; // Specific PhD percentage
      else if (lower.includes('phd')) score += 1;

      if (lower.includes('iit') || lower.includes('nit') || lower.includes('iim')) score += 1;
      if (lower.includes('industry experience')) score += 1;
      if (lower.includes('experienced')) score += 0.5;
      if (lower.includes('qualified')) score += 0.5;
      if (lower.includes('student-faculty ratio') || lower.includes('student faculty ratio')) score += 0.5;

      return score;
    };

    const clientScore = scoreFacultyQuality(clientData, clientReasoning);
    const competitorScore = scoreFacultyQuality(competitorData, competitorReasoning);

    if (clientScore > competitorScore) return { winner: 'client', confidence: 'weak' };
    if (competitorScore > clientScore) return { winner: 'competitor', confidence: 'weak' };
    return { winner: 'neutral', confidence: 'weak' };
  }

  // ============================================================
  // INFRASTRUCTURE SCORING
  // ============================================================

  private scoreInfrastructure(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
  ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'weak' } {
    const clientFacilities = this.cleanDataValue(clientData.facilities);
    const competitorFacilities = this.cleanDataValue(competitorData.facilities);

    const clientCount = Array.isArray(clientFacilities) ? clientFacilities.length : 0;
    const competitorCount = Array.isArray(competitorFacilities) ? competitorFacilities.length : 0;

    if (clientCount > competitorCount) return { winner: 'client', confidence: 'weak' };
    if (competitorCount > clientCount) return { winner: 'competitor', confidence: 'weak' };
    return { winner: 'neutral', confidence: 'weak' };
  }

  // ============================================================
  // LOCATION SCORING
  // ============================================================

  private scoreLocation(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
  ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'weak' } {
    const clientConn = this.cleanDataValue(clientData.connectivity);
    const competitorConn = this.cleanDataValue(competitorData.connectivity);

    if (clientConn && competitorConn) return { winner: 'neutral', confidence: 'weak' };
    if (clientConn) return { winner: 'client', confidence: 'weak' };
    if (competitorConn) return { winner: 'competitor', confidence: 'weak' };
    return { winner: 'neutral', confidence: 'weak' };
  }

  // ============================================================
  // INDUSTRY EXPOSURE — Fixed: reads reasoning text as fallback
  // ============================================================

  private scoreIndustryExposure(
    clientData: Record<string, any>,
    competitorData: Record<string, any>,
    clientReasoning?: string,
    competitorReasoning?: string,
  ): { winner: 'client' | 'competitor' | 'neutral'; confidence: 'weak' } {
    let clientScore = 0;
    let competitorScore = 0;

    // Structured data
    if (this.cleanDataValue(clientData.internships)) clientScore += 1;
    if (this.cleanDataValue(clientData.partnerships)) clientScore += 1;
    if (this.cleanDataValue(clientData.liveProjects)) clientScore += 1;

    if (this.cleanDataValue(competitorData.internships)) competitorScore += 1;
    if (this.cleanDataValue(competitorData.partnerships)) competitorScore += 1;
    if (this.cleanDataValue(competitorData.liveProjects)) competitorScore += 1;

    // Fallback: extract signals from reasoning text
    if (clientReasoning) {
      const cl = clientReasoning.toLowerCase();
      if (/\d+\+?\s*companies/i.test(cl)) clientScore += 2;
      if (cl.includes('partnership') || cl.includes('collaboration')) clientScore += 1;
      if (cl.includes('internship')) clientScore += 1;
      if (cl.includes('100%')) clientScore += 1;
      if (cl.includes('mou') || cl.includes('tie-up') || cl.includes('tieup')) clientScore += 1;
    }

    if (competitorReasoning) {
      const cr = competitorReasoning.toLowerCase();
      if (/\d+\+?\s*companies/i.test(cr)) competitorScore += 2;
      if (cr.includes('partnership') || cr.includes('collaboration')) competitorScore += 1;
      if (cr.includes('internship')) competitorScore += 1;
      if (cr.includes('100%')) competitorScore += 1;
      if (cr.includes('mou') || cr.includes('tie-up') || cr.includes('tieup')) competitorScore += 1;
    }

    if (clientScore > competitorScore) return { winner: 'client', confidence: 'weak' };
    if (competitorScore > clientScore) return { winner: 'competitor', confidence: 'weak' };
    return { winner: 'neutral', confidence: 'weak' };
  }

  // ============================================================
  // WEIGHTED OVERALL WINNER
  // ============================================================

  private calculateWeightedWinner(
    features: FeatureBattle[],
  ): 'client' | 'competitor' | 'neutral' {
    const weights: Record<string, number> = {
      placements: 30,
      fees: 20,
      accreditation: 15,
      faculty: 15,
      infrastructure: 10,
      'industry exposure': 5,
      'industry_exposure': 5,
      location: 5,
    };

    let clientScore = 0;
    let competitorScore = 0;

    for (const feature of features) {
      const key = feature.featureName.toLowerCase().trim();
      const baseWeight = weights[key] || 10;
      const multiplier = this.CONFIDENCE_MULTIPLIERS[feature.confidenceLevel] || 0.3;
      const effectiveWeight = baseWeight * multiplier;

      if (feature.winner === 'client') {
        clientScore += effectiveWeight;
      } else if (feature.winner === 'competitor') {
        competitorScore += effectiveWeight;
      }
    }

    this.logger.log(
      `  🏆 Weighted scores — Client: ${clientScore.toFixed(1)}, Competitor: ${competitorScore.toFixed(1)}`,
    );

    if (Math.abs(clientScore - competitorScore) < 5) {
      return 'neutral';
    }

    return clientScore > competitorScore ? 'client' : 'competitor';
  }

  // ============================================================
  // PARSE AMOUNT — handles LPA, lakhs, raw numbers
  // ============================================================

  private parseAmount(str: string): number | null {
    if (!str) return null;

    const cleaned = this.cleanDataValue(str);
    if (!cleaned) return null;

    const lower = String(cleaned).toLowerCase();

    // Handle ranges: "5.8-6.5 LPA" → take average
    const rangeMatch = lower.match(/([0-9.]+)\s*[-–]\s*([0-9.]+)\s*(lpa|lakh)/);
    if (rangeMatch) {
      return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
    }

    // Single LPA/Lakh value
    const lakhMatch = lower.match(/([0-9.]+)\s*(lpa|lakh)/);
    if (lakhMatch) {
      return parseFloat(lakhMatch[1]);
    }

    // Raw number (assume INR, convert to lakhs)
    const numericMatch = lower.match(/([0-9,]+)/);
    if (numericMatch) {
      const value = parseFloat(numericMatch[1].replace(/,/g, ''));
      if (value > 1000) return value / 100000; // Convert from INR to lakhs
      return value; // Already in lakhs
    }

    return null;
  }

  // ============================================================
  // JSON EXTRACTION
  // ============================================================

  private extractJSON(response: string): string {
    let cleaned = response.trim();

    // Strip markdown code blocks
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No JSON found in response');
    }

    if (jsonStart > 0) {
      this.logger.warn(`Stripped ${jsonStart} chars of non-JSON content before the JSON object`);
    }

    return cleaned.substring(jsonStart, jsonEnd + 1);
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  private validateStructure(parsed: any): void {
    if (!parsed.features || !Array.isArray(parsed.features)) {
      throw new Error('Invalid JSON structure: missing features array');
    }

    for (const feature of parsed.features) {
      feature.featureName = feature.featureName || 'unknown';
      feature.winner = feature.winner || 'unclear';
      feature.confidenceLevel = feature.confidenceLevel || 'weak';
      feature.clientReasoning = feature.clientReasoning || '';
      feature.competitorReasoning = feature.competitorReasoning || '';
      feature.clientDataPoints = feature.clientDataPoints || {};
      feature.competitorDataPoints = feature.competitorDataPoints || {};
      feature.sources = feature.sources || [];
      feature.dataGapIdentified = feature.dataGapIdentified || null;
    }
  }

  // ============================================================
  // SUMMARY & LOGGING
  // ============================================================

  private logWinnerBreakdown(features: FeatureBattle[]): void {
    const clientWins = features.filter((f) => f.winner === 'client');
    const compWins = features.filter((f) => f.winner === 'competitor');
    const neutral = features.filter((f) => f.winner === 'neutral');

    this.logger.log(
      `  📊 Client wins: ${clientWins.map((f) => f.featureName).join(', ') || 'none'}`,
    );
    this.logger.log(
      `  📊 Competitor wins: ${compWins.map((f) => f.featureName).join(', ') || 'none'}`,
    );
    this.logger.log(
      `  📊 Neutral: ${neutral.map((f) => f.featureName).join(', ') || 'none'}`,
    );
  }

  private generateDetailedSummary(
    features: FeatureBattle[],
    overallWinner: string,
  ): string {
    const clientWins = features
      .filter((f) => f.winner === 'client')
      .map((f) => f.featureName);
    const compWins = features
      .filter((f) => f.winner === 'competitor')
      .map((f) => f.featureName);
    const gaps = features
      .filter((f) => f.dataGapIdentified)
      .map((f) => `${f.featureName}: ${f.dataGapIdentified}`);

    let summary = '';

    if (overallWinner === 'client') {
      summary = `Client wins overall. Strengths: ${clientWins.join(', ') || 'none'}.`;
    } else if (overallWinner === 'competitor') {
      summary = `Competitor wins overall. Their strengths: ${compWins.join(', ') || 'none'}.`;
    } else {
      summary = `Highly competitive matchup.`;
    }

    if (clientWins.length > 0 && overallWinner !== 'client') {
      summary += ` Client strengths: ${clientWins.join(', ')}.`;
    }
    if (compWins.length > 0 && overallWinner !== 'competitor') {
      summary += ` Competitor strengths: ${compWins.join(', ')}.`;
    }
    if (gaps.length > 0) {
      summary += ` Data gaps: ${gaps.join('; ')}.`;
    }

    return summary;
  }

  // ============================================================
  // FALLBACK PARSER
  // ============================================================

  private fallbackTextParsing(
    response: string,
    clientName: string,
    competitorName: string,
  ): ComparisonAnalysis {
    this.logger.warn('⚠️ Using fallback text parsing — JSON extraction failed');

    // Try to extract at least basic info from the text
    const lower = response.toLowerCase();
    const features: FeatureBattle[] = [];

    // Check if the response mentions a clear winner
    let overallWinner: 'client' | 'competitor' | 'neutral' | 'unclear' = 'unclear';

    const clientMentions = (lower.match(new RegExp(clientName.toLowerCase(), 'g')) || []).length;
    const competitorMentions = (lower.match(new RegExp(competitorName.toLowerCase(), 'g')) || []).length;

    if (clientMentions > competitorMentions * 1.5) {
      overallWinner = 'client';
    } else if (competitorMentions > clientMentions * 1.5) {
      overallWinner = 'competitor';
    }

    return {
      features,
      overallWinner,
      summary: `Fallback parsing used. Could not extract structured JSON from AI response. ${clientName} mentioned ${clientMentions} times, ${competitorName} mentioned ${competitorMentions} times.`,
    };
  }
}