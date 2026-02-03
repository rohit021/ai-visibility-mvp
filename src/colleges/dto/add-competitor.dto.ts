import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class AddCompetitorDto {
  @IsString()
  @IsNotEmpty()
  competitorCollegeName: string;

  @IsString()
  @IsOptional()
  competitorCity?: string;

  @IsNumber()
  @IsOptional()
  competitorNirfRank?: number;
}
