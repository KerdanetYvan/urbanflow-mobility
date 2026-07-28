import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MobilityProfile } from './mobility-profile.entity';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(MobilityProfile)
    private readonly profilesRepository: Repository<MobilityProfile>,
  ) {}

  /**
   * Cree le profil de l'utilisateur authentifie. `userId` vient toujours du
   * JWT (voir ProfilesController), jamais d'une valeur fournie par le
   * client dans le corps de la requete - un utilisateur ne peut creer que
   * SON PROPRE profil.
   */
  async create(
    userId: string,
    dto: CreateProfileDto,
  ): Promise<MobilityProfile> {
    const existing = await this.profilesRepository.findOneBy({ userId });
    if (existing) {
      throw new ConflictException('Un profil existe déjà pour cet utilisateur');
    }

    const profile = this.profilesRepository.create({ userId, ...dto });
    return this.profilesRepository.save(profile);
  }

  async findByUserId(userId: string): Promise<MobilityProfile> {
    const profile = await this.profilesRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException('Profil introuvable');
    }
    return profile;
  }

  async update(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<MobilityProfile> {
    const profile = await this.findByUserId(userId);
    Object.assign(profile, dto);
    return this.profilesRepository.save(profile);
  }

  async remove(userId: string): Promise<void> {
    const profile = await this.findByUserId(userId);
    await this.profilesRepository.remove(profile);
  }
}
