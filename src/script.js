import { db } from "../firebase.js";

import {
    ref,
    set,
    get,
    onValue
} from "firebase/database";


// =====================================================
// GLOBAL VARIABLES
// =====================================================

let currentSession = null;
let attendance = [];
let scanner = null;
let unsubscribeAttendance = null;

const GEOFENCE_RADIUS_M = 200;


// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    const sessionDate =
        document.getElementById("sessionDate");

    if (sessionDate) {
        sessionDate.valueAsDate = new Date();
    }

    updateClock();

    console.log(
        "QR Attendance System initialized."
    );

});


// =====================================================
// SWITCH BETWEEN TEACHER / STUDENT
// =====================================================

window.switchMode = function (mode) {

    const teacherView =
        document.getElementById("teacherView");

    const studentView =
        document.getElementById("studentView");

    const teacherBtn =
        document.getElementById("teacherBtn");

    const studentBtn =
        document.getElementById("studentBtn");


    teacherView.classList.toggle(
        "hidden",
        mode !== "teacher"
    );

    studentView.classList.toggle(
        "hidden",
        mode !== "student"
    );


    teacherBtn.className =
        mode === "teacher"
            ? "btn btn-primary"
            : "btn btn-secondary";


    studentBtn.className =
        mode === "student"
            ? "btn btn-primary"
            : "btn btn-secondary";

};


// =====================================================
// HAVERSINE DISTANCE
// =====================================================

function haversineDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const toRad = degrees =>
        degrees * Math.PI / 180;


    const dLat =
        toRad(lat2 - lat1);

    const dLon =
        toRad(lon2 - lon1);


    const a =
        Math.sin(dLat / 2) ** 2 +

        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *

        Math.sin(dLon / 2) ** 2;


    return (
        R *
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        )
    );

}


// =====================================================
// GENERATE SESSION
// =====================================================

window.generateSession = function () {

    const name =
        document
            .getElementById("sessionName")
            .value
            .trim();


    const date =
        document
            .getElementById("sessionDate")
            .value;


    if (!name || !date) {

        alert(
            "Please fill in session details."
        );

        return;
    }


    if (!navigator.geolocation) {

        alert(
            "Geolocation is not supported by this browser."
        );

        return;
    }


    navigator.geolocation.getCurrentPosition(

        async position => {

            try {

                // =========================================
                // GENERATE SESSION CODE
                // =========================================

                const sessionCode =
                    "ATT-" +
                    Math.random()
                        .toString(36)
                        .substring(2, 6)
                        .toUpperCase();


                // =========================================
                // SESSION DATA
                // =========================================

                const sessionData = {

                    code: sessionCode,

                    name: name,

                    date: date,

                    lat:
                        position.coords.latitude,

                    lon:
                        position.coords.longitude,

                    active: true,
                         createdAt:
                        new Date().toISOString()

                };


                // =========================================
                // SAVE TO REALTIME DATABASE
                // =========================================

                const sessionRef =
                    ref(
                        db,
                        `sessions/${sessionCode}`
                    );


                await set(
                    sessionRef,
                    sessionData
                );


                // Store current session
                currentSession =
                    sessionData;


                // =========================================
                // DISPLAY SESSION
                // =========================================

                document
                    .getElementById("sessionInfo")
                    .innerHTML =` 

                        <p>
                            <strong>Session:</strong>
                            ${escapeHTML(name)}
                        </p>

                        <p>
                            <strong>Code:</strong>
                            ${sessionCode}
                        </p>

                    `;


                // =========================================
                // GENERATE QR CODE
                // =========================================

                const qrDiv =
                    document.getElementById(
                        "qrcode"
                    );


                qrDiv.innerHTML = "";


                if (
                    typeof QRCode ===
                    "undefined"
                ) {

                    throw new Error(
                        "QRCode library is not loaded."
                    );

                }


                new QRCode(
                    qrDiv,
                    {
                        text: sessionCode,

                        width: 200,

                        height: 200
                    }
                );


                // =========================================
                // SHOW TEACHER SECTIONS
                // =========================================

                document
                    .getElementById("qrSection")
                    .classList.remove(
                        "hidden"
                    );


                document
                    .getElementById(
                        "attendanceSection"
                    )
                    .classList.remove(
                        "hidden"
                    );


                // Reset local attendance
                attendance = [];


                updateAttendanceList();


                // Start realtime listener
                listenForAttendance(
                    sessionCode
                );


                alert(
                    `Session created successfully!\n\nSession Code: ${sessionCode}`
                );


            } catch (error) {

                console.error(
                    "Session creation error:",
                    error
                );


                alert(
                    "Could not create the session.\n\n" +
                    error.message
                );

            }

        },

        error => {

            console.error(
                "Geolocation error:",
                error
            );


            if (
                error.code ===
                error.PERMISSION_DENIED
            ) {

                alert(
                    "Location permission was denied. Please allow location access."
                );

            } else {

                alert(
                    "Unable to get your location."
                );

            }

        },

        {
            enableHighAccuracy: true,

            timeout: 10000,

            maximumAge: 0

        }

    );

};
// =====================================================
// LISTEN FOR LIVE ATTENDANCE
// =====================================================

function listenForAttendance(
    sessionCode
) {

    // Stop previous listener
    if (
        typeof unsubscribeAttendance ===
        "function"
    ) {

        unsubscribeAttendance();

        unsubscribeAttendance =
            null;

    }


    const attendanceRef =
        ref(
            db,
            `attendance/${sessionCode}`
        );


    unsubscribeAttendance =
        onValue(

            attendanceRef,

            snapshot => {

                const data =
                    snapshot.val();


                attendance = [];


                if (data) {

                    Object.entries(data)
                        .forEach(
                            ([key, value]) => {

                                attendance.push({

                                    databaseId:
                                        key,

                                    ...value

                                });

                            }
                        );

                }


                updateAttendanceList();

            },

            error => {

                console.error(
                    "Attendance listener error:",
                    error
                );

            }

        );

}


// =====================================================
// STUDENT ATTENDANCE SUBMISSION
// =====================================================

window.submitManual = async function () {

    const name =
        document
            .getElementById("studentName")
            .value
            .trim();


    const id =
        document
            .getElementById("studentId")
            .value
            .trim();


    const code =
        document
            .getElementById("sessionCode")
            .value
            .trim()
            .toUpperCase();


    if (!name || !id || !code) {

        alert(
            "Please fill in all fields."
        );

        return;
    }


    try {

        // =========================================
        // FIND SESSION
        // =========================================

        const sessionRef =
            ref(
                db,
                `sessions/${code}`
            );


        const sessionSnapshot =
            await get(sessionRef);


        if (
            !sessionSnapshot.exists()
        ) {

            alert(
                "Invalid Session Code."
            );

            return;
        }


        const session =
            sessionSnapshot.val();


        // =========================================
        // CHECK ACTIVE STATUS
        // =========================================

        if (
            session.active !== true
        ) {

            alert(
                "This session is no longer active."
            );

            return;
        }


        // =========================================
        // LOCATION STATUS
        // =========================================

        const statusEl =
            document.getElementById(
                "locationStatus"
            );


        statusEl.className =
            "location-status";


        statusEl.textContent =
            "📡 Verifying location...";


        statusEl.classList.remove(
            "hidden"
        );


        // =========================================
        // GET STUDENT LOCATION
        // =========================================

        if (!navigator.geolocation) {

            alert(
                "Geolocation is not supported."
            );

            return;
        }


        navigator.geolocation.getCurrentPosition(

            async position => {

                try {

                    const distance =
                        haversineDistance(

                            session.lat,

                            session.lon,

                            position.coords.latitude,
                             position.coords.longitude

                        );


                    // =====================================
                    // GEOFENCE CHECK
                    // =====================================

                    if (
                        distance >
                        GEOFENCE_RADIUS_M
                    ) {

                        statusEl.className =
                            "location-status fail";


                        statusEl.textContent =
                            `❌ Too far: ${distance.toFixed(0)}m (Max ${GEOFENCE_RADIUS_M}m)`;


                        return;
                    }


                    // =====================================
                    // LOCATION VERIFIED
                    // =====================================

                    statusEl.className =
                        "location-status ok";


                    statusEl.textContent =
                        `✅ Verified: ${distance.toFixed(0)}m away`;


                    // =====================================
                    // CHECK DUPLICATE
                    // =====================================

                    const studentRef =
                        ref(
                            db,
                            `attendance/${code}/${id}`
                        );


                    const existing =
                        await get(
                            studentRef
                        );


                    if (
                        existing.exists()
                    ) {

                        alert(
                            "Attendance already marked for this Student ID."
                        );

                        return;
                    }


                    // =====================================
                    // CREATE ATTENDANCE RECORD
                    // =====================================

                    const record = {

                        name: name,

                        studentId: id,

                        sessionCode: code,

                        time:
                            new Date()
                                .toLocaleTimeString(),

                        timestamp:
                            new Date()
                                .toISOString(),

                        lat:
                            position.coords.latitude,

                        lon:
                            position.coords.longitude,

                        distance:
                            Math.round(distance)

                    };


                    // =====================================
                    // SAVE TO REALTIME DATABASE
                    // =====================================

                    await set(
                        studentRef,
                        record
                    );


                    // =====================================
                    // SUCCESS
                    // =====================================

                    showSuccess();


                } catch (error) {

                    console.error(
                        "Attendance save error:",
                        error
                    );


                    alert(
                        "Could not save attendance.\n\n" +
                        error.message
                    );

                }

            },

            error => {

                console.error(
                    "Location error:",
                    error
                );


                alert(
                    "Location access denied or unavailable."
                );

            },

            {
                enableHighAccuracy: true,

                timeout: 10000,

                maximumAge: 0

            }

        );


    } catch (error) {

        console.error(
            "Attendance error:",
            error
        );
         alert(
            "Something went wrong.\n\n" +
            error.message
        );

    }

};


// =====================================================
// QR SCANNER
// =====================================================

window.startScanner = async function () {

    const reader =
        document.getElementById(
            "reader"
        );


    if (!reader) {

        alert(
            "QR scanner area was not found."
        );

        return;
    }


    reader.innerHTML = "";


    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        alert(
            "QR scanner library is not loaded."
        );

        console.error(
            "Html5Qrcode is not defined."
        );

        return;
    }


    // Stop previous scanner
    if (scanner) {

        try {

            await scanner.stop();

        } catch (error) {

            console.log(
                "Previous scanner stopped."
            );

        }

        scanner = null;

    }


    scanner =
        new Html5Qrcode(
            "reader"
        );


    try {

        await scanner.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,

                    height: 250
                }

            },

            async decodedText => {

                const scannedCode =
                    decodedText
                        .trim()
                        .toUpperCase();


                const sessionCode =
                    document.getElementById(
                        "sessionCode"
                    );


                if (sessionCode) {

                    sessionCode.value =
                        scannedCode;

                }


                console.log(
                    "QR code scanned:",
                    scannedCode
                );


                try {

                    await scanner.stop();

                } catch (error) {

                    console.error(
                        "Scanner stop error:",
                        error
                    );

                }


                scanner = null;

                reader.innerHTML = "";


                alert(
                    "QR code scanned successfully!\n\nTap Submit Attendance."
                );

            },

            errorMessage => {

                // Ignore continuous scanner errors.

            }

        );

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        alert(
            "Unable to access camera. Please allow camera permission."
        );

    }

};


// =====================================================
// UPDATE ATTENDANCE LIST
// =====================================================
 function updateAttendanceList() {

    const list =
        document.getElementById(
            "attendanceList"
        );


    const totalCount =
        document.getElementById(
            "totalCount"
        );


    if (totalCount) {

        totalCount.textContent =
            attendance.length;

    }


    if (!list) {
        return;
    }


    if (
        attendance.length ===
        0
    ) {

        list.innerHTML = 

            <p
                style="
                    text-align:center;
                    color:#999;
                    padding:20px;
                "
            >
                No one here yet
            </p>

        ;

        return;
    }


    list.innerHTML =

        attendance
            .map(
                student =>` 

                    <div
                        class="attendee"
                        style="
                            border-bottom:1px solid #eee;
                            padding:10px;
                            display:flex;
                            justify-content:space-between;
                        "
                    >

                        <div>

                            <strong>
                                ${escapeHTML(
                                    student.name || ""
                                )}
                            </strong>

                            <br>

                            <small>
                                ${escapeHTML(
                                    student.studentId || ""
                                )}
                            </small>

                        </div>

                        <div
                            style="
                                color:#666;
                                font-size:0.8rem;
                            "
                        >
                            ${escapeHTML(
                                student.time || ""
                            )}
                        </div>

                    </div>

                `
            )
            .join("");

}


// =====================================================
// EXPORT CSV
// =====================================================

window.exportCSV = function () {

    if (
        attendance.length ===
        0
    ) {

        alert(
            "No attendance data to export."
        );

        return;
    }


    const headers = [

        "Name",

        "Student ID",

        "Session Code",

        "Time",

        "Latitude",

        "Longitude",

        "Distance"

    ];


    const rows =
        attendance.map(
            student => [

                student.name || "",

                student.studentId || "",

                student.sessionCode || "",

                student.time || "",

                student.lat || "",

                student.lon || "",

                student.distance || ""

            ]
        );


    const csvContent =

        [headers, ...rows]

            .map(
                row =>
                    row
                        .map(
                            value =>
                                `"${String(value)
                                    .replaceAll(
                                        '"',
                                        '""'
                                    )}"`
                        )
                        .join(",")
            )

            .join("\n");


    const blob =
        new Blob(
            [csvContent],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href = url;


    link.download =
        `attendance_${Date.now()}.csv`;


    document.body.appendChild(
        link
    );


    link.click();


    document.body.removeChild(
        link
    );


    URL.revokeObjectURL(
        url
    );

};
// =====================================================
// SUCCESS MESSAGE
// =====================================================

function showSuccess() {

    const msg =
        document.getElementById(
            "successMessage"
        );


    if (!msg) {
        return;
    }


    msg.classList.remove(
        "hidden"
    );


    setTimeout(
        () => {

            msg.classList.add(
                "hidden"
            );

        },
        3000
    );

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


// =====================================================
// CLOCK
// =====================================================

function updateClock() {

    const timeDisplay =
        document.getElementById(
            "timeDisplay"
        );


    if (!timeDisplay) {
        return;
    }


    timeDisplay.textContent =
        new Date()
            .toLocaleTimeString(
                [],
                {
                    hour: "2-digit",

                    minute: "2-digit"
                }
            );

}


setInterval(
    updateClock,
    1000
);