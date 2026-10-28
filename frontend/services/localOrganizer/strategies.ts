import { AUTRES, TYPE_FAMILIES } from './constants';
import { yearInfoForFile } from './filenameYear';
import { getExt } from './paths';

export type LocalArrangementStrategy =
  | 'by_type'
  | 'by_year'
  | 'by_type_year'
  | 'by_business_rules';

export const LOCAL_ARRANGEMENT_OPTIONS: Array<{
  value: LocalArrangementStrategy;
  label: string;
  helper: string;
}> = [
  {
    value: 'by_business_rules',
    label: 'Classement intelligent (recommandé)',
    helper:
      'Plan institutionnel 01–06 (dont Juridique) + règles GED : chemins contrôlés, le reste → 99_A_Verifier.',
  },
  {
    value: 'by_type',
    label: 'Par type de fichier',
    helper: 'PDF, bureautique, images, etc.',
  },
  {
    value: 'by_year',
    label: 'Par année',
    helper: 'Une année = un dossier (date du fichier).',
  },
  {
    value: 'by_type_year',
    label: 'Par type puis année',
    helper: 'Ex. PDF/2024.',
  },
];

export const familyForFile = (file: File): string => TYPE_FAMILIES[getExt(file.name)] || AUTRES;

export const yearForFile = (file: File): string => yearInfoForFile(file).year;

export const folderPathFor = (file: File, strategy: LocalArrangementStrategy): string => {
  const { year } = yearInfoForFile(file);
  switch (strategy) {
    case 'by_type':
      return familyForFile(file);
    case 'by_year':
      return year;
    case 'by_type_year':
      return `${familyForFile(file)}/${year}`;
    case 'by_business_rules':
      return familyForFile(file);
    default:
      return familyForFile(file);
  }
};
