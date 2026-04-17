
const SUPABASE_URL = "https://irelkjvppoisvjpopdpb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyZWxranZwcG9pc3ZqcG9wZHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNTUwMDAsImV4cCI6MjA4MTkzMTAwMH0.osF4wEZ-zm3cXScD1W8gMOkG81O2TbDJ8L47YvIIryw";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,      // ✅ Keep session in localStorage
      storage: window.localStorage, // ✅ Use localStorage for persistence
    },
  }
);

let allStudents = [];
let allTeachers = [];

// Hamburger navigation toggle + section display
document.addEventListener("DOMContentLoaded", async () => {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("navLinks");

  // Hamburger toggle
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("active");
      navLinks.classList.toggle("active");
    });
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
      window.location.href = "index.html";
      return;
    }

    // ✅ Show UI immediately
    showSection("overview");

    // ✅ ONLY call unified dashboard
    loadDashboard(session);

  } catch (err) {
    console.error("Init error:", err);
    window.location.href = "index.html";
  }
});


// ===============================
// NAVIGATION SECTION SWITCH
// ===============================
function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(sec => {
    sec.style.display = "none";
    sec.classList.remove("active");
  });

  const target = document.getElementById(sectionId);

  if (target) {
    target.style.display = "block";
    target.classList.add("active");
  }

  // Close mobile sidebar when a section is selected
  const navLinks = document.getElementById("navLinks");
  const hamburger = document.getElementById("hamburger");

  if (
    navLinks &&
    hamburger &&
    window.innerWidth <= 768 &&
    navLinks.classList.contains("active")
  ) {
    navLinks.classList.remove("active");
    hamburger.classList.remove("active");
  }
}


// ===============================
// DROPDOWN SUBMENU TOGGLE
// ===============================
function toggleDropdown(btn, menuId) {
  const menu = document.getElementById(menuId);
  const chevron = btn.querySelector(".chevron");

  if (!menu) return;

  // Toggle dropdown visibility
  menu.classList.toggle("show");

  // Rotate arrow icon
  if (chevron) {
    chevron.classList.toggle("rotate");
  }
}

// logoutBtn
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}

function logout() {
  // Clear any stored session info, tokens, or cookies
  localStorage.removeItem("userSession"); // example
  sessionStorage.clear();

  // Redirect to login page
  window.location.href = "index.html"; // change to your login page URL
}

/*********************************
 * LOAD DASHBOARD (UNIFIED)
 *********************************/
async function loadDashboard(session) {
  try {
    const userId = session.user.id;

    // ===============================
    // 1️⃣ DETECT ROLE USING auth_id
    // ===============================
    const [teacherRes, adminRes] = await Promise.all([
      supabaseClient
        .from("teachers")
        .select("teacher_id, full_name, class_teacher, subject_specialization")
        .eq("auth_id", userId)
        .maybeSingle(),

      supabaseClient
        .from("admins")
        .select("name, role")
        .eq("auth_id", userId)
        .maybeSingle()
    ]);

    const teacher = teacherRes.data;
    const admin = adminRes.data;

    console.log("Admin result:", admin);
    console.log("Teacher result:", teacher);

    let role = null;
    let profile = null;

    if (admin) {
      role = "admin";
      profile = admin;
    } else if (teacher) {
      role = "teacher";
      profile = teacher;
    }

    if (!role) {
      console.warn("User has no role in DB");
      return window.location.href = "index.html";
    }

    console.log("Detected role:", role);

    // ===============================
    // 2️⃣ APPLY ROLE VISIBILITY
    // ===============================
    applyRoleVisibility(role);

    // Ensure overview is visible AFTER role applied
    if (typeof showSection === "function") {
      showSection("overview");
    }

    // ===============================
    // 3️⃣ LOAD PROFILE DATA
    // ===============================
    if (role === "admin") {
      const nameEl = document.getElementById("adminName");
      const roleEl = document.getElementById("adminRole");

      if (nameEl) nameEl.textContent = profile.name || "Admin";
      if (roleEl) roleEl.textContent = `Role: ${profile.role || "N/A"}`;
    }

    if (role === "teacher") {
      const nameEl = document.getElementById("teacherName");
      const idEl = document.getElementById("teacherIdDisplay");

      if (nameEl) nameEl.textContent = profile.full_name || "Teacher";
      if (idEl) idEl.textContent = profile.teacher_id || "N/A";

      const classes = profile.class_teacher
        ? profile.class_teacher.split(",").map(c => c.trim()).filter(Boolean)
        : [];

      const subjects = profile.subject_specialization
        ? profile.subject_specialization.split(",").map(s => s.trim()).filter(Boolean)
        : [];

      const classCountEl = document.getElementById("assignedClassesCount");
      const subjectCountEl = document.getElementById("subjectsCount");

      if (classCountEl) classCountEl.textContent = classes.length;
      if (subjectCountEl) subjectCountEl.textContent = subjects.length;
    }

    // ===============================
    // 4️⃣ FETCH DATA (RLS CONTROLLED)
    // ===============================
    // Fetch counts
    const teachersCountQuery = supabaseClient
      .from("teachers")
      .select("*", { count: "exact", head: true });

    const studentsCountQuery = supabaseClient
      .from("students")
      .select("*", { count: "exact", head: true });

    const [
      { count: teacherCount, error: teacherError },
      { count: studentCount, error: studentError }
    ] = await Promise.all([teachersCountQuery, studentsCountQuery]);

    if (teacherError) console.error("Teacher count error:", teacherError);
    if (studentError) console.error("Student count error:", studentError);

    // Fetch full student data for table
    const { data: studentsData, error: studentsDataError } = await supabaseClient
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });

    if (studentsDataError) {
      console.error("Student data fetch error:", studentsDataError);
      return;
    }

    // ===============================
    // 5️⃣ UPDATE UI COUNTS
    // ===============================
    const studentEl = document.getElementById("totalStudentsCount");
    const teacherEl = document.getElementById("totalTeachers");

    if (studentEl) studentEl.textContent = studentCount ?? 0;
    if (teacherEl) teacherEl.textContent = teacherCount ?? 0;

    // ===============================
    // 6️⃣ OPTIONAL TABLE RENDER
    // ===============================
    if (typeof loadStudents === "function") {
      loadStudents(studentsData || []);
    }

    console.log("Dashboard fully loaded");

  } catch (err) {
    console.error("Dashboard fatal error:", err);
    window.location.href = "index.html";
  }
}

/*********************************
 * ROLE-BASED VISIBILITY
 *********************************/
function applyRoleVisibility(role) {
  role = role.toLowerCase();

  document.querySelectorAll("[data-role]").forEach(el => {
    const roles = el.dataset.role
      .toLowerCase()
      .split(",")
      .map(r => r.trim());

    el.style.display = roles.includes(role) ? "" : "none";
  });
}

// --- Helpers ---
async function getUserSchool() {
  const { data, error } = await supabase.rpc("current_user_school_id");
  if (error) throw error;
  return data;
}

// ---------- GLOBAL VARIABLES ----------
let selectedStudent = null; // global
// user selects a student -> sets selectedStudent
const studentId = selectedStudent?.id; // gets UUID

/* ===============================
   CREATE STUDENT SELECTOR
================================ */
function populateStudentDropdown({
  students,
  dropdownId,
  selectId,
  textId,
  placeholder = "Select student"
}) {

  const dropdown = document.getElementById(dropdownId);
  const select = document.getElementById(selectId);
  const text = document.getElementById(textId);

  if (!dropdown || !select || !text) return;

  dropdown.innerHTML = "";
  select.innerHTML = `<option value="">${placeholder}</option>`;
  text.textContent = placeholder;

  students.forEach(student => {

    /* Hidden select option */
    const option = document.createElement("option");
   /* option.value = student.id || student.student_id;
    option.textContent = student.full_name; */
    option.value = student.id; // ALWAYS use the database UUID
    option.textContent = `${student.full_name} (${student.student_id})`; // show public ID for clarity
    select.appendChild(option);

    /* Avatar */
    let avatar = student.image_url
      ? `<img src="${student.image_url}" class="student-avatar"
         onerror="this.src='default-avatar.png'">`
      : `<div class="student-avatar-placeholder">
          ${student.full_name?.charAt(0) || "S"}
        </div>`;

    /* Dropdown item */
    const item = document.createElement("div");
    item.className = "student-option";

    item.innerHTML = `
      ${avatar}
      <span>${student.full_name}</span>
    `;

    item.onclick = () =>
      selectStudent({
        student,
        textId,
        selectId,
        dropdownId
      });

    dropdown.appendChild(item);

  });

}

/* ===============================
   SELECT STUDENT
================================ */
function selectStudent({ student, textId, selectId, dropdownId }) {

  const text = document.getElementById(textId);
  const select = document.getElementById(selectId);

  if (!text || !select) return;

// Store the student object globally
  selectedStudent = student;

  text.innerHTML = `
    <img src="${student.image_url || "default-avatar.png"}"
         class="student-avatar"
         onerror="this.src='default-avatar.png'">
    ${student.full_name}
  `;

  /*select.value = student.id || student.student_id;*/
  select.value = student.id; // ALWAYS the UUID

  toggleStudentDropdown(dropdownId);
}


/* ===============================
   TOGGLE DROPDOWN
================================ */
function toggleStudentDropdown(dropdownId) {

  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  dropdown.classList.toggle("show");

} 

/* ===============================
   CLOSE WHEN CLICKING OUTSIDE
================================ */
document.addEventListener("click", e => {

  document.querySelectorAll(".student-select").forEach(container => {

    const dropdown = container.querySelector(".student-dropdown");

    if (!container.contains(e.target)) {
      dropdown?.classList.remove("show");
    }

  });

});

/* ===============================
   POPULATE CLASS DROPDOWN
================================ */
function populateClassDropdown({
  classes = [],
  dropdownId,
  selectId,
  textId,
  placeholder = "Select a class",
  includeAll = false, // only for filters
  resetOption = false // optional reset for placeholder
}) {
  const dropdown = document.getElementById(dropdownId);
  const select = document.getElementById(selectId);
  const text = document.getElementById(textId);
  if (!dropdown || !select || !text) return;

  dropdown.innerHTML = "";
  select.innerHTML = "";
  text.textContent = placeholder;

  // Add "All" for filters
  if (includeAll) {
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All";
    select.appendChild(allOption);

    const allItem = document.createElement("div");
    allItem.className = "student-option";
    allItem.textContent = "All";
    allItem.onclick = () => {
      select.value = "all";
      text.textContent = "All";
      toggleStudentDropdown(dropdownId);
      select.dispatchEvent(new Event("change"));
    };
    dropdown.appendChild(allItem);

    select.value = "all";
    text.textContent = "All";
  }

  // Optional reset to placeholder
  if (resetOption) {
    const resetItem = document.createElement("div");
    resetItem.className = "student-option";
    resetItem.textContent = placeholder;
    resetItem.onclick = () => {
      select.value = "";
      text.textContent = placeholder;
      toggleStudentDropdown(dropdownId);
      select.dispatchEvent(new Event("change"));
    };
    dropdown.appendChild(resetItem);
  }

  if (!classes || !classes.length) return;

  classes.forEach(cls => {
    const option = document.createElement("option");
    option.value = cls.name;
    option.textContent = cls.name;
    select.appendChild(option);

    const item = document.createElement("div");
    item.className = "student-option";
    item.textContent = cls.name;
    item.onclick = () => {
      select.value = cls.name;
      text.textContent = cls.name;
      toggleStudentDropdown(dropdownId);
      select.dispatchEvent(new Event("change"));
    };
    dropdown.appendChild(item);
  });
}

/* ===============================
   LOAD CLASSES FROM DB
================================ */
async function loadClasses() {
  try {
    const { data, error } = await supabaseClient
      .from("classes")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw error;

    // Always return an array
    return data || [];

  } catch (err) {
    console.error("Failed loading classes:", err);
    return [];
  }
}

// ===============================
// LUCIDE INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();
});

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

// ===============================
// INTERNAL HELPERS
// ===============================
function show(preview, placeholder) {
  preview.classList.remove("hidden");
  placeholder.classList.add("hidden");
}

function reset(preview, placeholder) {
  preview.src = "";
  preview.classList.add("hidden");
  placeholder.classList.remove("hidden");

  refreshIcons();
}

// ===============================
// MAIN IMAGE ENGINE
// ===============================
function setImagePreview({
  previewId,
  placeholderId,
  file = null,
  imageUrl = null
}) {
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);

  if (!preview || !placeholder) return;

  // CASE 1: FILE
  if (file) {
    const reader = new FileReader();

    reader.onload = (e) => {
      preview.src = e.target.result;
      show(preview, placeholder);
    };

    reader.readAsDataURL(file);
    return;
  }

  // CASE 2: EXISTING IMAGE
  if (imageUrl) {
    preview.src = imageUrl;

    preview.onload = () => show(preview, placeholder);
    preview.onerror = () => reset(preview, placeholder);

    return;
  }

  // CASE 3: RESET
  reset(preview, placeholder);
}

// ===============================
// PUBLIC RESET API
// ===============================
 function resetImagePreview({ previewId, placeholderId, inputId }) {
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);
  const input = document.getElementById(inputId);

  if (input) input.value = "";
  if (!preview || !placeholder) return;

  reset(preview, placeholder);
} 

// ===============================
// Uploader Binder
// ===============================
function initImageUploader({
  inputId,
  previewId,
  placeholderId,
  triggerId
}) {
  const input = document.getElementById(inputId);
  const trigger = document.getElementById(triggerId);

  if (!input || !trigger) return;

  trigger.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    const file = input.files?.[0];

    setImagePreview({
      previewId,
      placeholderId,
      file
    });
  });
}


// subscription (credits system)
// LOAD TOTAL CREDITS (SUM)
async function loadCredits() {
  try {
    const { data: schoolId } =
      await supabaseClient.rpc("current_user_school_id");

    if (!schoolId) return;

    const { data, error } = await supabaseClient
      .from("school_subscriptions")
      .select("credits")
      .eq("school_id", schoolId);

    if (error) {
      console.error(error);
      return;
    }

    const totalCredits = (data || []).reduce(
      (sum, row) => sum + (row.credits || 0),
      0
    );

    document.getElementById("statusText").innerText =
      totalCredits > 0 ? "ACTIVE" : "NO CREDITS";

    document.getElementById("daysLeft").innerText = totalCredits;

  } catch (err) {
    console.error(err);
  }
}


// PAYMENT FLOW (WITH AMOUNT)
async function payNow() {
  try {
    const statusEl = document.getElementById("paymentStatus");
    statusEl.innerText = "Initializing payment...";

    const amount = Number(document.getElementById("amountInput").value);

    if (!amount || amount <= 0) {
      statusEl.innerText = "Enter a valid amount";
      return;
    }

    const { data: schoolId } =
      await supabaseClient.rpc("current_user_school_id");

    const { data: { session } } =
      await supabaseClient.auth.getSession();

    if (!schoolId || !session) {
      statusEl.innerText = "Auth error";
      return;
    }

    const res = await fetch(
      "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/initiate-paystack",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          school_id: schoolId,
          email: session.user.email,
          amount
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      statusEl.innerText = data.error || "Payment failed";
      return;
    }

    window.location.href = data.authorization_url;

  } catch (err) {
    console.error(err);
  }
}


// AUTO LOAD
window.addEventListener("DOMContentLoaded", loadCredits);


/* =======================
   STUDENTS
======================= */
// ===============================
// LUCIDE INIT (run once)
// ===============================
 /*document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();
});

// Re-render icons when needed
function refreshIcons() {
  if (window.lucide) lucide.createIcons();
} 

// ===============================
// IMAGE PREVIEW (REUSABLE)
// ===============================
 function previewImage(input, previewId, placeholderId) {
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);

  if (!preview || !placeholder) return;

  if (input.files && input.files[0]) {
    const reader = new FileReader();

    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.classList.remove("hidden");
      placeholder.classList.add("hidden");
    };

    reader.readAsDataURL(input.files[0]);
  }
}

// ===============================
// RESET IMAGE PREVIEW (REUSABLE)
// ===============================
 function resetImagePreview(previewId, placeholderId, inputId) {
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);
  const input = document.getElementById(inputId);

  if (preview) {
    preview.src = "";
    preview.classList.add("hidden");
  }

  if (placeholder) {
    placeholder.classList.remove("hidden");
  }

  if (input) {
    input.value = "";
  }
} */

 initImageUploader({
  inputId: "studentPhoto",
  previewId: "preview-student",
  placeholderId: "placeholder-student",
  triggerId: "studentPhotoTrigger"
});

resetImagePreview({
  previewId: "preview-student",
  placeholderId: "placeholder-student",
  inputId: "studentPhoto"
});

/* setImagePreview({
previewId: "preview-student",
placeholderId: "placeholder-student",
imageUrl: null
}); */

function updateStudentCount(list, label = "Students") {
  const el = document.getElementById("studentsPageCount");
  if (el) el.textContent = `${list.length} ${label}`;
}

//Load students
 /*function loadStudents(list = allStudents) {
  const container = document.getElementById("studentsContainer");
  if (!container) return;
  container.innerHTML = "";

  // Grid layout
  container.className = "grid gap-4 mt-4"; 

  list.forEach(student => {
    const card = document.createElement("div");
    card.className = "data-card";

    // -----------------------------
    // Decide what to show in avatar
    // -----------------------------
    let avatarHTML = '';
    if (student.image_url) {
      avatarHTML = `<img src="${student.image_url}" alt="${student.full_name || 'Student'}" class="card-avatar-img" onerror="this.onerror=null;this.src='default-avatar.png'">`;
      // fallback to default avatar if image fails to load
    } else {
      avatarHTML = `<div class="card-avatar">${student.full_name ? student.full_name.charAt(0) : 'S'}</div>`;
    }

    card.innerHTML = `
      <div class="data-card-header">
        ${avatarHTML}
        <div class="card-info">
          <h4>${student.full_name || "Unknown Student"}</h4>
          <p>ID: ${student.student_id || "N/A"}</p>
        </div>
      </div>
      
      <div class="card-body">
        <span class="card-label">Current Class</span>
        <span class="card-value">${student.student_class || "N/A"}</span>
        
        <span class="card-label">Sex</span>
        <span class="card-value">${student.sex || "N/A"}</span>
        
        <span class="card-label">Parent</span>
        <span class="card-value">${student.parent_name || "N/A"}</span>

        <span class="card-label">Phone</span>
        <span class="card-value">${student.parent_phone || "N/A"}</span>
      </div>

      <div class="card-actions">
        <button onclick="openEditStudentModal('${encodeURIComponent(student.student_id)}')" class="btn-edit">
          Edit Profile
        </button>
        <button onclick="deleteStudent('${encodeURIComponent(student.student_id)}')" class="btn-delete">
          Delete
        </button>
      </div>
    `;

    container.appendChild(card);
  });
} */

function loadStudents(list = allStudents) {
  const container = document.getElementById("studentsContainer");
  if (!container) return;

  container.innerHTML = "";

  // ✅ Update count here
  updateStudentCount(list);

  container.className = "grid gap-4 mt-4"; 

  list.forEach(student => {
    const card = document.createElement("div");
    card.className = "data-card";

    let avatarHTML = '';
    if (student.image_url) {
      avatarHTML = `<img src="${student.image_url}" alt="${student.full_name || 'Student'}" class="card-avatar-img" onerror="this.onerror=null;this.src='default-avatar.png'">`;
    } else {
      avatarHTML = `<div class="card-avatar">${student.full_name ? student.full_name.charAt(0) : 'S'}</div>`;
    }

    card.innerHTML = `
      <div class="data-card-header">
        ${avatarHTML}
        <div class="card-info">
          <h4>${student.full_name || "Unknown Student"}</h4>
          <p>ID: ${student.student_id || "N/A"}</p>
        </div>
      </div>
      
      <div class="card-body">
        <span class="card-label">Current Class</span>
        <span class="card-value">${student.student_class || "N/A"}</span>
        
        <span class="card-label">Sex</span>
        <span class="card-value">${student.sex || "N/A"}</span>
        
        <span class="card-label">Parent</span>
        <span class="card-value">${student.parent_name || "N/A"}</span>

        <span class="card-label">Phone</span>
        <span class="card-value">${student.parent_phone || "N/A"}</span>
      </div>

      <div class="card-actions">
        <button onclick="openEditStudentModal('${encodeURIComponent(student.student_id)}')" class="btn-edit">
          Edit Profile
        </button>
        <button onclick="deleteStudent('${encodeURIComponent(student.student_id)}')" class="btn-delete">
          Delete
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

async function fetchStudents() {
  const { data, error } = await supabaseClient
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return console.error(error);

  allStudents = data;
  loadStudents();
  populateTransferDropdownFromAll();
}

async function registerStudent(payload) {
  const { error } = await supabaseClient
    .from("students")
    .insert(payload);

  if (error) return alert(error.message);
  await fetchStudents();
}

/*async function updateStudent(studentId, payload) {
  const { error } = await supabaseClient
    .from("students")
    .update(payload)
    .eq("student_id", studentId);

  if (error) return alert(error.message);
  await fetchStudents();
} */

async function updateStudent(id, payload) {
  const { error } = await supabaseClient
    .from("students")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
  await fetchStudents();
}

async function deleteStudent(studentIdEncoded) {
  const studentId = decodeURIComponent(studentIdEncoded);
  if (!confirm("Delete student?")) return;

  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) throw new Error("Admin not authenticated");

    const token = session.access_token;

    // Call edge function
    const res = await fetch(
      "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/delete-student",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ student_id: studentId })
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete student");

    alert("Student deleted successfully!");
    await fetchStudents();

  } catch (err) {
    console.error("Failed to delete student:", err);
    alert("Delete failed: " + (err.message || "Unknown error"));
  }
}

 /*window.openEditStudentModal = async function(studentIdEncoded) {
  const studentId = decodeURIComponent(studentIdEncoded);

  const { data: student, error } = await supabaseClient
    .from("students")
    .select("*")
    .eq("student_id", studentId)
    .single();

  if (error) return alert(error.message);

  const form = document.getElementById("editStudentForm");

  // Map form input names to database columns
  const fieldMap = {
    fullName: "full_name",
    studentId: "student_id",
    studentClass: "student_class",
    admissionClass: "admission_class",
    dateOfBirth: "date_of_birth",
    sex: "sex",
    stateOfOrigin: "state_of_origin",
    nationality: "nationality",
    lga: "lga",
    studentAddress: "student_address",
    parentName: "parent_name",
    parentPhone: "parent_phone",
    parentEmail: "parent_email",
    parentAddress: "parent_address",
    guardianName: "guardian_name",
    guardianPhone: "guardian_phone",
    guardianEmail: "guardian_email",
    guardianAddress: "guardian_address",
    siblingName: "sibling_name",
    siblingClass: "sibling_class",
    siblingGender: "sibling_gender"
  };

  Object.keys(fieldMap).forEach(formField => {
    if (form[formField]) {
      form[formField].value = student[fieldMap[formField]] ?? "";
    }
  });

// ✅ store the real DB identifier
form.dataset.id = student.id;

  document.getElementById("editStudentModal").classList.remove("hidden");

  // Cancel button
  const cancelBtn = document.getElementById("closeStudentModal");
  if (cancelBtn) cancelBtn.onclick = () => {
    document.getElementById("editStudentModal").classList.add("hidden");
  };
}; */

window.openEditStudentModal = async function (studentIdEncoded) {
  const studentId = decodeURIComponent(studentIdEncoded);

  const { data: student, error } = await supabaseClient
    .from("students")
    .select("*")
    .eq("student_id", studentId)
    .single();

  if (error) return alert(error.message);

// =========================
// INIT CLASS DROPDOWNS (EDIT MODAL)
// =========================
const classes = await loadClasses();

populateClassDropdown({
  classes,
  dropdownId: "editAdmissionClassDropdown",
  selectId: "editAdmissionClassSelect",
  textId: "editAdmissionClassSelectedText",
  placeholder: "Select Class",
  resetOption: true
});

populateClassDropdown({
  classes,
  dropdownId: "editCurrentClassDropdown",
  selectId: "editCurrentClassSelect",
  textId: "editCurrentClassSelectedText",
  placeholder: "Select Class",
  resetOption: true
});

populateClassDropdown({
  classes,
  dropdownId: "editSiblingClassDropdown",
  selectId: "editSiblingClassSelect",
  textId: "editSiblingClassSelectedText",
  placeholder: "--Select Class--",
  resetOption: true
});

  const form = document.getElementById("editStudentForm");

  // =========================
  // FIELD MAPPING
  // =========================
  const fieldMap = {
    fullName: "full_name",
    studentId: "student_id",
    studentClass: "student_class",
    admissionClass: "admission_class",
    dateOfBirth: "date_of_birth",
    sex: "sex",
    stateOfOrigin: "state_of_origin",
    nationality: "nationality",
    lga: "lga",
    studentAddress: "student_address",
    parentName: "parent_name",
    parentPhone: "parent_phone",
    parentEmail: "parent_email",
    parentAddress: "parent_address",
    guardianName: "guardian_name",
    guardianPhone: "guardian_phone",
    guardianEmail: "guardian_email",
    guardianAddress: "guardian_address",
    siblingName: "sibling_name",
    siblingClass: "sibling_class",
    siblingGender: "sibling_gender"
  };

  Object.keys(fieldMap).forEach((key) => {
    if (form[key]) {
      form[key].value = student[fieldMap[key]] ?? "";
    }
  });

  form.dataset.id = student.id;

// =========================
// SYNC DROPDOWN DISPLAY TEXT
// =========================

// Admission class
document.getElementById("editAdmissionClassSelect").value =
  student.admission_class ?? "";
document.getElementById("editAdmissionClassSelectedText").textContent =
  student.admission_class ?? "--Select Class--";

// Current class
document.getElementById("editCurrentClassSelect").value =
  student.student_class ?? "";
document.getElementById("editCurrentClassSelectedText").textContent =
  student.student_class ?? "--Select Class--";

// SIBLING CLASS SYNC
document.getElementById("editSiblingClassSelect").value =
  student.sibling_class ?? "";

document.getElementById("editSiblingClassSelectedText").textContent =
  student.sibling_class ?? "--Select Class--";

  // =========================
  // IMAGE SYSTEM (CORRECT FLOW)
  // =========================

  const config = {
    inputId: "edit-student-photo",
    previewId: "edit-preview-student",
    placeholderId: "edit-placeholder-student",
    triggerId: "edit-student-photo-trigger"
  };

  // 1. RESET FIRST
  resetImagePreview(config);

  // 2. APPLY EXISTING IMAGE
  if (student.image_url) {
    setImagePreview({
      previewId: config.previewId,
      placeholderId: config.placeholderId,
      imageUrl: student.image_url
    });
  }

  // 3. INIT ONLY ONCE PER OPEN (SAFE VERSION NEEDED)
  initImageUploader(config);

  // =========================
  // OPEN MODAL
  // =========================
  document.getElementById("editStudentModal").classList.remove("hidden");

  // =========================
  // CLOSE
  // =========================
  document.getElementById("closeStudentModal").onclick = () => {
    document.getElementById("editStudentModal").classList.add("hidden");

    resetImagePreview(config);
  };
};

// =======================
// Filter Students by Class
// =======================
function filterStudentsByClass(className) {
  const selected = className?.trim().toLowerCase() || "all";

  const filtered = selected === "all"
    ? allStudents
    : allStudents.filter(s => (s.student_class?.trim().toLowerCase() || "") === selected);

  loadStudents(filtered);
}

// =======================
// Initialize Class Dropdowns
// =======================
document.addEventListener("DOMContentLoaded", async () => {
  const classes = await loadClasses();

  // Filter dropdown for students
  populateClassDropdown({
    classes,
    dropdownId: "studentClassDropdown",
    selectId: "studentClassFilter",
    textId: "studentClassSelectedText",
    placeholder: "All",
    includeAll: true
  });

  // Admission class
  populateClassDropdown({
    classes,
    dropdownId: "admissionClassDropdown",
    selectId: "admissionClassSelect",
    textId: "admissionClassSelectedText",
    placeholder: "Select Class",
    resetOption: true
  });

  // Current class
  populateClassDropdown({
    classes,
    dropdownId: "currentClassDropdown",
    selectId: "currentClassSelect",
    textId: "currentClassSelectedText",
    placeholder: "Select Class",
    resetOption: true
  });

  // Sibling class
  populateClassDropdown({
    classes,
    dropdownId: "siblingClassDropdown",
    selectId: "siblingClassSelect",
    textId: "siblingClassSelectedText",
    placeholder: "--Select Class--",
    resetOption: true
  });

  // Attach filter listener for students
  document.getElementById("studentClassFilter").addEventListener("change", e => {
    filterStudentsByClass(e.target.value);
  });
});

/* =======================
   TEACHERS
======================= */
  initImageUploader({
  inputId: "teacherPhoto",
  previewId: "preview-teacher",
  placeholderId: "placeholder-teacher",
  triggerId: "teacherPhotoTrigger"
});

resetImagePreview({
  previewId: "preview-teacher",
  placeholderId: "placeholder-teacher",
  inputId: "teacherPhoto"
});

// optional when editing form reset / reuse:
 /*setImagePreview({
  previewId: "preview-teacher",
  placeholderId: "placeholder-teacher",
  imageUrl: null
});*/

//Load Teachers
function loadTeachers() {
  const container = document.getElementById("teachersContainer");
  if (!container) return;

  container.innerHTML = "";
  container.className = "grid gap-4 mt-4"; // match students layout

  allTeachers.forEach(teacher => {
    const card = document.createElement("div");
    card.className = "data-card";

    // -----------------------------
    // Avatar logic (same as students)
    // -----------------------------
    let avatarHTML = '';

    if (teacher.image_url) {
      avatarHTML = `
        <img 
          src="${teacher.image_url}" 
          alt="${teacher.full_name || 'Teacher'}"
          class="card-avatar-img"
          onerror="this.onerror=null;this.src='default-avatar.png'"
        >
      `;
    } else {
      avatarHTML = `
        <div class="card-avatar" style="background: #e0e7ff; color: #4338ca;">
          ${teacher.full_name ? teacher.full_name.charAt(0) : 'T'}
        </div>
      `;
    }

    // -----------------------------
    // Card UI
    // -----------------------------
    card.innerHTML = `
      <div class="data-card-header">
        ${avatarHTML}
        <div class="card-info">
          <h4>${teacher.full_name || "Unknown Teacher"}</h4>
          <p>${teacher.qualification || "Faculty"}</p>
        </div>
      </div>
      
      <div class="card-body">
        <span class="card-label">Subject</span>
        <span class="card-value" style="color: #4f46e5; font-weight: 700;">
          ${teacher.subject_specialization || "N/A"}
        </span>
        
        <span class="card-label">Class Teacher</span>
        <span class="card-value">${teacher.class_teacher || "None"}</span>
        
        <span class="card-label">Experience</span>
        <span class="card-value">
          ${teacher.years_of_experience ? teacher.years_of_experience + ' Years' : "N/A"}
        </span>

        <span class="card-label">Phone</span>
        <span class="card-value">${teacher.phone || "N/A"}</span>
      </div>

      <div class="card-actions">
        <button onclick="openEditTeacherModal('${encodeURIComponent(teacher.id)}')" class="btn-edit">
          Edit Profile
        </button>
        <button onclick="deleteTeacher('${encodeURIComponent(teacher.id)}')" class="btn-delete">
          Remove
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}


async function fetchTeachers() {
  const { data, error } = await supabaseClient
    .from("teachers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return console.error(error);

  allTeachers = data;
  loadTeachers();
}

async function addTeacher(payload) {
  const { error } = await supabaseClient
    .from("teachers")
    .insert(payload);

  if (error) return alert(error.message);
  await fetchTeachers();
}

async function updateTeacher(id, payload) {
  const { error } = await supabaseClient
    .from("teachers")
    .update(payload)
    .eq("id", id);

  if (error) return alert(error.message);
  await fetchTeachers();
}

async function deleteTeacher(idEncoded) {
  const id = decodeURIComponent(idEncoded);
  if (!confirm("Delete teacher?")) return;

  try {
    // 🔐 Get session for authorization
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) throw new Error("Admin not authenticated");

    const token = session.access_token;

    // 1️⃣ Call the delete-teacher edge function
    const res = await fetch(
      "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/delete-teacher",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ teacher_id: id })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to delete teacher");
    }

    // 2️⃣ Refresh teacher list
    await fetchTeachers();

    alert("Teacher deleted successfully.");

  } catch (err) {
    console.error("Teacher deletion error:", err);
    alert("Failed to delete teacher: " + (err.message || JSON.stringify(err)));
  }
}

 async function openEditTeacherModal(idEncoded) {
  const id = decodeURIComponent(idEncoded);

  const teacher = allTeachers.find(t => t.id === id);
  if (!teacher) return alert("Teacher not found");

  const form = document.getElementById("editTeacherForm");

  // =========================
  // FIELD ASSIGNMENT
  // =========================
  form.editTeacherUuid.value = teacher.id ?? "";
  form.teacherId.value = teacher.teacher_id ?? "";
  form.fullName.value = teacher.full_name ?? "";
  form.phone.value = teacher.phone ?? "";
  form.qualification.value = teacher.qualification ?? "";
  form.subjectSpecialization.value = teacher.subject_specialization ?? "";
  form.classTeacher.value = teacher.class_teacher ?? "";
  form.yearsOfExperience.value = teacher.years_of_experience ?? "";
  form.joiningDate.value = teacher.joining_date ?? "";

  form.dataset.id = teacher.id;

  // =========================
  // IMAGE CONFIG (NOW CORRECT)
  // =========================
  const config = {
    inputId: "teacherPhotoEdit",
    previewId: "preview-teacher-edit",
    placeholderId: "placeholder-teacher-edit",
    triggerId: "teacherPhotoTriggerEdit"
  };

  // =========================
  // RESET STATE
  // =========================
  resetImagePreview(config);

  // =========================
  // APPLY EXISTING IMAGE
  // =========================
  if (teacher.image_url) {
    setImagePreview({
      previewId: config.previewId,
      placeholderId: config.placeholderId,
      imageUrl: teacher.image_url
    });
  }

  // =========================
  // INIT UPLOADER (ONLY ONCE)
  // =========================
  if (!window.teacherUploaderInitialized) {
    initImageUploader(config);
    window.teacherUploaderInitialized = true;
  }

  // =========================
  // OPEN MODAL
  // =========================
  document.getElementById("editTeacherModal").classList.remove("hidden");

  // =========================
  // CLOSE HANDLER
  // =========================
  document.getElementById("closeTeacherModal").onclick = () => {
    document.getElementById("editTeacherModal").classList.add("hidden");
    resetImagePreview(config);
  };

  // =========================
  // FIX LUCIDE ICONS IN MODAL
  // =========================
  refreshIcons();
}

/* =======================
   SUBJECTS
======================= */
let allSubjects = [];
// Fetch subjects for a selected class
async function fetchSubjects(className) {
  if (!className) {
    allSubjects = [];
    displayRegisteredSubjects();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("subjects")
      .select("*")
      .eq("class", className)
      .order("name", { ascending: true });

    if (error) throw error;

    allSubjects = data || [];
    displayRegisteredSubjects();
  } catch (err) {
    console.error("Failed fetching subjects:", err);
    allSubjects = [];
    displayRegisteredSubjects();
  }
}

function updateSubjectsCount(list, label = "Subjects") {
  const el = document.getElementById("subjectsPageCount");
  if (el) el.textContent = `${list.length} ${label}`;
}

// Display subjects in the registeredSubjects container
 /*function displayRegisteredSubjects() {
  const container = document.getElementById("registeredSubjects");
  container.innerHTML = "";

  allSubjects.forEach(subj => {
    const div = document.createElement("div");
    div.className = "flex items-center justify-between mb-2 border p-2 rounded";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = subj.name;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "bg-red-500 text-white px-2 py-1 rounded";
    deleteBtn.onclick = async () => {
      if (!confirm("Delete this subject?")) return;

      const { error } = await supabaseClient
        .from("subjects")
        .delete()
        .eq("id", subj.id);

      if (error) return alert(error.message);
      fetchSubjects(document.getElementById("classSelect").value);
    };

    div.appendChild(nameSpan);
    div.appendChild(deleteBtn);
    container.appendChild(div);
  });
} */

function displayRegisteredSubjects() {
  const container = document.getElementById("registeredSubjects");
  container.innerHTML = "";

  // ✅ ADD THIS LINE
  updateSubjectsCount(allSubjects);

  if (!allSubjects.length) {
    container.innerHTML = `<p class="text-gray-500 text-center">No subjects found.</p>`;
    return;
  }

  allSubjects.forEach(subj => {
    const div = document.createElement("div");
    div.className = "flex items-center justify-between mb-2 border p-2 rounded";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = subj.name;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "bg-red-500 text-white px-2 py-1 rounded";
    deleteBtn.onclick = async () => {
      if (!confirm("Delete this subject?")) return;

      const { error } = await supabaseClient
        .from("subjects")
        .delete()
        .eq("id", subj.id);

      if (error) return alert(error.message);

      // ✅ Re-fetch updates count automatically
      fetchSubjects(document.getElementById("classSelect").value);
    };

    div.appendChild(nameSpan);
    div.appendChild(deleteBtn);
    container.appendChild(div);
  });
}

// Add subjects from textarea
document.getElementById("saveSubjectsBtn").addEventListener("click", async () => {
  const classSelect = document.getElementById("classSelect");
  const className = classSelect?.value?.trim();
  if (!className) return alert("Select a class first.");

  const textarea = document.getElementById("subjectTextarea");
  const subjectsToAdd = textarea.value
    .split("\n")
    .map(s => s.trim())
    .filter(s => s);

  if (!subjectsToAdd.length) return alert("Enter at least one subject.");

  try {
    showSpinner("Adding subjects...");

    for (const name of subjectsToAdd) {
      await supabaseClient.from("subjects").insert({ name, class: className });
    }

    alert("Subjects added successfully!");
    textarea.value = "";
    fetchSubjects(className);

  } catch (err) {
    console.error(err);
    alert("Failed to add subjects: " + err.message);
  } finally {
    hideSpinner();
  }
});

// Update subjects display when class changes
document.addEventListener("DOMContentLoaded", async () => {
  const classes = await loadClasses(); // your reusable classes loader

  // Subjects class dropdown
  populateClassDropdown({
    classes,
    dropdownId: "classDropdown",    // the div containing clickable options
    selectId: "classSelect",        // the hidden <select>
    textId: "classSelectedText",    // the placeholder span
    placeholder: "Select a class",
    resetOption: true               // allows resetting back to placeholder
  });

  // Attach listener: fetch subjects when a class is selected
  document.getElementById("classSelect").addEventListener("change", e => {
    const className = e.target.value?.trim();
    fetchSubjects(className);
  });
});

/* =======================
   CLASSES
======================= */
let allClasses = [];

// ---------------------------
// Fetch all classes
// ---------------------------
async function fetchClasses() {
  try {
    const { data, error } = await supabaseClient
      .from("classes")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    allClasses = data || [];
    displayRegisteredClasses();

  } catch (err) {
    console.error("Failed to fetch classes:", err);
  }
}

function updateClassesCount(list, label = "Classes") {
  const el = document.getElementById("classesPageCount");
  if (el) el.textContent = `${list.length} ${label}`;
}

// ---------------------------
// Display all classes
// ---------------------------
 /* function displayRegisteredClasses() {
  const container = document.getElementById("registeredClasses");
  if (!container) return;
  container.innerHTML = "";

  if (!allClasses.length) {
    container.innerHTML = `<p class="text-gray-500 text-center">No classes registered yet.</p>`;
    return;
  }

  allClasses.forEach(cls => {
    const div = document.createElement("div");
    div.className = "flex items-center justify-between mb-2 border p-2 rounded";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = cls.name;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "bg-red-500 text-white px-2 py-1 rounded";

    deleteBtn.onclick = async () => {
      if (!confirm("Delete this class?")) return;

      try {
        const { error } = await supabaseClient
          .from("classes")
          .delete()
          .eq("id", cls.id);
        if (error) throw error;

        fetchClasses(); // refresh list
      } catch (err) {
        alert("Failed to delete class: " + err.message);
      }
    };

    div.appendChild(nameSpan);
    div.appendChild(deleteBtn);
    container.appendChild(div);
  });
} */

function displayRegisteredClasses() {
  const container = document.getElementById("registeredClasses");
  if (!container) return;

  container.innerHTML = "";

  // ✅ ADD THIS LINE
  updateClassesCount(allClasses);

  if (!allClasses.length) {
    container.innerHTML = `<p class="text-gray-500 text-center">No classes registered yet.</p>`;
    updateClassesCount([]); // ensure 0 state is shown
    return;
  }

  allClasses.forEach(cls => {
    const div = document.createElement("div");
    div.className = "flex items-center justify-between mb-2 border p-2 rounded";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = cls.name;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "bg-red-500 text-white px-2 py-1 rounded";

    deleteBtn.onclick = async () => {
      if (!confirm("Delete this class?")) return;

      try {
        const { error } = await supabaseClient
          .from("classes")
          .delete()
          .eq("id", cls.id);

        if (error) throw error;

        fetchClasses(); // refresh (count updates automatically)
      } catch (err) {
        alert("Failed to delete class: " + err.message);
      }
    };

    div.appendChild(nameSpan);
    div.appendChild(deleteBtn);
    container.appendChild(div);
  });
}

// ---------------------------
// Save classes from textarea
// ---------------------------
document.getElementById("saveClassesBtn")?.addEventListener("click", async () => {
  const textarea = document.getElementById("classTextarea");
  if (!textarea) return;

  const classesToAdd = textarea.value
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  if (!classesToAdd.length) return alert("Enter at least one class.");

  try {
    showSpinner("Saving classes...");

    const payload = classesToAdd.map(name => ({ name }));

    const { error } = await supabaseClient
      .from("classes")
      .insert(payload);

    if (error) throw error;

    alert("Classes added successfully!");
    textarea.value = ""; // reset textarea
    fetchClasses();      // refresh list

  } catch (err) {
    console.error(err);
    alert("Failed to add classes: " + err.message);
  } finally {
    hideSpinner();
  }
});

// ---------------------------
// Initialize fetch
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  fetchClasses();
});

/* =======================
   TRANSFER STUDENTS
======================= */
function populateTransferDropdownFromAll() {
  const select = document.getElementById("transferStudentSelect");
  if (!select) return;

  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- Select Student --";
  select.appendChild(defaultOption);

  allStudents.forEach(student => {
    const option = document.createElement("option");
    option.value = student.student_id;
    option.textContent = `${student.name} (${student.student_class})`;
    select.appendChild(option);
  });
}

/* Transfer student to new class */
async function doTransferStudent(studentId, newClass) {
  const { error } = await supabaseClient
    .from("students")
    .update({ student_class: newClass })
    .eq("id", studentId); // UUID field in DB

  if (error) throw error;
}

/* DOM elements */
const transferClassSelect = document.getElementById("transferClass");
const newClassSelect = document.getElementById("newClass");
const transferForm = document.getElementById("transferForm");

/* Load students when a class is selected */
transferClassSelect.addEventListener("change", async () => {

  const selectedClass = transferClassSelect.value;

  if (!selectedClass) return;

  // Filter students in that class
  const studentsInClass = allStudents.filter(
    s => s.student_class === selectedClass
  );

  if (studentsInClass.length === 0) {
    alert("No students in this class yet!");
    return;
  }

  // ✅ Populate Transfer Student dropdown using reusable function
  populateStudentDropdown({
    students: studentsInClass,
    dropdownId: "transferStudentDropdown",
    selectId: "transferStudent",
    textId: "transferStudentText",
    placeholder: "--Select Student--"
  });

});

/* =======================
   TRANSFER FORM SUBMISSION
======================= */
transferForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // ✅ Use hidden <select> to get selected student ID
  const studentSelect = document.getElementById("transferStudent");
  const studentId = studentSelect?.value;
  const newClass = newClassSelect.value;

  if (!studentId || !newClass) {
    return alert("Select a student and a new class");
  }

  try {
    // Show spinner while processing
    showSpinner("Transferring student...");

    // Perform transfer
    await doTransferStudent(studentId, newClass);
    alert("Student transferred successfully!");

    // Refresh the student dropdown for the selected class
    transferClassSelect.dispatchEvent(new Event("change"));

    // Optionally reset the selection
    studentSelect.value = "";
    const textSpan = document.getElementById("transferStudentText");
    if (textSpan) textSpan.textContent = "--Select Student--";

  } catch (err) {
    console.error(err);
    alert("Failed to transfer student: " + err.message);
  } finally {
    hideSpinner();
  }
});

//INIT 
document.addEventListener("DOMContentLoaded", async () => {
  const classes = await loadClasses(); // reusable function to get class list

  // Populate New Class dropdown
  populateClassDropdown({
    classes,
    dropdownId: "newClassDropdown",       // div showing clickable options
    selectId: "newClass",                 // hidden <select>
    textId: "newClassSelectedText",       // placeholder span
    placeholder: "--Select New Class--",
    resetOption: true                     // allows reset to placeholder
  });

  // Listen for selection on New Class
  document.getElementById("newClass").addEventListener("change", e => {
    const selectedClass = e.target.value?.trim();
    console.log("Selected new class:", selectedClass);
    // Call any function you need here
  });

  // Populate Transfer Class dropdown
  populateClassDropdown({
    classes,
    dropdownId: "transferClassDropdown",  // div showing clickable options
    selectId: "transferClass",            // hidden <select>
    textId: "transferClassSelectedText",  // placeholder span
    placeholder: "--Select Class--",
    resetOption: true                     // allows reset to placeholder
  });

  // Listen for selection on Transfer Class
  document.getElementById("transferClass").addEventListener("change", e => {
    const selectedClass = e.target.value?.trim();
    console.log("Selected transfer class:", selectedClass);
    // Call any function you need here
  });
});

/* =======================
   RESULTS SECTION
======================= */
const resultClassSelect = document.getElementById("resultClass");
const resultStudentSelect = document.getElementById("resultStudent");
const resultSubjectsContainer = document.getElementById("resultSubjects");
const resultForm = document.getElementById("resultForm");

/* ===============================
   GRADE CALCULATION
================================ */
 function calculateGrade(total) {
  if (total >= 70) return "A";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  if (total >= 45) return "D";
  return "F";
} 

/* ===============================
   LOAD SUBJECTS BY CLASS
================================ */
async function loadSubjectsByClass(className) {
  try {
    const { data, error } = await supabaseClient
      .from("subjects")
      .select("*")
      .eq("class", className)
      .order("name");

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error(err);
    alert("Failed to load subjects: " + err.message);
    return [];
  }
}

/* ===============================
   LOAD STUDENTS BY CLASS
================================ */
async function loadStudentsByClass(className) {
  try {
    const { data: students, error } = await supabaseClient
      .from("students")
      .select("id, student_id, full_name, image_url, student_class")
      .eq("student_class", className)
      .order("full_name");

    if (error) throw error;

    const list = students || [];

    // ✅ Populate dropdown using reusable function
    populateStudentDropdown({
      students: list,
      dropdownId: "studentDropdown",
      selectId: "resultStudent",
      textId: "studentSelectedText",
      placeholder: "Select student"
    });

    return list;

  } catch (err) {
    console.error("Load students error:", err);
    alert("Failed to load students: " + err.message);
    return [];
  }
}

/* ===============================
   RENDER SUBJECT INPUTS
================================ */
function renderSubjectInputs(subjects) {
  resultSubjectsContainer.innerHTML = "";

  subjects.forEach(subj => {
    const row = document.createElement("div");

    // Add class and dataset attribute
    row.classList.add("subject-row");
    row.dataset.subjectId = subj.id;

    row.className +=
      " border p-3 rounded-xl mb-4 grid grid-cols-1 gap-3 sm:grid-cols-8 sm:items-center";

    row.innerHTML = `
      <div class="font-semibold sm:col-span-3">${subj.name}</div>

      <div><input type="number" name="test1_${subj.id}" placeholder="Test (20)" class="subject-input border p-2 rounded-xl w-full sm:w-20"></div>
      <div><input type="number" name="test2_${subj.id}" placeholder="Test (20)" class="subject-input border p-2 rounded-xl w-full sm:w-20"></div>
      <div><input type="number" name="exam_${subj.id}" placeholder="Exam (60)" class="subject-input border p-2 rounded-xl w-full sm:w-20"></div>

      <input type="hidden" name="total_${subj.id}" value="0">
      <input type="hidden" name="grade_${subj.id}" value="F">
    `;

    resultSubjectsContainer.appendChild(row);

    // Auto grade updater
    ["test1", "test2", "exam"].forEach(type => {
      const input = row.querySelector(`[name="${type}_${subj.id}"]`);
      if (!input) return;

      input.addEventListener("input", () => {
        const t1 = parseInt(row.querySelector(`[name="test1_${subj.id}"]`)?.value) || 0;
        const t2 = parseInt(row.querySelector(`[name="test2_${subj.id}"]`)?.value) || 0;
        const exam = parseInt(row.querySelector(`[name="exam_${subj.id}"]`)?.value) || 0;

        const total = t1 + t2 + exam;
        const grade = calculateGrade(total);

        const totalField = row.querySelector(`[name="total_${subj.id}"]`);
        const gradeField = row.querySelector(`[name="grade_${subj.id}"]`);

        if (totalField) totalField.value = total;
        if (gradeField) gradeField.value = grade;
      });
    });
  });
}

/* ===============================
   CLASS CHANGE HANDLER
================================ */
resultClassSelect.addEventListener("change", async () => {
  const className = resultClassSelect.value;
  if (!className) return;

  // Reset student dropdown safely
  resultStudentSelect.innerHTML = '<option value="">--Select Student--</option>';

  // Load students (always returns an array)
  const students = await loadStudentsByClass(className);

  students.forEach(s => {
    const option = document.createElement("option");
    option.value = s.id;
    option.textContent = s.full_name;
    resultStudentSelect.appendChild(option);
  });

  // Load subjects for the class safely
  const subjects = await loadSubjectsByClass(className);
  renderSubjectInputs(subjects);
});

/* ===============================
   SUBMIT RESULTS FORM HANDLER
================================ */
resultForm.addEventListener("submit", async e => {
  e.preventDefault();

  showSpinner("Validating fields...");

  try {
    // ✅ Grab values
    const studentSelect = document.getElementById("resultStudent");
    const studentId = studentSelect?.value;
    const className = resultClassSelect?.value;
    const term = document.getElementById("resultTerm")?.value?.trim();
    const session = document.getElementById("resultSession")?.value?.trim();
    const gender = document.getElementById("studentGender")?.value;

    // ---------- 1. Validate required fields ----------
    const missingFields = [];
    if (!className) missingFields.push("Class");
    if (!studentId) missingFields.push("Student");
    if (!term) missingFields.push("Term");
    if (!session) missingFields.push("Session");
    if (!gender) missingFields.push("Gender");

    if (missingFields.length) {
      console.warn("Missing required fields:", missingFields);
      alert("Please fill/select the following fields before saving: " + missingFields.join(", "));
      return;
    }

    // ---------- 2. Validate subjects ----------
    const subjectRows = resultSubjectsContainer.querySelectorAll(".subject-row");
    if (!subjectRows.length) {
      alert("No subjects to save.");
      return;
    }

    // ---------- 3. Collect subject results ----------
    const resultsArray = [];
    subjectRows.forEach(row => {
      const subjectId = row.dataset.subjectId;
      const test1 = parseInt(row.querySelector(`[name="test1_${subjectId}"]`)?.value) || 0;
      const test2 = parseInt(row.querySelector(`[name="test2_${subjectId}"]`)?.value) || 0;
      const exam  = parseInt(row.querySelector(`[name="exam_${subjectId}"]`)?.value) || 0;
      const total = test1 + test2 + exam;
      const grade = calculateGrade(total);

      resultsArray.push({
        subject_id: subjectId,
        subject_name: row.querySelector(".font-semibold")?.textContent || "Unknown",
        test1,
        test2,
        exam,
        total,
        grade
      });
    });

    // ---------- 4. Psychomotor ----------
    const psychomotorData = {};
    document.querySelectorAll("#psychomotorBody tr").forEach(row => {
      const name = row.querySelector("td:first-child")?.textContent?.trim();
      if (!name) return;
      const selected = row.querySelector('input[type="radio"]:checked');
      psychomotorData[name.toLowerCase().replace(/\s+/g, "_")] =
        selected ? parseInt(selected.value) : null;
    });

    // ---------- 5. Affective ----------
    const affectiveData = {};
    document.querySelectorAll("#affectiveBody tr").forEach(row => {
      const name = row.querySelector("td:first-child")?.textContent?.trim();
      if (!name) return;
      const selected = row.querySelector('input[type="radio"]:checked');
      affectiveData[name.toLowerCase().replace(/\s+/g, "_")] =
        selected ? parseInt(selected.value) : null;
    });

    // ---------- 6. Attendance ----------
    const attendance = {
      days_opened: parseInt(document.getElementById("daysOpened")?.value) || 0,
      days_present: parseInt(document.getElementById("daysPresent")?.value) || 0,
      days_absent: parseInt(document.getElementById("daysAbsent")?.value) || 0
    };

    // ---------- 7. Term Duration ----------
    const term_duration = {
      term_begins: document.getElementById("termBegins")?.value || null,
      term_ends: document.getElementById("termEnds")?.value || null,
      next_term_begins: document.getElementById("nextTermBegins")?.value || null
    };

    // ---------- 8. Comments ----------
    const teacherComment = document.getElementById("teacherComment")?.value.trim() || "";
    const headmasterComment = document.getElementById("headmasterComment")?.value.trim() || "";

    // ---------- 9. Payload ----------
if (!selectedStudent?.id) return alert("Please select a student.");
if (!className?.trim()) return alert("Please select a class.");
if (!term?.trim()) return alert("Please select a term.");
if (!session?.trim()) return alert("Please select a session.");

const payload = {
  student_id: selectedStudent.id, // UUID
  class: className.trim(),
  term: term.trim(),
  session: session.trim(),
  gender,
  results: resultsArray,
  psychomotor_domain: psychomotorData,
  affective_domain: affectiveData,
  attendance,
  term_duration,
  teacher_comment: teacherComment,
  headmaster_comment: headmasterComment
};

// ---------- 10. Save ----------
showSpinner("Saving results...");

const { error } = await supabaseClient
  .from("results")
  .insert([payload]);

if (error) throw error;

alert("Results saved successfully!");

    // ---------- 11. Reset UI ----------
    resultForm.reset();
    resultSubjectsContainer.innerHTML = "";
    document.querySelectorAll('#psychomotorBody input[type="radio"], #affectiveBody input[type="radio"]').forEach(r => r.checked = false);

  } catch (err) {
    console.error("Save error:", err);
    alert("Failed to save results: " + err.message); 
  } finally {
    hideSpinner();
  }
});

// =======================
// Initialize Result Class Dropdown
// =======================
document.addEventListener("DOMContentLoaded", async () => {
  const classes = await loadClasses(); // your reusable function

  populateClassDropdown({
    classes,
    dropdownId: "resultClassDropdown",       // div that holds clickable options
    selectId: "resultClass",                 // hidden <select>
    textId: "resultClassSelectedText",       // placeholder span
    placeholder: "Select class",
    resetOption: true                         // allows reset to placeholder
  });

  // Optional: listen for changes to trigger something
  document.getElementById("resultClass").addEventListener("change", e => {
    const className = e.target.value?.trim();
    console.log("Result class selected:", className);
    // Call your function here if needed, e.g., loadResults(className);
  });
});

/*========== MANAGE RESULTS SECTION (FULL CODE) ==========*/

const editResultModal = document.getElementById("editResultModal");
const editResultForm = document.getElementById("editResultForm");
const editResultSubjects = document.getElementById("editResultSubjects");

let currentEditingResult = null;

// ---------- 1. Core Logic (Grading & Comments) ----------
function calculateGrade(total) {
  if (total >= 70) return "A1";
  if (total >= 65) return "B2";
  if (total >= 60) return "B3";
  if (total >= 55) return "C4";
  if (total >= 50) return "C5";
  if (total >= 45) return "D7";
  if (total >= 40) return "E8";
  return "F9";
}

function getComment(grade) {
  const map = { "A1": "Excellent", "B2": "V. Good", "B3": "V. Good", "C4": "Good", "C5": "Credit", "D7": "Pass", "E8": "Pass", "F9": "Poor" };
  return map[grade] || "Fair";
}

function updateResultsCount(list, label = "Results") {
  const el = document.getElementById("resultsPageCount");
  if (el) el.textContent = `${list.length} ${label}`;
}

function formatDateFancy(dateString) {
  const date = new Date(dateString);
  const day = date.getDate();

  const suffix =
    day % 10 === 1 && day !== 11 ? "st" :
    day % 10 === 2 && day !== 12 ? "nd" :
    day % 10 === 3 && day !== 13 ? "rd" : "th";

  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();

  return `${day}${suffix} ${month} ${year}`;
}

// ---------- DOM Elements ----------
const manageClassSelect = document.getElementById("manageResultClass");
const manageStudentContainer = document.getElementById("manageStudentContainer");

// ---------- Load Students by Class ----------
manageClassSelect.addEventListener("change", async () => {
  const className = manageClassSelect.value;
  if (!className) return;

  // Fetch students for selected class
  const students = await loadStudentsByClass(className);

  // Populate Manage Student dropdown using reusable logic
  populateStudentDropdown({
    students, // contains image_url
    selectId: "manageStudent",
    dropdownId: "manageStudentDropdown",
    textId: "manageStudentText",
    placeholder: "Select student"
  });

  // Pass students so renderManageResults can access image_url
  renderManageResults(students);
});

async function refreshManageResultsView() {
  const classId = document.getElementById("manageResultClass")?.value;
  const studentId = document.getElementById("manageStudent")?.value;
  const term = document.getElementById("manageTerm")?.value;
  const session = document.getElementById("manageSession")?.value;

  if (!classId) return;

  const { data, error } = await supabaseClient
    .from("results")
    .select("*")
    .eq("class", classId);

  if (error) {
    console.error(error);
    return;
  }

  const filtered = data.filter(r => {
    return (
      (!studentId || r.student_id === studentId) &&
      (!term || r.term === term) &&
      (!session || r.session === session)
    );
  });

  renderManageResults(filtered);
}

// ---------- Toggle Manage Student Dropdown ----------
function toggleManageStudentDropdown() {
  toggleStudentDropdown("manageStudentDropdown");
}

// ---------- Render Manage Results ----------
async function renderManageResults() {
  const className = manageClassSelect.value;
  const studentId = document.getElementById("manageStudent")?.value;
  const term = document.getElementById("manageTerm")?.value;
  const session = document.getElementById("manageSession")?.value.trim();

  if (!className) return;

  manageStudentContainer.innerHTML =
    "<div class='p-10 text-center text-gray-400 animate-pulse'>Fetching records...</div>";

  try {
    let query = supabaseClient
      .from("results")
      .select("*, students!inner(full_name, student_id, image_url)")
      .eq("class", className);

    if (studentId) query = query.eq("student_id", studentId);
    if (term) query = query.eq("term", term);
    if (session) query = query.eq("session", session);

    const { data, error } = await query;
    if (error) throw error;

updateResultsCount(data);

    manageStudentContainer.innerHTML = "";
    if (!data.length) {
  updateResultsCount([]); // ✅ ensures it shows 0

  manageStudentContainer.innerHTML =
    `<p class="p-4 text-gray-500 text-center w-full">No results found.</p>`;
  return;
}

   /* if (!data.length) {
      manageStudentContainer.innerHTML =
        `<p class="p-4 text-gray-500 text-center w-full">No results found.</p>`;
      return;
    } */

    data.forEach(item => {
      const studentName = item.students?.full_name || "Unknown";
      const studentPublicId = item.students?.student_id || item.student_id;
      const imageUrl = item.students?.image_url;

      const avatar = imageUrl
        ? `<img src="${imageUrl}" class="w-10 h-10 rounded-full object-cover">`
        : `<div class="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
             ${studentName.charAt(0)}
           </div>`;

      const card = document.createElement("div");
      card.className =
        "data-card border p-4 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow";

      card.innerHTML = `
        <div class="flex items-center gap-3 mb-4 border-b pb-3">
          ${avatar}
          <div>
            <h4 class="font-bold text-gray-800">${studentName}</h4>
            <p class="text-xs text-gray-500">${item.term} • ${item.session}</p>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <button onclick="viewResultPreview('${item.student_id}','${item.class}','${item.term}','${item.session}')"
            class="bg-blue-50 text-blue-700 py-2 rounded-lg text-[10px] font-black uppercase">
            View
          </button>
          <button onclick="handleEditClick('${item.student_id}','${item.class}','${item.term}','${item.session}')"
            class="bg-gray-50 text-gray-700 py-2 rounded-lg text-[10px] font-black uppercase">
            Edit
          </button>
          <button onclick="deleteResult('${item.student_id}','${item.class}','${item.term}','${item.session}')"
            class="bg-red-50 text-red-600 py-2 rounded-lg text-[10px] font-black uppercase">
            Delete
          </button>
        </div>
      `;

      manageStudentContainer.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    manageStudentContainer.innerHTML =
      `<p class="text-red-500 p-4 text-center">Connection Error.</p>`;
  }
}

// ---------- Re-render on Term & Session change ----------
document.getElementById("manageTerm")?.addEventListener("change", renderManageResults);
document.getElementById("manageSession")?.addEventListener("input", renderManageResults);

// ---------- 3. View Report (New Tab) ----------
function viewResultPreview(studentId, className, term, session) {
  // ---------- Fetch student result using composite key ----------
  supabaseClient
    .from("results")
    .select("*, students(full_name, student_id)")
    .match({
      student_id: studentId,
      class: className,
      term: term,
      session: session
    })
    .then(async ({ data, error }) => {
      if (error || !data || !data.length) {
        console.error(error);
        return alert("Result record not found.");
      }

    const row = data[0];
      const results = row.results || [];

      const numSubjects = results.length;
      const totalMarks = results.reduce(
        (sum, s) => sum + ((s.test1 || 0) + (s.test2 || 0) + (s.exam || 0)),
        0
      );
      const maxTotal = numSubjects * 100;
      const percentage = maxTotal ? Math.round((totalMarks / maxTotal) * 100) : 0;
const percentageDisplay = percentage; // already integer
const overallGrade = calculateGrade(percentage);

      // ---------- Determine class position using composite key filter ----------
      const { data: classData, error: classError } = await supabaseClient
        .from("results")
        .select("student_id, results")
        .match({
          class: row.class,
          term: row.term,
          session: row.session
        });

      if (classError) {
        console.error(classError);
      }

      let classTotals = [];
      if (classData && classData.length) {
        classTotals = classData
          .map(r => {
            const total = (r.results || []).reduce(
              (sum, s) => sum + ((s.test1 || 0) + (s.test2 || 0) + (s.exam || 0)),
              0
            );
            return { student_id: r.student_id, total };
          })
          .sort((a, b) => b.total - a.total);
      }

      const position =
        classTotals.findIndex(c => c.student_id === studentId) + 1 || 1;

      function formatPosition(n) {
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

          // ---------- Subjects Table ----------
    const rowsHtml = results.map(s => {
      const total = (s.test1 || 0) + (s.test2 || 0) + (s.exam || 0);
      const grade = calculateGrade(total);
      return `
        <tr>
          <td class="px-2 py-1 border border-black text-left uppercase">${s.subject_name}</td>
          <td class="px-2 py-1 border border-black text-center">${s.test1 || 0}</td>
          <td class="px-2 py-1 border border-black text-center">${s.test2 || 0}</td>
          <td class="px-2 py-1 border border-black text-center">${s.exam || 0}</td>
          <td class="px-2 py-1 border border-black text-center bg-gray-100">${total}</td>
          <td class="px-2 py-1 border border-black text-center">${grade}</td>
          <td class="px-2 py-1 border border-black text-center italic">${getComment(grade)}</td>
        </tr>`;
    }).join("");

    // Summary Footer inside table
    const summaryRowHtml = `
  <tr class="bg-gray-200 font-bold">
    <!-- Subjects -->
    <td class="px-2 py-1 border border-black text-center">
      ${numSubjects} Subjects
    </td>
    
    <!-- T1 + T2 + Exam combined -->
<td colspan="3" class="px-2 py-1 border border-black font-bold">
  <div style="display:flex; justify-content:center; align-items:center; width:100%;">
    ${totalMarks}
  </div>
</td>

    <!-- Total / Percentage -->
    <td class="px-2 py-1 border border-black text-center font-bold">
      ${percentage}%
    </td>

    <!-- Grade -->
    <td class="px-2 py-1 border border-black text-center font-bold">
      ${overallGrade}
    </td>

    <!-- Comment -->
    <td class="px-2 py-1 border border-black text-center italic">
      ${getComment(overallGrade)}
    </td>
  </tr>
`;

    // ---------- Psychomotor ----------
    const psychomotor = row.psychomotor_domain || {};
    const psychomotorHtml = Object.entries(psychomotor).map(([activity, score]) => {
      const cols = [100, 85, 75, 65, 55].map(val => `<td class="px-2 py-1 border border-black text-center">${score === val ? "✔" : ""}</td>`).join("");
      return `<tr>
        <td class="px-2 py-1 border border-black font-bold text-left">${formatName(activity)}</td>
        ${cols}
      </tr>`;
    }).join("");

    // ---------- Affective ----------
    const affective = row.affective_domain || {};
    const affectiveHtml = Object.entries(affective).map(([trait, score]) => {
      const cols = [100, 85, 75, 65, 55].map(val => `<td class="px-2 py-1 border border-black text-center">${score === val ? "✔" : ""}</td>`).join("");
      return `<tr>
        <td class="px-2 py-1 border border-black font-bold text-left">${formatName(trait)}</td>
        ${cols}
      </tr>`;
    }).join("");

    // ---------- Comments ----------
  const teacherComment = row.teacher_comment || "N/A";
    const headmasterComment = row.headmaster_comment || "N/A";

    function formatName(str) {
      return str.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // ---------- Attendance ----------
const attendance = row.attendance || {};
const daysOpened = attendance.days_opened ?? "-";
const daysPresent = attendance.days_present ?? "-";
const daysAbsent = attendance.days_absent ?? "-";

    // ---------- Term Duration ----------
const termDuration = row.term_duration || {};

const termBegins = termDuration.term_begins
  ? formatDateFancy(termDuration.term_begins)
  : "N/A";

const termEnds = termDuration.term_ends
  ? formatDateFancy(termDuration.term_ends)
  : "N/A";

const nextTermBegins = termDuration.next_term_begins
  ? formatDateFancy(termDuration.next_term_begins)
  : "N/A";
    
    function formatDateFancy(dateString) {
  if (!dateString) return "N/A";

  const date = new Date(dateString);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

const U = (v) =>
  `<strong>${(v === null || v === undefined || v === "") ? "N/A" : String(v).toUpperCase()}</strong>`;

// Fetch school info based on school_id from result row
const { data: schoolData, error: schoolError } = await supabaseClient
  .from("schools")
  .select("*")
  .eq("id", row.school_id)
  .single();

if (schoolError) {
  console.warn("Could not fetch school info:", schoolError);
  // fallback to default values if needed
  schoolData = {
    name: "Your School Name",
    motto: "MOTTO",
    address: "Address not set",
    phone: "N/A",
    logo_url: "default-logo.png",
    headmaster_signature_url: "default-signature.png"
  };
}

    // ---------- Full HTML ----------
    const reportHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Report - ${row.students?.full_name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap');
    
    body { 
      font-family: 'Source Sans Pro', sans-serif; 
      background: #f4f4f4; 
      margin: 0;
      padding: 10px;
      color: #000;
    }

    .report-card { 
      background: white;
      width: 210mm;
      min-height: 297mm;
      margin: auto; 
      padding: 12mm; 
      box-sizing: border-box;
      border: 1px solid #ccc;
    }

    /* Header Section with Logo placeholder */
    .header-container {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
      position: relative;
    }
    .logo {
  position: absolute;
  left: 0;
  width: 80px;
  height: 80px;
  border: 1px dashed #ccc; /* Placeholder for school logo */
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

    .header-text { text-align: center; }
    .school-name { font-size: 26px; font-weight: 800; margin: 0; }
    .motto { font-size: 12px; font-weight: bold; font-style: italic; margin: 2px 0; }
    .address { font-size: 11px; margin: 0; width: 100%; }
    
    .report-banner { 
      border: 2px solid #000;
      border-left: none; border-right: none;
      padding: 6px; 
      font-weight: bold; 
      font-size: 13px; 
      margin: 15px 0;
      text-align: center;
      text-transform: uppercase;
    }

    /* Student Info Grid - Matching the image's 2-column structure */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-top: 1px solid #000;
      border-left: 1px solid #000;
      margin-bottom: 15px;
    }
    .info-item {
      display: flex;
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    .label {
      width: 120px;
      padding: 4px 8px;
      font-weight: bold;
      font-size: 11px;
      border-right: 1px solid #000;
      text-transform: uppercase;
    }
    .value {
      padding: 4px 8px;
      font-size: 11px;
      flex-grow: 1;
    }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 15px; }
    th, td { border: 1px solid #000; padding: 4px; }
    th { text-transform: uppercase; }
    .sub-head { font-size: 9px; }

    .columns { display: flex; gap: 15px; }
    .left-col { flex: 2.2; }
    .right-col { flex: 1; }

    .section-title { 
      font-size: 11px; font-weight: bold; text-align: center; 
      padding: 4px; border: 1px solid #000; border-bottom: none;
      text-transform: uppercase;
    }

    .comment-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border: 1px solid #000;
      margin-top: -1px;
    }
    .comment-box {
      padding: 8px;
      border-right: 1px solid #000;
      font-size: 10px;
      min-height: 60px;
    }
    .comment-box:last-child { border-right: none; }
    
    .signature-area {
      border: 1px solid #000;
      border-top: none;
      padding: 10px;
      text-align: center;
      font-size: 11px;
    }

    @media print {
      body { background: white; padding: 0; }
      .report-card { border: none; width: 100%; }
      .no-print { display: none; }
      @page { size: A4; margin: 10mm; }
    }
    .no-print { text-align: center; padding: 20px; }
    button { padding: 10px 20px; cursor: pointer; font-weight: bold; }
  </style>
</head>
<body>

  <div class="no-print">
    <button onclick="window.print()">PRINT REPORT CARD</button>
  </div>
    
    <div class="report-card">
    <div class="header-container">
      <div class="logo">
        <img src="${schoolData?.logo_url || 'default-logo.png'}" alt="School Logo">
      </div>
      <div class="header-text">
        <h1 class="school-name">${schoolData?.name || 'School Name'}</h1>
        <div class="motto">MOTTO: ${schoolData?.motto || 'N/A'}</div>
        <p class="address">${schoolData?.address || 'Address not set'}</p>
        <p class="address" style="font-weight: bold;">TEL: ${schoolData?.phone_numbers || 'N/A'}
        </p>
      </div>
    </div>

    <div class="report-banner">CONTINUOUS ASSESSMENT REPORT</div>
    
    
    <div class="info-grid">
  <div class="info-item">
    <div class="label">Name</div>
    <div class="value">${U(row.students?.full_name)}</div>
  </div>

  <div class="info-item">
    <div class="label">Student ID</div>
    <div class="value">${U(row.students?.student_id || row.student_id)}</div>
  </div>

  <div class="info-item">
    <div class="label">Class</div>
    <div class="value">${U(row.class)}</div>
  </div>

  <div class="info-item">
    <div class="label">Gender</div>
    <div class="value">${U(row.gender || "N/A")}</div>
  </div>

  <div class="info-item">
    <div class="label">Term</div>
    <div class="value">${U(row.students?.current_term || row.term)}</div>
  </div>

  <div class="info-item">
    <div class="label">Academic Session</div>
    <div class="value">${U(row.students?.session || row.session || "N/A")}</div>
  </div>

  <div class="info-item">
    <div class="label">No. in Class</div>
    <div class="value">${U(classTotals.length)}</div>
  </div>

  <div class="info-item">
    <div class="label">Position</div>
    <div class="value">${U(formatPosition(position))}</div>
  </div>
</div>
    
    <div style="display: flex; gap: 15px;">
      <div style="flex: 1;">
        <div class="section-title">Attendance</div>
        <table>
          <thead><tr><th>Days Opened</th><th>Days Present</th><th>Days Absent</th></tr></thead>
          <tbody style="text-align:center;"><tr><td>${U(daysOpened)}</td><td>${U(daysPresent)}</td><td>${U(daysAbsent)}</td></tr></tbody>
        </table>
      </div>
      <div style="flex: 1;">
        <div class="section-title">Terminal Duration</div>
        <table>
          <thead><tr><th>Term Begins</th><th>Term Ends</th><th>Next Term</th></tr></thead>
          <tbody style="text-align:center;"><tr><td>${U(termBegins)}</td><td>${U(termEnds)}</td><td>${U(nextTermBegins)}</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="columns">
      <div class="left-col">
        <div class="section-title">Academic Progress Summaries (Cognitive)</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="text-align:left;">Subjects</th>
              <th colspan="2">Test Scores</th>
              <th>Exam</th>
              <th>Total</th>
              <th rowspan="2">Grade</th>
              <th rowspan="2">Comments</th>
            </tr>
            <tr class="sub-head">
              <th>20%</th><th>20%</th><th>60%</th><th>100%</th>
            </tr>
          </thead>
          <tbody>
            ${U(rowsHtml)}
            ${U(summaryRowHtml)}
          </tbody>
        </table>

        <div class="comment-section">
          <div class="comment-box">
            <strong>TEACHER'S COMMENT:</strong><br>${U(teacherComment || "...")}
          </div>
          <div class="comment-box">
            <strong>HEADMASTER'S COMMENT:</strong><br>${U(headmasterComment || "...")}
          </div>
        </div>
        <div class="signature-area" style="margin-top: 20px;">
  <strong>HEADMASTER'S SIGNATURE:</strong><br>
  <img 
    src="${schoolData?.headmaster_signature_url || 'default-signature.png'}" 
    alt="Headmaster Signature"
    style="height: 60px; max-width: 200px; object-fit: contain; margin-top: 5px;"
  >
  <div style="border-top: 1px solid #000; width: 200px; margin-top: 5px;"></div>
</div>
      </div>
      
      <div class="right-col">
  <div class="section-title">Affective Domain</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Behaviour</th>
        <th>100</th>
        <th>85</th>
        <th>75</th>
        <th>65</th>
        <th>55</th>
      </tr>
    </thead>
    <tbody>
      ${U(affectiveHtml || "<tr><td colspan='6' class='text-center'>No data</td></tr>")}
    </tbody>
  </table>

  <div class="section-title">Psychomotor Domain</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Activities</th>
        <th>100</th>
        <th>85</th>
        <th>75</th>
        <th>65</th>
        <th>55</th>
      </tr>
    </thead>
    <tbody>
      ${U(psychomotorHtml || "<tr><td colspan='6' class='text-center'>No data</td></tr>")}
    </tbody>
  </table>
</div>
    </div>
  </div>
</body>
</html>
`;
    
    const newWindow = window.open("", "_blank");
    newWindow.document.write(reportHtml);
    newWindow.document.close();

      renderResultReport(row, results, classTotals.length, position, percentage, overallGrade);
    })
    .catch(err => {
      console.error(err);
      alert("Error loading report.");
    });
}

// ---------- 4. Edit Modal Logic ----------
async function handleEditClick(studentId, className, term, session) {
  try {
    // ---------- FETCH SINGLE STUDENT RESULT using composite key ----------
    const { data, error } = await supabaseClient
      .from("results")
      .select("*, students(full_name, student_id, sex)")
      .match({
        student_id: studentId,
        class: className,
        term: term,
        session: session
      })
      .single(); // ensures a single object is returned

    if (error || !data) return alert("Result not found.");
    currentEditingResult = data;

    // ---------- NORMALIZE JSON FIELDS ----------
    const subjects = Array.isArray(data.results)
      ? data.results
      : JSON.parse(data.results || "[]");

    const psychomotor = typeof data.psychomotor_domain === "string"
      ? JSON.parse(data.psychomotor_domain)
      : data.psychomotor_domain || {};

    const affective = typeof data.affective_domain === "string"
      ? JSON.parse(data.affective_domain)
      : data.affective_domain || {};

    const attendance = typeof data.attendance === "string"
      ? JSON.parse(data.attendance)
      : data.attendance || {};

    const termDuration = typeof data.term_duration === "string"
      ? JSON.parse(data.term_duration)
      : data.term_duration || {};

    // ---------- 1. Subjects ----------
    const subjectFieldsHtml = subjects.map((s, i) => `
      <div class="p-3 border rounded-xl bg-gray-50 mb-3 subject-row" data-subject-id="${s.subject_id ?? i}">
        <label class="block text-[10px] font-black uppercase text-gray-500 mb-2">${s.subject_name ?? "Subject"}</label>
        <div class="grid grid-cols-3 gap-3">
          <input type="number" name="test1_${s.subject_id ?? i}" value="${s.test1 ?? 0}" class="border p-2 text-center rounded-lg font-bold" placeholder="T1">
          <input type="number" name="test2_${s.subject_id ?? i}" value="${s.test2 ?? 0}" class="border p-2 text-center rounded-lg font-bold" placeholder="T2">
          <input type="number" name="exam_${s.subject_id ?? i}" value="${s.exam ?? 0}" class="border p-2 text-center rounded-lg font-bold bg-white border-blue-200" placeholder="Exam">
        </div>
      </div>
    `).join("") || "<p class='text-xs text-gray-400'>No subjects found</p>";

    // ---------- 2. Psychomotor ----------
    const psychomotorHtml = Object.entries(psychomotor).map(([skill, val]) => `
      <div class="flex items-center gap-3 mb-2">
        <label class="flex-1 text-[10px] font-bold uppercase">${skill.replace(/_/g, " ")}</label>
        <input type="number" name="psych_${skill}" value="${val ?? ""}" class="w-16 text-center border rounded-lg p-1">
      </div>
    `).join("") || "<p class='text-xs text-gray-400'>No data</p>";

    // ---------- 3. Affective ----------
    const affectiveHtml = Object.entries(affective).map(([trait, val]) => `
      <div class="flex items-center gap-3 mb-2">
        <label class="flex-1 text-[10px] font-bold uppercase">${trait.replace(/_/g, " ")}</label>
        <input type="number" name="affective_${trait}" value="${val ?? ""}" class="w-16 text-center border rounded-lg p-1">
      </div>
    `).join("") || "<p class='text-xs text-gray-400'>No data</p>";

    // ---------- 4. Attendance ----------
    const attendanceHtml = `
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label class="text-[10px] font-bold uppercase">Days Opened</label>
          <input type="number" name="attendance_days_opened" value="${attendance.days_opened ?? ""}" class="border p-1 w-full">
        </div>
        <div>
          <label class="text-[10px] font-bold uppercase">Days Present</label>
          <input type="number" name="attendance_days_present" value="${attendance.days_present ?? ""}" class="border p-1 w-full">
        </div>
        <div>
          <label class="text-[10px] font-bold uppercase">Days Absent</label>
          <input type="number" name="attendance_days_absent" value="${attendance.days_absent ?? ""}" class="border p-1 w-full">
        </div>
      </div>
    `;

    // ---------- 5. Term Duration ----------
    const termDurationHtml = `
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label class="text-[10px] font-bold uppercase">Term Begins</label>
          <input type="date" name="term_begins" value="${termDuration.term_begins ?? ""}" class="border p-1 w-full">
        </div>
        <div>
          <label class="text-[10px] font-bold uppercase">Term Ends</label>
          <input type="date" name="term_ends" value="${termDuration.term_ends ?? ""}" class="border p-1 w-full">
        </div>
        <div>
          <label class="text-[10px] font-bold uppercase">Next Term Begins</label>
          <input type="date" name="next_term_begins" value="${termDuration.next_term_begins ?? ""}" class="border p-1 w-full">
        </div>
      </div>
    `;

    // ---------- 6. Comments ----------
    const commentsHtml = `
      <div class="p-3 border rounded-xl bg-gray-50 mb-3">
        <label class="block text-[10px] font-black uppercase text-gray-500 mb-2">Teacher Comment</label>
        <textarea name="teacher_comment" class="w-full border p-2 rounded-lg" rows="3">${data.teacher_comment ?? ""}</textarea>
      </div>
      <div class="p-3 border rounded-xl bg-gray-50 mb-3">
        <label class="block text-[10px] font-black uppercase text-gray-500 mb-2">Headmaster Comment</label>
        <textarea name="headmaster_comment" class="w-full border p-2 rounded-lg" rows="3">${data.headmaster_comment ?? ""}</textarea>
      </div>
    `;

    // ---------- 7. Render everything ----------
    editResultSubjects.innerHTML = `
      <div class="mb-6 text-center border-b pb-4">
        <h3 class="font-black text-blue-600">${data.students?.full_name}</h3>
        <p class="text-xs text-gray-400 font-bold">ID: ${data.students?.student_id}</p>
        <p class="text-xs text-gray-400 font-bold">Gender: <input type="text" name="gender" value="${data.gender ?? ""}" class="border p-1 w-24 text-center"></p>
        <p class="text-xs text-gray-400 font-bold">Term: <input type="text" name="term" value="${data.term ?? ""}" class="border p-1 w-24 text-center"></p>
        <p class="text-xs text-gray-400 font-bold">Session: <input type="text" name="session" value="${data.session ?? ""}" class="border p-1 w-24 text-center"></p>
      </div>

      ${subjectFieldsHtml}

      <h3 class="mt-4 font-bold">Psychomotor Domain</h3>
      ${psychomotorHtml}

      <h3 class="mt-4 font-bold">Affective Domain</h3>
      ${affectiveHtml}

      <h3 class="mt-4 font-bold">Attendance</h3>
      ${attendanceHtml}

      <h3 class="mt-4 font-bold">Term Duration</h3>
      ${termDurationHtml}

      ${commentsHtml}

      <div class="mt-8 flex gap-3">
        <button type="submit" class="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black">SAVE CHANGES</button>
        <button type="button" onclick="closeModal()" class="flex-1 bg-gray-100 text-gray-500 py-4 rounded-2xl font-black">CANCEL</button>
      </div>
    `;

    // show modal
    editResultModal.classList.remove("hidden");

  } catch (err) {
    console.error(err);
    alert("Fetch error.");
  }
}

// ---------- 5. Update & Delete ----------
editResultForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!currentEditingResult) return;

  try {
    // ---------- 1. Update subject results ----------
    const updatedResults = (currentEditingResult.results || []).map((s, i) => {
      const t1 = parseInt(editResultForm[`test1_${s.subject_id ?? i}`]?.value) || 0;
      const t2 = parseInt(editResultForm[`test2_${s.subject_id ?? i}`]?.value) || 0;
      const ex = parseInt(editResultForm[`exam_${s.subject_id ?? i}`]?.value) || 0;
      const total = t1 + t2 + ex;
      return {
        subject_id: s.subject_id || i,
        subject_name: s.subject_name,
        test1: t1,
        test2: t2,
        exam: ex,
        total,
        grade: calculateGrade(total)
      };
    });

    // ---------- 2. Update psychomotor ----------
    const psychomotorData = {};
    Object.keys(currentEditingResult.psychomotor_domain || {}).forEach(key => {
      psychomotorData[key] = parseInt(editResultForm[`psych_${key}`]?.value) || 0;
    });

    // ---------- 3. Update affective ----------
    const affectiveData = {};
    Object.keys(currentEditingResult.affective_domain || {}).forEach(key => {
      affectiveData[key] = parseInt(editResultForm[`affective_${key}`]?.value) || 0;
    });

    // ---------- 4. Update comments ----------
    const teacherComment = editResultForm["teacher_comment"]?.value.trim() || "";
    const headmasterComment = editResultForm["headmaster_comment"]?.value.trim() || "";

    // ---------- 5. Update gender, term, session ----------
    const gender = editResultForm["gender"]?.value || "";
    const term = editResultForm["term"]?.value || "";
    const session = editResultForm["session"]?.value || "";

    // ---------- 6. Update attendance ----------
    const attendance = {
      days_opened: parseInt(editResultForm["attendance_days_opened"]?.value) || 0,
      days_present: parseInt(editResultForm["attendance_days_present"]?.value) || 0,
      days_absent: parseInt(editResultForm["attendance_days_absent"]?.value) || 0
    };

    // ---------- 7. Update term duration ----------
    const termDuration = {
      term_begins: editResultForm["term_begins"]?.value || "",
      term_ends: editResultForm["term_ends"]?.value || "",
      next_term_begins: editResultForm["next_term_begins"]?.value || ""
    };

    // ---------- 8. Build payload ----------
    const payload = {
      results: updatedResults,
      psychomotor_domain: psychomotorData,
      affective_domain: affectiveData,
      teacher_comment: teacherComment,
      headmaster_comment: headmasterComment,
      gender,
      term,
      session,
      attendance,
      term_duration: termDuration
    };

    // ---------- 9. Submit update ----------
    const { error } = await supabaseClient
      .from("results")
      .update(payload)
      .eq("student_id", currentEditingResult.student_id);

    if (error) throw error;

    alert("Saved Successfully!");
    closeModal();
    renderStudents(manageClassSelect.value);

  } catch (err) {
    console.error(err);
    alert("Failed to save changes: " + err.message);
  }
};

// ---------- Delete Result ----------
async function deleteResult(studentId, className, term, session) {
  if (!confirm("Delete this result permanently?")) return;

  const { error } = await supabaseClient
    .from("results")
    .delete()
    .match({
      student_id: studentId,
      class: className,
      term: term,
      session: session
    });

  if (!error) renderStudents(manageClassSelect.value);
}

// ---------- Close Modal ----------
function closeModal() {
  editResultModal.classList.add("hidden");
  editResultSubjects.innerHTML = "";
  currentEditingResult = null;
}

//INIT
document.addEventListener("DOMContentLoaded", async () => {
  const classes = await loadClasses(); // your reusable function to get classes

  populateClassDropdown({
    classes,
    dropdownId: "manageResultClassDropdown",      // the clickable div
    selectId: "manageResultClass",                // hidden <select>
    textId: "manageResultClassSelectedText",      // placeholder span
    placeholder: "--Select Class--",
    resetOption: true                              // optional, allows reset
  });

  // Attach change listener if you need to do something on selection
  document.getElementById("manageResultClass").addEventListener("change", e => {
    const className = e.target.value?.trim();
    console.log("Selected class:", className);
    // You can call a function here, e.g., fetchResults(className);
  });
});

/* =======================
   FORM SUBMISSIONS
======================= */
// Register student
const spinner = document.getElementById("loading-spinner");

function showSpinner(message = "Uploading... Please wait") {
  if (!spinner) return;
  // Update spinner text
  spinner.querySelector("div:nth-child(2)").textContent = message;
  spinner.classList.remove("hidden");
}

function hideSpinner() {
  spinner?.classList.add("hidden");
}

// Register Student
document.getElementById("registrationForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const studentPhotoInput = document.getElementById("studentPhoto");

  const payload = {
    student_id: form.studentId.value,
    full_name: form.fullName.value,
    sex: form.sex.value || null,
    date_of_birth: form.dateOfBirth.value || null,
    nationality: form.nationality.value || null,
    state_of_origin: form.stateOfOrigin.value || null,
    lga: form.lga.value || null,
    student_address: form.studentAddress.value || null,
    parent_name: form.parentName.value || null,
    parent_phone: form.parentPhone.value || null,
    parent_email: form.parentEmail.value || null,
    guardian_name: form.guardianName.value || null,
    guardian_phone: form.guardianPhone.value || null,
    guardian_email: form.guardianEmail.value || null,
    student_class: form.studentClass.value || null,
    admission_class: form.admissionClass.value || null,
    sibling_name: form.siblingName ? form.siblingName.value : null,
    sibling_class: form.siblingClass ? form.siblingClass.value : null,
    sibling_sex: form.siblingGender ? form.siblingGender.value : null,
    image_url: null,
    image_path: null, // ✅ new field for deletion
  };

  try {
    // ✅ Show spinner
    showSpinner("Registering student...");

    // --------------------------
    // Get Admin Session (once)
    // --------------------------
    const { data: { session }, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError || !session)
      throw new Error("Admin not authenticated");

    // --------------------------
    // Upload Image if Provided
    // --------------------------
    const file = studentPhotoInput?.files[0];
    if (file) {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(
        "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/upload-student-images",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Image upload failed");

      payload.image_url = result.image_url;
      payload.image_path = result.image_path; // ✅ save path in DB
    }

    // --------------------------
    // Insert Student
    // --------------------------
    const { error } = await supabaseClient.from("students").insert(payload);
    if (error) throw error;

    /* alert("Student registered successfully!");
form.reset();

resetImagePreview("preview-student", "placeholder-student", "studentPhoto");

fetchStudents();
showSection("register"); */

alert("Student registered successfully!");
form.reset();

// FULL IMAGE RESET (CORRECT)
resetImagePreview({
  previewId: "preview-student",
  placeholderId: "placeholder-student",
  inputId: "studentPhoto"
});

fetchStudents();
showSection("register");

  } catch (err) {
    console.error(err);
    alert("Failed to register student: " + err.message);
  } finally {
    // ✅ Always hide spinner
    hideSpinner();
  }
});

 /*document.getElementById("editStudentForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;

  const id = form.dataset.id;
  if (!id) return alert("Missing student ID");

  const payload = {
    student_id: form.studentId.value,
    full_name: form.fullName.value,
    sex: form.sex.value || null,
    date_of_birth: form.dateOfBirth.value || null,
    nationality: form.nationality.value?.trim() || null,
    state_of_origin: form.stateOfOrigin.value?.trim() || null,
    lga: form.lga.value?.trim() || null,
    student_address: form.studentAddress.value?.trim() || null,
    parent_name: form.parentName.value?.trim() || null,
    parent_phone: form.parentPhone.value?.trim() || null,
    parent_email: form.parentEmail.value?.trim() || null,
    guardian_name: form.guardianName.value?.trim() || null,
    guardian_phone: form.guardianPhone.value?.trim() || null,
    guardian_email: form.guardianEmail.value?.trim() || null,
    student_class: form.studentClass.value || null,
    admission_class: form.admissionClass.value || null,
    sibling_name: form.siblingName?.value?.trim() || null,
    sibling_class: form.siblingClass?.value || null,
    sibling_sex: form.siblingGender?.value || null
  };

  try {
    await updateStudent(id, payload);
    alert("Student updated successfully!");
    document.getElementById("editStudentModal").classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert("Failed to update student");
  }
}); */

 /* document.getElementById("editStudentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const id = form.dataset.id;
  if (!id) return alert("Missing student ID");

  const fileInput = document.getElementById("edit-student-photo");
  const file = fileInput?.files[0];

  const payload = {
    student_id: form.studentId.value,
    full_name: form.fullName.value,
    sex: form.sex.value || null,
    date_of_birth: form.dateOfBirth.value || null,
    nationality: form.nationality.value?.trim() || null,
    state_of_origin: form.stateOfOrigin.value?.trim() || null,
    lga: form.lga.value?.trim() || null,
    student_address: form.studentAddress.value?.trim() || null,
    parent_name: form.parentName.value?.trim() || null,
    parent_phone: form.parentPhone.value?.trim() || null,
    parent_email: form.parentEmail.value?.trim() || null,
    guardian_name: form.guardianName.value?.trim() || null,
    guardian_phone: form.guardianPhone.value?.trim() || null,
    guardian_email: form.guardianEmail.value?.trim() || null,
    student_class: form.studentClass.value || null,
    admission_class: form.admissionClass.value || null,
    sibling_name: form.siblingName?.value?.trim() || null,
    sibling_class: form.siblingClass?.value || null,
    sibling_sex: form.siblingGender?.value || null
  };

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    // =========================
    // IMAGE REPLACEMENT LOGIC
    // =========================
    if (file) {

      // 1. Get existing image path
      const { data: existing, error: fetchError } = await supabaseClient
        .from("students")
        .select("image_path")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // 2. Delete old image (safe)
      if (existing?.image_path) {
        const { error: deleteError } = await supabaseClient.storage
          .from("student-images")
          .remove([existing.image_path]);

        if (deleteError) {
          console.warn("Old image delete failed:", deleteError.message);
        }
      }

      // 3. Upload new image
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(
        "https://irelkjvppoisvjpopdpb.functions.supabase.co/upload-student-images",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Image upload failed");

      // 4. attach new image data
      payload.image_url = result.image_url;
      payload.image_path = result.image_path;
    }

    // =========================
    // UPDATE VIA YOUR REUSABLE FUNCTION
    // =========================
    await updateStudent(id, payload);

    alert("Student updated successfully!");
    document.getElementById("editStudentModal").classList.add("hidden");

  } catch (err) {
    console.error(err);
    alert("Failed to update student: " + err.message);
  }
}); */

document.getElementById("editStudentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const id = form.dataset.id;
  if (!id) return alert("Missing student ID");

  const fileInput = document.getElementById("edit-student-photo");
  const file = fileInput?.files?.[0] || null;

  const payload = {
    student_id: form.studentId.value,
    full_name: form.fullName.value,
    sex: form.sex.value || null,
    date_of_birth: form.dateOfBirth.value || null,
    nationality: form.nationality.value?.trim() || null,
    state_of_origin: form.stateOfOrigin.value?.trim() || null,
    lga: form.lga.value?.trim() || null,
    student_address: form.studentAddress.value?.trim() || null,
    parent_name: form.parentName.value?.trim() || null,
    parent_phone: form.parentPhone.value?.trim() || null,
    parent_email: form.parentEmail.value?.trim() || null,
    guardian_name: form.guardianName.value?.trim() || null,
    guardian_phone: form.guardianPhone.value?.trim() || null,
    guardian_email: form.guardianEmail.value?.trim() || null,
    student_class: form.studentClass.value || null,
    admission_class: form.admissionClass.value || null,
    sibling_name: form.siblingName?.value?.trim() || null,
    sibling_class: form.siblingClass?.value || null,
    sibling_sex: form.siblingGender?.value || null
  };

  try {
    showSpinner("Updating student...");

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    let image_url = null;
    let image_path = null;

    // =========================
    // IMAGE UPDATE VIA EDGE FUNCTION
    // =========================
    if (file) {
      const { data: existing, error: fetchError } = await supabaseClient
        .from("students")
        .select("image_path")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const formData = new FormData();
      formData.append("student_id", id);
      formData.append("file", file);
      formData.append("existing_path", existing?.image_path || "");

      const res = await fetch(
        "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/update-student-image",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      const result = await res.json();

      if (!res.ok) {
        console.error(result);
        throw new Error(result.error || "Image upload failed");
      }

      image_url = result.image_url;
      image_path = result.image_path;
    }

    // attach image updates only if changed
    if (image_url) payload.image_url = image_url;
    if (image_path) payload.image_path = image_path;

    await updateStudent(id, payload);

    alert("Student updated successfully!");
    document.getElementById("editStudentModal").classList.add("hidden");

  } catch (err) {
    console.error(err);
    alert("Failed to update student: " + err.message);

  } finally {
    hideSpinner();
  }
});

//Add Teacher
document.getElementById("teacherForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  // ---------------------------
  // Build payload
  // ---------------------------
  const payload = {
    teacher_id: form.teacherId.value.trim(),
    full_name: form.fullName.value.trim(),
    phone: form.phone.value.trim() || null,
    email: form.email.value.trim(),
    password: form.password.value.trim(),
    qualification: form.qualification.value.trim() || null,
    subject_specialization: form.subjectSpecialization.value.trim() || null,
    class_teacher: form.classTeacher.value.trim(),
    years_of_experience: parseInt(form.yearsOfExperience.value) || null,
    joining_date: form.joiningDate.value || null,
    image_url: null,   // ✅ for frontend display
    image_path: null   // ✅ for deletion later
  };

  if (!payload.teacher_id || !payload.email || !payload.password) {
    return alert("Teacher ID, Email, and Password are required");
  }

  try {
    showSpinner("Uploading teacher...");

    // ---------------------------
    // 🔐 Get session
    // ---------------------------
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) throw new Error("Admin not authenticated");

    const token = session.access_token;

    // ---------------------------
    // 🔥 1. UPLOAD IMAGE
    // ---------------------------
    const file = document.getElementById("teacherPhoto")?.files[0];

    if (file) {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(
        "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/upload-teacher-images",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        }
      );

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Image upload failed");

      // ✅ Save both public URL and storage path
      payload.image_url = uploadData.url;
      payload.image_path = uploadData.path; 
    }

    // ---------------------------
    // 🔥 2. CREATE TEACHER
    // ---------------------------
    const res = await fetch(
      "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/create-teacher",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create teacher");

    // ---------------------------
    // ✅ SUCCESS
    // ---------------------------
    /* alert(`Teacher added!\nEmail: ${data.email}`);

    form.reset();
    resetImagePreview("preview-teacher", "placeholder-teacher", "teacherPhoto");
    await fetchTeachers(); */
    
    alert(`Teacher added!\nEmail: ${data.email}`);

form.reset();

// extra safety for file input
const input = document.getElementById("teacherPhoto");
if (input) input.value = "";

resetImagePreview({
  previewId: "preview-teacher",
  placeholderId: "placeholder-teacher",
  inputId: "teacherPhoto"
});

await fetchTeachers();

  } catch (err) {
    console.error("Teacher creation error:", err);
    alert("Failed to add teacher: " + (err.message || JSON.stringify(err)));
  } finally {
    hideSpinner();
  }
});

 /* document.getElementById("editTeacherForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const uuid = form.editTeacherUuid.value;
  if (!uuid) return alert("Missing teacher ID for update");

  const fileInput = document.getElementById("teacherPhotoEdit");
  const file = fileInput?.files?.[0] || null;

  const payload = {
    teacher_id: form.teacherId.value,
    full_name: form.fullName.value,
    phone: form.phone.value || null,
    qualification: form.qualification.value || null,
    subject_specialization: form.subjectSpecialization.value || null,
    class_teacher: form.classTeacher.value || null,
    years_of_experience: parseInt(form.yearsOfExperience.value) || null,
    joining_date: form.joiningDate.value || null
  };

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    let image_url = null;
    let image_path = null;

    // =========================
    // IMAGE UPLOAD (FIXED)
    // =========================
    if (file) {

      const { data: existing } = await supabaseClient
        .from("teachers")
        .select("image_path")
        .eq("id", uuid)
        .single();

      if (existing?.image_path) {
        await supabaseClient.storage
          .from("teacher-images")
          .remove([existing.image_path]);
      }

      const formData = new FormData();

      // ✅ FIX: MUST MATCH REGISTER ("file")
      formData.append("file", file);

      const res = await fetch(
        "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/upload-teacher-images",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      const result = await res.json();

      if (!res.ok) {
        console.error("Upload error:", result);
        throw new Error(result.error || "Image upload failed");
      }

      // ✅ FIX: MATCH REGISTER RESPONSE FORMAT
      image_url = result.url;
      image_path = result.path;
    }

    // attach only if updated
    if (image_url) payload.image_url = image_url;
    if (image_path) payload.image_path = image_path;

    await updateTeacher(uuid, payload);

    alert("Teacher updated successfully!");
    document.getElementById("editTeacherModal").classList.add("hidden");

  } catch (err) {
    console.error("Teacher update failed:", err);
    alert("Failed to update teacher: " + err.message);
  }
}); */

document.getElementById("editTeacherForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const uuid = form.editTeacherUuid.value;
  if (!uuid) return alert("Missing teacher ID for update");

  const fileInput = document.getElementById("teacherPhotoEdit");
  const file = fileInput?.files?.[0] || null;

  const payload = {
    teacher_id: form.teacherId.value,
    full_name: form.fullName.value,
    phone: form.phone.value || null,
    qualification: form.qualification.value || null,
    subject_specialization: form.subjectSpecialization.value || null,
    class_teacher: form.classTeacher.value || null,
    years_of_experience: parseInt(form.yearsOfExperience.value) || null,
    joining_date: form.joiningDate.value || null
  };

  try {
    showSpinner("Updating teacher...");

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    let image_url = null;
    let image_path = null;

    // =========================
    // IMAGE UPDATE VIA EDGE FUNCTION
    // =========================
    if (file) {
      const { data: existing, error: fetchError } = await supabaseClient
        .from("teachers")
        .select("image_path")
        .eq("id", uuid)
        .single();

      if (fetchError) throw fetchError;

      const formData = new FormData();
      formData.append("teacher_id", uuid);
      formData.append("file", file);
      formData.append("existing_path", existing?.image_path || "");

      const res = await fetch(
        "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/update-teacher-image",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      const result = await res.json();

      if (!res.ok) {
        console.error("Image update error:", result);
        throw new Error(result.error || "Image upload failed");
      }

      image_url = result.image_url;
      image_path = result.image_path;
    }

    // attach only if changed
    if (image_url) payload.image_url = image_url;
    if (image_path) payload.image_path = image_path;

    // =========================
    // UPDATE TEACHER RECORD
    // =========================
    await updateTeacher(uuid, payload);

    alert("Teacher updated successfully!");
    document.getElementById("editTeacherModal").classList.add("hidden");

  } catch (err) {
    console.error("Teacher update failed:", err);
    alert("Failed to update teacher: " + err.message);

  } finally {
    hideSpinner();
  }
});

/* =======================
   INITIAL FETCH
======================= */
document.addEventListener("DOMContentLoaded", () => {
  fetchStudents();
  fetchTeachers();
});

/* =======================
   REALTIME (v2)
======================= */
/* supabaseClient
  .channel("students-live")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "students" },
    () => fetchStudents()
  )
  .subscribe(); */
  
  function initRealtime() {
  const channels = [
    {
      name: "students-live",
      table: "students",
      handler: fetchStudents
    },
    {
      name: "teachers-live",
      table: "teachers",
      handler: fetchTeachers
    },
    {
      name: "subjects-live",
      table: "subjects",
      handler: fetchSubjects
    },
    {
      name: "results-live",
      table: "results",
      handler: () => {
        // 🔥 IMPORTANT: only refresh filtered UI if class is selected
        const classId = document.getElementById("manageResultClass")?.value;

        if (!classId) return;

        refreshManageResultsView();
      }
    }
  ];

  channels.forEach(({ name, table, handler }) => {
    supabaseClient
      .channel(name)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        handler
      )
      .subscribe();
  });
}

initRealtime();