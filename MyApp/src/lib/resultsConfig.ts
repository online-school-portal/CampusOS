/** Continuous Assessment configs — same as web dashboardScript.js */
export const CA_TYPES: Record<
  string,
  { label: string; parts: { key: string; label: string; max: number }[] }
> = {
  standard_20_20_60: {
    label: '1st Test 20 • 2nd Test 20 • Exam 60',
    parts: [
      { key: 'test1', label: '1st Test', max: 20 },
      { key: 'test2', label: '2nd Test', max: 20 },
      { key: 'exam', label: 'Exam', max: 60 },
    ],
  },
  test10_test20_exam70: {
    label: '1st Test 10 • 2nd Test 20 • Exam 70',
    parts: [
      { key: 'test1', label: '1st Test', max: 10 },
      { key: 'test2', label: '2nd Test', max: 20 },
      { key: 'exam', label: 'Exam', max: 70 },
    ],
  },
  four_ca_exam60: {
    label: 'CA1 10 • CA2 10 • CA3 10 • CA4 10 • Exam 60',
    parts: [
      { key: 'ca1', label: 'CA 1', max: 10 },
      { key: 'ca2', label: 'CA 2', max: 10 },
      { key: 'ca3', label: 'CA 3', max: 10 },
      { key: 'ca4', label: 'CA 4', max: 10 },
      { key: 'exam', label: 'Exam', max: 60 },
    ],
  },
  test15_test15_exam70: {
    label: '1st Test 15 • 2nd Test 15 • Exam 70',
    parts: [
      { key: 'test1', label: '1st Test', max: 15 },
      { key: 'test2', label: '2nd Test', max: 15 },
      { key: 'exam', label: 'Exam', max: 70 },
    ],
  },
  test40_exam60: {
    label: 'Test 40 • Exam 60',
    parts: [
      { key: 'test1', label: 'Test', max: 40 },
      { key: 'exam', label: 'Exam', max: 60 },
    ],
  },
  test30_exam70: {
    label: 'Test 30 • Exam 70',
    parts: [
      { key: 'test1', label: 'Test', max: 30 },
      { key: 'exam', label: 'Exam', max: 70 },
    ],
  },
};

export const TERMS = ['First Term', 'Second Term', 'Third Term'];

export const SESSIONS = ['2025/2026', '2026/2027', '2027/2028'];

export const DOMAIN_SCORES = [100, 85, 75, 65, 55];

export const PSYCHOMOTOR_TRAITS = [
  { key: 'handwriting', label: 'Handwriting' },
  { key: 'sports', label: 'Sports' },
  { key: 'games', label: 'Games' },
  { key: 'crafts', label: 'Crafts' },
  { key: 'handling_of_tools', label: 'Handling of Tools' },
];

export const AFFECTIVE_TRAITS = [
  { key: 'politeness', label: 'Politeness' },
  { key: 'responsibility', label: 'Responsibility' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'honesty', label: 'Honesty' },
  { key: 'creativity', label: 'Creativity' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'obedience', label: 'Obedience' },
  { key: 'neatness', label: 'Neatness' },
  { key: 'sociability', label: 'Sociability' },
];

export function calculateGrade(total: number): string {
  if (total >= 70) return 'A';
  if (total >= 60) return 'B';
  if (total >= 50) return 'C';
  if (total >= 45) return 'D';
  return 'F';
}
