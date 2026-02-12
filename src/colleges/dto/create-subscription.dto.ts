import { IsNumber, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class CreateSubscriptionDto {
  @IsNumber()
  @IsNotEmpty()
  collegeId: number;

  @IsEnum(['starter', 'professional', 'enterprise'])
  @IsOptional()
  plan?: string;
}