import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { College } from './college.entity';

@Entity('cities')
export class City {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'city_name', length: 100 })
  cityName: string;

  @Column({ length: 100 })
  state: string;

  @Column({ length: 100, nullable: true })
  region: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => College, (college) => college.city)
  colleges: College[];

  // @Index('idx_state')
  // stateIndex: string;

  // @Index('idx_region')
  // regionIndex: string;
}