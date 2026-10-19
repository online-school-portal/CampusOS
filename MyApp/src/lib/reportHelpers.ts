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


/** Mobile-first report card — stacked sections, no SN overlap */
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

  const daysOpened = attendance.days_opened ?? 0;
  const daysPresent = attendance.days_present ?? 0;
  const daysAbsent = attendance.days_absent ?? 0;
  const termBegins = termDuration.term_begins || '';
  const termEnds = termDuration.term_ends || '';
  const nextTermBegins = termDuration.next_term_begins || '';
  const teacherComment = row.teacher_comment || '';
  const headmasterComment = row.headmaster_comment || '';

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

  const caHeaders = config.parts
    .map((p) => `<th>${p.label}</th>`)
    .join('');

  const domainRows = (obj: Record<string, any>) => {
    const entries = Object.entries(obj || {});
    if (!entries.length) {
      return `<tr><td colspan="6" class="muted">No data</td></tr>`;
    }
    return entries
      .map(([activity, score]) => {
        const cols = [100, 85, 75, 65, 55]
          .map((val) => `<td>${Number(score) === val ? '✔' : ''}</td>`)
          .join('');
        return `<tr>
          <td class="subj">${formatName(activity)}</td>
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
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>Report - ${row.students?.full_name || 'Student'}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
:root{
  --primary:${primary};
  --primary-light:${primaryLight};
  --primary-lighter:${primaryLighter};
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{
  margin:0;
  padding:12px;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif;
  background:#e8ecf1;
  color:#0f172a;
  font-size:13px;
  line-height:1.35;
}
.toolbar{
  display:flex;
  justify-content:center;
  gap:10px;
  margin-bottom:12px;
}
.toolbar button{
  background:var(--primary);
  color:#fff;
  border:none;
  border-radius:10px;
  padding:12px 20px;
  font-weight:700;
  font-size:14px;
  cursor:pointer;
  width:100%;
  max-width:320px;
}
.card{
  background:#fff;
  border-radius:14px;
  border:2px solid var(--primary);
  box-shadow:0 4px 20px rgba(0,0,0,.08);
  overflow:hidden;
  max-width:480px;
  margin:0 auto;
}
/* HEADER — stacked, SN never overlaps name */
.header{
  padding:14px 14px 10px;
  border-bottom:2px solid var(--primary);
  background:linear-gradient(180deg,var(--primary-lighter),#fff);
}
.header-top{
  display:flex;
  align-items:center;
  gap:12px;
}
.logo{
  width:56px;
  height:56px;
  border:1.5px solid var(--primary);
  border-radius:10px;
  background:#fff;
  flex-shrink:0;
  overflow:hidden;
}
.logo img{width:100%;height:100%;object-fit:contain;}
.school-block{flex:1;min-width:0;}
.school-name{
  font-family:'Space Grotesk',sans-serif;
  font-size:15px;
  font-weight:700;
  margin:0;
  color:#1e293b;
  text-transform:uppercase;
  letter-spacing:.5px;
  word-break:break-word;
}
.motto{
  font-size:11px;
  font-style:italic;
  font-weight:600;
  color:#64748b;
  margin:3px 0 0;
}
.address{
  font-size:10px;
  color:#64748b;
  margin:2px 0 0;
  text-transform:uppercase;
}
.sn-row{
  display:flex;
  justify-content:flex-end;
  margin-top:8px;
}
.sn{
  font-size:11px;
  font-weight:700;
  letter-spacing:1px;
  border:1px solid #0f172a;
  padding:3px 8px;
  border-radius:6px;
  background:#fff;
}
.banner{
  background:var(--primary);
  color:#fff;
  text-align:center;
  padding:8px 10px;
  font-size:11px;
  font-weight:700;
  letter-spacing:1.5px;
  text-transform:uppercase;
}
/* Student summary chips */
.summary{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:1px;
  background:var(--primary);
  border-bottom:1px solid var(--primary);
}
.summary .cell{
  background:#fff;
  padding:8px 10px;
}
.summary .k{
  font-size:9px;
  font-weight:700;
  color:var(--primary);
  text-transform:uppercase;
  letter-spacing:.4px;
}
.summary .v{
  font-size:12px;
  font-weight:700;
  margin-top:2px;
  word-break:break-word;
}
.summary .wide{grid-column:1 / -1;}
/* Sections */
.section{padding:12px 12px 4px;}
.section-title{
  background:var(--primary);
  color:#fff;
  font-size:11px;
  font-weight:700;
  text-align:center;
  padding:6px 8px;
  text-transform:uppercase;
  letter-spacing:.5px;
  border-radius:8px 8px 0 0;
  margin:0;
}
.table-wrap{
  overflow-x:auto;
  -webkit-overflow-scrolling:touch;
  border:1.5px solid var(--primary);
  border-top:none;
  border-radius:0 0 8px 8px;
  margin-bottom:10px;
}
table{
  width:100%;
  border-collapse:collapse;
  font-size:11px;
  min-width:100%;
}
th,td{
  border:1px solid color-mix(in srgb,var(--primary) 35%,#ccc);
  padding:6px 4px;
  text-align:center;
}
th{
  background:var(--primary-light);
  color:var(--primary);
  text-transform:uppercase;
  font-size:10px;
  font-weight:700;
}
td.subj,th.subj{text-align:left;padding-left:8px;}
td.bold{font-weight:800;}
td.italic{font-style:italic;font-size:10px;}
tbody tr:nth-child(even){background:var(--primary-lighter);}
.foot-row{background:var(--primary-lighter)!important;font-weight:800;}
.muted{color:#94a3b8;font-style:italic;}
/* Attendance remark */
.remark{
  margin:0 0 10px;
  padding:10px 12px;
  border:1.5px solid var(--primary);
  border-radius:8px;
  font-size:11px;
  font-style:italic;
  font-weight:600;
  text-align:center;
  color:#334155;
  background:var(--primary-lighter);
}
/* Comments stacked */
.comment{
  border:1.5px solid var(--primary);
  border-radius:8px;
  padding:10px;
  margin-bottom:8px;
  background:#fff;
}
.comment strong{
  display:block;
  font-size:10px;
  color:var(--primary);
  margin-bottom:4px;
  text-transform:uppercase;
}
.comment p{margin:0;font-size:12px;font-weight:600;}
/* Signature */
.sig{
  text-align:center;
  padding:12px;
  border-top:2px solid var(--primary);
  margin-top:4px;
}
.sig strong{font-size:11px;display:block;margin-bottom:8px;}
.sig img{height:44px;max-width:140px;object-fit:contain;}
.sig-line{
  width:160px;
  border-top:1px solid #000;
  margin:8px auto 0;
}
.footer-note{
  text-align:center;
  font-size:10px;
  color:#94a3b8;
  padding:8px 12px 14px;
}
@media print{
  body{background:#fff;padding:0;}
  .toolbar{display:none!important;}
  .card{box-shadow:none;max-width:none;border-radius:0;}
  @page{size:A4;margin:10mm;}
}
</style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Print Report Card</button>
  </div>

  <div class="card">
    <div class="header">
      <div class="header-top">
        <div class="logo">
          ${school.logo_url ? `<img src="${school.logo_url}" alt="Logo" />` : ''}
        </div>
        <div class="school-block">
          <h1 class="school-name">${school.name || 'School Name'}</h1>
          <p class="motto">MOTTO: ${school.motto || 'N/A'}</p>
          <p class="address">${school.address || ''}</p>
          <p class="address">TEL: ${school.phone_numbers || school.phone || 'N/A'}</p>
        </div>
      </div>
      <div class="sn-row">
        <span class="sn">SN: ${row.serial_number || '---'}</span>
      </div>
    </div>

    <div class="banner">Continuous Assessment Report</div>

    <div class="summary">
      <div class="cell wide">
        <div class="k">Student Name</div>
        <div class="v">${U(row.students?.full_name)}</div>
      </div>
      <div class="cell">
        <div class="k">Student ID</div>
        <div class="v">${U(row.students?.student_id || row.student_id)}</div>
      </div>
      <div class="cell">
        <div class="k">Class</div>
        <div class="v">${U(row.classes?.name || 'N/A')}</div>
      </div>
      <div class="cell">
        <div class="k">Gender</div>
        <div class="v">${U(row.gender || row.students?.sex || 'N/A')}</div>
      </div>
      <div class="cell">
        <div class="k">Term</div>
        <div class="v">${U(row.term)}</div>
      </div>
      <div class="cell">
        <div class="k">Session</div>
        <div class="v">${U(row.session || 'N/A')}</div>
      </div>
      <div class="cell">
        <div class="k">No. in Class</div>
        <div class="v">${U(classSize)}</div>
      </div>
      <div class="cell">
        <div class="k">Position</div>
        <div class="v">${U(position)}</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Attendance</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Opened</th><th>Present</th><th>Absent</th></tr></thead>
          <tbody><tr>
            <td>${U(daysOpened)}</td>
            <td>${U(daysPresent)}</td>
            <td>${U(daysAbsent)}</td>
          </tr></tbody>
        </table>
      </div>
      <div class="remark">${insight}</div>
    </div>

    <div class="section">
      <h2 class="section-title">Terminal Duration</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Begins</th><th>Ends</th><th>Next Term</th></tr></thead>
          <tbody><tr>
            <td>${U(termBegins)}</td>
            <td>${U(termEnds)}</td>
            <td>${U(nextTermBegins)}</td>
          </tr></tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Academic Progress (Cognitive)</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="subj">Subject</th>
              ${caHeaders}
              <th>Total</th>
              <th>Grade</th>
              <th>Remark</th>
            </tr>
          </thead>
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
        </table>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Affective Domain</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="subj">Behaviour</th>
              <th>100</th><th>85</th><th>75</th><th>65</th><th>55</th>
            </tr>
          </thead>
          <tbody>${domainRows(affective)}</tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Psychomotor Domain</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="subj">Activity</th>
              <th>100</th><th>85</th><th>75</th><th>65</th><th>55</th>
            </tr>
          </thead>
          <tbody>${domainRows(psychomotor)}</tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Comments</h2>
      <div class="comment">
        <strong>Teacher's Comment</strong>
        <p>${U(teacherComment || '...')}</p>
      </div>
      <div class="comment">
        <strong>Headmaster's Comment</strong>
        <p>${U(headmasterComment || '...')}</p>
      </div>
    </div>

    <div class="sig">
      <strong>Headmaster's Signature</strong>
      ${
        school.headmaster_signature_url
          ? `<img src="${school.headmaster_signature_url}" alt="Signature" />`
          : ''
      }
      <div class="sig-line"></div>
    </div>

    <div class="footer-note">CampusOS · Official Result Sheet</div>
  </div>
</body>
</html>`;
}

export function printReport(report: PreparedReport) {
  if (typeof window === 'undefined') return;
  const html = report.html || buildWebReportHTML(report);
  const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=800');
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
