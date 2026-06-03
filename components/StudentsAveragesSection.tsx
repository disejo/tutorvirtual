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

interface QuantitativeStudentAverage {
  studentName: string;
  totalAverage: string; // Promedio total combinado cuantitativo + cualitativo
  quantitativeAverage: string | null;
  qualitativeAverage: string | null;
  quantitativeCount: number;
  qualitativeCount: number;
  quantitativeDetails: { topic: string; grade: string }[];
  qualitativeDetails: { topic: string; grade: string }[];
}

interface StudentsAveragesSectionProps {
  sheetData: StudentSheetData[];
  allDates: string[];
  startDate: string;
  endDate: string;
}

const StudentsAveragesSection: React.FC<StudentsAveragesSectionProps> = ({
  sheetData,
  allDates,
  startDate,
  endDate,
}) => {
  const [studentQuantitativeAverages, setStudentQuantitativeAverages] = useState<QuantitativeStudentAverage[]>([]);
  // Estado local para controlar la visibilidad de las listas de estudiantes en actividades
  const [expandedActivities, setExpandedActivities] = useState<{[key: string]: boolean}>({});

  // Función para convertir calificaciones a numéricas
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

  // Función para verificar si una calificación es cualitativa
  const isQualitativeGrade = (grade: string): boolean => {
    const upperGrade = String(grade).toUpperCase();
    return ['L', 'ML', 'NL'].includes(upperGrade);
  };

  // Función para verificar si una calificación es puramente numérica
  const isQuantitativeGrade = (grade: string): boolean => {
    const numGrade = parseFloat(grade);
    return !isNaN(numGrade) && !isQualitativeGrade(grade);
  };

  // Función para alternar la expansión de una actividad o estudiante
  const toggleExpansion = (key: string): void => {
    setExpandedActivities(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Efecto para calcular los promedios cuando los datos cambian
  useEffect(() => {
    if (!sheetData.length || !startDate || !endDate) {
      setStudentQuantitativeAverages([]);
      return;
    }

    const startIdx = allDates.indexOf(startDate);
    const endIdx = allDates.indexOf(endDate);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      setStudentQuantitativeAverages([]);
      return;
    }

    const relevantDatesInSelectedRange: string[] = allDates.slice(startIdx, endIdx + 1).filter(date => {
      return sheetData.some(student => student.grades[date]);
    });

    const studentAverages: QuantitativeStudentAverage[] = [];

    sheetData.forEach(student => {
      let totalGradesSum = 0;
      let totalGradesCount = 0;
      let quantitativeGradesSum = 0;
      let quantitativeGradesCount = 0;
      let qualitativeGradesSum = 0;
      let qualitativeGradesCount = 0;

      const quantitativeDetails: { topic: string; grade: string }[] = [];
      const qualitativeDetails: { topic: string; grade: string }[] = [];

      relevantDatesInSelectedRange.forEach(date => {
        const activity = student.grades[date];
        if (!activity) return;

        const numericGrade = convertGradeToNumeric(activity.grade);
        if (numericGrade === null) return;

        const originalGrade = String(activity.grade).toUpperCase();
        totalGradesSum += numericGrade;
        totalGradesCount += 1;

        if (isQuantitativeGrade(activity.grade)) {
          quantitativeGradesSum += numericGrade;
          quantitativeGradesCount += 1;
          quantitativeDetails.push({ topic: activity.topic, grade: originalGrade });
        } else if (isQualitativeGrade(activity.grade)) {
          qualitativeGradesSum += numericGrade;
          qualitativeGradesCount += 1;
          qualitativeDetails.push({ topic: activity.topic, grade: originalGrade });
        }
      });

      if (totalGradesCount > 0) {
        const quantitativeAverage = quantitativeGradesCount > 0 ? quantitativeGradesSum / quantitativeGradesCount : null;
        const qualitativeAverage = qualitativeGradesCount > 0 ? qualitativeGradesSum / qualitativeGradesCount : null;
        const totalAverage = quantitativeAverage !== null && qualitativeAverage !== null
          ? (quantitativeAverage + qualitativeAverage) / 2
          : quantitativeAverage !== null
            ? quantitativeAverage
            : qualitativeAverage !== null
              ? qualitativeAverage
              : null;

        studentAverages.push({
          studentName: student.studentName,
          totalAverage: totalAverage !== null ? totalAverage.toFixed(2) : '0.00',
          quantitativeAverage: quantitativeAverage !== null ? quantitativeAverage.toFixed(2) : null,
          qualitativeAverage: qualitativeAverage !== null ? qualitativeAverage.toFixed(2) : null,
          quantitativeCount: quantitativeGradesCount,
          qualitativeCount: qualitativeGradesCount,
          quantitativeDetails,
          qualitativeDetails,
        });
      }
    });

    setStudentQuantitativeAverages(studentAverages);
  }, [sheetData, allDates, startDate, endDate]); // Dependencias del useEffect

  return (
    <>
      <div className="mb-8">
        <h3 className="text-2xl font-semibold text-gray-800">Nota del estudiante (Cuantitativo, Cualitativo)</h3>
        <small className="mb-4">Promedios finales:</small>
        <ul className="list-none space-y-3 text-gray-700">
          {studentQuantitativeAverages.length > 0 ? (
            studentQuantitativeAverages.map((studentAvg: QuantitativeStudentAverage, index: number) => (
              <li key={index} className="bg-purple-50 p-4 rounded-md shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div>
                    <p className="text-lg font-semibold text-purple-700">{studentAvg.studentName}</p>
                    <p className="text-sm text-gray-700"><b>Nota</b> (Rango Seleccionado): <span className="font-semibold text-gray-900">{studentAvg.totalAverage}</span></p>
                  </div>
                  <button
                    onClick={() => toggleExpansion(studentAvg.studentName + '-quantitative')}
                    className="text-sm font-medium text-purple-700 hover:text-purple-900"
                  >
                    {expandedActivities[studentAvg.studentName + '-quantitative'] ? 'Ocultar detalles' : 'Ver detalles'}
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_140px] text-sm text-gray-700">
                  <div className="font-medium">Tipo de promedio</div>
                  <div className="font-medium">Valor</div>
                  <div className="font-medium">Notas</div>

                  <div>Cuantitativo</div>
                  <div>{studentAvg.quantitativeAverage ?? 'N/A'}</div>
                  <div>{studentAvg.quantitativeCount > 0 ? `${studentAvg.quantitativeCount} nota${studentAvg.quantitativeCount > 1 ? 's' : ''}` : 'sin datos'}</div>

                  <div>Cualitativo</div>
                  <div>{studentAvg.qualitativeAverage ?? 'N/A'}</div>
                  <div>{studentAvg.qualitativeCount > 0 ? `${studentAvg.qualitativeCount} nota${studentAvg.qualitativeCount > 1 ? 's' : ''}` : 'sin datos'}</div>
                </div>

                {expandedActivities[studentAvg.studentName + '-quantitative'] && (
                  <div className="mt-4 space-y-3 text-sm text-gray-600">
                    {studentAvg.quantitativeDetails.length > 0 && (
                      <div>
                        <p className="font-semibold">Detalles cuantitativos:</p>
                        <ul className="mt-1 list-disc list-inside">
                          {studentAvg.quantitativeDetails.map((detail, dIdx) => (
                            <li key={`q-${dIdx}`}>{detail.topic}: {detail.grade}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {studentAvg.qualitativeDetails.length > 0 && (
                      <div>
                        <p className="font-semibold">Detalles cualitativos:</p>
                        <ul className="mt-1 list-disc list-inside">
                          {studentAvg.qualitativeDetails.map((detail, dIdx) => (
                            <li key={`c-${dIdx}`}>{detail.topic}: {detail.grade}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {studentAvg.quantitativeDetails.length === 0 && studentAvg.qualitativeDetails.length === 0 && (
                      <p>No hay calificaciones registradas en el rango seleccionado.</p>
                    )}
                  </div>
                )}
              </li>
            ))
          ) : (
            <p className="text-gray-600">No hay datos disponibles para calcular promedios en el rango seleccionado.</p>
          )}
        </ul>
      </div>
    </>
  );
};

export default StudentsAveragesSection;
