import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  IsUrl,
} from 'class-validator';

export class CreateCollegeDto {
  @IsString()
  @IsNotEmpty()
  collegeName: string;

  @IsNumber()
  @IsOptional()
  cityId?: number;

  @IsString()
  @IsOptional()
  state?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsNumber()
  @IsOptional()
  nirfRank?: number;

  @IsNumber()
  @IsOptional()
  establishedYear?: number;

  @IsEnum(['private', 'government', 'deemed', 'autonomous'])
  @IsOptional()
  collegeType?: string;
}
