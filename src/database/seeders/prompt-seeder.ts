import { DataSource } from 'typeorm';
import { PromptLibrary } from '../entities/prompt-library.entity';

export const prompts = [
  // GENERAL (10 prompts)
  { text: 'Best colleges in {city}', category: 'general' },
  { text: 'Top universities in {state}', category: 'general' },
  { text: 'Most reputed colleges in {city}', category: 'general' },
  { text: 'Which college should I choose in {city}?', category: 'general' },
  { text: 'Good colleges for higher education in {city}', category: 'general' },
  { text: 'Universities worth joining in {state}', category: 'general' },
  { text: 'Best private colleges in {city}', category: 'general' },
  { text: 'Top 10 colleges in {city}', category: 'general' },
  { text: 'Colleges with good reputation in {city}', category: 'general' },
  { text: 'Where should I study in {city}?', category: 'general' },

  // // PROGRAM SPECIFIC (15 prompts)
  // { text: 'Best BTech colleges in {city}', category: 'program_specific' },
  // { text: 'Top engineering colleges in {city}', category: 'program_specific' },
  // { text: 'Best MBA colleges in {city}', category: 'program_specific' },
  // { text: 'Top BBA programs in {state}', category: 'program_specific' },
  // { text: 'Best BCA colleges in {city}', category: 'program_specific' },
  // { text: 'Top MCA programs in {city}', category: 'program_specific' },
  // { text: 'Best computer science colleges in {city}', category: 'program_specific' },
  // { text: 'Top mechanical engineering colleges in {city}', category: 'program_specific' },
  // { text: 'Best commerce colleges in {city}', category: 'program_specific' },
  // { text: 'Top law colleges in {state}', category: 'program_specific' },
  // { text: 'Best medical colleges in {city}', category: 'program_specific' },
  // { text: 'Top pharmacy colleges in {city}', category: 'program_specific' },
  // { text: 'Best B.Tech CSE colleges in {city}', category: 'program_specific' },
  // { text: 'Top M.Tech colleges in {state}', category: 'program_specific' },
  // { text: 'Best hospitality management colleges in {city}', category: 'program_specific' },

  // // FEATURE SPECIFIC (12 prompts)
  // { text: 'Colleges with best placements in {city}', category: 'feature_specific' },
  // { text: 'Universities with good infrastructure in {city}', category: 'feature_specific' },
  // { text: 'Colleges with international exposure in {state}', category: 'feature_specific' },
  // { text: 'Best hostel facilities colleges in {city}', category: 'feature_specific' },
  // { text: 'Colleges with industry partnerships in {city}', category: 'feature_specific' },
  // { text: 'Universities with research programs in {state}', category: 'feature_specific' },
  // { text: 'Colleges with sports facilities in {city}', category: 'feature_specific' },
  // { text: 'Best faculty colleges in {city}', category: 'feature_specific' },
  // { text: 'Colleges with startup incubators in {city}', category: 'feature_specific' },
  // { text: 'Universities with global collaborations in {state}', category: 'feature_specific' },
  // { text: 'Colleges with modern labs in {city}', category: 'feature_specific' },
  // { text: 'Best library facilities colleges in {city}', category: 'feature_specific' },

  // // COMPETITIVE (8 prompts)
  // { text: 'Amity vs {college_name} which is better?', category: 'competitive' },
  // { text: 'Compare {college_name} with other colleges in {city}', category: 'competitive' },
  // { text: '{college_name} or SRM which should I choose?', category: 'competitive' },
  // { text: 'Is {college_name} better than Manipal?', category: 'competitive' },
  // { text: 'NIRF ranking of colleges in {city}', category: 'competitive' },
  // { text: 'Top ranked universities in {state}', category: 'competitive' },
  // { text: '{college_name} reviews and ratings', category: 'competitive' },
  // { text: 'Which is more reputed - {college_name} or VIT?', category: 'competitive' },

  // // STUDENT INTENT (5 prompts)
  // { text: 'Affordable colleges in {city}', category: 'student_intent' },
  // { text: 'Colleges under 5 lakhs in {city}', category: 'student_intent' },
  // { text: 'Day scholar friendly colleges in {city}', category: 'student_intent' },
  // { text: 'Colleges with scholarship programs in {state}', category: 'student_intent' },
  // { text: 'Best value for money colleges in {city}', category: 'student_intent' },
];

export async function seedPrompts(dataSource: DataSource) {
  const promptRepo = dataSource.getRepository(PromptLibrary);

  // Check if prompts already exist
  const existingCount = await promptRepo.count();

  if (existingCount > 0) {
    console.log('Prompts already seeded. Skipping...');
    return;
  }

  console.log('Seeding 50 default prompts...');

  for (const prompt of prompts) {
    const entity = promptRepo.create({
      promptText: prompt.text,
      category: prompt.category,
      isSystemPrompt: true,
      hasPlaceholders: prompt.text.includes('{'),
      placeholderFields: extractPlaceholders(prompt.text),
      isActive: true,
    });

    await promptRepo.save(entity);
  }

  console.log('✅ Seeded 50 prompts successfully!');
}

function extractPlaceholders(text: string): string[] {
  const matches = text.match(/{([^}]+)}/g);
  if (!matches) return [];

  return matches.map((match) => match.replace(/{|}/g, ''));
}
