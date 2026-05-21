export type AtsName = 'greenhouse' | 'lever' | 'ashby';

export type CompanyTarget = {
  companyName: string;
  ats: AtsName;
  slug: string;
  careersUrl?: string;
};

export const companyTargets: CompanyTarget[] = [
  {
    companyName: 'GitLab',
    ats: 'greenhouse',
    slug: 'gitlab',
    careersUrl: 'https://job-boards.greenhouse.io/gitlab',
  },
  {
    companyName: 'Kepler Communications',
    ats: 'lever',
    slug: 'kepler',
    careersUrl: 'https://jobs.lever.co/kepler',
  },
  {
    companyName: 'Ashby',
    ats: 'ashby',
    slug: 'ashby',
    careersUrl: 'https://jobs.ashbyhq.com/ashby',
  },
];

export function getCompanyTargetsByAts(ats: AtsName): CompanyTarget[] {
  return companyTargets.filter((target) => target.ats === ats);
}
