import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = this.userRepository.create({
      email: registerDto.email.toLowerCase(),
      passwordHash: hashedPassword,
      fullName: registerDto.fullName,
      role: 'college_user',
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    // Generate JWT token
    const token = this.generateToken(savedUser);

    return {
      user: {
        id: savedUser.id,
        email: savedUser.email,
        fullName: savedUser.fullName,
        role: savedUser.role,
      },
      access_token: token,
    };
  }

  async login(loginDto: LoginDto) {
    // Find user (case-insensitive email)
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      access_token: token,
    };
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: ['subscriptions', 'subscriptions.college'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
      subscriptions: user.subscriptions?.map((sub) => ({
        id: sub.id,
        collegeName: sub.college?.collegeName,
        plan: sub.plan,
        status: sub.status,
      })) || [],
    };
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  // Helper method for JWT strategy
  async validateUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }
}