import { CA_TYPES, calculateGrade } from './resultsConfig';
import { supabase } from '@/lib/supabase';

export function getComment(grade: string): string {
  const map: Record<string, string> = {
    A: 'Excellent',
    A1: 'Excellent',
    B: 'V. Good',
    B2: 'V. Good',
    B3: 'V. Good',
    C: 'Good',
    C4: 'Good',
    C5: 'Credit',
    D: 'Pass',
    D7: 'Pass',
    E8: 'Pass',
    F: 'Poor',
    F9: 'Poor',
  };
  return map[grade] || 'Fair';
}

export function formatPosition(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatName(str: string): string {
  return String(str || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export type PreparedReport = {
  row: any;
  school: any;
  config: (typeof CA_TYPES)[string];
  results: any[];
  totalMarks: number;
  average: number;
  overallGrade: string;
  position: string;
  classSize: number;
  psychomotor: Record<string, any>;
  affective: Record<string, any>;
  attendance: any;
  termDuration: any;
};

export async function prepareReportData(
  studentId: string,
  classId: string,
  term: string,
  session: string
): Promise<PreparedReport> {
  const { data, error } = await supabase
    .from('results')
    .select(`*, students(full_name, student_id, image_url, sex), classes(name)`)
    .match({
      student_id: studentId,
      class_id: classId,
      term,
      session,
    });

  if (error) throw error;
  if (!data?.length) throw { message: 'Result record not found.' };

  const row = data[0];
  const results = Array.isArray(row.results)
    ? row.results
    : typeof row.results === 'string'
    ? JSON.parse(row.results)
    : [];

  const caType = row.ca_type || 'standard_20_20_60';
  const config = CA_TYPES[caType] || CA_TYPES.standard_20_20_60;

  const totalMarks = results.reduce((sum: number, subject: any) => {
    const subjectTotal = config.parts.reduce(
      (t, part) => t + Number(subject[part.key] || 0),
      0
    );
    return sum + subjectTotal;
  }, 0);

  const numSubjects = results.length || 1;
  const maxTotal = numSubjects * 100;
  const average = maxTotal ? Math.round((totalMarks / maxTotal) * 100) : 0;
  const overallGrade = calculateGrade(average);

  // Class position
  const { data: classData } = await supabase
    .from('results')
    .select('student_id, results, ca_type')
    .match({
      class_id: classId,
      term,
      session,
    });

  let classTotals: { student_id: string; total: number }[] = [];
  if (classData?.length) {
    classTotals = classData
      .map((record: any) => {
        const recordResults = Array.isArray(record.results)
          ? record.results
          : typeof record.results === 'string'
          ? JSON.parse(record.results)
          : [];
        const recordConfig =
          CA_TYPES[record.ca_type || 'standard_20_20_60'] ||
          CA_TYPES.standard_20_20_60;
        const total = recordResults.reduce((sum: number, subject: any) => {
          return (
            sum +
            recordConfig.parts.reduce(
              (t, part) => t + Number(subject[part.key] || 0),
              0
            )
          );
        }, 0);
        return { student_id: record.student_id, total };
      })
      .sort((a, b) => b.total - a.total);
  }

  const posIndex =
    classTotals.findIndex((c) => c.student_id === studentId) + 1 || 1;

  // School branding
  let school: any = {
    name: 'School Name',
    motto: 'N/A',
    address: 'Address not set',
    phone_numbers: 'N/A',
    logo_url: null,
    primary_color: '#1a3d7c',
  };
  try {
    const { data: schoolId } = await supabase.rpc('current_user_school_id');
    if (schoolId) {
      const { data: s } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .maybeSingle();
      if (s) school = { ...school, ...s };
    }
    const { data: logo } = await supabase.rpc('get_my_school_logo');
    if (logo) school.logo_url = logo;
  } catch {}

  const psychomotor =
    typeof row.psychomotor_domain === 'string'
      ? JSON.parse(row.psychomotor_domain)
      : row.psychomotor_domain || {};
  const affective =
    typeof row.affective_domain === 'string'
      ? JSON.parse(row.affective_domain)
      : row.affective_domain || {};
  const attendance =
    typeof row.attendance === 'string'
      ? JSON.parse(row.attendance)
      : row.attendance || {};
  const termDuration =
    typeof row.term_duration === 'string'
      ? JSON.parse(row.term_duration)
      : row.term_duration || {};

  return {
    row,
    school,
    config,
    results,
    totalMarks,
    average,
    overallGrade,
    position: formatPosition(posIndex),
    classSize: classTotals.length || 1,
    psychomotor,
    affective,
    attendance,
    termDuration,
  };
}

/** Build printable HTML (for web window.print) — simplified report sheet */
export function buildPrintableHTML(report: PreparedReport): string {
  const {
    row,
    school,
    config,
    results,
    totalMarks,
    average,
    overallGrade,
    position,
    classSize,
    psychomotor,
    affective,
    attendance,
    termDuration,
  } = report;

  const primary = school.primary_color || '#1a3d7c';
  const name = (row.students?.full_name || 'Student').toUpperCase();

  const subjectRows = results
    .map((subject: any) => {
      let total = 0;
      const cells = config.parts
        .map((part) => {
          const v = Number(subject[part.key] || 0);
          total += v;
          return `<td style="text-align:center;padding:4px;border:1px solid #ccc;">${v}</td>`;
        })
        .join('');
      const grade = calculateGrade(total);
      return `<tr>
        <td style="padding:4px;border:1px solid #ccc;">${subject.subject_name || ''}</td>
        ${cells}
        <td style="text-align:center;padding:4px;border:1px solid #ccc;font-weight:700;">${total}</td>
        <td style="text-align:center;padding:4px;border:1px solid #ccc;">${grade}</td>
        <td style="padding:4px;border:1px solid #ccc;font-style:italic;">${getComment(grade)}</td>
      </tr>`;
    })
    .join('');

  const caHeaders = config.parts
    .map(
      (p) =>
        `<th style="padding:4px;border:1px solid #ccc;background:${primary};color:#fff;font-size:11px;">${p.label}</th>`
    )
    .join('');

  const domainRows = (obj: Record<string, any>) =>
    Object.entries(obj || {})
      .map(([k, score]) => {
        const cols = [100, 85, 75, 65, 55]
          .map(
            (val) =>
              `<td style="text-align:center;border:1px solid #ccc;padding:3px;">${
                Number(score) === val ? '✔' : ''
              }</td>`
          )
          .join('');
        return `<tr><td style="border:1px solid #ccc;padding:3px;">${formatName(
          k
        )}</td>${cols}</tr>`;
      })
      .join('') ||
    '<tr><td colspan="6" style="padding:4px;border:1px solid #ccc;">No data</td></tr>';

  return `<!DOCTYPE html>
<html><head><title>Report - ${name}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
  body{font-family:'Plus Jakarta Sans',sans-serif;margin:0;padding:12mm;color:#222;}
  .card{border:2px solid ${primary};outline:4px double ${primary};outline-offset:-8px;padding:12px;position:relative;}
  .header{display:flex;align-items:center;gap:12px;border-bottom:2px solid ${primary};padding-bottom:10px;margin-bottom:10px;}
  .logo{width:70px;height:70px;border:1px solid ${primary};object-fit:contain;background:#fff;}
  .school-name{font-family:'Space Grotesk',sans-serif;font-size:18px;margin:0;text-transform:uppercase;letter-spacing:1px;}
  .motto{font-size:11px;font-style:italic;margin:2px 0;}
  .address{font-size:10px;margin:0;text-transform:uppercase;}
  .banner{background:${primary};color:#fff;text-align:center;padding:6px;font-weight:700;font-size:12px;margin:10px 0;}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:12px;}
  .info .label{font-size:10px;color:#666;font-weight:600;}
  .info .value{font-weight:700;text-transform:uppercase;}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;}
  th{padding:4px;border:1px solid #ccc;background:${primary};color:#fff;}
  .section{font-weight:700;color:${primary};margin:10px 0 4px;font-size:12px;}
  .comments{font-size:11px;margin-top:8px;}
  .no-print{text-align:center;margin-bottom:12px;}
  .no-print button{padding:10px 24px;background:${primary};color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;}
  @media print{.no-print{display:none;} body{padding:0;}}
</style></head><body>
<div class="no-print"><button onclick="window.print()">Print Report</button></div>
<div class="card">
  <div class="header">
    ${
      school.logo_url
        ? `<img class="logo" src="${school.logo_url}" alt="Logo"/>`
        : `<div class="logo"></div>`
    }
    <div style="flex:1;text-align:center;">
      <h1 class="school-name">${school.name || 'School Name'}</h1>
      <div class="motto">MOTTO: ${school.motto || 'N/A'}</div>
      <p class="address">${school.address || ''}</p>
      <p class="address">TEL: ${school.phone_numbers || 'N/A'}</p>
    </div>
  </div>
  <div class="banner">CONTINUOUS ASSESSMENT REPORT</div>
  <div class="info">
    <div><div class="label">Name</div><div class="value">${name}</div></div>
    <div><div class="label">Student ID</div><div class="value">${
      row.students?.student_id || 'N/A'
    }</div></div>
    <div><div class="label">Class</div><div class="value">${
      row.classes?.name || 'N/A'
    }</div></div>
    <div><div class="label">Term / Session</div><div class="value">${
      row.term
    } / ${row.session}</div></div>
    <div><div class="label">Gender</div><div class="value">${
      row.gender || row.students?.sex || 'N/A'
    }</div></div>
    <div><div class="label">Position</div><div class="value">${position} of ${classSize}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Subjects</th>
        ${caHeaders}
        <th>Total</th><th>Grade</th><th>Comments</th>
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
      <tr style="font-weight:700;background:#f1f5f9;">
        <td style="padding:4px;border:1px solid #ccc;">Overall Total</td>
        <td colspan="${config.parts.length}" style="text-align:center;border:1px solid #ccc;">${totalMarks}</td>
        <td style="text-align:center;border:1px solid #ccc;">${average}%</td>
        <td style="text-align:center;border:1px solid #ccc;">${overallGrade}</td>
        <td style="border:1px solid #ccc;font-style:italic;">${getComment(
          overallGrade
        )}</td>
      </tr>
    </tbody>
  </table>
  <div class="section">Psychomotor Domain</div>
  <table>
    <thead><tr><th style="text-align:left;">Activity</th><th>100</th><th>85</th><th>75</th><th>65</th><th>55</th></tr></thead>
    <tbody>${domainRows(psychomotor)}</tbody>
  </table>
  <div class="section">Affective Domain</div>
  <table>
    <thead><tr><th style="text-align:left;">Trait</th><th>100</th><th>85</th><th>75</th><th>65</th><th>55</th></tr></thead>
    <tbody>${domainRows(affective)}</tbody>
  </table>
  <div class="section">Attendance</div>
  <div class="info">
    <div><div class="label">Days Opened</div><div class="value">${
      attendance.days_opened ?? '—'
    }</div></div>
    <div><div class="label">Days Present</div><div class="value">${
      attendance.days_present ?? '—'
    }</div></div>
    <div><div class="label">Days Absent</div><div class="value">${
      attendance.days_absent ?? '—'
    }</div></div>
  </div>
  <div class="comments">
    <p><strong>Teacher's Comment:</strong> ${row.teacher_comment || '—'}</p>
    <p><strong>Headmaster's Comment:</strong> ${
      row.headmaster_comment || '—'
    }</p>
    <p style="font-size:10px;color:#666;">Term: ${
      termDuration.term_begins || '—'
    } → ${termDuration.term_ends || '—'} · Next term: ${
    termDuration.next_term_begins || '—'
  }</p>
  </div>
</div>
</body></html>`;
}

export function printReport(report: PreparedReport) {
  if (typeof window === 'undefined') return;
  const html = buildPrintableHTML(report);
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
  if (!w) {
    throw { message: 'Pop-up blocked. Allow pop-ups to print the report.' };
  }
  w.document.write(html);
  w.document.close();
  // Give fonts a moment then print
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {}
  }, 400);
}
