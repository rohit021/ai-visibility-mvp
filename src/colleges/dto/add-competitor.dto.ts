import { IsNumber, IsNotEmpty } from 'class-validator';

export class AddCompetitorDto {
  @IsNumber()
  @IsNotEmpty()
  competitorCollegeId: number;
}