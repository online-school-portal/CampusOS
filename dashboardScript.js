
const SUPABASE_URL = "https://irelkjvppoisvjpopdpb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyZWxranZwcG9pc3ZqcG9wZHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNTUwMDAsImV4cCI6MjA4MTkzMTAwMH0.osF4wEZ-zm3cXScD1W8gMOkG81O2TbDJ8L47YvIIryw";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storage: window.localStorage,
    },
  }
);


/* =======================
   GLOBAL STATE
======================= */
let selected = {
  studentClassFilterId: null,
  admissionClassId: null,
  currentClassId: null,
  siblingClassId: null,

  manageResultClassId: null,
  manageResultStudentId: null,

  resultClassId: null,
  resultStudentId: null,

  transferClassId: null,
  transferStudentId: null,
  newClassId: null,

  subjectClassFilter: null
};


/* =======================
   GLOBAL VARIABLE
======================= */
let allStudents = [];
let allTeachers = [];
let allClasses = [];
let allSubjects = [];


// ===============================
// NAVIGATION SECTION
// ===============================
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

    showSection("overview");

    await loadSchoolLogo();

    loadDashboard(session);

  } catch (err) {
    console.error("Init error:", err);
    window.location.href = "index.html";
  }
});

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

  // Close navigation
  const navLinks = document.getElementById("navLinks");
  const hamburger = document.getElementById("hamburger");

  if (navLinks && hamburger) {
    navLinks.classList.remove("active");
    hamburger.classList.remove("active");
  }
}

document.addEventListener("click", (e) => {

  const navLinks = document.getElementById("navLinks");
  const hamburger = document.getElementById("hamburger");

  if (!navLinks || !hamburger) return;

  const clickedInsideMenu = navLinks.contains(e.target);
  const clickedHamburger = hamburger.contains(e.target);

  if (
    navLinks.classList.contains("active") &&
    !clickedInsideMenu &&
    !clickedHamburger
  ) {
    navLinks.classList.remove("active");
    hamburger.classList.remove("active");
  }
});

//Nav toggle dropdown
function toggleDropdown(btn, menuId) {
  const menu = document.getElementById(menuId);
  const chevron = btn.querySelector(".chevron");

  if (!menu) return;

  menu.classList.toggle("show");

  if (chevron) {
    chevron.classList.toggle("rotate");
  }
}


// ===============================
// LOGOUT
// ===============================
/*const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}

async function logout() {
  try {
    showSpinner("Logging out...");

    await new Promise(resolve => setTimeout(resolve, 0));

    await new Promise(resolve => setTimeout(resolve, 300));

    localStorage.removeItem("userSession");
    sessionStorage.clear();

    window.location.href = "index.html";

  } catch (err) {
    console.error("Logout error:", err);
    hideSpinner();
  }
}*/

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}

async function logout() {
  try {
    showSpinner("Logging out...");

    await new Promise(resolve => setTimeout(resolve, 300));

    // Clear auth/session data
    localStorage.removeItem("userSession");
    sessionStorage.clear();

    // GET SAVED HOMEPAGE
    const homepage =
      localStorage.getItem("schoolHomepage");

    localStorage.removeItem("schoolHomepage");

    // REDIRECT BACK TO SCHOOL HOME
    if (homepage) {
      window.location.href = homepage;
    } else {
      window.location.href =
        "https://campusoperatingsystem.com";
    }

  } catch (err) {
    console.error("Logout error:", err);
    hideSpinner();
  }
}

// ===============================
// SCHOOL LOGO
// ===============================
async function loadSchoolLogo() {
  try {
    const { data, error } = await supabaseClient
      .rpc("get_my_school_logo");

    if (error) throw error;

    if (data) {
      const img = document.getElementById("schoolLogo");
      img.src = data;
      img.classList.remove("hidden");
    }

  } catch (err) {
    console.error("Logo load error:", err);
  }
}


/*********************************
 * LOAD DASHBOARD
 *********************************/
async function loadDashboard(session) {
  showSpinner("Loading dashboard...");

  try {
    const userId = session.user.id;

    console.log("🚀 loadDashboard fired");

    // 1️⃣ ROLE DETECTION
    const [{ data: teacher }, { data: admin }, { data: student }] =
      await Promise.all([
        supabaseClient
          .from("teachers")
          .select("teacher_id, full_name, class_teacher, subject_specialization, image_url, auth_id")
          .eq("auth_id", userId)
          .maybeSingle(),

        supabaseClient
          .from("admins")
          .select("name, role, image_url, auth_id")
          .eq("auth_id", userId)
          .maybeSingle(),

        supabaseClient
          .from("students")
          .select("student_id, full_name, image_url, auth_id")
          .eq("auth_id", userId)
          .maybeSingle()
      ]);

    let role = null;
    let profile = null;

    if (admin) {
      role = "admin";
      profile = admin;
    } else if (teacher) {
      role = "teacher";
      profile = teacher;
    } else if (student) {
      role = "student";
      profile = student;
    }

    if (!role) {
      console.warn("User has no role in DB");
      window.location.href = "index.html";
      return;
    }

    showSpinner("Loading profile...");
    
    // 2️⃣ SCHOOL ID
    let school_id = null;

    const { data: schoolData, error: schoolError } =
      await supabaseClient.rpc("current_user_school_id");

    if (schoolError) {
      console.error("School RPC error:", schoolError);
    } else {
      school_id = schoolData;
    }
    
    // 3️⃣ PROFILE IMAGE
    const imgMap = {
      admin: "adminProfileImage",
      teacher: "teacherProfileImage",
      student: "studentProfileImage"
    };

    const img = document.getElementById(imgMap[role]);

    if (img) {
      img.src = profile.image_url || "default-avatar.png";
      img.onerror = () => (img.src = "default-avatar.png");
    }

    // 4️⃣ ROLE UI
    applyRoleVisibility(role);

    if (typeof showSection === "function") {
      showSection("overview");
    }

    showSpinner("Loading stats...");

    // 5️⃣ PROFILE UI
    if (role === "admin") {
      document.getElementById("adminName") &&
        (document.getElementById("adminName").textContent = profile.name || "Admin");

      document.getElementById("adminRole") &&
        (document.getElementById("adminRole").textContent = "Role: admin");
    }

    if (role === "teacher") {
      const classes = profile.class_teacher
        ? profile.class_teacher.split(",").map(c => c.trim()).filter(Boolean)
        : [];

      const subjects = profile.subject_specialization
        ? profile.subject_specialization.split(",").map(s => s.trim()).filter(Boolean)
        : [];

      document.getElementById("teacherName") &&
        (document.getElementById("teacherName").textContent = profile.full_name || "Teacher");

      document.getElementById("teacherIdDisplayValue") &&
        (document.getElementById("teacherIdDisplayValue").textContent = profile.teacher_id || "N/A");

      document.getElementById("assignedClassesCount") &&
        (document.getElementById("assignedClassesCount").textContent = classes.length);

      document.getElementById("subjectsCount") &&
        (document.getElementById("subjectsCount").textContent = subjects.length);
    }

    if (role === "student") {
      document.getElementById("studentName") &&
        (document.getElementById("studentName").textContent = profile.full_name || "Student");

      document.getElementById("studentIdDisplayValue") &&
        (document.getElementById("studentIdDisplayValue").textContent = profile.student_id || "N/A");
    }
    
    if (role === "student") {
  const { count: myResultsCount } = await supabaseClient
    .from("results")
    .select("*", { count: "exact", head: true })
    .eq("student_id", profile.id);
}

    // 6️⃣ DASHBOARD COUNTS
    const [teacherCountRes, studentCountRes, resultsCountRes] = await Promise.all([
  supabaseClient
    .from("teachers")
    .select("*", { count: "exact", head: true })
    .eq("school_id", school_id),

  supabaseClient
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("school_id", school_id),

  supabaseClient
    .from("results")
    .select("*", { count: "exact", head: true })
    .eq("school_id", school_id)
]);

    const teacherCount = teacherCountRes.count ?? 0;
    const studentCount = studentCountRes.count ?? 0;
    const resultsCount = resultsCountRes.count ?? 0;

document.getElementById("totalResultsCount") &&
  (document.getElementById("totalResultsCount").textContent = resultsCount);

    document.getElementById("totalStudentsCount") &&
      (document.getElementById("totalStudentsCount").textContent = studentCount);

    document.getElementById("totalTeachers") &&
      (document.getElementById("totalTeachers").textContent = teacherCount);

    // 7️⃣ STUDENT TABLE
    showSpinner("Loading students...");

    const { data: studentsData, error } = await supabaseClient
      .from("students")
      .select("*")
      .eq("school_id", school_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Student fetch error:", error);
    } else if (typeof loadStudents === "function") {
      loadStudents(studentsData || []);
    }

    console.log("Dashboard fully loaded");

  } catch (err) {
  console.error("Dashboard error:", err);

  if (!session?.user) {
    window.location.href = "index.html";
  }

  }finally {
    hideSpinner();
  }
}


/*********************************
 * ROLE-BASED VISIBILITY
 *********************************/
function applyRoleVisibility(role) {
  document.querySelectorAll("[data-role]").forEach(el => {
    const roles = el.dataset.role
      .toLowerCase()
      .split(",")
      .map(r => r.trim());

    el.style.display = roles.includes(role) ? "" : "none";
  });
}


/* ===============================
   CREATE STUDENT SELECTOR
================================ */
function populateStudentDropdown({
  students,
  dropdownId,
  selectId,
  textId,
  placeholder = "Select student",
  stateKey = null
}) {
  const dropdown = document.getElementById(dropdownId);
  const select = document.getElementById(selectId);
  const text = document.getElementById(textId);

  if (!dropdown || !select || !text) return;

  dropdown.innerHTML = "";
  select.innerHTML = `<option value="">${placeholder}</option>`;
  text.textContent = placeholder;

  students.forEach(student => {

    const option = document.createElement("option");
    option.value = student.id;
    option.textContent = student.full_name;
    select.appendChild(option);

    const item = document.createElement("div");
    item.className = "student-option";

    item.innerHTML = `<span>${student.full_name}</span>`;

    item.onclick = () => {

      if (stateKey) {
        selected[stateKey] = student.id;
      }

      selectStudent({
        student,
        selectId,
        textId,
        dropdownId
      });
    };

    dropdown.appendChild(item);
  });
}

//SELECT STUDENT
function selectStudent({ student, selectId, textId, dropdownId }) {

  const select = document.getElementById(selectId);
  const text = document.getElementById(textId);

  select.value = student.id;

  text.innerHTML = `
    <img src="${student.image_url || "default-avatar.png"}"
         class="student-avatar">
    ${student.full_name}
  `;

  toggleStudentDropdown(dropdownId);
}

//HELPERS
function resetDropdown({ selectId, textId, placeholder, stateKey }) {
  const select = document.getElementById(selectId);
  const text = document.getElementById(textId);

  if (select) select.value = "";
  if (text) text.textContent = placeholder;

  if (stateKey) {
    selected[stateKey] = null;
  }
}


// ===============================
// POPULATE CLASS DROPDOWN
// ===============================

const classDropdownRegistry = [];

function populateClassDropdown({
  classes = [],
  dropdownId,
  selectId,
  textId,
  placeholder = "Select a class",
  includeAll = false,
  resetOption = false,
  stateKey,
  onChange = null
}) {

  const dropdown = document.getElementById(dropdownId);
  const select = document.getElementById(selectId);
  const text = document.getElementById(textId);

  if (!dropdown || !select || !text || !stateKey) return;

  const alreadyRegistered =
    classDropdownRegistry.some(
      item =>
        item.dropdownId === dropdownId &&
        item.selectId === selectId
    );

  if (!alreadyRegistered) {

    classDropdownRegistry.push({
      dropdownId,
      selectId,
      textId,
      placeholder,
      includeAll,
      resetOption,
      stateKey,
      onChange
    });

  }

  // CLEAR EXISTING UI
  dropdown.innerHTML = "";

  select.innerHTML = "";

  // RESET STATE
  selected[stateKey] = null;

  select.value = "";

  text.textContent = placeholder;

  // HELPER
  function updateSelection(cls, label) {

    selected[stateKey] =
      cls?.id || null;

    select.value =
      cls?.id || "";

    text.textContent = label;

    toggleStudentDropdown(dropdownId);

    if (onChange) {
      onChange(cls);
    }

    select.dispatchEvent(
      new Event("change")
    );
  }

  // "ALL" OPTION
  if (includeAll) {

    const opt =
      document.createElement("option");

    opt.value = "all";

    opt.textContent = "All";

    select.appendChild(opt);

    const item =
      document.createElement("div");

    item.className = "student-option";

    item.textContent = "All";

    item.onclick = () =>
      updateSelection(
        {
          id: "all",
          name: "all"
        },
        "All"
      );

    dropdown.appendChild(item);

    updateSelection(
      {
        id: "all",
        name: "all"
      },
      "All"
    );
  }

  // RESET OPTION
  if (resetOption) {

    const item =
      document.createElement("div");

    item.className = "student-option";

    item.textContent = placeholder;

    item.onclick = () =>
      updateSelection(
        null,
        placeholder
      );

    dropdown.appendChild(item);
  }

  // POPULATE CLASSES
  classes.forEach(cls => {

    const opt =
      document.createElement("option");

    opt.value = cls.id;

    opt.textContent = cls.name;

    select.appendChild(opt);

    const item =
      document.createElement("div");

    item.className = "student-option";

    item.textContent = cls.name;

    item.onclick = () =>
      updateSelection(
        cls,
        cls.name
      );

    dropdown.appendChild(item);

  });

}

// LOAD CLASSES FROM DB
async function loadClasses() {

  try {

    const { data, error } =
      await supabaseClient
        .from("classes")
        .select("id, name")
        .order("name", {
          ascending: true
        });

    if (error) throw error;

    allClasses = data || [];

    return allClasses;

  } catch (err) {

    console.error(
      "Failed loading classes:",
      err
    );

    return [];
  }
}

// REFRESH ALL CLASS DROPDOWNS
function refreshAllClassDropdowns() {

  classDropdownRegistry.forEach(config => {

    populateClassDropdown({
      ...config,
      classes: allClasses
    });

  });

}

// REALTIME CLASS SYNC
function setupClassRealtime() {

  supabaseClient

    .channel("classes-realtime")

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "classes"
      },

      async payload => {

        console.log(
          "Class update detected:",
          payload
        );

        await loadClasses();

        refreshAllClassDropdowns();

      }
    )

    .subscribe();

}

// DROPDOWN TOGGLE
function toggleStudentDropdown(dropdownId) {

  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  dropdown.classList.toggle("show");

} 

//CLOSE WHEN CLICKING OUTSIDE
document.addEventListener("click", e => {

  document.querySelectorAll(".student-select").forEach(container => {

    const dropdown = container.querySelector(".student-dropdown");

    if (!container.contains(e.target)) {
      dropdown?.classList.remove("show");
    }

  });
});


// ===============================
// LUCIDE INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {

  if (window.lucide) {
    lucide.createIcons();
  }

});

function refreshIcons() {

  if (window.lucide) {
    lucide.createIcons();
  }

}

// INTERNAL HELPERS
function show(preview, placeholder) {

  preview.classList.remove("hidden");

  placeholder.classList.add("hidden");

}

function reset(preview, placeholder) {

  preview.src = "";

  preview.classList.add("hidden");

  placeholder.classList.remove("hidden");

  setTimeout(() => {
    refreshIcons();
  }, 0);

}

// MAIN IMAGE ENGINE
function setImagePreview({
  previewId,
  placeholderId,
  file = null,
  imageUrl = null
}) {

  const preview =
    document.getElementById(previewId);

  const placeholder =
    document.getElementById(placeholderId);

  if (!preview || !placeholder) return;

  // FILE PREVIEW
  if (file) {

    const reader = new FileReader();

    reader.onload = (e) => {

      preview.src = e.target.result;

      show(preview, placeholder);

    };

    reader.readAsDataURL(file);

    return;

  }

  // EXISTING URL
  if (imageUrl) {

    preview.src = imageUrl;

    preview.onload = () => {

      show(preview, placeholder);

    };

    preview.onerror = () => {

      reset(preview, placeholder);

    };

    return;

  }

  // RESET
  reset(preview, placeholder);

}

// RESET API
function resetImagePreview({
  previewId,
  placeholderId,
  inputId,
  cameraInputId
}) {

  const preview =
    document.getElementById(previewId);

  const placeholder =
    document.getElementById(placeholderId);

  const input =
    document.getElementById(inputId);

  const cameraInput =
    document.getElementById(cameraInputId);

  if (input) input.value = "";
  if (cameraInput) cameraInput.value = "";

  if (!preview || !placeholder) return;

  reset(preview, placeholder);
}

// SHARED FILE HANDLER
function bindPreview({
  input,
  previewId,
  placeholderId
}) {

  if (!input) return;

  input.addEventListener("change", () => {

    const file =
      input.files?.[0];

    if (!file) return;

    setImagePreview({
      previewId,
      placeholderId,
      file
    });

  });

}

// GALLERY UPLOADER
function initImageUploader({
  inputId,
  previewId,
  placeholderId,
  triggerId
}) {

  const input =
    document.getElementById(inputId);

  const trigger =
    document.getElementById(triggerId);

  if (!input || !trigger) return;

  if (input.dataset.initialized === "true") {
    return;
  }

  input.dataset.initialized = "true";

  trigger.addEventListener("click", () => {

    input.click();

  });

  bindPreview({
    input,
    previewId,
    placeholderId
  });

}

// CAMERA UPLOADER
function initCameraUploader({
  cameraInputId,
  cameraButtonId,
  previewId,
  placeholderId
}) {

  const cameraInput =
    document.getElementById(
      cameraInputId
    );

  const cameraButton =
    document.getElementById(
      cameraButtonId
    );

  if (!cameraInput || !cameraButton) {
    return;
  }

  if (
    cameraInput.dataset.initialized ===
    "true"
  ) {
    return;
  }

  cameraInput.dataset.initialized =
    "true";

  cameraButton.addEventListener(
    "click",
    (e) => {

      e.stopPropagation();

      cameraInput.click();

    }
  );

  bindPreview({
    input: cameraInput,
    previewId,
    placeholderId
  });

}


// ===============================
// CREDIT TRACKING
// ===============================
async function loadCredits() {
  try {
    const { data, error } = await supabaseClient.rpc("get_credit_summary");

    if (error) return console.error(error);

    const totalCredits = data?.[0]?.total_credits || 0;
    const status = data?.[0]?.status || "INACTIVE";

    document.getElementById("statusText").innerText = status;
    document.getElementById("daysLeft").innerText = totalCredits;

    document.getElementById("priceInfo").innerText =
      "₦200 per credit";

  } catch (err) {
    console.error(err);
  }
}

// PAYMENT FLOW (WITH AMOUNT)
async function payNow() {

  try {

    const statusEl =
      document.getElementById("paymentStatus");

    if (statusEl) {
      statusEl.innerText = "Initializing payment...";
    }

    const amount = Number(
      document.getElementById("amountInput")?.value
    );

    if (!amount || amount <= 0) {
      if (statusEl) {
        statusEl.innerText = "Enter a valid amount";
      }
      return;
    }

    const { data: schoolId } =
      await supabaseClient.rpc("current_user_school_id");

    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    if (!schoolId || !session) {
      if (statusEl) {
        statusEl.innerText = "Auth error";
      }
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
      if (statusEl) {
        statusEl.innerText = data.error || "Payment failed";
      }
      return;
    }

    // 🔥 CLEAR STATUS BEFORE REDIRECT
    if (statusEl) {
      statusEl.innerText = "";
    }
    
    const input = document.getElementById("amountInput");
    if (input) input.value = "";

    window.location.href = data.authorization_url;

  } catch (err) {
    console.error(err);
  }
}

// AUTO LOAD
window.addEventListener("DOMContentLoaded", loadCredits);


//INITIAL FETCH
document.addEventListener("DOMContentLoaded", () => {
  fetchStudents();
  fetchTeachers();
});


// ===============================
// SPINNER LOGIC
// ===============================
function showSpinner(message = "Loading... Please wait") {
  const spinner = document.getElementById("loading-spinner");
  if (!spinner) return;

  const text = spinner.querySelector("div:last-child");
  if (text) text.textContent = message;

  spinner.classList.remove("hidden");
}

function hideSpinner() {
  const spinner = document.getElementById("loading-spinner");
  spinner?.classList.add("hidden");
}


// ===============================
// CLOSE MODAL LOGIC
// ===============================
function enableOutsideClickClose(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
    }
  });
}


// ===============================
// INIT ADMIN TUTORIAL
// ===============================
async function initTutorialAccessAuto() {

  const { data: role } =
    await supabaseClient.rpc("current_user_role");

  const userRole = role || "guest";

  document
    .querySelectorAll(".tutorial-card")
    .forEach((el) => {

      const allowedRole =
        el.dataset.role;

      // SAFETY: if no role defined → hide
      if (!allowedRole) {
        el.classList.add("hidden");
        return;
      }

      // ALLOW EXACT MATCH ONLY
      if (allowedRole === userRole) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }

    });
}

initTutorialAccessAuto();


// ===============================
// VIDEO TUTORIAL TOGGLE
// ===============================
function toggleTutorial(
  contentId,
  arrowId
) {

  const content =
    document.getElementById(
      contentId
    );

  const arrow =
    document.getElementById(
      arrowId
    );

  content.classList.toggle(
    "hidden"
  );

  arrow.classList.toggle(
    "rotate"
  );

}


/* =======================
   STUDENTS
======================= */
//INIT LUCIDE
 initImageUploader({
  inputId: "studentPhoto",
  previewId: "preview-student",
  placeholderId: "placeholder-student",
  triggerId: "studentPhotoTrigger"
});

initCameraUploader({
  cameraInputId: "studentCameraInput",
  cameraButtonId: "studentCameraBtn",
  previewId: "preview-student",
  placeholderId: "placeholder-student"
});

resetImagePreview({
  previewId: "preview-student",
  placeholderId: "placeholder-student",
  inputId: "studentPhoto",
  cameraInputId: "studentCameraInput"
});

//STUDENT COUNT
function updateStudentCount(list, label = "Students") {
  const el = document.getElementById("studentsPageCount");
  if (el) el.textContent = `${list.length} ${label}`;
}

//CLASS MAPPING
let classMap = {};

document.addEventListener("DOMContentLoaded", async () => {
  const classes = await loadClasses();

  classMap = Object.fromEntries(
    classes.map(c => [c.id, c.name])
  );
});

// LOAD STUDENTS
async function loadStudents(list = allStudents) {
  const container = document.getElementById("studentsContainer");
  if (!container) return;

  container.innerHTML = "";

  updateStudentCount(list);

  container.className = "grid gap-4 mt-4";

  try {
    // 🔥 GET USER ROLE ONCE
    const { data: role } = await supabaseClient.rpc("current_user_role");

    const isAdmin = role === "admin";

    list.forEach(student => {
      const card = document.createElement("div");
      card.className = "data-card";

      let avatarHTML = '';

      if (student.image_url) {
        avatarHTML = `
          <img src="${student.image_url}"
               alt="${student.full_name || 'Student'}"
               class="card-avatar-img"
               onerror="this.onerror=null;this.src='default-avatar.png'">
        `;
      } else {
        avatarHTML = `
          <div class="card-avatar">
            ${student.full_name ? student.full_name.charAt(0) : 'S'}
          </div>
        `;
      }

      const className = classMap[student.class_id] || "N/A";

      // 🔐 PERMISSION RULES
      const canEdit = isAdmin;
      const canDelete = isAdmin;

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
          <span class="card-value">${className}</span>

          <span class="card-label">Sex</span>
          <span class="card-value">${student.sex || "N/A"}</span>

          <span class="card-label">Parent</span>
          <span class="card-value">${student.parent_name || "N/A"}</span>

          <span class="card-label">Phone</span>
          <span class="card-value">${student.parent_phone || "N/A"}</span>
        </div>

        ${
          isAdmin
            ? `
        <div class="card-actions">
          ${
            canEdit
              ? `<button onclick="openEditStudentModal('${encodeURIComponent(student.student_id)}')" class="btn-edit">
                   Edit Profile
                 </button>`
              : ""
          }

          ${
            canDelete
              ? `<button onclick="deleteStudent('${encodeURIComponent(student.student_id)}')" class="btn-delete">
                   Delete
                 </button>`
              : ""
          }
        </div>
        `
            : ""
        }
      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML =
      `<p class="text-red-500 p-4 text-center">Failed to load students.</p>`;
  }
}

//FETCH STUDENTS
async function fetchStudents() {
  const { data, error } = await supabaseClient
    .from("students")
    .select("*");

  if (error) {
    console.error(error);
    return [];
  }

  allStudents = data || [];
  return allStudents;
}

//REGISTER STUDENT PAYLOAD FUNCTION
async function registerStudent(payload) {
  const { error } = await supabaseClient
    .from("students")
    .insert(payload);

  if (error) return alert(error.message);
  await refreshStudentsUI();
}

//UPDATE STUDENT PAYLOAD FUNCTION
async function updateStudent(id, payload) {
  const { error } = await supabaseClient
    .from("students")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}

//DELETE STUDENT
async function deleteStudent(studentIdEncoded) {
  const studentId = decodeURIComponent(studentIdEncoded);

  if (!confirm("Delete student?")) return;

  showSpinner("Deleting student...");

  try {
    const { data: { session }, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError || !session) {
      throw new Error("Admin not authenticated");
    }

    const token = session.access_token;

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

    if (!res.ok) {
      throw new Error(data.error || "Failed to delete student");
    }

    showSpinner("Refreshing students...");
    
    await refreshStudentsUI();

    alert("Student deleted successfully!");

  } catch (err) {
    console.error("Failed to delete student:", err);
    alert("Delete failed: " + (err.message || "Unknown error"));

  } finally {
    hideSpinner();
  }
}

//REFERESH STUDENT UI
async function refreshStudentsUI() {
  await fetchStudents();

  const currentFilter = selected.studentClassFilterId || "all";

  if (currentFilter === "all") {
    loadStudents(allStudents);
  } else {
    filterStudentsByClass(currentFilter, allStudents);
  }
}

// Filter Students by Class
function filterStudentsByClass(classId, studentsList = allStudents) {
  const selectedClassId = classId || "all";

  selected.studentClassFilterId = selectedClassId;

  const filtered =
    selectedClassId === "all"
      ? studentsList
      : studentsList.filter(
          s => (s.class_id || "") === selectedClassId
        );

  loadStudents(filtered);
}

// ===============================
// EDIT MODAL
// ===============================
 window.openEditStudentModal = async function (studentIdEncoded) {
  const studentId = decodeURIComponent(studentIdEncoded);

  const { data: student, error } = await supabaseClient
    .from("students")
    .select("*")
    .eq("student_id", studentId)
    .single();

  if (error) return alert(error.message);

 // LOAD CLASSES
  const classes = await loadClasses();
  
  const form = document.getElementById("editStudentForm");

  // RESET GLOBAL STATE
  selected.editAdmissionClass = null;
  selected.editCurrentClass = null;
  selected.editSiblingClass = null;

  selected.editAdmissionClassId = null;
  selected.editCurrentClassId = null;
  selected.editSiblingClassId = null;

  // INIT DROPDOWNS
  populateClassDropdown({
    classes,
    dropdownId: "editAdmissionClassDropdown",
    selectId: "editAdmissionClassSelect",
    textId: "editAdmissionClassSelectedText",
    placeholder: "Select Class",
    resetOption: true,
    stateKey: "editAdmissionClassId",
    onChange: (cls) => {
      selected.editAdmissionClassId = cls?.id || null;
    }
  });

  populateClassDropdown({
    classes,
    dropdownId: "editCurrentClassDropdown",
    selectId: "editCurrentClassSelect",
    textId: "editCurrentClassSelectedText",
    placeholder: "--Select Class--",
    resetOption: true,
    stateKey: "editCurrentClassId",
    onChange: (cls) => {
      selected.editCurrentClassId = cls?.id || null;
    }
  });

  populateClassDropdown({
    classes,
    dropdownId: "editSiblingClassDropdown",
    selectId: "editSiblingClassSelect",
    textId: "editSiblingClassSelectedText",
    placeholder: "Select Class",
    resetOption: true,
    stateKey: "editSiblingClassId",
    onChange: (cls) => {
      selected.editSiblingClassId = cls?.id || null;
    }
  });

  // FIELD MAPPING
  const fieldMap = {
    fullName: "full_name",
    studentId: "student_id",

    studentClass: "class_id",
    admissionClass: "admission_class_id",
    siblingClass: "sibling_class_id",

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
    siblingGender: "sibling_gender"
  };

  Object.keys(fieldMap).forEach((key) => {
    if (form[key]) {
      form[key].value = student[fieldMap[key]] ?? "";
    }
  });

  form.dataset.id = student.id;

  // FIND REAL CLASS OBJECTS
  const admissionClassObj = classes.find(
    c => c.id === student.admission_class_id
  );

  const currentClassObj = classes.find(
    c => c.id === student.class_id
  );

  const siblingClassObj = classes.find(
    c => c.id === student.sibling_class_id
  );
  
  // RESTORE SELECTED OBJECTS
  selected.editAdmissionClass = admissionClassObj || null;
  selected.editCurrentClass = currentClassObj || null;
  selected.editSiblingClass = siblingClassObj || null;

  // RESTORE SELECTED IDS
  selected.editAdmissionClassId = student.admission_class_id || null;
  selected.editCurrentClassId = student.class_id || null;
  selected.editSiblingClassId = student.sibling_class_id || null;

  // UPDATE DROPDOWN TEXT
  document.getElementById("editAdmissionClassSelectedText").textContent =
    admissionClassObj?.name || "Select Class";

  document.getElementById("editCurrentClassSelectedText").textContent =
    currentClassObj?.name || "Select Class";

  document.getElementById("editSiblingClassSelectedText").textContent =
    siblingClassObj?.name || "Select Class";

// IMAGE SYSTEM
const config = {
  inputId: "edit-student-photo",
  cameraInputId: "edit-student-camera-input",
  previewId: "edit-preview-student",
  placeholderId: "edit-placeholder-student",
  triggerId: "edit-student-photo-trigger"
};

// RESET IMAGE STATE (clears gallery + camera + UI)
resetImagePreview(config);

// APPLY EXISTING IMAGE
if (student.image_url) {
  setImagePreview({
    previewId: config.previewId,
    placeholderId: config.placeholderId,
    imageUrl: student.image_url
  });
}

// INIT GALLERY UPLOADER
initImageUploader(config);

// INIT CAMERA UPLOADER
initCameraUploader({
  cameraInputId: config.cameraInputId,
  cameraButtonId: "edit-student-camera-btn",
  previewId: config.previewId,
  placeholderId: config.placeholderId
});

// OPEN MODAL
document.getElementById("editStudentModal")
  .classList.remove("hidden");

// CLOSE MODAL
document.getElementById("closeStudentModal").onclick = () => {

  document.getElementById("editStudentModal")
    .classList.add("hidden");

  resetImagePreview(config);

  form.reset();
  form.dataset.id = "";

  selected.editAdmissionClass = null;
  selected.editCurrentClass = null;
  selected.editSiblingClass = null;

  selected.editAdmissionClassId = null;
  selected.editCurrentClassId = null;
  selected.editSiblingClassId = null;
  };

  // FIX LUCIDE ICONS IN MODAL
  refreshIcons();
}

enableOutsideClickClose("editStudentModal");

// =======================
// INIT STUDENT CLASS DROPDOWNS
// =======================
async function handleStudentClassChange(classId) {
  if (!classId) return;

  showSpinner("Loading students...");

  const start = Date.now();

  try {
    const students = await fetchStudents();

    filterStudentsByClass(classId, students);

  } finally {
    const elapsed = Date.now() - start;
    setTimeout(() => hideSpinner(), Math.max(200 - elapsed, 0));
  }
}

document.addEventListener("DOMContentLoaded", async () => {

  // load initial classes
const classes = await loadClasses();

// enable realtime updates
setupClassRealtime();

  // STUDENT FILTER DROPDOWN
  populateClassDropdown({

    classes,
    dropdownId: "studentClassDropdown",
    selectId: "studentClassFilter",
    textId: "studentClassSelectedText",
    placeholder: "All",
    includeAll: true,
    stateKey: "studentClassFilterId",
    onChange: (cls) => {
      const classId = cls?.id || "all";
      selected.studentClassFilterId = classId;
      handleStudentClassChange(classId);
    }
  });

  // ADMISSION CLASS
  populateClassDropdown({
    classes,
    dropdownId: "admissionClassDropdown",
    selectId: "admissionClassSelect",
    textId: "admissionClassSelectedText",
    placeholder: "Select Class",
    resetOption: true,
    stateKey: "admissionClassId",
    onChange: (cls) => {
selected.admissionClassId = cls?.id || null;
    }
  });

  // CURRENT CLASS
  populateClassDropdown({
    classes,
    dropdownId: "currentClassDropdown",
    selectId: "currentClassSelect",
    textId: "currentClassSelectedText",
    placeholder: "Select Class",
    resetOption: true,
    stateKey: "currentClassId",
    onChange: (cls) => {
selected.currentClassId = cls?.id || null;
    }
  });

  // SIBLING CLASS
  populateClassDropdown({
    classes,
    dropdownId: "siblingClassDropdown",
    selectId: "siblingClassSelect",
    textId: "siblingClassSelectedText",
    placeholder: "--Select Class--",
    resetOption: true,
    stateKey: "siblingClassId",
    onChange: (cls) => {
selected.siblingClassId = cls?.id || null;
    }
  });
});

//RESET CLASSES
function resetClasses() {
  selected.admissionClassId = null;
  selected.currentClassId = null;
  selected.siblingClassId = null;
  selected.studentClassFilter = null;

  document.getElementById("admissionClassSelect").value = "";
  document.getElementById("currentClassSelect").value = "";
  document.getElementById("siblingClassSelect").value = "";

  document.getElementById("admissionClassSelectedText").textContent = "Select Class";
  document.getElementById("currentClassSelectedText").textContent = "Select Class";
  document.getElementById("siblingClassSelectedText").textContent = "--Select Class--";
}

/* =======================
// REGISTER STUDENT FORM SUBMISSIONS
======================= */
document.getElementById("registrationForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;

  const studentPhotoInput = document.getElementById("studentPhoto");
  const studentCameraInput = document.getElementById("studentCameraInput");
  const passwordInput = document.getElementById("studentPassword");

  // VALIDATE CLASSES (SELECTED ONLY)
  if (!selected.currentClassId) {
    alert("Please select current class");
    return;
  }

  if (!selected.admissionClassId) {
    alert("Please select admission class");
    return;
  }

  try {
    showSpinner("Registering student...");

    await new Promise(resolve => setTimeout(resolve, 0));

    // AUTH SESSION
    const {
      data: { session },
      error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError || !session) {
      throw new Error("Admin not authenticated");
    }

    // IMAGE (GALLERY + CAMERA)
    const file =
      studentPhotoInput?.files?.[0] ||
      studentCameraInput?.files?.[0] ||
      null;

    // PAYLOAD
    const payload = {
      student_id: form.studentId.value.trim(),
      full_name: form.fullName.value.trim(),

      sex: form.sex.value || null,
      date_of_birth: form.dateOfBirth.value || null,

      nationality: form.nationality.value?.trim() || null,
      state_of_origin: form.stateOfOrigin.value?.trim() || null,
      lga: form.lga.value?.trim() || null,
      student_address: form.studentAddress.value?.trim() || null,

      parent_name: form.parentName.value?.trim() || null,
      parent_phone: form.parentPhone.value?.trim() || null,
      parent_email: form.parentEmail.value?.trim() || null,
      parent_address: form.parentAddress.value?.trim() || null,

      guardian_name: form.guardianName.value?.trim() || null,
      guardian_phone: form.guardianPhone.value?.trim() || null,
      guardian_email: form.guardianEmail.value?.trim() || null,
      guardian_address: form.guardianAddress.value?.trim() || null,

      // 🔥 FIXED: USE SELECTED ONLY
      class_id: selected.currentClassId,
      admission_class_id: selected.admissionClassId,
      sibling_class_id: selected.siblingClassId || null,

      sibling_name: form.siblingName?.value?.trim() || null,
      sibling_sex: form.siblingGender?.value || null,

      image_url: null,
      image_path: null,

      password: passwordInput?.value?.trim() || null
    };

    // UPLOAD IMAGE IF EXISTS
    if (file) {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(
        "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/upload-student-images",
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
        throw new Error(result.error || "Image upload failed");
      }

      payload.image_url = result.image_url;
      payload.image_path = result.image_path;
    }

    // CREATE STUDENT
    const res = await fetch(
      "https://irelkjvppoisvjpopdpb.supabase.co/functions/v1/create-student-auth",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "Student creation failed");
    }

    alert(
      `Student registered successfully!\n\nStudent ID: ${result.student_id}\nPassword: ${result.password_used}`
    );

    // RESET UI
    form.reset();
    resetClasses();

    resetImagePreview({
     previewId: "preview-student",
     placeholderId: "placeholder-student",
     inputId: "studentPhoto",
     cameraInputId: "studentCameraInput"
    });

    await refreshStudentsUI();
    showSection("register");

  } catch (err) {
    console.error(err);
    alert("Failed to register student: " + err.message);

  } finally {
    hideSpinner();
  }
});

// ===============================
// EDIT STUDENT FORM SUBMISSION
// ===============================
document.getElementById("editStudentForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;
  const id = form.dataset.id;

  if (!id) {
    alert("Missing student ID");
    return;
  }

const fileInput =
  document.getElementById(
    "edit-student-photo"
  );

const cameraInput =
  document.getElementById(
    "edit-student-camera-input"
  );

const file =
  cameraInput?.files?.[0] ||
  fileInput?.files?.[0] ||
  null;

  try {
    showSpinner("Updating student...");

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const payload = {
      student_id: form.studentId.value.trim(),
      full_name: form.fullName.value.trim(),

      sex: form.sex.value || null,
      date_of_birth: form.dateOfBirth.value || null,

      nationality: form.nationality.value?.trim() || null,
      state_of_origin: form.stateOfOrigin.value?.trim() || null,
      lga: form.lga.value?.trim() || null,
      student_address: form.studentAddress.value?.trim() || null,

      parent_name: form.parentName.value?.trim() || null,
      parent_phone: form.parentPhone.value?.trim() || null,
      parent_email: form.parentEmail.value?.trim() || null,
      parent_address: form.parentAddress.value?.trim() || null,

      guardian_name: form.guardianName.value?.trim() || null,
      guardian_phone: form.guardianPhone.value?.trim() || null,
      guardian_email: form.guardianEmail.value?.trim() || null,
      guardian_address: form.guardianAddress.value?.trim() || null,

      class_id: selected.editCurrentClassId || null,
      admission_class_id: selected.editAdmissionClassId || null,
      sibling_class_id: selected.editSiblingClassId || null,

      sibling_name: form.siblingName.value?.trim() || null,
      sibling_sex: form.siblingGender.value || null
    };

    // IMAGE UPDATE (ONLY IF NEW FILE)
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

      payload.image_url = result.image_url;
      payload.image_path = result.image_path;
    }

    // UPDATE DB
    await updateStudent(id, payload);

    //REFRESH UI PROPERLY
    await refreshStudentsUI();

    // CLOSE MODAL
    alert("Student updated successfully!");
    document.getElementById("editStudentModal").classList.add("hidden");

  } catch (err) {
    console.error(err);
    alert("Failed to update student: " + err.message);

  } finally {
    hideSpinner();
  }
});


/* =======================
   TEACHERS
======================= */
//INIT LUCIDE
  initImageUploader({
  inputId: "teacherPhoto",
  previewId: "preview-teacher",
  placeholderId: "placeholder-teacher",
  triggerId: "teacherPhotoTrigger"
});

initCameraUploader({
  cameraInputId: "teacherCameraInput",
  cameraButtonId: "teacherCameraBtn",
  previewId: "preview-teacher",
  placeholderId: "placeholder-teacher"
});

resetImagePreview({
  previewId: "preview-teacher",
  placeholderId: "placeholder-teacher",
  inputId: "teacherPhoto"
});

//Load Teachers
function loadTeachers() {
  const container = document.getElementById("teachersContainer");
  if (!container) return;

  container.innerHTML = "";
  container.className = "grid gap-4 mt-4";

  allTeachers.forEach(teacher => {
    const card = document.createElement("div");
    card.className = "data-card";

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

    card.innerHTML = `
      <div class="data-card-header">
        ${avatarHTML}
        <div class="card-info">
          <h4>${teacher.full_name || "Unknown Name"}</h4>
          <p>ID: ${teacher.teacher_id || "N/A"}</p>
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
          Delete
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

//FETCH TEACHERS
async function fetchTeachers() {
  const { data, error } = await supabaseClient
    .from("teachers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return console.error(error);

  allTeachers = data;
  loadTeachers();
}

//REGISTER TEACHER PAYLOAD FUNCTION
async function addTeacher(payload) {
  const { error } = await supabaseClient
    .from("teachers")
    .insert(payload);

  if (error) return alert(error.message);
  await fetchTeachers();
}

//UPDATE TEACHER PAYLOAD FUNCTION
async function updateTeacher(id, payload) {
  const { error } = await supabaseClient
    .from("teachers")
    .update(payload)
    .eq("id", id);

  if (error) return alert(error.message);
  await fetchTeachers();
}

//DELETE TEACHER
async function deleteTeacher(idEncoded) {
  const id = decodeURIComponent(idEncoded);

  if (!confirm("Delete teacher?")) return;

  showSpinner("Deleting teacher...");

  try {
    const { data: { session }, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError || !session) {
      throw new Error("Admin not authenticated");
    }

    const token = session.access_token;

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

    showSpinner("Refreshing teachers...");
    await fetchTeachers();

    alert("Teacher deleted successfully.");

  } catch (err) {
    console.error("Teacher deletion error:", err);
    alert("Failed to delete teacher: " + (err.message || JSON.stringify(err)));

  } finally {
    hideSpinner();
  }
}

// ===============================
// EDIT MODAL LOGIC
// ===============================
 async function openEditTeacherModal(idEncoded) {
  const id = decodeURIComponent(idEncoded);

  const teacher = allTeachers.find(t => t.id === id);
  if (!teacher) return alert("Teacher not found");

  const form = document.getElementById("editTeacherForm");

  // FIELD ASSIGNMENT
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

// IMAGE SYSTEM
const config = {
  inputId: "edit-teacher-photo",
  previewId: "edit-preview-teacher",
  placeholderId: "edit-placeholder-teacher",
  triggerId: "edit-teacher-photo-trigger"
};

resetImagePreview({
  ...config,
  cameraInputId: "edit-teacher-camera-input"
});

if (teacher.image_url) {
  setImagePreview({
    previewId: config.previewId,
    placeholderId: config.placeholderId,
    imageUrl: teacher.image_url
  });
}

initImageUploader(config);

initCameraUploader({
  cameraInputId:
    "edit-teacher-camera-input",

  cameraButtonId:
    "edit-teacher-camera-btn",

  previewId:
    "edit-preview-teacher",

  placeholderId:
    "edit-placeholder-teacher"
});

// OPEN MODAL
document.getElementById(
  "editTeacherModal"
).classList.remove("hidden");

// CLOSE MODAL
document.getElementById(
  "closeTeacherModal"
).onclick = () => {

  document.getElementById(
    "editTeacherModal"
  ).classList.add("hidden");

  resetImagePreview({
    ...config,
    cameraInputId:
      "edit-teacher-camera-input"
  });

  form.reset();
  form.dataset.id = "";
};

  // FIX LUCIDE ICONS IN MODAL
  refreshIcons();
}

enableOutsideClickClose("editTeacherModal");

// ===============================
//REGISTER TEACHER FORM SUBMISSION
// ===============================
document.getElementById("teacherForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  // Build payload
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
    image_url: null,
    image_path: null
  };

  if (!payload.teacher_id || !payload.email || !payload.password) {
    return alert("Teacher ID, Email, and Password are required");
  }

  try {
    showSpinner("Uploading teacher...");

    // 🔐 Get session
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) throw new Error("Admin not authenticated");

    const token = session.access_token;

    // 🔥 1. UPLOAD IMAGE
const fileInput = document.getElementById("teacherPhoto");
const cameraInput = document.getElementById("teacherCameraInput");

const file =
  cameraInput?.files?.[0] ||
  fileInput?.files?.[0] ||
  null;

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

      payload.image_url = uploadData.url;
      payload.image_path = uploadData.path; 
    }

    // 2. CREATE TEACHER
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

    // SUCCESS
    alert(`Teacher added!\nEmail: ${data.email}`);

form.reset();

resetImagePreview({
  previewId: "preview-teacher",
  placeholderId: "placeholder-teacher",
  inputId: "teacherPhoto",
  cameraInputId: "teacherCameraInput"
});

await fetchTeachers();

  } catch (err) {
    console.error("Teacher creation error:", err);
    alert("Failed to add teacher: " + (err.message || JSON.stringify(err)));
  } finally {
    hideSpinner();
  }
});

// ===============================
// EDIT TEACHER FORM SUBMISSION
// ===============================
document.getElementById("editTeacherForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const uuid = form.editTeacherUuid.value;
  if (!uuid) return alert("Missing teacher ID for update");

const fileInput =
  document.getElementById(
    "edit-teacher-photo"
  );

const cameraInput =
  document.getElementById(
    "edit-teacher-camera-input"
  );

const file =
  cameraInput?.files?.[0] ||
  fileInput?.files?.[0] ||
  null;

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

    // IMAGE UPDATE VIA EDGE FUNCTION
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

    if (image_url) payload.image_url = image_url;
    if (image_path) payload.image_path = image_path;

    // UPDATE TEACHER RECORD
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
   SUBJECTS
======================= */
//FETCH REGISTERED SUBJECTS
async function fetchSubjects(classId) {
  if (!classId) {
    allSubjects = [];
    displayRegisteredSubjects();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("subjects")
      .select("*")
      .eq("class_id", classId)
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

//SUBJECTS COUNT
function updateSubjectsCount(list, label = "Subjects") {
  const el = document.getElementById("subjectsPageCount");
  if (el) el.textContent = `${list.length} ${label}`;
}

//DISPLAY REGISTERED SUBJECT
function displayRegisteredSubjects() {
  const container = document.getElementById("registeredSubjects");
  container.innerHTML = "";

  updateSubjectsCount(allSubjects);

  if (!allSubjects.length) {
    container.innerHTML =
      `<p class="text-gray-500 text-center">No subjects found.</p>`;
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

      try {
        showSpinner(`Deleting "${subj.name}"...`);

        deleteBtn.disabled = true;

        const { error } = await supabaseClient
          .from("subjects")
          .delete()
          .eq("id", subj.id);

        if (error) throw error;

        showSpinner("Refreshing subjects...");

        const classId = document.getElementById("classSelect")?.value;
        await fetchSubjects(classId);

      } catch (err) {
        console.error(err);
        alert(err.message || "Failed to delete subject");

      } finally {
        hideSpinner();
        deleteBtn.disabled = false;
      }
    };

    div.appendChild(nameSpan);
    div.appendChild(deleteBtn);
    container.appendChild(div);
  });
}

// ===============================
// SUBJECTS FORM SUBMISSION
// ===============================
document.getElementById("saveSubjectsBtn").addEventListener("click", async () => {
  const classSelect = document.getElementById("classSelect");

  const classId = classSelect?.value?.trim();

  if (!classId) return alert("Select a class first.");

  const textarea = document.getElementById("subjectTextarea");

  const subjectsToAdd = textarea.value
    .split("\n")
    .map(s => s.trim())
    .filter(s => s);

  if (!subjectsToAdd.length) return alert("Enter at least one subject.");

  try {
    showSpinner("Adding subjects...");

    const payload = subjectsToAdd.map(name => ({
      name,
      class_id: classId
    }));

    const { error } = await supabaseClient
      .from("subjects")
      .insert(payload);

    if (error) throw error;

    alert("Subjects added successfully!");

    textarea.value = "";

    fetchSubjects(classId);

  } catch (err) {
    console.error(err);
    alert("Failed to add subjects: " + err.message);
  } finally {
    hideSpinner();
  }
});

// =======================
// INIT SUBJECTS CLASS DROPDOWN
// =======================
async function handleClassChange(classId) {
  if (!classId) return;

  showSpinner("Loading subjects...");

  const start = Date.now();

  try {
    await fetchSubjects(classId);

  } finally {
    const elapsed = Date.now() - start;

    setTimeout(hideSpinner, Math.max(200 - elapsed, 0));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const classes = await loadClasses();

  populateClassDropdown({
    classes,
    dropdownId: "classDropdown",
    selectId: "classSelect",
    textId: "classSelectedText",
    placeholder: "Select a class",
    resetOption: true,
    stateKey: "subjectClassFilter",
    onChange: (cls) => {
  const classId = cls?.id || null;

  selected.subjectClassFilter = classId;

  if (!classId) return;

  handleClassChange(classId);
}
  });
});


/* =======================
   CLASSES
======================= */
//FETCH CLASSES
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

//CLASSES COUNT
function updateClassesCount(list, label = "Classes") {
  const el = document.getElementById("classesPageCount");
  if (el) el.textContent = `${list.length} ${label}`;
}

//DISPLAY REGISTERED CLASSES
function displayRegisteredClasses() {
  const container = document.getElementById("registeredClasses");
  if (!container) return;

  container.innerHTML = "";

  updateClassesCount(allClasses);

  if (!allClasses.length) {
    container.innerHTML =
      `<p class="text-gray-500 text-center">No classes registered yet.</p>`;
    updateClassesCount([]);
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
        showSpinner(`Deleting class "${cls.name}"...`);

        deleteBtn.disabled = true;

        const { error } = await supabaseClient
          .from("classes")
          .delete()
          .eq("id", cls.id);

        if (error) throw error;

        showSpinner("Refreshing classes...");

        await fetchClasses();

      } catch (err) {
        console.error(err);
        alert("Failed to delete class: " + err.message);

      } finally {
        hideSpinner();
        deleteBtn.disabled = false;
      }
    };

    div.appendChild(nameSpan);
    div.appendChild(deleteBtn);
    container.appendChild(div);
  });
}

// ---------------------------
// CLASSES FORM SUBMISSION
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
    textarea.value = "";
    fetchClasses();

  } catch (err) {
    console.error(err);
    alert("Failed to add classes: " + err.message);
  } finally {
    hideSpinner();
  }
});

// Initialize fetch
document.addEventListener("DOMContentLoaded", () => {
  fetchClasses();
});


/* =======================
   TRANSFER STUDENT
======================= */
selected.transferEntireClass = false;

// SINGLE STUDENT
async function doTransferStudent(
  studentId,
  newClassId
) {

  const { error } =
    await supabaseClient
      .from("students")
      .update({
        class_id: newClassId
      })
      .eq("id", studentId);

  if (error) throw error;
}

// ENTIRE CLASS
async function doTransferClass(
  oldClassId,
  newClassId
) {

  const { error } =
    await supabaseClient
      .from("students")
      .update({
        class_id: newClassId
      })
      .eq(
        "class_id",
        oldClassId
      );

  if (error) throw error;
}

/* =======================
   TRANSFER FORM SUBMISSION
======================= */
document
  .getElementById("transferForm")
  ?.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();

      const oldClassId =
        selected.transferClassId;

      const studentId =
        selected.transferStudentId;

      const newClassId =
        selected.newClassId;

      const transferEntireClass =
        selected.transferEntireClass;

      if (!newClassId) {
        return alert(
          "Select a new class"
        );
      }

      if (
        !transferEntireClass &&
        !studentId
      ) {
        return alert(
          "Select a student"
        );
      }

      try {

        showSpinner(
          transferEntireClass
            ? "Transferring class..."
            : "Transferring student..."
        );

        if (
          transferEntireClass
        ) {

          await doTransferClass(
            oldClassId,
            newClassId
          );

          alert(
            "Entire class transferred successfully!"
          );

        } else {

          await doTransferStudent(
            studentId,
            newClassId
          );

          alert(
            "Student transferred successfully!"
          );
        }

        // REFRESH STUDENTS
        await refreshStudentsUI();

        // RESET STATE
        selected.transferStudentId =
          null;

        selected.transferClassId =
          null;

        selected.newClassId =
          null;

        selected.transferEntireClass =
          false;

        // RESET UI
        resetDropdown({
          selectId:
            "transferStudent",
          textId:
            "transferStudentText",
          placeholder:
            "--Select Student--"
        });

        resetDropdown({
          selectId:
            "transferClass",
          textId:
            "transferClassSelectedText",
          placeholder:
            "--Select Class--"
        });

        resetDropdown({
          selectId:
            "newClass",
          textId:
            "newClassSelectedText",
          placeholder:
            "--Select New Class--"
        });

      } catch (err) {

        console.error(err);

        alert(
          "Failed to transfer: " +
          err.message
        );

      } finally {

        hideSpinner();

      }
    }
  );

/* =======================
   INIT TRANSFER CLASSES
======================= */
document.addEventListener(
  "DOMContentLoaded",
  async () => {

    const classes =
      await loadClasses();

    // NEW CLASS
    populateClassDropdown({
      classes,
      dropdownId:
        "newClassDropdown",
      selectId:
        "newClass",
      textId:
        "newClassSelectedText",
      placeholder:
        "--Select New Class--",
      resetOption: true,
      stateKey:
        "newClassId",
      onChange: (cls) => {

        console.log(
          "Selected new class:",
          cls?.id
        );

      }
    });

    document
      .getElementById(
        "newClassDropdown"
      )
      ?.classList.remove(
        "show"
      );

    // SOURCE CLASS
    populateClassDropdown({
      classes,
      dropdownId:
        "transferClassDropdown",
      selectId:
        "transferClass",
      textId:
        "transferClassSelectedText",
      placeholder:
        "--Select Class--",
      resetOption: true,
      stateKey:
        "transferClassId",

      onChange: (cls) => {

        if (!cls) return;

        const classId =
          cls.id;

        const studentsInClass =
          allStudents.filter(
            s =>
              s.class_id ===
              classId
          );

        if (
          studentsInClass.length === 0
        ) {

          alert(
            "No students in this class yet!"
          );

          return;
        }

        const transferAll =
          confirm(
            "Transfer entire class?\n\nOK = Yes\nCancel = No"
          );

        selected.transferEntireClass =
          transferAll;

        // ENTIRE CLASS
        if (
          transferAll
        ) {

          selected.transferStudentId =
            null;

          resetDropdown({
            selectId:
              "transferStudent",
            textId:
              "transferStudentText",
            placeholder:
              "--Entire Class Selected--"
          });

          alert(
            "Please select the new class."
          );

          return;
        }

        // SINGLE STUDENT
        populateStudentDropdown({
          students:
            studentsInClass,
          dropdownId:
            "transferStudentDropdown",
          selectId:
            "transferStudent",
          textId:
            "transferStudentText",
          placeholder:
            "--Select Student--",
          stateKey:
            "transferStudentId"
        });

      }
    });

    document
      .getElementById(
        "transferClassDropdown"
      )
      ?.classList.remove(
        "show"
      );

  }
);


/* =======================
   RESULTS SECTION
======================= */
const resultClassSelect = document.getElementById("resultClass");
const resultStudentSelect = document.getElementById("resultStudent");
const resultSubjectsContainer = document.getElementById("resultSubjects");
const resultForm = document.getElementById("resultForm");


//GRADE CALCULATION
 function calculateGrade(total) {
  if (total >= 70) return "A";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  if (total >= 45) return "D";
  return "F";
} 

//LOAD SUBJECTS BY CLASS
async function loadSubjectsByClass(classId) {
  if (!classId) return [];

  try {
    showSpinner("Loading subjects...");

    const { data, error } = await supabaseClient
      .from("subjects")
      .select("*")
      .eq("class_id", classId)
      .order("name");

    if (error) throw error;

    return data || [];

  } catch (err) {
    console.error(err);
    alert("Failed to load subjects: " + err.message);
    return [];

  } finally {
    hideSpinner();
  }
}

//LOAD STUDENTS BY CLASS
async function loadStudentsByClass(classId) {
  try {
    if (!classId) return [];

    const { data: students, error } = await supabaseClient
      .from("students")
      .select("id, student_id, full_name, image_url, class_id")
      .eq("class_id", classId)
      .order("full_name");

    if (error) throw error;

    const list = students || [];

    selected.resultStudentId = null;

    populateStudentDropdown({
      students: list,
      dropdownId: "studentDropdown",
      selectId: "resultStudent",
      textId: "studentSelectedText",
      placeholder: "Select student",
      stateKey: "resultStudentId"
    });

    return list;

  } catch (err) {
    console.error("Load students error:", err);
    alert("Failed to load students: " + err.message);
    return [];
  }
}

//CONTINUOUS ASSESSMENT LOGIC
const CA_TYPES = {
  standard_20_20_60: {
    label: "1st Test 20 • 2nd Test 20 • Exam 60",
    parts: [
      { key: "test1", label: "1st Test", max: 20 },
      { key: "test2", label: "2nd Test", max: 20 },
      { key: "exam", label: "Exam", max: 60 }
    ]
  },

  test10_test20_exam70: {
    label: "1st Test 10 • 2nd Test 20 • Exam 70",
    parts: [
      { key: "test1", label: "1st Test", max: 10 },
      { key: "test2", label: "2nd Test", max: 20 },
      { key: "exam", label: "Exam", max: 70 }
    ]
  },

  four_ca_exam60: {
    label: "CA1 10 • CA2 10 • CA3 10 • CA4 10 • Exam 60",
    parts: [
      { key: "ca1", label: "CA 1", max: 10 },
      { key: "ca2", label: "CA 2", max: 10 },
      { key: "ca3", label: "CA 3", max: 10 },
      { key: "ca4", label: "CA 4", max: 10 },
      { key: "exam", label: "Exam", max: 60 }
    ]
  },

  test15_test15_exam70: {
    label: "1st Test 15 • 2nd Test 15 • Exam 70",
    parts: [
      { key: "test1", label: "1st Test", max: 15 },
      { key: "test2", label: "2nd Test", max: 15 },
      { key: "exam", label: "Exam", max: 70 }
    ]
  },

  test40_exam60: {
  label: "Test 40 • Exam 60",
  parts: [
    { key: "test1", label: "Test", max: 40 },
    { key: "exam", label: "Exam", max: 60 }
  ]
},

  test30_exam70: {
  label: "Test 30 • Exam 70",
  parts: [
    { key: "test1", label: "Test", max: 30 },
    { key: "exam", label: "Exam", max: 70 }
  ]
},
};

//GET SELECTED CA TYPE
function getSelectedCAType() {
  const select = document.getElementById("caType");
  return select?.value || "standard_20_20_60";
}

//RENDER SUBJECT INPUTS
function renderSubjectInputs(subjects) {
  resultSubjectsContainer.innerHTML = "";

  const selectedType = getSelectedCAType();
  const config = CA_TYPES[selectedType];

  subjects.forEach(subj => {
    const row = document.createElement("div");

    row.className =
  "subject-row border p-3 rounded-xl mb-4 grid grid-cols-1 gap-3 sm:items-center";

row.style.gridTemplateColumns =
  window.innerWidth >= 640
    ? `1fr repeat(${config.parts.length}, minmax(140px, 170px))`
    : "1fr";


    row.dataset.subjectId = subj.id;
    row.dataset.classId = subj.class_id || "";

    const subjectSpan = Math.max(2, 8 - config.parts.length);

    const inputsHTML = config.parts.map(part => {
      return `
        <div>
          <input
            type="number"
            min="0"
            max="${part.max}"
            name="${part.key}_${subj.id}"
            placeholder="${part.label} (${part.max})"
            class="subject-input border p-2 rounded-xl w-full"
          >
        </div>
      `;
    }).join("");

    row.innerHTML = `
      <div class="subject-name">
        <div class="font-semibold">${subj.name}</div>
      </div>

      ${inputsHTML}

      <input type="hidden" name="total_${subj.id}" value="0">
      <input type="hidden" name="grade_${subj.id}" value="F">
    `;

    resultSubjectsContainer.appendChild(row);
    
    //AUTO GRADING (DYNAMIC FIX)
    const recalc = () => {
      let total = 0;

      config.parts.forEach(part => {
        const val =
          Number(row.querySelector(`[name="${part.key}_${subj.id}"]`)?.value) || 0;

        total += val;
      });

      const grade = calculateGrade(total);

      row.querySelector(`[name="total_${subj.id}"]`).value = total;
      row.querySelector(`[name="grade_${subj.id}"]`).value = grade;
    };

    // attach listeners dynamically
    config.parts.forEach(part => {
      row
        .querySelector(`[name="${part.key}_${subj.id}"]`)
        ?.addEventListener("input", recalc);
    });
  });
}

//AUTO RE-RENDER WHEN TYPE CHANGES
document.getElementById("caType")?.addEventListener("change", async () => {
  if (typeof selected !== "undefined" && selected.resultClassId) {
    const subjects = await loadSubjectsByClass(selected.resultClassId);
    renderSubjectInputs(subjects);
  }
});


/* ===============================
   CLASS CHANGE HANDLER
================================ */
resultClassSelect.addEventListener("change", async (e) => {
  const classId = e.target.value;

  if (!classId) return;

  selected.resultClassId = classId;

  // reset student
  selected.resultStudentId = null;
  resultStudentSelect.innerHTML = '<option value="">--Select Student--</option>';

  const students = await loadStudentsByClass(classId);

  students.forEach(s => {
    const option = document.createElement("option");
    option.value = s.id; // UUID
    option.textContent = s.full_name;
    resultStudentSelect.appendChild(option);
  });

  const subjects = await loadSubjectsByClass(classId);
  renderSubjectInputs(subjects);
});

resultStudentSelect.addEventListener("change", (e) => {
  selected.resultStudentId = e.target.value || null;
});


/* ===============================
   SUBMIT RESULTS FORM HANDLER
================================ */
resultForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  showSpinner("Validating fields...");

  try {
    // STATE-FIRST VALUES
    const studentId = selected.resultStudentId;
    const classId = selected.resultClassId;
    const term = document.getElementById("resultTerm")?.value?.trim();
    const session = document.getElementById("resultSession")?.value?.trim();
    const gender = document.getElementById("studentGender")?.value;

    // VALIDATION (STATE + DOM MIXED ONLY WHERE NECESSARY
    const missingFields = [];

    if (!classId) missingFields.push("Class");
    if (!studentId) missingFields.push("Student");
    if (!term) missingFields.push("Term");
    if (!session) missingFields.push("Session");
    if (!gender) missingFields.push("Gender");

    if (missingFields.length) {
      alert("Please fill/select: " + missingFields.join(", "));
      return;
    }

    // SUBJECT VALIDATION
    const subjectRows = resultSubjectsContainer.querySelectorAll(".subject-row");

    if (!subjectRows.length) {
      alert("No subjects to save.");
      return;
    }

    // SUBJECT RESULTS
const resultsArray = [];

const selectedType = getSelectedCAType();
if (!CA_TYPES[selectedType]) {
  throw new Error("Invalid CA type selected");
}
const config = CA_TYPES[selectedType];

subjectRows.forEach(row => {
  const subjectId = row.dataset.subjectId;

  let total = 0;

  const breakdown = {};

  config.parts.forEach(part => {
    const value =
      parseInt(row.querySelector(`[name="${part.key}_${subjectId}"]`)?.value) || 0;

    breakdown[part.key] = value;
    total += value;
  });

  const grade = calculateGrade(total);

  resultsArray.push({
    subject_id: subjectId,
    subject_name: row.querySelector(".font-semibold")?.textContent || "Unknown",
    ...breakdown,
    total,
    grade
  });
});

    // PSYCHOMOTOR
    const psychomotorData = {};

    document.querySelectorAll("#psychomotorBody tr").forEach(row => {
      const name = row.querySelector("td:first-child")?.textContent?.trim();
      if (!name) return;

      const selectedRadio = row.querySelector('input[type="radio"]:checked');

      psychomotorData[name.toLowerCase().replace(/\s+/g, "_")] =
        selectedRadio ? parseInt(selectedRadio.value) : null;
    });

    // AFFECTIVE
    const affectiveData = {};

    document.querySelectorAll("#affectiveBody tr").forEach(row => {
      const name = row.querySelector("td:first-child")?.textContent?.trim();
      if (!name) return;

      const selectedRadio = row.querySelector('input[type="radio"]:checked');

      affectiveData[name.toLowerCase().replace(/\s+/g, "_")] =
        selectedRadio ? parseInt(selectedRadio.value) : null;
    });

    // ATTENDANCE
    const attendance = {
      days_opened: parseInt(document.getElementById("daysOpened")?.value) || 0,
      days_present: parseInt(document.getElementById("daysPresent")?.value) || 0,
      days_absent: parseInt(document.getElementById("daysAbsent")?.value) || 0
    };

    // TERM DATES
    const term_duration = {
      term_begins: document.getElementById("termBegins")?.value || null,
      term_ends: document.getElementById("termEnds")?.value || null,
      next_term_begins: document.getElementById("nextTermBegins")?.value || null
    };

    // COMMENTS
    const teacherComment =
      document.getElementById("teacherComment")?.value.trim() || "";

    const headmasterComment =
      document.getElementById("headmasterComment")?.value.trim() || "";

    // FINAL SAFETY CHECK (STATE)
  if (!selected.resultStudentId) {
  return alert("Please select a student.");
}

if (!selected.resultClassId) {
  return alert("Please select a class.");
}

    // PAYLOAD
    const payload = {
      student_id: selected.resultStudentId,
      class_id: selected.resultClassId,
      term: term.trim(),
      session: session.trim(),
      gender,
      results: resultsArray,
      psychomotor_domain: psychomotorData,
      affective_domain: affectiveData,
      attendance,
      term_duration,
      teacher_comment: teacherComment,
      headmaster_comment: headmasterComment,
      ca_type: selectedType
    };

    // SAVE
    showSpinner("Saving result...");

    const { error } = await supabaseClient.rpc(
      "save_result_with_credit",
      { payload }
    );

    if (error) {
      if (error.message.includes("NO_CREDITS")) {
        alert("No credits remaining. Please purchase more.");
        return;
      }

      alert("Failed to save result: " + error.message);
      return;
    }

    alert("Result saved successfully!");

await loadCredits();

resetResultForm();

  } catch (err) {
    console.error(err);
    alert("Unexpected error occurred: " + err.message);

  } finally {
    hideSpinner();
  }
});

    // ---------- 11. Reset UI ----------
function resetResultForm() {
  try {
    resultForm.reset();

    // CLEAR SUBJECTS
    resultSubjectsContainer.innerHTML = "";

    // CLEAR PSYCHOMOTOR + AFFECTIVE
    document
      .querySelectorAll('#psychomotorBody input[type="radio"], #affectiveBody input[type="radio"]')
      .forEach(r => (r.checked = false));

    // RESET DROPDOWNS
    resetDropdown({
      selectId: "resultClass",
      textId: "resultClassSelectedText",
      placeholder: "Select class"
    });

    resetDropdown({
      selectId: "resultStudent",
      textId: "studentSelectedText",
      placeholder: "Select student"
    });

    // CLEAR STATE
    selected.resultStudentId = null;
    selected.resultClassId = null;

  } catch (err) {
    console.error("Reset error:", err);
  }
}

// =======================
// Initialize Result Class Dropdown
// =======================
document.addEventListener("DOMContentLoaded", async () => {
  const classes = await loadClasses();

  populateClassDropdown({
    classes,
    dropdownId: "resultClassDropdown",
    selectId: "resultClass",
    textId: "resultClassSelectedText",
    placeholder: "Select class",
    resetOption: true,
    stateKey: "resultClassId",

    onChange: (cls) => {
      console.log("Result class selected:", cls?.id);

      if (!cls) return;

      selected.resultClassId = cls.id;

    }
  });

  document
    .getElementById("resultClassDropdown")
    ?.classList.remove("show");
});


// ===============================
// MANAGE RESULTS
// ===============================
const editResultModal = document.getElementById("editResultModal");
const editResultForm = document.getElementById("editResultForm");
const editResultSubjects = document.getElementById("editResultSubjects");

let currentEditingResult = null;

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

function getHeadmasterComment(grade, average) {
  if (!grade) return "Requires Attention";

  const map = {
    "A1": "Outstanding performance. Keep it up.",
    "B2": "Excellent performance with minor areas to improve.",
    "B3": "Very good performance. Continue improving consistency.",
    "C4": "Good performance but can do better with more effort.",
    "C5": "Fair performance. Needs more dedication.",
    "D7": "Below average. Significant improvement required.",
    "E8": "Weak performance. Extra academic support needed.",
    "F9": "Poor performance. Immediate intervention required."
  };

  return map[grade] || "Performance needs review.";
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

function formatName(str) {
      return str.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    }

const U = (v) => {
  const value = (v === null || v === undefined || v === "") ? "N/A" : String(v);
  return value.toUpperCase();
};

function formatDateFancy(dateString) {
  if (!dateString) return "N/A";

  const date = new Date(dateString);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function getAttendanceInsight(present, total) {
  if (!present || !total || total === 0) {
    return "Attendance data not available for this term.";
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

async function toggleLockResult(
  studentId,
  classId,
  term,
  session,
  currentState
) {
  try {

    if (!studentId || !classId) {
      throw new Error("Missing studentId or classId");
    }

    showSpinner(
      currentState
        ? "Unlocking result..."
        : "Locking result..."
    );

    const { error } = await supabaseClient
      .from("results")
      .update({
        is_locked: !currentState
      })
      .eq("student_id", studentId)
      .eq("class_id", classId)
      .eq("term", term)
      .eq("session", session);

    if (error) throw error;

    alert(
      !currentState
        ? "Result locked successfully"
        : "Result unlocked successfully"
    );

showSpinner("Refreshing records...");

    await renderManageResults();

  } catch (err) {

    console.error(err);

    alert(
      "Failed to update lock state: " + err.message
    );

  } finally {

    hideSpinner();
  }
}

// ---------- DOM Elements ----------
const manageClassSelect = document.getElementById("manageResultClass");
const manageStudentContainer = document.getElementById("manageStudentContainer");

// ---------- Load Students by Class ----------
manageClassSelect.addEventListener("change", async (e) => {
  const classId = e.target.value;

  selected.manageResultClassId = classId || null;

  if (!classId) return;

  const students = await loadStudentsByClass(classId);

  populateStudentDropdown({
    students,
    selectId: "manageStudent",
    dropdownId: "manageStudentDropdown",
    textId: "manageStudentText",
    placeholder: "Select student",
    stateKey: "manageResultStudentId"
  });

  selected.manageStudentId = null;

  renderManageResults();
});

// ---------- Toggle Manage Student Dropdown ----------
function toggleManageStudentDropdown() {
  toggleStudentDropdown("manageStudentDropdown");
}


// ===============================
// RENDER MANAGE RESULTS
// ===============================
async function renderManageResults() {
  const classId = selected.manageResultClassId;
  const studentId = selected.manageResultStudentId;
  const term = document.getElementById("manageTerm")?.value;
  const session = document.getElementById("manageSession")?.value?.trim();

  if (!classId) return;

  manageStudentContainer.innerHTML =
    "<div class='p-10 text-center text-gray-400 animate-pulse'>Fetching records...</div>";

  try {
    const { data: role } = await supabaseClient.rpc("current_user_role");

// GLOBAL ROLE
window.currentUserRole = role;

    let query = supabaseClient
  .from("results")
  .select("*, students!inner(full_name, student_id, image_url), classes(name)")
  .eq("class_id", classId);

    if (studentId) query = query.eq("student_id", studentId);
    if (term) query = query.eq("term", term);
    if (session) query = query.eq("session", session);

    const { data, error } = await query;
    if (error) throw error;

    const results = data || [];

    updateResultsCount(results);

    if (!results.length) {
      manageStudentContainer.innerHTML =
        `<p class="p-4 text-gray-500 text-center w-full">No results found.</p>`;
      return;
    }

    manageStudentContainer.innerHTML = "";

    results.forEach(item => {
      const studentName = item.students?.full_name || "Unknown";
      const imageUrl = item.students?.image_url;

const isLocked = item.is_locked === true;

// ROLE FLAGS
const isAdmin = role === "admin";
const isTeacher = role === "teacher";
const isStudent = role === "student";

// PERMISSION RULES-

// VIEW RULE
const canView =
  isAdmin ||
  isTeacher ||
  (isStudent && isLocked);

// EDIT RULE
const canEdit =
  isAdmin ||
  (isTeacher && !isLocked);

// DELETE RULE
const canDelete =
  isAdmin ||
  (isTeacher && !isLocked);

// LOCK RULE
const canLock = isAdmin;

      const avatar = imageUrl
        ? `<img src="${imageUrl}" class="w-10 h-10 rounded-full object-cover">`
        : `<div class="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
             ${studentName.charAt(0)}
           </div>`;

      const lockBtn = isAdmin
        ? `<button 
             onclick="toggleLockResult('${item.student_id}','${item.class_id}','${item.term}','${item.session}', ${isLocked})"
             class="py-2 rounded-lg text-[10px] font-black uppercase 
                    ${isLocked ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}">
             ${isLocked ? 'Unlock 🔓' : 'Lock ✓'}
           </button>`
        : "";

      const card = document.createElement("div");
      
const key = createResultKey(item);

card.dataset.key = key;

card.dataset.item = JSON.stringify(item);

card.className =
  "data-card border p-4 rounded-xl bg-white shadow-sm hover:shadow-md transition-all cursor-pointer select-none";

      card.innerHTML = `
      
      ${
  isAdmin
    ? `
      <div class="flex justify-end mb-2">
        <button
          onclick="toggleResultSelection(this.closest('.data-card'), ${JSON.stringify(item).replace(/"/g, '&quot;')})"
          class="select-result-btn bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
          Select
        </button>
      </div>
    `
    : ""
}
      
  <div class="flex items-center gap-3 mb-4 border-b pb-3">
    ${avatar}
    <div>
      <h4 class="font-bold text-gray-800">${studentName}</h4>
      <p class="text-xs text-gray-500">${item.term} • ${item.session}</p>
    </div>
  </div>
  
  <div class="grid grid-cols-4 gap-2">

    ${
      canView
        ? `<button 
            onclick="viewResultPreview('${item.student_id}','${item.class_id}','${item.term}','${item.session}')"
            class="bg-blue-50 text-blue-700 py-2 rounded-lg text-[10px] font-black uppercase">
            View
          </button>`
        : `<button disabled class="bg-gray-100 text-gray-400 py-2 rounded-lg text-[10px] font-black uppercase opacity-50">
            Locked
          </button>`
    }

    ${
      canEdit
        ? `<button 
            onclick="handleEditClick('${item.student_id}','${item.class_id}','${item.term}','${item.session}')"
            class="bg-gray-50 text-gray-700 py-2 rounded-lg text-[10px] font-black uppercase">
            Edit
          </button>`
        : ""
    }

    ${
      canDelete
        ? `<button 
            onclick="deleteResult('${item.student_id}','${item.class_id}','${item.term}','${item.session}')"
            class="bg-red-50 text-red-600 py-2 rounded-lg text-[10px] font-black uppercase">
            Delete
          </button>`
        : ""
    }

    ${
      canLock
        ? `<button 
            onclick="toggleLockResult('${item.student_id}','${item.class_id}','${item.term}','${item.session}', ${isLocked})"
            class="py-2 rounded-lg text-[10px] font-black uppercase 
              ${isLocked ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}">
            ${isLocked ? 'Unlock 🔓' : 'Lock ✓'}
          </button>`
        : ""
    }

  </div>
`;

if (isAdmin) {

  card.addEventListener("click", (e) => {

    if (e.target.closest("button")) return;

    toggleResultSelection(card, item);

  });

}

      manageStudentContainer.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    manageStudentContainer.innerHTML =
      `<p class="text-red-500 p-4 text-center">Connection Error.</p>`;
  }
}

// ---------- Re-render on Term & Session change ----------
document.getElementById("manageStudent")?.addEventListener("change", renderManageResults);
document.getElementById("manageTerm")?.addEventListener("change", renderManageResults);
document.getElementById("manageSession")?.addEventListener("input", renderManageResults); 


// ===============================
//RESULT PREVIEW
// ===============================
async function viewResultPreview(studentId, classId, term, session) {
  try {
    if (!studentId || !classId) {
      throw new Error("Missing studentId or classId");
    }

    const { data, error } = await supabaseClient
      .from("results")
           .select(`*,
  students(full_name, student_id),
  classes(name)
`)
      .match({
        student_id: studentId,
        class_id: classId,
        term,
        session
      });

    if (error || !data?.length) {
      console.error(error);
      return alert("Result record not found.");
    }

   const row = data[0];
const results = row.results || [];

// ---------- CA CONFIG (SOURCE OF TRUTH) ----------
const caType = row.ca_type || "standard_20_20_60";
const config = CA_TYPES[caType] || CA_TYPES.standard_20_20_60;

// ---------- TOTALS ----------
const numSubjects = results.length;

const totalMarks = results.reduce((sum, subject) => {
  const subjectTotal = config.parts.reduce((t, part) => {
    return t + Number(subject[part.key] || 0);
  }, 0);

  return sum + subjectTotal;
}, 0);

const maxTotal = numSubjects * 100;

const average = maxTotal
  ? Math.round((totalMarks / maxTotal) * 100)
  : 0;

const overallGrade = calculateGrade(average);

// ---------- Determine class position ----------
const { data: classData, error: classError } = await supabaseClient
  .from("results")
  .select("student_id, results, ca_type")
  .match({
    class_id: row.class_id,
    term: row.term,
    session: row.session
  });

if (classError) {
  console.error(classError);
}

let classTotals = [];

if (classData && classData.length) {
  classTotals = classData
    .map(record => {
      const recordResults = record.results || [];

      const recordType =
        record.ca_type || "standard_20_20_60";

      const recordConfig =
        CA_TYPES[recordType] ||
        CA_TYPES.standard_20_20_60;

      const total = recordResults.reduce((sum, subject) => {
        const subjectTotal = recordConfig.parts.reduce((t, part) => {
          return t + Number(subject[part.key] || 0);
        }, 0);

        return sum + subjectTotal;
      }, 0);

      return {
        student_id: record.student_id,
        total
      };
    })
    .sort((a, b) => b.total - a.total);
}

const position =
  classTotals.findIndex(c => c.student_id === studentId) + 1 || 1;

// ---------- POSITION FORMAT ----------
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

// ---------- SUBJECTS TABLE ----------
const rowsHtml = results.map(subject => {
  let total = 0;

  const caCells = config.parts.map(part => {
    const value = Number(subject[part.key] || 0);

    total += value;

    return `
      <td class="px-2 py-1 border border-black text-center">
        ${value}
      </td>
    `;
  }).join("");

  const grade = calculateGrade(total);

  return `
    <tr>
      <td class="px-2 py-1 border border-black text-left uppercase">
        ${subject.subject_name}
      </td>

      ${caCells}

      <td class="px-2 py-1 border border-black text-center bg-gray-100">
        ${total}
      </td>

      <td class="px-2 py-1 border border-black text-center">
        ${grade}
      </td>

      <td class="px-2 py-1 border border-black text-center italic">
        ${getComment(grade)}
      </td>
    </tr>
  `;
}).join("");

// ---------- SUMMARY FOOTER ----------
const summaryRowHtml = `
<tr class="bg-gray-200 font-bold">

  <td class="px-2 py-1 border border-black text-center uppercase">
    Overall Total
  </td>

  <td colspan="${config.parts.length}"
      class="px-2 py-1 border border-black text-center">
    ${totalMarks}
  </td>

  <td class="px-2 py-1 border border-black text-center">
    ${average}%
  </td>

  <td class="px-2 py-1 border border-black text-center">
    ${overallGrade}
  </td>

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

const headmasterComment =
  row.headmaster_comment?.trim()
    ? row.headmaster_comment
    : getHeadmasterComment(overallGrade, average);

    // ---------- Attendance ----------
const attendance = row.attendance || {};

const daysOpenedRaw = attendance.days_opened;
const daysPresentRaw = attendance.days_present;
const daysAbsentRaw = attendance.days_absent;

// Safe numbers
const daysOpened = Number(daysOpenedRaw) || 0;
const daysPresent = Number(daysPresentRaw) || 0;
const daysAbsent = Number(daysAbsentRaw) || 0;

// Insight
const attendanceInsight = getAttendanceInsight(daysPresent, daysOpened);

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

//DETERMINE VIEW RESTRICTIONS
const { data: role } = await supabaseClient.rpc("current_user_role");

const isAdmin = role === "admin";
const isTeacher = role === "teacher";
const isStudent = role === "student";

// Fetch school info based on school_id from result row
const { data: schoolData, error: schoolError } = await supabaseClient
  .from("schools")
  .select("*")
  .eq("id", row.school_id)
  .single();

if (schoolError) {
  console.warn("Could not fetch school info:", schoolError);
  
  schoolData = {
    name: "Your School Name",
    motto: "MOTTO",
    address: "Address not set",
    phone: "N/A",
    logo_url: "default-logo.png",
    headmaster_signature_url: "default-signature.png"
  };
}

//CALCULATE AND DISPLAY OFF CA TYPE
const theadHtml = `
<thead>
  <tr>
    <th rowspan="2" style="text-align:left;">Subjects</th>

    <th colspan="${config.parts.length}">
      Continuous Assessment
    </th>

    <th rowspan="2">Total</th>
    <th rowspan="2">Grade</th>
    <th rowspan="2">Comments</th>
  </tr>

  <tr class="sub-head">
    ${config.parts.map(p => `<th>${p.label}</th>`).join("")}
  </tr>
</thead>
`;

const subjectCount = results.length;
const isCompact = subjectCount > 15;

    // ---------- Full HTML ----------
    const reportHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Report - ${row.students?.full_name}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap');

body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #e0e0e0;
  margin: 0;
  padding: 10px;
  color: #000;
}

/* MAIN CARD */
.report-card {
  background: #fdfdfd;

  /* Paper texture */
  background:
    linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.92)),
    repeating-linear-gradient(
      0deg,
      rgba(0,0,0,0.015) 0px,
      rgba(0,0,0,0.015) 1px,
      transparent 1px,
      transparent 3px
    );

  width: 190mm;  
  height: 277mm;
  overflow: visible;
  margin: auto;
  padding: 6mm;
  box-sizing: border-box;
  page-break-inside: avoid;
  break-inside: avoid;
  border: 2px solid #1a3d7c;
  outline: 4px double #1a3d7c;
  outline-offset: -8px;
  position: relative;
  box-shadow: 0 0 10px rgba(0,0,0,0.15);
}

/* Watermark seal circle */
.report-card::before {
  content: "";
  position: absolute;
  width: 300px;
  height: 300px;
  border: 8px double rgba(26, 61, 124, 0.08);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 0;
}

/* HEADER */
.header-container {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  border-bottom: 2px solid #1a3d7c;
  padding-bottom: 10px;
}

.logo {
  width: 80px;
  height: 80px;
  border: 1px solid #1a3d7c;
  background: #fff;
  flex-shrink: 0;
}

.logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

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

.header-text {
  text-align: center;
  flex: 1;
}

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

/* BANNER */
.report-banner {
  background: #1a3d7c;
  color: white;
  padding: 6px;
  font-weight: bold;
  font-size: 12px;
  margin: 15px 0;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 2px;
  border-top: 2px solid #1a3d7c;
  border-bottom: 2px solid #1a3d7c;
}

/* INFO GRID */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1.5px solid #1a3d7c;
  margin-bottom: 15px;
  background: rgba(255,255,255,0.75);
}

.info-item {
  display: flex;
  border-right: 1px solid #1a3d7c;
  border-bottom: 1px solid #1a3d7c;
}

.label {
  width: 120px;
  padding: 3px 5px;
  font-weight: bold;
  font-size: 10px;
  background: #e3f2fd;
  border-right: 1px solid #1a3d7c;
  text-transform: uppercase;
  color: #1a3d7c;
}

.value {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
}

/* TABLES */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  margin-bottom: 15px;
  background: white;
}

th, td {
  border: 1.5px solid #1a3d7c;
  padding: 3px;
}

th {
  background: #bbdefb;
  color: #1a3d7c;
  text-transform: uppercase;
}

.sub-head th {
  background: #e3f2fd;
}

td {
  text-align: center;
  font-weight: 600;
}

td:first-child {
  text-align: left;
}

table, tr, td, th {
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Row striping */
tbody tr:nth-child(even) {
  background: #f5f9ff;
}

/* SECTIONS */
.columns {
  display: flex;
  gap: 15px;
}

.left-col { flex: 2.2; }
.right-col { flex: 1; }

.section-title {
  background: #1a3d7c;
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
  border: 1.5px solid #1a3d7c;
  background: rgba(255, 255, 255, 0.85);
  text-align: center;
  line-height: 1.4;

  margin-top: 2px;
  margin-bottom: 10px;

  font-style: italic;
  font-weight: 600;
  letter-spacing: 0.2px;

  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(26, 61, 124, 0.1);

  position: relative;
}

/* label */
.attendance-insight::before {
  content: "REMARK";
  position: absolute;
  top: -7px;
  left: 10px;

  background: #fff;
  padding: 0 5px;

  font-size: 9px;
  font-weight: bold;
  color: #1a3d7c;
  letter-spacing: 1px;
}

/* COMMENTS */
.comment-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1.5px solid #1a3d7c;
  font-weight: bold;
}

.comment-box {
  padding: 8px;
  border-right: 1.5px solid #1a3d7c;
  font-size: 10px;
  min-height: 60px;
  background: #fff;
}

.comment-box:last-child {
  border-right: none;
}

.signature-area {
  border-top: 2px solid #1a3d7c;
  padding: 10px;
  text-align: center;
  font-size: 11px;
  background: rgba(255,255,255,0.6);
  margin-top: 10px;
}

/* WATERMARK TEXT */
.watermark {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 80px;
  font-weight: 900;
  opacity: 0.04;
  color: #1a3d7c;
  pointer-events: none;
}

/* Divider */
hr {
  border: none;
  border-top: 1px solid rgba(26, 61, 124, 0.3);
  margin: 8px 0;
}

/* PRINT */
@media print {
  body {
    background: white !important;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .report-card {
    border: 2px solid #1a3d7c;
    outline: 4px double #1a3d7c;
    box-shadow: none;
    width: 100%;
    background: #fdfdfd !important;
    filter: contrast(0.98) brightness(0.98);
    page-break-after: avoid;
  break-after: avoid;
  }

  .no-print {
    display: none !important;
  }

  @page {
    size: A4;
    margin: 10mm;
  }
  
}

/* BUTTON */
.no-print {
  text-align: center;
  padding: 20px;
}

.no-print button {
  display: inline-block;
  padding: 10px 25px;
  border: none;
  font-weight: bold;
  border-radius: 4px;
  cursor: pointer;
}

.report-card.compact table {
  font-size: 9.2px;
}

.report-card.compact th,
.report-card.compact td {
  padding: 2px 3px;
  line-height: 1.15;
}

.report-card.compact .columns {
  gap: 12px;
}

.report-card.compact .comment-box {
  font-size: 10px;
  padding: 7px;
}

.report-card.compact .attendance-insight {
  font-size: 10.5px;
  padding: 9px 10px;
}

</style>
</head>
<body>
    
    ${
  isAdmin
    ? `<div class="no-print">
         <button onclick="window.print()">PRINT REPORT CARD</button>
       </div>`
    : isTeacher || isStudent
      ? `<div class="no-print">VIEW ONLY</div>`
      : `<div class="no-print">ACCESS DENIED</div>`
}
    
    <div class="report-card ${isCompact ? "compact" : ""}">
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
      
      <div class="serial-number">
  SN: ${row.serial_number || '---'}
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
    <div class="value">${U(row.classes?.name || "N/A")}</div>
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
        <div class="attendance-insight">
    ${getAttendanceInsight(daysPresent, daysOpened)}
  </div>
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
          ${theadHtml}
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

      <div class="signature-area" style="margin-top: 20px; text-align: center;">
  <strong>HEADMASTER'S SIGNATURE:</strong>

  <div style="margin-top: 10px; display: flex; flex-direction: column; align-items: center;">
    
    <!-- signature image -->
    <img 
      src="${schoolData?.headmaster_signature_url || 'default-signature.png'}" 
      alt="Headmaster Signature"
      style="
        height: 50px;
        max-width: 150px;
        object-fit: contain;
        display: block;
      "
    >

    <!-- signature line -->
    <div style="
      border-top: 1px solid #000;
      width: 200px;
      margin-top: 5px;
    "></div>
  </div>
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

  } catch (err) {
    console.error(err);
    alert("Error loading report.");
  }
}


// ===============================
// EDIT MODAL LOGIC
// ===============================
async function handleEditClick(studentId, classId, term, session) {
  try {
    if (!studentId || !classId) {
      throw new Error("Missing studentId or classId");
    }
    const { data, error } = await supabaseClient
      .from("results")
      .select("*, students(full_name, student_id, sex)")
      .match({
        student_id: studentId,
        class_id: classId,
        term: term,
        session: session
      })
      .single();

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

const caType = data.ca_type || subjects?.[0]?.ca_type || "standard_20_20_60";
const config = CA_TYPES[caType];

// ---------- 1. Subjects ----------
const subjectFieldsHtml = subjects.map((s, i) => {

  const inputsHtml = config.parts.map(part => {
    const value = s[part.key] ?? 0;

    return `
      <input
        type="number"
        name="${part.key}_${s.subject_id ?? i}"
        value="${value}"
        max="${part.max}"
        class="border p-2 text-center rounded-lg font-bold"
        placeholder="${part.label}"
      >
    `;
  }).join("");

  return `
    <div class="p-3 border rounded-xl bg-gray-50 mb-3 subject-row"
         data-subject-id="${s.subject_id ?? i}">

      <label class="block text-[10px] font-black uppercase text-gray-500 mb-2">
        ${s.subject_name ?? "Subject"}
      </label>

      <div class="grid grid-cols-${config.parts.length} gap-3">
        ${inputsHtml}
      </div>
    </div>
  `;
}).join("") || "<p class='text-xs text-gray-400'>No subjects found</p>";

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

enableOutsideClickClose("editResultModal");

// ===============================
// EDIT RESULT FORM SUBMISSION
// ===============================
editResultForm.onsubmit = async (e) => {
  e.preventDefault();

  if (!currentEditingResult) return;

  showSpinner("Saving changes...");

  try {
    const studentId = currentEditingResult.student_id;
    const classId = currentEditingResult.class_id;

    const originalTerm = currentEditingResult.term;
    const originalSession = currentEditingResult.session;

    if (!studentId || !classId) {
      throw new Error("Missing student or class record.");
    }

    // 1. CA TYPE CONFIG
    const caType =
      currentEditingResult.ca_type || "standard_20_20_60";

    const config =
      CA_TYPES[caType] || CA_TYPES.standard_20_20_60;

    // 2. UPDATE SUBJECT RESULTS
    const updatedResults = (currentEditingResult.results || []).map((s, i) => {
      let total = 0;
      const breakdown = {};

      config.parts.forEach(part => {
        const value =
          parseInt(
            editResultForm[`${part.key}_${s.subject_id ?? i}`]?.value
          ) || 0;

        breakdown[part.key] = value;
        total += value;
      });

      return {
        subject_id: s.subject_id ?? i,
        subject_name: s.subject_name,
        ...breakdown,
        total,
        grade: calculateGrade(total)
      };
    });

    // 3. UPDATE PSYCHOMOTOR
    const psychomotorData = {};

    Object.keys(currentEditingResult.psychomotor_domain || {}).forEach(key => {
      psychomotorData[key] =
        parseInt(editResultForm[`psych_${key}`]?.value) || 0;
    });

    // 4. UPDATE AFFECTIVE
    const affectiveData = {};

    Object.keys(currentEditingResult.affective_domain || {}).forEach(key => {
      affectiveData[key] =
        parseInt(editResultForm[`affective_${key}`]?.value) || 0;
    });

    // 5. BASIC FIELDS
    const teacherComment =
      editResultForm["teacher_comment"]?.value.trim() || "";

    const headmasterComment =
      editResultForm["headmaster_comment"]?.value.trim() || "";

    const gender =
      editResultForm["gender"]?.value || "";

    const term =
      editResultForm["term"]?.value || "";

    const session =
      editResultForm["session"]?.value || "";

    // 6. ATTENDANCE
    const attendance = {
      days_opened:
        parseInt(editResultForm["attendance_days_opened"]?.value) || 0,

      days_present:
        parseInt(editResultForm["attendance_days_present"]?.value) || 0,

      days_absent:
        parseInt(editResultForm["attendance_days_absent"]?.value) || 0
    };

    // 7. TERM DURATION
    const termDuration = {
      term_begins:
        editResultForm["term_begins"]?.value || "",

      term_ends:
        editResultForm["term_ends"]?.value || "",

      next_term_begins:
        editResultForm["next_term_begins"]?.value || ""
    };

    // 8. PAYLOAD
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
      term_duration: termDuration,
      ca_type: caType
    };

    // 9. UPDATE USING FULL UNIQUE KEY
    const { error } = await supabaseClient
      .from("results")
      .update(payload)
      .match({
        student_id: studentId,
        class_id: classId,
        term: originalTerm,
        session: originalSession
      });

    if (error) throw error;

    // 10. SUCCESS
    alert("Saved Successfully!");

    closeModal();

    showSpinner("Refreshing...");
    await renderManageResults (manageClassSelect.value);

  } catch (err) {
    console.error(err);
    alert("Failed to save changes: " + err.message);

  } finally {
    hideSpinner();
  }
};

// ---------- Delete Result ----------
async function deleteResult(studentId, classId, term, session) {
  if (!confirm("Delete this result permanently?")) return;

  showSpinner("Deleting result...");

  try {
    if (!studentId || !classId) {
      throw new Error("Missing identifiers for deletion");
    }

    const { error } = await supabaseClient
      .from("results")
      .delete()
      .match({
        student_id: studentId,
        class_id: classId,
        term,
        session
      });

    if (error) throw error;

    showSpinner("Refreshing records...");

    const students = await loadStudentsByClass(manageClassSelect.value);

    renderManageResults(students);

  } catch (err) {
    console.error(err);
    alert("Delete failed: " + err.message);

  } finally {
    hideSpinner();
  }
}

// ---------- Close Modal ----------
function closeModal() {
  editResultModal.classList.add("hidden");
  editResultSubjects.innerHTML = "";
  currentEditingResult = null;
}


// ===============================
// RESULT MULTIPLE SELECTION
// ===============================
let selectedStudents = new Set();
let selectionMode = false;

const selectedResults = new Map();

// UNIQUE KEY
function createResultKey(item) {
  return [
    item.student_id,
    item.class_id,
    item.term,
    item.session
  ].join("__");
}

// TOGGLE SINGLE RESULT
function toggleResultSelection(
  card,
  item
) {

  // ADMIN ONLY
  if (
    window.currentUserRole !==
    "admin"
  ) return;

  const key =
    createResultKey(item);

  const button =
    card.querySelector(
      ".select-result-btn"
    );

  // REMOVE
  if (
    selectedResults.has(key)
  ) {

    selectedResults.delete(
      key
    );

    card.classList.remove(
      "ring-2",
      "ring-blue-500",
      "bg-blue-50"
    );

    if (button) {

      button.textContent =
        "Select";

      button.classList.remove(
        "bg-blue-600",
        "text-white"
      );

      button.classList.add(
        "bg-gray-100",
        "text-gray-700"
      );
    }

  } else {

    // STORE FULL OBJECT
    selectedResults.set(
      key,
      item
    );

    card.classList.add(
      "ring-2",
      "ring-blue-500",
      "bg-blue-50"
    );

    if (button) {

      button.textContent =
        "Selected";

      button.classList.remove(
        "bg-gray-100",
        "text-gray-700"
      );

      button.classList.add(
        "bg-blue-600",
        "text-white"
      );
    }
  }

  updateBulkBar();
}

// UPDATE BULK BAR
function updateBulkBar() {

  const bar =
    document.getElementById(
      "bulkActionBar"
    );

  const count =
    document.getElementById(
      "selectedCount"
    );

  // ADMIN ONLY
  if (
    window.currentUserRole !==
    "admin"
  ) {

    if (bar) {
      bar.classList.add(
        "hidden"
      );
    }

    return;
  }

  const total =
    selectedResults.size;

  if (count) {
    count.textContent =
      `${total} selected`;
  }

  if (!bar) return;

  if (total > 0) {

    bar.classList.remove(
      "hidden"
    );

  } else {

    bar.classList.add(
      "hidden"
    );
  }
}

// DESELECT ALL
function deselectAllStudents() {

  selectedResults.clear();

  document
    .querySelectorAll(".data-card")
    .forEach(card => {

      card.classList.remove(
        "ring-2",
        "ring-blue-500",
        "bg-blue-50"
      );

      const button =
        card.querySelector(".select-result-btn");

      if (button) {

        button.textContent = "Select";

        button.classList.remove(
          "bg-blue-600",
          "text-white"
        );

        button.classList.add(
          "bg-gray-100",
          "text-gray-700"
        );
      }
    });

  updateBulkBar();
}

// SELECT ALL
function selectAllStudents() {

  deselectAllStudents();

  document
    .querySelectorAll(".data-card")
    .forEach(card => {

      const raw =
        card.dataset.item;

      if (!raw) return;

      const item =
        JSON.parse(raw);

      const key =
        createResultKey(item);

      selectedResults.set(key, item);

      card.classList.add(
        "ring-2",
        "ring-blue-500",
        "bg-blue-50"
      );

      const button =
        card.querySelector(".select-result-btn");

      if (button) {

        button.textContent = "Selected";

        button.classList.remove(
          "bg-gray-100",
          "text-gray-700"
        );

        button.classList.add(
          "bg-blue-600",
          "text-white"
        );
      }
    });

  updateBulkBar();
}

// PRINT SELECTED
let isBulkPrinting = false;

async function printSelectedStudents(buttonEl) {

  // Prevent spam clicking
  if (isBulkPrinting) return;

  if (!selectedResults.size) {
    return alert("No results selected");
  }

  isBulkPrinting = true;

  // ---------- BUTTON LOADING STATE ----------
  const originalText = buttonEl?.innerHTML;

  if (buttonEl) {

    buttonEl.disabled = true;

    buttonEl.innerHTML = `
      <span style="
        display:inline-block;
        width:14px;
        height:14px;
        border:2px solid #fff;
        border-top:2px solid transparent;
        border-radius:50%;
        animation:spin .6s linear infinite;
        margin-right:8px;
        vertical-align:middle;
      "></span>

      Preparing Reports...
    `;
  }

  try {

    // OPEN WINDOW IMMEDIATELY
    const win = window.open("", "_blank");

    // Popup blocked
    if (!win) {

      alert(
        "Popup blocked. Please allow popups for this site."
      );

      return;
    }

    // Temporary loading screen
    win.document.write(`

<!DOCTYPE html>

<html>

<head>

<title>Preparing Reports...</title>

<style>

body{
  font-family:Arial,sans-serif;
  display:flex;
  align-items:center;
  justify-content:center;
  height:100vh;
  background:#f5f5f5;
}

.loader{
  text-align:center;
}

.spinner{
  width:50px;
  height:50px;
  border:5px solid #ddd;
  border-top:5px solid #1a3d7c;
  border-radius:50%;
  animation:spin 1s linear infinite;
  margin:auto;
}

@keyframes spin{
  to{
    transform:rotate(360deg);
  }
}

</style>

</head>

<body>

<div class="loader">

<div class="spinner"></div>

<p>
Preparing bulk reports...
</p>

</div>

</body>

</html>

    `);

    win.document.close();

    // ---------- BUILD REPORTS ----------
    const rows = [...selectedResults.values()];

    const reports = [];

    for (const row of rows) {

      const report =
        await prepareReportData(row);

      reports.push(
        buildReportHTML(report)
      );
    }

    // ---------- FINAL HTML ----------
    win.document.open();

    win.document.write(`

<!DOCTYPE html>

<html>

<head>

<title>Bulk Report Printing</title>

${getReportStyles()}

<style>

@keyframes spin{
  to{
    transform:rotate(360deg);
  }
}

.page-break{
  page-break-after:always;
  break-after:page;
}

.page-break:last-child{
  page-break-after:auto;
  break-after:auto;
}

</style>

</head>

<body>

<div class="no-print" style="
  text-align:center;
  padding:20px;
">

<button onclick="window.print()">

PRINT ALL REPORTS

</button>

</div>

${reports.join("")}

</body>

</html>

    `);

    win.document.close();

  } catch (err) {

    console.error(err);

    alert(
      "Failed to generate reports."
    );

  } finally {

    isBulkPrinting = false;

    // Restore button
    if (buttonEl) {

      buttonEl.disabled = false;

      buttonEl.innerHTML = originalText;
    }
  }
}

function getReportStyles() {

  return `

<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap');

body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #e0e0e0;
  margin: 0;
  padding: 10px;
  color: #000;
}

/* MAIN CARD */
.report-card {
  background: #fdfdfd;

  /* Paper texture */
  background:
    linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.92)),
    repeating-linear-gradient(
      0deg,
      rgba(0,0,0,0.015) 0px,
      rgba(0,0,0,0.015) 1px,
      transparent 1px,
      transparent 3px
    );

  width: 190mm;  
  height: 277mm;
  overflow: visible;
  margin: auto;
  padding: 6mm;
  box-sizing: border-box;
  page-break-inside: avoid;
  break-inside: avoid;
  border: 2px solid #1a3d7c;
  outline: 4px double #1a3d7c;
  outline-offset: -8px;
  position: relative;
  box-shadow: 0 0 10px rgba(0,0,0,0.15);
}

/* Watermark seal circle */
.report-card::before {
  content: "";
  position: absolute;
  width: 300px;
  height: 300px;
  border: 8px double rgba(26, 61, 124, 0.08);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 0;
}

/* HEADER */
.header-container {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  border-bottom: 2px solid #1a3d7c;
  padding-bottom: 10px;
}

.logo {
  width: 80px;
  height: 80px;
  border: 1px solid #1a3d7c;
  background: #fff;
  flex-shrink: 0;
}

.logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

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

.header-text {
  text-align: center;
  flex: 1;
}

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

/* BANNER */
.report-banner {
  background: #1a3d7c;
  color: white;
  padding: 6px;
  font-weight: bold;
  font-size: 12px;
  margin: 15px 0;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 2px;
  border-top: 2px solid #1a3d7c;
  border-bottom: 2px solid #1a3d7c;
}

/* INFO GRID */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1.5px solid #1a3d7c;
  margin-bottom: 15px;
  background: rgba(255,255,255,0.75);
}

.info-item {
  display: flex;
  border-right: 1px solid #1a3d7c;
  border-bottom: 1px solid #1a3d7c;
}

.label {
  width: 120px;
  padding: 3px 5px;
  font-weight: bold;
  font-size: 10px;
  background: #e3f2fd;
  border-right: 1px solid #1a3d7c;
  text-transform: uppercase;
  color: #1a3d7c;
}

.value {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
}

/* TABLES */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  margin-bottom: 15px;
  background: white;
}

th, td {
  border: 1.5px solid #1a3d7c;
  padding: 3px;
}

th {
  background: #bbdefb;
  color: #1a3d7c;
  text-transform: uppercase;
}

.sub-head th {
  background: #e3f2fd;
}

td {
  text-align: center;
  font-weight: 600;
}

td:first-child {
  text-align: left;
}

table, tr, td, th {
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Row striping */
tbody tr:nth-child(even) {
  background: #f5f9ff;
}

/* SECTIONS */
.columns {
  display: flex;
  gap: 15px;
}

.left-col { flex: 2.2; }
.right-col { flex: 1; }

.section-title {
  background: #1a3d7c;
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
  border: 1.5px solid #1a3d7c;
  background: rgba(255, 255, 255, 0.85);
  text-align: center;
  line-height: 1.4;

  margin-top: 2px;
  margin-bottom: 10px;

  font-style: italic;
  font-weight: 600;
  letter-spacing: 0.2px;

  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(26, 61, 124, 0.1);

  position: relative;
}

/* label */
.attendance-insight::before {
  content: "REMARK";
  position: absolute;
  top: -7px;
  left: 10px;

  background: #fff;
  padding: 0 5px;

  font-size: 9px;
  font-weight: bold;
  color: #1a3d7c;
  letter-spacing: 1px;
}

/* COMMENTS */
.comment-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1.5px solid #1a3d7c;
  font-weight: bold;
}

.comment-box {
  padding: 8px;
  border-right: 1.5px solid #1a3d7c;
  font-size: 10px;
  min-height: 60px;
  background: #fff;
}

.comment-box:last-child {
  border-right: none;
}

.signature-area {
  border-top: 2px solid #1a3d7c;
  padding: 10px;
  text-align: center;
  font-size: 11px;
  background: rgba(255,255,255,0.6);
  margin-top: 10px;
}

/* WATERMARK TEXT */
.watermark {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 80px;
  font-weight: 900;
  opacity: 0.04;
  color: #1a3d7c;
  pointer-events: none;
}

/* Divider */
hr {
  border: none;
  border-top: 1px solid rgba(26, 61, 124, 0.3);
  margin: 8px 0;
}

/* PRINT */
@media print {
  body {
    background: white !important;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .report-card {
    border: 2px solid #1a3d7c;
    outline: 4px double #1a3d7c;
    box-shadow: none;
    width: 100%;
    background: #fdfdfd !important;
    filter: contrast(0.98) brightness(0.98);
    page-break-after: avoid;
  break-after: avoid;
  }

  .no-print {
    display: none !important;
  }

  @page {
    size: A4;
    margin: 10mm;
  }
  
}

/* BUTTON */
.no-print {
  text-align: center;
  padding: 20px;
}

.no-print button {
  display: inline-block;
  padding: 10px 25px;
  border: none;
  font-weight: bold;
  border-radius: 4px;
  cursor: pointer;
}

.report-card.compact table {
  font-size: 9.2px;
}

.report-card.compact th,
.report-card.compact td {
  padding: 2px 3px;
  line-height: 1.15;
}

.report-card.compact .columns {
  gap: 12px;
}

.report-card.compact .comment-box {
  font-size: 10px;
  padding: 7px;
}

.report-card.compact .attendance-insight {
  font-size: 10.5px;
  padding: 9px 10px;
}

</style>

`;

}

async function prepareReportData(row) {

  const results = row.results || [];

  // ---------- CA CONFIG ----------
  const caType =
    row.ca_type || "standard_20_20_60";

  const config =
    CA_TYPES[caType] ||
    CA_TYPES.standard_20_20_60;

  // ---------- TOTALS ----------
  const numSubjects = results.length;

  const totalMarks = results.reduce((sum, subject) => {

    const subjectTotal =
      config.parts.reduce((t, part) => {

        return t + Number(subject[part.key] || 0);

      }, 0);

    return sum + subjectTotal;

  }, 0);

  const maxTotal = numSubjects * 100;

  const average =
    maxTotal
      ? Math.round((totalMarks / maxTotal) * 100)
      : 0;

  const overallGrade =
    calculateGrade(average);

  // ---------- CLASS POSITION ----------
  const { data: classData, error: classError } =
    await supabaseClient
      .from("results")
      .select("student_id, results, ca_type")
      .match({
        class_id: row.class_id,
        term: row.term,
        session: row.session
      });

  if (classError) {
    console.error(classError);
  }

  let classTotals = [];

  if (classData?.length) {

    classTotals = classData
      .map(record => {

        const recordResults =
          record.results || [];

        const recordType =
          record.ca_type ||
          "standard_20_20_60";

        const recordConfig =
          CA_TYPES[recordType] ||
          CA_TYPES.standard_20_20_60;

        const total =
          recordResults.reduce((sum, subject) => {

            const subjectTotal =
              recordConfig.parts.reduce((t, part) => {

                return t + Number(subject[part.key] || 0);

              }, 0);

            return sum + subjectTotal;

          }, 0);

        return {
          student_id: record.student_id,
          total
        };

      })
      .sort((a, b) => b.total - a.total);
  }

  const position =
    classTotals.findIndex(
      c => c.student_id === row.student_id
    ) + 1 || 1;

  // ---------- SUBJECT TABLE ----------
  const rowsHtml = results.map(subject => {

    let total = 0;

    const caCells =
      config.parts.map(part => {

        const value =
          Number(subject[part.key] || 0);

        total += value;

        return `
          <td class="px-2 py-1 border border-black text-center">
            ${value}
          </td>
        `;

      }).join("");

    const grade =
      calculateGrade(total);

    return `
      <tr>

        <td class="px-2 py-1 border border-black text-left uppercase">
          ${subject.subject_name}
        </td>

        ${caCells}

        <td class="px-2 py-1 border border-black text-center bg-gray-100">
          ${total}
        </td>

        <td class="px-2 py-1 border border-black text-center">
          ${grade}
        </td>

        <td class="px-2 py-1 border border-black text-center italic">
          ${getComment(grade)}
        </td>

      </tr>
    `;

  }).join("");

  // ---------- SUMMARY ----------
  const summaryRowHtml = `
    <tr class="bg-gray-200 font-bold">

      <td class="px-2 py-1 border border-black text-center uppercase">
        Overall Total
      </td>

      <td colspan="${config.parts.length}"
          class="px-2 py-1 border border-black text-center">
        ${totalMarks}
      </td>

      <td class="px-2 py-1 border border-black text-center">
        ${average}%
      </td>

      <td class="px-2 py-1 border border-black text-center">
        ${overallGrade}
      </td>

      <td class="px-2 py-1 border border-black text-center italic">
        ${getComment(overallGrade)}
      </td>

    </tr>
  `;

  // ---------- TABLE HEADER ----------
  const theadHtml = `
    <thead>

      <tr>

        <th rowspan="2" style="text-align:left;">
          Subjects
        </th>

        <th colspan="${config.parts.length}">
          Continuous Assessment
        </th>

        <th rowspan="2">Total</th>
        <th rowspan="2">Grade</th>
        <th rowspan="2">Comments</th>

      </tr>

      <tr class="sub-head">

        ${config.parts.map(p => `
          <th>${p.label}</th>
        `).join("")}

      </tr>

    </thead>
  `;

  // ---------- PSYCHOMOTOR ----------
  const psychomotor =
    row.psychomotor_domain || {};

  const psychomotorHtml =
    Object.entries(psychomotor)
      .map(([activity, score]) => {

        const cols =
          [100, 85, 75, 65, 55]
            .map(val => `
              <td class="px-2 py-1 border border-black text-center">
                ${score === val ? "✔" : ""}
              </td>
            `)
            .join("");

        return `
          <tr>

            <td class="px-2 py-1 border border-black font-bold text-left">
              ${formatName(activity)}
            </td>

            ${cols}

          </tr>
        `;

      }).join("");

  // ---------- AFFECTIVE ----------
  const affective =
    row.affective_domain || {};

  const affectiveHtml =
    Object.entries(affective)
      .map(([trait, score]) => {

        const cols =
          [100, 85, 75, 65, 55]
            .map(val => `
              <td class="px-2 py-1 border border-black text-center">
                ${score === val ? "✔" : ""}
              </td>
            `)
            .join("");

        return `
          <tr>

            <td class="px-2 py-1 border border-black font-bold text-left">
              ${formatName(trait)}
            </td>

            ${cols}

          </tr>
        `;

      }).join("");

  // ---------- COMMENTS ----------
  const teacherComment =
    row.teacher_comment || "N/A";

  const headmasterComment =
    row.headmaster_comment?.trim()
      ? row.headmaster_comment
      : getHeadmasterComment(
          overallGrade,
          average
        );

  // ---------- ATTENDANCE ----------
  const attendance =
    row.attendance || {};

  const daysOpened =
    Number(attendance.days_opened) || 0;

  const daysPresent =
    Number(attendance.days_present) || 0;

  const daysAbsent =
    Number(attendance.days_absent) || 0;

  const attendanceInsight =
    getAttendanceInsight(
      daysPresent,
      daysOpened
    );

  // ---------- TERM DURATION ----------
  const termDuration =
    row.term_duration || {};

  const termBegins =
    termDuration.term_begins
      ? formatDateFancy(
          termDuration.term_begins
        )
      : "N/A";

  const termEnds =
    termDuration.term_ends
      ? formatDateFancy(
          termDuration.term_ends
        )
      : "N/A";

  const nextTermBegins =
    termDuration.next_term_begins
      ? formatDateFancy(
          termDuration.next_term_begins
        )
      : "N/A";

  // ---------- SCHOOL ----------
  let schoolData = {};

  const { data: school, error: schoolError } =
    await supabaseClient
      .from("schools")
      .select("*")
      .eq("id", row.school_id)
      .single();

  if (schoolError) {

    console.warn(
      "Could not fetch school info:",
      schoolError
    );

    schoolData = {
      name: "Your School Name",
      motto: "MOTTO",
      address: "Address not set",
      phone_numbers: "N/A",
      logo_url: "default-logo.png",
      headmaster_signature_url:
        "default-signature.png"
    };

  } else {

    schoolData = school;

  }

  // ---------- COMPACT ----------
  const subjectCount =
    results.length;

  const isCompact =
    subjectCount > 15;

  // ---------- RETURN ----------
  return {

    row,
    results,

    schoolData,

    config,

    totalMarks,
    average,
    overallGrade,

    position,
    classCount: classTotals.length,

    theadHtml,
    rowsHtml,
    summaryRowHtml,

    affectiveHtml,
    psychomotorHtml,

    teacherComment,
    headmasterComment,

    daysOpened,
    daysPresent,
    daysAbsent,

    attendanceInsight,

    termBegins,
    termEnds,
    nextTermBegins,

    isCompact

  };

}

function formatPosition(n) {

  if (!n || n <= 0) {
    return "N/A";
  }

  if (n % 100 >= 11 && n % 100 <= 13) {
    return `${n}th`;
  }

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

function buildReportHTML(report) {

  const {
    row,
    schoolData,

    average,
    overallGrade,
    totalMarks,

    position,
    classCount,

    theadHtml,
    rowsHtml,
    summaryRowHtml,

    affectiveHtml,
    psychomotorHtml,

    teacherComment,
    headmasterComment,

    daysOpened,
    daysPresent,
    daysAbsent,

    attendanceInsight,

    termBegins,
    termEnds,
    nextTermBegins,

    isCompact
  } = report;

  // ---------- POSITION FORMAT ----------
  function formatPosition(n) {

    if (!n || n < 1) return "N/A";

    if (n % 100 >= 11 && n % 100 <= 13) {
      return `${n}th`;
    }

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

  return `

<div class="report-card ${isCompact ? "compact" : ""} page-break">

  <!-- HEADER -->
  <div class="header-container">

    <div class="logo">
      <img 
        src="${schoolData?.logo_url || 'default-logo.png'}" 
        alt="School Logo"
      >
    </div>

    <div class="header-text">

      <h1 class="school-name">
        ${schoolData?.name || "School Name"}
      </h1>

      <div class="motto">
        MOTTO: ${schoolData?.motto || "N/A"}
      </div>

      <p class="address">
        ${schoolData?.address || "Address not set"}
      </p>

      <p class="address" style="font-weight:bold;">
        TEL: ${schoolData?.phone_numbers || "N/A"}
      </p>

    </div>

    <div class="serial-number">
      SN: ${row.serial_number || "---"}
    </div>

  </div>

  <!-- BANNER -->
  <div class="report-banner">
    CONTINUOUS ASSESSMENT REPORT
  </div>

  <!-- STUDENT INFO -->
  <div class="info-grid">

    <div class="info-item">
      <div class="label">Name</div>
      <div class="value">
        ${row.students?.full_name || "N/A"}
      </div>
    </div>

    <div class="info-item">
      <div class="label">Student ID</div>
      <div class="value">
        ${row.students?.student_id || row.student_id || "N/A"}
      </div>
    </div>

    <div class="info-item">
      <div class="label">Class</div>
      <div class="value">
        ${row.classes?.name || "N/A"}
      </div>
    </div>

    <div class="info-item">
      <div class="label">Gender</div>
      <div class="value">
        ${row.gender || "N/A"}
      </div>
    </div>

    <div class="info-item">
      <div class="label">Term</div>
      <div class="value">
        ${row.term || "N/A"}
      </div>
    </div>

    <div class="info-item">
      <div class="label">Academic Session</div>
      <div class="value">
        ${row.session || "N/A"}
      </div>
    </div>

    <div class="info-item">
      <div class="label">No. In Class</div>
      <div class="value">
        ${classCount || 0}
      </div>
    </div>

    <div class="info-item">
      <div class="label">Position</div>
      <div class="value">
        ${formatPosition(position)}
      </div>
    </div>

  </div>

  <!-- ATTENDANCE + TERM -->
  <div style="display:flex; gap:15px; margin-bottom:15px;">

    <!-- Attendance -->
    <div style="flex:1;">

      <div class="section-title">
        Attendance
      </div>

      <table>

        <thead>
          <tr>
            <th>Days Opened</th>
            <th>Days Present</th>
            <th>Days Absent</th>
          </tr>
        </thead>

        <tbody>

          <tr>
            <td>${daysOpened || 0}</td>
            <td>${daysPresent || 0}</td>
            <td>${daysAbsent || 0}</td>
          </tr>

        </tbody>

      </table>

      <div class="attendance-insight">
        ${attendanceInsight || "No attendance remark"}
      </div>

    </div>

    <!-- Term Duration -->
    <div style="flex:1;">

      <div class="section-title">
        Terminal Duration
      </div>

      <table>

        <thead>
          <tr>
            <th>Term Begins</th>
            <th>Term Ends</th>
            <th>Next Term</th>
          </tr>
        </thead>

        <tbody>

          <tr>
            <td>${termBegins || "N/A"}</td>
            <td>${termEnds || "N/A"}</td>
            <td>${nextTermBegins || "N/A"}</td>
          </tr>

        </tbody>

      </table>

    </div>

  </div>

  <!-- MAIN CONTENT -->
  <div class="columns">

    <!-- LEFT COLUMN -->
    <div class="left-col">

      <div class="section-title">
        Academic Progress Summaries (Cognitive)
      </div>

      <table>

        ${theadHtml}

        <tbody>

          ${rowsHtml}

          ${summaryRowHtml}

        </tbody>

      </table>

      <!-- COMMENTS -->
      <div class="comment-section">

        <div class="comment-box">

          <strong>TEACHER'S COMMENT:</strong>

          <br><br>

          ${teacherComment || "N/A"}

        </div>

        <div class="comment-box">

          <strong>HEADMASTER'S COMMENT:</strong>

          <br><br>

          ${headmasterComment || "N/A"}

        </div>

      </div>

      <!-- SIGNATURE -->
      <div class="signature-area">

        <strong>HEADMASTER'S SIGNATURE:</strong>

        <div style="
          margin-top:10px;
          display:flex;
          flex-direction:column;
          align-items:center;
        ">

          <img
            src="${schoolData?.headmaster_signature_url || 'default-signature.png'}"
            alt="Headmaster Signature"
            style="
              height:50px;
              max-width:150px;
              object-fit:contain;
              display:block;
            "
          >

          <div style="
            border-top:1px solid #000;
            width:200px;
            margin-top:5px;
          "></div>

        </div>

      </div>

    </div>

    <!-- RIGHT COLUMN -->
    <div class="right-col">

      <!-- AFFECTIVE -->
      <div class="section-title">
        Affective Domain
      </div>

      <table>

        <thead>

          <tr>
            <th style="text-align:left;">
              Behaviour
            </th>

            <th>100</th>
            <th>85</th>
            <th>75</th>
            <th>65</th>
            <th>55</th>
          </tr>

        </thead>

        <tbody>

          ${
            affectiveHtml ||
            `
              <tr>
                <td colspan="6">
                  No data
                </td>
              </tr>
            `
          }

        </tbody>

      </table>

      <!-- PSYCHOMOTOR -->
      <div class="section-title">
        Psychomotor Domain
      </div>

      <table>

        <thead>

          <tr>

            <th style="text-align:left;">
              Activities
            </th>

            <th>100</th>
            <th>85</th>
            <th>75</th>
            <th>65</th>
            <th>55</th>

          </tr>

        </thead>

        <tbody>

          ${
            psychomotorHtml ||
            `
              <tr>
                <td colspan="6">
                  No data
                </td>
              </tr>
            `
          }

        </tbody>

      </table>

    </div>

  </div>

</div>

`;
}

// DELETE SELECTED
async function deleteSelectedStudents() {

  if (!selectedResults.size) {
    return alert("No results selected");
  }

  const confirmed =
    confirm("Delete selected results?");

  if (!confirmed) return;

  try {

    for (const [, item] of selectedResults) {

      await supabaseClient
        .from("results")
        .delete()
        .match({
          student_id: item.student_id,
          class_id: item.class_id,
          term: item.term,
          session: item.session
        });
    }

    deselectAllStudents();

    await renderManageResults();

    alert("Selected results deleted");

  } catch (err) {

    console.error(err);

    alert("Delete failed");
  }
}


//==============================
// INIT RESULT CLASSES
//===============================
document.addEventListener("DOMContentLoaded", async () => {

  const classes = await loadClasses();

  populateClassDropdown({
    classes,
    dropdownId: "manageResultClassDropdown",
    selectId: "manageResultClass",
    textId: "manageResultClassSelectedText",
    placeholder: "--Select Class--",
    resetOption: true,
    stateKey: "manageResultClassId",

    onChange: async (cls) => {

      const classId = cls?.id || null;

      // RESET MULTI-SELECTION STATE
      selectedStudents.clear();
      selectedResults.clear();
      selectionMode = false;

      // RESET UI CHECKBOXES
      document
        .querySelectorAll(".result-checkbox")
        .forEach(cb => cb.checked = false);

      // RESET CARD VISUAL STATE
      document
        .querySelectorAll(".data-card")
        .forEach(card => {

          card.classList.remove(
            "ring-2",
            "ring-blue-500",
            "bg-blue-50",
            "selected"
          );

          const button =
            card.querySelector(".select-result-btn");

          if (button) {

            button.textContent = "Select";

            button.classList.remove(
              "bg-blue-600",
              "text-white"
            );

            button.classList.add(
              "bg-gray-100",
              "text-gray-700"
            );
          }
        });

      updateBulkBar();

      selected.manageResultClassId = classId;
      selected.manageResultStudentId = null;

      if (!classId) {
        renderManageResults();
        return;
      }

      const students =
        await loadStudentsByClass(classId);

      populateStudentDropdown({
        students,
        selectId: "manageStudent",
        dropdownId: "manageStudentDropdown",
        textId: "manageStudentText",
        placeholder: "Select student",
        stateKey: "manageResultStudentId"
      });

      renderManageResults();
    }
  });

  const manageClassSelect =
    document.getElementById("manageResultClass");

  manageClassSelect?.addEventListener("change", async (e) => {

    const classId = e.target.value;

    // RESET MULTI-SELECTION STATE
    selectedStudents.clear();
    selectedResults.clear();
    selectionMode = false;

    // RESET UI CHECKBOXES
    document
      .querySelectorAll(".result-checkbox")
      .forEach(cb => cb.checked = false);

    // RESET CARD VISUAL STATE
    document
      .querySelectorAll(".data-card")
      .forEach(card => {

        card.classList.remove(
          "ring-2",
          "ring-blue-500",
          "bg-blue-50",
          "selected"
        );

        const button =
          card.querySelector(".select-result-btn");

        if (button) {

          button.textContent = "Select";

          button.classList.remove(
            "bg-blue-600",
            "text-white"
          );

          button.classList.add(
            "bg-gray-100",
            "text-gray-700"
          );
        }
      });

    updateBulkBar();

    selected.manageResultClassId = classId || null;
    selected.manageResultStudentId = null;

    if (!classId) {
      renderManageResults();
      return;
    }

    const students =
      await loadStudentsByClass(classId);

    populateStudentDropdown({
      students,
      selectId: "manageStudent",
      dropdownId: "manageStudentDropdown",
      textId: "manageStudentText",
      placeholder: "Select student",
      stateKey: "manageResultStudentId"
    });

    renderManageResults();
  });

});