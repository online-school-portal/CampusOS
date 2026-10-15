import { CA_TYPES } from './resultsConfig';
import { supabase } from '@/lib/supabase';

/** Same scale as web manage-results report */
export function calculateReportGrade(total: number): string {
  if (total >= 70) return 'A1';
  if (total >= 65) return 'B2';
  if (total >= 60) return 'B3';
  if (total >= 55) return 'C4';
  if (total >= 50) return 'C5';
  if (total >= 45) return 'D7';
  if (total >= 40) return 'E8';
  return 'F9';
}

export function getComment(grade: string): string {
  const map: Record<string, string> = {
    A1: 'Excellent',
    B2: 'V. Good',
    B3: 'V. Good',
    C4: 'Good',
    C5: 'Credit',
    D7: 'Pass',
    E8: 'Pass',
    F9: 'Poor',
    A: 'Excellent',
    B: 'V. Good',
    C: 'Good',
    D: 'Pass',
    F: 'Poor',
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

function U(v: any): string {
  const value =
    v === null || v === undefined || v === '' ? 'N/A' : String(v);
  return value.toUpperCase();
}

function lightenColor(hex: string, percent: number): string {
  hex = (hex || '#1a3d7c').replace('#', '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.round(r + (255 - r) * percent);
  g = Math.round(g + (255 - g) * percent);
  b = Math.round(b + (255 - b) * percent);
  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

function getAttendanceInsight(present: number, total: number): string {
  if (!present || !total || total === 0) {
    return 'Attendance data not available for this term.';
  }
  const percent = (present / total) * 100;
  if (percent >= 95) {
    return `Excellent attendance record with over ${percent.toFixed(1)}% presence.`;
  }
  if (percent >= 80) {
    return `Good attendance record with ${percent.toFixed(1)}% presence.`;
  }
  if (percent >= 60) {
    return `Fair attendance record with ${percent.toFixed(1)}% presence. Improvement is needed.`;
  }
  return `Poor attendance record with ${percent.toFixed(1)}% presence. Serious improvement is required.`;
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
  html: string;
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
    return (
      sum +
      config.parts.reduce((t, part) => t + Number(subject[part.key] || 0), 0)
    );
  }, 0);

  const numSubjects = results.length || 1;
  const maxTotal = numSubjects * 100;
  const average = maxTotal ? Math.round((totalMarks / maxTotal) * 100) : 0;
  const overallGrade = calculateReportGrade(average);

  const { data: classData } = await supabase
    .from('results')
    .select('student_id, results, ca_type')
    .match({ class_id: classId, term, session });

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
  const position = formatPosition(posIndex);
  const classSize = classTotals.length || 1;

  // School — prefer row.school_id like web
  let school: any = {
    name: 'Your School Name',
    motto: 'MOTTO',
    address: 'Address not set',
    phone_numbers: 'N/A',
    logo_url: null,
    headmaster_signature_url: null,
    primary_color: '#1a3d7c',
  };

  try {
    if (row.school_id) {
      const { data: s } = await supabase
        .from('schools')
        .select('*')
        .eq('id', row.school_id)
        .maybeSingle();
      if (s) school = { ...school, ...s };
    } else {
      const { data: schoolId } = await supabase.rpc('current_user_school_id');
      if (schoolId) {
        const { data: s } = await supabase
          .from('schools')
          .select('*')
          .eq('id', schoolId)
          .maybeSingle();
        if (s) school = { ...school, ...s };
      }
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

  const prepared: PreparedReport = {
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
    html: '',
  };

  prepared.html = buildWebReportHTML(prepared);
  return prepared;
}

/** Exact web report stylesheet + structure */
export function buildWebReportHTML(report: PreparedReport): string {
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
  const primaryLight = lightenColor(primary, 0.72);
  const primaryLighter = lightenColor(primary, 0.88);
  const isCompact = results.length > 15;

  const daysOpened = attendance.days_opened ?? 0;
  const daysPresent = attendance.days_present ?? 0;
  const daysAbsent = attendance.days_absent ?? 0;
  const termBegins = termDuration.term_begins || '';
  const termEnds = termDuration.term_ends || '';
  const nextTermBegins = termDuration.next_term_begins || '';
  const teacherComment = row.teacher_comment || '';
  const headmasterComment = row.headmaster_comment || '';

  const theadHtml = `
    <thead>
      <tr>
        <th rowspan="2" style="text-align:left;">Subjects</th>
        <th colspan="${config.parts.length}">Continuous Assessment</th>
        <th rowspan="2">Total</th>
        <th rowspan="2">Grade</th>
        <th rowspan="2">Comments</th>
      </tr>
      <tr class="sub-head">
        ${config.parts.map((p) => `<th>${p.label}</th>`).join('')}
      </tr>
    </thead>`;

  const rowsHtml = results
    .map((subject: any) => {
      let total = 0;
      const caCells = config.parts
        .map((part) => {
          const value = Number(subject[part.key] || 0);
          total += value;
          return `<td>${value}</td>`;
        })
        .join('');
      const grade = calculateReportGrade(total);
      return `<tr>
        <td class="domain-label">${subject.subject_name || ''}</td>
        ${caCells}
        <td class="domain-label">${total}</td>
        <td>${grade}</td>
        <td class="italic">${getComment(grade)}</td>
      </tr>`;
    })
    .join('');

  const summaryRowHtml = `
    <tr class="dy-summary-row">
      <td>Overall Total</td>
      <td colspan="${config.parts.length}">${totalMarks}</td>
      <td>${average}%</td>
      <td>${overallGrade}</td>
      <td class="italic">${getComment(overallGrade)}</td>
    </tr>`;

  const domainRows = (obj: Record<string, any>) => {
    const entries = Object.entries(obj || {});
    if (!entries.length) {
      return `<tr><td colspan="6" class="text-center">No data</td></tr>`;
    }
    return entries
      .map(([activity, score]) => {
        const cols = [100, 85, 75, 65, 55]
          .map((val) => `<td>${Number(score) === val ? '✔' : ''}</td>`)
          .join('');
        return `<tr>
          <td class="domain-label">${formatName(activity)}</td>
          ${cols}
        </tr>`;
      })
      .join('');
  };

  const insight = getAttendanceInsight(
    Number(daysPresent) || 0,
    Number(daysOpened) || 0
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Report - ${row.students?.full_name || 'Student'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
:root{
  --primary-color:${primary};
  --primary-light:${primaryLight};
  --primary-lighter:${primaryLighter};
}
*{box-sizing:border-box;}
body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #e0e0e0;
  margin: 0;
  padding: 10px;
  color: #000;
}
.report-card {
  background:
    linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.92)),
    repeating-linear-gradient(0deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 1px, transparent 1px, transparent 3px);
  width: 190mm;
  max-width: 100%;
  min-height: 277mm;
  overflow: visible;
  margin: auto;
  padding: 6mm;
  box-sizing: border-box;
  border: 2px solid var(--primary-color);
  outline: 4px double var(--primary-color);
  outline-offset: -8px;
  position: relative;
  box-shadow: 0 0 10px rgba(0,0,0,0.15);
}
.report-card::before {
  content: "";
  position: absolute;
  width: 300px;
  height: 300px;
  border: 8px double color-mix(in srgb, var(--primary-color) 8%, transparent);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 0;
  pointer-events: none;
}
.report-card > * { position: relative; z-index: 1; }
.header-container {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  border-bottom: 2px solid var(--primary-color);
  padding-bottom: 10px;
}
.logo {
  width: 80px;
  height: 80px;
  border: 1px solid var(--primary-color);
  background: #fff;
  flex-shrink: 0;
}
.logo img { width: 100%; height: 100%; object-fit: contain; }
.serial-number {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 11px;
  font-weight: bold;
  color: #000;
  letter-spacing: 1px;
  background: rgba(255,255,255,0.7);
  padding: 2px 6px;
  border: 1px solid #000;
}
.header-text { text-align: center; flex: 1; }
.school-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 20px;
  font-weight: 800;
  margin: 0;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 2px;
  line-height: 1.2;
}
.motto {
  font-size: 12px;
  font-weight: bold;
  font-style: italic;
  margin: 2px 0;
  color: #444;
}
.address {
  font-size: 11px;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #444;
}
.report-banner {
  background: var(--primary-color);
  color: white;
  padding: 6px;
  font-weight: bold;
  font-size: 12px;
  margin: 15px 0;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 2px;
  border-top: 2px solid var(--primary-color);
  border-bottom: 2px solid var(--primary-color);
}
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1.5px solid var(--primary-color);
  margin-bottom: 15px;
  background: rgba(255,255,255,0.75);
}
.info-item {
  display: flex;
  border-right: 1px solid var(--primary-color);
  border-bottom: 1px solid var(--primary-color);
}
.label {
  width: 120px;
  padding: 3px 5px;
  font-weight: bold;
  font-size: 10px;
  background: var(--primary-lighter);
  border-right: 1px solid var(--primary-color);
  text-transform: uppercase;
  color: var(--primary-color);
}
.value {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  margin-bottom: 15px;
  background: white;
}
th, td {
  border: 1.5px solid var(--primary-color);
  padding: 3px;
}
th {
  background: var(--primary-light);
  color: var(--primary-color);
  text-transform: uppercase;
}
.sub-head th { background: var(--primary-lighter); }
td { text-align: center; font-weight: 600; }
td:first-child, .domain-label { text-align: left; }
tbody tr:nth-child(even) { background: var(--primary-lighter); }
.italic { font-style: italic; }
.columns { display: flex; gap: 15px; }
.left-col { flex: 2.2; }
.right-col { flex: 1; }
.section-title {
  background: var(--primary-color);
  color: white;
  font-size: 11px;
  font-weight: bold;
  text-align: center;
  padding: 4px;
  text-transform: uppercase;
}
.attendance-insight {
  font-size: 11px;
  padding: 10px 12px;
  border: 1.5px solid var(--primary-color);
  background: rgba(255, 255, 255, 0.85);
  text-align: center;
  line-height: 1.4;
  margin-top: 2px;
  margin-bottom: 10px;
  font-style: italic;
  font-weight: 600;
  letter-spacing: 0.2px;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 10%, transparent);
  position: relative;
}
.attendance-insight::before {
  content: "REMARK";
  position: absolute;
  top: -7px;
  left: 10px;
  background: #fff;
  padding: 0 5px;
  font-size: 9px;
  font-weight: bold;
  color: var(--primary-color);
  letter-spacing: 1px;
}
.comment-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1.5px solid var(--primary-color);
  font-weight: bold;
}
.comment-box {
  padding: 8px;
  border-right: 1.5px solid var(--primary-color);
  font-size: 10px;
  min-height: 60px;
  background: #fff;
}
.comment-box:last-child { border-right: none; }
.signature-area {
  border-top: 2px solid var(--primary-color);
  padding: 10px;
  text-align: center;
  font-size: 11px;
  background: rgba(255,255,255,0.6);
  margin-top: 10px;
}
.dy-summary-row { font-weight: 800; background: var(--primary-lighter) !important; }
.no-print { text-align: center; padding: 16px; }
.no-print button {
  display: inline-block;
  padding: 10px 25px;
  border: none;
  font-weight: bold;
  border-radius: 4px;
  cursor: pointer;
  background: var(--primary-color);
  color: #fff;
}
.report-card.compact table { font-size: 9.2px; }
.report-card.compact th, .report-card.compact td { padding: 2px 3px; line-height: 1.15; }
@media print {
  body { background: white !important; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report-card { box-shadow: none; width: 100%; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 10mm; }
}
@media (max-width: 700px) {
  .columns { flex-direction: column; }
  .info-grid { grid-template-columns: 1fr; }
  .label { width: 100px; }
  .school-name { font-size: 14px; letter-spacing: 1px; }
  .report-card { width: 100%; min-height: auto; outline-offset: -4px; }
}
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">PRINT REPORT CARD</button>
  </div>

  <div class="report-card ${isCompact ? 'compact' : ''}">
    <div class="header-container">
      <div class="logo">
        ${
          school.logo_url
            ? `<img src="${school.logo_url}" alt="School Logo">`
            : ''
        }
      </div>
      <div class="header-text">
        <h1 class="school-name">${school.name || 'School Name'}</h1>
        <div class="motto">MOTTO: ${school.motto || 'N/A'}</div>
        <p class="address">${school.address || 'Address not set'}</p>
        <p class="address" style="font-weight:bold;">TEL: ${
          school.phone_numbers || school.phone || 'N/A'
        }</p>
      </div>
      <div class="serial-number">SN: ${row.serial_number || '---'}</div>
    </div>

    <div class="report-banner">CONTINUOUS ASSESSMENT REPORT</div>

    <div class="info-grid">
      <div class="info-item"><div class="label">Name</div><div class="value">${U(
        row.students?.full_name
      )}</div></div>
      <div class="info-item"><div class="label">Student ID</div><div class="value">${U(
        row.students?.student_id || row.student_id
      )}</div></div>
      <div class="info-item"><div class="label">Class</div><div class="value">${U(
        row.classes?.name || 'N/A'
      )}</div></div>
      <div class="info-item"><div class="label">Gender</div><div class="value">${U(
        row.gender || row.students?.sex || 'N/A'
      )}</div></div>
      <div class="info-item"><div class="label">Term</div><div class="value">${U(
        row.term
      )}</div></div>
      <div class="info-item"><div class="label">Academic Session</div><div class="value">${U(
        row.session || 'N/A'
      )}</div></div>
      <div class="info-item"><div class="label">No. in Class</div><div class="value">${U(
        classSize
      )}</div></div>
      <div class="info-item"><div class="label">Position</div><div class="value">${U(
        position
      )}</div></div>
    </div>

    <div style="display:flex;gap:15px;flex-wrap:wrap;">
      <div style="flex:1;min-width:220px;">
        <div class="section-title">Attendance</div>
        <table>
          <thead><tr><th>Days Opened</th><th>Days Present</th><th>Days Absent</th></tr></thead>
          <tbody style="text-align:center;"><tr>
            <td>${U(daysOpened)}</td><td>${U(daysPresent)}</td><td>${U(
    daysAbsent
  )}</td>
          </tr></tbody>
        </table>
        <div class="attendance-insight">${insight}</div>
      </div>
      <div style="flex:1;min-width:220px;">
        <div class="section-title">Terminal Duration</div>
        <table>
          <thead><tr><th>Term Begins</th><th>Term Ends</th><th>Next Term</th></tr></thead>
          <tbody style="text-align:center;"><tr>
            <td>${U(termBegins)}</td><td>${U(termEnds)}</td><td>${U(
    nextTermBegins
  )}</td>
          </tr></tbody>
        </table>
      </div>
    </div>

    <div class="columns">
      <div class="left-col">
        <div class="section-title">Academic Progress Summaries (Cognitive)</div>
        <table>
          ${theadHtml}
          <tbody>
            ${rowsHtml}
            ${summaryRowHtml}
          </tbody>
        </table>

        <div class="comment-section">
          <div class="comment-box">
            <strong>TEACHER'S COMMENT:</strong><br>${U(teacherComment || '...')}
          </div>
          <div class="comment-box">
            <strong>HEADMASTER'S COMMENT:</strong><br>${U(
              headmasterComment || '...'
            )}
          </div>
        </div>

        <div class="signature-area">
          <strong>HEADMASTER'S SIGNATURE:</strong>
          <div style="margin-top:10px;display:flex;flex-direction:column;align-items:center;">
            ${
              school.headmaster_signature_url
                ? `<img src="${school.headmaster_signature_url}" alt="Signature" style="height:50px;max-width:150px;object-fit:contain;display:block;" />`
                : ''
            }
            <div style="border-top:1px solid #000;width:200px;margin-top:5px;"></div>
          </div>
        </div>
      </div>

      <div class="right-col">
        <div class="section-title">Affective Domain</div>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">Behaviour</th>
              <th>100</th><th>85</th><th>75</th><th>65</th><th>55</th>
            </tr>
          </thead>
          <tbody>${domainRows(affective)}</tbody>
        </table>

        <div class="section-title">Psychomotor Domain</div>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">Activities</th>
              <th>100</th><th>85</th><th>75</th><th>65</th><th>55</th>
            </tr>
          </thead>
          <tbody>${domainRows(psychomotor)}</tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function printReport(report: PreparedReport) {
  if (typeof window === 'undefined') return;
  const html = report.html || buildWebReportHTML(report);
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
  if (!w) {
    throw { message: 'Pop-up blocked. Allow pop-ups to print the report.' };
  }
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {}
  }, 400);
}
