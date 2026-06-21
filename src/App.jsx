import { useState, useEffect, useRef } from "react";
import {
  House,
  Trophy,
  User,
  Clock3,
  Award,
  CheckCircle2,
  FileText,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Plus,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, storage } from "./firebase";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { seedDatabase } from "./seed";
import confetti from "canvas-confetti";

function getMissionXp(mission) {
  return Number(mission?.xp ?? ((mission?.points || 1) * 10));
}

function getLevelInfo(xp) {
  const levels = [
    { level: 1, title: "Aprendiz IA", xp: 0 },
    { level: 2, title: "Explorador IA", xp: 50 },
    { level: 3, title: "Investigador IA", xp: 100 },
    { level: 4, title: "Constructor IA", xp: 200 },
    { level: 5, title: "Automatizador", xp: 350 },
    { level: 6, title: "Arquitecto IA", xp: 550 },
    { level: 7, title: "Maestro IA", xp: 800 },
    { level: 8, title: "Leyenda IA", xp: 1200 },
  ];

  let current = levels[0];
  let next = null;

  for (let i = 0; i < levels.length; i++) {
    if (xp >= levels[i].xp) {
      current = levels[i];
      next = levels[i + 1] || null;
    }
  }

  return { current, next };
}

export default function App() {
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState([]);

  const [selectedDay, setSelectedDay] = useState(null);
  const [missions, setMissions] = useState([]);
  const [allMissions, setAllMissions] = useState([]);
  const [selectedMission, setSelectedMission] = useState(null);
  const [missionResponse, setMissionResponse] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);

  const [sendingSubmission, setSendingSubmission] = useState(false);
  const [submissionSent, setSubmissionSent] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [approved, setApproved] = useState(null);
  const [completedMissions, setCompletedMissions] = useState([]);
  const [isMissionCompleted, setIsMissionCompleted] = useState(false);
  const [scores, setScores] = useState({
    "Simón": 0,
    "Tomás": 0,
  });
  const [adminPassword, setAdminPassword] = useState("");
  const [newMissionTitle, setNewMissionTitle] = useState("");
  const [newMissionDescription, setNewMissionDescription] = useState("");
  const [newMissionDayId, setNewMissionDayId] = useState("");
  const [newMissionMinutes, setNewMissionMinutes] = useState(15);
  const [newMissionPoints, setNewMissionPoints] = useState(1);
  const [newMissionType, setNewMissionType] = useState("text");
  const [newMissionVideoUrl, setNewMissionVideoUrl] = useState("");
  const [newMissionVideoPercent, setNewMissionVideoPercent] = useState(80);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoSeconds, setVideoSeconds] = useState(0);
  const playerRef = useRef(null);
  const lastSavedSecondRef = useRef(0);
  const [newDayTitle, setNewDayTitle] = useState("");
  const [newDayDescription, setNewDayDescription] = useState("");
  const [editingDayId, setEditingDayId] = useState(null);
  const [editingMissionId, setEditingMissionId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [missionStarted, setMissionStarted] = useState(false);  
  const [sessionId, setSessionId] = useState(null);
  const [submissions, setSubmissions] = useState([]);
const [allSubmissions, setAllSubmissions] = useState([]);
const [submissionSearch, setSubmissionSearch] = useState("");
const [expandedUsers, setExpandedUsers] = useState({});
const [expandedDays, setExpandedDays] = useState({});
const [adminFeedbacks, setAdminFeedbacks] = useState({});
  const launchConfetti = () => {
    const end = Date.now() + 2000;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 70,
        origin: { x: 0 },
      });

      confetti({
        particleCount: 3,
        angle: 120,
        spread: 70,
        origin: { x: 1 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    if (navigator.vibrate) {
      navigator.vibrate(150);
    }
  };

  const resetMissionTimers = async () => {
    const confirmed = window.confirm(
      "¿Reiniciar todos los tiempos de misiones?"
    );

    if (!confirmed) return;

    try {
      const snapshot = await getDocs(
        collection(db, "mission_sessions")
      );

      const updates = snapshot.docs.map((session) =>
        deleteDoc(doc(db, "mission_sessions", session.id))
      );

      await Promise.all(updates);

      alert("Tiempos reiniciados correctamente");
    } catch (error) {
      console.error(error);
      alert("Error reiniciando tiempos");
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser.name);
      setScreen("dashboard");
    }

    loadDays();
    loadAllMissions();
    loadScores();
  }, []);

  useEffect(() => {
    if (screen !== "mission" || !missionStarted) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [screen, missionStarted]);

  useEffect(() => {
    if (
      screen !== "mission" ||
      selectedMission?.type !== "video" ||
      !selectedMission?.videoUrl ||
      !selectedMission.videoUrl.includes("youtube")
    ) {
      return;
    }

    const loadPlayer = () => {
      const container = document.getElementById("youtube-player");

      if (!container || !window.YT?.Player) return;

      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player("youtube-player", {
        videoId:
          selectedMission.videoUrl
            .split("embed/")[1]
            ?.split("?")[0] || "",
        events: {
          onReady: (event) => {

            if (videoSeconds > 0) {
              event.target.seekTo(videoSeconds, true);
            }

            const interval = setInterval(() => {
              try {
                const player = playerRef.current;
                if (!player) return;

                const duration = player.getDuration?.() || 0;
                const current = player.getCurrentTime?.() || 0;
                setVideoSeconds(Math.floor(current));

                if (!duration) return;

                const progress = Math.round(
                  (current / duration) * 100
                );

                setVideoProgress(progress);
                const currentSecond = Math.floor(current);

                if (
                  sessionId &&
                  currentSecond % 5 === 0 &&
                  currentSecond !== lastSavedSecondRef.current
                ) {
                  lastSavedSecondRef.current = currentSecond;

                  setDoc(
                    doc(db, "mission_sessions", sessionId),
                    {
                      videoSeconds: Math.floor(current),
                      videoProgress: progress,
                    },
                    { merge: true }
                  ).catch(console.error);
                }

                if (
                  progress >=
                  (selectedMission?.requiredVideoPercent || 90)
                ) {
                  setVideoCompleted(true);
                  if (sessionId) {
                    setDoc(
                      doc(db, "mission_sessions", sessionId),
                      {
                        videoCompleted: true,
                        videoProgress: progress,
                        videoSeconds: Math.floor(current),
                      },
                      { merge: true }
                    ).catch(console.error);
                  }
                  clearInterval(interval);
                }
              } catch {
                clearInterval(interval);
              }
            }, 1000);
          },
        },
      });
    };

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);

      window.onYouTubeIframeAPIReady = loadPlayer;
    } else {
      loadPlayer();
    }
  }, [screen, selectedMission, sessionId]);
  const loadAllMissions = async () => {
    try {
      const snapshot = await getDocs(
        collection(db, "missions")
      );

      const loadedMissions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAllMissions(loadedMissions);
    } catch (error) {
      console.error("Error cargando todas las misiones:", error);
    }
  };

  useEffect(() => {
  if (!user) return;

  loadCompletedMissions(user);
}, [user]);

const loadUserSubmissions = async (currentUser = user) => {
  try {
    if (!currentUser) return;

    const q = query(
      collection(db, "submissions"),
      where("userName", "==", currentUser)
    );

    const snapshot = await getDocs(q);

    const data = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

    setSubmissions(data);
  } catch (error) {
    console.error("Error cargando entregas:", error);
  }
};

const loadAllSubmissions = async () => {
  try {
    const snapshot = await getDocs(
      collection(db, "submissions")
    );

    const data = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

    setAllSubmissions(data);
  } catch (error) {
    console.error(
      "Error cargando todas las entregas:",
      error
    );
  }
};

const toggleUserSubmissions = (userName) => {
  setExpandedUsers((prev) => ({
    ...prev,
    [userName]: !prev[userName],
  }));
};

const toggleDayExpansion = (dayId) => {
  setExpandedDays((prev) => ({
    ...prev,
    [dayId]: !prev[dayId],
  }));
};

// Normaliza URLs de YouTube a formato embed automáticamente
const normalizeVideoUrl = (url) => {
  if (!url) return "";

  const trimmed = url.trim();

  if (trimmed.includes("youtube.com/embed/")) {
    return trimmed;
  }

  const watchMatch = trimmed.match(
    /youtube\.com\/watch\?v=([^&]+)/
  );

  if (watchMatch?.[1]) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }

  const shortMatch = trimmed.match(
    /youtu\.be\/([^?&]+)/
  );

  if (shortMatch?.[1]) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`;
  }

  return trimmed;
};

  const loadDays = async () => {
    try {
      const q = query(
        collection(db, "days"),
        orderBy("order")
      );

      const snapshot = await getDocs(q);

      const loadedDays = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setDays(loadedDays);
    } catch (error) {
      console.error("Error cargando días:", error);
    }
  };

  const toggleDay = async (dayId, currentValue) => {
    const { doc, updateDoc } = await import("firebase/firestore");

    await updateDoc(
      doc(db, "days", dayId),
      {
        enabled: !currentValue,
      }
    );

    loadDays();
  };

  const saveDay = async () => {
    try {
      if (!newDayTitle.trim()) {
        alert("Ingresa un nombre para el día");
        return;
      }

      if (editingDayId) {
        await updateDoc(doc(db, "days", editingDayId), {
          title: newDayTitle,
          description: newDayDescription,
        });
      } else {
        await addDoc(collection(db, "days"), {
          title: newDayTitle,
          description: newDayDescription,
          enabled: false,
          order: days.length + 1,
        });
      }

      setNewDayTitle("");
      setNewDayDescription("");
      setEditingDayId(null);

      await loadDays();
    } catch (error) {
      console.error(error);
      alert("Error guardando día");
    }
  };

  const editDay = (day) => {
    setEditingDayId(day.id);
    setNewDayTitle(day.title || "");
    setNewDayDescription(day.description || "");
  };

  const removeDay = async (dayId) => {
    const confirmed = window.confirm(
      "¿Eliminar este día?"
    );

    if (!confirmed) return;

    await deleteDoc(doc(db, "days", dayId));
    await loadDays();
  };

  const createMission = async () => {
    try {
      if (!newMissionTitle.trim()) {
        alert("Ingresa un título");
        return;
      }

      if (!newMissionDayId) {
        alert("Selecciona un día");
        return;
      }

      const dayMissionsQuery = query(
        collection(db, "missions"),
        where("dayId", "==", newMissionDayId)
      );

      const snapshot = await getDocs(dayMissionsQuery);

      if (editingMissionId) {
        await updateDoc(
          doc(db, "missions", editingMissionId),
          {
            title: newMissionTitle,
            description: newMissionDescription,
            dayId: newMissionDayId,
            estimatedMinutes: Number(newMissionMinutes),
            xp: Number(newMissionPoints),
            type: newMissionType,
            videoUrl: normalizeVideoUrl(newMissionVideoUrl),
            requiredVideoPercent: Number(newMissionVideoPercent || 80),
          }
        );
      } else {
        await addDoc(collection(db, "missions"), {
          title: newMissionTitle,
          description: newMissionDescription,
          dayId: newMissionDayId,
          estimatedMinutes: Number(newMissionMinutes),
          xp: Number(newMissionPoints),
          type: newMissionType,
          videoUrl: normalizeVideoUrl(newMissionVideoUrl),
          requiredVideoPercent: Number(newMissionVideoPercent || 80),
          order: snapshot.size + 1,
        });
      }

      setNewMissionTitle("");
      setNewMissionDescription("");
      setNewMissionDayId("");
      setNewMissionMinutes(15);
      setNewMissionPoints(1);
      setNewMissionType("text");
      setNewMissionVideoUrl("");
      setNewMissionVideoPercent(80);
      setEditingMissionId(null);

      await loadAllMissions();

      alert("Misión creada correctamente");
    } catch (error) {
      console.error(error);
      alert("Error creando misión");
    }
  };
  const editMission = (mission) => {
    setEditingMissionId(mission.id);
    setNewMissionTitle(mission.title || "");
    setNewMissionDescription(mission.description || "");
    setNewMissionDayId(mission.dayId || "");
    setNewMissionMinutes(mission.estimatedMinutes || 15);
    setNewMissionPoints(mission.xp || mission.points || 10);
    setNewMissionType(mission.type || "text");
    setNewMissionVideoUrl(mission.videoUrl || "");
    setNewMissionVideoPercent(
      mission.requiredVideoPercent || 80
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeMission = async (missionId) => {
    const confirmed = window.confirm(
      "¿Eliminar esta misión?"
    );

    if (!confirmed) return;

    await deleteDoc(doc(db, "missions", missionId));

    await loadAllMissions();
  };

  const moveMissionUp = async (mission) => {
    const dayMissions = allMissions
      .filter((m) => m.dayId === mission.dayId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const index = dayMissions.findIndex((m) => m.id === mission.id);
    if (index <= 0) return;

    const previous = dayMissions[index - 1];

    await updateDoc(doc(db, "missions", mission.id), {
      order: previous.order,
    });

    await updateDoc(doc(db, "missions", previous.id), {
      order: mission.order,
    });

    await loadAllMissions();
  };

  const moveMissionDown = async (mission) => {
    const dayMissions = allMissions
      .filter((m) => m.dayId === mission.dayId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const index = dayMissions.findIndex((m) => m.id === mission.id);
    if (index === -1 || index >= dayMissions.length - 1) return;

    const next = dayMissions[index + 1];

    await updateDoc(doc(db, "missions", mission.id), {
      order: next.order,
    });

    await updateDoc(doc(db, "missions", next.id), {
      order: mission.order,
    });

    await loadAllMissions();
  };

  const resetMissionProgress = async (mission) => {
    const confirmed = window.confirm(
      `¿Reiniciar el progreso de la misión "${mission.title}" para todos los usuarios?`
    );

    if (!confirmed) return;

    try {
      const submissionsSnapshot = await getDocs(
        query(
          collection(db, "submissions"),
          where("missionId", "==", mission.id)
        )
      );

      await Promise.all(
        submissionsSnapshot.docs.map((submission) =>
          deleteDoc(doc(db, "submissions", submission.id))
        )
      );

      const sessionsSnapshot = await getDocs(
        query(
          collection(db, "mission_sessions"),
          where("missionId", "==", mission.id)
        )
      );

      await Promise.all(
        sessionsSnapshot.docs.map((session) =>
          deleteDoc(doc(db, "mission_sessions", session.id))
        )
      );

      await loadScores();
      alert("Progreso reiniciado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error reiniciando progreso");
    }
  };

  const reviewSubmission = async (
    submissionId,
    approved
  ) => {
    try {
      // Find the submission in allSubmissions
      const submission = allSubmissions.find(
        (s) => s.id === submissionId
      );

      await updateDoc(
        doc(db, "submissions", submissionId),
        {
          status: approved
            ? "approved"
            : "rejected",
          feedback:
            adminFeedbacks[submissionId]?.trim() ||
            (approved
              ? "Aprobada manualmente por administrador"
              : "Rechazada manualmente por administrador"),
        }
      );

      // Update mission_sessions if possible
      if (submission?.userName && submission?.missionId) {
        const sessionId = `${submission.userName}_${submission.missionId}`;

        await setDoc(
          doc(db, "mission_sessions", sessionId),
          {
            completed: approved,
            expired: false,
          },
          { merge: true }
        );
      }

      await loadAllSubmissions();
      await loadScores();

      // Reload completed missions for user if possible
      if (submission?.userName) {
        await loadCompletedMissions(submission.userName);
      }
    } catch (error) {
      console.error(error);
      alert("Error actualizando entrega");
    }
  };

  const loadScores = async () => {
    try {
      const snapshot = await getDocs(
        collection(db, "submissions")
      );

      const approvedSubmissions = snapshot.docs
        .map((doc) => doc.data())
        .filter((s) => s.status === "approved");

      const totals = {
        "Simón": 0,
        "Tomás": 0,
      };

      approvedSubmissions.forEach((submission) => {
        if (totals[submission.userName] !== undefined) {
          totals[submission.userName] += Number(
            submission.xp || submission.points || 10
          );
        }
      });

      setScores(totals);
    } catch (error) {
      console.error("Error cargando puntajes:", error);
    }
  };

  const loadCompletedMissions = async (currentUser = user) => {
    try {
      if (!currentUser) return;

      const submissionsQuery = query(
        collection(db, "submissions"),
        where("userName", "==", currentUser)
      );

      const submissionsSnapshot = await getDocs(submissionsQuery);

      const completed = submissionsSnapshot.docs
        .map((doc) => doc.data())
        .filter(
          (s) => s.status === "approved" || s.status === "expired"
        )
        .map((s) => s.missionId);

      setCompletedMissions(completed);
    } catch (error) {
      console.error(
        "Error cargando misiones completadas:",
        error
      );
    }
  };

  const openDay = async (day) => {
    try {
      setSelectedDay(day);
      if (!day.enabled) {
        alert("🔒 Tranquilo, este día aún no ha sido desbloqueado.");
        return;
      }

      const q = query(
        collection(db, "missions"),
        where("dayId", "==", day.id),
        orderBy("order")
      );

      const snapshot = await getDocs(q);

      const loadedMissions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setMissions(loadedMissions);

      await loadCompletedMissions();

      setScreen("day");
    } catch (error) {
      console.error("Error cargando misiones:", error);
    }
  };

  const openMission = async (mission) => {
    setSelectedMission(mission);
    const missionSessionId = `${user}_${mission.id}`;
    setSessionId(missionSessionId);

    const previousSubmission = submissions.find(
      (s) => s.missionId === mission.id && s.status === "approved"
    );

    setMissionResponse(
      previousSubmission?.responseText || ""
    );

    setAttachedFile(
      previousSubmission?.fileUrl
        ? {
            name: previousSubmission.fileName,
            url: previousSubmission.fileUrl,
          }
        : null
    );

    setSubmissionSent(false);
    setFeedback("");
    setApproved(null);

    setIsMissionCompleted(
      completedMissions.includes(mission.id)
    );

    setVideoProgress(0);

    setVideoSeconds(0);

    try {
      const sessionRef = doc(
        db,
        "mission_sessions",
        missionSessionId
      );

      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const data = sessionSnap.data();

        if (data.videoSeconds) {
          setVideoSeconds(data.videoSeconds);
        }

        if (data.videoCompleted) {
          setVideoCompleted(true);
        }
      }

      // 5) After obtaining sessionSnap.data() and before calculating remainingSeconds, add:
      if (sessionSnap.exists() && sessionSnap.data().expired) {
        setTimeLeft(0);
      }

      if (
        sessionSnap.exists() &&
        sessionSnap.data().startedAt
      ) {
        if (sessionSnap.data().expired) {
          setTimeLeft(0);
          setMissionStarted(true);
        } else {
          const startedAt =
            sessionSnap.data().startedAt.toDate();

          const elapsedSeconds = Math.floor(
            (Date.now() - startedAt.getTime()) / 1000
          );

          const remainingSeconds = Math.max(
            0,
            (mission.estimatedMinutes || 0) * 60 -
              elapsedSeconds
          );

          setTimeLeft(remainingSeconds);
          setMissionStarted(true);
        }
      } else {
        await setDoc(
          doc(
            db,
            "mission_sessions",
            missionSessionId
          ),
          {
            userName: user,
            missionId: mission.id,
            startedAt: serverTimestamp(),
            completed: false,
          },
          { merge: true }
        );

        setTimeLeft(
          (mission.estimatedMinutes || 0) * 60
        );

        setMissionStarted(true);
        setVideoCompleted(false);
      }
    } catch (error) {
      console.error(
        "Error cargando sesión:",
        error
      );

      setTimeLeft(
        (mission.estimatedMinutes || 0) * 60
      );

      setMissionStarted(false);
      setVideoCompleted(false);
    }

    setScreen("mission");
  };



const submitMission = async () => {
    if (sendingSubmission) return;
    if (timeLeft <= 0) {
      alert(
        "El tiempo de esta misión ha expirado. Un administrador debe reiniciar los tiempos."
      );
      return;
    }

    if (!missionResponse.trim() && !attachedFile) {
      alert("Debes escribir una respuesta o adjuntar evidencia");
      return;
    }

    try {
      setSendingSubmission(true);

      let fileUrl = null;

      if (attachedFile) {
        const storageRef = ref(
          storage,
          `missions/${user}/${Date.now()}_${attachedFile.name}`
        );

        await uploadBytes(storageRef, attachedFile);
        fileUrl = await getDownloadURL(storageRef);
      }

      // --- Begin new evaluation logic ---
      const normalizedResponse = missionResponse.trim();

      const hasFile = Boolean(fileUrl);

      const wordCount = normalizedResponse
        .split(/\s+/)
        .filter(Boolean).length;

      const hasReasonableAnswer = wordCount >= 8;

      const isVideoMission = selectedMission?.type === "video";

      const missionApproved = isVideoMission
        ? videoCompleted && (hasFile || hasReasonableAnswer)
        : hasFile || hasReasonableAnswer;

      const evaluation = {
        approved: missionApproved,
        feedback: missionApproved
          ? isVideoMission
            ? "Video completado y evidencia recibida correctamente."
            : hasFile
            ? "Evidencia recibida correctamente."
            : "Respuesta recibida correctamente."
          : isVideoMission
          ? "Debes completar el video y enviar una respuesta o evidencia."
          : "Debes enviar una respuesta o evidencia suficiente.",
      };
      // --- End new evaluation logic ---

      setFeedback(evaluation?.feedback || "");
      setApproved(missionApproved);

      // New: If not approved, mark submission as sent (show feedback)
      if (!missionApproved) {
        setSubmissionSent(true);
      }

      const existingSubmission = submissions.find(
        (s) => s.missionId === selectedMission.id
      );

      if (existingSubmission) {
        alert("Ya existe una entrega para esta misión.");
        setSendingSubmission(false);
        return;
      }

      await addDoc(collection(db, "submissions"), {
        userName: user,
        missionId: selectedMission.id,
        missionTitle: selectedMission.title,
        xp: getMissionXp(selectedMission),
        responseText: missionResponse,
        fileName: attachedFile ? attachedFile.name : null,
        fileSize: attachedFile ? attachedFile.size : null,
        fileUrl,
        status: missionApproved ? "approved" : "rejected",
        feedback: evaluation.feedback || "",
        createdAt: serverTimestamp(),
      });

      if (sessionId) {
        await setDoc(
          doc(db, "mission_sessions", sessionId),
          {
            completed: missionApproved,
          },
          { merge: true }
        );
      }

      if (missionApproved) {
        setSubmissionSent(true);
        launchConfetti();
        await loadScores();
        await loadCompletedMissions(user);
        await loadUserSubmissions(user);

        setCompletedMissions((prev) => [
          ...new Set([...prev, selectedMission.id]),
        ]);

        setIsMissionCompleted(true);
      }
    } catch (error) {
      console.error(error);
      alert("Error enviando respuesta");
    } finally {
      setSendingSubmission(false);
    }
  };

  const handleLogin = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const snapshot = await getDocs(collection(db, "users"));

      const users = snapshot.docs.map(doc => doc.data());

      const foundUser = users.find(
        u => u.name === user && u.password === password
      );

      if (!foundUser) {
        setLoading(false);
        alert("Usuario o contraseña incorrecta");
        return;
      }

      localStorage.setItem(
        "user",
        JSON.stringify(foundUser)
      );

    setUser(foundUser.name);
    setPassword("");

    await loadCompletedMissions(foundUser.name);
    await loadUserSubmissions(foundUser.name);

    setLoading(false);
    setScreen("dashboard");
    } catch (error) {
      console.error(error);
      alert("Error iniciando sesión");
      setLoading(false);
    }
  };
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (screen === "mission") {
    // 2) Add currentDayMissions and nextMissionInDay before the return
    const currentDayMissions = missions;

    const nextMissionInDay = currentDayMissions.find(
      (m) =>
        m.id !== selectedMission?.id &&
        !completedMissions?.includes?.(m.id)
    );
    // 2) Add missionExpired before the return
    const missionExpired = timeLeft <= 0;
    return (
      <Layout
        user={user}
        setScreen={setScreen}
        title={selectedMission?.title}
        activeScreen="mission"
      >
        <button
          className="mb-6 text-sm text-zinc-500"
          onClick={() => setScreen("day")}
        >
          ← Volver
        </button>
        <div className="animate-[fadeIn_.35s_ease]">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-zinc-500 text-sm tracking-wide uppercase">
              Misión activa
            </p>

            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mt-4">
              {selectedMission?.title}
            </h1>

            <p className="mt-5 text-base sm:text-lg text-zinc-500 max-w-2xl mx-auto whitespace-pre-line">
              {selectedMission?.description}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-6 px-4 sm:px-6 py-3 bg-white/70 backdrop-blur-xl rounded-3xl sm:rounded-full border border-white/50 max-w-full mx-auto">
              <span className="flex items-center gap-2 text-zinc-500">
                <Clock3 size={16} />
                {selectedMission?.estimatedMinutes} min
              </span>

              <span className="text-zinc-300">•</span>

              <span className="flex items-center gap-2 font-medium">
                <Award size={16} />
                {getMissionXp(selectedMission)} XP
              </span>

              <span className="text-zinc-300">•</span>

              <span className={timeLeft > 0 ? "text-zinc-700" : "text-red-600"}>
                {!missionStarted
                  ? formatTime(timeLeft)
                  : timeLeft > 0
                  ? formatTime(timeLeft)
                  : "Tiempo agotado"}
              </span>
            </div>
          </div>


          <div className="mt-10 bg-white/70 backdrop-blur-xl rounded-[32px] p-4 sm:p-8 border border-white/50 max-w-4xl mx-auto transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden">
            {selectedMission?.type === "video" && (
              <div className="mb-8 rounded-[24px] border border-zinc-200 p-4 bg-white">
                <p className="font-medium mb-3">
                  Video de la misión
                </p>

                {selectedMission.videoUrl?.includes("youtube") ? (
                  <>
                    <div className="w-full overflow-hidden rounded-xl">
                      <div
                        id="youtube-player"
                        className="w-full aspect-video"
                      />
                    </div>

                    <div className="mt-4">
                      <div className="h-3 bg-zinc-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-black transition-all"
                          style={{ width: `${Math.min(videoProgress, 100)}%` }}
                        />
                      </div>

                      <p className="text-sm text-zinc-500 mt-2">
                        Progreso: {videoProgress}%
                      </p>

                      <p className="text-sm text-zinc-500 mt-1">
                        Requerido: {selectedMission?.requiredVideoPercent || 90}%
                      </p>
                    </div>

                    {videoCompleted && (
                      <p className="mt-3 text-emerald-600 font-medium">
                        ✅ Requisito de visualización completado
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="aspect-video rounded-xl overflow-hidden">
                      <iframe
                        src={selectedMission.videoUrl}
                        className="w-full h-full"
                        allowFullScreen
                        title="mission-video"
                      />
                    </div>

                    {!videoCompleted && (
                      <button
                        className="mt-4 px-4 py-2 bg-black text-white rounded-xl"
                        onClick={() => setVideoCompleted(true)}
                      >
                        He terminado de ver el video
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <label className="block text-sm font-medium mb-2">
              Tu respuesta
            </label>

            <textarea
              value={missionResponse}
              onChange={(e) => {
                if (timeLeft <= 0) {
                  alert("⏰ El tiempo de esta misión se agotó. Un administrador debe reiniciar los tiempos.");
                  return;
                }
                setMissionResponse(e.target.value);
              }}
              rows={8}
              readOnly={isMissionCompleted || timeLeft <= 0}
              disabled={
                isMissionCompleted ||
                (selectedMission?.type === "video" && !videoCompleted)
              }
              className="w-full min-h-[240px] border border-zinc-100 rounded-[24px] p-5 text-lg bg-white/60 disabled:bg-zinc-100"
              placeholder="Escribe tu respuesta aquí..."
            />

            {selectedMission?.type === "video" && !videoCompleted && (
              <p className="mt-3 text-sm text-amber-600">
                Debes completar el video antes de responder.
              </p>
            )}

            {isMissionCompleted && (
              <p className="mt-3 text-sm text-zinc-500">
                Estás viendo una misión ya aprobada. Puedes consultar tu respuesta y archivo, pero no modificarla.
              </p>
            )}

            {!isMissionCompleted && timeLeft <= 0 && (
              <p className="mt-3 text-sm text-red-600">
                ⏰ El tiempo de esta misión se agotó. No puedes modificar ni enviar la respuesta.
              </p>
            )}

            {!isMissionCompleted && (
              <div className="mt-4">
                <input
                  type="file"
                  id="mission-file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAttachedFile(file);
                    }
                  }}
                />

                <button
                  type="button"
                  className="px-5 py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 transition"
                  onClick={() => {
                    document
                      .getElementById("mission-file")
                      ?.click();
                  }}
                >
                  Adjuntar archivo
                </button>

                {attachedFile && (
                  <p className="mt-2 text-sm text-zinc-600">
                    <span className="flex items-center gap-2">
                      <FileText size={16} />
                      {attachedFile.name}
                    </span>
                  </p>
                )}
              </div>
            )}

            {isMissionCompleted && attachedFile?.url && (
              <a
                href={attachedFile.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block rounded-2xl bg-zinc-100 p-4 text-sm"
              >
                <span className="flex items-center gap-2">
                  <FileText size={16} />
                  {attachedFile.name}
                </span>
              </a>
            )}

            {isMissionCompleted && (
              <div className="mt-4 rounded-xl p-4 bg-emerald-50 border border-emerald-200">
                <p className="font-semibold text-emerald-700">
                  ✅ Ya completaste esta misión
                </p>
                <p className="text-sm mt-1 text-emerald-700">
                  Esta misión ya fue aprobada y no puede volver a sumar puntos.
                </p>
              </div>
            )}

            <button
              className="w-full mt-8 bg-black text-white py-4 rounded-2xl text-lg disabled:opacity-60"
              onClick={submitMission}
              disabled={
                sendingSubmission ||
                isMissionCompleted ||
                timeLeft <= 0 ||
                (selectedMission?.type === "video" && !videoCompleted)
              }
            >
              {isMissionCompleted
                ? "Ya completada"
                : timeLeft <= 0
                ? "Tiempo agotado"
                : sendingSubmission
                ? "Evaluando..."
                : "Enviar respuesta"}
            </button>
            {(submissionSent || missionExpired) && (
              <>
                {/* 4) Add expired notice before the buttons */}
                {missionExpired && !submissionSent && (
                  <div className="mt-4 rounded-xl p-4 bg-amber-50 border border-amber-200">
                    <p className="font-semibold">
                      ⏰ Tiempo agotado
                    </p>

                    <p className="mt-2 text-sm">
                      No recibiste XP en esta misión, pero puedes continuar con la siguiente.
                    </p>
                  </div>
                )}
                {submissionSent && (
                  <div className={`mt-4 rounded-xl p-4 ${approved ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                    <p className="font-semibold">
                      {approved ? "✅ Misión aprobada" : "❌ Misión rechazada"}
                    </p>

                    <p className="mt-2 text-sm">
                      {feedback}
                    </p>
                  </div>
                )}
                <div className="flex gap-3 mt-3">
                  <button
                    className="flex-1 border border-zinc-200 py-3 rounded-xl"
                    onClick={() => setScreen("day")}
                  >
                    Volver al día
                  </button>

                  {(approved || missionExpired) && nextMissionInDay && (
                    <button
                      className="flex-1 bg-black text-white py-3 rounded-xl"
                      onClick={async () => {
                        if (missionExpired && !approved) {
                          const existing = submissions.find(
                            (s) =>
                              s.missionId === selectedMission.id &&
                              (s.status === "approved" || s.status === "expired")
                          );

                          if (!existing) {
                            await addDoc(collection(db, "submissions"), {
                              userName: user,
                              missionId: selectedMission.id,
                              missionTitle: selectedMission.title,
                              xp: 0,
                              responseText: "",
                              status: "expired",
                              feedback: "Tiempo agotado",
                              createdAt: serverTimestamp(),
                            });

                            if (sessionId) {
                              await setDoc(
                                doc(db, "mission_sessions", sessionId),
                                { expired: true },
                                { merge: true }
                              );
                            }
                          }

                          await loadCompletedMissions(user);
                          await loadUserSubmissions(user);
                        }

                        openMission(nextMissionInDay);
                      }}
                    >
                      Siguiente misión
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  if (screen === "day") {
    const dayMissions = missions;

    const nextMission = dayMissions.find(
      (m) => !completedMissions.includes(m.id)
    );

    const expiredMissionIds = submissions
      .filter((s) => s.status === "expired")
      .map((s) => s.missionId);

    return (
      <Layout
        user={user}
        setScreen={setScreen}
        title={selectedDay?.title}
        activeScreen="day"
      >
        <button
          className="mb-8 text-sm text-zinc-500"
          onClick={() => setScreen("dashboard")}
        >
          ← Volver
        </button>

        <div className="mb-10">
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
            {selectedDay?.title}
          </h1>

          <p className="mt-3 text-zinc-500 text-lg whitespace-pre-line">
            {selectedDay?.description}
          </p>
        </div>

        <div className="mb-12 overflow-x-auto">
          <div className="flex items-center justify-center min-w-max px-4">
            {dayMissions.map((mission, index) => {
              const completed = completedMissions.includes(mission.id);
              const active = nextMission?.id === mission.id;

              return (
                <div key={mission.id} className="flex items-center">
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-semibold transition-all ${
                      completed
                        ? "bg-black text-white"
                        : active
                        ? "bg-white border-2 border-black"
                        : "bg-zinc-200 text-zinc-500"
                    }`}
                  >
                    {index + 1}
                  </div>

                  {index < dayMissions.length - 1 && (
                    <div className="w-10 sm:w-16 h-px bg-zinc-300" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {dayMissions.some((m) => completedMissions.includes(m.id)) && (
          <div className="mb-10 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-4">
              Misiones completadas
            </h3>

            <div className="space-y-3">
              {dayMissions
                .filter((m) => completedMissions.includes(m.id))
                .map((mission) => (
                  <button
                    key={mission.id}
                    onClick={() => openMission(mission)}
                    className="w-full text-left bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-white/50 hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {mission.title}
                      </span>
                      {expiredMissionIds.includes(mission.id) ? (
                        <span className="text-amber-600 text-sm">
                          ⏰ Tiempo agotado
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-sm flex items-center gap-1">
                          <CheckCircle2 size={14} />
                          Completada
                        </span>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {nextMission ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-[32px] p-6 sm:p-8 border border-white/50 max-w-2xl mx-auto">
            <p className="text-sm text-zinc-500 mb-2">
              Siguiente misión
            </p>

            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                {nextMission.title}
              </h2>

              <button
                className="px-6 py-3 rounded-2xl bg-black text-white shrink-0"
                onClick={() => openMission(nextMission)}
              >
                Comenzar
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 sm:gap-5 text-sm text-zinc-500">
              <span>{nextMission.estimatedMinutes} min</span>
              <span>{getMissionXp(nextMission)} XP</span>
            </div>
          </div>
        ) : (
          <div className="bg-white/70 backdrop-blur-xl rounded-[32px] p-8 border border-white/50 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-semibold">
              Día completado
            </h2>

            <p className="mt-3 text-zinc-500">
              Has terminado todas las misiones de este día.
            </p>
          </div>
        )}
      </Layout>
    );
  }

  if (screen === "score") {
    const ranking = Object.entries(scores)
      .sort((a, b) => b[1] - a[1]);

    const leader = ranking[0];

    return (
      <Layout
        user={user}
        setScreen={setScreen}
        title="Ranking"
        activeScreen="score"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold">
            Ranking
          </h1>

          <p className="mt-2 text-zinc-500">
            Completa misiones y alcanza el primer lugar.
          </p>
        </div>

        <div className="bg-black text-white rounded-3xl p-8 text-center mb-6">
          <p className="text-zinc-300 text-sm">
            Líder actual
          </p>

          <h2 className="text-3xl font-semibold mt-2">
            {leader?.[0]}
          </h2>

          <p className="mt-2 text-zinc-300">
            {leader?.[1]} XP
          </p>
        </div>

        <div className="space-y-3">
          {ranking.map(([name, xp], index) => (
            <div
              key={name}
              className={`bg-white rounded-3xl p-6 border flex justify-between items-center ${index === 0 ? "border-black" : "border-zinc-200"}`}
            >
              <div>
                <p className="font-semibold text-lg">
                  #{index + 1} {name}
                </p>

                <p className="text-sm text-zinc-500">
                  {index === 0
                    ? "Primer lugar"
                    : `${leader[1] - xp} XP para alcanzarlo`}
                </p>
              </div>

              <span className="font-semibold">
                {xp} XP
              </span>
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  if (screen === "admin") {
    if (adminPassword !== "ramiadmin") {
      return (
        <Layout setScreen={setScreen}>
          <div className="max-w-md mx-auto bg-white rounded-3xl border border-zinc-200 p-6">
            <h2 className="text-xl font-semibold mb-4">
              Panel Administrador
            </h2>

            <input
              type="password"
              placeholder="Contraseña admin"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full p-3 rounded-xl border border-zinc-200"
            />

            <button
              className="w-full mt-4 bg-black text-white py-3 rounded-xl"
              onClick={() => {
                if (adminPassword !== "ramiadmin") {
                  alert("Usuario o contraseña incorrecta");
                }
              }}
            >
              Entrar
            </button>
          </div>
        </Layout>
      );
    }

    // Load all submissions if not loaded
    if (allSubmissions.length === 0) {
      loadAllSubmissions();
    }

    return (
      <Layout setScreen={setScreen}>
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 mb-6">
          <div className="flex justify-end mb-4">
            <button
              className="px-4 py-3 rounded-2xl bg-amber-500 text-white font-medium"
              onClick={resetMissionTimers}
            >
              Resetear tiempos
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Gestionar días
          </h2>

          <input
            className="w-full p-3 rounded-xl border border-zinc-200 mb-3"
            placeholder="Nombre del día"
            value={newDayTitle}
            onChange={(e) => setNewDayTitle(e.target.value)}
          />

          <textarea
            className="w-full p-3 rounded-xl border border-zinc-200 mb-3"
            placeholder="Descripción"
            value={newDayDescription}
            onChange={(e) => setNewDayDescription(e.target.value)}
          />

          <button
            className="w-full bg-black text-white py-3 rounded-xl"
            onClick={saveDay}
          >
            {editingDayId ? "Guardar día" : "Crear día"}
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Crear misión
          </h2>

          <input
            className="w-full p-3 rounded-xl border border-zinc-200 mb-3"
            placeholder="Título"
            value={newMissionTitle}
            onChange={(e) => setNewMissionTitle(e.target.value)}
          />

          <textarea
            className="w-full p-3 rounded-xl border border-zinc-200 mb-3"
            placeholder="Descripción"
            value={newMissionDescription}
            onChange={(e) => setNewMissionDescription(e.target.value)}
          />

          <select
            className="w-full p-3 rounded-xl border border-zinc-200 mb-3"
            value={newMissionDayId}
            onChange={(e) => setNewMissionDayId(e.target.value)}
          >
            <option value="">Selecciona un día</option>
            {days.map((day) => (
              <option key={day.id} value={day.id}>
                {day.title}
              </option>
            ))}
          </select>

          <select
            className="w-full p-3 rounded-xl border border-zinc-200 mb-3"
            value={newMissionType}
            onChange={(e) => setNewMissionType(e.target.value)}
          >
            <option value="text">Misión normal</option>
            <option value="video">Misión video</option>
          </select>

          {newMissionType === "video" && (
            <>
              <input
                className="w-full p-3 rounded-xl border border-zinc-200 mb-3"
                placeholder="YouTube, youtu.be o embed"
                value={newMissionVideoUrl}
                onChange={(e) =>
                  setNewMissionVideoUrl(
                    normalizeVideoUrl(e.target.value)
                  )
                }
              />
              <p className="text-xs text-zinc-500 mb-3">
                Puedes pegar enlaces de YouTube normales, youtu.be o embed.
                Se convertirán automáticamente.
              </p>

              <input
                type="number"
                min="1"
                max="100"
                className="w-full p-3 rounded-xl border border-zinc-200 mb-3"
                placeholder="Porcentaje mínimo"
                value={newMissionVideoPercent}
                onChange={(e) =>
                  setNewMissionVideoPercent(e.target.value)
                }
              />

              <p className="text-xs text-zinc-500 mb-3">
                Porcentaje del video que debe ver para desbloquear la respuesta.
              </p>
            </>

            
          )}

          <input
            type="number"
            className="w-full p-3 rounded-xl border border-zinc-200 mb-3"
            placeholder="Minutos"
            value={newMissionMinutes}
            onChange={(e) => setNewMissionMinutes(e.target.value)}
          />

          <input
            type="number"
            className="w-full p-3 rounded-xl border border-zinc-200 mb-3"
            placeholder="Puntos"
            value={newMissionPoints}
            onChange={(e) => setNewMissionPoints(e.target.value)}
          />

          <button
            className="w-full bg-black text-white py-3 rounded-xl"
            onClick={createMission}
          >
            {editingMissionId ? "Guardar cambios" : "Crear misión"}
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Misiones existentes
          </h2>

          <div className="space-y-4">
            {days.map((day) => {
              const dayMissions = allMissions.filter(
                (mission) => mission.dayId === day.id
              );
              const sortedDayMissions = [...dayMissions].sort(
                (a, b) => (a.order || 0) - (b.order || 0)
              );

              return (
                <div
                  key={day.id}
                  className="border border-zinc-200 rounded-2xl overflow-hidden"
                >
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 bg-zinc-50"
                    onClick={() => toggleDayExpansion(day.id)}
                  >
                    <div className="text-left">
                      <p className="font-semibold">{day.title}</p>
                      <p className="text-sm text-zinc-500">
                        {dayMissions.length} misión(es)
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewMissionDayId(day.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="p-2 rounded-lg border border-zinc-200 bg-white"
                      >
                        <Plus size={16} />
                      </button>

                      <span>
                        {expandedDays[day.id] ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>

                  {expandedDays[day.id] && (
                    <div className="p-4 space-y-3 bg-white">
                      {dayMissions.length === 0 ? (
                        <p className="text-sm text-zinc-500">
                          Sin misiones.
                        </p>
                      ) : (
                        sortedDayMissions.map((mission) => (
                          <div
                            key={mission.id}
                            className="border border-zinc-200 rounded-xl p-4 flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium">
                                {mission.title}
                              </p>

                              <p className="text-sm text-zinc-500">
                                {mission.estimatedMinutes} min · {getMissionXp(mission)} XP
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                className="px-3 py-2 border rounded-xl"
                                onClick={() => moveMissionUp(mission)}
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                className="px-3 py-2 border rounded-xl"
                                onClick={() => moveMissionDown(mission)}
                              >
                                <ArrowDown size={16} />
                              </button>
                              <button
                                className="px-3 py-2 border rounded-xl"
                                onClick={() => editMission(mission)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="px-3 py-2 border rounded-xl"
                                onClick={() => resetMissionProgress(mission)}
                                title="Reiniciar progreso"
                              >
                                <RotateCcw size={16} />
                              </button>
                              <button
                                className="px-3 py-2 border rounded-xl"
                                onClick={() => removeMission(mission.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Entregas
            </h2>

            <button
              className="px-4 py-2 border rounded-xl"
              onClick={loadAllSubmissions}
            >
              Actualizar
            </button>
          </div>
          <input
            type="text"
            placeholder="Buscar usuario..."
            value={submissionSearch}
            onChange={(e) => setSubmissionSearch(e.target.value)}
            className="w-full p-3 rounded-xl border border-zinc-200 mb-6"
          />

          {["Simón", "Tomás", "Juan"]
            .filter((userName) =>
              userName.toLowerCase().includes(
                submissionSearch.toLowerCase()
              )
            )
            .map((userName) => {
            const userSubmissions = allSubmissions.filter(
              (s) => s.userName === userName
            );

            return (
              <div key={userName} className="mb-6">
                <button
                  className="w-full flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 mb-3"
                  onClick={() => toggleUserSubmissions(userName)}
                >
                  <span className="font-semibold text-lg">
                    {userName}
                  </span>

                  <span className="text-sm text-zinc-500">
                    {userSubmissions.length} entrega(s)
                    {expandedUsers[userName] ? " ▲" : " ▼"}
                  </span>
                </button>

                {expandedUsers[userName] && (
                  userSubmissions.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Sin entregas.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {userSubmissions.map((submission) => (
                        <div
                          key={submission.id}
                          className="border border-zinc-200 rounded-xl p-4"
                        >
                          <p className="font-medium">
                            {submission.missionTitle}
                          </p>

                          <p className="text-sm mt-1">
                            {submission.status === "approved"
                              ? "✅ Aprobada"
                              : "❌ Rechazada"}
                          </p>

                          {submission.fileName && (
                            <div className="mt-2">
                              <p className="text-sm text-zinc-500">
                                📎 {submission.fileName}
                              </p>
                              {submission.fileUrl && (
                                <a
                                  href={submission.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 mt-2 px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-sm"
                                >
                                  <Eye size={16} />
                                  Ver evidencia
                                </a>
                              )}
                            </div>
                          )}

                          {submission.feedback && (
                            <p className="text-sm text-zinc-600 mt-2">
                              {submission.feedback}
                            </p>
                          )}
                          {submission.responseText && (
                            <div className="mt-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                              <p className="text-xs text-zinc-500 mb-1">
                                Respuesta del estudiante
                              </p>

                              <p className="text-sm whitespace-pre-wrap">
                                {submission.responseText}
                              </p>
                            </div>
                          )}
                          <textarea
                            placeholder="Feedback opcional para el estudiante..."
                            value={adminFeedbacks[submission.id] || ""}
                            onChange={(e) =>
                              setAdminFeedbacks((prev) => ({
                                ...prev,
                                [submission.id]: e.target.value,
                              }))
                            }
                            className="w-full mt-3 p-3 rounded-xl border border-zinc-200 text-sm"
                            rows={3}
                          />
                          <div className="flex gap-2 mt-3">
                            <button
                              className="px-3 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-sm"
                              onClick={() =>
                                reviewSubmission(submission.id, true)
                              }
                            >
                              Aprobar manualmente
                            </button>

                            <button
                              className="px-3 py-2 rounded-xl bg-red-100 text-red-700 text-sm"
                              onClick={() =>
                                reviewSubmission(submission.id, false)
                              }
                            >
                              Rechazar manualmente
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          {days.map((day) => (
            <div
              key={day.id}
              className="bg-white rounded-3xl border border-zinc-200 p-6 flex justify-between items-center"
            >
              <div>
                <p className="font-semibold">{day.title}</p>
                <p className="text-sm text-zinc-500">
                  {day.description}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {day.enabled ? "Desbloqueado" : "Bloqueado"}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  className="px-3 py-2 border rounded-xl"
                  onClick={() => editDay(day)}
                >
                  <Pencil size={16} />
                </button>

                <button
                  className="px-3 py-2 border rounded-xl"
                  onClick={() => removeDay(day.id)}
                >
                  <Trash2 size={16} />
                </button>

                <button
                  className="px-4 py-2 rounded-xl border border-zinc-200"
                  onClick={() => toggleDay(day.id, day.enabled)}
                >
                  {day.enabled ? "Bloquear" : "Desbloquear"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Layout>
    );
  }


  if (screen === "submissions") {
    return (
      <Layout
        user={user}
        setScreen={setScreen}
        title="Mis entregas"
      >
        <div className="space-y-4">
          {submissions.length === 0 && (
            <div className="bg-white rounded-3xl border border-zinc-200 p-6">
              No tienes entregas todavía.
            </div>
          )}

          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="bg-white rounded-3xl border border-zinc-200 p-6"
            >
              <h3 className="font-semibold">
                {submission.missionTitle}
              </h3>

              <p className="mt-2">
                {submission.status === "approved"
                  ? "✅ Aprobada"
                  : "❌ Rechazada"}
              </p>

              {submission.feedback && (
                <p className="mt-3 text-sm text-zinc-600">
                  {submission.feedback}
                </p>
              )}
              {submission.responseText && (
                <div className="mt-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <p className="text-xs text-zinc-500 mb-1">
                    Tu respuesta
                  </p>

                  <p className="text-sm whitespace-pre-wrap">
                    {submission.responseText}
                  </p>
                </div>
              )}
              {submission.fileName && submission.fileUrl && (
                <a
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-sm"
                >
                  <Eye size={16} />
                  Ver archivo enviado
                </a>
              )}
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  if (screen === "profile") {
    return (
      <Layout
        user={user}
        setScreen={setScreen}
        title="Perfil"
        activeScreen="profile"
      >
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 border border-zinc-200">
          <p className="text-sm text-zinc-500">
            Usuario
          </p>

          <p className="text-xl font-semibold mt-1">
            {user}
          </p>

          <button
            className="mt-4 px-4 py-2 rounded-xl border border-zinc-200 w-full"
            onClick={async () => {
              await loadUserSubmissions();
              setScreen("submissions");
            }}
          >
            Mis entregas
          </button>

          <button
            className="mt-6 px-4 py-3 rounded-xl bg-black text-white w-full"
            onClick={() => {
              localStorage.removeItem("user");
              setScreen("login");
            }}
          >
            Cerrar sesión
          </button>
        </div>

        <div className="mt-4">
          <button
            className="w-full px-4 py-3 rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-xl"
            onClick={() => setScreen("admin")}
          >
            Administrador
          </button>
        </div>
      </Layout>
    );
  }

  if (screen === "login") {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm">
          <h1 className="text-3xl font-semibold text-center">
            Ramidemia
          </h1>

          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Usuario"
            className="w-full mt-8 p-3 rounded-xl border border-zinc-200"
          />

          <div className="relative mt-4">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full p-3 pr-12 rounded-xl border border-zinc-200"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            className="w-full mt-4 bg-black text-white py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Cargando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
          {/* <button
            className="w-full mt-3 py-2 text-sm text-zinc-500"
            onClick={seedDatabase}
          >
            Inicializar BD
          </button> */}

        </div>
      </div>
    );
  }


  return (
    <Layout
      user={user}
      setScreen={setScreen}
      title="Dashboard"
      activeScreen="dashboard"
    >
      <DashboardRoadmap
        days={days}
        allMissions={allMissions}
        completedMissionIds={completedMissions}
        openDay={openDay}
        user={user}
      />
    </Layout>
  );
}
function DashboardRoadmap({
  days,
  allMissions,
  completedMissionIds,
  openDay,
  user,
}) {
  const totalMissions = allMissions.length;

  const completedCount = allMissions.filter((m) =>
    completedMissionIds.includes(m.id)
  ).length;

  const progress = totalMissions
    ? Math.round((completedCount / totalMissions) * 100)
    : 0;

  const totalXp = allMissions
    .filter((m) => completedMissionIds.includes(m.id))
    .reduce((sum, m) => sum + getMissionXp(m), 0);

  const { current, next } = getLevelInfo(totalXp);

  const levelProgress = next
    ? ((totalXp - current.xp) / (next.xp - current.xp)) * 100
    : 100;

  return (
    <div>
      <div className="mb-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-500 text-sm">
              Bienvenido
            </p>

            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mt-2">
              {user}
            </h1>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="text-zinc-500 font-medium">
                Nivel {current.level} • {current.title}
              </span>

              {next && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black rounded-full"
                      style={{
                        width: `${Math.min(levelProgress, 100)}%`,
                      }}
                    />
                  </div>

                  <span className="text-xs text-zinc-500 font-medium">
                    {totalXp} XP
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem("user");
              window.location.reload();
            }}
            className="p-3 rounded-2xl bg-white/70 backdrop-blur-xl border border-zinc-200 hover:shadow-md transition"
          >
            <LogOut size={22} />
          </button>
        </div>

        <div className="mt-8 bg-white/70 backdrop-blur-xl rounded-3xl p-6 border border-white/50 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-zinc-600">
              Tu progreso
            </span>

            <span className="font-semibold">
              {progress}%
            </span>
          </div>

          <div className="h-3 rounded-full bg-zinc-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-black transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {days.map((day, index) => (
          <DayCard
            key={day.id}
            day={day}
            index={index}
            allMissions={allMissions}
            completedMissionIds={completedMissionIds}
            title={day.title}
            description={day.description}
            status={day.enabled ? "available" : "locked"}
            lockedMessage={!day.enabled}
            onClick={() => openDay(day)}
          />
        ))}
      </div>
    </div>
  );
}


function Layout({
  children,
  setScreen,
  activeScreen,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-blue-50">
      <main
        className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 animate-[fadeIn_.35s_ease]"
        style={{
          paddingBottom: "calc(8rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>

      <div
        className="fixed left-1/2 -translate-x-1/2 z-50"
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 sm:py-3 rounded-full border border-white/40 bg-white/60 backdrop-blur-3xl shadow-lg shadow-black/5 animate-[slideUp_.45s_ease]">
          <button
            onClick={() => setScreen("dashboard")}
            className={`flex flex-col items-center justify-center px-3 sm:px-4 py-2 rounded-full transition-all duration-300 min-w-[56px] ${activeScreen === "dashboard" ? "bg-black text-white shadow-lg scale-105" : "text-zinc-700 hover:bg-white/60"}`}
          >
            <House size={20} />
            {/* <span>Inicio</span> */}
          </button>

          <button
            onClick={() => setScreen("score")}
            className={`flex flex-col items-center justify-center px-3 sm:px-4 py-2 rounded-full transition-all duration-300 min-w-[56px] ${activeScreen === "score" ? "bg-black text-white shadow-lg scale-105" : "text-zinc-700 hover:bg-white/60"}`}
          >
             <Trophy size={20} />
          </button>

          <button
            onClick={() => setScreen("profile")}
            className={`flex flex-col items-center justify-center px-3 sm:px-4 py-2 rounded-full transition-all duration-300 min-w-[56px] ${activeScreen === "profile" ? "bg-black text-white shadow-lg scale-105" : "text-zinc-700 hover:bg-white/60"}`}
          >
            <User size={20} />
            {/* <span>Perfil</span> */}
          </button>
        </div>
      </div>
    </div>
  );
}

function DayCard({
  title,
  description,
  status,
  onClick,
  lockedMessage,
  day,
  allMissions,
  completedMissionIds,
  index,
}) {
  const styles = {
    available:
      "bg-white border-zinc-200",
    completed:
      "bg-emerald-50 border-emerald-200",
    locked:
      "bg-zinc-100 border-zinc-200",
  };

  const dayMissions = (allMissions || []).filter(
    (mission) => mission.dayId === day?.id
  );

  const totalCount = dayMissions.length;

  const completedCount = dayMissions.filter(
    (mission) => completedMissionIds?.includes(mission.id)
  ).length;

  const totalPoints = dayMissions.reduce(
    (sum, mission) => sum + getMissionXp(mission),
    0
  );

  const dayCompleted =
    totalCount > 0 && completedCount === totalCount;

  return (
    <div
      onClick={onClick}
      className={`group flex items-start gap-4 sm:gap-5 ${status === "available" ? "cursor-pointer" : "cursor-pointer opacity-70"}`}
    >
      <div className="flex flex-col items-center">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center font-semibold transition-all ${
            dayCompleted
              ? "bg-black text-white"
              : status === "available"
              ? "bg-white border border-zinc-200"
              : "bg-zinc-200"
          }`}
        >
          {dayCompleted ? <CheckCircle2 size={22} /> : index + 1}
        </div>

        <div className="w-px h-12 sm:h-16 bg-zinc-200 mt-2" />
      </div>

      <div className="flex-1 pb-8 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">
            {title}
          </h3>

          <p className="mt-1 text-zinc-500">
            {description}
          </p>

          <div className="mt-3 flex flex-wrap gap-3 sm:gap-4 text-sm text-zinc-500">
            <span>
              {completedCount}/{totalCount} misiones
            </span>

            <span>
              {totalPoints} XP
            </span>
          </div>
        </div>

        {status === "locked" && (
          <div className="flex items-center justify-center pr-2">
            <Lock size={34} className="text-zinc-400" />
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({
  name,
  points,
}) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-zinc-200 flex justify-between">
      <span>{name}</span>
      <span>{points} XP</span>
    </div>
  );
} 