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

/** Web dashboard getHeadmasterComment */
export function getHeadmasterComment(grade: string, _average?: number): string {
  if (!grade) return 'Requires Attention';
  const map: Record<string, string> = {
    A1: 'Outstanding performance. Keep it up.',
    B2: 'Excellent performance with minor areas to improve.',
    B3: 'Very good performance. Continue improving consistency.',
    C4: 'Good performance but can do better with more effort.',
    C5: 'Fair performance. Needs more dedication.',
    D7: 'Below average. Significant improvement required.',
    E8: 'Weak performance. Extra academic support needed.',
    F9: 'Poor performance. Immediate intervention required.',
  };
  return map[grade] || 'Performance needs review.';
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
  teacherComment: string;
  headmasterComment: string;
  /** Mobile on-screen HTML */
  html: string;
  /** A4 print / PDF HTML (web layout) */
  printHtml: string;
};

export function resultKey(item: {
  student_id: string;
  class_id: string;
  term: string;
  session: string;
}): string {
  return `${item.student_id}|${item.class_id}|${item.term}|${item.session}`;
}

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

  const teacherComment = row.teacher_comment?.trim() || 'N/A';
  const headmasterComment = row.headmaster_comment?.trim()
    ? row.headmaster_comment
    : getHeadmasterComment(overallGrade, average);

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
    teacherComment,
    headmasterComment,
    html: '',
    printHtml: '',
  };

  prepared.html = buildMobileReportHTML(prepared);
  prepared.printHtml = buildPrintReportHTML(prepared);
  return prepared;
}

function domainRowsHtml(obj: Record<string, any>): string {
  const entries = Object.entries(obj || {});
  if (!entries.length) {
    return `<tr><td colspan="6" style="text-align:center;">No data</td></tr>`;
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
}

function subjectRowsHtml(
  results: any[],
  config: (typeof CA_TYPES)[string]
): { rows: string; summary: string; thead: string } {
  const thead = `
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

  let totalMarks = 0;
  const rows = results
    .map((subject: any) => {
      let total = 0;
      const caCells = config.parts
        .map((part) => {
          const value = Number(subject[part.key] || 0);
          total += value;
          return `<td>${value}</td>`;
        })
        .join('');
      totalMarks += total;
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

  const numSubjects = results.length || 1;
  const average = Math.round((totalMarks / (numSubjects * 100)) * 100);
  const overallGrade = calculateReportGrade(average);

  const summary = `
    <tr class="dy-summary-row">
      <td>Overall Total</td>
      <td colspan="${config.parts.length}">${totalMarks}</td>
      <td>${average}%</td>
      <td>${overallGrade}</td>
      <td class="italic">${getComment(overallGrade)}</td>
    </tr>`;

  return { rows, summary, thead };
}

/** Shared A4 print CSS (web dashboard style) */
function getPrintStyles(primary: string): string {
  const primaryLight = lightenColor(primary, 0.72);
  const primaryLighter = lightenColor(primary, 0.88);
  return `
:root{
  --primary-color:${primary};
  --primary-light:${primaryLight};
  --primary-lighter:${primaryLighter};
}
*{box-sizing:border-box;}
body{
  font-family:'Plus Jakarta Sans',sans-serif;
  background:#e0e0e0;
  margin:0;
  padding:10px;
  color:#000;
}
.report-card{
  background:linear-gradient(rgba(255,255,255,0.92),rgba(255,255,255,0.92)),
    repeating-linear-gradient(0deg,rgba(0,0,0,0.015) 0px,rgba(0,0,0,0.015) 1px,transparent 1px,transparent 3px);
  width:190mm;
  height:277mm;
  overflow:hidden;
  margin:auto;
  padding:5mm;
  border:2px solid var(--primary-color);
  outline:4px double var(--primary-color);
  outline-offset:-8px;
  position:relative;
  box-shadow:0 0 10px rgba(0,0,0,0.15);
  page-break-after:always;
  break-after:page;
}
.report-card:last-child{
  page-break-after:auto;
  break-after:auto;
}
.report-card::before{
  content:"";
  position:absolute;
  width:280px;height:280px;
  border:8px double color-mix(in srgb,var(--primary-color) 8%,transparent);
  border-radius:50%;
  top:50%;left:50%;
  transform:translate(-50%,-50%);
  z-index:0;pointer-events:none;
}
.report-card>*{position:relative;z-index:1;}
.header-container{
  display:flex;align-items:center;gap:6px;
  margin-bottom:6px;
  border-bottom:2px solid var(--primary-color);
  padding-bottom:6px;
}
.logo{width:64px;height:64px;border:1px solid var(--primary-color);background:#fff;flex-shrink:0;}
.logo img{width:100%;height:100%;object-fit:contain;}
.serial-number{
  position:absolute;top:6px;right:10px;
  font-size:10px;font-weight:bold;letter-spacing:1px;
  background:rgba(255,255,255,0.85);padding:2px 6px;border:1px solid #000;
}
.header-text{text-align:center;flex:1;padding:0 28px;}
.school-name{
  font-family:'Space Grotesk',sans-serif;
  font-size:16px;font-weight:800;margin:0;
  color:#444;text-transform:uppercase;letter-spacing:1.5px;line-height:1.15;
}
.motto{font-size:10px;font-weight:bold;font-style:italic;margin:1px 0;color:#444;}
.address{font-size:9px;margin:0;text-transform:uppercase;letter-spacing:0.4px;color:#444;}
.report-banner{
  background:var(--primary-color);color:#fff;padding:4px;
  font-weight:bold;font-size:11px;margin:8px 0;text-align:center;
  text-transform:uppercase;letter-spacing:1.5px;
}
.info-grid{
  display:grid;grid-template-columns:1fr 1fr;
  border:1.5px solid var(--primary-color);
  margin-bottom:8px;background:rgba(255,255,255,0.75);
}
.info-item{display:flex;border-right:1px solid var(--primary-color);border-bottom:1px solid var(--primary-color);}
.label{
  width:100px;padding:2px 4px;font-weight:bold;font-size:9px;
  background:var(--primary-lighter);border-right:1px solid var(--primary-color);
  text-transform:uppercase;color:var(--primary-color);
}
.value{padding:2px 6px;font-size:10px;font-weight:600;}
table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:6px;background:#fff;}
th,td{border:1.2px solid var(--primary-color);padding:2px;}
th{background:var(--primary-light);color:var(--primary-color);text-transform:uppercase;}
.sub-head th{background:var(--primary-lighter);}
td{text-align:center;font-weight:600;}
td:first-child,.domain-label{text-align:left;}
tbody tr:nth-child(even){background:var(--primary-lighter);}
.italic{font-style:italic;}
.columns{display:flex;gap:10px;}
.left-col{flex:2.2;}
.right-col{flex:1;}
.section-title{
  background:var(--primary-color);color:#fff;font-size:10px;font-weight:bold;
  text-align:center;padding:3px;text-transform:uppercase;
}
.attendance-insight{
  font-size:9px;padding:6px 8px;border:1.2px solid var(--primary-color);
  background:rgba(255,255,255,0.85);text-align:center;line-height:1.3;
  margin-top:2px;margin-bottom:6px;font-style:italic;font-weight:600;
  position:relative;
}
.attendance-insight::before{
  content:"REMARK";position:absolute;top:-6px;left:8px;
  background:#fff;padding:0 4px;font-size:8px;font-weight:bold;
  color:var(--primary-color);letter-spacing:1px;
}
.comment-section{
  display:grid;grid-template-columns:1fr 1fr;
  border:1.2px solid var(--primary-color);font-weight:bold;
}
.comment-box{
  padding:5px;border-right:1.2px solid var(--primary-color);
  font-size:9px;min-height:42px;background:#fff;
}
.comment-box:last-child{border-right:none;}
.signature-area{
  border-top:1.5px solid var(--primary-color);padding:6px;
  text-align:center;font-size:10px;margin-top:6px;
}
.dy-summary-row{font-weight:800;background:var(--primary-lighter)!important;}
.no-print{text-align:center;padding:16px;}
.no-print button{
  display:inline-block;padding:10px 24px;border:none;font-weight:bold;
  border-radius:4px;cursor:pointer;background:var(--primary-color);color:#fff;
}
.compact table{font-size:8.5px;}
.compact th,.compact td{padding:1.5px 2px;}
@media print{
  body{background:#fff!important;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .report-card{box-shadow:none;width:100%;height:auto;min-height:270mm;outline-offset:-6px;}
  .no-print{display:none!important;}
  @page{size:A4;margin:8mm;}
}
`;
}

/** A4 / PDF layout — same structure as web dashboard */
export function buildPrintReportHTML(
  report: PreparedReport,
  options?: { cardOnly?: boolean }
): string {
  const {
    row,
    school,
    config,
    results,
    position,
    classSize,
    psychomotor,
    affective,
    attendance,
    termDuration,
    teacherComment,
    headmasterComment,
  } = report;

  const primary = school.primary_color || '#1a3d7c';
  const isCompact = results.length > 14;
  const { rows, summary, thead } = subjectRowsHtml(results, config);

  const daysOpened = attendance.days_opened ?? 0;
  const daysPresent = attendance.days_present ?? 0;
  const daysAbsent = attendance.days_absent ?? 0;
  const insight = getAttendanceInsight(
    Number(daysPresent) || 0,
    Number(daysOpened) || 0
  );

  const card = `
  <div class="report-card ${isCompact ? 'compact' : ''}">
    <div class="header-container">
      <div class="logo">
        ${school.logo_url ? `<img src="${school.logo_url}" alt="Logo">` : ''}
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
    <div style="display:flex;gap:10px;">
      <div style="flex:1;">
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
      <div style="flex:1;">
        <div class="section-title">Terminal Duration</div>
        <table>
          <thead><tr><th>Term Begins</th><th>Term Ends</th><th>Next Term</th></tr></thead>
          <tbody style="text-align:center;"><tr>
            <td>${U(termDuration.term_begins)}</td>
            <td>${U(termDuration.term_ends)}</td>
            <td>${U(termDuration.next_term_begins)}</td>
          </tr></tbody>
        </table>
      </div>
    </div>
    <div class="columns">
      <div class="left-col">
        <div class="section-title">Academic Progress Summaries (Cognitive)</div>
        <table>${thead}<tbody>${rows}${summary}</tbody></table>
        <div class="comment-section">
          <div class="comment-box"><strong>TEACHER'S COMMENT:</strong><br>${U(
            teacherComment
          )}</div>
          <div class="comment-box"><strong>HEADMASTER'S COMMENT:</strong><br>${U(
            headmasterComment
          )}</div>
        </div>
        <div class="signature-area">
          <strong>HEADMASTER'S SIGNATURE:</strong>
          <div style="margin-top:6px;display:flex;flex-direction:column;align-items:center;">
            ${
              school.headmaster_signature_url
                ? `<img src="${school.headmaster_signature_url}" alt="Sig" style="height:40px;max-width:140px;object-fit:contain;" />`
                : ''
            }
            <div style="border-top:1px solid #000;width:160px;margin-top:4px;"></div>
          </div>
        </div>
      </div>
      <div class="right-col">
        <div class="section-title">Affective Domain</div>
        <table>
          <thead><tr>
            <th style="text-align:left;">Behaviour</th>
            <th>100</th><th>85</th><th>75</th><th>65</th><th>55</th>
          </tr></thead>
          <tbody>${domainRowsHtml(affective)}</tbody>
        </table>
        <div class="section-title">Psychomotor Domain</div>
        <table>
          <thead><tr>
            <th style="text-align:left;">Activities</th>
            <th>100</th><th>85</th><th>75</th><th>65</th><th>55</th>
          </tr></thead>
          <tbody>${domainRowsHtml(psychomotor)}</tbody>
        </table>
      </div>
    </div>
  </div>`;

  if (options?.cardOnly) return card;

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<title>Report - ${row.students?.full_name || 'Student'}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>${getPrintStyles(primary)}</style>
</head><body>
<div class="no-print"><button onclick="window.print()">PRINT REPORT CARD</button></div>
${card}
</body></html>`;
}

/** Mobile on-screen layout (stacked) */
export function buildMobileReportHTML(report: PreparedReport): string {
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
    teacherComment,
    headmasterComment,
  } = report;

  const primary = school.primary_color || '#1a3d7c';
  const primaryLight = lightenColor(primary, 0.72);
  const primaryLighter = lightenColor(primary, 0.88);

  const subjectRows = results
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
        <td class="subj">${subject.subject_name || ''}</td>
        ${caCells}
        <td class="bold">${total}</td>
        <td>${grade}</td>
        <td class="italic">${getComment(grade)}</td>
      </tr>`;
    })
    .join('');

  const caHeaders = config.parts.map((p) => `<th>${p.label}</th>`).join('');
  const daysOpened = attendance.days_opened ?? 0;
  const daysPresent = attendance.days_present ?? 0;
  const daysAbsent = attendance.days_absent ?? 0;
  const insight = getAttendanceInsight(
    Number(daysPresent) || 0,
    Number(daysOpened) || 0
  );

  const domainRows = (obj: Record<string, any>) => {
    const entries = Object.entries(obj || {});
    if (!entries.length)
      return `<tr><td colspan="6" class="muted">No data</td></tr>`;
    return entries
      .map(([activity, score]) => {
        const cols = [100, 85, 75, 65, 55]
          .map((val) => `<td>${Number(score) === val ? '✔' : ''}</td>`)
          .join('');
        return `<tr><td class="subj">${formatName(
          activity
        )}</td>${cols}</tr>`;
      })
      .join('');
  };

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<title>Report - ${row.students?.full_name || 'Student'}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
:root{--primary:${primary};--primary-light:${primaryLight};--primary-lighter:${primaryLighter};}
*{box-sizing:border-box;}
body{margin:0;padding:12px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#e8ecf1;color:#0f172a;font-size:13px;}
.card{background:#fff;border-radius:14px;border:2px solid var(--primary);box-shadow:0 4px 20px rgba(0,0,0,.08);overflow:hidden;max-width:480px;margin:0 auto;}
.header{padding:14px;border-bottom:2px solid var(--primary);background:linear-gradient(180deg,var(--primary-lighter),#fff);}
.header-top{display:flex;align-items:center;gap:12px;}
.logo{width:56px;height:56px;border:1.5px solid var(--primary);border-radius:10px;background:#fff;flex-shrink:0;overflow:hidden;}
.logo img{width:100%;height:100%;object-fit:contain;}
.school-name{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:.5px;word-break:break-word;}
.motto{font-size:11px;font-style:italic;font-weight:600;color:#64748b;margin:3px 0 0;}
.address{font-size:10px;color:#64748b;margin:2px 0 0;text-transform:uppercase;}
.sn-row{display:flex;justify-content:flex-end;margin-top:8px;}
.sn{font-size:11px;font-weight:700;letter-spacing:1px;border:1px solid #0f172a;padding:3px 8px;border-radius:6px;background:#fff;}
.banner{background:var(--primary);color:#fff;text-align:center;padding:8px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;}
.summary{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--primary);}
.summary .cell{background:#fff;padding:8px 10px;}
.summary .k{font-size:9px;font-weight:700;color:var(--primary);text-transform:uppercase;}
.summary .v{font-size:12px;font-weight:700;margin-top:2px;word-break:break-word;}
.summary .wide{grid-column:1/-1;}
.section{padding:12px 12px 4px;}
.section-title{background:var(--primary);color:#fff;font-size:11px;font-weight:700;text-align:center;padding:6px;text-transform:uppercase;border-radius:8px 8px 0 0;margin:0;}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1.5px solid var(--primary);border-top:none;border-radius:0 0 8px 8px;margin-bottom:10px;}
table{width:100%;border-collapse:collapse;font-size:11px;}
th,td{border:1px solid color-mix(in srgb,var(--primary) 35%,#ccc);padding:6px 4px;text-align:center;}
th{background:var(--primary-light);color:var(--primary);text-transform:uppercase;font-size:10px;font-weight:700;}
td.subj,th.subj{text-align:left;padding-left:8px;}
td.bold{font-weight:800;}
td.italic{font-style:italic;font-size:10px;}
tbody tr:nth-child(even){background:var(--primary-lighter);}
.foot-row{background:var(--primary-lighter)!important;font-weight:800;}
.muted{color:#94a3b8;font-style:italic;}
.remark{margin:0 0 10px;padding:10px;border:1.5px solid var(--primary);border-radius:8px;font-size:11px;font-style:italic;font-weight:600;text-align:center;background:var(--primary-lighter);}
.comment{border:1.5px solid var(--primary);border-radius:8px;padding:10px;margin-bottom:8px;}
.comment strong{display:block;font-size:10px;color:var(--primary);margin-bottom:4px;text-transform:uppercase;}
.comment p{margin:0;font-size:12px;font-weight:600;}
.sig{text-align:center;padding:12px;border-top:2px solid var(--primary);}
.sig img{height:44px;max-width:140px;object-fit:contain;}
.sig-line{width:160px;border-top:1px solid #000;margin:8px auto 0;}
.footer-note{text-align:center;font-size:10px;color:#94a3b8;padding:8px 12px 14px;}
</style>
</head><body>
<div class="card">
  <div class="header">
    <div class="header-top">
      <div class="logo">${
        school.logo_url ? `<img src="${school.logo_url}" alt="Logo"/>` : ''
      }</div>
      <div>
        <h1 class="school-name">${school.name || 'School Name'}</h1>
        <p class="motto">MOTTO: ${school.motto || 'N/A'}</p>
        <p class="address">${school.address || ''}</p>
        <p class="address">TEL: ${
          school.phone_numbers || school.phone || 'N/A'
        }</p>
      </div>
    </div>
    <div class="sn-row"><span class="sn">SN: ${
      row.serial_number || '---'
    }</span></div>
  </div>
  <div class="banner">Continuous Assessment Report</div>
  <div class="summary">
    <div class="cell wide"><div class="k">Student Name</div><div class="v">${U(
      row.students?.full_name
    )}</div></div>
    <div class="cell"><div class="k">Student ID</div><div class="v">${U(
      row.students?.student_id || row.student_id
    )}</div></div>
    <div class="cell"><div class="k">Class</div><div class="v">${U(
      row.classes?.name || 'N/A'
    )}</div></div>
    <div class="cell"><div class="k">Gender</div><div class="v">${U(
      row.gender || row.students?.sex || 'N/A'
    )}</div></div>
    <div class="cell"><div class="k">Term</div><div class="v">${U(
      row.term
    )}</div></div>
    <div class="cell"><div class="k">Session</div><div class="v">${U(
      row.session || 'N/A'
    )}</div></div>
    <div class="cell"><div class="k">No. in Class</div><div class="v">${U(
      classSize
    )}</div></div>
    <div class="cell"><div class="k">Position</div><div class="v">${U(
      position
    )}</div></div>
  </div>
  <div class="section">
    <h2 class="section-title">Attendance</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Opened</th><th>Present</th><th>Absent</th></tr></thead>
      <tbody><tr><td>${U(daysOpened)}</td><td>${U(
    daysPresent
  )}</td><td>${U(daysAbsent)}</td></tr></tbody>
    </table></div>
    <div class="remark">${insight}</div>
  </div>
  <div class="section">
    <h2 class="section-title">Terminal Duration</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Begins</th><th>Ends</th><th>Next Term</th></tr></thead>
      <tbody><tr>
        <td>${U(termDuration.term_begins)}</td>
        <td>${U(termDuration.term_ends)}</td>
        <td>${U(termDuration.next_term_begins)}</td>
      </tr></tbody>
    </table></div>
  </div>
  <div class="section">
    <h2 class="section-title">Academic Progress (Cognitive)</h2>
    <div class="table-wrap"><table>
      <thead><tr><th class="subj">Subject</th>${caHeaders}<th>Total</th><th>Grade</th><th>Remark</th></tr></thead>
      <tbody>
        ${subjectRows}
        <tr class="foot-row">
          <td class="subj">Overall</td>
          <td colspan="${config.parts.length}">${totalMarks}</td>
          <td>${average}%</td>
          <td>${overallGrade}</td>
          <td class="italic">${getComment(overallGrade)}</td>
        </tr>
      </tbody>
    </table></div>
  </div>
  <div class="section">
    <h2 class="section-title">Affective Domain</h2>
    <div class="table-wrap"><table>
      <thead><tr><th class="subj">Behaviour</th><th>100</th><th>85</th><th>75</th><th>65</th><th>55</th></tr></thead>
      <tbody>${domainRows(affective)}</tbody>
    </table></div>
  </div>
  <div class="section">
    <h2 class="section-title">Psychomotor Domain</h2>
    <div class="table-wrap"><table>
      <thead><tr><th class="subj">Activity</th><th>100</th><th>85</th><th>75</th><th>65</th><th>55</th></tr></thead>
      <tbody>${domainRows(psychomotor)}</tbody>
    </table></div>
  </div>
  <div class="section">
    <h2 class="section-title">Comments</h2>
    <div class="comment"><strong>Teacher's Comment</strong><p>${U(
      teacherComment
    )}</p></div>
    <div class="comment"><strong>Headmaster's Comment</strong><p>${U(
      headmasterComment
    )}</p></div>
  </div>
  <div class="sig">
    <strong>Headmaster's Signature</strong>
    ${
      school.headmaster_signature_url
        ? `<img src="${school.headmaster_signature_url}" alt="Signature"/>`
        : ''
    }
    <div class="sig-line"></div>
  </div>
  <div class="footer-note">CampusOS · Official Result Sheet</div>
</div>
</body></html>`;
}


/** Build full print document HTML */
export function buildPrintDocument(
  reports: PreparedReport[],
  title: string
): string {
  if (!reports.length) {
    throw { message: 'No results selected.' };
  }
  const primary = reports[0]?.school?.primary_color || '#1a3d7c';
  const cards = reports
    .map((r) => buildPrintReportHTML(r, { cardOnly: true }))
    .join('\n');
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>${getPrintStyles(primary)}</style>
</head><body>
<div class="no-print">
  <button onclick="window.print()">PRINT ${
    reports.length > 1 ? 'ALL REPORTS' : 'REPORT CARD'
  }</button>
  <p style="font-size:12px;color:#666;margin-top:8px;">
    Print → Save as PDF for a 1-page A4 sheet per student.
  </p>
</div>
${cards}
<script>
  // Auto-trigger print after fonts settle (user can cancel)
  window.addEventListener('load', function() {
    setTimeout(function(){ try { window.focus(); } catch(e) {} }, 200);
  });
</script>
</body></html>`;
}

/**
 * Print without relying on pop-ups:
 * 1) Hidden iframe + contentWindow.print()  (best)
 * 2) Blob URL in same tab / new tab fallback
 */
export function printViaIframe(html: string): void {
  if (typeof document === 'undefined') {
    throw { message: 'Printing is only available in the browser.' };
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'CampusOS Print');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw { message: 'Could not create print frame.' };
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    try {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch {}
  };

  const doPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      cleanup();
      throw e;
    }
    // Remove after print dialog interaction
    setTimeout(cleanup, 60_000);
  };

  // Wait for images/fonts
  setTimeout(doPrint, 400);
}

/** Open or fill a pre-opened window; fallback to iframe print */
export function deliverPrintHtml(
  html: string,
  preOpened?: Window | null
): void {
  if (typeof window === 'undefined') {
    throw { message: 'Printing is only available in the browser.' };
  }

  // Prefer writing into a window that was opened synchronously on click
  if (preOpened && !preOpened.closed) {
    try {
      preOpened.document.open();
      preOpened.document.write(html);
      preOpened.document.close();
      setTimeout(() => {
        try {
          preOpened.focus();
          preOpened.print();
        } catch {}
      }, 400);
      return;
    } catch {
      // fall through
    }
  }

  // Iframe print — no pop-up needed
  try {
    printViaIframe(html);
    return;
  } catch {
    // fall through
  }

  // Blob URL fallback
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Call this FIRST on button click (before await) to avoid pop-up block */
export function openPrintPlaceholder(title = 'Preparing Reports...'): Window | null {
  if (typeof window === 'undefined') return null;
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f5f5f5;margin:0;}
.spinner{width:48px;height:48px;border:5px solid #ddd;border-top:5px solid #1a3d7c;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 12px;}
@keyframes spin{to{transform:rotate(360deg)}}
p{color:#444;font-size:14px;}
</style></head><body><div><div class="spinner"></div><p>Preparing reports…</p></div></body></html>`);
  win.document.close();
  return win;
}

/** Single print — A4 web layout (iframe / Save as PDF) */
export function printReport(report: PreparedReport, preOpened?: Window | null) {
  const html = buildPrintDocument([report], 'Report Card');
  deliverPrintHtml(html, preOpened);
}

/** Bulk print */
export function printReports(reports: PreparedReport[], preOpened?: Window | null) {
  const html = buildPrintDocument(reports, 'Bulk Report Printing');
  deliverPrintHtml(html, preOpened);
}
