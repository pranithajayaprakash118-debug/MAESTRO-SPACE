document.addEventListener("DOMContentLoaded", function () {

    // ================================
    // LOGIN
    // ================================

    const loginForm = document.getElementById("loginForm");

    if (loginForm) {

        loginForm.addEventListener("submit", function (event) {

            event.preventDefault();

            const name = document.getElementById("facultyName").value.trim();
            const email = document.getElementById("facultyEmail").value.trim();

            if (name === "" || email === "") {
                alert("Please enter your name and email.");
                return;
            }

            // Save faculty details
            localStorage.setItem("facultyName", name);
            localStorage.setItem("facultyEmail", email);

            // Open dashboard
            window.location.href = "dashboard.html";

        });

    }


    // ================================
    // DISPLAY FACULTY NAME
    // ================================

    const facultyName = localStorage.getItem("facultyName");

    if (facultyName) {

        const topName = document.getElementById("topFacultyName");
        const displayName = document.getElementById("facultyNameDisplay");
        const welcomeName = document.getElementById("welcomeFacultyName");

        if (topName) {
            topName.textContent = facultyName;
        }

        if (displayName) {
            displayName.textContent = facultyName;
        }

        if (welcomeName) {
            welcomeName.textContent = facultyName;
        }

    }


    // ================================
    // THEME SYSTEM
    // ================================

    const savedTheme =
        localStorage.getItem("facultyTheme") || "lavender";

    applyTheme(savedTheme);


    const themeOptions =
        document.querySelectorAll(".theme-option");


    themeOptions.forEach(function (option) {

        option.addEventListener("click", function () {

            const selectedTheme =
                option.getAttribute("data-theme");

            // Save selected theme
            localStorage.setItem(
                "facultyTheme",
                selectedTheme
            );

            // Apply selected theme
            applyTheme(selectedTheme);

        });

    });


    // ================================
    // APPLY THEME
    // ================================

    function applyTheme(theme) {

        document.documentElement.setAttribute(
            "data-theme",
            theme
        );


        const themeOptions =
            document.querySelectorAll(".theme-option");


        themeOptions.forEach(function (option) {

            option.classList.remove("selected");


            if (
                option.getAttribute("data-theme") === theme
            ) {

                option.classList.add("selected");

            }

        });

    }


    // ================================
    // THEMES NAVIGATION
    // ================================

    const themesNav =
        document.getElementById("themesNav");


    if (themesNav) {

        themesNav.addEventListener("click", function (event) {

            const themesSection =
                document.getElementById("themes");


            if (themesSection) {

                event.preventDefault();


                themesSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }

        });

    }

});


