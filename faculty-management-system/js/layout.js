/* =========================================================
   MAESTRO SPACE - SHARED LAYOUT
   Keeps sidebar/topbar consistent across every page.
   ========================================================= */

const LAYOUT_PAGES = {
    dashboard: {
        title: "Dashboard",
        subtitle: "Your faculty workspace at a glance"
    },
    timetable: {
        title: "Timetable",
        subtitle: "Manage your weekly teaching schedule"
    },
    notes: {
        title: "Notes",
        subtitle: "Manage your personal and academic notes"
    },
    subjects: {
        title: "Subjects Handled",
        subtitle: "Manage your teaching subjects"
    },
    certificates: {
        title: "Certificates",
        subtitle: "Manage your certificates and achievements"
    },
    "pending-works": {
        title: "Pending Works",
        subtitle: "Track and manage your pending tasks"
    },
    documents: {
        title: "Documents",
        subtitle: "Manage your important documents"
    },
    profile: {
        title: "Profile",
        subtitle: "Manage your faculty profile"
    }
};

const PROFILE_PICTURE_FILE_ID_KEY = "profilePictureFileId";
const PROFILE_PICTURE_MIGRATION_KEY = "profilePictureMigrationVersion";
const PROFILE_PICTURE_MIGRATION_VERSION = 1;

function getCurrentPage() {
    const file = window.location.pathname.split("/").pop().toLowerCase();

    if (!file || file === "index.html") return "login";
    if (file === "dashboard.html") return "dashboard";
    if (file === "timetable.html") return "timetable";
    if (file === "notes.html") return "notes";
    if (file === "subjects.html") return "subjects";
    if (file === "certificates.html") return "certificates";
    if (file === "pending-works.html") return "pending-works";
    if (file === "documents.html") return "documents";
    if (file === "profile.html") return "profile";

    return "";
}

function loadSharedLayout() {
    const sidebarContainer = document.getElementById("sidebar-container");
    const topbarContainer = document.getElementById("topbar-container");

    if (!sidebarContainer || !topbarContainer) return;

    Promise.all([
        fetch("components/sidebar.html").then(response => response.text()),
        fetch("components/topbar.html").then(response => response.text())
    ])
    .then(async ([sidebar, topbar]) => {
        sidebarContainer.innerHTML = sidebar;
        topbarContainer.innerHTML = topbar;

        const currentPage = getCurrentPage();

        document.querySelectorAll(".sidebar .nav-item[data-page]").forEach(item => {
            item.classList.toggle(
                "active",
                item.dataset.page === currentPage
            );
        });

        const pageInfo = LAYOUT_PAGES[currentPage];

        if (pageInfo) {
            const title = document.querySelector("[data-layout-title]");
            const subtitle = document.querySelector("[data-layout-subtitle]");

            if (title) title.textContent = pageInfo.title;
            if (subtitle) subtitle.textContent = pageInfo.subtitle;
        }

        applySavedTheme();
        await loadFacultyIdentity();
    })
    .catch(error => {
        console.error("Unable to load shared Maestro Space layout:", error);
    });
}

let profilePictureMigrationPromise = null;

function ensureFacultyStorageLoaded() {
    if (typeof FacultyStorage !== "undefined") {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "js/storage.js";
        script.onload = resolve;
        script.onerror = () => reject(
            new Error("Unable to load IndexedDB storage support.")
        );
        document.head.appendChild(script);
    });
}

function migrateLegacyProfilePicture() {
    if (!profilePictureMigrationPromise) {
        profilePictureMigrationPromise = migrateLegacyProfilePictureOnce()
            .finally(() => {
                profilePictureMigrationPromise = null;
            });
    }

    return profilePictureMigrationPromise;
}

async function migrateLegacyProfilePictureOnce() {
    await ensureFacultyStorageLoaded();

    const pointer = await FacultyStorage.getMetadata(
        PROFILE_PICTURE_FILE_ID_KEY
    );
    const marker = await FacultyStorage.getMetadata(
        PROFILE_PICTURE_MIGRATION_KEY
    );

    if (pointer && pointer.value) {
        const existingFile = await FacultyStorage.getFile(pointer.value);
        if (existingFile && existingFile.blob instanceof Blob) {
            if (!marker || marker.value < PROFILE_PICTURE_MIGRATION_VERSION) {
                await FacultyStorage.saveMetadata(
                    PROFILE_PICTURE_MIGRATION_KEY,
                    PROFILE_PICTURE_MIGRATION_VERSION
                );
            }
            return existingFile;
        }

        await FacultyStorage.deleteMetadata(PROFILE_PICTURE_FILE_ID_KEY);
    }

    const legacyPicture = localStorage.getItem("facultyProfilePicture");
    if (!legacyPicture) {
        if (!marker || marker.value < PROFILE_PICTURE_MIGRATION_VERSION) {
            await FacultyStorage.saveMetadata(
                PROFILE_PICTURE_MIGRATION_KEY,
                PROFILE_PICTURE_MIGRATION_VERSION
            );
        }
        return null;
    }

    const response = await fetch(legacyPicture);
    const blob = await response.blob();
    if (!blob.size || !blob.type.startsWith("image/")) {
        throw new TypeError("The saved profile picture is not a valid image.");
    }

    const fileId = await FacultyStorage.saveFile({
        blob,
        name: "profile-picture",
        type: blob.type,
        createdAt: new Date().toISOString()
    });

    try {
        await FacultyStorage.saveMetadata(
            PROFILE_PICTURE_FILE_ID_KEY,
            fileId
        );
    } catch (error) {
        await FacultyStorage.deleteFile(fileId);
        throw error;
    }

    await FacultyStorage.saveMetadata(
        PROFILE_PICTURE_MIGRATION_KEY,
        PROFILE_PICTURE_MIGRATION_VERSION
    );

    return { id: fileId, blob };
}

async function loadFacultyIdentity() {
    const name = localStorage.getItem("facultyName") || "Faculty";

    const nameElements = document.querySelectorAll(
        "#facultyNameDisplay, #facultyName"
    );

    nameElements.forEach(element => {
        element.textContent = name;
    });

    const avatar = document.getElementById("topProfileAvatar");

    if (!avatar) {
        return;
    }

    try {
        const profilePicture = await migrateLegacyProfilePicture();
        if (!profilePicture || !profilePicture.blob) {
            return;
        }

        const image = document.createElement("img");
        image.src = URL.createObjectURL(profilePicture.blob);
        image.alt = "Profile";
        avatar.replaceChildren(image);
    } catch (error) {
        console.error("Unable to load the profile picture from IndexedDB.", error);
    }
}

function applySavedTheme() {
    const theme = localStorage.getItem("facultyTheme") || "lavender";
    document.documentElement.setAttribute("data-theme", theme);
}

function toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
        sidebar.classList.toggle("show");
    }
}

function enablePageTransitions() {
    document.body.classList.add("page-ready");

    document.addEventListener("click", function (event) {
        const link = event.target.closest("a[href]");

        if (!link || link.target === "_blank" || link.hasAttribute("download")) {
            return;
        }

        const destination = new URL(link.href, window.location.href);

        if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) {
            return;
        }

        event.preventDefault();
        document.body.classList.add("page-leaving");

        window.setTimeout(function () {
            window.location.href = link.href;
        }, 180);
    });
}

document.addEventListener("DOMContentLoaded", function () {
    loadSharedLayout();
    enablePageTransitions();
});
