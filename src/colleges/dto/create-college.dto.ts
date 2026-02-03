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

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsNumber()
  @IsOptional()
  nirfRank?: number;

  @IsNumber()
  @IsOptional()
  establishedYear?: number;

  @IsEnum(['private', 'government', 'deemed'])
  @IsOptional()
  collegeType?: string;

  @IsArray()
  @IsOptional()
  programs?: string[];

  @IsArray()
  @IsOptional()
  specializations?: string[];
}
