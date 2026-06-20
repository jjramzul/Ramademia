import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function seedDatabase() {
  const users = [
    {
      id: "simon",
      name: "Simón",
      password: "CareCholo",
      points: 0,
      isAdmin: false,
    },
    {
      id: "tomas",
      name: "Tomás",
      password: "BBsito",
      points: 0,
      isAdmin: false,
    },
    {
      id: "juan",
      name: "Juan",
      password: "admin123",
      points: 0,
      isAdmin: true,
    },
  ];

  for (const user of users) {
    await setDoc(
      doc(db, "users", user.id),
      user
    );
  }

  for (let i = 0; i <= 7; i++) {
    await setDoc(
      doc(db, "days", `day${i}`),
      {
        title: `Día ${i}`,
        enabled: i === 0,
        order: i,
      }
    );
  }

  const missions = [
    {
      id: "mission1",
      dayId: "day0",
      title: "Ver video introductorio",
      description: "Mira el video completo",
      estimatedMinutes: 15,
      points: 1,
      order: 1,
    },
    {
      id: "mission2",
      dayId: "day0",
      title: "Escribir reflexión",
      description: "¿Qué te llamó la atención?",
      estimatedMinutes: 10,
      points: 1,
      order: 2,
    },
  ];

  for (const mission of missions) {
    await setDoc(
      doc(db, "missions", mission.id),
      mission
    );
  }

  await setDoc(
    doc(db, "mission_sessions", "example"),
    {
      userName: "Simón",
      missionId: "mission1",
      startedAt: null,
      completed: false,
    }
  );

  alert("Base creada");
}