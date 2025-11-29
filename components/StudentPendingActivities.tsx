import React, { useState, useEffect } from 'react';

// Interfaces necesarias
interface StudentGradeEntry {
  topic: string;
  grade: string;
}

interface StudentSheetData {
  studentName: string;
  grades: { [date: string]: StudentGradeEntry };
}

interface PendingActivityDetail {
  date: string;
  topic: string;
  grade: string; // La calificación original, que se espera sea vacía o no válida
}

interface StudentPendingActivitiesProps {
  sheetData: StudentSheetData[];
  allDates: string[];
  startDate: string;
  endDate: string;
}

const StudentPendingActivities: React.FC<StudentPendingActivitiesProps> = ({
  sheetData,
  allDates,
  startDate,
  endDate,
}) => {
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [pendingActivities, setPendingActivities] = useState<PendingActivityDetail[]>([]);

  // Función para convertir calificaciones a numéricas (copia local para auto-contención)
  const convertGradeToNumeric = (grade: string): number | null => {
    grade = String(grade).toUpperCase();
    switch (grade) {
      case 'L': return 9;
      case 'ML': return 6;
      case 'NL': return 3;
      default:
        const numGrade = parseFloat(grade);
        if (!isNaN(numGrade)) {
          return numGrade > 10 ? (numGrade / 100) * 10 : numGrade;
        }
        return null;
    }
  };

  // Función para verificar si una calificación es cualitativa (copia local para auto-contención)
  const isQualitativeGrade = (grade: string): boolean => {
    const upperGrade = String(grade).toUpperCase();
    return ['L', 'ML', 'NL'].includes(upperGrade);
  };

  // Efecto para inicializar el estudiante seleccionado
  useEffect(() => {
    if (sheetData.length > 0 && !selectedStudentName) {
      setSelectedStudentName(sheetData[0].studentName); // Seleccionar el primer estudiante por defecto
    }
  }, [sheetData, selectedStudentName]);

  // Efecto para calcular las actividades pendientes cuando cambian las props o el estudiante seleccionado
  useEffect(() => {
    if (!selectedStudentName || !sheetData.length || !startDate || !endDate) {
      setPendingActivities([]);
      return;
    }

    const student = sheetData.find(s => s.studentName === selectedStudentName);
    if (!student) {
      setPendingActivities([]);
      return;
    }

    const startIdx = allDates.indexOf(startDate);
    const endIdx = allDates.indexOf(endDate);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      setPendingActivities([]);
      return;
    }

    const relevantDatesInSelectedRange: string[] = allDates.slice(startIdx, endIdx + 1).filter(date => {
        return student.grades[date] !== undefined; // Solo fechas para las que el estudiante tiene una entrada
    });

    const currentPendingActivities: PendingActivityDetail[] = [];

    relevantDatesInSelectedRange.forEach(date => {
      const activity = student.grades[date];
      if (activity) {
        const numericGrade = convertGradeToNumeric(activity.grade);
        const originalGrade = String(activity.grade).trim();

        // Si la calificación no es numérica válida y no es una calificación cualitativa (L, ML, NL),
        // entonces se considera pendiente (incluye celdas vacías o con texto no reconocido)
        if (numericGrade === null && !isQualitativeGrade(originalGrade)) {
          currentPendingActivities.push({
            date: date,
            topic: activity.topic,
            grade: originalGrade === '' ? 'Vacío' : originalGrade // Mostrar 'Vacío' si la celda está en blanco
          });
        }
      }
    });
    setPendingActivities(currentPendingActivities);
  }, [selectedStudentName, sheetData, allDates, startDate, endDate]);

  return (
    <div className="mb-8">
      <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Actividades Pendientes por Estudiante</h3>

      {sheetData.length > 0 ? (
        <div className="mb-4">
          <label htmlFor="student-select-pending" className="block text-gray-700 text-sm font-bold mb-2">
            Seleccionar Estudiante:
          </label>
          <select
            id="student-select-pending"
            value={selectedStudentName}
            onChange={(e) => setSelectedStudentName(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            {sheetData.map((student) => (
              <option key={student.studentName} value={student.studentName}>
                {student.studentName}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-gray-600 mb-4">Carga datos para seleccionar un estudiante y ver sus actividades pendientes.</p>
      )}

      {selectedStudentName && (
        <div className="overflow-x-auto">
          {pendingActivities.length > 0 ? (
            <table className="min-w-full bg-white rounded-lg shadow-md">
              <thead className="bg-orange-50">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider rounded-tl-lg">Fecha</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Actividad</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider rounded-tr-lg">Estado Original</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pendingActivities.map((activity, index) => (
                  <tr key={index} className="hover:bg-orange-50">
                    <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{activity.date}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{activity.topic}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{activity.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-gray-600">No hay actividades pendientes para {selectedStudentName} en el rango de fechas seleccionado.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentPendingActivities;
