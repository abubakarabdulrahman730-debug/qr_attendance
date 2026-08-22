import React, {
    useEffect,
    useRef,
    useState
} from "react";

import {
    ref,
    set,
    get,
    onValue
} from "firebase/database";

import { db } from "../firebase.js";

import QRCode from "qrcode";

import { Html5Qrcode } from "html5-qrcode";


const GEOFENCE_RADIUS_M = 200;


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

    const toRad = (degrees) =>
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
// CSV ESCAPE
// =====================================================

function escapeCSV(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
}


// =====================================================
// APP
// =====================================================

function App() {

    // =================================================
    // STATE
    // =================================================

    const [mode, setMode] =
        useState("teacher");

    const [sessionName, setSessionName] =
        useState("");

    const [sessionDate, setSessionDate] =
        useState(
            new Date()
                .toISOString()
                .split("T")[0]
        );

    const [currentSession, setCurrentSession] =
        useState(null);

    const [attendance, setAttendance] =
        useState([]);

    const [studentName, setStudentName] =
        useState("");

    const [studentId, setStudentId] =
        useState("");

    const [sessionCode, setSessionCode] =
        useState("");

    const [locationStatus, setLocationStatus] =
        useState("");

    const [locationState, setLocationState] =
        useState("");

    const [success, setSuccess] =
        useState(false);

    const [qrVisible, setQrVisible] =
        useState(false);

    const [qrImage, setQrImage] =
        useState("");

    const [attendanceVisible, setAttendanceVisible] =
        useState(false);

    const [currentTime, setCurrentTime] =
        useState(
            new Date().toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            )
        );

    const scannerRef =
        useRef(null);

    const unsubscribeRef =
        useRef(null);


    // =================================================
    // CLOCK
    // =================================================

    useEffect(() => {

        const timer =
            setInterval(() => {

                setCurrentTime(
                    new Date().toLocaleTimeString(
                        [],
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    )
                );

            }, 1000);

        return () => {
            clearInterval(timer);
        };

    }, []);


    // =================================================
    // CLEANUP
    // =================================================

    useEffect(() => {

        return () => {

            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }

            if (scannerRef.current) {

                scannerRef.current
                    .stop()
                    .catch(() => {});

                scannerRef.current = null;
            }

        };

    }, []);
 // =================================================
    // SWITCH MODE
    // =================================================

    function switchMode(newMode) {

        setMode(newMode);

    }

    // =====================================================
// GENERATE SESSION
// =====================================================

async function generateSession() {

    console.log("Generate session button clicked");

    if (!sessionName.trim()) {
        alert("Please enter a session name.");
        return;
    }

    if (!sessionDate) {
        alert("Please select a date.");
        return;
    }

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        return;
    }

    try {

        console.log("Requesting teacher location...");

        const position = await new Promise(
            (resolve, reject) => {

                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );

            }
        );

        const newSessionCode =
            "ATT-" +
            Math.random()
                .toString(36)
                .substring(2, 6)
                .toUpperCase();

        console.log(
            "Creating session:",
            newSessionCode
        );

        const sessionData = {

            code: newSessionCode,

            name: sessionName.trim(),

            date: sessionDate,

            lat: position.coords.latitude,

            lon: position.coords.longitude,

            active: true,

            createdAt:
                new Date().toISOString()

        };

        const sessionRef = ref(
            db,
            `sessions/${newSessionCode}`
        );

        await set(
            sessionRef,
            sessionData
        );

        console.log(
            "Session saved to Firebase."
        );

        console.log(
            "Generating QR code..."
        );

        const generatedQR =
            await QRCode.toDataURL(
                newSessionCode,
                {
                    width: 300,
                    margin: 2,
                    errorCorrectionLevel: "H"
                }
            );

        console.log(
            "QR code generated."
        );

        setCurrentSession(
            sessionData
        );

        setQrImage(
            generatedQR
        );

        setQrVisible(
            true
        );

        setAttendanceVisible(
            true
        );

        setAttendance(
            []
        );

        listenForAttendance(
            newSessionCode
        );

        console.log(
            "Session setup completed successfully."
        );

        alert(
            `Session created successfully!\n\nSession Code: ${newSessionCode}`
        );

    } catch (error) {

        console.error(
            "Session creation error:",
            error
        );

        if (error?.code === 1) {

            alert(
                "Location permission was denied. Please allow location access and try again."
            );

        } else {

            alert(
                "Could not create the session.\n\n" +
                (error?.message ||
                    "Unknown error")
            );

        }

    }

}

    // =================================================
    // LISTEN FOR ATTENDANCE
    // =================================================

    function listenForAttendance(code) {

        if (unsubscribeRef.current) {

            unsubscribeRef.current();

            unsubscribeRef.current =
                null;
        }


        const attendanceRef =
            ref(
                db,
                `attendance/${code}`
            );


        unsubscribeRef.current =
            onValue(

                attendanceRef,

                (snapshot) => {

                    const data =
                        snapshot.val();


                    if (!data) {

                        setAttendance([]);

                        return;
                    }


                    const records =
                        Object.entries(data)
                            .map(
                                ([key, value]) => ({
                                    databaseId:
                                        key,
                                    ...value
                                })
                            );


                    setAttendance(
                        records
                    );

                },


                (error) => {

                    console.error(
                        "Attendance listener error:",
                        error
                    );

                }

            );

    }


    // =================================================
    // SUBMIT ATTENDANCE
    // =================================================

    async function submitManual() {

        const name =
            studentName.trim();

        const id =
            studentId.trim();
             const code =
            sessionCode
                .trim()
                .toUpperCase();


        if (
            !name ||
            !id ||
            !code
        ) {

            alert(
                "Please fill in all fields."
            );

            return;
        }


        try {

            // -----------------------------------------
            // FIND SESSION
            // -----------------------------------------

            const sessionRef =
                ref(
                    db,
                    `sessions/${code}`
                );


            const sessionSnapshot =
                await get(
                    sessionRef
                );


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


            // -----------------------------------------
            // CHECK ACTIVE
            // -----------------------------------------

            if (
                session.active !== true
            ) {

                alert(
                    "This session is no longer active."
                );

                return;
            }


            setLocationState("");

            setLocationStatus(
                "📍 Verifying location..."
            );


            if (
                !navigator.geolocation
            ) {

                alert(
                    "Geolocation is not supported."
                );

                return;
            }


            // -----------------------------------------
            // GET STUDENT LOCATION
            // -----------------------------------------

            navigator.geolocation.getCurrentPosition(

                async (position) => {

                    try {

                        // ---------------------------------
                        // CALCULATE DISTANCE
                        // ---------------------------------

                        const distance =
                            haversineDistance(
                                session.lat,
                                session.lon,
                                position.coords.latitude,
                                position.coords.longitude
                            );


                        // ---------------------------------
                        // GEOFENCE CHECK
                        // ---------------------------------

                        if (
                            distance >
                            GEOFENCE_RADIUS_M
                        ) {

                            setLocationState(
                                "fail"
                            );


                            setLocationStatus(
                                `❌ Too far: ${distance.toFixed(
                                    0
                                )}m (Max ${GEOFENCE_RADIUS_M}m)`
                            );


                            return;
                        }


                        // ---------------------------------
                        // LOCATION VERIFIED
                        // ---------------------------------

                        setLocationState(
                            "ok"
                        );


                        setLocationStatus(
                            `✅ Verified: ${distance.toFixed(
                                0
                            )}m away`
                        );


                        // ---------------------------------
                        // CHECK DUPLICATE
                        // ---------------------------------

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


                        // ---------------------------------
                        // ATTENDANCE RECORD
                        // ---------------------------------

                        const record = {

                            name,

                            studentId:
                                id,

                            sessionCode:
                                code,

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
                                Math.round(
                                    distance
                                )

                        };


                        // ---------------------------------
                        // SAVE ATTENDANCE
                        // ---------------------------------

                        await set(
                            studentRef,
                            record
                        );


                        // ---------------------------------
                        // SUCCESS
                        // ---------------------------------

                        setSuccess(
                            true
                        );


                        setTimeout(() => {

                            setSuccess(
                                false
                            );

                        }, 3000);


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


                // -----------------------------------------
                // LOCATION ERROR
                // -----------------------------------------

                (error) => {

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

    }


    // =====================================================
// QR SCANNER
// =====================================================

async function startScanner() {

    const reader =
        document.getElementById("reader");

    if (!reader) {
        alert(
            "QR scanner area was not found."
        );
        return;
    }

    // Clear previous scanner
    reader.innerHTML = "";

    // Stop previous scanner if one exists
    if (scannerRef.current) {
         try {
            await scannerRef.current.stop();
        } catch {
            // Scanner already stopped
        }

        scannerRef.current = null;
    }

    // Create new scanner
    const scanner =
        new Html5Qrcode("reader");

    scannerRef.current =
        scanner;

    try {

        await scanner.start(

            {
                facingMode: "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                }
            },

            async (decodedText) => {

                console.log(
                    "QR scanned:",
                    decodedText
                );

                const scannedCode =
                    decodedText
                        .trim()
                        .toUpperCase();

                // Put scanned session code
                // into the input field
                setSessionCode(
                    scannedCode
                );

                // Stop camera
                try {

                    await scanner.stop();

                } catch {
                    // Ignore stop error
                }

                scannerRef.current =
                    null;

                reader.innerHTML =
                    "";

                alert(
                    "QR code scanned successfully!\n\nTap Submit Attendance."
                );
            },

            () => {
                // Ignore continuous
                // scanner errors
            }

        );

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );

        scannerRef.current =
            null;

        alert(
            "Unable to access camera. Please allow camera permission."
        );
    }
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {

    if (attendance.length === 0) {

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
        attendance.map((student) => [

            student.name || "",

            student.studentId || "",

            student.sessionCode || "",

            student.time || "",

            student.lat || "",

            student.lon || "",

            student.distance || ""

        ]);

    const csvContent =
        [
            headers,
            ...rows
        ]
            .map((row) =>
                row
                    .map(escapeCSV)
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
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        `attendance_${Date.now()}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}
// =====================================================
// MAIN UI
// =====================================================

return (
    <div className="container">

        <h1>
            📋 QR Attendance System
        </h1>

        {/* =====================================================
            MODE SWITCH
        ===================================================== */}

        <div className="mode-switch">

            <button
                className={
                     mode === "teacher"
                        ? "btn btn-primary"
                        : "btn btn-secondary"
                }
                onClick={() =>
                    switchMode("teacher")
                }
            >
                Teacher View
            </button>

            <button
                className={
                    mode === "student"
                        ? "btn btn-primary"
                        : "btn btn-secondary"
                }
                onClick={() =>
                    switchMode("student")
                }
            >
                Student View
            </button>

        </div>


        {/* =====================================================
            TEACHER VIEW
        ===================================================== */}

        {mode === "teacher" && (

            <div id="teacherView">

                {/* CREATE SESSION */}

                <div className="card">

                    <h2>
                        Create Session
                    </h2>

                    <div className="form-group">

                        <label>
                            Session Name
                        </label>

                        <input
                            type="text"
                            value={sessionName}
                            onChange={(e) =>
                                setSessionName(
                                    e.target.value
                                )
                            }
                            placeholder="e.g. CSC400 - Week 3"
                        />

                    </div>


                    <div className="form-group">

                        <label>
                            Date
                        </label>

                        <input
                            type="date"
                            value={sessionDate}
                            onChange={(e) =>
                                setSessionDate(
                                    e.target.value
                                )
                            }
                        />

                    </div>


                    <button
                        className="btn btn-primary"
                        onClick={generateSession}
                        style={{
                            width: "100%"
                        }}
                    >
                        Generate QR & Session
                    </button>

                </div>


                {/* =================================================
                    QR CODE
                ================================================= */}

                {qrVisible &&
                    currentSession && (

                    <div className="card">

                        <h2>
                            Session QR Code
                        </h2>


                        <div className="session-info">

                            <p>

                                <strong>
                                    Session:
                                </strong>{" "}

                                {currentSession.name}

                            </p>


                            <p>

                                <strong>
                                    Code:
                                </strong>{" "}

                                {currentSession.code}

                            </p>

                        </div>


                        {/* QR IMAGE */}

                        <div
                            id="qrcode"
                            style={{
                                display: "flex",
                                justifyContent:
                                 "center",
                                alignItems:
                                    "center",
                                minHeight:
                                    "320px",
                                width: "100%",
                                background:
                                    "#ffffff",
                                padding:
                                    "10px",
                                boxSizing:
                                    "border-box"
                            }}
                        >

                            {qrImage ? (

                                <img
                                    src={qrImage}
                                    alt="Session QR Code"
                                    style={{
                                        display:
                                            "block",
                                        width:
                                            "300px",
                                        height:
                                            "300px",
                                        maxWidth:
                                            "100%",
                                        objectFit:
                                            "contain"
                                    }}
                                />

                            ) : (

                                <p>
                                    Generating QR code...
                                </p>

                            )}

                        </div>


                        <p
                            style={{
                                textAlign:
                                    "center",
                                color:
                                    "#666",
                                marginTop:
                                    "10px"
                            }}
                        >
                            Students can scan
                            this QR code or
                            enter the session
                            code manually.
                        </p>

                    </div>

                )}


                {/* =================================================
                    LIVE ATTENDANCE
                ================================================= */}

                {attendanceVisible && (

                    <div
                        className="card"
                        id="attendanceSection"
                    >

                        <h2>
                            Live Attendance
                        </h2>


                        <div className="stats">

                            <div className="stat-card">

                                <div
                                    className="stat-number"
                                >
                                    {
                                        attendance.length
                                    }
                                </div>

                                <div
                                    className="stat-label"
                                >
                                    Students Present
                                </div>

                            </div>


                            <div className="stat-card">

                                <div
                                    className="stat-number"
                                >
                                    {currentTime}
                                </div>

                                <div
                                    className="stat-label"
                                >
                                    Current Time
                                </div>

                            </div>

                        </div>


                        <div
                            className="attendance-list"
                        >
                         {attendance.length === 0 ? (

                                <p
                                    style={{
                                        textAlign:
                                            "center",
                                        color:
                                            "#999",
                                        padding:
                                            "20px"
                                    }}
                                >
                                    No one here yet
                                </p>

                            ) : (

                                attendance.map(
                                    (student) => (

                                    <div
                                        className="attendee"
                                        key={
                                            student.databaseId
                                        }
                                        style={{
                                            borderBottom:
                                                "1px solid #eee",
                                            padding:
                                                "10px",
                                            display:
                                                "flex",
                                            justifyContent:
                                                "space-between"
                                        }}
                                    >

                                        <div>

                                            <strong>
                                                {
                                                    student.name ||
                                                    ""
                                                }
                                            </strong>

                                            <br />

                                            <small>
                                                {
                                                    student.studentId ||
                                                    ""
                                                }
                                            </small>

                                        </div>


                                        <div
                                            style={{
                                                color:
                                                    "#666",
                                                fontSize:
                                                    "0.8rem"
                                            }}
                                        >
                                            {
                                                student.time ||
                                                ""
                                            }
                                        </div>

                                    </div>

                                ))

                            )}

                        </div>


                        <button
                            className="btn export-btn"
                            onClick={exportCSV}
                            style={{
                                width: "100%"
                            }}
                        >
                            Export Attendance (CSV)
                        </button>

                    </div>

                )}

            </div>

        )}
        {/* =====================================================
            STUDENT VIEW
        ===================================================== */}

        {mode === "student" && (

            <div id="studentView">

                <div className="card">

                    <h2>
                        Mark Attendance
                    </h2>
                     <p
                        style={{
                            textAlign: "center",
                            color: "#888",
                            fontSize: "0.9rem",
                            marginBottom: "20px"
                        }}
                    >
                        📍 You must be within
                        200 meters to participate.
                    </p>


                    {/* STUDENT NAME */}

                    <div className="form-group">

                        <label>
                            Your Name
                        </label>

                        <input
                            type="text"
                            value={studentName}
                            onChange={(e) =>
                                setStudentName(
                                    e.target.value
                                )
                            }
                            placeholder="Enter full name"
                        />

                    </div>


                    {/* STUDENT ID */}

                    <div className="form-group">

                        <label>
                            Student ID
                        </label>

                        <input
                            type="text"
                            value={studentId}
                            onChange={(e) =>
                                setStudentId(
                                    e.target.value
                                )
                            }
                            placeholder="Enter ID number"
                        />

                    </div>


                    {/* SESSION CODE */}

                    <div className="form-group">

                        <label>
                            Session Code
                        </label>

                        <input
                            type="text"
                            value={sessionCode}
                            onChange={(e) =>
                                setSessionCode(
                                    e.target.value
                                        .toUpperCase()
                                )
                            }
                            placeholder="Enter code from teacher"
                        />

                    </div>


                    {/* QR SCANNER BUTTON */}

                    <button
                        className="btn btn-secondary"
                        onClick={startScanner}
                        style={{
                            width: "100%",
                            marginBottom: "10px"
                        }}
                    >
                        📷 Scan QR Code
                    </button>


                    {/* QR SCANNER AREA */}

                    <div
                        id="reader"
                        style={{
                            width: "100%",
                            marginBottom: "15px"
                        }}
                    />


                    {/* SUBMIT */}

                    <button
                        className="btn btn-primary"
                        onClick={submitManual}
                        style={{
                            width: "100%"
                        }}
                    >
                        Submit Attendance
                    </button>


                    {/* LOCATION STATUS */}

                    {locationStatus && (

                        <div
                            className={
                                `location-status ${
                                    locationState
                                }`
                            }
                        >
                            {locationStatus}
                        </div>

                    )}


                    {/* SUCCESS MESSAGE */}

                    {success && (
                     <div
                            className="success-message"
                        >
                            ✅ Attendance recorded
                            successfully!
                        </div>

                    )}

                </div>

            </div>

        )}

    </div>
);
}
export default App;